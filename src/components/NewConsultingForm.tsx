"use client";

import { useState, useActionState } from "react";
import { createConsultingProjectAction } from "@/lib/actions";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

/**
 * Alta de un proyecto de consultoría (paso 1 del mapa: Comercial
 * transfiere el proyecto a Operaciones). Al crearlo nacen solas las
 * tareas de transferencia: revisar expediente, grupo de WhatsApp,
 * ficha interna y agendar la reunión de arranque.
 */
export function NewConsultingForm({
  clientId,
  people = [],
  currentUser = "",
}: {
  clientId: string;
  people?: string[];
  currentUser?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createConsultingProjectAction, null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-gradient-to-r from-brand-navy to-brand-cyan px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
      >
        + Nueva consultoría
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-brand-cyan/30 bg-white p-5 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-brand-navy">Nuevo proyecto de consultoría</h2>
        <button onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="client_id" value={clientId} />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Nombre del proyecto *</label>
          <input name="name" required placeholder="Ej. Diagnóstico de clima y cultura" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Fecha de autorización / transferencia</label>
          <input name="authorized_at" type="date" className={input} />
          <p className="mt-1 text-[11px] text-slate-400">Desde aquí corren los plazos de arranque (24-48h).</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Horas contratadas</label>
          <input name="contracted_hours" type="number" step="0.5" min="0" placeholder="Ej. 60" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Líder de proyecto</label>
          <select name="leader" defaultValue={currentUser} className={input}>
            <option value="">— Por asignar</option>
            {people.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Operaciones (revisiones y cierre)</label>
          <select
            name="internal_owner"
            defaultValue={people.find((p) => p.includes("Oliver")) ?? currentUser}
            className={input}
          >
            <option value="">— Por asignar</option>
            {people.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Comercial (transfiere el proyecto)</label>
          <select
            name="comercial"
            defaultValue={people.find((p) => p.includes("Perla")) ?? "Perla Torres"}
            className={input}
          >
            {!people.some((p) => p.includes("Perla")) && <option value="Perla Torres">Perla Torres</option>}
            {people.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Equipo consultor</label>
          <input
            name="team"
            placeholder="Nombres separados por coma"
            className={input}
            list="equipo-consultor"
          />
          <datalist id="equipo-consultor">
            {people.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Alcance</label>
          <textarea name="alcance" rows={2} placeholder="Qué incluye el proyecto…" className={input + " resize-y"} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Entregables pactados</label>
          <textarea name="entregables" rows={2} placeholder="Qué se entrega al cliente…" className={input + " resize-y"} />
        </div>
        {state?.error && (
          <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-cyan px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-60"
          >
            {pending ? "Creando…" : "Crear proyecto"}
          </button>
        </div>
      </form>
    </div>
  );
}
