import { db } from "@/db";
import { appointments, clients, services } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getFormOptions } from "@/lib/queries";
import { addDays, formatDateBR, money, todayISO } from "@/lib/format";
import { effectiveServiceStatus, serviceDeadline } from "@/lib/finance";
import { Badge, DeadlineBadge, Kpi, PageHeader, Panel, SectionTitle } from "@/components/ui";
import { CrudTable } from "@/components/crud-table";
import { AgendaCalendar } from "@/components/agenda-calendar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda e Prazos" };

export default async function AgendaPage() {
  const [user, options, appointmentRows, clientRows, serviceRows] = await Promise.all([
    getSession(),
    getFormOptions(),
    db.select().from(appointments),
    db.select().from(clients),
    db.select().from(services),
  ]);
  const clientById = new Map(clientRows.map((c) => [c.id, c]));
  const canWrite = user?.role !== "funcionario";

  const events = appointmentRows.map((appointment) => {
    const service = appointment.serviceId ? serviceRows.find((s) => s.id === appointment.serviceId) : undefined;
    return {
      id: appointment.id,
      title: appointment.title,
      date: appointment.date,
      time: appointment.time,
      status: service ? effectiveServiceStatus(service) : appointment.status,
      clientName: appointment.clientId ? clientById.get(appointment.clientId)?.name ?? "—" : "—",
      address: appointment.address ?? "",
      serviceId: appointment.serviceId,
    };
  });

  const today = todayISO();
  const nextWeek = addDays(today, 7);
  const upcoming = appointmentRows.filter((a) => a.date >= today && a.date <= nextWeek);
  const lateServices = serviceRows.filter((s) => effectiveServiceStatus(s) === "atrasado");
  const dueSoonServices = serviceRows.filter(
    (s) => s.endDate && s.endDate >= today && s.endDate <= addDays(today, 3) && s.status !== "concluido",
  );

  const rows = appointmentRows.map((appointment) => ({
    id: appointment.id,
    clientId: appointment.clientId ?? "",
    serviceId: appointment.serviceId ?? "",
    title: appointment.title,
    clientName: appointment.clientId ? clientById.get(appointment.clientId)?.name ?? "—" : "—",
    date: appointment.date,
    time: appointment.time,
    days: appointment.days,
    plannedEndDate: appointment.plannedEndDate ?? "",
    status: appointment.status,
    address: appointment.address ?? "",
    notes: appointment.notes ?? "",
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Agenda e Prazos"
        subtitle="Compromissos com cliente, endereço, serviço, equipe e prazo. O status das obras é recalculado automaticamente conforme as datas."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Agendamentos (7 dias)" value={String(upcoming.length)} tone="blue" hint="Próximos compromissos" />
        <Kpi label="Obras atrasadas" value={String(lateServices.length)} tone={lateServices.length ? "red" : "green"} />
        <Kpi label="Vencem em 3 dias" value={String(dueSoonServices.length)} tone="yellow" hint="Prazos de execução" />
        <Kpi label="Total de compromissos" value={String(appointmentRows.length)} tone="slate" />
      </div>

      <AgendaCalendar events={events} />

      <CrudTable
        endpoint="appointments"
        title="Compromissos"
        subtitle="Agendamentos vinculados a clientes e obras"
        rows={rows}
        canWrite={canWrite}
        searchKeys={["title", "clientName", "address"]}
        createLabel="Novo agendamento"
        defaults={{ date: today, time: "08:00" }}
        columns={[
          { key: "date", label: "Data", format: "date" },
          { key: "time", label: "Hora" },
          { key: "title", label: "Compromisso" },
          { key: "clientName", label: "Cliente", hideOnMobile: true },
          { key: "address", label: "Endereço", hideOnMobile: true },
          { key: "days", label: "Dias", format: "number" },
          { key: "plannedEndDate", label: "Término", format: "date", hideOnMobile: true },
          { key: "status", label: "Status", format: "status" },
        ]}
        fields={[
          { key: "title", label: "Título do compromisso", required: true, span: 2 },
          {
            key: "clientId",
            label: "Cliente",
            type: "select",
            options: options.clients.map((client) => ({ value: String(client.id), label: client.name })),
          },
          {
            key: "serviceId",
            label: "Serviço relacionado",
            type: "select",
            options: options.services.map((service) => ({ value: String(service.id), label: `${service.code} — ${service.title}` })),
          },
          { key: "address", label: "Endereço", span: 2 },
          { key: "date", label: "Data de início", type: "date", required: true },
          { key: "time", label: "Horário", type: "time" },
          { key: "days", label: "Dias previstos", type: "number", defaultValue: "1" },
          { key: "plannedEndDate", label: "Data prevista de término", type: "date" },
          {
            key: "status",
            label: "Status",
            type: "select",
            defaultValue: "agendado",
            options: [
              { value: "agendado", label: "Agendado" },
              { value: "em_andamento", label: "Em andamento" },
              { value: "concluido", label: "Concluído" },
              { value: "cancelado", label: "Cancelado" },
            ],
          },
          { key: "notes", label: "Observações", type: "textarea", span: 2 },
        ]}
      />

      <Panel>
        <SectionTitle title="Prazos críticos" subtitle="Obras fora do prazo ou vencendo nos próximos dias" />
        <div className="space-y-1.5">
          {[...lateServices, ...dueSoonServices].length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 py-5 text-center text-xs text-slate-400">Nenhum prazo crítico. Tudo em dia! ✅</p>
          ) : (
            [...lateServices, ...dueSoonServices].map((service) => {
              const deadline = serviceDeadline(service);
              return (
                <div key={service.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[0.78rem] font-medium text-slate-100">{service.code} · {service.title}</p>
                    <p className="text-[0.65rem] text-slate-400">Prazo {formatDateBR(service.endDate)} · {money(service.contractedValue)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={service.status === "em_andamento" ? "blue" : "yellow"}>{service.status.replace("_", " ")}</Badge>
                    <DeadlineBadge deadline={deadline} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Panel>
    </div>
  );
}
