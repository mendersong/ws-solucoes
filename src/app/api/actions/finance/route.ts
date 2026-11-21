import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payables } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { parseMoney } from "@/lib/format";
import { BusinessError, payPayable, payTithe, registerPayment } from "@/lib/mutations";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (user.role === "funcionario") return Response.json({ error: "Perfil sem permissão financeira" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const action = String(body.action ?? "");
  try {
    if (action === "register_payment") {
      const result = await registerPayment({
        receivableId: body.receivableId ? Number(body.receivableId) : null,
        clientId: body.clientId ? Number(body.clientId) : null,
        serviceId: body.serviceId ? Number(body.serviceId) : null,
        amount: parseMoney(body.amount),
        paidAt: body.paidAt ? String(body.paidAt) : undefined,
        paymentMethod: body.paymentMethod ? String(body.paymentMethod) : "PIX",
        notes: body.notes ? String(body.notes) : null,
        user,
      });
      return Response.json({ data: result }, { status: 201 });
    }
    if (action === "pay_payable") {
      const updated = await payPayable({
        payableId: Number(body.payableId),
        paidAt: body.paidAt ? String(body.paidAt) : undefined,
        paymentMethod: body.paymentMethod ? String(body.paymentMethod) : undefined,
        user,
      });
      return Response.json({ data: updated });
    }
    if (action === "unpay_payable") {
      const updated = await db
        .update(payables)
        .set({ status: "pendente", paidAt: null })
        .where(eq(payables.id, Number(body.payableId)))
        .returning();
      if (!updated[0]) return Response.json({ error: "Conta não encontrada" }, { status: 404 });
      return Response.json({ data: updated[0] });
    }
    if (action === "pay_tithe") {
      const updated = await payTithe({
        titheId: body.titheId ? Number(body.titheId) : undefined,
        all: Boolean(body.all),
        paidAt: body.paidAt ? String(body.paidAt) : undefined,
        user,
      });
      return Response.json({ data: updated });
    }
    return Response.json({ error: "Ação financeira inválida" }, { status: 400 });
  } catch (error) {
    if (error instanceof BusinessError) return Response.json({ error: error.message }, { status: 400 });
    console.error("finance action failed", error);
    return Response.json({ error: "Não foi possível concluir a operação financeira." }, { status: 500 });
  }
}
