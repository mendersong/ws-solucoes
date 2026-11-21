"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, CheckCircle2, Pencil, Play, Plus, Search, Trash2, XCircle } from "lucide-react";
import { api, type ApiResult } from "@/lib/client";
import { formatDateBR, money, toNum } from "@/lib/format";
import { Field, FormMessage, Modal } from "@/components/forms";
import { EmptyState, Panel, SectionTitle, Stars, StatusPill } from "@/components/ui";

export type ColumnFormat = "text" | "money" | "date" | "status" | "rating" | "number" | "datetime" | "upper";
export type ColumnDef = {
  key: string;
  label: string;
  format?: ColumnFormat;
  hideOnMobile?: boolean;
  className?: string;
};
export type RowActionDef = {
  label: string;
  path?: string;
  method?: "POST" | "PATCH";
  body?: Record<string, unknown>;
  idKey?: string;
  confirm?: string;
  icon?: "play" | "check" | "cancel" | "money";
  showWhen?: { key: string; equals?: string; notEquals?: string; filled?: boolean };
};
export type FieldType = "text" | "number" | "date" | "select" | "textarea" | "tel" | "email" | "time";
export type FieldDef = {
  key: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string;
  hint?: string;
  placeholder?: string;
  span?: 1 | 2 | 3;
};

type Row = { id: number; [key: string]: unknown };

function renderCell(row: Row, column: ColumnDef): ReactNode {
  const raw = row[column.key];
  switch (column.format) {
    case "money":
      return <span className="whitespace-nowrap font-medium tabular-nums text-slate-100">{money(toNum(raw))}</span>;
    case "date":
      return <span className="whitespace-nowrap tabular-nums text-slate-300">{formatDateBR(raw as string)}</span>;
    case "datetime":
      return <span className="whitespace-nowrap tabular-nums text-slate-300">{raw ? new Date(String(raw)).toLocaleDateString("pt-BR") : "—"}</span>;
    case "status":
      return <StatusPill status={String(raw ?? "")} />;
    case "rating":
      return <Stars value={Number(raw ?? 0)} />;
    case "number":
      return <span className="tabular-nums text-slate-200">{raw === null || raw === undefined ? "—" : String(raw)}</span>;
    case "upper":
      return <span className="text-[0.7rem] uppercase tracking-wide text-slate-400">{String(raw ?? "—")}</span>;
    default:
      return <span className="text-slate-200">{raw === null || raw === undefined || raw === "" ? "—" : String(raw)}</span>;
  }
}

function initialValues(fields: FieldDef[], row: Row | null, defaults?: Record<string, string>) {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const rowValue = row?.[field.key];
    values[field.key] =
      rowValue === null || rowValue === undefined
        ? defaults?.[field.key] ?? field.defaultValue ?? ""
        : String(rowValue);
  }
  return values;
}

export function CrudTable({
  endpoint,
  title,
  subtitle,
  rows,
  columns,
  fields,
  createLabel = "Novo registro",
  canWrite = true,
  detailPath,
  searchKeys = [],
  emptyText = "Nenhum registro encontrado.",
  defaults,
  headerExtra,
  modalWide = false,
  rowActions = [],
}: {
  endpoint: string;
  title: string;
  subtitle?: string;
  rows: Row[];
  columns: ColumnDef[];
  fields: FieldDef[];
  createLabel?: string;
  canWrite?: boolean;
  detailPath?: string;
  searchKeys?: string[];
  emptyText?: string;
  defaults?: Record<string, string>;
  headerExtra?: ReactNode;
  modalWide?: boolean;
  rowActions?: RowActionDef[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(fields, null, defaults));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const term = query.toLowerCase();
    return rows.filter((row) =>
      searchKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(term)),
    );
  }, [rows, query, searchKeys]);

  const openCreate = () => {
    setEditing(null);
    setValues(initialValues(fields, null, defaults));
    setResult(null);
    setOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setValues(initialValues(fields, row));
    setResult(null);
    setOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    setResult(null);
    const path = editing ? `/api/db/${endpoint}/${editing.id}` : `/api/db/${endpoint}`;
    const response = await api(path, {
      method: editing ? "PATCH" : "POST",
      body: JSON.stringify(values),
      label: `${editing ? "Editar" : "Criar"} ${title.toLowerCase()}`,
    });
    setBusy(false);
    setResult(response);
    if (response.ok) {
      setOpen(false);
      setValues(initialValues(fields, null, defaults));
      router.refresh();
    }
  };

  const remove = async (row: Row) => {
    if (!window.confirm("Confirmar exclusão deste registro? Esta ação fica registrada na auditoria.")) return;
    const response = await api(`/api/db/${endpoint}/${row.id}`, { method: "DELETE", label: `Excluir ${title}` });
    if (!response.ok) window.alert(response.error ?? "Não foi possível excluir.");
    router.refresh();
  };

  const runAction = async (row: Row, action: RowActionDef) => {
    if (action.confirm && !window.confirm(action.confirm)) return;
    const path = (action.path ?? `/api/db/${endpoint}/{id}`).replace("{id}", String(row.id));
    const payload: Record<string, unknown> = { ...(action.body ?? {}) };
    if (action.method !== "PATCH") payload[action.idKey ?? "serviceId"] = row.id;
    const response = await api(path, {
      method: action.method ?? "POST",
      body: JSON.stringify(payload),
      label: action.label,
    });
    if (!response.ok) window.alert(response.error ?? "Não foi possível concluir a ação.");
    router.refresh();
  };

  const visibleActions = (row: Row) =>
    rowActions.filter((action) => {
      if (!action.showWhen) return true;
      const value = String(row[action.showWhen.key] ?? "");
      if (action.showWhen.filled !== undefined) {
        return action.showWhen.filled ? value !== "" : value === "";
      }
      if (action.showWhen.equals !== undefined) return value === action.showWhen.equals;
      if (action.showWhen.notEquals !== undefined) return value !== action.showWhen.notEquals;
      return true;
    });

  const actionIcon = (icon?: RowActionDef["icon"]) => {
    if (icon === "play") return <Play size={12} />;
    if (icon === "check") return <CheckCircle2 size={12} />;
    if (icon === "cancel") return <XCircle size={12} />;
    if (icon === "money") return <Banknote size={12} />;
    return null;
  };

  return (
    <Panel>
      <SectionTitle
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {headerExtra}
            <div className="relative hidden sm:block">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar..."
                className="input !w-40 !py-1.5 !pl-8 !text-[0.75rem]"
              />
            </div>
            {canWrite ? (
              <button onClick={openCreate} className="btn btn-primary !py-1.5">
                <Plus size={13} /> {createLabel}
              </button>
            ) : null}
          </div>
        }
      />

      {result && !result.ok ? (
        <div className="mb-2">
          <FormMessage result={result} />
        </div>
      ) : null}
      {result?.queued ? (
        <div className="mb-2">
          <FormMessage result={result} />
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState title={emptyText} description="Cadastre um novo registro para começar." />
      ) : (
        <div className="table-wrap -mx-1">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className={column.hideOnMobile ? "hidden md:table-cell" : ""}>
                    {column.label}
                  </th>
                ))}
                <th className="w-20 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  {columns.map((column, index) => (
                    <td key={column.key} className={`${column.hideOnMobile ? "hidden md:table-cell" : ""} ${column.className ?? ""}`}>
                      {index === 0 && detailPath ? (
                        <Link href={`${detailPath}/${row.id}`} className="font-medium text-brand-200 hover:underline">
                          {String(row[column.key] ?? "—")}
                        </Link>
                      ) : (
                        renderCell(row, column)
                      )}
                    </td>
                  ))}
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      {visibleActions(row).map((action) => (
                        <button
                          key={action.label}
                          onClick={() => void runAction(row, action)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-brand-500/15 hover:text-brand-200"
                          title={action.label}
                        >
                          {actionIcon(action.icon)}
                        </button>
                      ))}
                      {canWrite ? (
                        <button onClick={() => openEdit(row)} className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-brand-200" title="Editar">
                          <Pencil size={13} />
                        </button>
                      ) : null}
                      {canWrite ? (
                        <button onClick={() => void remove(row)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-300" title="Excluir">
                          <Trash2 size={13} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Editar ${title.toLowerCase()}` : createLabel}
        subtitle="Os dados compartilhados entre módulos são reaproveitados automaticamente."
        wide={modalWide}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              hint={field.hint}
              className={field.span === 2 ? "sm:col-span-2" : field.span === 3 ? "sm:col-span-2 lg:col-span-3" : ""}
            >
              {field.type === "select" ? (
                <select
                  className="input"
                  value={values[field.key] ?? ""}
                  onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                  required={field.required}
                >
                  <option value="">Selecione...</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  className="input min-h-[70px]"
                  value={values[field.key] ?? ""}
                  onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                  placeholder={field.placeholder}
                />
              ) : (
                <input
                  className="input"
                  type={field.type ?? "text"}
                  step={field.type === "number" ? "0.01" : undefined}
                  value={values[field.key] ?? ""}
                  onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              )}
            </Field>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <FormMessage result={result} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn btn-ghost">
              Cancelar
            </button>
            <button onClick={() => void submit()} disabled={busy} className="btn btn-primary">
              {busy ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar"}
            </button>
          </div>
        </div>
      </Modal>
    </Panel>
  );
}
