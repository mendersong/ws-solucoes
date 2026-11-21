export const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * Converte valores numéricos com segurança.
 * Aceita number, "1234.56" (formato do banco) e "1.234,56" (formato brasileiro).
 */
export function toNum(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const trimmed = value.trim().replace(/[R$\s]/g, "");
  if (!trimmed) return 0;
  if (trimmed.includes(",")) {
    const normalized = trimmed.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Parse form values that may arrive as "1.234,56", "1234,56" ou "1234.56". */
export function parseMoney(value: unknown): number {
  return toNum(value);
}

export function money(value: unknown): string {
  return BRL.format(toNum(value));
}

export function compactMoney(value: unknown): string {
  const n = toNum(value);
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace(".", ",")}k`;
  return money(n);
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function parseISO(value?: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDateBR(value?: string | null): string {
  const d = parseISO(value);
  if (!d) return "—";
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function formatDateTimeBR(value?: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function addDays(value: string, days: number): string {
  const d = parseISO(value) ?? new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export function diffDays(a: string, b: string): number {
  const da = parseISO(a);
  const db = parseISO(b);
  if (!da || !db) return 0;
  return Math.round((da.getTime() - db.getTime()) / 86_400_000);
}

export function businessDaysBetween(start: string, end: string): number {
  const a = parseISO(start);
  const b = parseISO(end);
  if (!a || !b) return 0;
  const sign = b >= a ? 1 : -1;
  const cursor = new Date(Math.min(a.getTime(), b.getTime()));
  const limit = Math.max(a.getTime(), b.getTime());
  let count = 0;
  while (cursor.getTime() <= limit) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count * sign;
}

export function countBetween(start: string, end: string, mode: "corridos" | "uteis"): number {
  return mode === "uteis" ? Math.abs(businessDaysBetween(start, end)) + 1 : Math.abs(diffDays(end, start)) + 1;
}

export function isPast(value?: string | null): boolean {
  if (!value) return false;
  return value.slice(0, 10) < todayISO();
}

export function monthRange(year: number, month: number) {
  const from = `${year}-${pad(month)}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from, to: `${year}-${pad(month)}-${pad(last)}` };
}

export const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const SERVICE_TYPES = [
  "Instalações elétricas",
  "Instalações hidráulicas",
  "Construção civil",
  "Reformas",
  "Manutenção",
  "Outros serviços",
];

export const EXPENSE_CATEGORIES = [
  { value: "mao_de_obra", label: "Mão de obra" },
  { value: "funcionarios", label: "Funcionários" },
  { value: "transporte", label: "Transporte" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "hospedagem", label: "Hospedagem" },
  { value: "materiais", label: "Materiais" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "outras", label: "Outras despesas" },
];

export const PAYABLE_CATEGORIES = [
  "materiais",
  "ferramentas",
  "combustivel",
  "salarios",
  "aluguel",
  "energia",
  "agua",
  "internet",
  "impostos",
  "manutencao",
  "dizimo",
  "outros",
];

export const PAYMENT_METHODS = ["PIX", "Dinheiro", "Transferência", "Cartão de débito", "Cartão de crédito", "Boleto", "Cheque"];

export const SERVICE_STATUS: Record<string, { label: string; tone: "green" | "blue" | "red" | "yellow" | "slate" }> = {
  agendado: { label: "Agendado", tone: "yellow" },
  em_andamento: { label: "Em andamento", tone: "blue" },
  concluido: { label: "Concluído", tone: "green" },
  atrasado: { label: "Atrasado", tone: "red" },
  cancelado: { label: "Cancelado", tone: "slate" },
};

export function categoryLabel(value?: string | null): string {
  if (!value) return "—";
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value.replace(/_/g, " ");
}

export function digitsOnly(value?: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

export function waLink(phone?: string | null, text?: string): string {
  const digits = digitsOnly(phone);
  if (!digits) return "#";
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function nextCode(prefix: string, lastId: number): string {
  return `${prefix}-${String(lastId + 1).padStart(4, "0")}`;
}
