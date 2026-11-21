import { redirect } from "next/navigation";
import { CheckCircle2, ShieldCheck, Smartphone, WifiOff } from "lucide-react";
import { getSession } from "@/lib/auth";
import { WSLogo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="relative hidden overflow-hidden lg:flex lg:w-[54%] lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/login-hero.jpg')" }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#030913]/95 via-[#061120]/80 to-[#061a30]/90" aria-hidden />
        <div className="relative z-10 p-10">
          <WSLogo size={46} />
        </div>
        <div className="relative z-10 max-w-xl p-10">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-brand-200">
            Central de gestão empresarial
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white">
            Toda a sua operação
            <span className="block bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
              em um só lugar.
            </span>
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-300">
            Clientes, obras, agenda, financeiro, dízimo, documentos e atendimento remoto pelo WhatsApp.
            O WS SOLUÇÕES conecta cada lançamento ao cliente e à obra correspondente, sem redigitação.
          </p>
          <ul className="mt-6 grid gap-2.5 text-[0.8rem] text-slate-200 sm:grid-cols-2">
            {[
              "Dízimo automático de 10% sobre o recebido",
              "Resultado lucro/prejuízo por obra",
              "Prazos com alerta de atraso",
              "Assistente administrativo no WhatsApp",
              "Orçamentos, contratos e recibos",
              "Funciona offline com sincronização",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3 text-[0.68rem] text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5">
              <Smartphone size={12} /> Android / PWA
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5">
              <WifiOff size={12} /> Offline-first
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5">
              <ShieldCheck size={12} /> Sessão criptografada
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <WSLogo size={44} />
          </div>
          <LoginForm />
          <p className="mt-8 text-center text-[0.65rem] leading-relaxed text-slate-500">
            WS SOLUÇÕES · Sistema Inteligente de Gestão Empresarial
            <br />
            Acesso restrito a usuários autorizados. Todas as ações são registradas em auditoria.
          </p>
        </div>
      </div>
    </div>
  );
}
