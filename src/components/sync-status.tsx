"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudOff, Cloud, RefreshCw } from "lucide-react";
import { flushQueue, queueCount } from "@/lib/client";

export function SyncStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => setPending(queueCount()), []);

  const sync = useCallback(async () => {
    if (queueCount() === 0) return;
    setSyncing(true);
    const result = await flushQueue();
    setSyncing(false);
    refresh();
    setMessage(
      result.synced > 0
        ? `${result.synced} lançamento(s) sincronizado(s).`
        : result.remaining > 0
          ? "Não foi possível sincronizar agora."
          : "Fila processada.",
    );
    window.setTimeout(() => setMessage(null), 4000);
  }, [refresh]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh();
    const onOnline = () => {
      setOnline(true);
      void sync();
    };
    const onOffline = () => setOnline(false);
    const onQueue = () => refresh();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("ws-queue-updated", onQueue);
    const timer = window.setInterval(() => {
      if (navigator.onLine && queueCount() > 0) void sync();
    }, 60_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("ws-queue-updated", onQueue);
      window.clearInterval(timer);
    };
  }, [refresh, sync]);

  return (
    <div className="flex items-center gap-2">
      {message ? <span className="hidden text-[0.68rem] text-slate-400 sm:inline">{message}</span> : null}
      {pending > 0 ? (
        <button onClick={() => void sync()} className="btn btn-ghost !py-1.5 !text-[0.7rem]" title="Sincronizar lançamentos offline">
          {syncing ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {pending} pendente{pending > 1 ? "s" : ""}
        </button>
      ) : (
        <span
          className={`badge ${online ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-amber-300/30 bg-amber-400/10 text-amber-300"}`}
          title={online ? "Conectado à nuvem e sincronizado" : "Modo offline: os lançamentos ficam guardados no dispositivo"}
        >
          {online ? <Cloud size={11} /> : <CloudOff size={11} />}
          {online ? "Sincronizado" : "Offline"}
        </span>
      )}
    </div>
  );
}
