import { getSession } from "@/lib/auth";
import { buildDueNotifications, processQueue } from "@/lib/notifications";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const action = String(body.action ?? "due");
  if (action === "due") {
    const result = await buildDueNotifications();
    return Response.json({ data: result });
  }
  if (action === "process_queue") {
    const result = await processQueue(Number(body.limit ?? 5));
    return Response.json({ data: result });
  }
  return Response.json({ error: "Ação inválida" }, { status: 400 });
}

/** Endpoint para cron externo (Railway/Render/VPS) — exige o segredo do webhook. */
export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  const expected = process.env.CRON_SECRET ?? process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!expected || secret !== expected) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
  const due = await buildDueNotifications();
  const queue = await processQueue(5);
  return Response.json({ ok: true, due, queue });
}
