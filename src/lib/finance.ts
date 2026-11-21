import { diffDays, isPast, todayISO, toNum } from "./format";

export const TITHE_RATE = 0.1;

export type ReceivableStatus = "pendente" | "parcial" | "recebido" | "atrasado";

export function receivableStatus(
  contracted: number,
  received: number,
  dueDate?: string | null,
): ReceivableStatus {
  if (received >= contracted - 0.005 && contracted > 0) return "recebido";
  if (received > 0) return isPast(dueDate) ? "atrasado" : "parcial";
  return isPast(dueDate) ? "atrasado" : "pendente";
}

export function payableStatus(status: string, dueDate?: string | null): "pago" | "atrasado" | "pendente" {
  if (status === "pago") return "pago";
  return isPast(dueDate) ? "atrasado" : "pendente";
}

export type Deadline = {
  tone: "green" | "blue" | "red" | "yellow" | "slate";
  label: string;
  deltaDays: number;
  late: boolean;
};

export function serviceDeadline(service: {
  status: string;
  endDate?: string | null;
  realEndDate?: string | null;
}): Deadline {
  const today = todayISO();
  if (service.status === "cancelado") return { tone: "slate", label: "Cancelado", deltaDays: 0, late: false };
  if (service.status === "concluido") {
    if (service.endDate && service.realEndDate) {
      const delta = diffDays(service.realEndDate, service.endDate);
      if (delta > 0) return { tone: "red", label: `Concluído ${delta}d após o prazo`, deltaDays: delta, late: true };
      if (delta === 0) return { tone: "green", label: "Concluído no prazo", deltaDays: 0, late: false };
      return { tone: "green", label: `Concluído ${Math.abs(delta)}d adiantado`, deltaDays: delta, late: false };
    }
    return { tone: "green", label: "Concluído", deltaDays: 0, late: false };
  }
  if (service.endDate) {
    const delta = diffDays(today, service.endDate);
    if (delta > 0) return { tone: "red", label: `Atrasado ${delta}d`, deltaDays: delta, late: true };
    if (delta === 0) return { tone: "yellow", label: "Vence hoje", deltaDays: 0, late: false };
    return {
      tone: service.status === "em_andamento" ? "blue" : "blue",
      label: `${Math.abs(delta)}d restantes`,
      deltaDays: delta,
      late: false,
    };
  }
  return { tone: "blue", label: "Sem prazo definido", deltaDays: 0, late: false };
}

export function effectiveServiceStatus(service: {
  status: string;
  endDate?: string | null;
  realEndDate?: string | null;
}): string {
  if (service.status === "concluido" || service.status === "cancelado") return service.status;
  if (service.endDate && isPast(service.endDate)) return "atrasado";
  return service.status;
}

export type ServiceFinancials = {
  contracted: number;
  received: number;
  pending: number;
  expensesTotal: number;
  expensesByCategory: Record<string, number>;
  grossProfit: number;
  tithe: number;
  netResult: number;
  margin: number;
  situation: "lucro" | "prejuizo" | "empate";
};

export function serviceFinancials(input: {
  contracted: number;
  expenses: { amount: number; category: string; description?: string }[];
  payments: { amount: number }[];
  tithes: { amount: number }[];
}): ServiceFinancials {
  const expensesTotal = input.expenses.reduce((sum, e) => sum + toNum(e.amount), 0);
  const received = input.payments.reduce((sum, p) => sum + toNum(p.amount), 0);
  const tithe = input.tithes.reduce((sum, t) => sum + toNum(t.amount), 0);
  const expensesByCategory: Record<string, number> = {};
  for (const e of input.expenses) {
    expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + toNum(e.amount);
  }
  const grossProfit = received - expensesTotal;
  const netResult = grossProfit - tithe;
  const margin = received > 0 ? (netResult / received) * 100 : 0;
  return {
    contracted: input.contracted,
    received,
    pending: Math.max(input.contracted - received, 0),
    expensesTotal,
    expensesByCategory,
    grossProfit,
    tithe,
    netResult,
    margin,
    situation: netResult > 0.004 ? "lucro" : netResult < -0.004 ? "prejuizo" : "empate",
  };
}

export function titheFor(amount: number): number {
  return Math.round(amount * TITHE_RATE * 100) / 100;
}

export function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}
