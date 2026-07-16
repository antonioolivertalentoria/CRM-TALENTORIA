"use client";

import { useState, useActionState } from "react";
import { createTrainingAction } from "@/lib/actions";
import { TRAINING_STATUSES, PLATFORMS, EXTRA_FACILITATORS } from "@/lib/constants";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

export function NewTrainingForm({
  clientId,
  people = [],
  currentUser = "",
}: {
  clientId: string;
  people?: string[];
  currentUser?: string;
}) {
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState(0);
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
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setTotal(Number.isNaN(n) ? 0 : Math.min(Math.max(n, 0), 30));
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Responsable interno</label>
          {people.length > 0 ? (
            <select
              name="internal_owner"
              defaultValue={people.find((p) => p.includes("Oliver")) ?? currentUser}
              className={input}
            >
              <option value="">— Sin responsable</option>
              {people.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          ) : (
            <input name="internal_owner" placeholder="Ej. Oliver" className={input} />
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Facilitador(a)</label>
          <input
            name="facilitator"
            list="facilitadores"
            placeholder="Ej. Arianna, Caro, Rocío…"
            className={input}
          />
          <datalist id="facilitadores">
            {[...people, ...EXTRA_FACILITATORS].map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Modalidad</label>
          <select name="modality" defaultValue="" className={input}>
            <option value="">—</option>
            <option value="Presencial">Presencial</option>
            <option value="Online">Online</option>
            <option value="Mixta">Mixta (se define por sesión)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Hora inicio</label>
            <input name="start_time" type="time" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Hora cierre</label>
            <input name="end_time" type="time" className={input} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Plataforma (si es online)</label>
          <select name="platform" defaultValue="" className={input}>
            <option value="">—</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Liga de la sesión (Zoom/Meet)</label>
          <input name="session_link" type="url" placeholder="https://zoom.us/j/…" className={input} />
        </div>

        {total > 0 && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Fechas de las sesiones (puedes dejarlas vacías y ponerlas después)
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: total }, (_, i) => (
                <div key={i}>
                  <span className="mb-0.5 block text-[11px] font-medium text-slate-400">Sesión {i + 1}</span>
                  <input name={`session_date_${i + 1}`} type="date" className={input} />
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="sm:col-span-2 -mt-1 text-xs text-slate-400">
          Estos datos se aplican a todas las sesiones que se crean automáticamente; después puedes
          ajustar cada sesión por separado. El número de horas se calcula solo con los horarios.
        </p>
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
