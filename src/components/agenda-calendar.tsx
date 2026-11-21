"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatDateBR, isoDate, pad, parseISO, todayISO } from "@/lib/format";

export type CalendarEvent = {
  id: number;
  title: string;
  date: string;
  time: string;
  status: string;
  clientName: string;
  address: string;
  serviceId: number | null;
};

const TONE: Record<string, string> = {
  agendado: "border-amber-300/40 bg-amber-400/15 text-amber-100",
  em_andamento: "border-brand-400/40 bg-brand-500/15 text-brand-100",
  concluido: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
  atrasado: "border-red-400/40 bg-red-500/15 text-red-100",
  cancelado: "border-slate-400/30 bg-slate-500/15 text-slate-200",
};

const WEEK_COLORS = ["blue", "purple", "slate"] as const;

export function AgendaCalendar({ events }: { events: CalendarEvent[] }) {
  const [view, setView] = useState<"dia" | "semana" | "mes">("semana");
  const [cursor, setCursor] = useState(todayISO());

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, [...list].sort((a, b) => a.time.localeCompare(b.time)));
    }
    return map;
  }, [events]);

  const shift = (direction: number) => {
    const base = parseISO(cursor) ?? new Date();
    if (view === "dia") setCursor(addDays(cursor, direction));
    else if (view === "semana") setCursor(addDays(cursor, direction * 7));
    else {
      const next = new Date(base);
      next.setUTCMonth(next.getUTCMonth() + direction * 1);
      setCursor(isoDate(next));
    }
  };

  const monthCells = useMemo(() => {
    const base = parseISO(cursor) ?? new Date();
    const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
    const startOffset = first.getUTCDay();
    const start = new Date(first);
    start.setUTCDate(start.getUTCDate() - startOffset);
    return Array.from({ length: 42 }).map((_, index) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + index);
      const iso = isoDate(date);
      return { iso, day: date.getUTCDate(), inMonth: date.getUTCMonth() === base.getUTCMonth() };
    });
  }, [cursor]);

  const weekDays = useMemo(() => {
    const base = parseISO(cursor) ?? new Date();
    const start = new Date(base);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + index);
      return isoDate(date);
    });
  }, [cursor]);

  const label =
    view === "mes"
      ? (parseISO(cursor) ?? new Date()).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
      : view === "semana"
        ? `${formatDateBR(weekDays[0])} — ${formatDateBR(weekDays[6])}`
        : formatDateBR(cursor);

  const renderEvent = (event: CalendarEvent) => (
    <div key={event.id} className={`rounded-md border px-1.5 py-1 text-[0.62rem] leading-tight ${TONE[event.status] ?? TONE.agendado}`}>
      <p className="truncate font-semibold">{event.time} {event.title}</p>
      <p className="truncate opacity-80">{event.clientName}</p>
    </div>
  );

  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Agenda visual</h2>
          <p className="text-[0.68rem] capitalize text-slate-400">{label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex overflow-hidden rounded-lg border border-white/12">
            {(["dia", "semana", "mes"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setView(option)}
                className={`px-2.5 py-1.5 text-[0.7rem] capitalize ${view === option ? "bg-brand-500/25 text-white" : "text-slate-300 hover:bg-white/5"}`}
              >
                {option}
              </button>
            ))}
          </div>
          <button onClick={() => shift(-1)} className="btn btn-ghost !px-2 !py-1.5"><ChevronLeft size={14} /></button>
          <button onClick={() => setCursor(todayISO())} className="btn btn-ghost !py-1.5 !text-[0.7rem]">Hoje</button>
          <button onClick={() => shift(1)} className="btn btn-ghost !px-2 !py-1.5"><ChevronRight size={14} /></button>
        </div>
      </div>

      {view === "mes" ? (
        <div className="grid grid-cols-7 gap-1">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
            <div key={day} className="pb-1 text-center text-[0.6rem] uppercase tracking-wide text-slate-500">{day}</div>
          ))}
          {monthCells.map((cell) => (
            <button
              key={cell.iso}
              onClick={() => { setCursor(cell.iso); setView("dia"); }}
              className={`min-h-[74px] rounded-lg border p-1 text-left align-top transition hover:border-brand-400/40 ${
                cell.iso === todayISO()
                  ? "border-brand-400/60 bg-brand-500/10"
                  : cell.inMonth
                    ? "border-white/8 bg-white/[0.02]"
                    : "border-white/5 bg-transparent opacity-40"
              }`}
            >
              <span className={`text-[0.65rem] font-semibold ${cell.iso === todayISO() ? "text-brand-200" : "text-slate-400"}`}>{cell.day}</span>
              <div className="mt-0.5 space-y-0.5">
                {(byDate.get(cell.iso) ?? []).slice(0, 2).map(renderEvent)}
                {(byDate.get(cell.iso) ?? []).length > 2 ? (
                  <p className="text-[0.58rem] text-slate-400">+{(byDate.get(cell.iso) ?? []).length - 2} compromisso(s)</p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {view === "semana" ? (
        <div className="grid gap-1.5 sm:grid-cols-7">
          {weekDays.map((day, index) => (
            <div key={day} className={`rounded-lg border p-1.5 ${day === todayISO() ? "border-brand-400/60 bg-brand-500/8" : "border-white/8 bg-white/[0.02]"}`}>
              <p className={`mb-1 text-[0.62rem] font-semibold uppercase tracking-wide ${day === todayISO() ? "text-brand-200" : "text-slate-400"}`}>
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][index]} {pad(Number(day.slice(8, 10)))}
              </p>
              <div className="space-y-1">
                {(byDate.get(day) ?? []).length === 0 ? (
                  <p className="py-2 text-center text-[0.58rem] text-slate-600">—</p>
                ) : (
                  (byDate.get(day) ?? []).map(renderEvent)
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {view === "dia" ? (
        <div className="space-y-1.5">
          {(byDate.get(cursor) ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 py-8 text-center text-xs text-slate-400">
              Nenhum compromisso em {formatDateBR(cursor)}.
            </p>
          ) : (
            (byDate.get(cursor) ?? []).map((event) => (
              <div key={event.id} className={`rounded-lg border p-2.5 ${TONE[event.status] ?? TONE.agendado}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[0.8rem] font-semibold">{event.time} · {event.title}</p>
                  <span className="text-[0.62rem] uppercase tracking-wide">{event.status.replace("_", " ")}</span>
                </div>
                <p className="text-[0.68rem] opacity-80">{event.clientName} {event.address ? `· ${event.address}` : ""}</p>
              </div>
            ))
          )}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-[0.6rem]">
        {Object.entries(TONE).map(([status, tone]) => (
          <span key={status} className={`rounded-full border px-2 py-0.5 ${tone}`}>{status.replace("_", " ")}</span>
        ))}
        <span className="text-slate-500">· {WEEK_COLORS.length > 0 ? "Cores indicam o status do serviço" : ""}</span>
      </div>
    </div>
  );
}
