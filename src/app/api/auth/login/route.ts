import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return Response.json({ error: "Informe e-mail e senha." }, { status: 400 });
  }
  const row = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (!row || !verifyPassword(password, row.passwordHash)) {
    return Response.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }
  if (!row.active) {
    return Response.json({ error: "Usuário desativado. Fale com o administrador." }, { status: 403 });
  }
  await createSession(row.id);
  await logAudit({
    user: { id: row.id, name: row.name, email: row.email, role: row.role as "admin", phone: row.phone },
    action: "login",
    entity: "users",
    entityId: row.id,
  });
  return Response.json({ ok: true, user: { id: row.id, name: row.name, role: row.role } });
}
