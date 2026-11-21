import { db } from "@/db";
import { employees, serviceEmployees, services } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { toNum } from "@/lib/format";
import { PageHeader, Panel, SectionTitle } from "@/components/ui";
import { CrudTable } from "@/components/crud-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Funcionários" };

export default async function EmployeesPage() {
  const user = await getSession();
  const [employeeRows, assignmentRows, serviceRows] = await Promise.all([
    db.select().from(employees).orderBy(employees.name),
    db.select().from(serviceEmployees),
    db.select().from(services),
  ]);
  const serviceById = new Map(serviceRows.map((s) => [s.id, s]));

  const rows = employeeRows.map((employee) => {
    const assignments = assignmentRows.filter((a) => a.employeeId === employee.id);
    const cost = assignments.reduce((sum, a) => sum + toNum(a.dailyRate) * a.days, 0);
    const currentServices = assignments.filter((a) => {
      const service = serviceById.get(a.serviceId);
      return service && !["concluido", "cancelado"].includes(service.status);
    }).length;
    return {
      id: employee.id,
      name: employee.name,
      phone: employee.phone ?? "",
      role: employee.role ?? "",
      dailyRate: employee.dailyRate,
      notes: employee.notes ?? "",
      active: employee.active ? "ativo" : "inativo",
      assignments: assignments.length,
      currentServices,
      cost,
    };
  });

  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
  const canWrite = user?.role === "admin";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Funcionários"
        subtitle="Equipe, diárias e custo por obra. Ao vincular um funcionário a um serviço, o custo entra automaticamente no resultado da obra."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Panel padded={false} className="p-3.5">
          <p className="text-[0.62rem] uppercase tracking-wide text-slate-400">Equipe ativa</p>
          <p className="kpi-value text-brand-300">{employeeRows.filter((e) => e.active).length}</p>
        </Panel>
        <Panel padded={false} className="p-3.5">
          <p className="text-[0.62rem] uppercase tracking-wide text-slate-400">Vínculos com obras</p>
          <p className="kpi-value text-slate-100">{assignmentRows.length}</p>
        </Panel>
        <Panel padded={false} className="p-3.5">
          <p className="text-[0.62rem] uppercase tracking-wide text-slate-400">Custo acumulado</p>
          <p className="kpi-value text-amber-300">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalCost)}</p>
        </Panel>
        <Panel padded={false} className="p-3.5">
          <p className="text-[0.62rem] uppercase tracking-wide text-slate-400">Média de diária</p>
          <p className="kpi-value text-emerald-300">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
              employeeRows.length
                ? employeeRows.reduce((sum, e) => sum + toNum(e.dailyRate), 0) / employeeRows.length
                : 0,
            )}
          </p>
        </Panel>
      </div>

      <CrudTable
        endpoint="employees"
        title="Cadastro de funcionários"
        subtitle="Diária padrão usada no cálculo automático dos custos"
        rows={rows}
        canWrite={canWrite}
        searchKeys={["name", "role"]}
        createLabel="Novo funcionário"
        emptyText="Nenhum funcionário cadastrado"
        columns={[
          { key: "name", label: "Nome" },
          { key: "role", label: "Função" },
          { key: "phone", label: "Telefone", hideOnMobile: true },
          { key: "dailyRate", label: "Diária", format: "money" },
          { key: "currentServices", label: "Obras ativas", format: "number" },
          { key: "cost", label: "Custo total", format: "money", hideOnMobile: true },
          { key: "active", label: "Situação", format: "status" },
        ]}
        fields={[
          { key: "name", label: "Nome completo", required: true, span: 2 },
          { key: "phone", label: "Telefone", type: "tel" },
          { key: "role", label: "Função", placeholder: "Eletricista, hidráulico, ajudante..." },
          { key: "dailyRate", label: "Valor da diária (R$)", type: "number" },
          { key: "active", label: "Situação", type: "select", defaultValue: "true", options: [{ value: "true", label: "Ativo" }, { value: "false", label: "Inativo" }] },
          { key: "notes", label: "Observações", type: "textarea", span: 2 },
        ]}
      />

      <Panel>
        <SectionTitle title="Como o custo é calculado" subtitle="Transparência no resultado por obra" />
        <p className="text-[0.76rem] leading-relaxed text-slate-300">
          Cada vínculo registra a diária do funcionário no momento da alocação e a quantidade de dias trabalhados no serviço.
          O total é somado às despesas da obra como custo de mão de obra, impactando lucro bruto, lucro líquido e margem.
          Também é possível lançar despesas manuais de mão de obra, transporte, materiais e equipamentos dentro de cada serviço.
        </p>
      </Panel>
    </div>
  );
}
