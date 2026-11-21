import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import type { SessionUser } from "./auth";

export async function logAudit(input: {
  user?: SessionUser | null;
  action: string;
  entity: string;
  entityId?: number | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: input.user?.id ?? null,
      userName: input.user?.name ?? "sistema",
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      details: input.details ?? {},
    });
  } catch (error) {
    console.error("audit log failed", error);
  }
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
