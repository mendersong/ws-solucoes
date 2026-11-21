"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Field, FormMessage } from "@/components/forms";
import { api, type ApiResult } from "@/lib/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@wssolucoes.com.br");
  const [password, setPassword] = useState("ws123456");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    const response = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      queueIfOffline: false,
    });
    setLoading(false);
    if (!response.ok) {
      setResult({ ok: false, error: response.error });
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="panel p-5 sm:p-6">
      <h2 className="text-lg font-bold tracking-tight text-white">Entrar no sistema</h2>
      <p className="mb-5 mt-1 text-xs text-slate-400">Use suas credenciais corporativas para acessar o painel.</p>

      <div className="space-y-3.5">
        <Field label="E-mail">
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field label="Senha">
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
      </div>

      {result ? <div className="mt-4"><FormMessage result={result} /></div> : null}

      <button type="submit" disabled={loading} className="btn btn-primary mt-5 w-full !py-2.5">
        <LogIn size={15} />
        {loading ? "Entrando..." : "Acessar painel"}
      </button>

      <div className="mt-4 rounded-xl border border-brand-400/20 bg-brand-500/[0.06] px-3 py-2.5 text-[0.7rem] leading-relaxed text-slate-300">
        <p className="font-semibold text-brand-200">Acesso de demonstração</p>
        <p>Administrador: admin@wssolucoes.com.br · senha ws123456</p>
        <p className="mt-1 text-slate-400">Perfis financeiro e funcionário podem ser criados em Configurações com permissões restritas.</p>
      </div>
    </form>
  );
}
