"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, ShieldCheck, UserX } from "lucide-react";
import { api, type ApiResult } from "@/lib/client";
import { Field, FormMessage, Modal } from "@/components/forms";
import { Badge, Panel, SectionTitle, StatusPill } from "@/components/ui";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string;
  active: boolean;
  createdAt: string;
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  financeiro: "Financeiro",
  funcionario: "Funcionário",
};

export function UsersManager({ users, currentUserId }: { users: UserRow[]; currentUserId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "financeiro", phone: "" });

  const submit = async () => {
    setBusy(true);
    setResult(null);
    const response = await api("/api/users", {
      method: "POST",
      body: JSON.stringify({ action: "create", ...form }),
      label: "Criar usuário",
      queueIfOffline: false,
    });
    setBusy(false);
    setResult(response);
    if (response.ok) {
      setForm({ name: "", email: "", password: "", role: "financeiro", phone: "" });
      setOpen(false);
      router.refresh();
    }
  };

  const update = async (id: number, payload: Record<string, unknown>) => {
    const response = await api("/api/users", {
      method: "POST",
      body: JSON.stringify({ action: "update", id, ...payload }),
      queueIfOffline: false,
    });
    if (!response.ok) window.alert(response.error ?? "Não foi possível atualizar.");
    router.refresh();
  };

  const resetPassword = (user: UserRow) => {
    const password = window.prompt(`Nova senha para ${user.name} (mínimo 6 caracteres):`);
    if (!password) return;
    void update(user.id, { password, role: user.role, active: user.active, name: user.name, email: user.email });
  };

  const remove = async (user: UserRow) => {
    if (!window.confirm(`Excluir o usuário ${user.name}?`)) return;
    const response = await api("/api/users", {
      method: "POST",
      body: JSON.stringify({ action: "delete", id: user.id }),
      queueIfOffline: false,
    });
    if (!response.ok) window.alert(response.error ?? "Não foi possível excluir.");
    router.refresh();
  };

  return (
    <Panel>
      <SectionTitle
        title="Usuários e permissões"
        subtitle="Controle de acesso por perfil com registro de auditoria de cada ação"
        icon={<ShieldCheck size={16} />}
        action={
          <button onClick={() => setOpen(true)} className="btn btn-primary !py-1.5">
            <Plus size={13} /> Novo usuário
          </button>
        }
      />
      {result && !result.ok ? <div className="mb-2"><FormMessage result={result} /></div> : null}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th className="hidden sm:table-cell">Telefone</th><th>Situação</th><th className="text-right">Ações</th></tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="font-medium text-slate-100">{user.name}{user.id === currentUserId ? <span className="ml-1.5 text-[0.62rem] text-brand-300">(você)</span> : null}</td>
                <td className="text-slate-300">{user.email}</td>
                <td><Badge tone={user.role === "admin" ? "purple" : user.role === "financeiro" ? "blue" : "slate"}>{ROLE_LABEL[user.role] ?? user.role}</Badge></td>
                <td className="hidden sm:table-cell text-slate-400">{user.phone || "—"}</td>
                <td><StatusPill status={user.active ? "ativo" : "bloqueado"} /></td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => void update(user.id, { role: user.role, active: !user.active, name: user.name, email: user.email })}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-brand-200"
                      title={user.active ? "Desativar" : "Ativar"}
                    >
                      <UserX size={13} />
                    </button>
                    <button onClick={() => resetPassword(user)} className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-amber-200" title="Redefinir senha">
                      <KeyRound size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo usuário" subtitle="Administrador: acesso completo · Financeiro: financeiro e documentos · Funcionário: obras e agenda.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" className="sm:col-span-2">
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="E-mail">
            <input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </Field>
          <Field label="Senha (mín. 6 caracteres)">
            <input className="input" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </Field>
          <Field label="Perfil">
            <select className="input" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="admin">Administrador</option>
              <option value="financeiro">Financeiro</option>
              <option value="funcionario">Funcionário</option>
            </select>
          </Field>
          <Field label="Telefone">
            <input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
        </div>
        <div className="mt-3 space-y-2">
          <FormMessage result={result} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn btn-ghost">Cancelar</button>
            <button onClick={() => void submit()} disabled={busy} className="btn btn-primary">{busy ? "Criando..." : "Criar usuário"}</button>
          </div>
        </div>
      </Modal>
    </Panel>
  );
}
