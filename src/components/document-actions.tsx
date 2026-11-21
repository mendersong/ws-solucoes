"use client";

import { useState } from "react";
import { Printer, Send, MessageCircle } from "lucide-react";
import { api, type ApiResult } from "@/lib/client";
import { Field, FormMessage, Modal } from "@/components/forms";

export function DocumentActions({
  documentLabel,
  phone,
  message,
}: {
  documentLabel: string;
  phone: string;
  message: string;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(phone);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  const send = async () => {
    setBusy(true);
    setResult(null);
    const response = await api("/api/whatsapp", {
      method: "POST",
      body: JSON.stringify({ action: "send", to, message }),
      label: `Enviar ${documentLabel} pelo WhatsApp`,
    });
    setBusy(false);
    setResult(response);
  };

  const waLink = to.replace(/\D/g, "").length > 0
    ? `https://wa.me/${to.replace(/\D/g, "").length <= 11 ? `55${to.replace(/\D/g, "")}` : to.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
    : "#";

  return (
    <>
      <div className="no-print flex flex-wrap gap-2">
        <button onClick={() => window.print()} className="btn btn-primary">
          <Printer size={14} /> Imprimir / Salvar PDF
        </button>
        <button onClick={() => setOpen(true)} className="btn btn-ghost">
          <Send size={14} /> Enviar pelo WhatsApp
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={`Compartilhar ${documentLabel}`} subtitle="Envio pela Evolution API (requer integração conectada) ou link direto do WhatsApp.">
        <div className="space-y-3">
          <Field label="Número do destinatário" hint="Somente números cadastrados na empresa devem receber documentos.">
            <input className="input" value={to} onChange={(event) => setTo(event.target.value)} placeholder="5511999999999" />
          </Field>
          <div className="panel-tight max-h-32 overflow-y-auto whitespace-pre-wrap p-2.5 text-[0.72rem] text-slate-300">{message}</div>
          <FormMessage result={result} />
          <div className="flex flex-wrap justify-end gap-2">
            <a href={waLink} target="_blank" rel="noreferrer" className="btn btn-ghost">
              <MessageCircle size={14} /> Abrir WhatsApp Web
            </a>
            <button onClick={() => void send()} disabled={busy || !to} className="btn btn-primary">
              {busy ? "Enviando..." : "Enviar pela Evolution API"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
