import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { whatsappMessages, whatsappQueue, whatsappSettings } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  EvolutionError,
  connectInstance,
  fetchConnectionState,
  logoutInstance,
  setWebhook,
} from "@/lib/evolution";
import { authorizedNumbers, enqueueMessage, getWhatsAppConfig, isAuthorized } from "@/lib/notifications";
import { handleAssistantMessage } from "@/lib/whatsapp-assistant";

export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const { settings } = await getWhatsAppConfig();
  const queue = await db.select({ id: whatsappQueue.id, status: whatsappQueue.status }).from(whatsappQueue);
  return Response.json({
    configured: Boolean(settings?.baseUrl && settings?.apiKey && settings?.instanceName),
    status: settings?.status ?? "desconectado",
    instanceName: settings?.instanceName ?? null,
    baseUrl: settings?.baseUrl ?? null,
    pending: queue.filter((q) => q.status === "fila").length,
  });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const action = String(body.action ?? "");
  const { config, settings } = await getWhatsAppConfig();

    if (action === "enqueue") {
      const to = String(body.to ?? "");
      const message = String(body.message ?? "");
      if (!to || !message) return Response.json({ error: "Informe o destinatário e a mensagem." }, { status: 400 });
      const row = await enqueueMessage({ toPhone: to, body: message, mediaUrl: body.mediaUrl ? String(body.mediaUrl) : null });
      return Response.json({ ok: true, data: row, message: `Mensagem #${row.id} adicionada à fila com intervalo de segurança.` });
    }
    if (action === "simulate") {
      const phone = String(body.phone ?? "");
      const message = String(body.message ?? "");
      if (!message) return Response.json({ error: "Digite uma mensagem para o assistente." }, { status: 400 });
      const numbers = await authorizedNumbers();
      if (numbers.length > 0 && !isAuthorized(phone, numbers)) {
        return Response.json(
          { error: "Número não autorizado. Cadastre o número em 'Números autorizados' antes de testar." },
          { status: 403 },
        );
      }
      const result = await handleAssistantMessage(phone, message, { user });
      await db.insert(whatsappMessages).values([
        { direction: "in", remoteJid: phone || "simulador", body: message, intent: result.intent, status: "simulado" },
        { direction: "out", remoteJid: phone || "simulador", body: result.reply, intent: result.intent, status: "simulado" },
      ]);
      return Response.json({ ok: true, reply: result.reply, intent: result.intent });
    }

  if (action === "save_config") {
    if (user.role !== "admin") return Response.json({ error: "Apenas o administrador configura a integração" }, { status: 403 });
    const baseUrl = String(body.baseUrl ?? "").trim();
    const apiKey = String(body.apiKey ?? "").trim();
    const instanceName = String(body.instanceName ?? "").trim();
    const webhookSecret = String(body.webhookSecret ?? "").trim();
    const autoNotifications = body.autoNotifications !== false;
    if (!baseUrl || !apiKey || !instanceName) {
      return Response.json({ error: "Informe URL da API, API Key e nome da instância." }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      return Response.json({ error: "A URL deve começar com http:// ou https://" }, { status: 400 });
    }
    if (settings) {
      await db
        .update(whatsappSettings)
        .set({
          baseUrl,
          apiKey,
          instanceName,
          webhookSecret: webhookSecret || null,
          autoNotifications,
          status: "desconectado",
          qrCode: null,
          updatedAt: new Date(),
        })
        .where(eq(whatsappSettings.id, settings.id));
    } else {
      await db.insert(whatsappSettings).values({
        baseUrl,
        apiKey,
        instanceName,
        webhookSecret: webhookSecret || null,
        autoNotifications,
        status: "desconectado",
      });
    }
    await logAudit({ user, action: "configurar_whatsapp", entity: "whatsapp", details: { baseUrl, instanceName } });
    return Response.json({ ok: true, message: "Configuração salva. Agora gere o QR Code para parear o WhatsApp." });
  }

  try {
    if (!config) {
      return Response.json(
        {
          error:
            "Evolution API não configurada. Preencha URL do servidor, API Key e nome da instância para habilitar esta operação. O simulador do assistente continua disponível.",
        },
        { status: 400 },
      );
    }
    if (action === "connect") {
      if (user.role !== "admin") return Response.json({ error: "Apenas o administrador conecta a instância" }, { status: 403 });
      const result = await connectInstance(config);
      if (settings) {
        await db
          .update(whatsappSettings)
          .set({
            qrCode: result.qrCode,
            status: result.qrCode ? "aguardando" : settings.status,
            updatedAt: new Date(),
            lastSyncAt: new Date(),
          })
          .where(eq(whatsappSettings.id, settings.id));
      }
      return Response.json({
        ok: true,
        qrCode: result.qrCode,
        pairingCode: result.pairingCode,
        message: result.qrCode
          ? "QR Code gerado. Abra o WhatsApp no celular › Dispositivos conectados › Conectar dispositivo e leia o código."
          : "A instância já está conectada ou não retornou QR Code. Verifique o status.",
      });
    }
    if (action === "status") {
      const state = await fetchConnectionState(config);
      if (settings) {
        await db
          .update(whatsappSettings)
          .set({
            status: state.statusLabel,
            qrCode: state.state === "open" ? null : settings.qrCode,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(whatsappSettings.id, settings.id));
      }
      return Response.json({ ok: true, status: state.statusLabel, state: state.state });
    }
    if (action === "disconnect") {
      if (user.role !== "admin") return Response.json({ error: "Apenas o administrador desconecta a instância" }, { status: 403 });
      await logoutInstance(config);
      if (settings) {
        await db
          .update(whatsappSettings)
          .set({ status: "desconectado", qrCode: null, updatedAt: new Date() })
          .where(eq(whatsappSettings.id, settings.id));
      }
      return Response.json({ ok: true, message: "Sessão encerrada." });
    }
    if (action === "set_webhook") {
      if (user.role !== "admin") return Response.json({ error: "Apenas o administrador altera o webhook" }, { status: 403 });
      const origin = new URL(request.url).origin;
      const webhookUrl = `${origin}/api/whatsapp/webhook`;
      await setWebhook(config, webhookUrl, settings?.webhookSecret ?? null);
      return Response.json({
        ok: true,
        message: `Webhook registrado na Evolution API: ${webhookUrl}`,
        webhookUrl,
      });
    }
    if (action === "send") {
      const to = String(body.to ?? "");
      const message = String(body.message ?? "");
      if (!to || !message) return Response.json({ error: "Informe o destinatário e a mensagem." }, { status: 400 });
      const { sendText, sendMedia } = await import("@/lib/evolution");
      if (body.mediaUrl) {
        await sendMedia(config, to, { mediaUrl: String(body.mediaUrl), caption: message, fileName: "documento-ws.pdf" });
      } else {
        await sendText(config, to, message);
      }
      await db.insert(whatsappMessages).values({
        direction: "out",
        remoteJid: to,
        body: message,
        intent: "envio_manual",
        status: "enviado",
      });
      await logAudit({ user, action: "whatsapp_envio_manual", entity: "whatsapp", details: { to } });
      return Response.json({ ok: true, message: "Mensagem enviada pela Evolution API." });
    }
    return Response.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    if (error instanceof EvolutionError) {
      return Response.json(
        {
          error: error.message,
          hint:
            "A integração depende de um servidor Evolution API acessível (VPS com Docker). Nenhuma credencial é inventada: enquanto o servidor não estiver disponível, use o simulador do assistente.",
        },
        { status: 502 },
      );
    }
    console.error("whatsapp action failed", error);
    return Response.json({ error: (error as Error).message || "Falha na integração com o WhatsApp." }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await getSession();
  if (!user || user.role !== "admin") return Response.json({ error: "Não autorizado" }, { status: 403 });
  const rows = await db.select().from(whatsappSettings).orderBy(desc(whatsappSettings.id)).limit(1);
  if (rows[0]) {
    await db
      .update(whatsappSettings)
      .set({ baseUrl: null, apiKey: null, instanceName: null, status: "desconectado", qrCode: null })
      .where(eq(whatsappSettings.id, rows[0].id));
  }
  return Response.json({ ok: true });
}
