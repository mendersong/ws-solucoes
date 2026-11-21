import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  budgets,
  clients,
  contracts,
  employees,
  expenses,
  payables,
  payments,
  receipts,
  receivables,
  serviceEmployees,
  services,
  tithes,
  whatsappAdmins,
  whatsappMessages,
  whatsappQueue,
  whatsappSettings,
} from "@/db/schema";
import {
  MONTHS,
  addDays,
  isPast,
  monthRange,
  todayISO,
  toNum,
} from "./format";
import {
  effectiveServiceStatus,
  payableStatus,
  receivableStatus,
  serviceDeadline,
  serviceFinancials,
  titheFor,
  type Deadline,
} from "./finance";

export type AppointmentRow = typeof appointments.$inferSelect;
export type PayableRow = typeof payables.$inferSelect;
export type ReceivableRow = typeof receivables.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type TitheRow = typeof tithes.$inferSelect;
export type ExpenseRow = typeof expenses.$inferSelect;
export type ClientRow = typeof clients.$inferSelect;
export type EmployeeRow = typeof employees.$inferSelect;
export type ServiceRow = typeof services.$inferSelect;
export type BudgetRow = typeof budgets.$inferSelect;
export type ContractRow = typeof contracts.$inferSelect;
export type ReceiptRow = typeof receipts.$inferSelect;

const isoOf = (value: Date | string | null | undefined): string => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

export type ServiceListRow = ServiceRow & {
  clientName: string;
  clientRating: number;
  received: number;
  pending: number;
  expensesTotal: number;
  netResult: number;
  effectiveStatus: string;
  deadline: Deadline;
  team: string[];
};

export async function getServiceList(): Promise<ServiceListRow[]> {
  const [serviceRows, clientRows, expenseRows, paymentRows, titheRows, teamRows, employeeRows] =
    await Promise.all([
      db.select().from(services).orderBy(desc(services.id)),
      db.select().from(clients),
      db.select().from(expenses),
      db.select().from(payments),
      db.select().from(tithes),
      db.select().from(serviceEmployees),
      db.select().from(employees),
    ]);
  const clientById = new Map(clientRows.map((c) => [c.id, c]));
  const employeeById = new Map(employeeRows.map((e) => [e.id, e]));
  return serviceRows.map((service) => {
    const svcExpenses = expenseRows.filter((e) => e.serviceId === service.id);
    const svcPayments = paymentRows.filter((p) => p.serviceId === service.id);
    const svcTithes = titheRows.filter((t) => t.serviceId === service.id);
    const svcTeam = teamRows.filter((t) => t.serviceId === service.id);
    const fin = serviceFinancials({
      contracted: toNum(service.contractedValue),
      expenses: [
        ...svcExpenses.map((e) => ({ amount: toNum(e.amount), category: e.category })),
        ...svcTeam.map((t) => ({ amount: toNum(t.dailyRate) * t.days, category: "funcionarios" })),
      ],
      payments: svcPayments.map((p) => ({ amount: toNum(p.amount) })),
      tithes: svcTithes.map((t) => ({ amount: toNum(t.amount) })),
    });
    const client = service.clientId ? clientById.get(service.clientId) : undefined;
    return {
      ...service,
      clientName: client?.name ?? "Cliente não vinculado",
      clientRating: client?.rating ?? 0,
      received: fin.received,
      pending: fin.pending,
      expensesTotal: fin.expensesTotal,
      netResult: fin.netResult,
      effectiveStatus: effectiveServiceStatus(service),
      deadline: serviceDeadline(service),
      team: teamRows
        .filter((t) => t.serviceId === service.id)
        .map((t) => employeeById.get(t.employeeId)?.name ?? "—"),
    };
  });
}

export type DashboardData = {
  balance: number;
  totalReceivable: number;
  totalPayable: number;
  monthProfit: number;
  monthGross: number;
  invested: number;
  titheAccumulated: number;
  tithePending: number;
  tithePaid: number;
  monthReceived: number;
  monthPaid: number;
  monthExpenses: number;
  monthTithe: number;
  counts: { inProgress: number; scheduled: number; done: number; late: number };
  nextDue: (PayableRow & { computedStatus: string })[];
  nextAppointments: (AppointmentRow & { clientName: string })[];
  flow: { label: string; income: number; outcome: number }[];
  expensesByCategory: { category: string; total: number }[];
  serviceStatus: { status: string; total: number }[];
  serviceTypes: { type: string; total: number; value: number }[];
  clientsCount: number;
  servicesCount: number;
  openBudgets: number;
  monthLabel: string;
  generatedAt: string;
};

export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const { from, to } = monthRange(year, month);
  const inMonth = (date: string | null | undefined) => !!date && date >= from && date <= to;

  const [clientRows, serviceRows, expenseRows, payableRows, receivableRows, paymentRows, titheRows, appointmentRows, budgetRows] =
    await Promise.all([
      db.select().from(clients),
      db.select().from(services),
      db.select().from(expenses),
      db.select().from(payables),
      db.select().from(receivables),
      db.select().from(payments),
      db.select().from(tithes),
      db.select().from(appointments),
      db.select().from(budgets),
    ]);

  const receivedTotal = paymentRows.reduce((s, p) => s + toNum(p.amount), 0);
  const paidPayablesTotal = payableRows
    .filter((p) => p.status === "pago")
    .reduce((s, p) => s + toNum(p.amount), 0);
  const paidTitheTotal = titheRows
    .filter((t) => t.status === "pago")
    .reduce((s, t) => s + toNum(t.amount), 0);

  const monthPayments = paymentRows.filter((p) => inMonth(p.paidAt));
  const monthExpenses = expenseRows.filter((e) => inMonth(e.expenseDate ?? isoOf(e.createdAt)));
  const monthPaid = payableRows.filter((p) => p.status === "pago" && inMonth(p.paidAt));
  const monthTithes = titheRows.filter((t) => inMonth(isoOf(t.createdAt)));
  const monthReceived = monthPayments.reduce((s, p) => s + toNum(p.amount), 0);
  const monthExpensesTotal = monthExpenses.reduce((s, e) => s + toNum(e.amount), 0);
  const monthTitheTotal = monthTithes.reduce((s, t) => s + toNum(t.amount), 0);

  const statusCount = { em_andamento: 0, agendado: 0, concluido: 0, atrasado: 0 };
  for (const service of serviceRows) {
    const status = effectiveServiceStatus(service);
    if (status === "em_andamento") statusCount.em_andamento += 1;
    else if (status === "agendado") statusCount.agendado += 1;
    else if (status === "concluido") statusCount.concluido += 1;
    else if (status === "atrasado") statusCount.atrasado += 1;
  }

  const clientById = new Map(clientRows.map((c) => [c.id, c]));

  const nextDue = payableRows
    .filter((p) => p.status !== "pago")
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
    .slice(0, 6)
    .map((p) => ({ ...p, computedStatus: payableStatus(p.status, p.dueDate) }));

  const nextAppointments = appointmentRows
    .filter((a) => a.date >= todayISO())
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 6)
    .map((a) => ({ ...a, clientName: a.clientId ? clientById.get(a.clientId)?.name ?? "—" : "—" }));

  const flow: { label: string; income: number; outcome: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    const range = monthRange(d.getUTCFullYear(), d.getUTCMonth() + 1);
    const income = paymentRows
      .filter((p) => p.paidAt >= range.from && p.paidAt <= range.to)
      .reduce((s, p) => s + toNum(p.amount), 0);
    const outcome =
      payableRows
        .filter((p) => p.status === "pago" && p.paidAt && p.paidAt >= range.from && p.paidAt <= range.to)
        .reduce((s, p) => s + toNum(p.amount), 0) +
      titheRows
        .filter((t) => t.status === "pago" && t.paidAt && t.paidAt >= range.from && t.paidAt <= range.to)
        .reduce((s, t) => s + toNum(t.amount), 0);
    flow.push({ label: MONTHS[d.getUTCMonth()].slice(0, 3), income, outcome });
  }

  const categoryMap = new Map<string, number>();
  for (const expense of expenseRows) {
    categoryMap.set(expense.category, (categoryMap.get(expense.category) ?? 0) + toNum(expense.amount));
  }
  const expensesByCategory = [...categoryMap.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const typeMap = new Map<string, { total: number; value: number }>();
  for (const service of serviceRows) {
    const current = typeMap.get(service.type) ?? { total: 0, value: 0 };
    typeMap.set(service.type, { total: current.total + 1, value: current.value + toNum(service.contractedValue) });
  }

  const serviceStatusChart = [
    { status: "Em andamento", total: statusCount.em_andamento },
    { status: "Agendados", total: statusCount.agendado },
    { status: "Concluídos", total: statusCount.concluido },
    { status: "Atrasados", total: statusCount.atrasado },
  ];

  return {
    balance: receivedTotal - paidPayablesTotal - paidTitheTotal,
    totalReceivable: receivableRows.reduce(
      (s, r) => s + Math.max(toNum(r.contractedAmount) - toNum(r.receivedAmount), 0),
      0,
    ),
    totalPayable: payableRows
      .filter((p) => p.status !== "pago")
      .reduce((s, p) => s + toNum(p.amount), 0),
    monthProfit: monthReceived - monthExpensesTotal - monthTitheTotal,
    monthGross: monthReceived - monthExpensesTotal,
    invested: expenseRows.reduce((s, e) => s + toNum(e.amount), 0),
    titheAccumulated: titheRows.reduce((s, t) => s + toNum(t.amount), 0),
    tithePending: titheRows
      .filter((t) => t.status !== "pago")
      .reduce((s, t) => s + toNum(t.amount), 0),
    tithePaid: paidTitheTotal,
    monthReceived,
    monthPaid: monthPaid.reduce((s, p) => s + toNum(p.amount), 0),
    monthExpenses: monthExpensesTotal,
    monthTithe: monthTitheTotal,
    counts: {
      inProgress: statusCount.em_andamento,
      scheduled: statusCount.agendado,
      done: statusCount.concluido,
      late: statusCount.atrasado,
    },
    nextDue,
    nextAppointments,
    flow,
    expensesByCategory,
    serviceStatus: serviceStatusChart,
    serviceTypes: [...typeMap.entries()].map(([type, v]) => ({ type, ...v })),
    clientsCount: clientRows.length,
    servicesCount: serviceRows.length,
    openBudgets: budgetRows.filter((b) => b.status === "enviado" || b.status === "rascunho").length,
    monthLabel: `${MONTHS[month - 1]} de ${year}`,
    generatedAt: new Date().toISOString(),
  };
}

export type MonthlySummary = {
  year: number;
  month: number;
  label: string;
  totalReceived: number;
  totalToReceive: number;
  totalPaid: number;
  totalToPay: number;
  overduePayables: number;
  operationalExpenses: number;
  employeeCosts: number;
  transportCosts: number;
  serviceInvestments: number;
  titheReserved: number;
  tithePaid: number;
  grossProfit: number;
  netProfit: number;
  availableBalance: number;
  receivableCount: number;
  payableCount: number;
  paymentsDetail: PaymentRow[];
  payablesDetail: (PayableRow & { computedStatus: string })[];
  receivablesDetail: (ReceivableRow & { clientName: string; balance: number; computedStatus: string })[];
  expensesDetail: ExpenseRow[];
  tithesDetail: TitheRow[];
};

export async function getMonthlySummary(year: number, month: number): Promise<MonthlySummary> {
  const { from, to } = monthRange(year, month);
  const [paymentRows, payableRows, receivableRows, expenseRows, titheRows, clientRows, employeeCostRows] =
    await Promise.all([
      db.select().from(payments),
      db.select().from(payables),
      db.select().from(receivables),
      db.select().from(expenses),
      db.select().from(tithes),
      db.select().from(clients),
      db.select().from(serviceEmployees),
    ]);

  const clientById = new Map(clientRows.map((c) => [c.id, c]));
  const monthPayments = paymentRows.filter((p) => p.paidAt >= from && p.paidAt <= to);
  const monthExpenses = expenseRows.filter((e) => {
    const date = e.expenseDate ?? isoOf(e.createdAt);
    return date >= from && date <= to;
  });
  const monthPayablesPaid = payableRows.filter((p) => p.status === "pago" && p.paidAt && p.paidAt >= from && p.paidAt <= to);
  const monthPayablesDue = payableRows.filter((p) => p.dueDate && p.dueDate >= from && p.dueDate <= to);
  const monthTithes = titheRows.filter((t) => isoOf(t.createdAt) >= from && isoOf(t.createdAt) <= to);

  const totalReceived = monthPayments.reduce((s, p) => s + toNum(p.amount), 0);
  const totalPaid = monthPayablesPaid.reduce((s, p) => s + toNum(p.amount), 0);
  const investments = monthExpenses.reduce((s, e) => s + toNum(e.amount), 0);
  const titheReserved = monthTithes.reduce((s, t) => s + toNum(t.amount), 0);
  const tithePaid = monthTithes
    .filter((t) => t.status === "pago")
    .reduce((s, t) => s + toNum(t.amount), 0);
  const employeeCosts = employeeCostRows.reduce(
    (s, r) => s + toNum(r.dailyRate) * (r.days || 0),
    0,
  );

  const allReceived = paymentRows.reduce((s, p) => s + toNum(p.amount), 0);
  const allPaid =
    payableRows.filter((p) => p.status === "pago").reduce((s, p) => s + toNum(p.amount), 0) +
    titheRows.filter((t) => t.status === "pago").reduce((s, t) => s + toNum(t.amount), 0);

  return {
    year,
    month,
    label: `${MONTHS[month - 1]} de ${year}`,
    totalReceived,
    totalToReceive: receivableRows
      .filter((r) => r.dueDate === null || r.dueDate <= to)
      .reduce((s, r) => s + Math.max(toNum(r.contractedAmount) - toNum(r.receivedAmount), 0), 0),
    totalPaid,
    totalToPay: monthPayablesDue.filter((p) => p.status !== "pago").reduce((s, p) => s + toNum(p.amount), 0),
    overduePayables: payableRows
      .filter((p) => p.status !== "pago" && isPast(p.dueDate))
      .reduce((s, p) => s + toNum(p.amount), 0),
    operationalExpenses: monthExpenses
      .filter((e) => !e.serviceId)
      .reduce((s, e) => s + toNum(e.amount), 0),
    employeeCosts,
    transportCosts: monthExpenses
      .filter((e) => e.category === "transporte")
      .reduce((s, e) => s + toNum(e.amount), 0),
    serviceInvestments: investments,
    titheReserved,
    tithePaid,
    grossProfit: totalReceived - investments,
    netProfit: totalReceived - investments - titheReserved,
    availableBalance: allReceived - allPaid,
    receivableCount: receivableRows.filter((r) => toNum(r.receivedAmount) < toNum(r.contractedAmount)).length,
    payableCount: monthPayablesDue.length,
    paymentsDetail: monthPayments,
    payablesDetail: payableRows
      .filter((p) => (p.dueDate && p.dueDate >= from && p.dueDate <= to) || (p.paidAt && p.paidAt >= from && p.paidAt <= to))
      .map((p) => ({ ...p, computedStatus: payableStatus(p.status, p.dueDate) })),
    receivablesDetail: receivableRows
      .filter((r) => !r.dueDate || (r.dueDate >= from && r.dueDate <= to))
      .map((r) => ({
        ...r,
        clientName: r.clientId ? clientById.get(r.clientId)?.name ?? "—" : "—",
        balance: Math.max(toNum(r.contractedAmount) - toNum(r.receivedAmount), 0),
        computedStatus: receivableStatus(toNum(r.contractedAmount), toNum(r.receivedAmount), r.dueDate),
      })),
    expensesDetail: monthExpenses,
    tithesDetail: monthTithes,
  };
}

export async function getServiceDetail(id: number) {
  const [serviceRows, clientRows, expenseRows, paymentRows, titheRows, teamRows, employeeRows, receivableRows, budgetRows, receiptRows, appointmentRows] =
    await Promise.all([
      db.select().from(services).where(eq(services.id, id)).limit(1),
      db.select().from(clients),
      db.select().from(expenses).where(eq(expenses.serviceId, id)),
      db.select().from(payments).where(eq(payments.serviceId, id)),
      db.select().from(tithes).where(eq(tithes.serviceId, id)),
      db.select().from(serviceEmployees).where(eq(serviceEmployees.serviceId, id)),
      db.select().from(employees),
      db.select().from(receivables).where(eq(receivables.serviceId, id)),
      db.select().from(budgets).where(eq(budgets.serviceId, id)),
      db.select().from(receipts).where(eq(receipts.serviceId, id)),
      db.select().from(appointments).where(eq(appointments.serviceId, id)),
    ]);
  const service = serviceRows[0];
  if (!service) return null;
  const employeeById = new Map(employeeRows.map((e) => [e.id, e]));
  const fin = serviceFinancials({
    contracted: toNum(service.contractedValue),
    expenses: [
      ...expenseRows.map((e) => ({ amount: toNum(e.amount), category: e.category })),
      ...teamRows.map((t) => ({ amount: toNum(t.dailyRate) * t.days, category: "funcionarios" })),
    ],
    payments: paymentRows.map((p) => ({ amount: toNum(p.amount) })),
    tithes: titheRows.map((t) => ({ amount: toNum(t.amount) })),
  });
  return {
    service,
    client: service.clientId ? clientRows.find((c) => c.id === service.clientId) ?? null : null,
    expenses: expenseRows,
    payments: paymentRows,
    tithes: titheRows,
    team: teamRows.map((t) => ({
      ...t,
      name: employeeById.get(t.employeeId)?.name ?? "—",
      role: employeeById.get(t.employeeId)?.role ?? "",
      total: toNum(t.dailyRate) * t.days,
    })),
    receivable: receivableRows[0] ?? null,
    budget: budgetRows[0] ?? null,
    receipts: receiptRows,
    appointments: appointmentRows,
    financials: fin,
    deadline: serviceDeadline(service),
  };
}

export async function getClientDetail(id: number) {
  const [clientRows, serviceRows, budgetRows, contractRows, paymentRows, receivableRows, receiptRows] =
    await Promise.all([
      db.select().from(clients).where(eq(clients.id, id)).limit(1),
      db.select().from(services).where(eq(services.clientId, id)),
      db.select().from(budgets).where(eq(budgets.clientId, id)),
      db.select().from(contracts).where(eq(contracts.clientId, id)),
      db.select().from(payments).where(eq(payments.clientId, id)),
      db.select().from(receivables).where(eq(receivables.clientId, id)),
      db.select().from(receipts).where(eq(receipts.clientId, id)),
    ]);
  const client = clientRows[0];
  if (!client) return null;
  return {
    client,
    services: serviceRows,
    budgets: budgetRows,
    contracts: contractRows,
    payments: paymentRows,
    receivables: receivableRows,
    receipts: receiptRows,
    totals: {
      contracted: serviceRows.reduce((s, x) => s + toNum(x.contractedValue), 0),
      received: paymentRows.reduce((s, x) => s + toNum(x.amount), 0),
    },
  };
}

export async function getFormOptions() {
  const [clientRows, employeeRows, serviceRows, receivableRows] = await Promise.all([
    db.select().from(clients).orderBy(clients.name),
    db.select().from(employees).orderBy(employees.name),
    db.select().from(services).orderBy(desc(services.id)),
    db.select().from(receivables).orderBy(desc(receivables.id)),
  ]);
  return {
    clients: clientRows.map((c) => ({ id: c.id, name: c.name, phone: c.whatsapp ?? c.phone ?? "", rating: c.rating, address: c.address ?? "", city: c.city ?? "", state: c.state ?? "" })),
    employees: employeeRows.map((e) => ({ id: e.id, name: e.name, role: e.role ?? "", dailyRate: toNum(e.dailyRate), active: e.active })),
    services: serviceRows.map((s) => ({ id: s.id, code: s.code, title: s.title, type: s.type, clientId: s.clientId, contractedValue: toNum(s.contractedValue), status: s.status })),
    receivables: receivableRows.map((r) => ({
      id: r.id,
      description: r.description,
      clientId: r.clientId,
      serviceId: r.serviceId,
      contractedAmount: toNum(r.contractedAmount),
      receivedAmount: toNum(r.receivedAmount),
      balance: Math.max(toNum(r.contractedAmount) - toNum(r.receivedAmount), 0),
      dueDate: r.dueDate,
    })),
  };
}

export async function getWhatsAppPanel() {
  const [settingsRows, adminRows, messageRows, queueRows] = await Promise.all([
    db.select().from(whatsappSettings).limit(1),
    db.select().from(whatsappAdmins).orderBy(desc(whatsappAdmins.id)),
    db.select().from(whatsappMessages).orderBy(desc(whatsappMessages.id)).limit(40),
    db.select().from(whatsappQueue).orderBy(desc(whatsappQueue.id)).limit(40),
  ]);
  const settings = settingsRows[0] ?? null;
  return {
    settings,
    connected: settings?.status === "conectado",
    configured: Boolean(settings?.baseUrl && settings?.apiKey && settings?.instanceName),
    admins: adminRows,
    messages: messageRows,
    queue: queueRows,
    tithePreview: titheFor(5000),
    tomorrow: addDays(todayISO(), 1),
  };
}
