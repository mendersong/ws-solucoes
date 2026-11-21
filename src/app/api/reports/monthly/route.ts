import { getSession } from "@/lib/auth";
import { getMonthlySummary } from "@/lib/queries";
import { formatDateBR, money } from "@/lib/format";

function csvCell(value: unknown): string {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const now = new Date();
  const year = Number(params.get("year") ?? now.getFullYear());
  const month = Number(params.get("month") ?? now.getMonth() + 1);
  const format = params.get("format") ?? "json";
  const summary = await getMonthlySummary(year, month);

  if (format === "csv") {
    const lines: string[] = [];
    lines.push(csvCell(`WS SOLUÇÕES — Resumo mensal — ${summary.label}`));
    lines.push("");
    lines.push(["Indicador", "Valor"].map(csvCell).join(";"));
    const rows: [string, number][] = [
      ["Total recebido", summary.totalReceived],
      ["Total a receber", summary.totalToReceive],
      ["Total pago", summary.totalPaid],
      ["Total a pagar no mês", summary.totalToPay],
      ["Contas vencidas", summary.overduePayables],
      ["Despesas operacionais", summary.operationalExpenses],
      ["Custos de funcionários", summary.employeeCosts],
      ["Custos de transporte", summary.transportCosts],
      ["Investimentos em serviços", summary.serviceInvestments],
      ["Dízimo reservado", summary.titheReserved],
      ["Dízimo pago", summary.tithePaid],
      ["Lucro bruto", summary.grossProfit],
      ["Lucro líquido", summary.netProfit],
      ["Saldo disponível", summary.availableBalance],
    ];
    for (const [label, value] of rows) {
      lines.push([label, value.toFixed(2).replace(".", ",")].map(csvCell).join(";"));
    }
    lines.push("");
    lines.push(["Data", "Cliente/Serviço", "Forma", "Valor recebido"].map(csvCell).join(";"));
    for (const payment of summary.paymentsDetail) {
      lines.push(
        [formatDateBR(payment.paidAt), payment.notes ?? `Recebimento #${payment.id}`, payment.paymentMethod, money(payment.amount)]
          .map(csvCell)
          .join(";"),
      );
    }
    lines.push("");
    lines.push(["Vencimento", "Descrição", "Categoria", "Status", "Valor"].map(csvCell).join(";"));
    for (const payable of summary.payablesDetail) {
      lines.push(
        [formatDateBR(payable.dueDate), payable.description, payable.category, payable.computedStatus, money(payable.amount)]
          .map(csvCell)
          .join(";"),
      );
    }
    lines.push("");
    lines.push(["Data", "Descrição", "Categoria", "Valor"].map(csvCell).join(";"));
    for (const expense of summary.expensesDetail) {
      lines.push(
        [formatDateBR(expense.expenseDate), expense.description, expense.category, money(expense.amount)].map(csvCell).join(";"),
      );
    }
    const csv = `\uFEFF${lines.join("\r\n")}`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ws-solucoes-resumo-${year}-${String(month).padStart(2, "0")}.csv"`,
      },
    });
  }

  return Response.json({ data: summary });
}
