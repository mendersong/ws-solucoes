import { eq } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { BusinessError, assignTeam, concludeService, startService } from "@/lib/mutations";
import { logAudit } from "@/lib/audit";

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
  const serviceId = Number(body.serviceId ?? 0);
  if (!serviceId) return Response.json({ error: "Serviço não informado" }, { status: 400 });
  if (action === "assign_team" && user.role === "funcionario") {
    return Response.json({ error: "Perfil sem permissão para alterar a equipe" }, { status: 403 });
  }
  try {
    if (action === "start") {
      const service = await startService({ serviceId, user });
      return Response.json({ data: service });
    }
    if (action === "conclude") {
      if (user.role === "funcionario") return Response.json({ error: "Somente gestores concluem obras" }, { status: 403 });
      const result = await concludeService({
        serviceId,
        realEndDate: body.realEndDate ? String(body.realEndDate) : undefined,
        user,
      });
      return Response.json({ data: result });
    }
    if (action === "reopen" || action === "cancel") {
      if (user.role === "funcionario") return Response.json({ error: "Sem permissão" }, { status: 403 });
      const updated = await db
        .update(services)
        .set(
          action === "reopen"
            ? { status: "em_andamento", realEndDate: null, updatedAt: new Date() }
            : { status: "cancelado", updatedAt: new Date() },
        )
        .where(eq(services.id, serviceId))
        .returning();
      if (!updated[0]) return Response.json({ error: "Serviço não encontrado" }, { status: 404 });
      await logAudit({ user, action: `${action}_servico`, entity: "services", entityId: serviceId });
      return Response.json({ data: updated[0] });
    }
    if (action === "assign_team") {
      const team = Array.isArray(body.team)
        ? (body.team as { employeeId: number; days: number }[]).map((t) => ({
            employeeId: Number(t.employeeId),
            days: Number(t.days) || 1,
          }))
        : [];
      const result = await assignTeam({ serviceId, team, user });
      return Response.json({ data: result });
    }
    return Response.json({ error: "Ação de serviço inválida" }, { status: 400 });
  } catch (error) {
    if (error instanceof BusinessError) return Response.json({ error: error.message }, { status: 400 });
    console.error("service action failed", error);
    return Response.json({ error: "Não foi possível concluir a operação do serviço." }, { status: 500 });
  }
}
