"use client";

import { useState, useActionState } from "react";
import { createTrainingAction } from "@/lib/actions";
import { TRAINING_STATUSES } from "@/lib/constants";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

export function NewTrainingForm({ clientId, people = [] }: { clientId: string; people?: string[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createTrainingAction, null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-gradient-to-r from-brand-cyan to-brand-magenta px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
      >
        + Nueva capacitación
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-brand-cyan/30 bg-white p-5 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-brand-navy">Nueva capacitación</h2>
        <button onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="client_id" value={clientId} />
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Nombre corto *</label>
          <input name="short_name" required placeholder="Ej. Comunicación y Feedback" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Nombre oficial</label>
          <input name="official_name" placeholder="Como irá en constancias" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Estado</label>
          <select name="status" defaultValue="Propuesta" className={input}>
            {TRAINING_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Total de sesiones</label>
          <input
            name="total_sessions"
            type="number"
            min={1}
            max={30}
            placeholder="Se crearán automáticamente"
            className={input}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Responsable interno</label>
          {people.length > 0 ? (
            <select name="internal_owner" defaultValue="" className={input}>
              <option value="">— Sin responsable</option>
              {people.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          ) : (
            <input name="internal_owner" placeholder="Ej. Oliver" className={input} />
          )}
        </div>
        {state?.error && (
          <p className="sm:col-span-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-cyan px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-60"
          >
            {pending ? "Creando…" : "Crear capacitación"}
          </button>
        </div>
      </form>
    </div>
  );
}
