import { headers } from "next/headers";
import { AlertTriangle, MessageCircle, ShieldCheck, Timer, Webhook } from "lucide-react";
import { getWhatsAppPanel } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { formatDateTimeBR } from "@/lib/format";
import { Badge, Kpi, PageHeader, Panel, SectionTitle, StatusPill, EmptyState } from "@/components/ui";
import { CrudTable } from "@/components/crud-table";
import { WhatsAppControls } from "@/components/whatsapp-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "WhatsApp" };

export default async function WhatsAppPage() {
  const [user, panel, headerList] = await Promise.all([getSession(), getWhatsAppPanel(), headers()]);
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const webhookUrl = `${proto}://${host}/api/whatsapp/webhook`;
  const canManage = user?.role === "admin";

  const settings = panel.settings
    ? {
        baseUrl: panel.settings.baseUrl ?? "",
        instanceName: panel.settings.instanceName ?? "",
        apiKeyMasked: panel.settings.apiKey ? `••••${panel.settings.apiKey.slice(-4)}` : "",
        webhookSecret: panel.settings.webhookSecret ?? "",
        autoNotifications: panel.settings.autoNotifications,
        status: panel.settings.status,
        qrCode: panel.settings.qrCode,
      }
    : null;

  const pendingQueue = panel.queue.filter((item) => item.status === "fila").length;
  const testPhone = panel.admins[0]?.phone ?? "";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Central WhatsApp · Evolution API"
        subtitle="Integração open-source auto-hospedada (sem custo por mensagem), com webhook, assistente administrativo, notificações e envio de documentos."
        actions={
          <Badge tone={panel.connected ? "green" : panel.configured ? "yellow" : "red"}>
            {panel.connected ? "Conectado" : panel.configured ? panel.settings?.status ?? "Aguardando" : "Não configurado"}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Status da conexão" value={panel.connected ? "Online" : panel.configured ? "Pendente" : "Offline"} tone={panel.connected ? "green" : panel.configured ? "yellow" : "red"} icon={<MessageCircle size={16} />} />
        <Kpi label="Números autorizados" value={String(panel.admins.filter((admin) => admin.active).length)} tone="blue" hint="Filtro rígido no webhook" icon={<ShieldCheck size={16} />} />
        <Kpi label="Mensagens na fila" value={String(pendingQueue)} tone={pendingQueue ? "yellow" : "green"} icon={<Timer size={16} />} hint="Intervalo de segurança de 8s" />
        <Kpi label="Mensagens registradas" value={String(panel.messages.length)} tone="slate" hint="Histórico de auditoria" icon={<Webhook size={16} />} />
      </div>

      {!panel.configured ? (
        <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-[0.76rem] leading-relaxed text-amber-100">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} /> Integração pendente de credenciais</p>
          <p className="mt-1">
            Para conectar de verdade é necessário um servidor Evolution API (Docker/VPS) e o QR Code lido no celular da empresa.
            Nada aqui é simulado como “concluído”: o assistente, o webhook e a fila estão implementados e podem ser testados no simulador abaixo.
            O envio real só ocorre quando a URL, a API Key e a instância estiverem configuradas e o status estiver <strong>conectado</strong>.
          </p>
        </div>
      ) : null}

      <WhatsAppControls settings={settings} webhookUrl={webhookUrl} canManage={canManage} testPhone={testPhone} />

      <CrudTable
        endpoint="whatsappAdmins"
        title="Números autorizados"
        subtitle="Somente estes números podem consultar dados financeiros ou executar comandos pelo WhatsApp"
        rows={panel.admins.map((admin) => ({
          id: admin.id,
          name: admin.name,
          phone: admin.phone,
          active: admin.active ? "ativo" : "inativo",
          createdAt: admin.createdAt.toISOString(),
        }))}
        canWrite={canManage}
        searchKeys={["name", "phone"]}
        createLabel="Autorizar número"
        emptyText="Nenhum número autorizado"
        columns={[
          { key: "name", label: "Responsável" },
          { key: "phone", label: "Número (com DDI)" },
          { key: "active", label: "Situação", format: "status" },
          { key: "createdAt", label: "Desde", format: "datetime", hideOnMobile: true },
        ]}
        fields={[
          { key: "name", label: "Nome do responsável", required: true },
          { key: "phone", label: "Número (ex.: 5511999999999)", required: true },
          {
            key: "active",
            label: "Situação",
            type: "select",
            defaultValue: "true",
            options: [
              { value: "true", label: "Ativo" },
              { value: "false", label: "Inativo" },
            ],
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <SectionTitle title="Fila de envio" subtitle="Mensagens automáticas aguardando ou já enviadas" />
          {panel.queue.length === 0 ? (
            <EmptyState title="Fila vazia" description="Gere alertas de vencimento para enfileirar mensagens." />
          ) : (
            <div className="max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
              {panel.queue.map((item) => (
                <div key={item.id} className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.72rem] font-medium text-slate-200">{item.toPhone}</span>
                    <StatusPill status={item.status} />
                  </div>
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[0.66rem] text-slate-400">{item.body}</p>
                  <p className="mt-0.5 text-[0.6rem] text-slate-500">
                    Envio previsto: {formatDateTimeBR(item.sendAfter)} · tentativas {item.attempts}
                    {item.error ? ` · erro: ${item.error}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <SectionTitle title="Histórico de mensagens" subtitle="Recebidas, enviadas, simuladas e bloqueadas" />
          {panel.messages.length === 0 ? (
            <EmptyState title="Nenhuma mensagem registrada" description="Use o simulador para validar o assistente." />
          ) : (
            <div className="max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
              {panel.messages.map((message) => (
                <div key={message.id} className={`rounded-lg border px-3 py-2 ${message.direction === "in" ? "border-white/8 bg-white/[0.02]" : "border-brand-400/20 bg-brand-500/[0.06]"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.68rem] font-semibold text-slate-300">
                      {message.direction === "in" ? "← recebida" : "→ enviada"} · {message.remoteJid}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {message.intent ? <Badge tone="slate">{message.intent}</Badge> : null}
                      <StatusPill status={message.status} />
                    </div>
                  </div>
                  <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-[0.66rem] text-slate-400">{message.body}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <SectionTitle title="Arquitetura da integração" subtitle="O que está implementado e o que depende de infraestrutura externa" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Webhook em tempo real", text: "Endpoint /api/whatsapp/webhook recebe MESSAGES_UPSERT e CONNECTION_UPDATE, valida o segredo e filtra números autorizados." },
            { title: "Assistente administrativo", text: "Consultas de saldo, lucro, dízimo, contas, agenda, obras e relatório. Alterações exigem CONFIRMAR + código." },
            { title: "Notificações automáticas", text: "Alertas de vencimento e obras atrasadas entram na fila. Endpoint /api/actions/notification?secret=… para cron externo." },
            { title: "Envio de documentos", text: "sendMedia da Evolution API envia orçamentos, contratos, recibos e relatórios em PDF por link público." },
            { title: "Segurança", text: "API Key somente no backend, webhook com segredo, lista de números autorizados, registro de auditoria e respostas silenciosas." },
            { title: "Anti-bloqueio", text: "Fila com intervalo de 8 segundos entre mensagens, limite por execução e controle de tentativas/erros." },
          ].map((item) => (
            <div key={item.title} className="panel-tight p-3">
              <p className="text-[0.78rem] font-semibold text-slate-100">{item.title}</p>
              <p className="mt-1 text-[0.7rem] leading-relaxed text-slate-400">{item.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-[0.7rem] leading-relaxed text-slate-300">
          <p className="font-semibold text-slate-200">Hospedagem sugerida (Evolution API)</p>
          <p>VPS com Docker (Contabo, Hetzner, DigitalOcean ou Railway), PostgreSQL próprio e variáveis AUTHENTICATION_API_KEY e DATABASE_CONNECTION_URI. Sem custo por mensagem; use um número com histórico real (aquecido) e evite disparos em massa.</p>
          <p className="mt-1.5 font-semibold text-slate-200">Cron de notificações</p>
          <p>Agende <code className="text-brand-200">GET {proto}://{host}/api/actions/notification?secret=SEU_SEGREDO</code> a cada hora no servidor para gerar e enviar alertas automaticamente.</p>
        </div>
      </Panel>
    </div>
  );
}
