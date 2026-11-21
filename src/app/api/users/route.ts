import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession, hashPassword, type Role } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const ROLES: Role[] = ["admin", "financeiro", "funcionario"];

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "Acesso restrito ao administrador" }, { status: 403 });
  const rows = await db.select().from(users);
  return Response.json({
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      phone: row.phone,
      active: row.active,
      createdAt: row.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "Acesso restrito ao administrador" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const action = String(body.action ?? "create");
  const id = body.id ? Number(body.id) : null;
  const role = String(body.role ?? "funcionario") as Role;
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const active = body.active !== false;
  const phone = body.phone ? String(body.phone) : null;

  try {
    if (action === "create") {
      if (!name || !email || password.length < 6) {
        return Response.json({ error: "Informe nome, e-mail e senha com ao menos 6 caracteres." }, { status: 400 });
      }
      if (!ROLES.includes(role)) return Response.json({ error: "Perfil inválido" }, { status: 400 });
      const created = await db
        .insert(users)
        .values({ name, email, passwordHash: hashPassword(password), role, phone })
        .returning();
      await logAudit({ user: session, action: "criar_usuario", entity: "users", entityId: created[0]!.id, details: { email, role } });
      return Response.json({ data: { ...created[0]!, passwordHash: undefined } }, { status: 201 });
    }
    if (action === "update" && id) {
      const existing = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
      if (!existing) return Response.json({ error: "Usuário não encontrado" }, { status: 404 });
      const values: Record<string, unknown> = { active, role: ROLES.includes(role) ? role : existing.role };
      if (name) values.name = name;
      if (email) values.email = email;
      if (phone !== null) values.phone = phone;
      if (password) {
        if (password.length < 6) return Response.json({ error: "A senha deve ter ao menos 6 caracteres." }, { status: 400 });
        values.passwordHash = hashPassword(password);
      }
      if (existing.role === "admin" && (role !== "admin" || !active)) {
        const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
        if (admins.length <= 1) {
          return Response.json({ error: "Mantenha pelo menos um administrador ativo." }, { status: 400 });
        }
      }
      const updated = await db.update(users).set(values).where(eq(users.id, id)).returning();
      await logAudit({ user: session, action: "editar_usuario", entity: "users", entityId: id, details: { role, active } });
      return Response.json({ data: { ...updated[0]!, passwordHash: undefined } });
    }
    if (action === "delete" && id) {
      if (id === session.id) return Response.json({ error: "Você não pode excluir o próprio usuário." }, { status: 400 });
      const target = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
      if (!target) return Response.json({ error: "Usuário não encontrado" }, { status: 404 });
      if (target.role === "admin") {
        const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
        if (admins.length <= 1) return Response.json({ error: "Mantenha pelo menos um administrador ativo." }, { status: 400 });
      }
      await db.delete(users).where(eq(users.id, id));
      await logAudit({ user: session, action: "excluir_usuario", entity: "users", entityId: id });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    console.error("users route failed", error);
    return Response.json({ error: "Não foi possível concluir a operação (e-mail duplicado?)." }, { status: 400 });
  }
}
