"use client";

import { useState, useTransition, useActionState } from "react";
import {
  createMaterialAction,
  updateMaterialField,
  deleteMaterialAction,
} from "@/lib/actions";
import { MATERIAL_TYPES, MATERIAL_STATUSES } from "@/lib/constants";
import { StatusSelect } from "./StatusSelect";
import { EditableField } from "./EditableField";
import type { Material } from "@/lib/types";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

const TYPE_ICON: Record<string, string> = {
  PPT: "📊",
  "Manual participante": "📘",
  "Manual ejercicios": "📝",
  Temario: "📋",
  "Lista participantes": "👥",
  Encuesta: "📈",
  Constancias: "🎓",
  Otro: "📎",
};

export function MaterialsSection({
  trainingId,
  materials,
}: {
  trainingId: string;
  materials: Material[];
}) {
  const [adding, setAdding] = useState(false);
  const [state, formAction, pending] = useActionState(createMaterialAction, null);
  const [, startTransition] = useTransition();

  const save = (id: string, field: string) => (value: string) =>
    updateMaterialField(id, trainingId, field, value);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Materiales del proyecto ({materials.length})
        </h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg bg-brand-magenta px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-brand-magenta-dark"
        >
          {adding ? "Cancelar" : "+ Agregar material"}
        </button>
      </div>

      {adding && (
        <form
          action={(fd) => {
            formAction(fd);
            setAdding(false);
          }}
          className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-4"
        >
          <input type="hidden" name="training_id" value={trainingId} />
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Tipo</label>
            <select name="type" className={input}>
              {MATERIAL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Nombre *</label>
            <input name="name" required placeholder="Ej. PPT Sesión 1" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Link (Google Drive)</label>
            <input name="url" type="url" placeholder="https://drive.google.com/…" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Estado</label>
            <select name="status" className={input}>
              {MATERIAL_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {state?.error && (
            <p className="sm:col-span-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}
          <div className="sm:col-span-4">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-cyan px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar material"}
            </button>
          </div>
        </form>
      )}

      {materials.length === 0 && !adding ? (
        <p className="p-6 text-center text-sm text-slate-400">
          Aquí vivirán las PPTs, manuales y demás materiales (links de Google Drive), siempre a la mano.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {materials.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60">
              <span className="text-lg" title={m.type}>{TYPE_ICON[m.type] ?? "📎"}</span>
              <div className="min-w-40 flex-1">
                <EditableField value={m.name} onSave={save(m.id, "name")} className="font-medium text-brand-navy" />
                <p className="px-2 text-[11px] uppercase tracking-wide text-slate-400">{m.type}</p>
              </div>
              <div className="min-w-56 flex-1">
                {m.url ? (
                  <div className="flex items-center gap-1.5">
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1 text-xs font-semibold text-brand-cyan-dark transition hover:bg-brand-cyan/20"
                    >
                      Abrir en Drive
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  </div>
                ) : (
                  <EditableField value={m.url} type="url" onSave={save(m.id, "url")} placeholder="Pega el link de Drive…" />
                )}
              </div>
              <StatusSelect
                value={m.status}
                options={MATERIAL_STATUSES}
                onChange={save(m.id, "status")}
                small
              />
              <button
                title="Eliminar material"
                onClick={() => {
                  if (confirm(`¿Eliminar "${m.name}"?`)) {
                    startTransition(() => deleteMaterialAction(m.id, trainingId));
                  }
                }}
                className="text-slate-300 transition hover:text-red-500"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
