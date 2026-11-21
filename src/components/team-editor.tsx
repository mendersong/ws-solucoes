"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { api, type ApiResult } from "@/lib/client";
import { Field, FormMessage, Modal } from "@/components/forms";
import { money } from "@/lib/format";

type Employee = { id: number; name: string; role: string; dailyRate: number };
type Current = { employeeId: number; days: number };

export function TeamEditor({
  serviceId,
  employees,
  current,
}: {
  serviceId: number;
  employees: Employee[];
  current: Current[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<number, { checked: boolean; days: number }>>(() => {
    const initial: Record<number, { checked: boolean; days: number }> = {};
    for (const employee of employees) {
      const found = current.find((item) => item.employeeId === employee.id);
      initial[employee.id] = { checked: Boolean(found), days: found?.days ?? 1 };
    }
    return initial;
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  const total = employees.reduce(
    (sum, employee) => (selected[employee.id]?.checked ? sum + employee.dailyRate * (selected[employee.id]?.days ?? 1) : sum),
    0,
  );

  const submit = async () => {
    setBusy(true);
    const team = employees
      .filter((employee) => selected[employee.id]?.checked)
      .map((employee) => ({ employeeId: employee.id, days: selected[employee.id]?.days ?? 1 }));
    const response = await api("/api/actions/service", {
      method: "POST",
      body: JSON.stringify({ action: "assign_team", serviceId, team }),
      label: "Atualizar equipe da obra",
    });
    setBusy(false);
    setResult(response);
    if (response.ok && !response.queued) {
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-ghost !py-1.5 !text-[0.72rem]">
        <Users size={13} /> Definir equipe
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Equipe da obra" subtitle="O custo da equipe entra automaticamente no resultado do serviço.">
        <div className="space-y-2">
          {employees.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum funcionário cadastrado. Cadastre em Funcionários.</p>
          ) : (
            employees.map((employee) => (
              <div key={employee.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                <label className="flex flex-1 items-center gap-2 text-[0.8rem] text-slate-200">
                  <input
                    type="checkbox"
                    checked={selected[employee.id]?.checked ?? false}
                    onChange={(event) =>
                      setSelected({
                        ...selected,
                        [employee.id]: { checked: event.target.checked, days: selected[employee.id]?.days ?? 1 },
                      })
                    }
                    className="h-4 w-4 accent-[#1d8bf0]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{employee.name}</span>
                    <span className="block text-[0.65rem] text-slate-400">
                      {employee.role || "Função não informada"} · diária {money(employee.dailyRate)}
                    </span>
                  </span>
                </label>
                <Field label="Dias" className="w-20">
                  <input
                    type="number"
                    min={1}
                    className="input !py-1"
                    value={selected[employee.id]?.days ?? 1}
                    onChange={(event) =>
                      setSelected({
                        ...selected,
                        [employee.id]: { checked: selected[employee.id]?.checked ?? false, days: Number(event.target.value) },
                      })
                    }
                  />
                </Field>
                <span className="w-24 text-right text-[0.75rem] font-semibold text-amber-200">
                  {selected[employee.id]?.checked ? money(employee.dailyRate * (selected[employee.id]?.days ?? 1)) : "—"}
                </span>
              </div>
            ))
          )}
          <div className="flex items-center justify-between rounded-lg border border-brand-400/25 bg-brand-500/[0.07] px-3 py-2 text-[0.8rem]">
            <span className="text-slate-300">Custo total da equipe</span>
            <span className="font-bold text-brand-200">{money(total)}</span>
          </div>
          <FormMessage result={result} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn btn-ghost">Cancelar</button>
            <button onClick={() => void submit()} disabled={busy} className="btn btn-primary">
              {busy ? "Salvando..." : "Salvar equipe"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
