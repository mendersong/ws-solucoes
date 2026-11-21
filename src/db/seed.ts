import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, pool } from "./index";
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
  users,
  whatsappAdmins,
} from "./schema";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

const now = new Date();
const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
const iso = (offsetDays: number) => {
  const d = new Date(todayUTC);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};
const year = now.getFullYear();
const moneyOf = (n: number) => n.toFixed(2);

async function main() {
  console.log("Limpando dados de demonstração...");
  await db.execute(
    sql.raw(`TRUNCATE TABLE
      "payments", "receipts", "tithes", "receivables", "payables", "expenses",
      "service_employees", "appointments", "services", "budget_items", "budgets",
      "contracts", "employees", "clients", "whatsapp_admins", "whatsapp_settings",
      "whatsapp_messages", "whatsapp_queue", "chat_confirmations", "audit_logs",
      "sessions", "users" RESTART IDENTITY CASCADE`),
  );

  const userRows = await db
    .insert(users)
    .values([
      { name: "William Silva", email: "admin@wssolucoes.com.br", passwordHash: hashPassword("ws123456"), role: "admin", phone: "5511999990001" },
      { name: "Ana Financeiro", email: "financeiro@wssolucoes.com.br", passwordHash: hashPassword("fin123456"), role: "financeiro", phone: "5511999990002" },
      { name: "Carlos Encarregado", email: "funcionario@wssolucoes.com.br", passwordHash: hashPassword("fun123456"), role: "funcionario", phone: "5511999990003" },
    ])
    .returning();

  const clientRows = await db
    .insert(clients)
    .values([
      {
        name: "Condomínio Residencial Bella Vista",
        phone: "(11) 3344-1200",
        whatsapp: "5511988880001",
        doc: "12.345.678/0001-90",
        address: "Rua das Acácias, 450 — Jardim Europa",
        city: "São Paulo",
        state: "SP",
        notes: "Síndico: Ricardo. Serviços precisam de autorização prévia da administradora.",
        rating: 5,
      },
      {
        name: "Maria Aparecida Santos",
        phone: "(19) 98877-4455",
        whatsapp: "5519988774455",
        doc: "123.456.789-00",
        address: "Av. Brasil, 1200 — Centro",
        city: "Campinas",
        state: "SP",
        notes: "Prefere atendimento no período da manhã.",
        rating: 4,
      },
      {
        name: "Mercado Bom Preço Ltda",
        phone: "(11) 2233-8899",
        whatsapp: "5511977770002",
        doc: "98.765.432/0001-11",
        address: "Rua Marechal Deodoro, 87 — Centro",
        city: "São Paulo",
        state: "SP",
        notes: "Serviços somente fora do horário comercial.",
        rating: 5,
      },
      {
        name: "João Batista Oliveira",
        phone: "(11) 97766-1122",
        whatsapp: "5511977661122",
        address: "Rua das Palmeiras, 32 — Vila Galvão",
        city: "Guarulhos",
        state: "SP",
        notes: "Obra residencial com acesso por portão lateral.",
        rating: 3,
      },
      {
        name: "Indústria Metalúrgica Alfa",
        phone: "(11) 4455-7788",
        whatsapp: "5511965550003",
        doc: "45.678.901/0001-22",
        address: "Rod. Anchieta, km 22 — Distrito Industrial",
        city: "São Bernardo do Campo",
        state: "SP",
        notes: "Exige ART e laudo técnico ao final do serviço.",
        rating: 5,
      },
      {
        name: "Fernanda Lima",
        phone: "(13) 98111-2233",
        whatsapp: "5513981112233",
        doc: "987.654.321-00",
        address: "Rua do Sol, 78 — Gonzaga",
        city: "Santos",
        state: "SP",
        notes: "Cliente indicada pelo condomínio Bella Vista.",
        rating: 4,
      },
    ])
    .returning();
  const c = (index: number) => clientRows[index]!.id;

  const employeeRows = await db
    .insert(employees)
    .values([
      { name: "Carlos Eletricista", phone: "5511911110001", role: "Eletricista", dailyRate: "260.00", notes: "Certificado NR-10" },
      { name: "Anderson Hidráulico", phone: "5511911110002", role: "Encanador", dailyRate: "240.00" },
      { name: "José Ajudante", phone: "5511911110003", role: "Ajudante geral", dailyRate: "160.00" },
      { name: "Rafael Pedreiro", phone: "5511911110004", role: "Pedreiro", dailyRate: "280.00" },
      { name: "Lucas Ajudante", phone: "5511911110005", role: "Ajudante geral", dailyRate: "150.00", active: false },
    ])
    .returning();

  const serviceRows = await db
    .insert(services)
    .values([
      {
        code: "WS-0001",
        clientId: c(0),
        type: "Instalações elétricas",
        title: "Instalação elétrica completa — Residência Bella Vista",
        description: "Troca de quadros, fiação, tomadas e iluminação das áreas comuns do condomínio.",
        address: "Rua das Acácias, 450 — Jardim Europa, São Paulo/SP",
        contractedValue: "18500.00",
        startDate: iso(-20),
        endDate: iso(-2),
        realStartDate: iso(-19),
        countMode: "corridos",
        status: "em_andamento",
        notes: "Obra em fase de acabamento; pendente pintura do quadro geral.",
      },
      {
        code: "WS-0002",
        clientId: c(1),
        type: "Instalações hidráulicas",
        title: "Reforma de banheiro e rede hidráulica",
        description: "Substituição completa da rede hidráulica, louças e metais.",
        address: "Av. Brasil, 1200 — Centro, Campinas/SP",
        contractedValue: "7300.00",
        startDate: iso(-45),
        endDate: iso(-30),
        realStartDate: iso(-44),
        realEndDate: iso(-33),
        countMode: "corridos",
        status: "concluido",
        notes: "Cliente aprovou o serviço sem ressalvas.",
      },
      {
        code: "WS-0003",
        clientId: c(2),
        type: "Manutenção",
        title: "Manutenção preventiva elétrica — Loja Centro",
        description: "Revisão de disjuntores, aterramento e iluminação da loja.",
        address: "Rua Marechal Deodoro, 87 — Centro, São Paulo/SP",
        contractedValue: "2400.00",
        startDate: iso(-5),
        endDate: iso(2),
        realStartDate: iso(-5),
        countMode: "corridos",
        status: "em_andamento",
      },
      {
        code: "WS-0004",
        clientId: c(3),
        type: "Construção civil",
        title: "Construção de muro e calçada",
        description: "Muro de alvenaria com 18m, portão social e calçada de 22m².",
        address: "Rua das Palmeiras, 32 — Vila Galvão, Guarulhos/SP",
        contractedValue: "12900.00",
        startDate: iso(3),
        endDate: iso(20),
        countMode: "corridos",
        status: "agendado",
      },
      {
        code: "WS-0005",
        clientId: c(4),
        type: "Instalações elétricas",
        title: "Instalação de quadro elétrico industrial",
        description: "Quadro de distribuição industrial 220/380V com laudo técnico.",
        address: "Rod. Anchieta, km 22 — Distrito Industrial, São Bernardo/SP",
        contractedValue: "22500.00",
        startDate: iso(-35),
        endDate: iso(-5),
        realStartDate: iso(-34),
        realEndDate: iso(-1),
        countMode: "corridos",
        status: "concluido",
        notes: "Concluído 4 dias após o prazo por atraso na entrega dos componentes.",
      },
      {
        code: "WS-0006",
        clientId: c(5),
        type: "Reformas",
        title: "Pintura e acabamento — Apartamento Gonzaga",
        description: "Pintura interna completa, massa corrida e acabamento de gesso.",
        address: "Rua do Sol, 78 — Gonzaga, Santos/SP",
        contractedValue: "4800.00",
        startDate: iso(1),
        endDate: iso(6),
        countMode: "corridos",
        status: "agendado",
      },
      {
        code: "WS-0007",
        clientId: c(1),
        type: "Manutenção",
        title: "Reparo emergencial de vazamento",
        description: "Atendimento emergencial em registro do banheiro social.",
        address: "Av. Brasil, 1200 — Centro, Campinas/SP",
        contractedValue: "1500.00",
        startDate: iso(-2),
        endDate: iso(-1),
        realStartDate: iso(-2),
        countMode: "corridos",
        status: "em_andamento",
      },
      {
        code: "WS-0008",
        clientId: c(2),
        type: "Manutenção",
        title: "Troca de fiação e tomadas — depósito",
        description: "Substituição de fiação antiga e instalação de 12 tomadas.",
        address: "Rua Marechal Deodoro, 87 — Centro, São Paulo/SP",
        contractedValue: "3200.00",
        startDate: iso(-60),
        endDate: iso(-55),
        realStartDate: iso(-59),
        realEndDate: iso(-56),
        countMode: "corridos",
        status: "concluido",
      },
    ])
    .returning();
  const s = (index: number) => serviceRows[index]!;

  await db.insert(serviceEmployees).values([
    { serviceId: s(0).id, employeeId: employeeRows[0]!.id, days: 12, dailyRate: "260.00" },
    { serviceId: s(0).id, employeeId: employeeRows[2]!.id, days: 10, dailyRate: "160.00" },
    { serviceId: s(1).id, employeeId: employeeRows[1]!.id, days: 8, dailyRate: "240.00" },
    { serviceId: s(2).id, employeeId: employeeRows[0]!.id, days: 3, dailyRate: "260.00" },
    { serviceId: s(4).id, employeeId: employeeRows[0]!.id, days: 15, dailyRate: "260.00" },
    { serviceId: s(4).id, employeeId: employeeRows[2]!.id, days: 12, dailyRate: "160.00" },
    { serviceId: s(6).id, employeeId: employeeRows[1]!.id, days: 2, dailyRate: "240.00" },
    { serviceId: s(7).id, employeeId: employeeRows[0]!.id, days: 4, dailyRate: "260.00" },
    { serviceId: s(3).id, employeeId: employeeRows[3]!.id, days: 10, dailyRate: "280.00" },
  ]);

  await db.insert(expenses).values([
    { serviceId: s(0).id, description: "Fios, disjuntores e tomadas", category: "materiais", amount: "4200.00", expenseDate: iso(-16), notes: "Nota fiscal 8891" },
    { serviceId: s(0).id, description: "Combustível e pedágio", category: "transporte", amount: "480.00", expenseDate: iso(-14) },
    { serviceId: s(0).id, description: "Alimentação da equipe", category: "alimentacao", amount: "350.00", expenseDate: iso(-10) },
    { serviceId: s(0).id, description: "Aluguel de andaime e escada", category: "equipamentos", amount: "900.00", expenseDate: iso(-9) },
    { serviceId: s(1).id, description: "Tubos, conexões e metais", category: "materiais", amount: "2100.00", expenseDate: iso(-38) },
    { serviceId: s(1).id, description: "Serviço de ajudante extra", category: "mao_de_obra", amount: "800.00", expenseDate: iso(-36) },
    { serviceId: s(2).id, description: "Disjuntores e lâmpadas LED", category: "materiais", amount: "380.00", expenseDate: iso(-4) },
    { serviceId: s(2).id, description: "Deslocamento", category: "transporte", amount: "150.00", expenseDate: iso(-3) },
    { serviceId: s(4).id, description: "Componentes do quadro elétrico", category: "materiais", amount: "3200.00", expenseDate: iso(-30) },
    { serviceId: s(4).id, description: "Equipamentos de medição", category: "equipamentos", amount: "1400.00", expenseDate: iso(-28) },
    { serviceId: s(4).id, description: "Transporte de materiais", category: "transporte", amount: "600.00", expenseDate: iso(-27) },
    { serviceId: s(6).id, description: "Conexões e vedação", category: "materiais", amount: "180.00", expenseDate: iso(-1) },
    { description: "Aluguel do galpão de materiais", category: "outras", amount: "2800.00", expenseDate: iso(-10) },
    { description: "Combustível do caminhão", category: "transporte", amount: "620.00", expenseDate: iso(-6) },
    { description: "Manutenção da betoneira", category: "equipamentos", amount: "890.00", expenseDate: iso(-22) },
  ]);

  const receivableSeed = [
    { serviceIndex: 0, contracted: 18500, dueDate: iso(5), installments: 2 },
    { serviceIndex: 1, contracted: 7300, dueDate: iso(-30), installments: 1 },
    { serviceIndex: 2, contracted: 2400, dueDate: iso(8), installments: 1 },
    { serviceIndex: 3, contracted: 12900, dueDate: iso(35), installments: 3 },
    { serviceIndex: 4, contracted: 22500, dueDate: iso(-5), installments: 2 },
    { serviceIndex: 5, contracted: 4800, dueDate: iso(15), installments: 1 },
    { serviceIndex: 6, contracted: 1500, dueDate: iso(3), installments: 1 },
    { serviceIndex: 7, contracted: 3200, dueDate: iso(-55), installments: 1 },
  ];

  const receivableRows = await db
    .insert(receivables)
    .values(
      receivableSeed.map((item) => ({
        clientId: s(item.serviceIndex).clientId,
        serviceId: s(item.serviceIndex).id,
        description: `Serviço ${s(item.serviceIndex).code} — ${s(item.serviceIndex).title}`,
        contractedAmount: moneyOf(item.contracted),
        receivedAmount: "0",
        dueDate: item.dueDate,
        installments: item.installments,
        status: "pendente",
      })),
    )
    .returning();

  const paymentSeed = [
    { receivableIndex: 0, amount: 7500, paidAt: iso(-15) },
    { receivableIndex: 0, amount: 4500, paidAt: iso(-4) },
    { receivableIndex: 1, amount: 7300, paidAt: iso(-32) },
    { receivableIndex: 2, amount: 1200, paidAt: iso(-3) },
    { receivableIndex: 4, amount: 12000, paidAt: iso(-28) },
    { receivableIndex: 4, amount: 7000, paidAt: iso(-2) },
    { receivableIndex: 7, amount: 3200, paidAt: iso(-56) },
  ];

  let receiptSeq = 0;
  const receivedTracker = new Map<number, number>();
  for (const item of paymentSeed) {
    const receivable = receivableRows[item.receivableIndex]!;
    const tithe = Math.round(item.amount * 0.1 * 100) / 100;
    const payment = (
      await db
        .insert(payments)
        .values({
          receivableId: receivable.id,
          clientId: receivable.clientId,
          serviceId: receivable.serviceId,
          amount: moneyOf(item.amount),
          paidAt: item.paidAt,
          paymentMethod: item.amount > 5000 ? "Transferência" : "PIX",
          notes: `Recebimento referente a ${receivable.description}`,
          titheAmount: moneyOf(tithe),
        })
        .returning()
    )[0]!;
    await db.insert(tithes).values({
      paymentId: payment.id,
      serviceId: receivable.serviceId,
      baseAmount: moneyOf(item.amount),
      amount: moneyOf(tithe),
      status: item.paidAt < iso(-20) ? "pago" : "reservado",
      paidAt: item.paidAt < iso(-20) ? iso(-18) : null,
      notes: "Dízimo automático de 10% sobre o recebimento",
    });
    const previous = receivedTracker.get(receivable.id) ?? toNumSafe(receivable.receivedAmount);
    const received = previous + item.amount;
    receivedTracker.set(receivable.id, received);
    const status = received >= toNumSafe(receivable.contractedAmount) ? "recebido" : "parcial";
    await db.update(receivables).set({ receivedAmount: moneyOf(received), status }).where(sql`${receivables.id} = ${receivable.id}`);
    receiptSeq += 1;
    await db.insert(receipts).values({
      number: `REC-${year}-${String(receiptSeq).padStart(4, "0")}`,
      paymentId: payment.id,
      clientId: receivable.clientId,
      serviceId: receivable.serviceId,
      amount: moneyOf(item.amount),
      receiptDate: item.paidAt,
      paymentMethod: item.amount > 5000 ? "Transferência" : "PIX",
      remainingBalance: moneyOf(Math.max(toNumSafe(receivable.contractedAmount) - received, 0)),
    });
  }

  await db.insert(payables).values([
    { description: "Compra de materiais elétricos — fios e disjuntores", category: "materiais", amount: "2380.00", issueDate: iso(-12), dueDate: iso(-6), status: "pendente", paymentMethod: "Boleto", notes: "Fornecedor Elétrica Central" },
    { description: "Combustível da equipe", category: "combustivel", amount: "620.00", issueDate: iso(-2), dueDate: iso(1), status: "pendente", paymentMethod: "PIX" },
    { description: "Aluguel do galpão", category: "aluguel", amount: "2800.00", issueDate: iso(-15), dueDate: iso(8), status: "pendente", paymentMethod: "Transferência" },
    { description: "Salários da equipe", category: "salarios", amount: "6800.00", issueDate: iso(-20), dueDate: iso(-12), paidAt: iso(-12), status: "pago", paymentMethod: "Transferência" },
    { description: "Energia e internet", category: "energia", amount: "470.00", issueDate: iso(-25), dueDate: iso(-20), paidAt: iso(-20), status: "pago", paymentMethod: "Débito automático" },
    { description: "Manutenção da betoneira", category: "manutencao", amount: "890.00", issueDate: iso(-5), dueDate: iso(12), status: "pendente", paymentMethod: "PIX" },
    { description: "Dízimo igreja — mês anterior", category: "dizimo", amount: "1250.00", issueDate: iso(-10), dueDate: iso(-3), paidAt: iso(-3), status: "pago", paymentMethod: "PIX" },
    { description: "Ferramentas novas — furadeira e kit elétrico", category: "ferramentas", amount: "1450.00", issueDate: iso(-1), dueDate: iso(18), status: "pendente", paymentMethod: "Cartão de crédito" },
    { description: "Impostos — Simples Nacional", category: "impostos", amount: "980.00", issueDate: iso(-8), dueDate: iso(6), status: "pendente", paymentMethod: "Boleto" },
  ]);

  const budgetSeed = [
    {
      number: `ORC-${year}-0001`,
      clientId: c(3),
      serviceId: s(3).id,
      title: "Construção de muro e calçada",
      description: "Muro de alvenaria com 18m lineares, portão social e calçada de 22m².",
      paymentTerms: "40% na assinatura, 30% no meio da obra e 30% na entrega.",
      validUntil: iso(20),
      status: "aprovado",
      labor: 6900,
      material: 6400,
      discount: 400,
      items: [
        { kind: "mao_de_obra", description: "Pedreiro e ajudante (10 dias)", quantity: "10", unitPrice: "550", total: "5500" },
        { kind: "mao_de_obra", description: "Acabamento e pintura do muro", quantity: "1", unitPrice: "1400", total: "1400" },
        { kind: "material", description: "Blocos, cimento, areia e ferro", quantity: "1", unitPrice: "4600", total: "4600" },
        { kind: "material", description: "Portão social em metalon", quantity: "1", unitPrice: "1800", total: "1800" },
      ],
    },
    {
      number: `ORC-${year}-0002`,
      clientId: c(4),
      serviceId: null,
      title: "Ampliação de subestação industrial",
      description: "Instalação de novo quadro de distribuição e cabeamento 380V com laudo técnico.",
      paymentTerms: "50% antecipado e 50% na entrega do laudo.",
      validUntil: iso(25),
      status: "enviado",
      labor: 12800,
      material: 9700,
      discount: 500,
      items: [
        { kind: "mao_de_obra", description: "Equipe técnica (15 dias)", quantity: "15", unitPrice: "720", total: "10800" },
        { kind: "mao_de_obra", description: "Laudo técnico e ART", quantity: "1", unitPrice: "2000", total: "2000" },
        { kind: "material", description: "Quadro de distribuição industrial", quantity: "1", unitPrice: "6200", total: "6200" },
        { kind: "material", description: "Cabeamento 380V", quantity: "120", unitPrice: "29.17", total: "3500" },
      ],
    },
    {
      number: `ORC-${year}-0003`,
      clientId: c(0),
      serviceId: null,
      title: "Revisão do sistema de combate a incêndio",
      description: "Revisão de tubulação, sinalização e extintores das áreas comuns.",
      paymentTerms: "Pagamento à vista com 5% de desconto.",
      validUntil: iso(30),
      status: "rascunho",
      labor: 4200,
      material: 3100,
      discount: 0,
      items: [
        { kind: "mao_de_obra", description: "Inspeção e manutenção preventiva", quantity: "1", unitPrice: "4200", total: "4200" },
        { kind: "material", description: "Extintores e sinalização", quantity: "1", unitPrice: "3100", total: "3100" },
      ],
    },
  ];

  for (const budget of budgetSeed) {
    const row = (
      await db
        .insert(budgets)
        .values({
          number: budget.number,
          clientId: budget.clientId,
          serviceId: budget.serviceId,
          title: budget.title,
          description: budget.description,
          laborTotal: moneyOf(budget.labor),
          materialTotal: moneyOf(budget.material),
          discount: moneyOf(budget.discount),
          total: moneyOf(budget.labor + budget.material - budget.discount),
          paymentTerms: budget.paymentTerms,
          validUntil: budget.validUntil,
          status: budget.status,
        })
        .returning()
    )[0]!;
    await db.insert(budgetItems).values(budget.items.map((item) => ({ ...item, budgetId: row.id })));
  }

  await db.insert(contracts).values({
    number: `CT-${year}-0001`,
    clientId: c(3),
    serviceId: s(3).id,
    title: "Contrato de prestação de serviços — Construção de muro e calçada",
    scope: "Execução de muro de alvenaria com 18m, portão social e calçada de 22m², incluindo materiais e mão de obra.",
    value: "12900.00",
    startDate: iso(3),
    endDate: iso(20),
    paymentTerms: "40% na assinatura, 30% no meio da obra e 30% na entrega.",
    obligations:
      "CONTRATADA: executar os serviços com qualidade técnica, fornecer mão de obra e materiais conforme escopo, cumprir prazos e garantir os serviços executados. CONTRATANTE: fornecer acesso ao local, efetuar os pagamentos nas condições acordadas e comunicar eventuais impedimentos.",
    status: "ativo",
  });

  await db.insert(appointments).values([
    { clientId: c(2), serviceId: s(2).id, title: "Manutenção elétrica — Loja Centro", address: "Rua Marechal Deodoro, 87 — Centro, São Paulo/SP", date: iso(0), time: "08:00", days: 3, plannedEndDate: iso(2), status: "em_andamento", notes: "Acesso após as 22h" },
    { clientId: c(1), serviceId: s(6).id, title: "Reparo emergencial de vazamento", address: "Av. Brasil, 1200 — Centro, Campinas/SP", date: iso(0), time: "13:30", days: 1, plannedEndDate: iso(0), status: "em_andamento" },
    { clientId: c(5), serviceId: s(5).id, title: "Pintura e acabamento — Apartamento", address: "Rua do Sol, 78 — Gonzaga, Santos/SP", date: iso(1), time: "09:00", days: 6, plannedEndDate: iso(6), status: "agendado", notes: "Cliente entrega a chave da unidade" },
    { clientId: c(3), serviceId: s(3).id, title: "Início da construção do muro", address: "Rua das Palmeiras, 32 — Vila Galvão, Guarulhos/SP", date: iso(3), time: "07:30", days: 18, plannedEndDate: iso(20), status: "agendado" },
    { clientId: c(0), serviceId: s(0).id, title: "Finalização da instalação elétrica", address: "Rua das Acácias, 450 — Jardim Europa, São Paulo/SP", date: iso(5), time: "08:30", days: 2, plannedEndDate: iso(6), status: "agendado" },
    { clientId: c(4), serviceId: null, title: "Visita técnica — subestação industrial", address: "Rod. Anchieta, km 22 — São Bernardo/SP", date: iso(7), time: "10:00", days: 1, plannedEndDate: iso(7), status: "agendado", notes: "Avaliar orçamento enviado" },
  ]);

  await db.insert(whatsappAdmins).values([
    { name: "William — Administrador", phone: "5511999990001", active: true },
    { name: "Ana — Financeiro", phone: "5511999990002", active: true },
    { name: "Carlos — Encarregado (sem acesso financeiro)", phone: "5511999990003", active: false },
  ]);

  await db.insert(auditLogs).values([
    { userId: userRows[0]!.id, userName: userRows[0]!.name, action: "seed_demo", entity: "sistema", details: { clientes: clientRows.length, servicos: serviceRows.length } },
    { userId: userRows[1]!.id, userName: userRows[1]!.name, action: "registrar_recebimento", entity: "payments", entityId: 1, details: { amount: 7500, tithe: 750 } },
    { userId: userRows[0]!.id, userName: userRows[0]!.name, action: "aprovar_orcamento", entity: "budgets", entityId: 1, details: { serviceId: s(3).id } },
  ]);

  console.log("Dados de demonstração inseridos com sucesso.");
  console.log("Login: admin@wssolucoes.com.br / ws123456");
}

function toNumSafe(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Falha ao popular o banco:", error);
    await pool.end();
    process.exit(1);
  });
