import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { payables, services, whatsappAdmins, whatsappQueue, whatsappSettings } from "@/db/schema";
import { addDays, formatDateBR, money, todayISO } from "./format";
import { effectiveServiceStatus } from "./finance";
import { phoneDigits, sendText, type EvolutionConfig } from "./evolution";

export function readConfig(settings: {
  baseUrl: string | null;
  apiKey: string | null;
  instanceName: string | null;
} | null | undefined): EvolutionConfig | null {
  if (!settings?.baseUrl || !settings?.apiKey || !settings?.instanceName) return null;
  return { baseUrl: settings.baseUrl, apiKey: settings.apiKey, instanceName: settings.instanceName };
}

export async function getWhatsAppConfig(): Promise<{
  config: EvolutionConfig | null;
  settings: typeof whatsappSettings.$inferSelect | null;
}> {
  const rows = await db.select().from(whatsappSettings).orderBy(desc(whatsappSettings.id)).limit(1);
  const settings = rows[0] ?? null;
  return { config: readConfig(settings), settings };
}

export async function authorizedNumbers(): Promise<string[]> {
  const rows = await db.select().from(whatsappAdmins).where(eq(whatsappAdmins.active, true));
  return rows.map((r) => phoneDigits(r.phone)).filter(Boolean);
}

export function isAuthorized(jid: string, numbers: string[]): boolean {
  const digits = phoneDigits(jid.split("@")[0] ?? jid);
  return numbers.some((number) => {
    const normalized = phoneDigits(number);
    if (!normalized) return false;
    return digits === normalized || digits.endsWith(normalized) || normalized.endsWith(digits);
  });
}

const GAP_SECONDS = 8;

export async function enqueueMessage(input: {
  toPhone: string;
  body: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  fileName?: string | null;
  startOffset?: number;
}) {
  const rows = await db.select({ id: whatsappQueue.id }).from(whatsappQueue);
  const offset = (input.startOffset ?? rows.length) * GAP_SECONDS;
  return (
    await db
      .insert(whatsappQueue)
      .values({
        toPhone: input.toPhone,
        body: input.body,
        mediaUrl: input.mediaUrl ?? null,
        mediaType: input.mediaType ?? null,
        fileName: input.fileName ?? null,
        sendAfter: new Date(Date.now() + offset * 1000),
        status: "fila",
      })
      .returning()
  )[0]!;
}

export async function buildDueNotifications(): Promise<{ enqueued: number; messages: string[] }> {
  const [payableRows, serviceRows, adminRows, queueRows] = await Promise.all([
    db.select().from(payables).orderBy(payables.dueDate),
    db.select().from(services),
    db.select().from(whatsappAdmins).where(eq(whatsappAdmins.active, true)),
    db.select({ id: whatsappQueue.id }).from(whatsappQueue),
  ]);
  const today = todayISO();
  const horizon = addDays(today, 3);
  const recipients = adminRows.map((a) => a.phone).filter(Boolean);
  const messages: string[] = [];

  const dueSoon = payableRows.filter((p) => p.status !== "pago" && p.dueDate <= horizon);
  for (const payable of dueSoon.slice(0, 5)) {
    const overdue = payable.dueDate < today;
    messages.push(
      `${overdue ? "🔴 *CONTA VENCIDA*" : "🟡 *VENCIMENTO PRÓXIMO*"}\n${payable.description}\nValor: ${money(
        payable.amount,
      )}\nVencimento: ${formatDateBR(payable.dueDate)}${overdue ? " (em atraso)" : ""}\nCategoria: ${payable.category}`,
    );
  }
  const late = serviceRows.filter((s) => effectiveServiceStatus(s) === "atrasado");
  for (const service of late.slice(0, 5)) {
    messages.push(
      `🔴 *OBRA ATRASADA*\n${service.code} — ${service.title}\nPrazo previsto: ${formatDateBR(
        service.endDate,
      )}\nStatus: ${service.status.replace("_", " ")}\nResponda *obras* para o resumo completo.`,
    );
  }

  if (recipients.length === 0) return { enqueued: 0, messages };

  let index = queueRows.length;
  let enqueued = 0;
  for (const message of messages) {
    for (const recipient of recipients) {
      await enqueueMessage({ toPhone: recipient, body: message, startOffset: index, });
      index += 1;
      enqueued += 1;
    }
  }
  return { enqueued, messages };
}

export async function processQueue(limit = 5): Promise<{ sent: number; failed: number; pending: number; details: string[] }> {
  const { config } = await getWhatsAppConfig();
  const rows = await db.select().from(whatsappQueue).orderBy(whatsappQueue.id).limit(200);
  const due = rows.filter((r) => r.status === "fila" && r.sendAfter.getTime() <= Date.now()).slice(0, limit);
  const details: string[] = [];
  let sent = 0;
  let failed = 0;
  for (const item of due) {
    if (!config) {
      details.push(`#${item.id} aguardando configuração da Evolution API (permanece na fila)`);
      break;
    }
    try {
      await sendText(config, item.toPhone, item.body);
      await db.update(whatsappQueue).set({ status: "enviado", attempts: item.attempts + 1 }).where(eq(whatsappQueue.id, item.id));
      sent += 1;
      details.push(`#${item.id} enviado para ${item.toPhone}`);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    } catch (error) {
      failed += 1;
      await db
        .update(whatsappQueue)
        .set({ status: "erro", attempts: item.attempts + 1, error: (error as Error).message })
        .where(eq(whatsappQueue.id, item.id));
      details.push(`#${item.id} erro: ${(error as Error).message}`);
    }
  }
  const remaining = rows.filter((r) => r.status === "fila").length - sent;
  return { sent, failed, pending: Math.max(remaining, 0), details };
}

export async function sendNow(input: { to: string; body: string; mediaUrl?: string | null }) {
  const { config } = await getWhatsAppConfig();
  if (!config) {
    throw new Error("Evolution API não configurada. Cadastre URL, API Key e instância antes de enviar.");
  }
  if (input.mediaUrl) {
    const { sendMedia } = await import("./evolution");
    return sendMedia(config, input.to, { mediaUrl: input.mediaUrl, caption: input.body, fileName: "documento-ws.pdf" });
  }
  return sendText(config, input.to, input.body);
}

export async function totalPending(): Promise<number> {
  const rows = await db.select({ id: whatsappQueue.id, status: whatsappQueue.status }).from(whatsappQueue);
  return rows.filter((r) => r.status === "fila").length;
}
