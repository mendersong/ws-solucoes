"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Plus, Printer, Trash2 } from "lucide-react";
import { api, type ApiResult } from "@/lib/client";
import { Field, FormMessage, Modal } from "@/components/forms";
import { formatDateBR, money, SERVICE_TYPES } from "@/lib/format";
import { EmptyState, Panel, SectionTitle, StatusPill } from "@/components/ui";

type Item = { kind: string; description: string; quantity: string; unitPrice: string };
type BudgetRow = {
  id: number;
  number: string;
  clientId: number | null;
  clientName: string;
  title: string;
  description: string;
  paymentTerms: string;
  validUntil: string;
  discount: string;
  laborTotal: string;
  materialTotal: string;
  total: string;
  status: string;
  createdAt: string;
  serviceId: number | null;
  items: Item[];
};

const emptyItem = (): Item => ({ kind: "mao_de_obra", description: "", quantity: "1", unitPrice: "" });

export function BudgetManager({
  budgets,
  clients,
  services,
  canWrite,
}: {
  budgets: BudgetRow[];
  clients: { id: number; name: string }[];
  services: { id: number; code: string; title: string }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetRow | null>(null);
  const [approving, setApproving] = useState<BudgetRow | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    title: "",
    description: "",
    paymentTerms: "50% na assinatura do contrato e 50% na entrega dos serviços.",
    validUntil: "",
    discount: "",
    status: "enviado",
  });
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [approval, setApproval] = useState({ startDate: "", days: "7", serviceType: SERVICE_TYPES[3] });

  const laborTotal = items.filter((i) => i.kind === "mao_de_obra").reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const materialTotal = items.filter((i) => i.kind === "material").reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const total = Math.max(laborTotal + materialTotal - (Number(form.discount) || 0), 0);

  const openCreate = () => {
    setEditing(null);
    setForm({ clientId: "", title: "", description: "", paymentTerms: form.paymentTerms, validUntil: "", discount: "", status: "enviado" });
    setItems([emptyItem()]);
    setResult(null);
    setOpen(true);
  };

  const openEdit = (budget: BudgetRow) => {
    setEditing(budget);
    setForm({
      clientId: budget.clientId ? String(budget.clientId) : "",
      title: budget.title,
      description: budget.description,
      paymentTerms: budget.paymentTerms,
      validUntil: budget.validUntil,
      discount: budget.discount,
      status: budget.status,
    });
    setItems(budget.items.length > 0 ? budget.items.map((i) => ({ ...i, quantity: String(i.quantity), unitPrice: String(i.unitPrice) })) : [emptyItem()]);
    setResult(null);
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setResult(null);
    const response = await api("/api/actions/budget", {
      method: "POST",
      body: JSON.stringify({
        action: "save",
        id: editing?.id,
        clientId: form.clientId ? Number(form.clientId) : null,
        title: form.title,
        description: form.description,
        paymentTerms: form.paymentTerms,
        validUntil: form.validUntil || null,
        discount: Number(form.discount) || 0,
        status: form.status,
        items: items.map((item) => ({
          kind: item.kind,
          description: item.description,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
        })),
      }),
      label: "Salvar orçamento",
    });
    setBusy(false);
    setResult(response);
    if (response.ok) {
      setOpen(false);
      router.refresh();
    }
  };

  const approve = async () => {
    if (!approving) return;
    setBusy(true);
    const response = await api("/api/actions/budget", {
      method: "POST",
      body: JSON.stringify({
        action: "approve",
        budgetId: approving.id,
        startDate: approval.startDate || undefined,
        days: Number(approval.days) || 7,
        serviceType: approval.serviceType,
      }),
      label: "Aprovar orçamento",
    });
    setBusy(false);
    setResult(response);
    if (response.ok) {
      setApproving(null);
      router.refresh();
    }
  };

  const setStatus = async (budget: BudgetRow, status: string) => {
    const response = await api("/api/actions/budget", {
      method: "POST",
      body: JSON.stringify({ action: "set_status", budgetId: budget.id, status }),
      label: "Atualizar status do orçamento",
    });
    if (!response.ok) window.alert(response.error);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <Panel>
        <SectionTitle
          title="Orçamentos"
          subtitle="Mão de obra e materiais separados, desconto, validade e condições de pagamento. Aprovar gera serviço, contrato, agenda e conta a receber automaticamente."
          icon={<FileText size={16} />}
          action={
            canWrite ? (
              <button onClick={openCreate} className="btn btn-primary !py-1.5">
                <Plus size={13} /> Novo orçamento
              </button>
            ) : null
          }
        />
        {result && !result.ok ? <div className="mb-2"><FormMessage result={result} /></div> : null}
        {budgets.length === 0 ? (
          <EmptyState title="Nenhum orçamento" description="Crie um orçamento profissional com a logo WS SOLUÇÕES." />
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {budgets.map((budget) => (
              <div key={budget.id} className="panel-tight flex flex-col gap-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[0.62rem] uppercase tracking-wide text-brand-300">{budget.number}</p>
                    <p className="truncate text-[0.84rem] font-semibold text-white">{budget.title}</p>
                    <p className="truncate text-[0.68rem] text-slate-400">{budget.clientName} · {formatDateBR(budget.createdAt)}</p>
                  </div>
                  <StatusPill status={budget.status} />
                </div>
                <div className="flex items-center justify-between text-[0.72rem]">
                  <span className="text-slate-400">Validade {formatDateBR(budget.validUntil)}</span>
                  <span className="text-base font-bold text-brand-200">{money(budget.total)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Link href={`/documentos/orcamento/${budget.id}`} className="btn btn-ghost !py-1 !text-[0.68rem]">
                    <Printer size={12} /> Abrir / PDF
                  </Link>
                  {canWrite ? (
                    <>
                      <button onClick={() => openEdit(budget)} className="btn btn-ghost !py-1 !text-[0.68rem]">Editar</button>
                      {budget.status !== "aprovado" && !budget.serviceId ? (
                        <button
                          onClick={() => {
                            setApproving(budget);
                            setResult(null);
                            setApproval({ ...approval, startDate: new Date().toISOString().slice(0, 10) });
                          }}
                          className="btn btn-success !py-1 !text-[0.68rem]"
                        >
                          <CheckCircle2 size={12} /> Aprovar
                        </button>
                      ) : null}
                      {budget.status === "rascunho" ? (
                        <button onClick={() => void setStatus(budget, "enviado")} className="btn btn-ghost !py-1 !text-[0.68rem]">Enviar</button>
                      ) : null}
                      {budget.status === "enviado" ? (
                        <button onClick={() => void setStatus(budget, "recusado")} className="btn btn-danger !py-1 !text-[0.68rem]">Recusar</button>
                      ) : null}
                    </>
                  ) : null}
                </div>
                {budget.serviceId ? (
                  <Link href={`/servicos/${budget.serviceId}`} className="text-[0.68rem] text-emerald-300 hover:underline">
                    Obra gerada automaticamente →
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Editar orçamento ${editing.number}` : "Novo orçamento"} subtitle="Valores calculados automaticamente" wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente">
            <select className="input" value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}>
              <option value="">Selecione o cliente...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Título do orçamento">
            <input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Instalação elétrica completa" />
          </Field>
          <Field label="Descrição / escopo" className="sm:col-span-2">
            <textarea className="input min-h-[60px]" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          <Field label="Condições de pagamento" className="sm:col-span-2">
            <input className="input" value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })} />
          </Field>
          <Field label="Validade do orçamento">
            <input type="date" className="input" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} />
          </Field>
          <Field label="Desconto (R$)">
            <input type="number" step="0.01" className="input" value={form.discount} onChange={(event) => setForm({ ...form, discount: event.target.value })} />
          </Field>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label !mb-0">Itens do orçamento</span>
            <button onClick={() => setItems([...items, emptyItem()])} className="btn btn-ghost !py-1 !text-[0.68rem]">
              <Plus size={12} /> Adicionar item
            </button>
          </div>
          <div className="space-y-1.5">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-1.5">
                <select
                  className="input col-span-4 !py-1.5 sm:col-span-2"
                  value={item.kind}
                  onChange={(event) => setItems(items.map((row, i) => (i === index ? { ...row, kind: event.target.value } : row)))}
                >
                  <option value="mao_de_obra">Mão de obra</option>
                  <option value="material">Material</option>
                </select>
                <input
                  className="input col-span-8 !py-1.5 sm:col-span-5"
                  placeholder="Descrição do item"
                  value={item.description}
                  onChange={(event) => setItems(items.map((row, i) => (i === index ? { ...row, description: event.target.value } : row)))}
                />
                <input
                  className="input col-span-3 !py-1.5 sm:col-span-1"
                  type="number"
                  step="0.01"
                  placeholder="Qtd"
                  value={item.quantity}
                  onChange={(event) => setItems(items.map((row, i) => (i === index ? { ...row, quantity: event.target.value } : row)))}
                />
                <input
                  className="input col-span-4 !py-1.5 sm:col-span-2"
                  type="number"
                  step="0.01"
                  placeholder="Valor unit."
                  value={item.unitPrice}
                  onChange={(event) => setItems(items.map((row, i) => (i === index ? { ...row, unitPrice: event.target.value } : row)))}
                />
                <div className="col-span-4 flex items-center justify-end gap-1 sm:col-span-2">
                  <span className="truncate text-[0.72rem] font-medium text-slate-200">
                    {money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                  </span>
                  <button onClick={() => setItems(items.filter((_, i) => i !== index))} className="rounded p-1 text-slate-500 hover:text-red-300">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[0.78rem] sm:grid-cols-4">
            <div className="panel-tight p-2"><p className="text-[0.6rem] uppercase text-slate-400">Mão de obra</p><p className="font-semibold text-slate-100">{money(laborTotal)}</p></div>
            <div className="panel-tight p-2"><p className="text-[0.6rem] uppercase text-slate-400">Materiais</p><p className="font-semibold text-slate-100">{money(materialTotal)}</p></div>
            <div className="panel-tight p-2"><p className="text-[0.6rem] uppercase text-slate-400">Desconto</p><p className="font-semibold text-amber-200">− {money(Number(form.discount) || 0)}</p></div>
            <div className="panel-tight p-2"><p className="text-[0.6rem] uppercase text-slate-400">Total</p><p className="font-bold text-brand-200">{money(total)}</p></div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <FormMessage result={result} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn btn-ghost">Cancelar</button>
            <button onClick={() => void save()} disabled={busy} className="btn btn-primary">{busy ? "Salvando..." : "Salvar orçamento"}</button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(approving)} onClose={() => setApproving(null)} title={`Aprovar ${approving?.number ?? ""}`} subtitle="A aprovação cria automaticamente: serviço, contrato, agendamento e conta a receber.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Data de início">
            <input type="date" className="input" value={approval.startDate} onChange={(event) => setApproval({ ...approval, startDate: event.target.value })} />
          </Field>
          <Field label="Prazo estimado (dias)">
            <input type="number" className="input" value={approval.days} onChange={(event) => setApproval({ ...approval, days: event.target.value })} />
          </Field>
          <Field label="Tipo de serviço" className="sm:col-span-2">
            <select className="input" value={approval.serviceType} onChange={(event) => setApproval({ ...approval, serviceType: event.target.value })}>
              {SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </Field>
        </div>
        <p className="mt-3 rounded-lg border border-brand-400/25 bg-brand-500/[0.08] px-3 py-2 text-[0.72rem] text-brand-100">
          Serviços existentes: {services.length}. O novo serviço será criado com o valor total de {money(approving?.total ?? 0)} e cliente vinculado.
        </p>
        <div className="mt-3 space-y-2">
          <FormMessage result={result} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setApproving(null)} className="btn btn-ghost">Cancelar</button>
            <button onClick={() => void approve()} disabled={busy} className="btn btn-success">{busy ? "Gerando..." : "Aprovar e gerar obra"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
