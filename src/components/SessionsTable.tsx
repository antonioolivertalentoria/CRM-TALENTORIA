"use client";

import { useTransition } from "react";
import {
  addSessionAction,
  updateSessionField,
  deleteSessionAction,
} from "@/lib/actions";
import { SESSION_STATUSES, MODALITIES, PLATFORMS, CHECK_STATUSES } from "@/lib/constants";
import { StatusSelect } from "./StatusSelect";
import { EditableField } from "./EditableField";
import type { Session } from "@/lib/types";

const selectCls =
  "w-full cursor-pointer rounded-md border border-transparent bg-transparent px-1 py-1 text-sm outline-none transition hover:border-slate-300 focus:border-brand-cyan";

export function SessionsTable({
  trainingId,
  sessions,
}: {
  trainingId: string;
  sessions: Session[];
}) {
  const [pending, startTransition] = useTransition();

  const save = (id: string, field: string) => (value: string) =>
    updateSessionField(id, trainingId, field, value);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Sesiones ({sessions.length})
        </h2>
        <button
          disabled={pending}
          onClick={() => startTransition(() => addSessionAction(trainingId))}
          className="rounded-lg bg-brand-cyan px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-60"
        >
          + Agregar sesión
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-400">
          Sin sesiones todavía. Agrega la primera.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="w-10 px-3 py-2 font-semibold">#</th>
                <th className="min-w-32 px-2 py-2 font-semibold">Módulo</th>
                <th className="w-32 px-2 py-2 font-semibold">Estado</th>
                <th className="w-36 px-2 py-2 font-semibold">Fecha</th>
                <th className="w-24 px-2 py-2 font-semibold">Inicio</th>
                <th className="w-24 px-2 py-2 font-semibold">Cierre</th>
                <th className="min-w-28 px-2 py-2 font-semibold">Facilitador/a</th>
                <th className="w-32 px-2 py-2 font-semibold">Modalidad</th>
                <th className="w-36 px-2 py-2 font-semibold">Plataforma</th>
                <th className="min-w-36 px-2 py-2 font-semibold">Liga sesión</th>
                <th className="w-20 px-2 py-2 font-semibold"># Insc.</th>
                <th className="w-20 px-2 py-2 font-semibold"># Asist.</th>
                <th className="w-32 px-2 py-2 font-semibold">Encuesta</th>
                <th className="min-w-40 px-2 py-2 font-semibold">Notas</th>
                <th className="w-10 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/60">
                  <td className="px-3 py-1.5 pt-2.5 font-bold text-brand-navy">{s.session_number}</td>
                  <td className="px-1 py-1.5">
                    <EditableField value={s.module} onSave={save(s.id, "module")} placeholder="Módulo" />
                  </td>
                  <td className="px-2 py-1.5 pt-2">
                    <StatusSelect
                      value={s.status}
                      options={SESSION_STATUSES}
                      onChange={save(s.id, "status")}
                      small
                    />
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
                  <td className="px-1 py-1.5">
                    <EditableField value={s.facilitator} onSave={save(s.id, "facilitator")} placeholder="Nombre" />
                  </td>
                  <td className="px-1 py-1.5">
                    <select
                      value={s.modality || ""}
                      onChange={(e) => save(s.id, "modality")(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">—</option>
                      {MODALITIES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1.5">
                    <select
                      value={s.platform || ""}
                      onChange={(e) => save(s.id, "platform")(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">—</option>
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1.5">
                    <div className="flex items-center gap-1">
                      {s.session_link && (
                        <a
                          href={s.session_link}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir liga"
                          className="shrink-0 text-brand-cyan-dark hover:text-brand-magenta"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                        </a>
                      )}
                      <EditableField value={s.session_link} type="url" onSave={save(s.id, "session_link")} placeholder="Liga Zoom/Meet" />
                    </div>
                  </td>
                  <td className="px-1 py-1.5">
                    <EditableField value={s.enrolled?.toString() ?? ""} type="number" onSave={save(s.id, "enrolled")} />
                  </td>
                  <td className="px-1 py-1.5">
                    <EditableField value={s.attended?.toString() ?? ""} type="number" onSave={save(s.id, "attended")} />
                  </td>
                  <td className="px-2 py-1.5 pt-2">
                    <StatusSelect
                      value={s.survey_status}
                      options={CHECK_STATUSES}
                      onChange={save(s.id, "survey_status")}
                      small
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <EditableField value={s.notes} onSave={save(s.id, "notes")} placeholder="Notas" />
                  </td>
                  <td className="px-2 py-1.5 pt-2.5">
                    <button
                      title="Eliminar sesión"
                      onClick={() => {
                        if (confirm(`¿Eliminar la sesión ${s.session_number}?`)) {
                          startTransition(() => deleteSessionAction(s.id, trainingId));
                        }
                      }}
                      className="text-slate-300 transition hover:text-red-500"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
