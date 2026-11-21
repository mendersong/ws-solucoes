import { eq } from "drizzle-orm";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { approveBudget, BusinessError, saveBudget } from "@/lib/mutations";
import { logAudit } from "@/lib/audit";
import { parseMoney } from "@/lib/format";

type ItemInput = { kind?: string; description?: string; quantity?: number | string; unitPrice?: number | string };

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (user.role === "funcionario") return Response.json({ error: "Perfil sem permissão" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const action = String(body.action ?? "save");
  try {
    if (action === "save") {
      const items = Array.isArray(body.items) ? (body.items as ItemInput[]) : [];
      const result = await saveBudget({
        id: body.id ? Number(body.id) : undefined,
        clientId: body.clientId ? Number(body.clientId) : null,
        title: String(body.title ?? ""),
        description: body.description ? String(body.description) : null,
        paymentTerms: body.paymentTerms ? String(body.paymentTerms) : null,
        validUntil: body.validUntil ? String(body.validUntil) : null,
        discount: parseMoney(body.discount),
        status: body.status ? String(body.status) : "enviado",
        items: items.map((item) => ({
          kind: item.kind === "material" ? "material" : "mao_de_obra",
          description: String(item.description ?? "Item"),
          quantity: parseMoney(item.quantity ?? 1),
          unitPrice: parseMoney(item.unitPrice ?? 0),
        })),
        user,
      });
      return Response.json({ data: result }, { status: 201 });
    }
    if (action === "approve") {
      const result = await approveBudget({
        budgetId: Number(body.budgetId),
        startDate: body.startDate ? String(body.startDate) : undefined,
        days: Number(body.days ?? 7),
        serviceType: body.serviceType ? String(body.serviceType) : undefined,
        user,
      });
      return Response.json({ data: result }, { status: 201 });
    }
    if (action === "set_status") {
      const updated = await db
        .update(budgets)
        .set({ status: String(body.status ?? "enviado") })
        .where(eq(budgets.id, Number(body.budgetId)))
        .returning();
      if (!updated[0]) return Response.json({ error: "Orçamento não encontrado" }, { status: 404 });
      await logAudit({ user, action: "status_orcamento", entity: "budgets", entityId: updated[0].id, details: { status: updated[0].status } });
      return Response.json({ data: updated[0] });
    }
    return Response.json({ error: "Ação de orçamento inválida" }, { status: 400 });
  } catch (error) {
    if (error instanceof BusinessError) return Response.json({ error: error.message }, { status: 400 });
    console.error("budget action failed", error);
    return Response.json({ error: "Não foi possível concluir a operação do orçamento." }, { status: 500 });
  }
}
