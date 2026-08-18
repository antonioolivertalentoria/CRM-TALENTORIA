"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  updateTrainingField,
  updateMaterialField,
  completeCustomTaskAction,
  deleteCustomTaskAction,
  updateCustomTaskAction,
  addTimeEntryAction,
  deleteTimeEntryAction,
  addSubtaskAction,
  toggleSubtaskAction,
  deleteSubtaskAction,
} from "@/lib/actions";
import { formatDate } from "@/lib/format";
import { TaskAttachments } from "./TaskAttachments";
import type { ComputedTask } from "@/lib/tasks";
import type { CustomTask, Subtask, TaskAttachment, TimeEntry } from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

/** "90" minutos → "1.5 h"; menos de una hora → "45 min". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.round((minutes / 60) * 10) / 10;
  return `${h % 1 === 0 ? h.toFixed(0) : h} h`;
}

/**
 * Cuadrito de tiempo por tarea: muestra el total registrado y, al abrirlo,
 * deja apuntar cuánto tardó cada quien (en horas; 1.5 = hora y media).
 * Los registros se conservan aunque la tarea se complete o desaparezca,
 * para poder sumar el tiempo invertido por persona.
 */
function TimeTracker({
  taskKey,
  taskTitle,
  entries,
}: {
  taskKey: string;
  taskTitle: string;
  entries: TimeEntry[];
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<TimeEntry[]>(entries);
  const [hours, setHours] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const totalMin = items.reduce((a, e) => a + e.minutes, 0);

  const add = () => {
    const h = parseFloat(hours.replace(",", "."));
    if (!hours || Number.isNaN(h)) {
      setError("Pon las horas, ej. 1.5");
      return;
    }
    startTransition(async () => {
      const res = await addTimeEntryAction({ taskKey, taskTitle, hours: h });
      if ("error" in res) {
        setError(res.error);
      } else {
        setItems((prev) => [...prev, res.entry]);
        setHours("");
        setError("");
      }
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await deleteTimeEntryAction(id);
      if (res?.error) setError(res.error);
      else setItems((prev) => prev.filter((e) => e.id !== id));
    });
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        title="Registrar cuánto tiempo tomó esta tarea"
        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
          totalMin > 0
            ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan-dark hover:bg-brand-cyan/20"
            : "border-slate-200 bg-white text-slate-400 hover:border-brand-cyan hover:text-brand-cyan-dark"
        }`}
      >
        ⏱ {totalMin > 0 ? formatMinutes(totalMin) : "+"}
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-20 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Tiempo invertido
          </p>
          {items.length > 0 && (
            <ul className="mb-2 space-y-1">
              {items.map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="min-w-0 flex-1 truncate">
                    {e.person || "Alguien"} · {formatDate(e.entry_date)}
                  </span>
                  <span className="font-semibold text-brand-cyan-dark">{formatMinutes(e.minutes)}</span>
                  <button
                    onClick={() => remove(e.id)}
                    disabled={pending}
                    title="Quitar registro"
                    className="text-slate-300 transition hover:text-red-500"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-1.5">
            <input
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Horas, ej. 1.5"
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-cyan"
            />
            <button
              onClick={add}
              disabled={pending}
              className="shrink-0 rounded-lg bg-brand-cyan px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-cyan-dark disabled:opacity-60"
            >
              {pending ? "…" : "Sumar"}
            </button>
          </div>
          {error && <p className="mt-1.5 text-[11px] text-red-500">{error}</p>}
          <button
            onClick={() => setOpen(false)}
            className="mt-2 text-[11px] text-slate-400 hover:text-slate-600"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

/** Subtareas de una tarea propia: lista con fechas y medidor de avance. */
function SubtasksEditor({ taskId, subtasks }: { taskId: string; subtasks: Subtask[] }) {
  const [items, setItems] = useState<Subtask[]>(subtasks);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const doneCount = items.filter((s) => s.done).length;

  const add = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await addSubtaskAction({ taskId, title, dueDate: date || null });
      if ("error" in res) {
        setError(res.error);
      } else {
        setItems((prev) => [...prev, res.subtask]);
        setTitle("");
        setDate("");
        setError("");
      }
    });
  };

  const toggle = (s: Subtask) => {
    startTransition(async () => {
      const res = await toggleSubtaskAction(s.id, !s.done);
      if (res?.error) setError(res.error);
      else setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, done: !s.done } : x)));
    });
  };

  const remove = (s: Subtask) => {
    startTransition(async () => {
      const res = await deleteSubtaskAction(s.id);
      if (res?.error) setError(res.error);
      else setItems((prev) => prev.filter((x) => x.id !== s.id));
    });
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-[11px] font-semibold text-slate-500">
          Subtareas {items.length > 0 && `(${doneCount} de ${items.length})`}
        </label>
        {items.length > 0 && (
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta transition-all"
              style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {items.length > 0 && (
        <ul className="mb-2 space-y-1">
          {items.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
            >
              <button
                onClick={() => toggle(s)}
                disabled={pending}
                title={s.done ? "Marcar pendiente" : "Marcar hecha"}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition ${
                  s.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-300 hover:border-brand-cyan"
                }`}
              >
                {s.done && (
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
              <span
                className={`min-w-0 flex-1 truncate text-xs font-medium ${
                  s.done ? "text-slate-400 line-through" : "text-slate-700"
                }`}
              >
                {s.title}
              </span>
              {s.due_date && (
                <span className="shrink-0 text-[11px] text-slate-400">{formatDate(s.due_date)}</span>
              )}
              <button
                onClick={() => remove(s)}
                disabled={pending}
                title="Eliminar subtarea"
                className="shrink-0 text-slate-300 transition hover:text-red-500"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-1.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Nueva subtarea…"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-cyan"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-cyan"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !title.trim()}
          className="shrink-0 rounded-lg bg-brand-cyan px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-cyan-dark disabled:opacity-50"
        >
          {pending ? "…" : "Agregar"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

/** Editor inline de una tarea propia (título, detalles, responsable, cliente, fecha). */
function CustomTaskEditor({
  task,
  people,
  clients,
  attachments,
  subtasks,
  onClose,
}: {
  task: CustomTask;
  people: string[];
  clients: { id: string; company: string }[];
  attachments: TaskAttachment[];
  subtasks: Subtask[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [details, setDetails] = useState(task.details);
  const [assignee, setAssignee] = useState(task.assignee);
  const [clientId, setClientId] = useState(task.client_id ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [notify, setNotify] = useState(task.notify_on_complete ?? false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const res = await updateCustomTaskAction(task.id, {
        title,
        details,
        assignee,
        client_id: clientId || null,
        due_date: dueDate || null,
        notify_on_complete: notify,
      });
      if (res?.error) setError(res.error);
      else onClose();
    });

  return (
    <div className="mt-2 w-full rounded-lg border border-brand-cyan/30 bg-slate-50/80 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-[11px] font-semibold text-slate-500">¿Qué hay que hacer?</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] font-semibold text-slate-500">Para quién es</label>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls}>
            <option value="">— Sin asignar</option>
            {people.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] font-semibold text-slate-500">Fecha límite</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-[11px] font-semibold text-slate-500">Cliente relacionado</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
            <option value="">Marca blanca / interno (sin cliente)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-[11px] font-semibold text-slate-500">Detalles</label>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} className={inputCls + " resize-y"} />
        </div>
        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-brand-cyan"
            />
            🔔 Avisar por correo a quien la pidió cuando se complete
          </label>
        </div>
        <div className="sm:col-span-2">
          <SubtasksEditor taskId={task.id} subtasks={subtasks} />
        </div>
        <div className="sm:col-span-2">
          <TaskAttachments taskId={task.id} attachments={attachments} />
        </div>
      </div>
      {error && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</p>
      )}
      <div className="mt-2 flex items-center gap-3">
        <button
          disabled={pending}
          onClick={save}
          className="rounded-lg bg-brand-cyan px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
    </div>
  );
}

const KIND_STYLE: Record<string, string> = {
  Logística: "bg-cyan-100 text-cyan-700",
  Preparación: "bg-sky-100 text-sky-700",
  Material: "bg-blue-100 text-blue-700",
  Revisión: "bg-violet-100 text-violet-700",
  Entrega: "bg-amber-100 text-amber-700",
  Seguimiento: "bg-emerald-100 text-emerald-700",
  Personal: "bg-rose-100 text-rose-700",
};

export function TasksList({
  tasks,
  people,
  clients = [],
  attachmentsByTask = {},
  timeByTask = {},
  allTimeEntries = [],
  subtasksByTask = {},
  currentUser,
  today,
}: {
  tasks: ComputedTask[];
  people: string[];
  clients?: { id: string; company: string }[];
  attachmentsByTask?: Record<string, TaskAttachment[]>;
  /** Registros de tiempo agrupados por task_key. */
  timeByTask?: Record<string, TimeEntry[]>;
  /** Todos los registros de tiempo (incluye tareas ya completadas), para la sumatoria. */
  allTimeEntries?: TimeEntry[];
  /** Subtareas agrupadas por id de tarea propia. */
  subtasksByTask?: Record<string, Subtask[]>;
  currentUser: string;
  today: string;
}) {
  const [filter, setFilter] = useState<string>(currentUser || "Todas");
  const [done, setDone] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
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
      } else if (task.complete.type === "material_status") {
        await updateMaterialField(
          task.complete.materialId,
          task.trainingId,
          "status",
          task.complete.nextStatus
        );
      } else {
        await completeCustomTaskAction(task.complete.taskId);
      }
      setDone((prev) => new Set(prev).add(task.key));
    });
  };

  const removeCustom = (task: ComputedTask) => {
    if (task.complete.type !== "custom_task") return;
    const taskId = task.complete.taskId;
    if (!confirm(`¿Eliminar la tarea "${task.title}"?`)) return;
    startTransition(async () => {
      await deleteCustomTaskAction(taskId);
      setDone((prev) => new Set(prev).add(task.key));
    });
  };

  const totalMinutes = allTimeEntries
    .filter((e) => filter === "Todas" || e.person === filter)
    .reduce((a, e) => a + e.minutes, 0);

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

        <span className="ml-auto flex flex-wrap items-center gap-2">
          {totalMinutes > 0 && (
            <span
              title={`Tiempo total registrado ${filter === "Todas" ? "por todo el equipo" : `por ${filter}`} (incluye tareas ya completadas)`}
              className="rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1.5 text-xs font-semibold text-brand-cyan-dark"
            >
              ⏱ {formatMinutes(totalMinutes)} registradas
            </span>
          )}
          <a
            href={`/api/reporte-semanal?persona=${encodeURIComponent(filter)}`}
            title={`PDF con las tareas ${filter === "Todas" ? "de todo el equipo" : `de ${filter}`} para los próximos 5 días hábiles`}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-magenta/40 bg-brand-magenta/10 px-3 py-1.5 text-xs font-semibold text-brand-magenta transition hover:bg-brand-magenta/20"
          >
            📄 Reporte semanal{filter !== "Todas" ? ` de ${filter.split(" ")[0]}` : ""} (PDF)
          </a>
        </span>
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
                        {t.custom && !isDone ? (
                          <button
                            onClick={() => setEditing(editing === t.key ? null : t.key)}
                            title="Abrir y editar la tarea"
                            className="text-left text-sm font-medium text-slate-800 hover:text-brand-cyan-dark hover:underline"
                          >
                            {t.title}
                          </button>
                        ) : (
                          <p className={`text-sm font-medium text-slate-800 ${isDone ? "line-through" : ""}`}>
                            {t.title}
                          </p>
                        )}
                        {t.trainingId ? (
                          <Link
                            href={`/capacitaciones/${t.trainingId}`}
                            className="text-xs text-slate-400 hover:text-brand-cyan-dark hover:underline"
                          >
                            {t.trainingName}
                            {t.clientName ? ` · ${t.clientName}` : ""}
                          </Link>
                        ) : (
                          <p className="text-xs text-slate-400">
                            {t.clientName}
                            {t.requestedBy ? ` · Pidió: ${t.requestedBy}` : ""}
                            {t.details ? ` — ${t.details}` : ""}
                            {t.custom && (attachmentsByTask[t.custom.id]?.length ?? 0) > 0 && (
                              <span className="ml-1.5 font-medium text-brand-cyan-dark">
                                📎 {attachmentsByTask[t.custom.id].length}
                              </span>
                            )}
                          </p>
                        )}
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

                      {t.custom && (subtasksByTask[t.custom.id]?.length ?? 0) > 0 && (
                        <span
                          title="Avance de subtareas"
                          className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500"
                        >
                          <span className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-200">
                            <span
                              className="block h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta"
                              style={{
                                width: `${Math.round(
                                  (subtasksByTask[t.custom.id].filter((s) => s.done).length /
                                    subtasksByTask[t.custom.id].length) *
                                    100
                                )}%`,
                              }}
                            />
                          </span>
                          {subtasksByTask[t.custom.id].filter((s) => s.done).length}/
                          {subtasksByTask[t.custom.id].length}
                        </span>
                      )}

                      <span
                        className={`shrink-0 text-xs font-semibold ${
                          overdue ? "text-red-600" : "text-slate-500"
                        }`}
                      >
                        {t.due ? formatDate(t.due) : "Sin fecha"}
                      </span>

                      <TimeTracker
                        taskKey={t.key}
                        taskTitle={t.title}
                        entries={timeByTask[t.key] ?? []}
                      />

                      {t.custom && !isDone && (
                        <button
                          title="Abrir y editar la tarea"
                          onClick={() => setEditing(editing === t.key ? null : t.key)}
                          className="shrink-0 text-slate-300 transition hover:text-brand-cyan-dark"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                      )}

                      {t.complete.type === "custom_task" && !isDone && (
                        <button
                          title="Eliminar tarea"
                          disabled={pending}
                          onClick={() => removeCustom(t)}
                          className="shrink-0 text-slate-300 transition hover:text-red-500"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}

                      {t.custom && editing === t.key && !isDone && (
                        <CustomTaskEditor
                          task={t.custom}
                          people={people}
                          clients={clients}
                          attachments={attachmentsByTask[t.custom.id] ?? []}
                          subtasks={subtasksByTask[t.custom.id] ?? []}
                          onClose={() => setEditing(null)}
                        />
                      )}
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
