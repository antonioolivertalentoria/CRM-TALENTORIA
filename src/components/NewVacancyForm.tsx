"use client";

import { useState, useActionState } from "react";
import { createVacancyAction } from "@/lib/actions";
import { VACANCY_MODALITIES } from "@/lib/constants";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

/**
 * Alta de una vacante (pasos 1-4 del flujo: el cliente autoriza la
 * cotización, comercial manda la requisición y el reclutador la recibe).
 * Al crearla nacen solas las tareas de anticipo, requisición, contacto
 * con el cliente y levantamiento de perfil con sus plazos de 24 y 48 horas.
 */
export function NewVacancyForm({
  clientId,
  people = [],
  currentUser = "",
}: {
  clientId: string;
  people?: string[];
  currentUser?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createVacancyAction, null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-gradient-to-r from-brand-navy to-brand-magenta px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
      >
        + Nueva vacante
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-brand-magenta/30 bg-white p-5 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-brand-navy">Nueva vacante de reclutamiento</h2>
        <button onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="client_id" value={clientId} />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Puesto solicitado *</label>
          <input name="position" required placeholder="Ej. Gerente de Recursos Humanos" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">
            Fecha en que el reclutador recibe la requisición
          </label>
          <input name="requisition_at" type="date" className={input} />
          <p className="mt-1 text-[11px] text-slate-400">
            Es el inicio de tiempos: desde aquí corren los plazos de 24 y 48 horas.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">
            Fecha en que el cliente autorizó la cotización
          </label>
          <input name="quote_authorized_at" type="date" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Reclutador</label>
          <select name="recruiter" defaultValue={currentUser} className={input}>
            <option value="">— Por asignar</option>
            {people.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Comercial</label>
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
          <label className="mb-1 block text-xs font-semibold text-slate-500">Operaciones (respaldo)</label>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Plazas</label>
            <input name="openings" type="number" min="1" defaultValue={1} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500" title="Días naturales de garantía sobre la contratación">
              Garantía (días)
            </label>
            <input name="guarantee_days" type="number" min="0" defaultValue={90} className={input} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Sueldo ofrecido</label>
          <input name="salary" placeholder="Ej. $35,000 brutos + prestaciones" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Ubicación</label>
          <input name="location" placeholder="Ej. Monterrey, N.L." className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Modalidad</label>
          <select name="modality" defaultValue="Por definir" className={input}>
            {VACANCY_MODALITIES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500" title="Tope de gasto en medios de publicación">
            Presupuesto de reclutamiento
          </label>
          <input name="budget" type="number" step="0.01" min="0" placeholder="Ej. 5000" className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Perfil solicitado</label>
          <textarea
            name="perfil"
            rows={2}
            placeholder="Lo que se sepa por ahora; se completa en el levantamiento con el cliente…"
            className={input + " resize-y"}
          />
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
            className="rounded-lg bg-brand-magenta px-4 py-2 text-sm font-semibold text-white shadow transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Creando…" : "Abrir vacante"}
          </button>
        </div>
      </form>
    </div>
  );
}
