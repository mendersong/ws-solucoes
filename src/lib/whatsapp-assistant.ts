import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, chatConfirmations, clients, payables, receivables, services } from "@/db/schema";
import { formatDateBR, money, parseMoney, todayISO, toNum } from "./format";
import { effectiveServiceStatus } from "./finance";
import { getDashboardData, getMonthlySummary } from "./queries";
import { concludeService, payPayable, registerPayment } from "./mutations";
import type { SessionUser } from "./auth";

export type AssistantReply = { reply: string; intent: string };

const MENU = [
  "*WS SOLUÇÕES* — Assistente administrativo",
  "",
  "Consultas:",
  "• *saldo* — saldo e pendências",
  "• *lucro* — resultado do mês",
  "• *dizimo* — dízimo reservado e pago",
  "• *contas* — próximos vencimentos",
  "• *receber* — valores a receber",
  "• *agenda* — próximos agendamentos",
  "• *obras* — serviços em andamento",
  "• *atrasadas* — obras fora do prazo",
  "• *relatorio* — resumo do mês",
  "",
  "Operações (pedem confirmação):",
  "• *pagar 12* — quitar conta a pagar #12",
  "• *concluir 4* — concluir obra #4",
  "• *receber 3 1500* — registrar recebimento",
  "",
  "Para executar responda *CONFIRMAR + código*.",
].join("\n");

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function shortServiceLine(service: typeof services.$inferSelect): string {
  const status = effectiveServiceStatus(service);
  return `• #${service.id} ${service.code} — ${service.title}\n   ${status.replace("_", " ")} | prazo ${formatDateBR(service.endDate)} | ${money(service.contractedValue)}`;
}

export async function handleAssistantMessage(
  phone: string,
  rawText: string,
  options: { user?: SessionUser | null } = {},
): Promise<AssistantReply> {
  const text = normalize(rawText);

  const confirmMatch = text.match(/^confirmar\s+#?(\d+)$/);
  if (confirmMatch) return executeConfirmation(phone, Number(confirmMatch[1]), options.user);

  if (/^(cancelar|desistir)$/.test(text)) {
    return { intent: "cancelar", reply: "Ok, nenhuma alteração foi executada. Envie *menu* para ver os comandos." };
  }

  const payMatch = text.match(/^pagar\s+#?(\d+)$/);
  if (payMatch) return preparePayPayable(phone, Number(payMatch[1]));

  const concludeMatch = text.match(/^concluir\s+(?:obra|servico)?\s*#?(\d+)$/);
  if (concludeMatch) return prepareConclude(phone, Number(concludeMatch[1]));

  const receiveMatch = text.match(/^receber\s+#?(\d+)\s+(.+)$/);
  if (receiveMatch) {
    return prepareReceivable(phone, Number(receiveMatch[1]), parseMoney(receiveMatch[2]));
  }

  if (/^(saldo|carteira|caixa)/.test(text)) {
    const data = await getDashboardData();
    return {
      intent: "saldo",
      reply: [
        "💰 *SALDO — WS SOLUÇÕES*",
        `Disponível: *${money(data.balance)}*`,
        `A receber: ${money(data.totalReceivable)}`,
        `A pagar: ${money(data.totalPayable)}`,
        `Dízimo reservado: ${money(data.tithePending)}`,
        `Dízimo já pago: ${money(data.tithePaid)}`,
        "",
        `Atualizado em ${new Date().toLocaleString("pt-BR")}`,
      ].join("\n"),
    };
  }

  if (/^(lucro|resultado|faturamento)/.test(text)) {
    const data = await getDashboardData();
    return {
      intent: "lucro",
      reply: [
        `📈 *RESULTADO — ${data.monthLabel}*`,
        `Recebido: ${money(data.monthReceived)}`,
        `Despesas/custos: ${money(data.monthExpenses)}`,
        `Dízimo reservado: ${money(data.monthTithe)}`,
        `Lucro líquido: *${money(data.monthProfit)}*`,
        "",
        "Lucro = recebimentos efetivos − despesas do mês − dízimo reservado.",
      ].join("\n"),
    };
  }

  if (/^(dizimo|dizimos)/.test(text)) {
    const data = await getDashboardData();
    return {
      intent: "dizimo",
      reply: [
        "🙏 *DÍZIMO — WS SOLUÇÕES*",
        `Reservado a pagar: *${money(data.tithePending)}*`,
        `Total já pago: ${money(data.tithePaid)}`,
        `Acumulado histórico: ${money(data.titheAccumulated)}`,
        "",
        "O dízimo é calculado sobre cada valor efetivamente recebido (10%), inclusive em recebimentos parciais.",
      ].join("\n"),
    };
  }

  if (/^(contas|vencimentos?|vencer|a pagar)/.test(text)) {
    const rows = await db.select().from(payables).orderBy(payables.dueDate);
    const pending = rows.filter((p) => p.status !== "pago").slice(0, 6);
    if (pending.length === 0) return { intent: "contas", reply: "✅ Nenhuma conta pendente no momento." };
    return {
      intent: "contas",
      reply: [
        "*📅 PRÓXIMOS VENCIMENTOS*",
        ...pending.map(
          (p) =>
            `• #${p.id} ${p.description}\n   ${money(p.amount)} | vence ${formatDateBR(p.dueDate)}${
              p.dueDate < todayISO() ? " ⚠️ atrasada" : ""
            }`,
        ),
        "",
        "Para quitar: *pagar <número>*",
      ].join("\n"),
    };
  }

  if (/^(receber|recebimentos|a receber)/.test(text)) {
    const rows = await db.select().from(receivables).orderBy(receivables.dueDate);
    const pending = rows.filter((r) => toNum(r.receivedAmount) < toNum(r.contractedAmount)).slice(0, 6);
    if (pending.length === 0) return { intent: "a_receber", reply: "✅ Não há valores pendentes de recebimento." };
    return {
      intent: "a_receber",
      reply: [
        "*💵 VALORES A RECEBER*",
        ...pending.map(
          (r) =>
            `• #${r.id} ${r.description}\n   saldo ${money(
              toNum(r.contractedAmount) - toNum(r.receivedAmount),
            )} | previsto ${formatDateBR(r.dueDate)}`,
        ),
        "",
        "Para registrar: *receber <número> <valor>*",
      ].join("\n"),
    };
  }

  if (/^(agenda|hoje|amanha|agendamentos)/.test(text)) {
    const rows = await db.select().from(appointments).orderBy(appointments.date);
    const clientRows = await db.select().from(clients);
    const byId = new Map(clientRows.map((c) => [c.id, c.name]));
    const next = rows.filter((a) => a.date >= todayISO()).slice(0, 6);
    if (next.length === 0) return { intent: "agenda", reply: "📅 Nenhum agendamento futuro registrado." };
    return {
      intent: "agenda",
      reply: [
        "*📅 PRÓXIMOS AGENDAMENTOS*",
        ...next.map(
          (a) =>
            `• ${formatDateBR(a.date)} ${a.time} — ${a.title}\n   ${a.clientId ? byId.get(a.clientId) ?? "" : ""} ${
              a.address ? `| ${a.address}` : ""
            }`,
        ),
      ].join("\n"),
    };
  }

  if (/^(atrasad|atraso)/.test(text)) {
    const rows = await db.select().from(services);
    const late = rows.filter((s) => effectiveServiceStatus(s) === "atrasado");
    if (late.length === 0) return { intent: "atrasadas", reply: "✅ Nenhuma obra atrasada. Tudo em dia!" };
    return {
      intent: "atrasadas",
      reply: ["*🔴 OBRAS ATRASADAS*", ...late.slice(0, 8).map(shortServiceLine)].join("\n"),
    };
  }

  if (/^(obras?|servicos?|andamento)/.test(text)) {
    const rows = await db.select().from(services).orderBy(services.endDate);
    const open = rows.filter((s) => !["concluido", "cancelado"].includes(s.status));
    const data = await getDashboardData();
    return {
      intent: "obras",
      reply: [
        `*🏗️ SERVIÇOS EM ANDAMENTO (${open.length})*`,
        ...open.slice(0, 6).map(shortServiceLine),
        "",
        `Concluídos: ${data.counts.done} | Atrasados: ${data.counts.late} | Agendados: ${data.counts.scheduled}`,
        "Para concluir: *concluir <número>*",
      ].join("\n"),
    };
  }

  if (/^(clientes?)/.test(text)) {
    const rows = await db.select().from(clients);
    const count = rows.length;
    return {
      intent: "clientes",
      reply: `👥 *CLIENTES*\nTotal cadastrado: *${count}*\nUse o painel WS Soluções para consultar históricos, orçamentos e pendências.`,
    };
  }

  if (/^(relatorio|resumo|fechamento)/.test(text)) {
    const now = new Date();
    const summary = await getMonthlySummary(now.getFullYear(), now.getMonth() + 1);
    return {
      intent: "relatorio",
      reply: [
        `*📊 RESUMO — ${summary.label}*`,
        `Recebido: ${money(summary.totalReceived)}`,
        `Pago: ${money(summary.totalPaid)}`,
        `A pagar no mês: ${money(summary.totalToPay)}`,
        `Despesas operacionais: ${money(summary.operationalExpenses)}`,
        `Dízimo reservado: ${money(summary.titheReserved)}`,
        `Lucro bruto: ${money(summary.grossProfit)}`,
        `Lucro líquido: *${money(summary.netProfit)}*`,
        `Saldo disponível: ${money(summary.availableBalance)}`,
      ].join("\n"),
    };
  }

  return { intent: "menu", reply: MENU };
}

async function preparePayPayable(phone: string, id: number): Promise<AssistantReply> {
  const row = (await db.select().from(payables).where(eq(payables.id, id)).limit(1))[0];
  if (!row) return { intent: "pagar_conta", reply: `Não encontrei a conta #${id}.` };
  if (row.status === "pago") return { intent: "pagar_conta", reply: `A conta #${id} já está paga.` };
  const confirmation = (
    await db
      .insert(chatConfirmations)
      .values({
        phone,
        action: "pagar_conta",
        targetId: id,
        amount: row.amount,
        summary: `Pagar conta #${id} — ${row.description} (${money(row.amount)})`,
      })
      .returning()
  )[0]!;
  return {
    intent: "confirmacao_pagar_conta",
    reply: `⚠️ *Confirmação necessária*\n${confirmation.summary}\n\nResponda *CONFIRMAR ${confirmation.id}* para executar ou *cancelar*.`,
  };
}

async function prepareConclude(phone: string, id: number): Promise<AssistantReply> {
  const row = (await db.select().from(services).where(eq(services.id, id)).limit(1))[0];
  if (!row) return { intent: "concluir_servico", reply: `Não encontrei a obra #${id}.` };
  if (row.status === "concluido") return { intent: "concluir_servico", reply: `A obra #${id} já está concluída.` };
  const confirmation = (
    await db
      .insert(chatConfirmations)
      .values({
        phone,
        action: "concluir_servico",
        targetId: id,
        summary: `Concluir obra ${row.code} — ${row.title} (hoje ${formatDateBR(todayISO())})`,
      })
      .returning()
  )[0]!;
  return {
    intent: "confirmacao_concluir",
    reply: `⚠️ *Confirmação necessária*\n${confirmation.summary}\n\nResponda *CONFIRMAR ${confirmation.id}* para executar ou *cancelar*.`,
  };
}

async function prepareReceivable(phone: string, id: number, amount: number): Promise<AssistantReply> {
  const row = (await db.select().from(receivables).where(eq(receivables.id, id)).limit(1))[0];
  if (!row) return { intent: "receber", reply: `Não encontrei a conta a receber #${id}.` };
  if (!(amount > 0)) {
    return { intent: "receber", reply: `Informe o valor. Exemplo: *receber ${id} 1500,00*` };
  }
  const balance = Math.max(toNum(row.contractedAmount) - toNum(row.receivedAmount), 0);
  if (amount > balance + 0.01) {
    return { intent: "receber", reply: `O valor informado (${money(amount)}) é maior que o saldo devedor (${money(balance)}).` };
  }
  const confirmation = (
    await db
      .insert(chatConfirmations)
      .values({
        phone,
        action: "registrar_recebimento",
        targetId: id,
        amount: String(amount),
        summary: `Registrar recebimento de ${money(amount)} na conta #${id} — ${row.description} (dízimo ${money(
          amount * 0.1,
        )})`,
      })
      .returning()
  )[0]!;
  return {
    intent: "confirmacao_receber",
    reply: `⚠️ *Confirmação necessária*\n${confirmation.summary}\n\nResponda *CONFIRMAR ${confirmation.id}* para executar ou *cancelar*.`,
  };
}

async function executeConfirmation(
  phone: string,
  code: number,
  user?: SessionUser | null,
): Promise<AssistantReply> {
  const row = (await db.select().from(chatConfirmations).where(eq(chatConfirmations.id, code)).limit(1))[0];
  if (!row) return { intent: "confirmar", reply: `Código ${code} não encontrado.` };
  if (row.usedAt) return { intent: "confirmar", reply: `O código ${code} já foi utilizado.` };
  if (row.phone !== phone) return { intent: "confirmar", reply: "Este código não pertence ao seu número." };
  if (Date.now() - row.createdAt.getTime() > 1000 * 60 * 30) {
    return { intent: "confirmar", reply: "Este código expirou. Envie o comando novamente." };
  }

  try {
    if (row.action === "pagar_conta" && row.targetId) {
      const updated = await payPayable({ payableId: row.targetId, user });
      await db.update(chatConfirmations).set({ usedAt: new Date() }).where(eq(chatConfirmations.id, code));
      return {
        intent: "pagar_conta",
        reply: `✅ Conta paga: ${updated.description} — ${money(updated.amount)}. Baixa registrada no financeiro.`,
      };
    }
    if (row.action === "concluir_servico" && row.targetId) {
      const result = await concludeService({ serviceId: row.targetId, user });
      await db.update(chatConfirmations).set({ usedAt: new Date() }).where(eq(chatConfirmations.id, code));
      return {
        intent: "concluir_servico",
        reply: `✅ Obra concluída: ${result.service.code} — ${result.service.title}.\n${result.deadline.label}.`,
      };
    }
    if (row.action === "registrar_recebimento" && row.targetId) {
      const amount = toNum(row.amount);
      const result = await registerPayment({
        receivableId: row.targetId,
        amount,
        paymentMethod: "PIX",
        notes: "Recebimento registrado via WhatsApp",
        user,
      });
      await db.update(chatConfirmations).set({ usedAt: new Date() }).where(eq(chatConfirmations.id, code));
      return {
        intent: "registrar_recebimento",
        reply: `✅ Recebimento de ${money(amount)} registrado.\nDízimo reservado: ${money(
          result.tithe.amount,
        )}.\nSaldo restante: ${money(result.remaining)}.\nRecibo ${result.receipt.number} gerado.`,
      };
    }
    return { intent: "confirmar", reply: "Ação desconhecida. Nenhuma alteração foi executada." };
  } catch (error) {
    return { intent: "confirmar", reply: `Não foi possível executar: ${(error as Error).message}` };
  }
}


