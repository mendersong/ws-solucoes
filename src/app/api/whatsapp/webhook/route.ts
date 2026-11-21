import { eq } from "drizzle-orm";
import { db } from "@/db";
import { whatsappMessages, whatsappSettings } from "@/db/schema";
import { extractMessageText, sendText } from "@/lib/evolution";
import { authorizedNumbers, getWhatsAppConfig, isAuthorized } from "@/lib/notifications";
import { handleAssistantMessage } from "@/lib/whatsapp-assistant";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    endpoint: "/api/whatsapp/webhook",
    events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
  });
}

type WebhookBody = {
  event?: string;
  instance?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean };
    message?: Record<string, unknown>;
    state?: string;
    status?: string;
  };
};

export async function POST(request: Request) {
  const url = new URL(request.url);
  const providedSecret = request.headers.get("x-ws-secret") ?? url.searchParams.get("secret");
  const { config, settings } = await getWhatsAppConfig();

  if (settings?.webhookSecret && providedSecret !== settings.webhookSecret) {
    return Response.json({ error: "Segredo do webhook inválido" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return Response.json({ error: "Payload inválido" }, { status: 400 });
  }

  const event = (body.event ?? "").toLowerCase();
  const instanceMatches =
    !settings?.instanceName || !body.instance || body.instance === settings.instanceName;

  if (event.includes("connection") && settings) {
    const state = body.data?.state ?? body.data?.status ?? "unknown";
    const label =
      state === "open" ? "conectado" : state === "connecting" ? "aguardando" : "desconectado";
    await db
      .update(whatsappSettings)
      .set({ status: label, lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(whatsappSettings.id, settings.id));
    return Response.json({ ok: true, status: label });
  }

  if (!event.includes("messages") || !instanceMatches) {
    return Response.json({ ok: true, ignored: true });
  }

  const data = body.data;
  const key = data?.key;
  const remoteJid = key?.remoteJid ?? "";
  const phone = remoteJid.split("@")[0] ?? "";
  if (!remoteJid || key?.fromMe) return Response.json({ ok: true, ignored: "fromMe" });

  const text = extractMessageText(data?.message);
  if (!text) return Response.json({ ok: true, ignored: "sem texto" });

  const numbers = await authorizedNumbers();
  if (!isAuthorized(remoteJid, numbers)) {
    await db.insert(whatsappMessages).values({
      direction: "in",
      remoteJid,
      body: text,
      intent: "nao_autorizado",
      status: "bloqueado",
    });
    // Falha silenciosa: não expõe dados financeiros a números não autorizados.
    return Response.json({ ok: true, ignored: "número não autorizado" });
  }

  const reply = await handleAssistantMessage(phone, text);
  await db.insert(whatsappMessages).values({
    direction: "in",
    remoteJid,
    body: text,
    intent: reply.intent,
    status: "recebido",
  });

  let deliveryStatus = "simulado";
  let deliveryError: string | null = null;
  if (config) {
    try {
      await sendText(config, phone, reply.reply);
      deliveryStatus = "enviado";
    } catch (error) {
      deliveryStatus = "falha_envio";
      deliveryError = (error as Error).message;
    }
  }

  await db.insert(whatsappMessages).values({
    direction: "out",
    remoteJid,
    body: reply.reply,
    intent: reply.intent,
    status: deliveryStatus,
  });

  return Response.json({ ok: true, intent: reply.intent, delivery: deliveryStatus, error: deliveryError });
}
