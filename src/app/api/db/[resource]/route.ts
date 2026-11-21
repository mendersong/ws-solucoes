import { NextRequest } from "next/server";
import { and, desc, eq, getTableColumns, ilike, or, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { buildValues, coerceColumn } from "@/lib/db-values";
import { db } from "@/db";
import { canWrite, getSession } from "@/lib/auth";
import { RESOURCES } from "@/lib/resources";
import { logAudit } from "@/lib/audit";
import { services } from "@/db/schema";

type Ctx = { params: Promise<{ resource: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const { resource } = await ctx.params;
  const def = RESOURCES[resource];
  if (!def) return Response.json({ error: "Recurso inválido" }, { status: 404 });

  const cols = getTableColumns(def.table) as unknown as Record<string, PgColumn>;
  const search = request.nextUrl.searchParams;
  const filters: SQL[] = [];
  for (const [key, raw] of search.entries()) {
    if (["limit", "q", "order"].includes(key)) continue;
    const col = cols[key];
    if (!col || raw === "") continue;
    filters.push(eq(col, coerceColumn(col, raw) as never));
  }
  const q = search.get("q");
  if (q && def.search.length > 0) {
    const conditions = def.search.map((field) => ilike(cols[field], `%${q}%`)).filter(Boolean);
    const combined = or(...conditions);
    if (combined) filters.push(combined);
  }
  const limit = Math.min(Number(search.get("limit") ?? 500) || 500, 2000);
  const orderCol = cols.id ?? getTableColumns(def.table).id;

  const where = filters.length > 0 ? and(...filters) : undefined;
  const rows = await db
    .select()
    .from(def.table)
    .where(where)
    .orderBy(search.get("order") === "asc" ? orderCol : desc(orderCol))
    .limit(limit);
  return Response.json({ data: rows });
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const { resource } = await ctx.params;
  const def = RESOURCES[resource];
  if (!def) return Response.json({ error: "Recurso inválido" }, { status: 404 });
  if (!canWrite(user.role, resource)) {
    return Response.json({ error: "Seu perfil não permite esta operação" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Corpo inválido" }, { status: 400 });
  }
  const values = buildValues(def.table, body);
  if (resource === "services" && !values.code) {
    const all = await db.select({ id: services.id }).from(services);
    values.code = `WS-${String(all.length + 1).padStart(4, "0")}`;
  }
  try {
    const inserted = await db.insert(def.table).values(values as never).returning();
    const created = inserted[0] as Record<string, unknown> | undefined;
    await logAudit({
      user,
      action: "criar",
      entity: resource,
      entityId: typeof created?.id === "number" ? created.id : null,
      details: { ...values },
    });
    return Response.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("create failed", error);
    return Response.json(
      { error: "Não foi possível salvar. Verifique os campos obrigatórios e tente novamente." },
      { status: 400 },
    );
  }
}
