import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarClock, PiggyBank, ReceiptText, Wallet } from "lucide-react";
import { db } from "@/db";
import { clients, payables, payments, receivables, services, tithes } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { categoryLabel, formatDateBR, money, PAYABLE_CATEGORIES, PAYMENT_METHODS, toNum, todayISO } from "@/lib/format";
import { payableStatus, receivableStatus } from "@/lib/finance";
import { getDashboardData, getFormOptions } from "@/lib/queries";
import { Badge, Kpi, Panel, PageHeader, SectionTitle, StatusPill, EmptyState } from "@/components/ui";
import { CrudTable } from "@/components/crud-table";
import { FlowChart } from "@/components/charts";
import { PayAllTithesButton, ReceivePaymentButton } from "@/components/finance-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Financeiro" };

const TABS = [
  { key: "receber", label: "Contas a receber" },
  { key: "pagar", label: "Contas a pagar" },
  { key: "fluxo", label: "Fluxo de caixa" },
  { key: "dizimo", label: "Dízimo" },
];

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "receber" } = await searchParams;
  const [user, options, dashboard, payableRows, receivableRows, paymentRows, titheRows, clientRows, serviceRows] = await Promise.all([
    getSession(),
    getFormOptions(),
    getDashboardData(),
    db.select().from(payables),
    db.select().from(receivables),
    db.select().from(payments),
    db.select().from(tithes),
    db.select().from(clients),
    db.select().from(services),
  ]);
  const canWrite = user?.role !== "funcionario";
  const clientById = new Map(clientRows.map((c) => [c.id, c]));
  const serviceById = new Map(serviceRows.map((s) => [s.id, s]));

  const receivableRowsMapped = receivableRows
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .map((receivable) => {
      const balance = Math.max(toNum(receivable.contractedAmount) - toNum(receivable.receivedAmount), 0);
      return {
        id: receivable.id,
        clientId: receivable.clientId ?? "",
        serviceId: receivable.serviceId ?? "",
        description: receivable.description,
        clientName: receivable.clientId ? clientById.get(receivable.clientId)?.name ?? "—" : "—",
        serviceCode: receivable.serviceId ? serviceById.get(receivable.serviceId)?.code ?? "—" : "—",
        contractedAmount: toNum(receivable.contractedAmount),
        receivedAmount: toNum(receivable.receivedAmount),
        balance,
        dueDate: receivable.dueDate ?? "",
        installments: receivable.installments,
        paymentMethod: receivable.paymentMethod ?? "",
        computedStatus: receivableStatus(toNum(receivable.contractedAmount), toNum(receivable.receivedAmount), receivable.dueDate),
        status: receivable.status,
      };
    });

  const payableRowsMapped = payableRows
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((payable) => ({
      ...payable,
      amount: toNum(payable.amount),
      serviceId: payable.serviceId ?? "",
      computedStatus: payableStatus(payable.status, payable.dueDate),
      serviceCode: payable.serviceId ? serviceById.get(payable.serviceId)?.code ?? "—" : "—",
      category: payable.category,
    }));

  const tithesMapped = titheRows
    .sort((a, b) => b.id - a.id)
    .map((tithe) => ({
      id: tithe.id,
      serviceCode: tithe.serviceId ? serviceById.get(tithe.serviceId)?.code ?? "—" : "Avulso",
      baseAmount: toNum(tithe.baseAmount),
      amount: toNum(tithe.amount),
      status: tithe.status,
      paidAt: tithe.paidAt ?? "",
      createdAt: tithe.createdAt.toISOString(),
      notes: tithe.notes ?? "",
    }));

  const receivableOptions = receivableRowsMapped
    .filter((receivable) => receivable.balance > 0.005)
    .map((receivable) => ({
      id: receivable.id,
      description: receivable.description,
      clientName: receivable.clientName,
      balance: receivable.balance,
      serviceId: receivable.serviceId ? Number(receivable.serviceId) : null,
    }));

  const totalReceivable = receivableRowsMapped.reduce((sum, r) => sum + r.balance, 0);
  const overdueReceivable = receivableRowsMapped.filter((r) => r.computedStatus === "atrasado").reduce((sum, r) => sum + r.balance, 0);
  const totalPayable = payableRowsMapped.filter((p) => p.status !== "pago").reduce((sum, p) => sum + p.amount, 0);
  const overduePayable = payableRowsMapped.filter((p) => p.computedStatus === "atrasado").reduce((sum, p) => sum + p.amount, 0);
  const receivedMonth = paymentRows
    .filter((p) => p.paidAt >= `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`)
    .reduce((sum, p) => sum + toNum(p.amount), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Financeiro integrado"
        subtitle="Contas a pagar, contas a receber, fluxo de caixa e dízimo no mesmo banco de dados. Recebimentos geram recibo e reserva de dízimo automaticamente."
        actions={<ReceivePaymentButton receivables={receivableOptions} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Saldo disponível" value={money(dashboard.balance)} tone={dashboard.balance >= 0 ? "green" : "red"} icon={<Wallet size={16} />} />
        <Kpi label="A receber" value={money(totalReceivable)} tone="blue" hint={`Vencido ${money(overdueReceivable)}`} icon={<ArrowUpRight size={16} />} />
        <Kpi label="A pagar" value={money(totalPayable)} tone="yellow" hint={`Vencido ${money(overduePayable)}`} icon={<ArrowDownRight size={16} />} />
        <Kpi label="Recebido no mês" value={money(receivedMonth)} tone="green" icon={<CalendarClock size={16} />} />
        <Kpi label="Dízimo reservado" value={money(dashboard.tithePending)} tone="purple" hint={`Pago ${money(dashboard.tithePaid)}`} icon={<PiggyBank size={16} />} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={`/financeiro?tab=${item.key}`}
            className={`btn !py-1.5 ${tab === item.key ? "btn-primary" : "btn-ghost"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {tab === "receber" ? (
        <CrudTable
          endpoint="receivables"
          title="Contas a receber"
          subtitle="Valor contratado, recebido, saldo pendente e parcelamento"
          rows={receivableRowsMapped}
          canWrite={canWrite}
          searchKeys={["description", "clientName", "serviceCode"]}
          createLabel="Nova conta a receber"
          headerExtra={<ReceivePaymentButton receivables={receivableOptions} label="Registrar recebimento" compact />}
          columns={[
            { key: "description", label: "Descrição" },
            { key: "clientName", label: "Cliente", hideOnMobile: true },
            { key: "serviceCode", label: "Obra", hideOnMobile: true },
            { key: "contractedAmount", label: "Contratado", format: "money" },
            { key: "receivedAmount", label: "Recebido", format: "money" },
            { key: "balance", label: "Saldo", format: "money" },
            { key: "dueDate", label: "Previsto", format: "date", hideOnMobile: true },
            { key: "computedStatus", label: "Status", format: "status" },
          ]}
          fields={[
            { key: "description", label: "Descrição", required: true, span: 2 },
            {
              key: "clientId",
              label: "Cliente",
              type: "select",
              options: options.clients.map((client) => ({ value: String(client.id), label: client.name })),
            },
            {
              key: "serviceId",
              label: "Serviço relacionado",
              type: "select",
              options: options.services.map((service) => ({ value: String(service.id), label: `${service.code} — ${service.title}` })),
            },
            { key: "contractedAmount", label: "Valor contratado (R$)", type: "number", required: true },
            { key: "receivedAmount", label: "Valor já recebido (R$)", type: "number" },
            { key: "dueDate", label: "Data prevista", type: "date" },
            { key: "installments", label: "Parcelas", type: "number", defaultValue: "1" },
            {
              key: "paymentMethod",
              label: "Forma de pagamento",
              type: "select",
              options: PAYMENT_METHODS.map((method) => ({ value: method, label: method })),
            },
            {
              key: "status",
              label: "Status manual",
              type: "select",
              defaultValue: "pendente",
              options: [
                { value: "pendente", label: "Pendente" },
                { value: "parcial", label: "Parcial" },
                { value: "recebido", label: "Recebido" },
              ],
            },
          ]}
        />
      ) : null}

      {tab === "pagar" ? (
        <CrudTable
          endpoint="payables"
          title="Contas a pagar"
          subtitle="Compromissos com vencimento, categoria, comprovante e forma de pagamento"
          rows={payableRowsMapped}
          canWrite={canWrite}
          searchKeys={["description", "category"]}
          createLabel="Nova conta a pagar"
          rowActions={[
            {
              label: "Marcar como paga",
              icon: "check",
              path: "/api/actions/finance",
              body: { action: "pay_payable", paidAt: todayISO(), paymentMethod: "PIX" },
              idKey: "payableId",
              confirm: "Confirmar o pagamento desta conta hoje?",
              showWhen: { key: "computedStatus", notEquals: "pago" },
            },
          ]}
          columns={[
            { key: "description", label: "Descrição" },
            { key: "category", label: "Categoria", format: "upper", hideOnMobile: true },
            { key: "amount", label: "Valor", format: "money" },
            { key: "dueDate", label: "Vencimento", format: "date" },
            { key: "paidAt", label: "Pago em", format: "date", hideOnMobile: true },
            { key: "paymentMethod", label: "Forma", hideOnMobile: true },
            { key: "computedStatus", label: "Status", format: "status" },
          ]}
          fields={[
            { key: "description", label: "Descrição", required: true, span: 2 },
            { key: "amount", label: "Valor (R$)", type: "number", required: true },
            {
              key: "category",
              label: "Categoria",
              type: "select",
              defaultValue: "materiais",
              options: PAYABLE_CATEGORIES.map((category) => ({ value: category, label: categoryLabel(category) })),
            },
            { key: "issueDate", label: "Data de lançamento", type: "date" },
            { key: "dueDate", label: "Vencimento", type: "date", required: true },
            {
              key: "paymentMethod",
              label: "Forma de pagamento",
              type: "select",
              options: PAYMENT_METHODS.map((method) => ({ value: method, label: method })),
            },
            {
              key: "serviceId",
              label: "Vincular a uma obra",
              type: "select",
              options: options.services.map((service) => ({ value: String(service.id), label: `${service.code} — ${service.title}` })),
            },
            { key: "receiptUrl", label: "Link do comprovante", span: 2, placeholder: "https://..." },
            { key: "notes", label: "Observações", type: "textarea", span: 2 },
          ]}
        />
      ) : null}

      {tab === "fluxo" ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <SectionTitle title="Fluxo de caixa" subtitle="Entradas e saídas efetivas por mês" icon={<Wallet size={16} />} />
            <FlowChart points={dashboard.flow} />
            <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-400">
              O fluxo de caixa considera apenas dinheiro que efetivamente entrou (recebimentos) e saiu (contas pagas e dízimo pago).
              O resultado por competência, com despesas contratadas, está no Resumo Mensal.
            </p>
          </Panel>
          <Panel>
            <SectionTitle title="Resumo rápido" icon={<ReceiptText size={16} />} />
            <div className="space-y-2 text-[0.78rem]">
              <div className="flex justify-between"><span className="text-slate-400">Entradas acumuladas</span><span className="font-semibold text-emerald-300">{money(paymentRows.reduce((s, p) => s + toNum(p.amount), 0))}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Saídas pagas</span><span className="font-semibold text-red-300">{money(payableRows.filter((p) => p.status === "pago").reduce((s, p) => s + toNum(p.amount), 0))}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Dízimo pago</span><span className="font-semibold text-violet-300">{money(dashboard.tithePaid)}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-2"><span className="text-slate-300">Saldo disponível</span><span className="font-bold text-white">{money(dashboard.balance)}</span></div>
            </div>
            <div className="mt-4">
              <SectionTitle title="Últimos recebimentos" />
              <div className="max-h-[220px] space-y-1 overflow-y-auto pr-1">
                {paymentRows.length === 0 ? <EmptyState title="Nenhum recebimento" /> : [...paymentRows].sort((a, b) => b.id - a.id).slice(0, 8).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 px-2.5 py-1.5 text-[0.74rem]">
                    <span className="text-slate-400">{formatDateBR(payment.paidAt)} · {payment.paymentMethod}</span>
                    <span className="font-semibold text-emerald-300">{money(payment.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      ) : null}

      {tab === "dizimo" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Dízimo reservado (a pagar)" value={money(dashboard.tithePending)} tone="yellow" />
            <Kpi label="Dízimo pago" value={money(dashboard.tithePaid)} tone="green" />
            <Kpi label="Dízimo acumulado" value={money(dashboard.titheAccumulated)} tone="purple" />
            <Kpi label="Registros" value={String(titheRows.length)} tone="blue" hint="Gerados sobre recebimentos" />
          </div>
          <CrudTable
            endpoint="tithes"
            title="Dízimo sobre recebimentos"
            subtitle="Calculado em 10% sobre cada valor efetivamente recebido, proporcional em recebimentos parciais"
            rows={tithesMapped}
            canWrite={false}
            searchKeys={["serviceCode", "notes"]}
            createLabel="Registro"
            headerExtra={<PayAllTithesButton pendingCount={titheRows.filter((t) => t.status !== "pago").length} />}
            rowActions={[
              {
                label: "Registrar pagamento do dízimo",
                icon: "money",
                path: "/api/actions/finance",
                body: { action: "pay_tithe", paidAt: todayISO() },
                idKey: "titheId",
                confirm: "Confirmar o pagamento deste dízimo?",
                showWhen: { key: "status", notEquals: "pago" },
              },
            ]}
            columns={[
              { key: "createdAt", label: "Gerado em", format: "datetime" },
              { key: "serviceCode", label: "Obra" },
              { key: "baseAmount", label: "Base (recebido)", format: "money" },
              { key: "amount", label: "Dízimo (10%)", format: "money" },
              { key: "paidAt", label: "Pago em", format: "date" },
              { key: "status", label: "Status", format: "status" },
            ]}
            fields={[]}
          />
          <Panel>
            <SectionTitle title="Como o dízimo é calculado" subtitle="Transparência e conformidade" icon={<PiggyBank size={16} />} />
            <div className="grid gap-2 text-[0.76rem] text-slate-300 sm:grid-cols-3">
              <div className="panel-tight p-3">
                <p className="font-semibold text-white">Recebimento de R$ 5.000,00</p>
                <p className="mt-1 text-violet-200">Dízimo reservado: R$ 500,00</p>
                <p className="text-slate-400">Saldo após reserva: R$ 4.500,00</p>
              </div>
              <div className="panel-tight p-3">
                <p className="font-semibold text-white">Recebimento parcial de R$ 1.250,00</p>
                <p className="mt-1 text-violet-200">Reserva proporcional: R$ 125,00</p>
                <p className="text-slate-400">Calculado sobre o efetivamente recebido</p>
              </div>
              <div className="panel-tight p-3">
                <p className="font-semibold text-white">Valores apenas previstos</p>
                <p className="mt-1 text-amber-200">Não geram dízimo</p>
                <p className="text-slate-400">Somente recebimentos efetivos geram reserva</p>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-2 text-[0.7rem] text-slate-400">
              <Badge tone="blue">Histórico completo</Badge>
              Cada dízimo guarda vínculo com o recebimento, o serviço e o cliente, permitindo rastreabilidade total.
            </p>
          </Panel>
        </div>
      ) : null}

      <Panel>
        <SectionTitle title="Rastreabilidade" subtitle="Cada lançamento tem identificação única e vínculo com cliente e serviço" />
        <div className="flex flex-wrap gap-2 text-[0.68rem]">
          <Badge tone="blue">{receivableRows.length} contas a receber</Badge>
          <Badge tone="yellow">{payableRows.length} contas a pagar</Badge>
          <Badge tone="green">{paymentRows.length} recebimentos</Badge>
          <Badge tone="purple">{titheRows.length} dízimos</Badge>
          <StatusPill status="pago" /> <StatusPill status="pendente" /> <StatusPill status="atrasado" />
        </div>
      </Panel>
    </div>
  );
}
