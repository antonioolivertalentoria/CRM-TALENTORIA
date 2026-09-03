"use client";

import { useState, useTransition } from "react";
import {
  addConsultingMilestoneAction,
  updateConsultingMilestoneField,
  deleteConsultingMilestoneAction,
  addConsultingInputAction,
  setConsultingInputReceived,
  deleteConsultingInputAction,
  addConsultingChangeAction,
  updateConsultingChangeField,
  deleteConsultingChangeAction,
  addConsultingSessionAction,
  updateConsultingSessionField,
  deleteConsultingSessionAction,
  deleteConsultingProjectAction,
} from "@/lib/actions";
import {
  MILESTONE_STATUSES,
  CHANGE_STATUSES,
  CONSULTING_SESSION_STATUSES,
  MODALITIES,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { EditableField } from "./EditableField";
import { StatusSelect } from "./StatusSelect";
import { ConsultingItemFiles } from "./ConsultingAttachments";
import type {
  ConsultingAttachment,
  ConsultingChange,
  ConsultingInput,
  ConsultingMilestone,
  ConsultingSession,
} from "@/lib/types";

const inputCls =
  "rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

const trashIcon = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

/** Hitos del plan de trabajo (pasos 11 y 17-21 del mapa). */
export function MilestonesSection({
  projectId,
  milestones,
  people,
  filesByMilestone = {},
}: {
  projectId: string;
  milestones: ConsultingMilestone[];
  people: string[];
  filesByMilestone?: Record<string, ConsultingAttachment[]>;
}) {
  const [title, setTitle] = useState("");
  const [responsible, setResponsible] = useState("");
  const [date, setDate] = useState("");
  const [hours, setHours] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const save = (id: string, field: string) => (value: string) =>
    updateConsultingMilestoneField(id, projectId, field, value);

  const add = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await addConsultingMilestoneAction({
        projectId,
        title,
        responsible,
        dueDate: date || null,
        estHours: hours ? Number(hours) || null : null,
      });
      if ("error" in res) setError(res.error);
      else {
        setTitle("");
        setDate("");
        setHours("");
        setError("");
      }
    });
  };

  const remove = (m: ConsultingMilestone) => {
    if (!confirm(`¿Eliminar el hito "${m.title}"?`)) return;
    startTransition(async () => {
      await deleteConsultingMilestoneAction(m.id, projectId);
    });
  };

  const done = milestones.filter((m) => m.status === "Entregado").length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Plan de trabajo — hitos ({done} de {milestones.length})
        </h2>
        {milestones.length > 0 && (
          <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta transition-all"
              style={{ width: `${milestones.length ? Math.round((done / milestones.length) * 100) : 0}%` }}
            />
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="mb-3 text-xs text-slate-400">
          Cada hito genera su tarea al responsable. Al ponerlo &quot;Por revisar&quot; se crea la tarea de
          revisión técnica de Operaciones (1 día hábil); al aprobarla queda &quot;Entregado&quot;. Con el
          clip 📎 sube lo que ya está listo de cada hito (queda como entregable del proyecto).
        </p>

        {milestones.length > 0 && (
          <div className="mb-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="min-w-52 px-2 py-2 font-semibold">Hito / actividad</th>
                  <th className="w-40 px-2 py-2 font-semibold">Responsable</th>
                  <th className="w-36 px-2 py-2 font-semibold">Fecha</th>
                  <th className="w-24 px-2 py-2 font-semibold">Horas est.</th>
                  <th className="w-36 px-2 py-2 font-semibold">Estado</th>
                  <th className="w-16 px-2 py-2 font-semibold" title="Entregables listos de este hito">📎</th>
                  <th className="w-10 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/60">
                    <td className="px-1 py-1.5">
                      <EditableField value={m.title} onSave={save(m.id, "title")} />
                    </td>
                    <td className="px-1 py-1.5">
                      <EditableField
                        value={m.responsible}
                        onSave={save(m.id, "responsible")}
                        placeholder="Nombre"
                        suggestions={people}
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <EditableField value={m.due_date ?? ""} type="date" onSave={save(m.id, "due_date")} />
                    </td>
                    <td className="px-1 py-1.5">
                      <EditableField value={m.est_hours?.toString() ?? ""} type="number" onSave={save(m.id, "est_hours")} />
                    </td>
                    <td className="px-2 py-1.5 pt-2">
                      <StatusSelect value={m.status} options={MILESTONE_STATUSES} onChange={save(m.id, "status")} small />
                    </td>
                    <td className="px-2 py-1.5 pt-2">
                      <ConsultingItemFiles
                        projectId={projectId}
                        category="entregable"
                        milestoneId={m.id}
                        files={filesByMilestone[m.id] ?? []}
                      />
                    </td>
                    <td className="px-2 py-1.5 pt-2.5">
                      <button onClick={() => remove(m)} disabled={pending} title="Eliminar hito" className="text-slate-300 transition hover:text-red-500">
                        {trashIcon}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Nuevo hito, ej. Levantamiento de información…"
            className={`${inputCls} min-w-52 flex-1`}
          />
          <select value={responsible} onChange={(e) => setResponsible(e.target.value)} className={inputCls}>
            <option value="">— Responsable</option>
            {people.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          <input
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="Horas"
            inputMode="decimal"
            className={`${inputCls} w-20`}
          />
          <button
            onClick={add}
            disabled={pending || !title.trim()}
            className="rounded-lg bg-brand-cyan px-3.5 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-50"
          >
            {pending ? "…" : "Agregar"}
          </button>
        </div>
        {error && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</p>}
      </div>
    </section>
  );
}

/**
 * Sesiones del proyecto (migración 017). Arranque y entrega viven arriba,
 * en la ficha, porque de sus fechas cuelgan los plazos del mapa. Aquí van
 * todas las demás, sin límite: diagnóstico, avances, talleres, cierre…
 * Cada sesión con fecha y hora manda su invitación de calendario al equipo.
 */
export function ConsultingSessionsSection({
  projectId,
  sessions,
  people,
}: {
  projectId: string;
  sessions: ConsultingSession[];
  people: string[];
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [modality, setModality] = useState<string>("Online");
  const [facilitator, setFacilitator] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const save = (id: string, field: string) => (value: string) =>
    updateConsultingSessionField(id, projectId, field, value);

  const add = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await addConsultingSessionAction({
        projectId,
        title,
        sessionDate: date || null,
        startTime: start || null,
        endTime: end || null,
        modality,
        facilitator,
      });
      if ("error" in res) setError(res.error);
      else {
        setTitle("");
        setDate("");
        setStart("");
        setEnd("");
        setError("");
      }
    });
  };

  const remove = (s: ConsultingSession) => {
    if (
      !confirm(
        `¿Eliminar la sesión "${s.title}"?\n\nSi ya estaba en el calendario del equipo, se manda la cancelación.`
      )
    )
      return;
    startTransition(async () => {
      await deleteConsultingSessionAction(s.id, projectId);
    });
  };

  const active = sessions.filter((s) => s.status !== "Cancelada");
  const held = sessions.filter((s) => s.status === "Realizada").length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Sesiones del proyecto ({held} de {active.length} realizadas)
        </h2>
      </div>
      <div className="p-4">
        <p className="mb-3 text-xs text-slate-400">
          Agrega las sesiones que haga falta además del arranque y la entrega: diagnóstico,
          avances, talleres, cierre… Al capturar fecha y hora se manda la invitación de
          calendario al equipo; si la mueves, llega la actualización sola.
        </p>

        {sessions.length > 0 && (
          <div className="mb-3 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="min-w-48 px-2 py-2 font-semibold">Sesión</th>
                  <th className="w-36 px-2 py-2 font-semibold">Fecha</th>
                  <th className="w-24 px-2 py-2 font-semibold">Inicio</th>
                  <th className="w-24 px-2 py-2 font-semibold">Fin</th>
                  <th className="w-32 px-2 py-2 font-semibold">Modalidad</th>
                  <th className="w-36 px-2 py-2 font-semibold">Quién la lleva</th>
                  <th className="w-40 px-2 py-2 font-semibold">Liga o lugar</th>
                  <th className="w-32 px-2 py-2 font-semibold">Estado</th>
                  <th className="w-10 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    className={`border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/60 ${
                      s.status === "Cancelada" ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-1 py-1.5">
                      <EditableField value={s.title} onSave={save(s.id, "title")} />
                    </td>
                    <td className="px-1 py-1.5">
                      <EditableField value={s.session_date ?? ""} type="date" onSave={save(s.id, "session_date")} />
                    </td>
                    <td className="px-1 py-1.5">
                      <EditableField value={s.start_time?.slice(0, 5) ?? ""} type="time" onSave={save(s.id, "start_time")} />
                    </td>
                    <td className="px-1 py-1.5">
                      <EditableField value={s.end_time?.slice(0, 5) ?? ""} type="time" onSave={save(s.id, "end_time")} />
                    </td>
                    <td className="px-2 py-1.5 pt-2">
                      <StatusSelect
                        value={s.modality || "Online"}
                        options={MODALITIES}
                        onChange={save(s.id, "modality")}
                        small
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <EditableField
                        value={s.facilitator}
                        onSave={save(s.id, "facilitator")}
                        placeholder="Nombre"
                        suggestions={people}
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      {s.modality === "Presencial" ? (
                        <EditableField
                          value={s.platform}
                          onSave={save(s.id, "platform")}
                          placeholder="Lugar o sala"
                        />
                      ) : (
                        <EditableField
                          value={s.session_link}
                          type="url"
                          onSave={save(s.id, "session_link")}
                          placeholder="Liga de la sesión"
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5 pt-2">
                      <StatusSelect
                        value={s.status}
                        options={CONSULTING_SESSION_STATUSES}
                        onChange={save(s.id, "status")}
                        small
                      />
                    </td>
                    <td className="px-2 py-1.5 pt-2.5">
                      <button
                        onClick={() => remove(s)}
                        disabled={pending}
                        title="Eliminar sesión"
                        className="text-slate-300 transition hover:text-red-500"
                      >
                        {trashIcon}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Nueva sesión, ej. Sesión de diagnóstico…"
            className={`${inputCls} min-w-52 flex-1`}
          />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            title="Hora de inicio"
            className={inputCls}
          />
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            title="Hora de fin"
            className={inputCls}
          />
          <select value={modality} onChange={(e) => setModality(e.target.value)} className={inputCls}>
            {MODALITIES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select value={facilitator} onChange={(e) => setFacilitator(e.target.value)} className={inputCls}>
            <option value="">— Quién la lleva</option>
            {people.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={pending || !title.trim()}
            className="rounded-lg bg-brand-cyan px-3.5 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-50"
          >
            {pending ? "…" : "Agregar"}
          </button>
        </div>
        {error && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</p>}
      </div>
    </section>
  );
}

/** Insumos del cliente (pasos 14-16): seguimiento y escalamiento a las 48h. */
export function InputsSection({
  projectId,
  inputs,
  filesByInput = {},
}: {
  projectId: string;
  inputs: ConsultingInput[];
  filesByInput?: Record<string, ConsultingAttachment[]>;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const add = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await addConsultingInputAction({ projectId, title, dueDate: date || null });
      if ("error" in res) setError(res.error);
      else {
        setTitle("");
        setDate("");
        setError("");
      }
    });
  };

  const received = inputs.filter((i) => i.received).length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Insumos del cliente ({received} de {inputs.length})
        </h2>
      </div>
      <div className="p-4">
        <p className="mb-3 text-xs text-slate-400">
          Información, accesos o disponibilidad que el cliente debe entregar. Si un insumo se
          vence, el líder recibe la tarea de seguimiento y a las 48 horas se escala al comercial.
          Con el clip 📎 sube el documento que entregó el cliente.
        </p>
        {inputs.length > 0 && (
          <ul className="mb-3 space-y-1.5">
            {inputs.map((i) => {
              const overdue = !i.received && i.due_date && i.due_date < new Date().toISOString().slice(0, 10);
              return (
                <li
                  key={i.id}
                  className={`flex flex-wrap items-center gap-2.5 rounded-lg border px-3 py-2 ${
                    i.received ? "border-slate-100 bg-slate-50/60 opacity-60" : overdue ? "border-red-200 bg-red-50/60" : "border-slate-100 bg-slate-50/60"
                  }`}
                >
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        await setConsultingInputReceived(i.id, !i.received);
                      })
                    }
                    disabled={pending}
                    title={i.received ? "Marcar pendiente" : "Marcar recibido"}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      i.received ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 hover:border-brand-cyan"
                    }`}
                  >
                    {i.received && (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                  <span className={`min-w-0 flex-1 text-sm font-medium ${i.received ? "text-slate-400 line-through" : "text-slate-800"}`}>
                    {i.title}
                  </span>
                  <ConsultingItemFiles
                    projectId={projectId}
                    category="insumo"
                    inputId={i.id}
                    files={filesByInput[i.id] ?? []}
                  />
                  {i.due_date && (
                    <span className={`shrink-0 text-xs font-semibold ${overdue ? "text-red-600" : "text-slate-500"}`}>
                      {i.received && i.received_at ? `Recibido ${formatDate(i.received_at)}` : formatDate(i.due_date)}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar el insumo "${i.title}"?`))
                        startTransition(async () => {
                          await deleteConsultingInputAction(i.id, projectId);
                        });
                    }}
                    disabled={pending}
                    title="Eliminar insumo"
                    className="shrink-0 text-slate-300 transition hover:text-red-500"
                  >
                    {trashIcon}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Nuevo insumo, ej. Base de empleados actualizada…"
            className={`${inputCls} min-w-52 flex-1`}
          />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          <button
            onClick={add}
            disabled={pending || !title.trim()}
            className="rounded-lg bg-brand-cyan px-3.5 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-50"
          >
            {pending ? "…" : "Agregar"}
          </button>
        </div>
        {error && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</p>}
      </div>
    </section>
  );
}

/** Cambios de alcance (pasos 23-25): nada fuera de alcance sin formalizar. */
export function ChangesSection({
  projectId,
  changes,
}: {
  projectId: string;
  changes: ConsultingChange[];
}) {
  const [title, setTitle] = useState("");
  const [inScope, setInScope] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const save = (id: string, field: string) => (value: string) =>
    updateConsultingChangeField(id, projectId, field, value);

  const add = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await addConsultingChangeAction({
        projectId,
        title,
        inScope,
        amount: amount ? Number(amount) || null : null,
        notes: "",
      });
      if ("error" in res) setError(res.error);
      else {
        setTitle("");
        setAmount("");
        setInScope(false);
        setError("");
      }
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Cambios de alcance ({changes.length})
        </h2>
      </div>
      <div className="p-4">
        <p className="mb-3 text-xs text-slate-400">
          Cada solicitud del cliente se registra aquí: si está incluida en el alcance se atiende;
          si no, se formaliza con cotización adicional antes de trabajarla (regla del proceso).
        </p>
        {changes.length > 0 && (
          <ul className="mb-3 space-y-1.5">
            {changes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    c.in_scope ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                  }`}
                  title={c.in_scope ? "Ajuste incluido en el alcance original" : "Fuera de alcance: requiere formalización"}
                >
                  {c.in_scope ? "En alcance" : "Fuera de alcance"}
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">{c.title}</span>
                {!c.in_scope && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                    $
                    <EditableField
                      value={c.amount?.toString() ?? ""}
                      type="number"
                      onSave={save(c.id, "amount")}
                      placeholder="Monto"
                    />
                  </span>
                )}
                <StatusSelect value={c.status} options={CHANGE_STATUSES} onChange={save(c.id, "status")} small />
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar el cambio "${c.title}"?`))
                      startTransition(async () => {
                        await deleteConsultingChangeAction(c.id, projectId);
                      });
                  }}
                  disabled={pending}
                  title="Eliminar"
                  className="shrink-0 text-slate-300 transition hover:text-red-500"
                >
                  {trashIcon}
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
            placeholder="Solicitud del cliente, ej. Taller extra para gerencia…"
            className={`${inputCls} min-w-52 flex-1`}
          />
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={inScope}
              onChange={(e) => setInScope(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-brand-cyan"
            />
            Incluido en alcance
          </label>
          {!inScope && (
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="$ cotización"
              inputMode="decimal"
              className={`${inputCls} w-28`}
            />
          )}
          <button
            onClick={add}
            disabled={pending || !title.trim()}
            className="rounded-lg bg-brand-cyan px-3.5 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-50"
          >
            {pending ? "…" : "Registrar"}
          </button>
        </div>
        {error && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</p>}
      </div>
    </section>
  );
}

/** Botón de borrado del proyecto, con confirmación. */
export function DeleteConsultingButton({
  projectId,
  clientId,
  name,
}: {
  projectId: string;
  clientId: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            `¿Eliminar el proyecto "${name}"?\n\nSe borran también sus sesiones, hitos, insumos, cambios y archivos, y se cancelan sus eventos de calendario. Esta acción no se puede deshacer.`
          )
        ) {
          startTransition(() => deleteConsultingProjectAction(projectId, clientId));
        }
      }}
      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-60"
    >
      {pending ? "Eliminando…" : "Eliminar proyecto"}
    </button>
  );
}
