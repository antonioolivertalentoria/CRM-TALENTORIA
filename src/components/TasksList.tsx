"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { updateTrainingField, updateMaterialField } from "@/lib/actions";
import { formatDate } from "@/lib/format";
import type { ComputedTask } from "@/lib/tasks";

const KIND_STYLE: Record<string, string> = {
  Logística: "bg-cyan-100 text-cyan-700",
  Preparación: "bg-sky-100 text-sky-700",
  Material: "bg-blue-100 text-blue-700",
  Revisión: "bg-violet-100 text-violet-700",
  Entrega: "bg-amber-100 text-amber-700",
  Seguimiento: "bg-emerald-100 text-emerald-700",
};

export function TasksList({
  tasks,
  people,
  currentUser,
  today,
}: {
  tasks: ComputedTask[];
  people: string[];
  currentUser: string;
  today: string;
}) {
  const [filter, setFilter] = useState<string>(currentUser || "Todas");
  const [done, setDone] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  // Las tareas sin responsable aparecen en el perfil de todos,
  // marcadas "sin asignar", para que nada se pierda.
  const visible = useMemo(
    () =>
      tasks.filter((t) => {
        if (filter === "Todas") return true;
        return t.assignee === filter || !t.assignee;
      }),
    [tasks, filter]
  );

  const groups = useMemo(() => {
    const overdue = visible.filter((t) => t.due && t.due < today && !done.has(t.key));
    const todayList = visible.filter((t) => t.due === today && !done.has(t.key));
    const upcoming = visible.filter((t) => (!t.due || t.due > today) && !done.has(t.key));
    const completed = visible.filter((t) => done.has(t.key));
    return [
      { label: "Vencidas", items: overdue, accent: "text-red-600" },
      { label: "Para hoy", items: todayList, accent: "text-brand-magenta" },
      { label: "Próximas", items: upcoming, accent: "text-slate-600" },
      { label: "Completadas ahora", items: completed, accent: "text-emerald-600" },
    ].filter((g) => g.items.length > 0);
  }, [visible, done, today]);

  const complete = (task: ComputedTask) => {
    startTransition(async () => {
      if (task.complete.type === "training_field") {
        await updateTrainingField(task.trainingId, task.complete.field, task.complete.value);
      } else {
        await updateMaterialField(
          task.complete.materialId,
          task.trainingId,
          "status",
          task.complete.nextStatus
        );
      }
      setDone((prev) => new Set(prev).add(task.key));
    });
  };

  return (
    <div className="space-y-6">
      {/* Filtro por persona */}
      <div className="flex flex-wrap items-center gap-2">
        {[...people, "Todas"].map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              filter === p
                ? "bg-gradient-to-r from-brand-cyan to-brand-magenta text-white shadow"
                : "border border-slate-300 bg-white text-slate-600 hover:border-brand-cyan"
            }`}
          >
            {p}
            {p !== "Todas" && (
              <span className="ml-1.5 opacity-75">
                {tasks.filter((t) => (t.assignee === p || !t.assignee) && !done.has(t.key)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-slate-600">🎉 Sin pendientes</p>
          <p className="mt-1 text-sm text-slate-400">
            Las tareas aparecen solas: materiales por preparar o revisar, mensaje de logística,
            entregas post-capacitación (máx. 48h hábiles) y seguimientos a 20/30 días.
          </p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.label}>
            <h2 className={`mb-2 text-sm font-bold uppercase tracking-wide ${g.accent}`}>
              {g.label}
              <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500">
                {g.items.length}
              </span>
            </h2>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <ul className="divide-y divide-slate-100">
                {g.items.map((t) => {
                  const isDone = done.has(t.key);
                  const overdue = !isDone && t.due && t.due < today;
                  return (
                    <li
                      key={t.key}
                      className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                        isDone ? "opacity-50" : "hover:bg-slate-50/70"
                      }`}
                    >
                      <button
                        disabled={pending || isDone}
                        onClick={() => complete(t)}
                        title="Marcar como completada"
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                          isDone
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 hover:border-brand-cyan"
                        } disabled:cursor-default`}
                      >
                        {isDone && (
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </button>

                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_STYLE[t.kind] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {t.kind}
                      </span>

                      <div className="min-w-48 flex-1">
                        <p className={`text-sm font-medium text-slate-800 ${isDone ? "line-through" : ""}`}>
                          {t.title}
                        </p>
                        <Link
                          href={`/capacitaciones/${t.trainingId}`}
                          className="text-xs text-slate-400 hover:text-brand-cyan-dark hover:underline"
                        >
                          {t.trainingName}
                          {t.clientName ? ` · ${t.clientName}` : ""}
                        </Link>
                      </div>

                      {!t.assignee ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          sin asignar
                        </span>
                      ) : (
                        filter === "Todas" && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                            {t.assignee}
                          </span>
                        )
                      )}

                      <span
                        className={`shrink-0 text-xs font-semibold ${
                          overdue ? "text-red-600" : "text-slate-500"
                        }`}
                      >
                        {t.due ? formatDate(t.due) : "Sin fecha"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
