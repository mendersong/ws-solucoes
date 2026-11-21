"use client";

import { useEffect, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2, Printer, X } from "lucide-react";
import type { ApiResult } from "@/lib/client";

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label ? <span className="label">{label}</span> : null}
      {children}
      {hint ? <span className="mt-1 block text-[0.68rem] leading-snug text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function FormMessage({ result }: { result: ApiResult | null }) {
  if (!result) return null;
  if (result.error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[0.76rem] text-red-200">
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        <span>{result.error}</span>
      </div>
    );
  }
  const message = result.message ?? (result.queued ? "Salvo offline." : "Operação concluída com sucesso.");
  return (
    <div className="flex items-start gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[0.76rem] text-emerald-200">
      <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-3 py-6 backdrop-blur-sm sm:py-10">
      <div
        className={`panel w-full ${wide ? "max-w-4xl" : "max-w-2xl"} animate-[fadeIn_.15s_ease-out] p-0`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[0.72rem] text-slate-400">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost !px-2 !py-1.5" aria-label="Fechar">
            <X size={15} />
          </button>
        </div>
        <div className="px-4 py-4 sm:px-5">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-300">
      <Loader2 size={14} className="animate-spin" />
      {label ?? "Processando..."}
    </span>
  );
}

export function PrintButton({ label = "Imprimir / PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-ghost">
      <Printer size={14} /> {label}
    </button>
  );
}

export function ActionButton({
  onClick,
  loading,
  children,
  className = "btn-primary",
  type = "button",
  disabled,
}: {
  onClick?: () => void;
  loading?: boolean;
  children: ReactNode;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button type={type} onClick={onClick} disabled={loading || disabled} className={`btn ${className}`}>
      {loading ? <Loader2 size={14} className="animate-spin" /> : null}
      {children}
    </button>
  );
}
