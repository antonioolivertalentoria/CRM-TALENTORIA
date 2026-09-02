"use client";

import { useState, useTransition } from "react";
import {
  addSessionAction,
  updateSessionField,
  deleteSessionAction,
  sendSessionInviteAction,
} from "@/lib/actions";
import { SESSION_STATUSES, MODALITIES, PLATFORMS, EXTRA_FACILITATORS } from "@/lib/constants";
import { StatusSelect } from "./StatusSelect";
import { EditableField } from "./EditableField";
import type { Session } from "@/lib/types";

const selectCls =
  "w-full cursor-pointer rounded-md border border-transparent bg-transparent px-1 py-1 text-sm outline-none transition hover:border-slate-300 focus:border-brand-cyan";

export function SessionsTable({
  trainingId,
  sessions,
  people = [],
  facilitators,
}: {
  trainingId: string;
  sessions: Session[];
  people?: string[];
  /** Sugerencias del catálogo de facilitadores; si no llegan, se usa el respaldo fijo. */
  facilitators?: string[];
}) {
  const facilitatorSuggestions = facilitators ?? [...people, ...EXTRA_FACILITATORS];
  const [pending, startTransition] = useTransition();

  // El CRM ya no manda el correo solo: cuando un cambio amerita avisarle al
  // equipo aparece esta barra preguntando, y `notice` cuenta cómo terminó.
  const [ask, setAsk] = useState<{ id: string; number: number; mode: "request" | "cancel" } | null>(
    null
  );
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  const save = (session: Session, field: string) => async (value: string) => {
    const res = await updateSessionField(session.id, trainingId, field, value);
    if (res && "error" in res) {
      setAsk(null);
      setNotice({ ok: false, text: res.error });
      return res;
    }
    if (res && "askInvite" in res) {
      setNotice(null);
      setAsk({ id: session.id, number: session.session_number, mode: res.askInvite });
    }
    return res;
  };

  const sendInvite = (id: string, mode: "request" | "cancel") => {
    setSending(true);
    setAsk(null);
    startTransition(async () => {
      const res = await sendSessionInviteAction(id, mode);
      setSending(false);
      setNotice(
        res.sent
          ? {
              ok: true,
              text: `${mode === "cancel" ? "Cancelación enviada" : "Aviso enviado"} a ${res.to.join(", ")}.`,
            }
          : { ok: false, text: `No se pudo mandar el aviso: ${res.reason}` }
      );
    });
  };

  const totalHours = sessions
    .filter((s) => s.status !== "Cancelada")
    .reduce((acc, s) => acc + (Number(s.duration_hours) || 0), 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Sesiones ({sessions.length})
          {totalHours > 0 && (
            <span
              className="ml-2 rounded-full bg-brand-cyan/10 px-2.5 py-0.5 text-xs font-bold normal-case tracking-normal text-brand-cyan-dark"
              title="Suma de las horas de todas las sesiones no canceladas (cada una se calcula sola con su hora de inicio y cierre)"
            >
              ⏱ {totalHours} h en total
            </span>
          )}
        </h2>
        <button
          disabled={pending}
          onClick={() => startTransition(() => addSessionAction(trainingId))}
          title="La sesión nueva copia horario, facilitador, modalidad y plataforma de la última sesión"
          className="rounded-lg bg-brand-cyan px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-60"
        >
          + Agregar sesión
        </button>
      </div>

      {ask && (
        <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
          <span className="text-sm text-amber-900">
            {ask.mode === "cancel"
              ? `Cancelaste la sesión ${ask.number}. ¿Le aviso al equipo por correo para que se le quite de sus calendarios?`
              : `Cambiaste la sesión ${ask.number}. ¿Le mando el aviso por correo al equipo (invitación de calendario)?`}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <button
              onClick={() => sendInvite(ask.id, ask.mode)}
              disabled={sending}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-amber-600 disabled:opacity-60"
            >
              {sending ? "Enviando…" : "Sí, mandar aviso"}
            </button>
            <button onClick={() => setAsk(null)} className="text-xs text-slate-500 hover:text-slate-700">
              Ahora no
            </button>
          </span>
        </div>
      )}

      {notice && (
        <div
          className={`flex items-start gap-3 border-b px-4 py-2.5 text-sm ${
            notice.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <span className="min-w-0 flex-1">
            {notice.ok ? "✉️ " : "⚠️ "}
            {notice.text}
          </span>
          <button onClick={() => setNotice(null)} className="shrink-0 opacity-60 transition hover:opacity-100">
            ✕
          </button>
        </div>
      )}

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
                <th className="w-20 px-2 py-2 font-semibold" title="Se calcula sola con inicio y cierre">Horas</th>
                <th className="min-w-28 px-2 py-2 font-semibold">Facilitador/a</th>
                <th className="w-32 px-2 py-2 font-semibold">Modalidad</th>
                <th className="w-36 px-2 py-2 font-semibold">Plataforma</th>
                <th className="min-w-36 px-2 py-2 font-semibold">Liga sesión</th>
                <th className="w-20 px-2 py-2 font-semibold"># Insc.</th>
                <th className="w-20 px-2 py-2 font-semibold"># Asist.</th>
                <th className="min-w-40 px-2 py-2 font-semibold">Notas</th>
                <th className="w-16 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/60">
                  <td className="px-3 py-1.5 pt-2.5 font-bold text-brand-navy">{s.session_number}</td>
                  <td className="px-1 py-1.5">
                    <EditableField value={s.module} onSave={save(s, "module")} placeholder="Módulo" />
                  </td>
                  <td className="px-2 py-1.5 pt-2">
                    <StatusSelect
                      value={s.status}
                      options={SESSION_STATUSES}
                      onChange={save(s, "status")}
                      small
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <EditableField value={s.session_date ?? ""} type="date" onSave={save(s, "session_date")} />
                  </td>
                  <td className="px-1 py-1.5">
                    <EditableField value={s.start_time?.slice(0, 5) ?? ""} type="time" onSave={save(s, "start_time")} />
                  </td>
                  <td className="px-1 py-1.5">
                    <EditableField value={s.end_time?.slice(0, 5) ?? ""} type="time" onSave={save(s, "end_time")} />
                  </td>
                  <td
                    className="px-3 py-1.5 pt-2.5 text-xs font-semibold text-brand-cyan-dark"
                    title="Se calcula sola con la hora de inicio y cierre"
                  >
                    {Number(s.duration_hours) > 0 ? `${Number(s.duration_hours)} h` : "—"}
                  </td>
                  <td className="px-1 py-1.5">
                    <EditableField
                      value={s.facilitator}
                      onSave={save(s, "facilitator")}
                      placeholder="Nombre"
                      suggestions={facilitatorSuggestions}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <select
                      value={s.modality || ""}
                      onChange={(e) => save(s, "modality")(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">—</option>
                      {MODALITIES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1.5">
                    {s.modality === "Presencial" ? (
                      <span className="px-2 text-xs text-slate-300">No aplica</span>
                    ) : (
                      <select
                        value={s.platform || ""}
                        onChange={(e) => save(s, "platform")(e.target.value)}
                        className={selectCls}
                      >
                        <option value="">—</option>
                        {PLATFORMS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-1 py-1.5">
                    {s.modality === "Presencial" ? (
                      <span className="px-2 text-xs text-slate-300">No aplica</span>
                    ) : (
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
                        <EditableField value={s.session_link} type="url" onSave={save(s, "session_link")} placeholder="Liga Zoom/Meet" />
                      </div>
                    )}
                  </td>
                  <td className="px-1 py-1.5">
                    <EditableField value={s.enrolled?.toString() ?? ""} type="number" onSave={save(s, "enrolled")} />
                  </td>
                  <td className="px-1 py-1.5">
                    <EditableField value={s.attended?.toString() ?? ""} type="number" onSave={save(s, "attended")} />
                  </td>
                  <td className="px-1 py-1.5">
                    <EditableField value={s.notes} onSave={save(s, "notes")} placeholder="Notas" />
                  </td>
                  <td className="px-2 py-1.5 pt-2.5">
                    <div className="flex items-center gap-1.5">
                      {s.session_date && s.start_time && (
                        <button
                          title={
                            s.status === "Cancelada"
                              ? "Avisar por correo que esta sesión se canceló"
                              : "Mandar (o reenviar) la invitación de calendario por correo"
                          }
                          disabled={sending || pending}
                          onClick={() => sendInvite(s.id, s.status === "Cancelada" ? "cancel" : "request")}
                          className="text-slate-300 transition hover:text-brand-cyan-dark disabled:opacity-40"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                          </svg>
                        </button>
                      )}
                      <button
                        title="Eliminar sesión"
                        onClick={() => {
                          if (!confirm(`¿Eliminar la sesión ${s.session_number}?`)) return;
                          const notify =
                            !!s.session_date &&
                            !!s.start_time &&
                            confirm("¿Le aviso por correo al equipo para que se le quite de sus calendarios?");
                          startTransition(() => deleteSessionAction(s.id, trainingId, notify));
                        }}
                        className="text-slate-300 transition hover:text-red-500"
                      >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
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
