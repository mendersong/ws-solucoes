import { getFormOptions, getServiceList } from "@/lib/queries";
import { formatDateBR, money, SERVICE_TYPES, toNum } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { Kpi, PageHeader, Panel } from "@/components/ui";
import { CrudTable } from "@/components/crud-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Serviços e Obras" };

export default async function ServicesPage() {
  const [services, options, user] = await Promise.all([getServiceList(), getFormOptions(), getSession()]);
  const canWrite = user?.role !== "funcionario";

  const rows = services.map((service) => ({
    id: service.id,
    code: service.code,
    title: service.title,
    clientId: service.clientId ?? "",
    clientName: service.clientName,
    type: service.type,
    effectiveStatus: service.effectiveStatus,
    deadline: service.deadline.label,
    endDate: service.endDate ?? "",
    contractedValue: toNum(service.contractedValue),
    received: service.received,
    pending: service.pending,
    expensesTotal: service.expensesTotal,
    netResult: service.netResult,
    team: service.team.join(", "),
    address: service.address ?? "",
    description: service.description ?? "",
    startDate: service.startDate ?? "",
    countMode: service.countMode,
    status: service.status,
    notes: service.notes ?? "",
  }));

  const totalContracted = rows.reduce((sum, row) => sum + row.contractedValue, 0);
  const totalReceived = rows.reduce((sum, row) => sum + row.received, 0);
  const totalExpenses = rows.reduce((sum, row) => sum + row.expensesTotal, 0);
  const late = rows.filter((row) => row.effectiveStatus === "atrasado").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Serviços e Obras"
        subtitle="Cada obra concentra cliente, endereço, equipe, custos, recebimentos, dízimo e resultado financeiro calculado automaticamente."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Valor contratado" value={money(totalContracted)} tone="blue" hint={`${rows.length} obras`} />
        <Kpi label="Já recebido" value={money(totalReceived)} tone="green" hint={`Pendente ${money(totalContracted - totalReceived)}`} />
        <Kpi label="Custos lançados" value={money(totalExpenses)} tone="yellow" hint="Despesas + equipe" />
        <Kpi label="Obras atrasadas" value={String(late)} tone={late > 0 ? "red" : "green"} hint="Prazo estourado" />
      </div>

      <CrudTable
        endpoint="services"
        title="Obras e serviços"
        subtitle="Clique no código para abrir a obra completa"
        rows={rows}
        canWrite={canWrite}
        detailPath="/servicos"
        searchKeys={["code", "title", "clientName", "type"]}
        createLabel="Novo serviço"
        emptyText="Nenhum serviço cadastrado"
        rowActions={[
          {
            label: "Iniciar obra",
            icon: "play",
            path: "/api/actions/service",
            body: { action: "start" },
            showWhen: { key: "effectiveStatus", equals: "agendado" },
          },
          {
            label: "Concluir obra",
            icon: "check",
            path: "/api/actions/service",
            body: { action: "conclude" },
            confirm: "Confirmar a conclusão desta obra hoje? A data real e os dias de atraso/adiantamento serão registrados.",
            showWhen: { key: "effectiveStatus", notEquals: "concluido" },
          },
          {
            label: "Cancelar obra",
            icon: "cancel",
            path: "/api/actions/service",
            body: { action: "cancel" },
            confirm: "Cancelar esta obra?",
            showWhen: { key: "effectiveStatus", notEquals: "concluido" },
          },
        ]}
        columns={[
          { key: "code", label: "Código" },
          { key: "title", label: "Serviço" },
          { key: "clientName", label: "Cliente", hideOnMobile: true },
          { key: "type", label: "Tipo", hideOnMobile: true },
          { key: "effectiveStatus", label: "Status", format: "status" },
          { key: "deadline", label: "Prazo" },
          { key: "endDate", label: "Término prev.", format: "date", hideOnMobile: true },
          { key: "contractedValue", label: "Contratado", format: "money" },
          { key: "received", label: "Recebido", format: "money", hideOnMobile: true },
          { key: "netResult", label: "Resultado", format: "money" },
        ]}
        fields={[
          {
            key: "clientId",
            label: "Cliente",
            type: "select",
            required: true,
            span: 2,
            options: options.clients.map((client) => ({ value: String(client.id), label: `${client.name}${client.city ? ` — ${client.city}` : ""}` })),
          },
          { key: "title", label: "Título do serviço", required: true, span: 2 },
          {
            key: "type",
            label: "Tipo de serviço",
            type: "select",
            defaultValue: SERVICE_TYPES[0],
            options: SERVICE_TYPES.map((type) => ({ value: type, label: type })),
          },
          { key: "contractedValue", label: "Valor contratado (R$)", type: "number" },
          { key: "address", label: "Endereço da execução", span: 2 },
          { key: "startDate", label: "Início previsto", type: "date" },
          { key: "endDate", label: "Término previsto", type: "date" },
          {
            key: "countMode",
            label: "Contagem de prazo",
            type: "select",
            defaultValue: "corridos",
            options: [
              { value: "corridos", label: "Dias corridos" },
              { value: "uteis", label: "Dias úteis" },
            ],
          },
          {
            key: "status",
            label: "Situação",
            type: "select",
            defaultValue: "agendado",
            options: [
              { value: "agendado", label: "Agendado" },
              { value: "em_andamento", label: "Em andamento" },
              { value: "concluido", label: "Concluído" },
              { value: "cancelado", label: "Cancelado" },
            ],
          },
          { key: "description", label: "Escopo / descrição", type: "textarea", span: 2 },
          { key: "notes", label: "Observações internas", type: "textarea", span: 2 },
        ]}
      />

      <Panel>
        <p className="text-[0.72rem] leading-relaxed text-slate-400">
          Regras de prazo: <span className="text-emerald-300">verde</span> concluído dentro ou antes do prazo ·{" "}
          <span className="text-brand-300">azul</span> em andamento dentro do prazo ·{" "}
          <span className="text-amber-300">amarelo</span> vence hoje ·{" "}
          <span className="text-red-300">vermelho</span> atrasado ou concluído fora do prazo.
          A conclusão registra data real e a diferença em dias (adiantado ou atrasado).
        </p>
      </Panel>
    </div>
  );
}
