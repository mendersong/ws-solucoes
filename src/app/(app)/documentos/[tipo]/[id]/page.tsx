import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { budgetItems, budgets, clients, contracts, payments, receipts, services } from "@/db/schema";
import { COMPANY } from "@/lib/company";
import { formatDateBR, money, toNum } from "@/lib/format";
import { LogoMark } from "@/components/logo";
import { DocumentActions } from "@/components/document-actions";

export const dynamic = "force-dynamic";

const TITLES: Record<string, string> = {
  orcamento: "Orçamento de prestação de serviços",
  contrato: "Contrato de prestação de serviços",
  recibo: "Recibo de pagamento",
};

export default async function DocumentPage({ params }: { params: Promise<{ tipo: string; id: string }> }) {
  const { tipo, id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const clientRows = await db.select().from(clients);
  const serviceRows = await db.select().from(services);
  const clientById = new Map(clientRows.map((c) => [c.id, c]));
  const serviceById = new Map(serviceRows.map((s) => [s.id, s]));

  let header = { number: "", date: new Date().toISOString(), status: "" };
  let clientId: number | null = null;
  let body: ReactNode = null;
  let shareMessage = "";

  if (tipo === "orcamento") {
    const budget = (await db.select().from(budgets).where(eq(budgets.id, numericId)).limit(1))[0];
    if (!budget) notFound();
    const items = await db.select().from(budgetItems).where(eq(budgetItems.budgetId, budget.id));
    clientId = budget.clientId;
    header = { number: budget.number, date: budget.createdAt.toISOString(), status: budget.status };
    const labor = items.filter((i) => i.kind === "mao_de_obra");
    const materials = items.filter((i) => i.kind === "material");
    body = (
      <>
        <h2 className="mt-4 text-sm font-bold uppercase tracking-wide text-slate-800">Escopo dos serviços</h2>
        <p className="mt-1 whitespace-pre-wrap text-[0.82rem] leading-relaxed text-slate-700">
          {budget.description || budget.title}
        </p>
        {labor.length > 0 ? (
          <>
            <h3 className="mt-4 text-[0.78rem] font-bold uppercase tracking-wide text-slate-600">Mão de obra</h3>
            <ItemsTable items={labor} />
          </>
        ) : null}
        {materials.length > 0 ? (
          <>
            <h3 className="mt-4 text-[0.78rem] font-bold uppercase tracking-wide text-slate-600">Materiais</h3>
            <ItemsTable items={materials} />
          </>
        ) : null}
        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-[0.82rem]">
          <Row label="Mão de obra" value={money(budget.laborTotal)} />
          <Row label="Materiais" value={money(budget.materialTotal)} />
          <Row label="Desconto" value={`− ${money(budget.discount)}`} />
          <div className="flex justify-between border-t-2 border-slate-800 pt-1 text-base font-bold text-slate-900">
            <span>Total</span>
            <span>{money(budget.total)}</span>
          </div>
        </div>
        <div className="mt-5 grid gap-2 text-[0.78rem] text-slate-700 sm:grid-cols-2">
          <p><strong>Condições de pagamento:</strong> {budget.paymentTerms || "A combinar"}</p>
          <p><strong>Validade do orçamento:</strong> {formatDateBR(budget.validUntil)}</p>
        </div>
        <p className="mt-4 text-[0.72rem] leading-relaxed text-slate-600">
          Os valores acima incluem mão de obra e materiais discriminados. Serviços adicionais não previstos neste escopo
          serão orçados separadamente. Garantia de execução conforme normas técnicas vigentes (ABNT NBR 5410 para
          instalações elétricas e NBR 5626 para instalações hidráulicas).
        </p>
      </>
    );
    shareMessage = `*WS SOLUÇÕES* — Orçamento ${budget.number}\n${budget.title}\nTotal: ${money(budget.total)}\nValidade: ${formatDateBR(budget.validUntil)}\n\nDocumento completo disponível no painel WS Soluções.`;
  } else if (tipo === "contrato") {
    const contract = (await db.select().from(contracts).where(eq(contracts.id, numericId)).limit(1))[0];
    if (!contract) notFound();
    clientId = contract.clientId;
    header = { number: contract.number, date: contract.createdAt.toISOString(), status: contract.status };
    body = (
      <>
        <Section title="1. Escopo dos serviços" text={contract.scope ?? contract.title} />
        <Section title="2. Prazo de execução" text={`Início em ${formatDateBR(contract.startDate)} e término previsto em ${formatDateBR(contract.endDate)}.`} />
        <Section title="3. Valor e condições de pagamento" text={`Valor total de ${money(contract.value)}. ${contract.paymentTerms ?? "Conforme orçamento aprovado."}`} />
        <Section
          title="4. Obrigações das partes"
          text={
            contract.obligations ??
            "CONTRATADA: executar os serviços com qualidade técnica, fornecer mão de obra e materiais conforme escopo, cumprir prazos e garantir os serviços executados. CONTRATANTE: fornecer acesso ao local, efetuar os pagamentos nas condições acordadas e comunicar eventuais impedimentos."
          }
        />
        <Section
          title="5. Disposições gerais"
          text="Alterações no escopo deverão ser formalizadas por escrito. O não cumprimento das obrigações sujeitará a parte infratora às penalidades previstas na legislação aplicável. Fica eleito o foro da comarca da sede da CONTRATADA para dirimir eventuais dúvidas."
        />
        <div className="mt-10 grid gap-8 text-center text-[0.78rem] sm:grid-cols-2">
          <div className="border-t border-slate-500 pt-2">CONTRATADA — WS SOLUÇÕES</div>
          <div className="border-t border-slate-500 pt-2">CONTRATANTE</div>
        </div>
      </>
    );
    shareMessage = `*WS SOLUÇÕES* — Contrato ${contract.number}\n${contract.title}\nValor: ${money(contract.value)}\nInício: ${formatDateBR(contract.startDate)}\n\nDocumento completo disponível no painel WS Soluções.`;
  } else if (tipo === "recibo") {
    const receipt = (await db.select().from(receipts).where(eq(receipts.id, numericId)).limit(1))[0];
    if (!receipt) notFound();
    const payment = receipt.paymentId
      ? (await db.select().from(payments).where(eq(payments.id, receipt.paymentId)).limit(1))[0]
      : undefined;
    clientId = receipt.clientId;
    header = { number: receipt.number, date: receipt.createdAt.toISOString(), status: "recebido" };
    const service = receipt.serviceId ? serviceById.get(receipt.serviceId) : undefined;
    body = (
      <>
        <div className="my-5 rounded-lg border border-slate-300 bg-slate-50 p-4 text-center">
          <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">Valor recebido</p>
          <p className="text-3xl font-extrabold text-slate-900">{money(receipt.amount)}</p>
          <p className="mt-1 text-[0.78rem] text-slate-600">
            {receipt.paymentMethod} · {formatDateBR(receipt.receiptDate)}
          </p>
        </div>
        <div className="grid gap-2 text-[0.8rem] text-slate-700">
          <p><strong>Serviço relacionado:</strong> {service ? `${service.code} — ${service.title}` : "Recebimento avulso"}</p>
          <p><strong>Forma de pagamento:</strong> {receipt.paymentMethod}</p>
          <p><strong>Saldo restante do contrato:</strong> {money(receipt.remainingBalance)}</p>
          {payment ? <p><strong>Dízimo reservado (10%):</strong> {money(payment.titheAmount)}</p> : null}
        </div>
        <p className="mt-4 text-[0.78rem] leading-relaxed text-slate-700">
          Recebemos do(a) cliente acima a importância de {money(receipt.amount)}, referente aos serviços prestados pela
          WS SOLUÇÕES, dando plena e total quitação do valor aqui descrito
          {toNum(receipt.remainingBalance) > 0 ? ", permanecendo saldo em aberto conforme informado." : " referente a este pagamento."}
        </p>
        <div className="mt-12 text-center text-[0.78rem]">
          <div className="mx-auto w-64 border-t border-slate-500 pt-2">WS SOLUÇÕES — Assinatura do recebedor</div>
        </div>
      </>
    );
    shareMessage = `*WS SOLUÇÕES* — Recibo ${receipt.number}\nValor recebido: ${money(receipt.amount)}\nData: ${formatDateBR(receipt.receiptDate)}\nForma: ${receipt.paymentMethod}\n\nRecibo emitido pelo sistema WS Soluções.`;
  } else {
    notFound();
  }

  const client = clientId ? clientById.get(clientId) : undefined;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href={`/documentos?tab=${tipo === "orcamento" ? "orcamentos" : tipo === "contrato" ? "contratos" : "recibos"}`} className="inline-flex items-center gap-1.5 text-[0.72rem] text-slate-400 hover:text-brand-200">
          <ArrowLeft size={13} /> Voltar
        </Link>
        <DocumentActions documentLabel={TITLES[tipo] ?? "documento"} phone={client?.whatsapp ?? client?.phone ?? ""} message={shareMessage} />
      </div>

      <article className="print-sheet mx-auto w-full max-w-3xl rounded-2xl bg-white p-6 text-slate-900 shadow-2xl sm:p-9">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <LogoMark size={54} />
            <div>
              <p className="text-lg font-extrabold tracking-[0.12em] text-slate-900">WS SOLUÇÕES</p>
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-slate-500">
                Elétrica · Hidráulica · Construção e Manutenção
              </p>
              <p className="mt-1 text-[0.66rem] leading-snug text-slate-500">
                {COMPANY.legalName}<br />
                {COMPANY.document} · {COMPANY.phone}<br />
                {COMPANY.email} · {COMPANY.city}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[0.68rem] uppercase tracking-[0.16em] text-slate-500">{TITLES[tipo]}</p>
            <p className="text-xl font-bold text-slate-900">{header.number}</p>
            <p className="text-[0.7rem] text-slate-500">Emitido em {formatDateBR(header.date)}</p>
          </div>
        </header>

        <section className="mt-4 grid gap-3 text-[0.8rem] sm:grid-cols-2">
          <div>
            <p className="text-[0.64rem] font-bold uppercase tracking-wider text-slate-500">Cliente</p>
            <p className="font-semibold text-slate-900">{client?.name ?? "Cliente não informado"}</p>
            <p className="text-slate-600">{client?.doc ?? "Documento não informado"}</p>
            <p className="text-slate-600">{client?.phone ?? client?.whatsapp ?? "Telefone não informado"}</p>
          </div>
          <div>
            <p className="text-[0.64rem] font-bold uppercase tracking-wider text-slate-500">Endereço da obra</p>
            <p className="text-slate-600">{client?.address ?? "Endereço não informado"}</p>
            <p className="text-slate-600">{client?.city ?? ""}{client?.state ? ` / ${client.state}` : ""}</p>
          </div>
        </section>

        {body}
      </article>

      <p className="no-print text-center text-[0.68rem] text-slate-500">
        Documento gerado automaticamente pelo sistema WS SOLUÇÕES. Use “Imprimir / Salvar PDF” para gerar o arquivo.
      </p>
    </div>
  );
}

function ItemsTable({ items }: { items: { id: number; description: string; quantity: string; unitPrice: string; total: string }[] }) {
  return (
    <table className="mt-1 w-full border-collapse text-[0.78rem]">
      <thead>
        <tr className="bg-slate-100 text-left text-[0.66rem] uppercase tracking-wide text-slate-600">
          <th className="border border-slate-200 px-2 py-1.5">Descrição</th>
          <th className="border border-slate-200 px-2 py-1.5 text-right">Qtd</th>
          <th className="border border-slate-200 px-2 py-1.5 text-right">Unitário</th>
          <th className="border border-slate-200 px-2 py-1.5 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td className="border border-slate-200 px-2 py-1.5 text-slate-700">{item.description}</td>
            <td className="border border-slate-200 px-2 py-1.5 text-right text-slate-600">{toNum(item.quantity)}</td>
            <td className="border border-slate-200 px-2 py-1.5 text-right text-slate-600">{money(item.unitPrice)}</td>
            <td className="border border-slate-200 px-2 py-1.5 text-right font-medium text-slate-800">{money(item.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-700">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-4">
      <h3 className="text-[0.78rem] font-bold uppercase tracking-wide text-slate-700">{title}</h3>
      <p className="mt-1 whitespace-pre-wrap text-[0.8rem] leading-relaxed text-slate-700">{text}</p>
    </div>
  );
}


