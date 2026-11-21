import { desc } from "drizzle-orm";
import { CloudDownload, Database, HardDrive, Lock, Smartphone, WifiOff } from "lucide-react";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { getSession, ROLE_LABEL } from "@/lib/auth";
import { COMPANY } from "@/lib/company";
import { formatDateTimeBR } from "@/lib/format";
import { Badge, EmptyState, Kpi, PageHeader, Panel, SectionTitle } from "@/components/ui";
import { UsersManager } from "@/components/users-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const session = await getSession();
  const isAdmin = session?.role === "admin";
  const [userRows, logRows] = await Promise.all([
    isAdmin ? db.select().from(users).orderBy(users.name) : Promise.resolve([]),
    isAdmin ? db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(40) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Configurações"
        subtitle="Usuários, permissões, segurança, auditoria, backup e funcionamento offline. Aplicação preparada para uso diário em produção."
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <SectionTitle title="Dados da empresa" subtitle="Usados em orçamentos, contratos e recibos" />
          <div className="grid gap-2 text-[0.78rem] sm:grid-cols-2">
            <p><span className="text-slate-500">Razão social:</span> <span className="text-slate-200">{COMPANY.legalName}</span></p>
            <p><span className="text-slate-500">Nome fantasia:</span> <span className="text-slate-200">{COMPANY.name}</span></p>
            <p><span className="text-slate-500">CNPJ:</span> <span className="text-slate-200">{COMPANY.document}</span></p>
            <p><span className="text-slate-500">Telefone:</span> <span className="text-slate-200">{COMPANY.phone}</span></p>
            <p><span className="text-slate-500">E-mail:</span> <span className="text-slate-200">{COMPANY.email}</span></p>
            <p><span className="text-slate-500">Cidade:</span> <span className="text-slate-200">{COMPANY.city}</span></p>
          </div>
          <p className="mt-3 text-[0.68rem] leading-relaxed text-slate-400">
            Os dados legais (CNPJ, endereço e telefone) são parâmetros de implantação em <code className="text-brand-200">src/lib/company.ts</code>.
            Ajuste-os com os dados reais da empresa antes de emitir documentos para clientes.
          </p>
        </Panel>

        <Panel>
          <SectionTitle title="Sessão atual" icon={<Lock size={15} />} />
          <div className="space-y-1 text-[0.78rem]">
            <p className="text-slate-200 font-semibold">{session?.name}</p>
            <p className="text-slate-400">{session?.email}</p>
            <p className="mt-1"><Badge tone={session?.role === "admin" ? "purple" : "blue"}>{session ? ROLE_LABEL[session.role] : ""}</Badge></p>
          </div>
          <div className="mt-3 space-y-1.5 text-[0.7rem] text-slate-400">
            <p className="flex items-center gap-1.5"><Lock size={12} /> Sessão com cookie httpOnly e expiração de 30 dias</p>
            <p className="flex items-center gap-1.5"><Database size={12} /> Senhas com hash scrypt e salt individual</p>
          </div>
        </Panel>
      </div>

      {isAdmin ? (
        <UsersManager
          users={userRows.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone ?? "",
            active: user.active,
            createdAt: user.createdAt.toISOString(),
          }))}
          currentUserId={session?.id ?? 0}
        />
      ) : (
        <Panel>
          <EmptyState title="Gestão de usuários restrita" description="Somente administradores podem criar ou alterar usuários." />
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Perfis de acesso" value="3" tone="blue" hint="Administrador · Financeiro · Funcionário" icon={<Lock size={16} />} />
        <Kpi label="Auditoria" value={String(logRows.length)} tone="purple" hint="Últimos registros" icon={<Database size={16} />} />
        <Kpi label="Offline-first" value="Ativo" tone="green" hint="Fila local + sincronização" icon={<WifiOff size={16} />} />
        <Kpi label="Android / PWA" value="Instalável" tone="slate" hint="Manifest + service worker" icon={<Smartphone size={16} />} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <SectionTitle title="Matriz de permissões" subtitle="Controle aplicado no backend em todas as rotas" />
          <div className="space-y-2 text-[0.74rem]">
            {[
              { role: "Administrador", text: "Acesso completo: financeiro, obras, documentos, WhatsApp, usuários e exclusões." },
              { role: "Financeiro", text: "Contas, recebimentos, dízimo, relatórios, clientes e documentos. Sem acesso a usuários e conexão WhatsApp." },
              { role: "Funcionário", text: "Consulta de obras e agenda. Pode atualizar agendamentos; não executa lançamentos financeiros." },
            ].map((item) => (
              <div key={item.role} className="panel-tight p-2.5">
                <p className="font-semibold text-slate-100">{item.role}</p>
                <p className="text-[0.68rem] text-slate-400">{item.text}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionTitle title="Backup, nuvem e sincronização" subtitle="Preparado para produção" />
          <div className="space-y-2 text-[0.74rem] leading-relaxed text-slate-300">
            <p className="flex items-start gap-2"><CloudDownload size={14} className="mt-0.5 shrink-0 text-brand-300" /> Exporte um backup completo em JSON a qualquer momento.</p>
            <p className="flex items-start gap-2"><HardDrive size={14} className="mt-0.5 shrink-0 text-brand-300" /> No servidor, utilize <code className="text-brand-200">pg_dump</code> diário do PostgreSQL com retenção de 30 dias.</p>
            <p className="flex items-start gap-2"><WifiOff size={14} className="mt-0.5 shrink-0 text-brand-300" /> Sem internet, os lançamentos ficam na fila local do dispositivo e são sincronizados automaticamente ao reconectar.</p>
            <p className="flex items-start gap-2"><Smartphone size={14} className="mt-0.5 shrink-0 text-brand-300" /> Instale no Android pelo menu do navegador (“Adicionar à tela inicial”) para uso em tela cheia.</p>
          </div>
          {isAdmin ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="/api/backup" download className="btn btn-primary"><CloudDownload size={14} /> Baixar backup JSON</a>
            </div>
          ) : (
            <p className="mt-3 text-[0.7rem] text-amber-200">Backup disponível apenas para administradores.</p>
          )}
        </Panel>
      </div>

      {isAdmin ? (
        <Panel>
          <SectionTitle title="Registro de auditoria" subtitle="Histórico de alterações com usuário, entidade e detalhes" />
          {logRows.length === 0 ? (
            <EmptyState title="Nenhum registro ainda" />
          ) : (
            <div className="table-wrap max-h-[360px] overflow-y-auto">
              <table className="data-table">
                <thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th className="hidden sm:table-cell">Detalhes</th></tr></thead>
                <tbody>
                  {logRows.map((log) => (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap text-slate-400">{formatDateTimeBR(log.createdAt)}</td>
                      <td className="text-slate-200">{log.userName ?? "sistema"}</td>
                      <td><Badge tone="blue">{log.action.replace(/_/g, " ")}</Badge></td>
                      <td className="text-slate-300">{log.entity ?? "—"}{log.entityId ? ` #${log.entityId}` : ""}</td>
                      <td className="hidden max-w-[280px] truncate text-[0.68rem] text-slate-500 sm:table-cell">{JSON.stringify(log.details ?? {})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      <Panel>
        <SectionTitle title="Requisitos de produção" subtitle="Checklist de implantação" />
        <ul className="list-disc space-y-1 pl-5 text-[0.72rem] leading-relaxed text-slate-300">
          <li>Banco PostgreSQL em nuvem com backup automático e SSL habilitado.</li>
          <li>Variáveis de ambiente: <code className="text-brand-200">DATABASE_URL</code>, <code className="text-brand-200">CRON_SECRET</code> e credenciais da Evolution API cadastradas no painel.</li>
          <li>HTTPS obrigatório para instalação do PWA e para o webhook da Evolution API.</li>
          <li>Servidor Evolution API em VPS com Docker; QR Code lido pelo celular da empresa.</li>
          <li>Notificações push via Firebase Cloud Messaging podem ser adicionadas com as credenciais do projeto Android.</li>
          <li>Testar a integração em instância de desenvolvimento antes de publicar.</li>
        </ul>
      </Panel>
    </div>
  );
}
