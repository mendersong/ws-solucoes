"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, MessageCircle, PlugZap, QrCode, RefreshCw, Send, Unplug, Webhook } from "lucide-react";
import { api, type ApiResult } from "@/lib/client";
import { Field, FormMessage } from "@/components/forms";

type Settings = {
  baseUrl: string;
  instanceName: string;
  apiKeyMasked: string;
  webhookSecret: string;
  autoNotifications: boolean;
  status: string;
  qrCode: string | null;
} | null;

const QUICK_COMMANDS = ["saldo", "lucro", "dizimo", "contas", "receber", "agenda", "obras", "atrasadas", "relatorio", "ajuda"];

export function WhatsAppControls({
  settings,
  webhookUrl,
  canManage,
  testPhone,
}: {
  settings: Settings;
  webhookUrl: string;
  canManage: boolean;
  testPhone: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    baseUrl: settings?.baseUrl ?? "",
    apiKey: "",
    instanceName: settings?.instanceName ?? "ws-solucoes",
    webhookSecret: settings?.webhookSecret ?? "",
    autoNotifications: settings?.autoNotifications ?? true,
  });
  const [result, setResult] = useState<ApiResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(settings?.qrCode ?? null);
  const [status, setStatus] = useState(settings?.status ?? "desconectado");
  const [simPhone, setSimPhone] = useState(testPhone);
  const [simMessage, setSimMessage] = useState("saldo");
  const [chat, setChat] = useState<{ role: "user" | "assistant"; text: string }[]>([]);

  const run = async (action: string, payload: Record<string, unknown> = {}, label?: string) => {
    setBusy(action);
    setResult(null);
    const response = await api("/api/whatsapp", {
      method: "POST",
      body: JSON.stringify({ action, ...payload }),
      label: label ?? action,
      queueIfOffline: false,
    });
    setBusy(null);
    setResult(response);
    const data = response.data as Record<string, unknown> | undefined;
    if (action === "connect" && typeof response.qrCode === "string") setQrCode(response.qrCode);
    if (typeof response.status === "string") setStatus(response.status);
    if (action === "disconnect") setQrCode(null);
    if (data && typeof data.qrCode === "string") setQrCode(data.qrCode);
    if (response.ok && ["save_config", "set_webhook"].includes(action)) router.refresh();
    return response;
  };

  const simulate = async () => {
    if (!simMessage.trim()) return;
    setChat((previous) => [...previous, { role: "user", text: simMessage }]);
    setBusy("simulate");
    const response = await api("/api/whatsapp", {
      method: "POST",
      body: JSON.stringify({ action: "simulate", phone: simPhone, message: simMessage }),
      queueIfOffline: false,
    });
    setBusy(null);
    if (response.ok) {
      setChat((previous) => [...previous, { role: "assistant", text: String(response.reply ?? "") }]);
      setResult(null);
    } else {
      setChat((previous) => [...previous, { role: "assistant", text: response.error ?? "Erro ao processar." }]);
      setResult(response);
    }
  };

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="panel space-y-3 p-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><PlugZap size={16} className="text-brand-300" /> Conexão Evolution API</h2>
            <p className="mt-0.5 text-[0.7rem] text-slate-400">As credenciais ficam armazenadas apenas no backend (PostgreSQL) e nunca são exibidas para o navegador.</p>
          </div>
          <span className={`badge ${status === "conectado" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : status === "aguardando" ? "border-amber-300/30 bg-amber-400/10 text-amber-300" : "border-red-400/30 bg-red-500/10 text-red-300"}`}>
            {status}
          </span>
        </div>

        {!settings?.baseUrl ? (
          <div className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-[0.72rem] leading-relaxed text-amber-100">
            <strong>Integração ainda não configurada.</strong> O WS SOLUÇÕES já possui webhook, fila de envio, assistente e envio de mídia
            implementados, mas a conexão real depende de um servidor Evolution API acessível (VPS com Docker) e das credenciais da empresa.
            Enquanto isso, use o simulador ao lado — ele executa exatamente o mesmo mecanismo do webhook.
          </div>
        ) : null}

        <div className="grid gap-2.5 sm:grid-cols-2">
          <Field label="URL da API" hint="Ex.: https://evolution.suaempresa.com.br" className="sm:col-span-2">
            <input className="input" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://..." disabled={!canManage} />
          </Field>
          <Field label="Global API Key / Token" hint={settings?.apiKeyMasked ? `Chave salva: ${settings.apiKeyMasked}` : "Informe a chave global da instância"}>
            <input className="input" type="password" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} placeholder={settings?.apiKeyMasked ? "Manter chave atual" : "Sua API Key"} disabled={!canManage} />
          </Field>
          <Field label="Nome da instância">
            <input className="input" value={form.instanceName} onChange={(event) => setForm({ ...form, instanceName: event.target.value })} placeholder="ws-solucoes" disabled={!canManage} />
          </Field>
          <Field label="Segredo do webhook (opcional)" hint="Enviado no header x-ws-secret para validar eventos.">
            <input className="input" value={form.webhookSecret} onChange={(event) => setForm({ ...form, webhookSecret: event.target.value })} disabled={!canManage} />
          </Field>
          <Field label="Notificações automáticas">
            <select
              className="input"
              value={form.autoNotifications ? "true" : "false"}
              onChange={(event) => setForm({ ...form, autoNotifications: event.target.value === "true" })}
              disabled={!canManage}
            >
              <option value="true">Ativadas</option>
              <option value="false">Desativadas</option>
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void run("save_config", form, "Salvar configuração")}
            disabled={!canManage || busy === "save_config"}
            className="btn btn-primary"
          >
            {busy === "save_config" ? "Salvando..." : "Salvar configuração"}
          </button>
          <button onClick={() => void run("connect")} disabled={!canManage || busy === "connect"} className="btn btn-ghost">
            <QrCode size={14} /> {busy === "connect" ? "Gerando..." : "Gerar QR Code"}
          </button>
          <button onClick={() => void run("status")} disabled={busy === "status"} className="btn btn-ghost">
            <RefreshCw size={14} /> Verificar status
          </button>
          <button onClick={() => void run("set_webhook")} disabled={!canManage || busy === "set_webhook"} className="btn btn-ghost">
            <Webhook size={14} /> Registrar webhook
          </button>
          <button onClick={() => void run("disconnect")} disabled={!canManage || busy === "disconnect"} className="btn btn-danger">
            <Unplug size={14} /> Desconectar
          </button>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-[0.68rem] text-slate-300">
          <p className="font-semibold text-slate-200">Endpoint do webhook</p>
          <code className="break-all text-brand-200">{webhookUrl}</code>
        </div>

        <FormMessage result={result} />

        {qrCode ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code para conectar o WhatsApp" className="h-48 w-48 object-contain" />
            <p className="text-center text-[0.68rem] text-slate-600">
              Abra o WhatsApp no celular › Dispositivos conectados › Conectar dispositivo e leia o código.
            </p>
          </div>
        ) : null}
      </div>

      <div className="panel flex flex-col p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><MessageCircle size={16} className="text-emerald-400" /> Simulador do assistente</h2>
        <p className="mt-0.5 text-[0.7rem] text-slate-400">Testa o mesmo processamento do webhook, com dados reais do banco e confirmação antes de alterar o financeiro.</p>
        <div className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2.5" style={{ maxHeight: 320 }}>
          {chat.length === 0 ? (
            <p className="text-[0.72rem] text-slate-500">Envie um comando para iniciar. Ex.: <span className="text-brand-200">saldo</span>, <span className="text-brand-200">pagar 3</span>.</p>
          ) : (
            chat.map((message, index) => (
              <div key={index} className={`max-w-[92%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-[0.72rem] ${message.role === "user" ? "ml-auto bg-emerald-600/25 text-emerald-50" : "bg-white/8 text-slate-100"}`}>
                {message.text}
              </div>
            ))
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {QUICK_COMMANDS.map((command) => (
            <button key={command} onClick={() => setSimMessage(command)} className="rounded-full border border-white/12 px-2 py-0.5 text-[0.62rem] text-slate-300 hover:bg-white/8">
              {command}
            </button>
          ))}
        </div>
        <div className="mt-2 space-y-2">
          <Field label="Número autorizado">
            <input className="input !py-1.5" value={simPhone} onChange={(event) => setSimPhone(event.target.value)} placeholder="5511999999999" />
          </Field>
          <div className="flex gap-1.5">
            <input
              className="input !py-1.5"
              value={simMessage}
              onChange={(event) => setSimMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void simulate();
              }}
              placeholder="Digite um comando"
            />
            <button onClick={() => void simulate()} disabled={busy === "simulate"} className="btn btn-primary !px-3">
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="panel p-4 lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><BellRing size={16} className="text-amber-300" /> Notificações e fila de envio</h2>
            <p className="mt-0.5 text-[0.7rem] text-slate-400">
              Alertas de vencimento e obras atrasadas entram numa fila com intervalo de 8 segundos entre mensagens para reduzir risco de bloqueio do número.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={async () => {
                setBusy("notify");
                const response = await api("/api/actions/notification", { method: "POST", body: JSON.stringify({ action: "due" }), label: "Gerar alertas" });
                setBusy(null);
                setResult(response);
                router.refresh();
              }}
              disabled={busy === "notify"}
              className="btn btn-ghost"
            >
              {busy === "notify" ? "Gerando..." : "Gerar alertas de vencimento"}
            </button>
            <button
              onClick={async () => {
                setBusy("queue");
                const response = await api("/api/actions/notification", { method: "POST", body: JSON.stringify({ action: "process_queue", limit: 5 }), label: "Processar fila" });
                setBusy(null);
                setResult(response);
                router.refresh();
              }}
              disabled={busy === "queue"}
              className="btn btn-primary"
            >
              {busy === "queue" ? "Processando..." : "Processar fila agora"}
            </button>
          </div>
        </div>
        <div className="mt-2"><FormMessage result={result} /></div>
      </div>
    </div>
  );
}
