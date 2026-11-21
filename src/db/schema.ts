import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

/* ---------------------------------- Auth ---------------------------------- */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("funcionario"),
  phone: text("phone"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------- Cadastros ------------------------------- */

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  doc: text("doc"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  notes: text("notes"),
  rating: integer("rating").notNull().default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: text("role"),
  dailyRate: money("daily_rate").notNull().default("0"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------------------- Serviços e obras ---------------------------- */

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  clientId: integer("client_id"),
  type: text("type").notNull().default("Outros serviços"),
  title: text("title").notNull(),
  description: text("description"),
  address: text("address"),
  contractedValue: money("contracted_value").notNull().default("0"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  realStartDate: date("real_start_date"),
  realEndDate: date("real_end_date"),
  countMode: text("count_mode").notNull().default("corridos"),
  status: text("status").notNull().default("agendado"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const serviceEmployees = pgTable("service_employees", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  days: integer("days").notNull().default(1),
  dailyRate: money("daily_rate").notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id"),
  description: text("description").notNull(),
  category: text("category").notNull().default("materiais"),
  amount: money("amount").notNull().default("0"),
  expenseDate: date("expense_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id"),
  serviceId: integer("service_id"),
  title: text("title").notNull(),
  address: text("address"),
  date: date("date").notNull(),
  time: text("time").notNull().default("08:00"),
  days: integer("days").notNull().default(1),
  plannedEndDate: date("planned_end_date"),
  status: text("status").notNull().default("agendado"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------- Financeiro ------------------------------- */

export const payables = pgTable("payables", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  category: text("category").notNull().default("operacional"),
  amount: money("amount").notNull().default("0"),
  issueDate: date("issue_date"),
  dueDate: date("due_date").notNull(),
  paidAt: date("paid_at"),
  paymentMethod: text("payment_method"),
  status: text("status").notNull().default("pendente"),
  receiptUrl: text("receipt_url"),
  serviceId: integer("service_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const receivables = pgTable("receivables", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id"),
  serviceId: integer("service_id"),
  description: text("description").notNull(),
  contractedAmount: money("contracted_amount").notNull().default("0"),
  receivedAmount: money("received_amount").notNull().default("0"),
  dueDate: date("due_date"),
  installments: integer("installments").notNull().default(1),
  paymentMethod: text("payment_method"),
  status: text("status").notNull().default("pendente"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  receivableId: integer("receivable_id"),
  clientId: integer("client_id"),
  serviceId: integer("service_id"),
  amount: money("amount").notNull().default("0"),
  paidAt: date("paid_at").notNull(),
  paymentMethod: text("payment_method").notNull().default("PIX"),
  notes: text("notes"),
  titheAmount: money("tithe_amount").notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tithes = pgTable("tithes", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id"),
  serviceId: integer("service_id"),
  baseAmount: money("base_amount").notNull().default("0"),
  amount: money("amount").notNull().default("0"),
  status: text("status").notNull().default("reservado"),
  paidAt: date("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------- Orçamentos / documentos ------------------------ */

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  clientId: integer("client_id"),
  serviceId: integer("service_id"),
  title: text("title").notNull(),
  description: text("description"),
  laborTotal: money("labor_total").notNull().default("0"),
  materialTotal: money("material_total").notNull().default("0"),
  discount: money("discount").notNull().default("0"),
  total: money("total").notNull().default("0"),
  paymentTerms: text("payment_terms"),
  validUntil: date("valid_until"),
  status: text("status").notNull().default("rascunho"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const budgetItems = pgTable("budget_items", {
  id: serial("id").primaryKey(),
  budgetId: integer("budget_id").notNull(),
  kind: text("kind").notNull().default("mao_de_obra"),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1"),
  unitPrice: money("unit_price").notNull().default("0"),
  total: money("total").notNull().default("0"),
});

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  clientId: integer("client_id"),
  serviceId: integer("service_id"),
  title: text("title").notNull(),
  scope: text("scope"),
  value: money("value").notNull().default("0"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  paymentTerms: text("payment_terms"),
  obligations: text("obligations"),
  status: text("status").notNull().default("ativo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const receipts = pgTable("receipts", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  paymentId: integer("payment_id"),
  clientId: integer("client_id"),
  serviceId: integer("service_id"),
  amount: money("amount").notNull().default("0"),
  receiptDate: date("receipt_date").notNull(),
  paymentMethod: text("payment_method").notNull().default("PIX"),
  remainingBalance: money("remaining_balance").notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* --------------------------------- WhatsApp -------------------------------- */

export const whatsappSettings = pgTable("whatsapp_settings", {
  id: serial("id").primaryKey(),
  baseUrl: text("base_url"),
  apiKey: text("api_key"),
  instanceName: text("instance_name"),
  webhookSecret: text("webhook_secret"),
  status: text("status").notNull().default("desconectado"),
  qrCode: text("qr_code"),
  autoNotifications: boolean("auto_notifications").notNull().default(true),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const whatsappAdmins = pgTable("whatsapp_admins", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  direction: text("direction").notNull(),
  remoteJid: text("remote_jid").notNull(),
  body: text("body").notNull(),
  intent: text("intent"),
  status: text("status").notNull().default("registrado"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const whatsappQueue = pgTable("whatsapp_queue", {
  id: serial("id").primaryKey(),
  toPhone: text("to_phone").notNull(),
  body: text("body").notNull(),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"),
  fileName: text("file_name"),
  sendAfter: timestamp("send_after", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("fila"),
  attempts: integer("attempts").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatConfirmations = pgTable("chat_confirmations", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  action: text("action").notNull(),
  targetId: integer("target_id"),
  amount: money("amount"),
  summary: text("summary").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* --------------------------------- Auditoria ------------------------------- */

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  userName: text("user_name"),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: integer("entity_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
