"use client";

import { useState, useActionState } from "react";
import { createCustomTaskAction } from "@/lib/actions";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

/**
 * Tareas propias: lo que pide la jefa, lo que se le pide a ella,
 * pendientes de marca blanca o de algún cliente. Se mezclan con las
 * tareas automáticas en la misma lista.
 */
export function NewTaskForm({
  people,
  clients,
  currentUser = "",
}: {
  people: string[];
  clients: { id: string; company: string }[];
  currentUser?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createCustomTaskAction, null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-gradient-to-r from-brand-cyan to-brand-magenta px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
      >
        + Nueva tarea
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-brand-cyan/30 bg-white p-5 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-brand-navy">Nueva tarea</h2>
        <button onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
      <form
        action={(fd) => {
          formAction(fd);
          setOpen(false);
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">¿Qué hay que hacer? *</label>
          <input name="title" required placeholder="Ej. Preparar propuesta de teambuilding" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Para quién es la tarea</label>
          <select name="assignee" defaultValue={currentUser} className={input}>
            <option value="">— Sin asignar</option>
            {people.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Fecha límite</label>
          <input name="due_date" type="date" className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Cliente relacionado</label>
          <select name="client_id" defaultValue="" className={input}>
            <option value="">Marca blanca / interno (sin cliente)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Detalles (opcional)</label>
          <textarea name="details" rows={3} placeholder="Contexto, links, lo que haga falta…" className={input + " resize-y"} />
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
            {pending ? "Guardando…" : "Crear tarea"}
          </button>
        </div>
      </form>
    </div>
  );
}
