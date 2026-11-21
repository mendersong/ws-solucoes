import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  FilePlus2,
  HardHat,
  HandCoins,
  Landmark,
  PiggyBank,
  Plus,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Wallet,
  Wrench,
} from "lucide-react";
import { getDashboardData } from "@/lib/queries";
import { formatDateBR, money } from "@/lib/format";
import { Donut, FlowChart, ColumnChart } from "@/components/charts";
import { Badge, Kpi, Panel, PageHeader, SectionTitle, StatusPill } from "@/components/ui";
import { categoryLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS = [
  { href: "/clientes?novo=1", label: "Novo cliente", icon: UserPlus },
  { href: "/documentos?tab=orcamentos&novo=1", label: "Novo orçamento", icon: FilePlus2 },
  { href: "/servicos?novo=1", label: "Novo serviço", icon: HardHat },
  { href: "/agenda?novo=1", label: "Novo agendamento", icon: CalendarPlus },
  { href: "/financeiro?tab=pagar&novo=1", label: "Nova conta a pagar", icon: ReceiptText },
  { href: "/financeiro?tab=receber&novo=1", label: "Novo recebimento", icon: HandCoins },
  { href: "/funcionarios?novo=1", label: "Novo funcionário", icon: Wrench },
];

export default async function DashboardPage() {
  const data = await getDashboardData();
  const profitTone = data.monthProfit >= 0 ? "green" : "red";

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Dashboard · ${data.monthLabel}`}
        subtitle="Indicadores atualizados automaticamente a partir de todos os módulos integrados: financeiro, obras, agenda, dízimo e documentos."
        actions={
          <>
            <Link href="/resumo-mensal" className="btn btn-ghost">
              <Landmark size={14} /> Fechamento do mês
            </Link>
            <Link href="/whatsapp" className="btn btn-primary">
              <Plus size={14} /> Central de comando
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Saldo disponível"
          value={money(data.balance)}
          tone={data.balance >= 0 ? "green" : "red"}
          icon={<Wallet size={17} />}
          hint="Recebimentos − contas pagas − dízimo pago"
        />
        <Kpi
          label="Contas a receber"
          value={money(data.totalReceivable)}
          tone="blue"
          icon={<TrendingUp size={17} />}
          hint="Saldo pendente de serviços contratados"
        />
        <Kpi
          label="Contas a pagar"
          value={money(data.totalPayable)}
          tone="yellow"
          icon={<TrendingDown size={17} />}
          hint="Compromissos ainda não quitados"
        />
        <Kpi
          label="Lucro líquido do mês"
          value={money(data.monthProfit)}
          tone={profitTone}
          icon={<CircleDollarSign size={17} />}
          hint={`Bruto ${money(data.monthGross)} − dízimo ${money(data.monthTithe)}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Dízimo acumulado" value={money(data.titheAccumulated)} tone="purple" icon={<PiggyBank size={16} />} hint={`A pagar ${money(data.tithePending)}`} />
        <Kpi label="Investido em serviços" value={money(data.invested)} tone="slate" icon={<Wrench size={16} />} hint="Despesas por obra" />
        <Kpi label="Em andamento" value={String(data.counts.inProgress)} tone="blue" icon={<Clock size={16} />} hint="Obras em execução" />
        <Kpi label="Concluídos" value={String(data.counts.done)} tone="green" icon={<CheckCircle2 size={16} />} hint="Entregas finalizadas" />
        <Kpi label="Atrasados" value={String(data.counts.late)} tone="red" icon={<AlertTriangle size={16} />} hint="Prazo estourado" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <SectionTitle
            title="Desempenho financeiro"
            subtitle="Entradas e saídas efetivas dos últimos 6 meses (fluxo de caixa)"
            icon={<TrendingUp size={16} />}
            action={
              <Link href="/financeiro?tab=fluxo" className="text-[0.7rem] text-brand-300 hover:underline">
                Ver fluxo
              </Link>
            }
          />
          <FlowChart points={data.flow} />
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/8 pt-3 text-center">
            <div>
              <p className="text-[0.6rem] uppercase tracking-wide text-slate-400">Recebido no mês</p>
              <p className="text-sm font-bold text-emerald-400">{money(data.monthReceived)}</p>
            </div>
            <div>
              <p className="text-[0.6rem] uppercase tracking-wide text-slate-400">Pago no mês</p>
              <p className="text-sm font-bold text-red-400">{money(data.monthPaid)}</p>
            </div>
            <div>
              <p className="text-[0.6rem] uppercase tracking-wide text-slate-400">Despesas do mês</p>
              <p className="text-sm font-bold text-amber-300">{money(data.monthExpenses)}</p>
            </div>
          </div>
        </Panel>

        <Panel>
          <SectionTitle title="Despesas por categoria" subtitle="Custo acumulado das operações" icon={<PiggyBank size={16} />} />
          <Donut
            items={data.expensesByCategory.map((item) => ({ label: categoryLabel(item.category), value: item.total }))}
            centerLabel="Custos"
            centerValue={money(data.invested)}
          />
          <div className="mt-4 border-t border-white/8 pt-3">
            <SectionTitle title="Serviços por status" subtitle={`${data.servicesCount} serviços cadastrados`} />
            <ColumnChart data={data.serviceStatus.map((s) => ({ label: s.status, value: s.total }))} />
          </div>
        </Panel>
      </div>

      <Panel>
        <SectionTitle title="Atalhos rápidos" subtitle="Cadastre sem redigitar: os dados já existentes são reaproveitados." icon={<Plus size={16} />} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-brand-400/40 hover:bg-brand-500/[0.08]"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 text-brand-300 group-hover:bg-brand-500/25">
                  <Icon size={16} />
                </span>
                <span className="text-[0.72rem] font-medium leading-tight text-slate-200">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <SectionTitle
            title="Próximos vencimentos"
            subtitle="Contas a pagar ainda em aberto"
            icon={<ReceiptText size={16} />}
            action={<Link href="/financeiro?tab=pagar" className="text-[0.7rem] text-brand-300 hover:underline">Gerenciar</Link>}
          />
          <div className="space-y-1.5">
            {data.nextDue.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-5 text-center text-xs text-slate-400">
                Nenhuma conta pendente. 👏
              </p>
            ) : (
              data.nextDue.map((payable) => (
                <div key={payable.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[0.78rem] font-medium text-slate-100">{payable.description}</p>
                    <p className="text-[0.65rem] text-slate-400">
                      {formatDateBR(payable.dueDate)} · {categoryLabel(payable.category)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[0.8rem] font-semibold text-slate-100">{money(payable.amount)}</span>
                    <StatusPill status={payable.computedStatus} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <SectionTitle
            title="Próximos agendamentos"
            subtitle="Agenda integrada às obras e equipes"
            icon={<CalendarPlus size={16} />}
            action={<Link href="/agenda" className="text-[0.7rem] text-brand-300 hover:underline">Abrir agenda</Link>}
          />
          <div className="space-y-1.5">
            {data.nextAppointments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-5 text-center text-xs text-slate-400">
                Nenhum agendamento futuro.
              </p>
            ) : (
              data.nextAppointments.map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[0.78rem] font-medium text-slate-100">{appointment.title}</p>
                    <p className="truncate text-[0.65rem] text-slate-400">
                      {appointment.clientName} · {appointment.address ?? "Endereço a confirmar"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[0.72rem] font-semibold text-brand-200">{formatDateBR(appointment.date)}</p>
                    <p className="text-[0.62rem] text-slate-400">{appointment.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.serviceTypes.slice(0, 4).map((type) => (
          <div key={type.type} className="panel-tight p-3.5">
            <p className="text-[0.62rem] uppercase tracking-wide text-slate-400">{type.type}</p>
            <p className="mt-1 text-lg font-bold text-white">{money(type.value)}</p>
            <p className="text-[0.65rem] text-slate-400">{type.total} serviço(s) contratado(s)</p>
          </div>
        ))}
      </div>

      <div className="panel flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <Badge tone="purple"><PiggyBank size={12} /> Dízimo automático</Badge>
          <p className="text-[0.72rem] leading-relaxed text-slate-300">
            10% de cada valor <strong>efetivamente recebido</strong> é reservado automaticamente (inclusive em recebimentos parciais).
            Valores apenas previstos não geram dízimo. Reservado: <strong className="text-amber-300">{money(data.tithePending)}</strong>.
          </p>
        </div>
        <Link href="/financeiro?tab=dizimo" className="btn btn-ghost shrink-0">
          Gerenciar dízimo <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
