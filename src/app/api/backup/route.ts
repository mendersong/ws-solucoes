import { desc } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  auditLogs,
  budgetItems,
  budgets,
  clients,
  contracts,
  employees,
  expenses,
  payables,
  payments,
  receipts,
  receivables,
  serviceEmployees,
  services,
  tithes,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "Backup restrito ao administrador" }, { status: 403 });

  const [
    clientRows,
    employeeRows,
    serviceRows,
    teamRows,
    expenseRows,
    appointmentRows,
    payableRows,
    receivableRows,
    paymentRows,
    titheRows,
    budgetRows,
    itemRows,
    contractRows,
    receiptRows,
  ] = await Promise.all([
    db.select().from(clients),
    db.select().from(employees),
    db.select().from(services),
    db.select().from(serviceEmployees),
    db.select().from(expenses),
    db.select().from(appointments),
    db.select().from(payables),
    db.select().from(receivables),
    db.select().from(payments),
    db.select().from(tithes),
    db.select().from(budgets),
    db.select().from(budgetItems),
    db.select().from(contracts),
    db.select().from(receipts),
  ]);

  const audit = await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(200);

  await logAudit({ user: session, action: "backup", entity: "sistema", details: { records: paymentRows.length + clientRows.length } });

  const backup = {
    generatedAt: new Date().toISOString(),
    company: "WS SOLUÇÕES",
    version: 1,
    tables: {
      clients: clientRows,
      employees: employeeRows,
      services: serviceRows,
      serviceEmployees: teamRows,
      expenses: expenseRows,
      appointments: appointmentRows,
      payables: payableRows,
      receivables: receivableRows,
      payments: paymentRows,
      tithes: titheRows,
      budgets: budgetRows,
      budgetItems: itemRows,
      contracts: contractRows,
      receipts: receiptRows,
      auditLogs: audit,
    },
  };

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ws-solucoes-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
