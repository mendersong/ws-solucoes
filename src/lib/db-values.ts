import { getTableColumns } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { parseMoney } from "./format";

export function coerceColumn(col: PgColumn, raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (col.dataType === "boolean") {
    return raw === true || raw === "true" || raw === "on" || raw === 1 || raw === "1";
  }
  if (col.dataType === "number") return Number(raw) || 0;
  if (col.dataType === "json") return raw;
  if (raw === "") {
    if (col.columnType === "PgNumeric") return "0";
    return null;
  }
  if (col.columnType === "PgNumeric") return String(parseMoney(raw));
  if (col.columnType === "PgDate") return String(raw).slice(0, 10);
  if (col.columnType === "PgTimestamp") return new Date(String(raw));
  return String(raw);
}

export function buildValues(table: PgTable, body: Record<string, unknown>, includeImmutable = false) {
  const cols = getTableColumns(table) as unknown as Record<string, PgColumn>;
  const values: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(cols)) {
    if (key === "id" || key === "createdAt") continue;
    if (!includeImmutable && key === "updatedAt") continue;
    if (!(key in body)) continue;
    const raw = body[key];
    if (raw === undefined) continue;
    const coerced = coerceColumn(col, raw);
    if (coerced === null && col.notNull) continue;
    values[key] = coerced;
  }
  return values;
}
