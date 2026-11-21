import type { PgTable } from "drizzle-orm/pg-core";
import {
  appointments,
  budgets,
  budgetItems,
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
  whatsappAdmins,
  whatsappMessages,
  whatsappQueue,
} from "@/db/schema";

export type ResourceDef = {
  table: PgTable;
  search: string[];
  label: string;
};

export const RESOURCES: Record<string, ResourceDef> = {
  clients: { table: clients, search: ["name", "phone", "city", "doc"], label: "Cliente" },
  employees: { table: employees, search: ["name", "role"], label: "Funcionário" },
  services: { table: services, search: ["code", "title", "description"], label: "Serviço" },
  serviceEmployees: { table: serviceEmployees, search: [], label: "Equipe do serviço" },
  expenses: { table: expenses, search: ["description"], label: "Despesa" },
  appointments: { table: appointments, search: ["title", "address"], label: "Agendamento" },
  payables: { table: payables, search: ["description", "category"], label: "Conta a pagar" },
  receivables: { table: receivables, search: ["description"], label: "Conta a receber" },
  payments: { table: payments, search: ["notes"], label: "Recebimento" },
  tithes: { table: tithes, search: ["notes"], label: "Dízimo" },
  budgets: { table: budgets, search: ["number", "title"], label: "Orçamento" },
  budgetItems: { table: budgetItems, search: ["description"], label: "Item de orçamento" },
  contracts: { table: contracts, search: ["number", "title"], label: "Contrato" },
  receipts: { table: receipts, search: ["number"], label: "Recibo" },
  whatsappAdmins: { table: whatsappAdmins, search: ["name", "phone"], label: "Administrador WhatsApp" },
  whatsappQueue: { table: whatsappQueue, search: ["toPhone", "body"], label: "Fila de mensagens" },
  whatsappMessages: { table: whatsappMessages, search: ["body", "remoteJid"], label: "Mensagem" },
};

export const IMMUTABLE_RESOURCES = new Set(["payments", "receipts", "tithes"]);
