import { compactMoney, money } from "@/lib/format";

export const CHART_COLORS = ["#4AA8FF", "#22C55E", "#F59E0B", "#EF4444", "#A78BFA", "#06B6D4", "#F472B6", "#94A3B8"];

export function FlowChart({ points }: { points: { label: string; income: number; outcome: number }[] }) {
  const max = Math.max(...points.flatMap((p) => [p.income, p.outcome]), 1);
  const height = 150;
  const width = 100;
  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-[0.68rem] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-brand-400" /> Entradas</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-400" /> Saídas</span>
      </div>
      <div className="flex items-end gap-2" style={{ height }}>
        {points.map((point) => {
          const incomeH = Math.max((point.income / max) * 100, point.income > 0 ? 3 : 0);
          const outcomeH = Math.max((point.outcome / max) * 100, point.outcome > 0 ? 3 : 0);
          const result = point.income - point.outcome;
          return (
            <div key={point.label} className="group flex h-full flex-1 flex-col justify-end gap-1">
              <div className="flex h-full items-end justify-center gap-[3px]">
                <div
                  className="w-1/3 min-w-[6px] rounded-t bg-gradient-to-t from-brand-600 to-brand-300"
                  style={{ height: `${incomeH}%` }}
                  title={`Entradas ${money(point.income)}`}
                />
                <div
                  className="w-1/3 min-w-[6px] rounded-t bg-gradient-to-t from-red-700 to-red-400"
                  style={{ height: `${outcomeH}%` }}
                  title={`Saídas ${money(point.outcome)}`}
                />
              </div>
              <div className="text-center">
                <p className="text-[0.6rem] uppercase tracking-wide text-slate-400">{point.label}</p>
                <p className={`text-[0.6rem] font-semibold ${result >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {compactMoney(result)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Donut({
  items,
  centerLabel,
  centerValue,
}: {
  items: { label: string; value: number }[];
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const withColors = items.map((item, index) => ({ ...item, color: CHART_COLORS[index % CHART_COLORS.length] }));
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative h-[122px] w-[122px] shrink-0">
        <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
          <circle cx="55" cy="55" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="13" />
          {total > 0 &&
            withColors.map((item) => {
              const length = (item.value / total) * circumference;
              const dash = `${Math.max(length - 2, 0)} ${circumference - Math.max(length - 2, 0)}`;
              const element = (
                <circle
                  key={item.label}
                  cx="55"
                  cy="55"
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="13"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                >
                  <title>{`${item.label}: ${money(item.value)}`}</title>
                </circle>
              );
              offset += length;
              return element;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[0.55rem] uppercase tracking-wider text-slate-400">{centerLabel ?? "Total"}</span>
          <span className="text-sm font-bold text-white">{centerValue ?? compactMoney(total)}</span>
        </div>
      </div>
      <ul className="min-w-[140px] flex-1 space-y-1.5">
        {withColors.slice(0, 6).map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-2 text-[0.72rem]">
            <span className="flex items-center gap-1.5 truncate text-slate-300">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 font-medium text-slate-200">{compactMoney(item.value)}</span>
          </li>
        ))}
        {items.length === 0 ? <li className="text-xs text-slate-500">Sem dados no período.</li> : null}
      </ul>
    </div>
  );
}

export function ColumnChart({
  data,
  colors = ["#4AA8FF", "#22C55E", "#F59E0B", "#EF4444"],
}: {
  data: { label: string; value: number }[];
  colors?: string[];
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2.5">
      {data.map((item, index) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-[0.72rem]">
            <span className="text-slate-300">{item.label}</span>
            <span className="font-semibold text-slate-200">{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/6">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.value / max) * 100}%`, background: colors[index % colors.length] }}
            />
          </div>
        </div>
      ))}
      {data.length === 0 ? <p className="text-xs text-slate-500">Sem dados.</p> : null}
    </div>
  );
}

export function Sparkline({ values, color = "#4AA8FF" }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 30 - ((value - min) / (max - min || 1)) * 28;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-8 w-full">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
