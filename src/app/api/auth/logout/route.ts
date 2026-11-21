import { destroySession, getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const user = await getSession();
  if (user) await logAudit({ user, action: "logout", entity: "users", entityId: user.id });
  await destroySession();
  return Response.json({ ok: true });
}
