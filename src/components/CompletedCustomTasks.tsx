"use client";

import { useState, useTransition } from "react";
import { reopenCustomTaskAction, deleteCustomTaskAction } from "@/lib/actions";
import { formatDate } from "@/lib/format";
import type { CustomTask } from "@/lib/types";

type TaskWithClient = CustomTask & { clients?: { id: string; company: string } | null };

/**
 * Historial de tareas propias completadas: se pueden reabrir (vuelven a la
 * lista de pendientes para seguir trabajándolas) o eliminar definitivamente.
 */
export function CompletedCustomTasks({ tasks }: { tasks: TaskWithClient[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (tasks.length === 0) return null;

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 hover:text-brand-cyan-dark"
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        Tareas propias completadas
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500">
          {tasks.length}
        </span>
      </button>

      {open && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-slate-50/70">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500 text-white">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
                <div className="min-w-48 flex-1">
                  <p className="text-sm font-medium text-slate-600 line-through">{t.title}</p>
                  <p className="text-xs text-slate-400">
                    {t.clients?.company ?? "Marca blanca / interno"}
                    {t.assignee ? ` · ${t.assignee}` : ""}
                    {t.completed_at ? ` · Completada el ${formatDate(t.completed_at.slice(0, 10))}` : ""}
                  </p>
                </div>
                <button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await reopenCustomTaskAction(t.id);
                    })
                  }
                  className="shrink-0 rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1 text-xs font-semibold text-brand-cyan-dark transition hover:bg-brand-cyan/20 disabled:opacity-60"
                >
                  ↺ Reabrir
                </button>
                <button
                  title="Eliminar definitivamente"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`¿Eliminar definitivamente "${t.title}"?`)) {
                      startTransition(() => deleteCustomTaskAction(t.id));
                    }
                  }}
                  className="shrink-0 text-slate-300 transition hover:text-red-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
