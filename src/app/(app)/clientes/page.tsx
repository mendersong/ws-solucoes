import { db } from "@/db";
import { clients, payments, receivables, services } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { toNum } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { CrudTable } from "@/components/crud-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clientes" };

export default async function ClientsPage() {
  const user = await getSession();
  const [clientRows, serviceRows, receivableRows, paymentRows] = await Promise.all([
    db.select().from(clients).orderBy(clients.name),
    db.select().from(services),
    db.select().from(receivables),
    db.select().from(payments),
  ]);

  const rows = clientRows.map((client) => {
    const clientServices = serviceRows.filter((service) => service.clientId === client.id);
    const received = paymentRows.filter((p) => p.clientId === client.id).reduce((sum, p) => sum + toNum(p.amount), 0);
    const pending = receivableRows
      .filter((r) => r.clientId === client.id)
      .reduce((sum, r) => sum + Math.max(toNum(r.contractedAmount) - toNum(r.receivedAmount), 0), 0);
    return {
      id: client.id,
      name: client.name,
      phone: client.phone ?? "",
      whatsapp: client.whatsapp ?? "",
      doc: client.doc ?? "",
      address: client.address ?? "",
      city: client.city ?? "",
      state: client.state ?? "",
      notes: client.notes ?? "",
      rating: client.rating,
      servicesCount: clientServices.length,
      contracted: clientServices.reduce((sum, service) => sum + toNum(service.contractedValue), 0),
      received,
      pending,
    };
  });

  const canWrite = user?.role !== "funcionario";

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Cadastro único compartilhado por obras, orçamentos, contratos, recebimentos e agenda. Clique no nome para abrir o histórico completo."
      />
      <CrudTable
        endpoint="clients"
        title="Carteira de clientes"
        subtitle={`${clientRows.length} cliente(s) cadastrado(s)`}
        rows={rows}
        canWrite={canWrite}
        detailPath="/clientes"
        searchKeys={["name", "phone", "city", "doc"]}
        createLabel="Novo cliente"
        emptyText="Nenhum cliente cadastrado"
        columns={[
          { key: "name", label: "Cliente" },
          { key: "phone", label: "Telefone" },
          { key: "city", label: "Cidade", hideOnMobile: true },
          { key: "servicesCount", label: "Obras", format: "number" },
          { key: "contracted", label: "Contratado", format: "money", hideOnMobile: true },
          { key: "received", label: "Recebido", format: "money" },
          { key: "pending", label: "Pendente", format: "money", hideOnMobile: true },
          { key: "rating", label: "Avaliação", format: "rating" },
        ]}
        fields={[
          { key: "name", label: "Nome / Razão social", required: true, span: 2 },
          { key: "phone", label: "Telefone", type: "tel" },
          { key: "whatsapp", label: "WhatsApp", type: "tel", hint: "Usado nos envios e cobranças" },
          { key: "doc", label: "CPF / CNPJ (opcional)" },
          { key: "address", label: "Endereço completo", span: 2 },
          { key: "city", label: "Cidade" },
          { key: "state", label: "Estado" },
          {
            key: "rating",
            label: "Classificação",
            type: "select",
            defaultValue: "3",
            options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${"★".repeat(n)} (${n})` })),
          },
          { key: "notes", label: "Observações", type: "textarea", span: 2 },
        ]}
      />
    </div>
  );
}
