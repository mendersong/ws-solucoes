import Link from "next/link";
import { db } from "@/db";
import { budgetItems, budgets, clients, contracts, receipts, services } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { formatDateBR, money, toNum, SERVICE_TYPES } from "@/lib/format";
import { getFormOptions } from "@/lib/queries";
import { Kpi, PageHeader, Panel } from "@/components/ui";
import { CrudTable } from "@/components/crud-table";
import { BudgetManager } from "@/components/budget-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orçamentos e Contratos" };

const TABS = [
  { key: "orcamentos", label: "Orçamentos" },
  { key: "contratos", label: "Contratos" },
  { key: "recibos", label: "Recibos" },
];

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "orcamentos" } = await searchParams;
  const [user, options, budgetRows, itemRows, contractRows, receiptRows, clientRows, serviceRows] = await Promise.all([
    getSession(),
    getFormOptions(),
    db.select().from(budgets),
    db.select().from(budgetItems),
    db.select().from(contracts),
    db.select().from(receipts),
    db.select().from(clients),
    db.select().from(services),
  ]);
  const canWrite = user?.role === "admin" || user?.role === "financeiro";
  const clientById = new Map(clientRows.map((c) => [c.id, c]));
  const serviceById = new Map(serviceRows.map((s) => [s.id, s]));

  const budgetsMapped = budgetRows
    .sort((a, b) => b.id - a.id)
    .map((budget) => ({
      id: budget.id,
      number: budget.number,
      clientId: budget.clientId,
      clientName: budget.clientId ? clientById.get(budget.clientId)?.name ?? "—" : "Cliente não informado",
      title: budget.title,
      description: budget.description ?? "",
      paymentTerms: budget.paymentTerms ?? "",
      validUntil: budget.validUntil ?? "",
      discount: budget.discount,
      laborTotal: budget.laborTotal,
      materialTotal: budget.materialTotal,
      total: budget.total,
      status: budget.status,
      createdAt: budget.createdAt.toISOString(),
      serviceId: budget.serviceId,
      items: itemRows
        .filter((item) => item.budgetId === budget.id)
        .map((item) => ({
          kind: item.kind,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
    }));

  const contractsMapped = contractRows.map((contract) => ({
    id: contract.id,
    number: contract.number,
    clientId: contract.clientId ?? "",
    serviceId: contract.serviceId ?? "",
    title: contract.title,
    clientName: contract.clientId ? clientById.get(contract.clientId)?.name ?? "—" : "—",
    serviceCode: contract.serviceId ? serviceById.get(contract.serviceId)?.code ?? "—" : "—",
    value: toNum(contract.value),
    startDate: contract.startDate ?? "",
    endDate: contract.endDate ?? "",
    paymentTerms: contract.paymentTerms ?? "",
    scope: contract.scope ?? "",
    obligations: contract.obligations ?? "",
    status: contract.status,
  }));

  const receiptsMapped = receiptRows
    .sort((a, b) => b.id - a.id)
    .map((receipt) => ({
      id: receipt.id,
      number: receipt.number,
      clientName: receipt.clientId ? clientById.get(receipt.clientId)?.name ?? "—" : "—",
      serviceCode: receipt.serviceId ? serviceById.get(receipt.serviceId)?.code ?? "—" : "—",
      amount: toNum(receipt.amount),
      receiptDate: receipt.receiptDate,
      paymentMethod: receipt.paymentMethod,
      remainingBalance: toNum(receipt.remainingBalance),
    }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orçamentos e Contratos"
        subtitle="Documentos profissionais com a identidade WS SOLUÇÕES. Abra em PDF (impressão) e compartilhe pelo WhatsApp."
        actions={
          <Link href="/documentos?tab=orcamentos" className="btn btn-primary">
            Novo orçamento
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Orçamentos" value={String(budgetRows.length)} tone="blue" hint={`${budgetRows.filter((b) => b.status === "aprovado").length} aprovados`} />
        <Kpi label="Valor orçado" value={money(budgetRows.reduce((s, b) => s + toNum(b.total), 0))} tone="purple" />
        <Kpi label="Contratos ativos" value={String(contractRows.filter((c) => c.status === "ativo").length)} tone="green" hint={`${contractRows.length} no total`} />
        <Kpi label="Recibos emitidos" value={String(receiptRows.length)} tone="slate" hint={money(receiptRows.reduce((s, r) => s + toNum(r.amount), 0))} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((item) => (
          <Link key={item.key} href={`/documentos?tab=${item.key}`} className={`btn !py-1.5 ${tab === item.key ? "btn-primary" : "btn-ghost"}`}>
            {item.label}
          </Link>
        ))}
      </div>

      {tab === "orcamentos" ? (
        <BudgetManager budgets={budgetsMapped} clients={options.clients.map((c) => ({ id: c.id, name: c.name }))} services={options.services} canWrite={canWrite} />
      ) : null}

      {tab === "contratos" ? (
        <CrudTable
          endpoint="contracts"
          title="Contratos"
          subtitle="Escopo, valores, prazos, obrigações e assinatura"
          rows={contractsMapped}
          canWrite={canWrite}
          searchKeys={["number", "title", "clientName"]}
          createLabel="Novo contrato"
          detailPath="/documentos/contrato"
          columns={[
            { key: "number", label: "Número" },
            { key: "title", label: "Título" },
            { key: "clientName", label: "Cliente", hideOnMobile: true },
            { key: "serviceCode", label: "Obra", hideOnMobile: true },
            { key: "value", label: "Valor", format: "money" },
            { key: "startDate", label: "Início", format: "date", hideOnMobile: true },
            { key: "status", label: "Status", format: "status" },
          ]}
          fields={[
            { key: "number", label: "Número do contrato", required: true },
            { key: "title", label: "Título", required: true },
            {
              key: "clientId",
              label: "Cliente",
              type: "select",
              options: options.clients.map((client) => ({ value: String(client.id), label: client.name })),
            },
            {
              key: "serviceId",
              label: "Serviço",
              type: "select",
              options: options.services.map((service) => ({ value: String(service.id), label: `${service.code} — ${service.title}` })),
            },
            { key: "value", label: "Valor (R$)", type: "number" },
            { key: "startDate", label: "Início", type: "date" },
            { key: "endDate", label: "Término", type: "date" },
            { key: "paymentTerms", label: "Condições de pagamento", span: 2 },
            { key: "scope", label: "Escopo dos serviços", type: "textarea", span: 2 },
            { key: "obligations", label: "Obrigações das partes", type: "textarea", span: 2 },
            {
              key: "status",
              label: "Status",
              type: "select",
              defaultValue: "ativo",
              options: [
                { value: "ativo", label: "Ativo" },
                { value: "concluido", label: "Concluído" },
                { value: "cancelado", label: "Cancelado" },
              ],
            },
          ]}
        />
      ) : null}

      {tab === "recibos" ? (
        <CrudTable
          endpoint="receipts"
          title="Recibos"
          subtitle="Gerados automaticamente a cada recebimento registrado"
          rows={receiptsMapped}
          canWrite={false}
          searchKeys={["number", "clientName", "serviceCode"]}
          createLabel="Recibo"
          detailPath="/documentos/recibo"
          columns={[
            { key: "number", label: "Recibo" },
            { key: "receiptDate", label: "Data", format: "date" },
            { key: "clientName", label: "Cliente" },
            { key: "serviceCode", label: "Obra", hideOnMobile: true },
            { key: "paymentMethod", label: "Forma", hideOnMobile: true },
            { key: "amount", label: "Valor", format: "money" },
            { key: "remainingBalance", label: "Saldo restante", format: "money" },
          ]}
          fields={[]}
        />
      ) : null}

      <Panel>
        <p className="text-[0.72rem] leading-relaxed text-slate-400">
          Tipos de serviço disponíveis nos documentos: {SERVICE_TYPES.join(" · ")}. Os documentos usam a logo e os dados da empresa
          e podem ser impressos em PDF ou enviados pela Evolution API (WhatsApp) quando a integração estiver conectada.
          Última atualização: {formatDateBR(new Date().toISOString())}.
        </p>
      </Panel>
    </div>
  );
}
