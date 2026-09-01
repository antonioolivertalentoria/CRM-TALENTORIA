"use client";

import { useState, useTransition } from "react";
import {
  addCandidateAction,
  updateCandidateField,
  deleteCandidateAction,
  deleteVacancyAction,
} from "@/lib/actions";
import {
  CANDIDATE_STATUSES,
  PSYCHOMETRICS_STATUSES,
  REFERENCES_STATUSES,
} from "@/lib/constants";
import { EditableField } from "./EditableField";
import { StatusSelect } from "./StatusSelect";
import { CandidateFiles } from "./RecruitmentAttachments";
import type { RecruitmentAttachment, RecruitmentCandidate } from "@/lib/types";

const inputCls =
  "rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

const trashIcon = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

/**
 * Base de candidatos de la vacante (pasos 12-19 del flujo).
 *
 * Cada renglón es una persona y su avance en el embudo. Al mover el
 * estado se sellan solas las fechas (entrevista, envío al cliente) y
 * nacen las tareas de 24 horas: decisión del cliente, psicometrías y
 * referencias. Si la psicometría queda "No aprobada", el candidato pasa
 * a Rechazado automáticamente (rombo 18).
 */
export function CandidatesSection({
  vacancyId,
  candidates,
  filesByCandidate = {},
}: {
  vacancyId: string;
  candidates: RecruitmentCandidate[];
  filesByCandidate?: Record<string, RecruitmentAttachment[]>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [showOut, setShowOut] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = (id: string, field: string) => (value: string) =>
    updateCandidateField(id, vacancyId, field, value);

  const add = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await addCandidateAction({ vacancyId, name, phone, email, source });
      if ("error" in res) setError(res.error);
      else {
        setName("");
        setPhone("");
        setEmail("");
        setError("");
      }
    });
  };

  const remove = (c: RecruitmentCandidate) => {
    if (!confirm(`¿Eliminar a "${c.name}" de la base de candidatos?`)) return;
    startTransition(async () => {
      await deleteCandidateAction(c.id, vacancyId);
    });
  };

  const out = candidates.filter((c) => c.status === "Rechazado" || c.status === "Descartado");
  const active = candidates.filter((c) => c.status !== "Rechazado" && c.status !== "Descartado");
  const shown = showOut ? [...active, ...out] : active;
  const enTerna = candidates.filter((c) =>
    ["Enviado al cliente", "Aprobado por cliente", "Psicometría", "Referencias", "Contratado"].includes(c.status)
  ).length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Candidatos ({active.length} activos
          {out.length > 0 ? ` · ${out.length} fuera` : ""})
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            enTerna >= 3 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
          title="El proceso pide enviar de 3 a 5 candidatos al cliente (paso 15)"
        >
          {enTerna} de 3 a 5 en terna
        </span>
      </div>
      <div className="p-4">
        <p className="mb-3 text-xs text-slate-400">
          Al mover el estado se sellan solas las fechas y nacen las tareas del flujo: decisión del
          cliente (24h), psicometrías (24h) y referencias (24h). Si la psicometría queda &quot;No
          aprobada&quot;, la persona pasa a Rechazado sola. Con el clip 📎 subes su CV, psicometría
          y referencias.
        </p>

        {shown.length > 0 && (
          <div className="mb-3 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="min-w-44 px-2 py-2 font-semibold">Candidato</th>
                  <th className="w-36 px-2 py-2 font-semibold">Contacto</th>
                  <th className="w-28 px-2 py-2 font-semibold">Medio</th>
                  <th className="w-44 px-2 py-2 font-semibold">Estado</th>
                  <th className="w-32 px-2 py-2 font-semibold" title="Fecha en que el cliente lo entrevistó: arranca las 24h del paso 16">
                    Entrevista cliente
                  </th>
                  <th className="w-32 px-2 py-2 font-semibold">Psicometría</th>
                  <th className="w-32 px-2 py-2 font-semibold">Referencias</th>
                  <th className="w-14 px-2 py-2 font-semibold">📎</th>
                  <th className="w-10 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const fuera = c.status === "Rechazado" || c.status === "Descartado";
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/60 ${
                        fuera ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-1 py-1.5">
                        <EditableField value={c.name} onSave={save(c.id, "name")} />
                      </td>
                      <td className="px-1 py-1.5">
                        <EditableField value={c.phone} onSave={save(c.id, "phone")} placeholder="Teléfono" />
                        <EditableField value={c.email} onSave={save(c.id, "email")} placeholder="Correo" />
                      </td>
                      <td className="px-1 py-1.5">
                        <EditableField value={c.source} onSave={save(c.id, "source")} placeholder="OCC, LinkedIn…" />
                      </td>
                      <td className="px-2 py-1.5 pt-2">
                        <StatusSelect value={c.status} options={CANDIDATE_STATUSES} onChange={save(c.id, "status")} small />
                      </td>
                      <td className="px-1 py-1.5">
                        <EditableField
                          value={c.client_interview_at ?? ""}
                          type="date"
                          onSave={save(c.id, "client_interview_at")}
                        />
                      </td>
                      <td className="px-2 py-1.5 pt-2">
                        <StatusSelect
                          value={c.psychometrics}
                          options={PSYCHOMETRICS_STATUSES}
                          onChange={save(c.id, "psychometrics")}
                          small
                        />
                      </td>
                      <td className="px-2 py-1.5 pt-2">
                        <StatusSelect
                          value={c.references_status}
                          options={REFERENCES_STATUSES}
                          onChange={save(c.id, "references_status")}
                          small
                        />
                      </td>
                      <td className="px-2 py-1.5 pt-2">
                        <CandidateFiles
                          vacancyId={vacancyId}
                          candidateId={c.id}
                          candidateName={c.name}
                          files={filesByCandidate[c.id] ?? []}
                        />
                      </td>
                      <td className="px-2 py-1.5 pt-2.5">
                        <button
                          onClick={() => remove(c)}
                          disabled={pending}
                          title="Eliminar candidato"
                          className="text-slate-300 transition hover:text-red-500"
                        >
                          {trashIcon}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {out.length > 0 && (
          <button
            onClick={() => setShowOut((v) => !v)}
            className="mb-3 text-xs font-semibold text-slate-400 transition hover:text-brand-cyan-dark"
          >
            {showOut ? "Ocultar" : "Ver"} {out.length} candidato{out.length === 1 ? "" : "s"} rechazado
            {out.length === 1 ? "" : "s"} o descartado{out.length === 1 ? "" : "s"}
          </button>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Nombre del candidato…"
            className={`${inputCls} min-w-48 flex-1`}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Teléfono"
            className={`${inputCls} w-36`}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo"
            className={`${inputCls} w-44`}
          />
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Medio (OCC, LinkedIn…)"
            className={`${inputCls} w-40`}
          />
          <button
            onClick={add}
            disabled={pending || !name.trim()}
            className="rounded-lg bg-brand-cyan px-3.5 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-50"
          >
            {pending ? "…" : "Agregar"}
          </button>
        </div>
        {error && (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</p>
        )}
      </div>
    </section>
  );
}

/** Botón de borrado de la vacante, con confirmación. */
export function DeleteVacancyButton({
  vacancyId,
  clientId,
  position,
}: {
  vacancyId: string;
  clientId: string;
  position: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            `¿Eliminar la vacante "${position}"?\n\nSe borran también sus candidatos y archivos. Esta acción no se puede deshacer.`
          )
        ) {
          startTransition(() => deleteVacancyAction(vacancyId, clientId));
        }
      }}
      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-60"
    >
      {pending ? "Eliminando…" : "Eliminar vacante"}
    </button>
  );
}
