"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  FileText,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { WSLogo } from "@/components/logo";
import { SyncStatus } from "@/components/sync-status";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; badge?: number };
type NavGroup = { title: string; items: NavItem[] };

const ICONS = {
  dashboard: LayoutDashboard,
  clients: Users,
  finance: Wallet,
  agenda: CalendarDays,
  services: HardHat,
  employees: Wrench,
  docs: FileText,
  monthly: BarChart3,
  whatsapp: MessageCircle,
  settings: Settings,
};

function navGroups(pending: number): NavGroup[] {
  return [
    {
      title: "Operação",
      items: [
        { href: "/", label: "Dashboard", icon: ICONS.dashboard },
        { href: "/clientes", label: "Clientes", icon: ICONS.clients },
        { href: "/servicos", label: "Serviços e Obras", icon: ICONS.services },
        { href: "/agenda", label: "Agenda", icon: ICONS.agenda },
        { href: "/financeiro", label: "Financeiro", icon: ICONS.finance },
      ],
    },
    {
      title: "Gestão",
      items: [
        { href: "/funcionarios", label: "Funcionários", icon: ICONS.employees },
        { href: "/documentos", label: "Orçamentos e Contratos", icon: ICONS.docs },
        { href: "/resumo-mensal", label: "Resumo Mensal", icon: ICONS.monthly },
      ],
    },
    {
      title: "Sistema",
      items: [
        { href: "/whatsapp", label: "WhatsApp", icon: ICONS.whatsapp, badge: pending },
        { href: "/configuracoes", label: "Configurações", icon: ICONS.settings },
      ],
    },
  ];
}

const PAGE_TITLES: { match: string; title: string; subtitle: string }[] = [
  { match: "/clientes", title: "Clientes", subtitle: "Cadastro, histórico e classificação" },
  { match: "/servicos", title: "Serviços e Obras", subtitle: "Execução, prazos e resultado por obra" },
  { match: "/agenda", title: "Agenda e Prazos", subtitle: "Compromissos, equipes e vencimentos" },
  { match: "/financeiro", title: "Financeiro", subtitle: "Contas, fluxo de caixa e dízimo" },
  { match: "/funcionarios", title: "Funcionários", subtitle: "Equipe, diárias e custos" },
  { match: "/documentos", title: "Orçamentos e Contratos", subtitle: "Documentos profissionais e recibos" },
  { match: "/resumo-mensal", title: "Resumo Mensal", subtitle: "Fechamento por competência e caixa" },
  { match: "/whatsapp", title: "WhatsApp", subtitle: "Evolution API, assistente e notificações" },
  { match: "/configuracoes", title: "Configurações", subtitle: "Usuários, permissões e segurança" },
  { match: "/", title: "Dashboard", subtitle: "Visão geral da operação em tempo real" },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  financeiro: "Financeiro",
  funcionario: "Funcionário",
};

export function AppShell({
  user,
  pending = 0,
  children,
}: {
  user: { name: string; email: string; role: string };
  pending?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const page = PAGE_TITLES.find((item) => item.match !== "/" && pathname.startsWith(item.match)) ?? PAGE_TITLES[PAGE_TITLES.length - 1];
  const groups = navGroups(pending);

  const logout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/8 px-4 py-4">
        <WSLogo size={38} />
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-2 pb-1.5 text-[0.58rem] font-bold uppercase tracking-[0.16em] text-slate-500">{group.title}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className={`nav-link ${isActive(item.href) ? "nav-link-active" : ""}`}>
                    <Icon size={16} className="shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-brand-500/20 px-1.5 py-0.5 text-[0.6rem] font-bold text-brand-200">{item.badge}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/8 p-3">
        <div className="panel-tight flex items-center gap-2 p-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-200">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.76rem] font-semibold text-white">{user.name}</p>
            <p className="truncate text-[0.62rem] text-slate-400">{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
          <button onClick={() => void logout()} disabled={loggingOut} className="text-slate-400 hover:text-red-300" title="Sair">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-[252px]">
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[252px] border-r border-white/8 bg-[#070f1b]/95 backdrop-blur lg:block">
        {sidebar}
      </aside>

      {open ? (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[82%] max-w-[290px] border-r border-white/10 bg-[#070f1b]">
            <button onClick={() => setOpen(false)} className="absolute right-2 top-3 z-10 rounded-lg p-2 text-slate-300" aria-label="Fechar menu">
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <header className="no-print sticky top-0 z-30 border-b border-white/8 bg-[#060d18]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 px-3 py-2.5 sm:px-5">
          <button onClick={() => setOpen(true)} className="btn btn-ghost !px-2 !py-2 lg:hidden" aria-label="Abrir menu">
            <Menu size={17} />
          </button>
          <div className="lg:hidden">
            <WSLogo size={28} withWordmark={false} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[0.9rem] font-semibold text-white sm:text-base">{page.title}</h1>
            <p className="hidden truncate text-[0.68rem] text-slate-400 sm:block">{page.subtitle}</p>
          </div>
          <SyncStatus />
          <Link href="/whatsapp" className="hidden items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[0.68rem] text-slate-300 hover:bg-white/5 sm:flex">
            <MessageCircle size={13} className={pending > 0 ? "text-amber-300" : "text-emerald-400"} />
            Central WhatsApp
          </Link>
          <div className="hidden h-8 w-8 place-items-center rounded-full border border-brand-400/30 bg-brand-500/15 text-[0.68rem] font-bold text-brand-200 sm:grid">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-3 pb-24 pt-4 sm:px-5 lg:pb-10">{children}</main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#070f1b]/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {[
            { href: "/", label: "Início", icon: ICONS.dashboard },
            { href: "/servicos", label: "Obras", icon: ICONS.services },
            { href: "/agenda", label: "Agenda", icon: ICONS.agenda },
            { href: "/financeiro", label: "Caixa", icon: ICONS.finance },
            { href: "/whatsapp", label: "WhatsApp", icon: ICONS.whatsapp },
          ].map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[0.6rem] ${active ? "text-brand-300" : "text-slate-400"}`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
