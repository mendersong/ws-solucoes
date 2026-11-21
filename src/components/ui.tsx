import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleDollarSign, Clock, MinusCircle } from "lucide-react";
import type { Deadline } from "@/lib/finance";
import { money } from "@/lib/format";

export const TONES = {
  green: "bg-emerald-500/12 text-emerald-300 border-emerald-400/30",
  red: "bg-red-500/12 text-red-300 border-red-400/30",
  yellow: "bg-amber-400/12 text-amber-300 border-amber-300/30",
  blue: "bg-brand-500/12 text-brand-300 border-brand-400/30",
  slate: "bg-slate-500/12 text-slate-300 border-slate-400/25",
  purple: "bg-violet-500/12 text-violet-300 border-violet-400/30",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`badge ${TONES[tone]}`}>{children}</span>;
}

export function Panel({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <section className={`panel ${padded ? "p-4 sm:p-5" : ""} ${className}`}>{children}</section>;
}

export function SectionTitle({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-brand-300">{icon}</span> : null}
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white sm:text-[0.95rem]">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "blue",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "green" | "red" | "yellow" | "blue" | "slate" | "purple";
  icon?: ReactNode;
}) {
  const accent: Record<string, string> = {
    green: "text-emerald-400",
    red: "text-red-400",
    yellow: "text-amber-300",
    blue: "text-brand-300",
    slate: "text-slate-200",
    purple: "text-violet-300",
  };
  const ring: Record<string, string> = {
    green: "from-emerald-500/18",
    red: "from-red-500/18",
    yellow: "from-amber-400/18",
    blue: "from-brand-500/20",
    slate: "from-slate-400/12",
    purple: "from-violet-500/18",
  };
  return (
    <div className={`panel relative overflow-hidden p-4`}>
      <div className={`pointer-events-none absolute inset-x-0 -top-16 h-24 bg-gradient-to-b ${ring[tone]} to-transparent blur-xl`} />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[0.63rem] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
        <span className={accent[tone]}>{icon}</span>
      </div>
      <p className={`kpi-value relative mt-1.5 ${accent[tone]}`}>{value}</p>
      {hint ? <p className="relative mt-1 text-[0.7rem] leading-snug text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/12 bg-white/[0.015] px-4 py-8 text-center">
      <MinusCircle className="text-slate-500" size={22} />
      <p className="text-sm font-medium text-slate-200">{title}</p>
      {description ? <p className="max-w-md text-xs text-slate-400">{description}</p> : null}
      {action}
    </div>
  );
}

export function DeadlineBadge({ deadline }: { deadline: Deadline }) {
  const icon =
    deadline.tone === "green" ? <CheckCircle2 size={12} /> : deadline.tone === "red" ? <AlertTriangle size={12} /> : <Clock size={12} />;
  return (
    <Badge tone={deadline.tone}>
      {icon}
      {deadline.label}
    </Badge>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: Tone }> = {
    agendado: { label: "Agendado", tone: "yellow" },
    em_andamento: { label: "Em andamento", tone: "blue" },
    concluido: { label: "Concluído", tone: "green" },
    atrasado: { label: "Atrasado", tone: "red" },
    cancelado: { label: "Cancelado", tone: "slate" },
    pendente: { label: "Pendente", tone: "yellow" },
    parcial: { label: "Parcial", tone: "blue" },
    recebido: { label: "Recebido", tone: "green" },
    pago: { label: "Pago", tone: "green" },
    reservado: { label: "Reservado", tone: "yellow" },
    aprovado: { label: "Aprovado", tone: "green" },
    enviado: { label: "Enviado", tone: "blue" },
    rascunho: { label: "Rascunho", tone: "slate" },
    recusado: { label: "Recusado", tone: "red" },
    ativo: { label: "Ativo", tone: "green" },
    fila: { label: "Na fila", tone: "yellow" },
    enviado_wa: { label: "Enviado", tone: "green" },
    erro: { label: "Erro", tone: "red" },
    bloqueado: { label: "Bloqueado", tone: "red" },
  };
  const found = map[status] ?? { label: status.replace(/_/g, " "), tone: "slate" as Tone };
  return <Badge tone={found.tone}>{found.label}</Badge>;
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-300" title={`Classificação ${value} de 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={index < value ? "opacity-100" : "opacity-25"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function MoneyText({ value, tone = "neutral" }: { value: number; tone?: "neutral" | "positive" | "negative" }) {
  const color = tone === "positive" ? "text-emerald-400" : tone === "negative" ? "text-red-400" : "text-slate-100";
  return <span className={`font-semibold tabular-nums ${color}`}>{money(value)}</span>;
}

export function ResultBadge({ value }: { value: number }) {
  if (value > 0.004) return <Badge tone="green"><CircleDollarSign size={12} /> Lucro</Badge>;
  if (value < -0.004) return <Badge tone="red"><AlertTriangle size={12} /> Prejuízo</Badge>;
  return <Badge tone="slate"><MinusCircle size={12} /> Empate</Badge>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-[0.8rem]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function InfoLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-1.5 last:border-0">
      <span className="text-[0.72rem] uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-right text-[0.8rem] font-medium text-slate-100">{value}</span>
    </div>
  );
}

export function Progress({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "red" | "yellow" }) {
  const bar: Record<string, string> = {
    blue: "bg-brand-400",
    green: "bg-emerald-400",
    red: "bg-red-400",
    yellow: "bg-amber-300",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
      <div className={`h-full rounded-full ${bar[tone]}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}
