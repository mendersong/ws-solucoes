"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, PiggyBank } from "lucide-react";
import { api, type ApiResult } from "@/lib/client";
import { Field, FormMessage, Modal } from "@/components/forms";
import { money, PAYMENT_METHODS, todayISO } from "@/lib/format";

type ReceivableOption = {
  id: number;
  description: string;
  clientName: string;
  balance: number;
  serviceId: number | null;
};

export function ReceivePaymentButton({
  receivables,
  label = "Novo recebimento",
  compact = false,
}: {
  receivables: ReceivableOption[];
  label?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const [form, setForm] = useState({
    receivableId: receivables[0] ? String(receivables[0].id) : "",
    amount: receivables[0] ? String(receivables[0].balance) : "",
    paidAt: todayISO(),
    paymentMethod: "PIX",
    notes: "",
  });

  const selected = receivables.find((item) => String(item.id) === form.receivableId);
  const tithe = (Number(form.amount.replace(",", ".")) || 0) * 0.1;

  const submit = async () => {
    setBusy(true);
    setResult(null);
    const response = await api("/api/actions/finance", {
      method: "POST",
      body: JSON.stringify({
        action: "register_payment",
        receivableId: form.receivableId ? Number(form.receivableId) : null,
        amount: form.amount,
        paidAt: form.paidAt,
        paymentMethod: form.paymentMethod,
        notes: form.notes,
      }),
      label: "Registrar recebimento",
    });
    setBusy(false);
    const data = response.data as { receipt?: { id: number; number: string }; tithe?: { amount: string } } | undefined;
    if (response.ok) {
      setReceiptId(data?.receipt?.id ?? null);
      setResult({
        ...response,
        message: response.queued
          ? response.message
          : `Recebimento registrado. Dízimo reservado: ${money(data?.tithe?.amount ?? tithe)}. Recibo ${data?.receipt?.number ?? ""} gerado automaticamente.`,
      });
      if (!response.queued) router.refresh();
    } else {
      setResult(response);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={compact ? "btn btn-ghost !py-1.5 !text-[0.72rem]" : "btn btn-primary"}>
        <HandCoins size={14} /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Registrar recebimento" subtitle="O dízimo de 10% é calculado sobre o valor efetivamente recebido e um recibo é gerado automaticamente.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Conta a receber" className="sm:col-span-2">
            <select
              className="input"
              value={form.receivableId}
              onChange={(event) => {
                const found = receivables.find((item) => String(item.id) === event.target.value);
                setForm({ ...form, receivableId: event.target.value, amount: found ? String(found.balance) : form.amount });
              }}
            >
              <option value="">Recebimento avulso (sem conta vinculada)</option>
              {receivables.map((receivable) => (
                <option key={receivable.id} value={receivable.id}>
                  {receivable.description} · {receivable.clientName} · saldo {money(receivable.balance)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Valor recebido (R$)" hint={selected ? `Saldo pendente: ${money(selected.balance)}` : "Informe o valor efetivamente recebido"}>
            <input className="input" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} inputMode="decimal" />
          </Field>
          <Field label="Data do recebimento">
            <input type="date" className="input" value={form.paidAt} onChange={(event) => setForm({ ...form, paidAt: event.target.value })} />
          </Field>
          <Field label="Forma de pagamento">
            <select className="input" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </Field>
          <Field label="Observações">
            <input className="input" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Parcela, referência..." />
          </Field>
        </div>
        <div className="mt-3 rounded-lg border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-[0.74rem] text-violet-100">
          <p className="flex items-center gap-1.5 font-semibold"><PiggyBank size={13} /> Dízimo automático</p>
          <p className="mt-0.5">Reserva de {money(tithe)} (10%) · líquido disponível {money((Number(form.amount.replace(",", ".")) || 0) - tithe)}</p>
        </div>
        <div className="mt-3 space-y-2">
          <FormMessage result={result} />
          {receiptId ? (
            <a href={`/documentos/recibo/${receiptId}`} className="btn btn-ghost w-full">Abrir recibo</a>
          ) : null}
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn btn-ghost">Fechar</button>
            <button onClick={() => void submit()} disabled={busy} className="btn btn-primary">
              {busy ? "Registrando..." : "Confirmar recebimento"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function PayAllTithesButton({ pendingCount }: { pendingCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  const pay = async () => {
    if (!window.confirm(`Registrar o pagamento de todo o dízimo reservado?`)) return;
    setBusy(true);
    const response = await api("/api/actions/finance", {
      method: "POST",
      body: JSON.stringify({ action: "pay_tithe", all: true, paidAt: todayISO() }),
      label: "Pagar dízimo reservado",
    });
    setBusy(false);
    setResult(response);
    if (response.ok) router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => void pay()} disabled={busy || pendingCount === 0} className="btn btn-success !py-1.5 !text-[0.72rem]">
        <PiggyBank size={13} /> {busy ? "Processando..." : "Pagar dízimo reservado"}
      </button>
      {result && !result.ok ? <span className="text-[0.68rem] text-red-300">{result.error}</span> : null}
    </div>
  );
}
