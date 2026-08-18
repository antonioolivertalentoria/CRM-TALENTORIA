"use client";

import { useState, useTransition } from "react";
import {
  addTrainingRequestAction,
  toggleTrainingRequestAction,
  deleteTrainingRequestAction,
} from "@/lib/actions";
import { formatDate } from "@/lib/format";
import type { TrainingRequest } from "@/lib/types";

const inputCls =
  "rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

/**
 * Peticiones de un team building: lo que el cliente pide preparar
 * (gafetes, tarjetas, premios, lonas… cambia cada vez). Se palomean aquí
 * y las pendientes con responsable aparecen también en "Mis tareas".
 */
export function RequestsSection({
  trainingId,
  requests,
  people,
}: {
  trainingId: string;
  requests: TrainingRequest[];
  people: string[];
}) {
  const [items, setItems] = useState<TrainingRequest[]>(requests);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const doneCount = items.filter((r) => r.done).length;

  const add = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await addTrainingRequestAction({
        trainingId,
        title,
        assignee,
        dueDate: date || null,
      });
      if ("error" in res) {
        setError(res.error);
      } else {
        setItems((prev) => [...prev, res.request]);
        setTitle("");
        setDate("");
        setError("");
      }
    });
  };

  const toggle = (r: TrainingRequest) => {
    startTransition(async () => {
      const res = await toggleTrainingRequestAction(r.id, !r.done);
      if (res?.error) setError(res.error);
      else setItems((prev) => prev.map((x) => (x.id === r.id ? { ...x, done: !r.done } : x)));
    });
  };

  const remove = (r: TrainingRequest) => {
    if (!confirm(`¿Eliminar la petición "${r.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteTrainingRequestAction(r.id);
      if (res?.error) setError(res.error);
      else setItems((prev) => prev.filter((x) => x.id !== r.id));
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Peticiones del cliente ({doneCount} de {items.length})
        </h2>
        {items.length > 0 && (
          <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta transition-all"
              style={{ width: `${items.length ? Math.round((doneCount / items.length) * 100) : 0}%` }}
            />
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="mb-3 text-xs text-slate-400">
          Lo que hay que preparar o conseguir para el evento (gafetes, tarjetas, premios, lonas…).
          Las pendientes con responsable aparecen también en &quot;Mis tareas&quot; y en el reporte semanal.
        </p>

        {items.length > 0 && (
          <ul className="mb-3 space-y-1.5">
            {items.map((r) => (
              <li
                key={r.id}
                className={`flex flex-wrap items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 ${
                  r.done ? "opacity-60" : ""
                }`}
              >
                <button
                  onClick={() => toggle(r)}
                  disabled={pending}
                  title={r.done ? "Marcar pendiente" : "Marcar lista"}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    r.done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 hover:border-brand-cyan"
                  }`}
                >
                  {r.done && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
                <span
                  className={`min-w-0 flex-1 text-sm font-medium ${
                    r.done ? "text-slate-400 line-through" : "text-slate-800"
                  }`}
                >
                  {r.title}
                </span>
                {r.assignee && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                    {r.assignee}
                  </span>
                )}
                {r.due_date && (
                  <span className="shrink-0 text-xs font-semibold text-slate-500">
                    {formatDate(r.due_date)}
                  </span>
                )}
                <button
                  onClick={() => remove(r)}
                  disabled={pending}
                  title="Eliminar petición"
                  className="shrink-0 text-slate-300 transition hover:text-red-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Nueva petición, ej. 40 gafetes con nombre…"
            className={`${inputCls} min-w-52 flex-1`}
          />
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls}>
            <option value="">— Responsable</option>
            {people.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          <button
            onClick={add}
            disabled={pending || !title.trim()}
            className="rounded-lg bg-brand-cyan px-3.5 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-50"
          >
            {pending ? "…" : "Agregar"}
          </button>
        </div>
        {error && (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
