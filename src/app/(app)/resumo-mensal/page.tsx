import { Download, FileSpreadsheet, Landmark, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { getMonthlySummary } from "@/lib/queries";
import { categoryLabel, formatDateBR, money, MONTHS } from "@/lib/format";
import { Kpi, PageHeader, Panel, SectionTitle, EmptyState } from "@/components/ui";
import { PrintButton } from "@/components/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resumo Mensal" };

export default async function MonthlySummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Math.min(Math.max(Number(params.year ?? now.getFullYear()) || now.getFullYear(), 2000), 2100);
  const month = Math.min(Math.max(Number(params.month ?? now.getMonth() + 1) || now.getMonth() + 1, 1), 12);
  const summary = await getMonthlySummary(year, month);
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  const cards: { label: string; value: string; tone: "green" | "red" | "yellow" | "blue" | "purple" | "slate"; hint?: string }[] = [
    { label: "Total recebido", value: money(summary.totalReceived), tone: "green", hint: "Caixa efetivo do mês" },
    { label: "Total a receber", value: money(summary.totalToReceive), tone: "blue", hint: "Saldos em aberto" },
    { label: "Total pago", value: money(summary.totalPaid), tone: "red", hint: "Contas quitadas no mês" },
    { label: "Total a pagar", value: money(summary.totalToPay), tone: "yellow", hint: "Vencendo no mês" },
    { label: "Contas vencidas", value: money(summary.overduePayables), tone: "red", hint: "Atrasadas de qualquer mês" },
    { label: "Despesas operacionais", value: money(summary.operationalExpenses), tone: "slate", hint: "Sem vínculo com obra" },
    { label: "Custos de funcionários", value: money(summary.employeeCosts), tone: "purple", hint: "Equipe alocada nas obras" },
    { label: "Custos de transporte", value: money(summary.transportCosts), tone: "slate" },
    { label: "Investimentos em serviços", value: money(summary.serviceInvestments), tone: "yellow", hint: "Todos os custos das obras" },
    { label: "Dízimo reservado", value: money(summary.titheReserved), tone: "purple" },
    { label: "Dízimo pago", value: money(summary.tithePaid), tone: "green" },
    { label: "Lucro bruto", value: money(summary.grossProfit), tone: summary.grossProfit >= 0 ? "green" : "red" },
    { label: "Lucro líquido", value: money(summary.netProfit), tone: summary.netProfit >= 0 ? "green" : "red", hint: "Após despesas e dízimo" },
    { label: "Saldo disponível", value: money(summary.availableBalance), tone: summary.availableBalance >= 0 ? "green" : "red", hint: "Acumulado real" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Resumo Mensal"
        subtitle="Fechamento automático com separação entre fluxo de caixa (dinheiro que entrou e saiu) e resultado por competência (custos e receitas do período)."
        actions={
          <>
            <a href={`/api/reports/monthly?year=${year}&month=${month}&format=csv`} className="btn btn-primary">
              <Download size={14} /> Exportar Excel (CSV)
            </a>
            <PrintButton label="Imprimir relatório" />
          </>
        }
      />

      <Panel className="no-print">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="label">Mês</span>
            <select name="month" defaultValue={month} className="input !w-40">
              {MONTHS.map((name, index) => (
                <option key={name} value={index + 1}>{name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Ano</span>
            <select name="year" defaultValue={year} className="input !w-28">
              {years.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary">Aplicar</button>
          <span className="ml-auto text-[0.7rem] text-slate-400">
            <FileSpreadsheet size={13} className="mr-1 inline" /> Relatório pronto para Excel e PDF
          </span>
        </form>
      </Panel>

      <div className="print-sheet space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white print:text-slate-900">Fechamento de {summary.label}</h2>
            <p className="text-[0.7rem] text-slate-400 print:text-slate-600">
              WS SOLUÇÕES · Relatório gerado em {formatDateBR(new Date().toISOString())} · {summary.receivableCount} conta(s) a receber ·{" "}
              {summary.payableCount} conta(s) a pagar no período
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge border-brand-400/30 bg-brand-500/10 text-brand-200"><Landmark size={12} /> Caixa</span>
            <span className="badge border-violet-400/30 bg-violet-500/10 text-violet-200"><Scale size={12} /> Competência</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((card) => (
            <Kpi key={card.label} label={card.label} value={card.value} tone={card.tone} hint={card.hint} />
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Panel>
            <SectionTitle title="Fluxo de caixa do mês" subtitle="Somente valores efetivados" icon={<TrendingUp size={15} />} />
            <div className="space-y-1.5 text-[0.8rem]">
              <div className="flex justify-between"><span className="text-slate-400">(+) Recebimentos</span><span className="font-semibold text-emerald-300">{money(summary.totalReceived)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">(−) Contas pagas</span><span className="font-semibold text-red-300">{money(summary.totalPaid)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">(−) Dízimo pago</span><span className="font-semibold text-violet-300">{money(summary.tithePaid)}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-1.5"><span className="text-slate-200">Saldo do mês</span><span className="font-bold text-white">{money(summary.totalReceived - summary.totalPaid - summary.tithePaid)}</span></div>
            </div>
          </Panel>
          <Panel>
            <SectionTitle title="Resultado por competência" subtitle="Custos e receitas do período" icon={<TrendingDown size={15} />} />
            <div className="space-y-1.5 text-[0.8rem]">
              <div className="flex justify-between"><span className="text-slate-400">Receita recebida</span><span className="font-semibold text-emerald-300">{money(summary.totalReceived)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">(−) Custos e despesas</span><span className="font-semibold text-red-300">{money(summary.serviceInvestments)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">(−) Dízimo reservado</span><span className="font-semibold text-violet-300">{money(summary.titheReserved)}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-1.5"><span className="text-slate-200">Lucro líquido</span><span className={`font-bold ${summary.netProfit >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(summary.netProfit)}</span></div>
            </div>
          </Panel>
        </div>

        <Panel>
          <SectionTitle title="Recebimentos do mês" />
          {summary.paymentsDetail.length === 0 ? <EmptyState title="Nenhum recebimento no período" /> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Data</th><th>Referência</th><th>Forma</th><th>Valor</th><th>Dízimo</th></tr></thead>
                <tbody>
                  {summary.paymentsDetail.map((payment) => (
                    <tr key={payment.id}>
                      <td>{formatDateBR(payment.paidAt)}</td>
                      <td>{payment.notes ?? `Recebimento #${payment.id}`}</td>
                      <td>{payment.paymentMethod}</td>
                      <td className="font-medium">{money(payment.amount)}</td>
                      <td className="text-violet-300">{money(payment.titheAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="grid gap-3 lg:grid-cols-2">
          <Panel>
            <SectionTitle title="Contas a pagar do período" />
            {summary.payablesDetail.length === 0 ? <EmptyState title="Nenhuma conta no período" /> : (
              <div className="space-y-1">
                {summary.payablesDetail.map((payable) => (
                  <div key={payable.id} className="flex items-center justify-between gap-2 border-b border-white/5 py-1.5 text-[0.76rem]">
                    <span className="min-w-0 truncate text-slate-300">{payable.description}</span>
                    <span className="shrink-0 text-slate-400">{formatDateBR(payable.dueDate)}</span>
                    <span className="shrink-0 font-semibold text-slate-100">{money(payable.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel>
            <SectionTitle title="Despesas do período" />
            {summary.expensesDetail.length === 0 ? <EmptyState title="Nenhuma despesa no período" /> : (
              <div className="space-y-1">
                {summary.expensesDetail.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between gap-2 border-b border-white/5 py-1.5 text-[0.76rem]">
                    <span className="min-w-0 truncate text-slate-300">{expense.description}</span>
                    <span className="shrink-0 text-slate-400">{categoryLabel(expense.category)}</span>
                    <span className="shrink-0 font-semibold text-slate-100">{money(expense.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Panel className="no-print">
        <SectionTitle title="Boas práticas de leitura" subtitle="Evite confundir dinheiro recebido com valor contratado" />
        <ul className="list-disc space-y-1 pl-5 text-[0.74rem] leading-relaxed text-slate-300">
          <li><strong>Caixa:</strong> mostra o que realmente entrou e saiu, incluindo dízimo pago.</li>
          <li><strong>Competência:</strong> mostra custos e receitas do período, mesmo que o pagamento ocorra em outro mês.</li>
          <li><strong>A receber / a pagar:</strong> são previsões e não entram no saldo disponível até serem efetivados.</li>
          <li><strong>Dízimo:</strong> reservado no momento do recebimento e considerado saída de caixa quando pago.</li>
        </ul>
      </Panel>
    </div>
  );
}
