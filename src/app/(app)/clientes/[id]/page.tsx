import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, MapPin, MessageCircle, Phone, Plus } from "lucide-react";
import { getClientDetail } from "@/lib/queries";
import { formatDateBR, money, toNum, waLink } from "@/lib/format";
import { deadlineLabel } from "@/lib/labels";
import { Badge, Kpi, Panel, PageHeader, SectionTitle, Stars, StatusPill, EmptyState } from "@/components/ui";
import { serviceDeadline } from "@/lib/finance";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getClientDetail(Number(id));
  if (!data) notFound();
  const { client } = data;
  const pending = data.receivables.reduce(
    (sum, receivable) => sum + Math.max(toNum(receivable.contractedAmount) - toNum(receivable.receivedAmount), 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="no-print">
        <Link href="/clientes" className="mb-3 inline-flex items-center gap-1.5 text-[0.72rem] text-slate-400 hover:text-brand-200">
          <ArrowLeft size={13} /> Voltar para clientes
        </Link>
      </div>
      <PageHeader
        title={client.name}
        subtitle={`${client.city ?? "Cidade não informada"}${client.state ? ` / ${client.state}` : ""} · Cliente desde ${formatDateBR(client.createdAt.toISOString())}`}
        actions={
          <>
            <a href={waLink(client.whatsapp ?? client.phone, `Olá ${client.name}, aqui é a WS Soluções.`)} target="_blank" rel="noreferrer" className="btn btn-ghost">
              <MessageCircle size={14} /> WhatsApp
            </a>
            <Link href={`/documentos?tab=orcamentos&clientId=${client.id}`} className="btn btn-primary">
              <Plus size={14} /> Novo orçamento
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total contratado" value={money(data.totals.contracted)} tone="blue" icon={<FileText size={16} />} />
        <Kpi label="Total recebido" value={money(data.totals.received)} tone="green" />
        <Kpi label="Pendente" value={money(pending)} tone={pending > 0 ? "yellow" : "green"} />
        <Kpi label="Avaliação" value={`${client.rating} / 5`} tone="purple" hint="Classificação do cliente" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel>
          <SectionTitle title="Dados cadastrais" icon={<MapPin size={15} />} />
          <div className="space-y-2 text-[0.78rem]">
            <p className="flex items-center gap-2 text-slate-300"><Phone size={13} className="text-slate-500" /> {client.phone ?? "—"}</p>
            <p className="flex items-center gap-2 text-slate-300"><MessageCircle size={13} className="text-emerald-400" /> {client.whatsapp ?? "—"}</p>
            <p className="text-slate-300"><span className="text-slate-500">Documento:</span> {client.doc ?? "—"}</p>
            <p className="text-slate-300"><span className="text-slate-500">Endereço:</span> {client.address ?? "—"}</p>
            <p className="text-slate-300"><span className="text-slate-500">Cidade/UF:</span> {client.city ?? "—"} {client.state ? `/ ${client.state}` : ""}</p>
            <div><Stars value={client.rating} /></div>
            {client.notes ? <p className="rounded-lg border border-white/8 bg-white/[0.02] p-2 text-[0.74rem] text-slate-300">{client.notes}</p> : null}
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <SectionTitle title="Histórico de serviços" subtitle={`${data.services.length} obra(s) vinculada(s)`} />
          {data.services.length === 0 ? (
            <EmptyState title="Nenhum serviço registrado" description="Aprove um orçamento para gerar um serviço automaticamente." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Serviço</th>
                    <th className="hidden sm:table-cell">Prazo</th>
                    <th>Status</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.services.map((service) => {
                    const deadline = serviceDeadline(service);
                    return (
                      <tr key={service.id}>
                        <td><Link href={`/servicos/${service.id}`} className="font-medium text-brand-200 hover:underline">{service.code}</Link></td>
                        <td className="max-w-[220px] truncate">{service.title}</td>
                        <td className="hidden sm:table-cell">{formatDateBR(service.endDate)}</td>
                        <td><Badge tone={deadline.late ? "red" : service.status === "concluido" ? "green" : "blue"}>{deadlineLabel(deadline)}</Badge></td>
                        <td className="font-medium">{money(service.contractedValue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <SectionTitle title="Orçamentos enviados" subtitle={`${data.budgets.length} documento(s)`} />
          <div className="space-y-1.5">
            {data.budgets.length === 0 ? <EmptyState title="Nenhum orçamento" /> : data.budgets.map((budget) => (
              <div key={budget.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                <div>
                  <Link href={`/documentos/orcamento/${budget.id}`} className="text-[0.78rem] font-medium text-brand-200 hover:underline">{budget.number}</Link>
                  <p className="text-[0.66rem] text-slate-400">{budget.title}</p>
                </div>
                <div className="flex items-center gap-2"><span className="text-[0.78rem]">{money(budget.total)}</span><StatusPill status={budget.status} /></div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionTitle title="Financeiro do cliente" subtitle="Recebimentos e pendências" />
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div className="panel-tight p-2.5">
              <p className="text-[0.6rem] uppercase tracking-wide text-slate-400">Contas a receber</p>
              <p className="text-sm font-bold text-brand-200">{data.receivables.length}</p>
            </div>
            <div className="panel-tight p-2.5">
              <p className="text-[0.6rem] uppercase tracking-wide text-slate-400">Recibos emitidos</p>
              <p className="text-sm font-bold text-emerald-300">{data.receipts.length}</p>
            </div>
          </div>
          <div className="max-h-[230px] space-y-1.5 overflow-y-auto pr-1">
            {data.receivables.length === 0 ? <EmptyState title="Nenhuma pendência financeira" /> : data.receivables.map((receivable) => {
              const balance = Math.max(toNum(receivable.contractedAmount) - toNum(receivable.receivedAmount), 0);
              return (
                <div key={receivable.id} className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[0.76rem] text-slate-200">{receivable.description}</p>
                    <StatusPill status={receivable.status} />
                  </div>
                  <p className="mt-0.5 text-[0.66rem] text-slate-400">
                    Contratado {money(receivable.contractedAmount)} · Recebido {money(receivable.receivedAmount)} · Saldo {money(balance)} · Previsto {formatDateBR(receivable.dueDate)}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[0.65rem] text-slate-500">Contratos: {data.contracts.length} · Pagamentos: {data.payments.length}</p>
          {data.contracts.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.contracts.map((contract) => (
                <Link key={contract.id} href={`/documentos/contrato/${contract.id}`} className="badge border-brand-400/30 bg-brand-500/10 text-brand-200">
                  {contract.number}
                </Link>
              ))}
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
