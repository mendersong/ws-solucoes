import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  budgetItems,
  budgets,
  clients,
  contracts,
  employees,
  payables,
  payments,
  receipts,
  receivables,
  serviceEmployees,
  services,
  tithes,
} from "@/db/schema";
import { addDays, todayISO, toNum } from "./format";
import { receivableStatus, serviceDeadline, titheFor } from "./finance";
import { logAudit } from "./audit";
import type { SessionUser } from "./auth";

export class BusinessError extends Error {}

async function nextNumber(prefix: string, existing: number, year = new Date().getFullYear()) {
  return `${prefix}-${year}-${String(existing + 1).padStart(4, "0")}`;
}

export async function registerPayment(input: {
  receivableId?: number | null;
  clientId?: number | null;
  serviceId?: number | null;
  amount: number;
  paidAt?: string;
  paymentMethod?: string;
  notes?: string | null;
  user?: SessionUser | null;
}) {
  const amount = Math.round(toNum(input.amount) * 100) / 100;
  if (!(amount > 0)) throw new BusinessError("O valor do recebimento deve ser maior que zero.");

  let clientId = input.clientId ?? null;
  let serviceId = input.serviceId ?? null;
  let receivableId = input.receivableId ?? null;

  const existing = receivableId
    ? (await db.select().from(receivables).where(eq(receivables.id, receivableId)).limit(1))[0]
    : undefined;

  if (existing) {
    clientId = existing.clientId;
    serviceId = existing.serviceId;
  } else {
    if (serviceId && !clientId) {
      const svc = (await db.select().from(services).where(eq(services.id, serviceId)).limit(1))[0];
      clientId = svc?.clientId ?? null;
    }
    const created = await db
      .insert(receivables)
      .values({
        clientId,
        serviceId,
        description: input.notes?.trim() || "Recebimento avulso",
        contractedAmount: String(amount),
        receivedAmount: "0",
        dueDate: input.paidAt ?? todayISO(),
        status: "pendente",
        installments: 1,
      })
      .returning();
    receivableId = created[0]!.id;
  }

  const paidAt = input.paidAt ?? todayISO();
  const method = input.paymentMethod ?? "PIX";
  const titheAmount = titheFor(amount);

  const paymentRow = (
    await db
      .insert(payments)
      .values({
        receivableId,
        clientId,
        serviceId,
        amount: String(amount),
        paidAt,
        paymentMethod: method,
        notes: input.notes ?? null,
        titheAmount: String(titheAmount),
      })
      .returning()
  )[0]!;

  const titheRow = (
    await db
      .insert(tithes)
      .values({
        paymentId: paymentRow.id,
        serviceId,
        baseAmount: String(amount),
        amount: String(titheAmount),
        status: "reservado",
        notes: `Dízimo automático (10%) sobre recebimento #${paymentRow.id}`,
      })
      .returning()
  )[0]!;

  const currentReceivable = (await db.select().from(receivables).where(eq(receivables.id, receivableId!)).limit(1))[0]!;
  const totalReceived = Math.round((toNum(currentReceivable.receivedAmount) + amount) * 100) / 100;
  const contracted = toNum(currentReceivable.contractedAmount);
  const status = receivableStatus(contracted, totalReceived, currentReceivable.dueDate);
  await db
    .update(receivables)
    .set({ receivedAmount: String(totalReceived), status, paymentMethod: method })
    .where(eq(receivables.id, receivableId!));

  const remaining = Math.max(Math.round((contracted - totalReceived) * 100) / 100, 0);
  const receiptCount = (await db.select({ id: receipts.id }).from(receipts)).length;
  const receiptRow = (
    await db
      .insert(receipts)
      .values({
        number: await nextNumber("REC", receiptCount),
        paymentId: paymentRow.id,
        clientId,
        serviceId,
        amount: String(amount),
        receiptDate: paidAt,
        paymentMethod: method,
        remainingBalance: String(remaining),
      })
      .returning()
  )[0]!;

  await logAudit({
    user: input.user ?? null,
    action: "registrar_recebimento",
    entity: "payments",
    entityId: paymentRow.id,
    details: { amount, clientId, serviceId, titheAmount, receivableId },
  });

  return { payment: paymentRow, tithe: titheRow, receipt: receiptRow, remaining, receivableStatus: status };
}

export async function payPayable(input: {
  payableId: number;
  paidAt?: string;
  paymentMethod?: string;
  user?: SessionUser | null;
}) {
  const row = (await db.select().from(payables).where(eq(payables.id, input.payableId)).limit(1))[0];
  if (!row) throw new BusinessError("Conta a pagar não encontrada.");
  if (row.status === "pago") throw new BusinessError("Esta conta já está marcada como paga.");
  const updated = (
    await db
      .update(payables)
      .set({
        status: "pago",
        paidAt: input.paidAt ?? todayISO(),
        paymentMethod: input.paymentMethod ?? row.paymentMethod ?? "PIX",
      })
      .where(eq(payables.id, input.payableId))
      .returning()
  )[0]!;
  await logAudit({
    user: input.user ?? null,
    action: "pagar_conta",
    entity: "payables",
    entityId: updated.id,
    details: { amount: toNum(updated.amount) },
  });
  return updated;
}

export async function payTithe(input: { titheId?: number; all?: boolean; paidAt?: string; user?: SessionUser | null }) {
  const paidAt = input.paidAt ?? todayISO();
  if (input.all) {
    const updated = await db
      .update(tithes)
      .set({ status: "pago", paidAt })
      .where(ne(tithes.status, "pago"))
      .returning();
    await logAudit({ user: input.user ?? null, action: "pagar_dizimo_total", entity: "tithes", details: { count: updated.length } });
    return updated;
  }
  if (!input.titheId) throw new BusinessError("Informe o dízimo a ser pago.");
  const updated = await db
    .update(tithes)
    .set({ status: "pago", paidAt })
    .where(eq(tithes.id, input.titheId))
    .returning();
  if (!updated[0]) throw new BusinessError("Registro de dízimo não encontrado.");
  await logAudit({ user: input.user ?? null, action: "pagar_dizimo", entity: "tithes", entityId: updated[0].id });
  return updated;
}

export async function concludeService(input: {
  serviceId: number;
  realEndDate?: string;
  user?: SessionUser | null;
}) {
  const service = (await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1))[0];
  if (!service) throw new BusinessError("Serviço não encontrado.");
  const realEndDate = input.realEndDate ?? todayISO();
  const realStartDate = service.realStartDate ?? service.startDate ?? realEndDate;
  const updated = (
    await db
      .update(services)
      .set({
        status: "concluido",
        realEndDate,
        realStartDate,
        updatedAt: new Date(),
      })
      .where(eq(services.id, input.serviceId))
      .returning()
  )[0]!;
  await db.update(appointments).set({ status: "concluido" }).where(eq(appointments.serviceId, input.serviceId));
  const deadline = serviceDeadline(updated);
  await logAudit({
    user: input.user ?? null,
    action: "concluir_servico",
    entity: "services",
    entityId: updated.id,
    details: { realEndDate, deltaDays: deadline.deltaDays, late: deadline.late },
  });
  return { service: updated, deadline };
}

export async function startService(input: { serviceId: number; realStartDate?: string; user?: SessionUser | null }) {
  const updated = await db
    .update(services)
    .set({ status: "em_andamento", realStartDate: input.realStartDate ?? todayISO(), updatedAt: new Date() })
    .where(eq(services.id, input.serviceId))
    .returning();
  if (!updated[0]) throw new BusinessError("Serviço não encontrado.");
  await db.update(appointments).set({ status: "em_andamento" }).where(eq(appointments.serviceId, input.serviceId));
  await logAudit({ user: input.user ?? null, action: "iniciar_servico", entity: "services", entityId: input.serviceId });
  return updated[0];
}

export async function assignTeam(input: {
  serviceId: number;
  team: { employeeId: number; days: number }[];
  user?: SessionUser | null;
}) {
  await db.delete(serviceEmployees).where(eq(serviceEmployees.serviceId, input.serviceId));
  if (input.team.length > 0) {
    const employeeRows = await db.select().from(employees);
    const byId = new Map(employeeRows.map((e) => [e.id, e]));
    const values = input.team
      .filter((t) => byId.has(t.employeeId))
      .map((t) => ({
        serviceId: input.serviceId,
        employeeId: t.employeeId,
        days: Math.max(1, Number(t.days) || 1),
        dailyRate: String(toNum(byId.get(t.employeeId)!.dailyRate)),
      }));
    if (values.length > 0) await db.insert(serviceEmployees).values(values);
  }
  await logAudit({ user: input.user ?? null, action: "definir_equipe", entity: "services", entityId: input.serviceId, details: { team: input.team } });
  return { ok: true };
}

export async function saveBudget(input: {
  id?: number;
  clientId?: number | null;
  title: string;
  description?: string | null;
  paymentTerms?: string | null;
  validUntil?: string | null;
  discount?: number;
  items: { kind: string; description: string; quantity: number; unitPrice: number }[];
  status?: string;
  user?: SessionUser | null;
}) {
  if (!input.title?.trim()) throw new BusinessError("Informe o título do orçamento.");
  if (!input.items || input.items.length === 0) throw new BusinessError("Adicione pelo menos um item ao orçamento.");
  const items = input.items.map((item) => {
    const quantity = toNum(item.quantity) || 1;
    const unitPrice = toNum(item.unitPrice);
    return {
      kind: item.kind === "material" ? "material" : "mao_de_obra",
      description: item.description?.trim() || "Item",
      quantity: String(quantity),
      unitPrice: String(unitPrice),
      total: String(Math.round(quantity * unitPrice * 100) / 100),
    };
  });
  const laborTotal = items.filter((i) => i.kind === "mao_de_obra").reduce((s, i) => s + toNum(i.total), 0);
  const materialTotal = items.filter((i) => i.kind === "material").reduce((s, i) => s + toNum(i.total), 0);
  const discount = Math.max(toNum(input.discount), 0);
  const total = Math.max(Math.round((laborTotal + materialTotal - discount) * 100) / 100, 0);

  let budgetId = input.id;
  if (budgetId) {
    await db
      .update(budgets)
      .set({
        clientId: input.clientId ?? null,
        title: input.title,
        description: input.description ?? null,
        paymentTerms: input.paymentTerms ?? null,
        validUntil: input.validUntil ?? null,
        discount: String(discount),
        laborTotal: String(laborTotal),
        materialTotal: String(materialTotal),
        total: String(total),
        status: input.status ?? "enviado",
      })
      .where(eq(budgets.id, budgetId));
    await db.delete(budgetItems).where(eq(budgetItems.budgetId, budgetId));
  } else {
    const count = (await db.select({ id: budgets.id }).from(budgets)).length;
    const created = await db
      .insert(budgets)
      .values({
        number: await nextNumber("ORC", count),
        clientId: input.clientId ?? null,
        title: input.title,
        description: input.description ?? null,
        paymentTerms: input.paymentTerms ?? null,
        validUntil: input.validUntil ?? null,
        discount: String(discount),
        laborTotal: String(laborTotal),
        materialTotal: String(materialTotal),
        total: String(total),
        status: input.status ?? "enviado",
      })
      .returning();
    budgetId = created[0]!.id;
  }
  const budgetItemRows = items.map((item) => ({ ...item, budgetId: budgetId! }));
  await db.insert(budgetItems).values(budgetItemRows);
  await logAudit({ user: input.user ?? null, action: input.id ? "editar_orcamento" : "criar_orcamento", entity: "budgets", entityId: budgetId, details: { total } });
  return { budgetId, total, laborTotal, materialTotal };
}

export async function approveBudget(input: {
  budgetId: number;
  startDate?: string;
  days?: number;
  serviceType?: string;
  user?: SessionUser | null;
}) {
  const budget = (await db.select().from(budgets).where(eq(budgets.id, input.budgetId)).limit(1))[0];
  if (!budget) throw new BusinessError("Orçamento não encontrado.");
  if (budget.serviceId) throw new BusinessError("Este orçamento já foi convertido em serviço.");
  const startDate = input.startDate ?? todayISO();
  const days = Math.max(1, toNum(input.days) || 7);
  const serviceCount = (await db.select({ id: services.id }).from(services)).length;
  const client = budget.clientId
    ? (await db.select().from(clients).where(eq(clients.id, budget.clientId)).limit(1))[0]
    : undefined;
  const createdService = (
    await db
      .insert(services)
      .values({
        code: `WS-${String(serviceCount + 1).padStart(4, "0")}`,
        clientId: budget.clientId,
        type: input.serviceType ?? "Reformas",
        title: budget.title,
        description: budget.description,
        address: client?.address ?? null,
        contractedValue: budget.total,
        startDate,
        endDate: addDays(startDate, days - 1),
        status: "agendado",
        notes: `Gerado automaticamente do orçamento ${budget.number}`,
      })
      .returning()
  )[0]!;

  const receivable = (
    await db
      .insert(receivables)
      .values({
        clientId: budget.clientId,
        serviceId: createdService.id,
        description: `Serviço ${createdService.code} — ${budget.title}`,
        contractedAmount: budget.total,
        receivedAmount: "0",
        dueDate: budget.validUntil ?? addDays(startDate, 30),
        installments: 1,
        status: "pendente",
      })
      .returning()
  )[0]!;

  const contractCount = (await db.select({ id: contracts.id }).from(contracts)).length;
  const contract = (
    await db
      .insert(contracts)
      .values({
        number: await nextNumber("CT", contractCount),
        clientId: budget.clientId,
        serviceId: createdService.id,
        title: `Contrato de prestação de serviços — ${budget.title}`,
        scope: budget.description ?? budget.title,
        value: budget.total,
        startDate,
        endDate: addDays(startDate, days - 1),
        paymentTerms: budget.paymentTerms ?? "Conforme orçamento aprovado.",
        obligations:
          "CONTRATADA: executar os serviços com qualidade, fornecer mão de obra e materiais conforme escopo, cumprir prazos e garantir os serviços. CONTRATANTE: fornecer acesso ao local, efetuar os pagamentos nas condições acordadas e comunicar eventuais impedimentos.",
        status: "ativo",
      })
      .returning()
  )[0]!;

  const appointment = (
    await db
      .insert(appointments)
      .values({
        clientId: budget.clientId,
        serviceId: createdService.id,
        title: budget.title,
        address: client?.address ?? null,
        date: startDate,
        time: "08:00",
        days,
        plannedEndDate: addDays(startDate, days - 1),
        status: "agendado",
        notes: `Agendamento criado a partir do orçamento ${budget.number}`,
      })
      .returning()
  )[0]!;

  await db.update(budgets).set({ status: "aprovado", serviceId: createdService.id }).where(eq(budgets.id, budget.id));
  await logAudit({
    user: input.user ?? null,
    action: "aprovar_orcamento",
    entity: "budgets",
    entityId: budget.id,
    details: { serviceId: createdService.id, value: toNum(budget.total) },
  });
  return { service: createdService, receivable, contract, appointment };
}

export async function createServiceFromScratch(input: {
  clientId?: number | null;
  type: string;
  title: string;
  description?: string | null;
  address?: string | null;
  contractedValue: number;
  startDate?: string | null;
  days?: number;
}) {
  const count = (await db.select({ id: services.id }).from(services)).length;
  return (
    await db
      .insert(services)
      .values({
        code: `WS-${String(count + 1).padStart(4, "0")}`,
        clientId: input.clientId ?? null,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        address: input.address ?? null,
        contractedValue: String(input.contractedValue),
        startDate: input.startDate ?? todayISO(),
        endDate: input.startDate ? addDays(input.startDate, Math.max(1, input.days ?? 1) - 1) : null,
        status: "agendado",
      })
      .returning()
  )[0]!;
}

export async function openReceivablesCount() {
  const rows = await db
    .select({ id: receivables.id })
    .from(receivables)
    .where(and(isNull(receivables.dueDate), eq(receivables.status, "pendente")));
  return rows.length;
}
