import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, FileText, MapPin, Users, Wallet } from "lucide-react";
import { getFormOptions, getServiceDetail } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { categoryLabel, formatDateBR, money, toNum } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/format";
import { Badge, DeadlineBadge, EmptyState, InfoLine, Kpi, PageHeader, Panel, Progress, ResultBadge, SectionTitle, StatusPill } from "@/components/ui";
import { CrudTable } from "@/components/crud-table";
import { TeamEditor } from "@/components/team-editor";

export const dynamic = "force-dynamic";

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, options, user] = await Promise.all([getServiceDetail(Number(id)), getFormOptions(), getSession()]);
  if (!data) notFound();
  const { service, client, financials, deadline } = data;
  const canWrite = user?.role !== "funcionario";
  const contracted = toNum(service.contractedValue);

  return (
    <div className="space-y-4">
      <div className="no-print">
        <Link href="/servicos" className="inline-flex items-center gap-1.5 text-[0.72rem] text-slate-400 hover:text-brand-200">
          <ArrowLeft size={13} /> Voltar para serviços
        </Link>
      </div>

      <PageHeader
        title={`${service.code} · ${service.title}`}
        subtitle={`${service.type}${client ? ` · ${client.name}` : ""}`}
        actions={
          <>
            <Badge tone={deadline.late ? "red" : "blue"}>{service.status.replace("_", " ")}</Badge>
            <DeadlineBadge deadline={deadline} />
            {data.budget ? (
              <Link href={`/documentos/orcamento/${data.budget.id}`} className="btn btn-ghost">
                <FileText size={13} /> Orçamento {data.budget.number}
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Valor contratado" value={money(contracted)} tone="blue" />
        <Kpi label="Recebido" value={money(financials.received)} tone="green" hint={`Pendente ${money(financials.pending)}`} />
        <Kpi label="Despesas + equipe" value={money(financials.expensesTotal)} tone="yellow" />
        <Kpi
          label="Resultado líquido"
          value={money(financials.netResult)}
          tone={financials.situation === "lucro" ? "green" : financials.situation === "prejuizo" ? "red" : "slate"}
          hint={`Margem ${financials.margin.toFixed(1)}%`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel>
          <SectionTitle title="Dados do serviço" icon={<MapPin size={15} />} />
          <InfoLine label="Cliente" value={client ? <Link href={`/clientes/${client.id}`} className="text-brand-200 hover:underline">{client.name}</Link> : "—"} />
          <InfoLine label="Endereço" value={service.address ?? "—"} />
          <InfoLine label="Início previsto" value={formatDateBR(service.startDate)} />
          <InfoLine label="Início real" value={formatDateBR(service.realStartDate)} />
          <InfoLine label="Término previsto" value={formatDateBR(service.endDate)} />
          <InfoLine label="Término real" value={formatDateBR(service.realEndDate)} />
          <InfoLine label="Contagem" value={service.countMode === "uteis" ? "Dias úteis" : "Dias corridos"} />
          <InfoLine label="Prazo" value={<DeadlineBadge deadline={deadline} />} />
          {service.description ? <p className="mt-2 rounded-lg border border-white/8 bg-white/[0.02] p-2 text-[0.74rem] text-slate-300">{service.description}</p> : null}
          {service.notes ? <p className="mt-1 text-[0.7rem] text-slate-400">{service.notes}</p> : null}
        </Panel>

        <Panel>
          <SectionTitle
            title="Equipe alocada"
            subtitle={`${data.team.length} funcionário(s)`}
            icon={<Users size={15} />}
            action={canWrite ? <TeamEditor serviceId={service.id} employees={options.employees} current={data.team.map((t) => ({ employeeId: t.employeeId, days: t.days }))} /> : null}
          />
          <div className="space-y-1.5">
            {data.team.length === 0 ? (
              <EmptyState title="Equipe não definida" description="Associe funcionários para calcular os custos automaticamente." />
            ) : (
              data.team.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                  <div>
                    <p className="text-[0.78rem] font-medium text-slate-100">{member.name}</p>
                    <p className="text-[0.64rem] text-slate-400">{member.role || "—"} · {member.days} dia(s) × {money(member.dailyRate)}</p>
                  </div>
                  <span className="text-[0.78rem] font-semibold text-amber-200">{money(member.total)}</span>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 border-t border-white/8 pt-3">
            <SectionTitle title="Agenda vinculada" icon={<CalendarClock size={15} />} />
            {data.appointments.length === 0 ? (
              <p className="text-[0.72rem] text-slate-400">Sem agendamentos vinculados.</p>
            ) : (
              data.appointments.map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between gap-2 py-1 text-[0.74rem]">
                  <span className="text-slate-300">{formatDateBR(appointment.date)} · {appointment.time}</span>
                  <StatusPill status={appointment.status} />
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <SectionTitle title="Resultado financeiro" subtitle="Cálculo automático sobre o efetivamente recebido" icon={<Wallet size={15} />} />
          <InfoLine label="Valor contratado" value={money(contracted)} />
          <InfoLine label="Recebido" value={<span className="text-emerald-300">{money(financials.received)}</span>} />
          <InfoLine label="Pendente" value={<span className="text-amber-300">{money(financials.pending)}</span>} />
          <InfoLine label="Despesas + equipe" value={<span className="text-red-300">− {money(financials.expensesTotal)}</span>} />
          <InfoLine label="Lucro bruto" value={money(financials.grossProfit)} />
          <InfoLine label="Dízimo reservado" value={<span className="text-violet-300">− {money(financials.tithe)}</span>} />
          <InfoLine label="Resultado líquido" value={<ResultBadge value={financials.netResult} />} />
          <div className="mt-2">
            <div className="mb-1 flex justify-between text-[0.68rem] text-slate-400">
              <span>Margem líquida</span>
              <span className="font-semibold text-slate-200">{financials.margin.toFixed(1)}%</span>
            </div>
            <Progress value={Math.max(financials.margin, 0)} tone={financials.margin >= 0 ? "green" : "red"} />
          </div>
          <div className="mt-3 space-y-1 border-t border-white/8 pt-2">
            {Object.entries(financials.expensesByCategory).map(([category, total]) => (
              <div key={category} className="flex items-center justify-between text-[0.72rem]">
                <span className="text-slate-400">{categoryLabel(category)}</span>
                <span className="text-slate-200">{money(total)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <CrudTable
        endpoint="expenses"
        title="Despesas da obra"
        subtitle="Mão de obra, transporte, alimentação, hospedagem, materiais, equipamentos e outras despesas"
        rows={data.expenses.map((expense) => ({
          id: expense.id,
          description: expense.description,
          category: expense.category,
          amount: toNum(expense.amount),
          expenseDate: expense.expenseDate ?? "",
          notes: expense.notes ?? "",
          serviceId: expense.serviceId ?? "",
        }))}
        canWrite={canWrite}
        searchKeys={["description", "category"]}
        createLabel="Nova despesa"
        defaults={{ serviceId: String(service.id), expenseDate: new Date().toISOString().slice(0, 10) }}
        columns={[
          { key: "description", label: "Descrição" },
          { key: "category", label: "Categoria", format: "upper" },
          { key: "expenseDate", label: "Data", format: "date" },
          { key: "amount", label: "Valor", format: "money" },
        ]}
        fields={[
          { key: "description", label: "Descrição", required: true, span: 2 },
          { key: "serviceId", label: "Serviço vinculado (ID)", type: "number" },
          { key: "amount", label: "Valor (R$)", type: "number", required: true },
          {
            key: "category",
            label: "Categoria",
            type: "select",
            defaultValue: "materiais",
            options: EXPENSE_CATEGORIES,
          },
          { key: "expenseDate", label: "Data", type: "date" },
          { key: "notes", label: "Observações", span: 2 },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <SectionTitle title="Recebimentos e recibos" subtitle="Dízimo reservado automaticamente em cada entrada" />
          {data.payments.length === 0 ? (
            <EmptyState title="Nenhum recebimento" description="Registre o recebimento em Financeiro › A receber." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Data</th><th>Forma</th><th>Valor</th><th>Dízimo</th><th>Recibo</th></tr>
                </thead>
                <tbody>
                  {data.payments.map((payment) => {
                    const receipt = data.receipts.find((r) => r.paymentId === payment.id);
                    return (
                      <tr key={payment.id}>
                        <td>{formatDateBR(payment.paidAt)}</td>
                        <td>{payment.paymentMethod}</td>
                        <td className="font-medium">{money(payment.amount)}</td>
                        <td className="text-violet-300">{money(payment.titheAmount)}</td>
                        <td>{receipt ? <Link href={`/documentos/recibo/${receipt.id}`} className="text-brand-200 hover:underline">{receipt.number}</Link> : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel>
          <SectionTitle title="Dízimo da obra" subtitle="Reservado × pago" />
          <div className="space-y-1.5">
            {data.tithes.length === 0 ? <EmptyState title="Nenhum dízimo gerado" /> : data.tithes.map((tithe) => (
              <div key={tithe.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                <div>
                  <p className="text-[0.76rem] text-slate-200">Base {money(tithe.baseAmount)}</p>
                  <p className="text-[0.64rem] text-slate-400">{tithe.paidAt ? `Pago em ${formatDateBR(tithe.paidAt)}` : "Reservado (a pagar)"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[0.8rem] font-semibold text-violet-200">{money(tithe.amount)}</span>
                  <StatusPill status={tithe.status} />
                </div>
              </div>
            ))}
          </div>
          {financials.pending > 0 ? (
            <Link href={`/financeiro?tab=receber&serviceId=${service.id}`} className="btn btn-primary mt-3 w-full">
              <Wallet size={14} /> Registrar recebimento desta obra
            </Link>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
