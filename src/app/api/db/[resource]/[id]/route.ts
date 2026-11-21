import { NextRequest } from "next/server";
import { eq, getTableColumns } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { canWrite, getSession } from "@/lib/auth";
import { RESOURCES } from "@/lib/resources";
import { logAudit } from "@/lib/audit";
import { buildValues } from "@/lib/db-values";

type Ctx = { params: Promise<{ resource: string; id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const { resource, id } = await ctx.params;
  const def = RESOURCES[resource];
  const numericId = Number(id);
  if (!def || !Number.isFinite(numericId)) return Response.json({ error: "Recurso inválido" }, { status: 404 });
  if (!canWrite(user.role, resource)) {
    return Response.json({ error: "Seu perfil não permite esta operação" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Corpo inválido" }, { status: 400 });
  }
  const cols = getTableColumns(def.table) as unknown as Record<string, PgColumn>;
  const values = buildValues(def.table, body);
  if (cols.updatedAt) values.updatedAt = new Date();
  try {
    const updated = await db
      .update(def.table)
      .set(values as never)
      .where(eq(cols.id, numericId))
      .returning();
    if (!updated[0]) return Response.json({ error: "Registro não encontrado" }, { status: 404 });
    await logAudit({ user, action: "editar", entity: resource, entityId: numericId, details: { ...values } });
    return Response.json({ data: updated[0] });
  } catch (error) {
    console.error("update failed", error);
    return Response.json({ error: "Não foi possível atualizar o registro." }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const { resource, id } = await ctx.params;
  const def = RESOURCES[resource];
  const numericId = Number(id);
  if (!def || !Number.isFinite(numericId)) return Response.json({ error: "Recurso inválido" }, { status: 404 });
  if (user.role !== "admin" && !canWrite(user.role, resource)) {
    return Response.json({ error: "Somente o administrador pode excluir registros" }, { status: 403 });
  }
  const cols = getTableColumns(def.table) as unknown as Record<string, PgColumn>;
  try {
    const removed = await db.delete(def.table).where(eq(cols.id, numericId)).returning();
    if (!removed[0]) return Response.json({ error: "Registro não encontrado" }, { status: 404 });
    await logAudit({ user, action: "excluir", entity: resource, entityId: numericId, details: removed[0] as Record<string, unknown> });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Não foi possível excluir. Existem vínculos com este registro." }, { status: 400 });
  }
}
