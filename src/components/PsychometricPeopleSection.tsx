"use client";

import { useState, useTransition } from "react";
import {
  addPsychometricPersonAction,
  deletePsychometricPersonAction,
  deletePsychometricRequestAction,
  updatePsychometricPersonField,
} from "@/lib/actions";
import {
  CHECK_STATUSES,
  PERSON_STATUSES,
  RECEIPT_STATUSES,
  REPORT_STATUSES,
  RESULT_STATUSES,
  TESTS_DONE_STATUSES,
} from "@/lib/constants";
import { needsValidation } from "@/lib/psychometric-tasks";
import { buildInstructionsMessage, whatsappLink } from "@/lib/psychometric-message";
import { EditableField } from "./EditableField";
import { StatusSelect } from "./StatusSelect";
import type { PsychometricPerson, PsychometricRequest } from "@/lib/types";

const inputCls =
  "rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

const trashIcon = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

/**
 * Personas evaluadas de la solicitud (pasos 6-14 del mapa).
 *
 * Cada renglón es una persona y su avance: envío, recepción (rombo 8),
 * respuestas, reporte, resultado (rombo 12), validación y entrega. Al
 * mover cada paso se sella su fecha y nace la tarea del siguiente con su
 * plazo; la fase de la solicitud se acomoda sola.
 */
export function PsychometricPeopleSection({
  request,
  people,
  clientName,
}: {
  request: PsychometricRequest;
  people: PsychometricPerson[];
  clientName: string;
}) {
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [showOut, setShowOut] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = (id: string, field: string) => (value: string) =>
    updatePsychometricPersonField(id, request.id, field, value);

  const add = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await addPsychometricPersonAction({ requestId: request.id, name, jobTitle, phone, email });
      if ("error" in res) setError(res.error);
      else {
        setName("");
        setJobTitle("");
        setPhone("");
        setEmail("");
        setError("");
      }
    });
  };

  const remove = (p: PsychometricPerson) => {
    if (!confirm(`¿Eliminar a "${p.name}" de esta solicitud?`)) return;
    startTransition(async () => {
      await deletePsychometricPersonAction(p.id, request.id);
    });
  };

  const out = people.filter((p) => p.status === "Cancelada");
  const active = people.filter((p) => p.status !== "Cancelada");
  const shown = showOut ? [...active, ...out] : active;
  const delivered = active.filter((p) => p.delivered_at).length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Personas evaluadas ({active.length}
          {out.length > 0 ? ` · ${out.length} canceladas` : ""})
        </h2>
        {active.length > 0 && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              delivered === active.length ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {delivered} de {active.length} reportes entregados
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="mb-3 text-xs text-slate-400">
          Cada paso que mueves sella su fecha y te deja la tarea del siguiente con el plazo del mapa:
          confirmar que le llegaron (24h), verificar que respondió (48h), reporte (48h), revisión
          (24h) y entrega (mismo día). Si sale apta con reservas o no apta, antes de entregar te queda
          la validación de los hallazgos. Con 💬 copias el mensaje de instrucciones con las ligas.
        </p>

        {request.info_completa !== "Sí" && active.some((p) => !p.sent_at) && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            La tarea de mandar las pruebas aparece en cuanto se confirme que la información está
            completa (arriba, en Arranque). Si ya las mandaste, captura la fecha de envío y el
            proceso sigue solo.
          </p>
        )}

        {shown.length > 0 && (
          // contain:inline-size: la tabla se desplaza de lado sin ensanchar toda la página
          <div className="mb-3 overflow-x-auto [contain:inline-size]">
            <table className="w-full min-w-[1120px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="min-w-44 px-2 py-2 font-semibold">Persona</th>
                  <th className="w-36 px-2 py-2 font-semibold">Contacto</th>
                  <th className="w-32 px-2 py-2 font-semibold" title="Paso 6: fecha en que se le mandaron las ligas">
                    Envío
                  </th>
                  <th className="w-36 px-2 py-2 font-semibold" title="Pasos 7-9: ¿le llegaron?">
                    Recepción
                  </th>
                  <th className="w-32 px-2 py-2 font-semibold" title="Paso 10: respondió todas las pruebas">
                    Pruebas
                  </th>
                  <th className="w-40 px-2 py-2 font-semibold" title="Paso 11: reporte de la empresa o guardería">
                    Reporte
                  </th>
                  <th className="w-40 px-2 py-2 font-semibold" title="Paso 12: ¿la persona es viable?">
                    Resultado
                  </th>
                  <th className="w-32 px-2 py-2 font-semibold" title="Paso 13: validar hallazgos (si no es viable sin reservas)">
                    Validación
                  </th>
                  <th className="w-32 px-2 py-2 font-semibold" title="Paso 14: entregado por el grupo de WhatsApp">
                    Entrega
                  </th>
                  <th className="w-24 px-2 py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const canceled = p.status === "Cancelada";
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/60 ${
                        canceled ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-1 py-1.5">
                        <EditableField value={p.name} onSave={save(p.id, "name")} />
                        <EditableField value={p.job_title} onSave={save(p.id, "job_title")} placeholder="Puesto" />
                      </td>
                      <td className="px-1 py-1.5">
                        <EditableField value={p.phone} onSave={save(p.id, "phone")} placeholder="WhatsApp" />
                        <EditableField value={p.email} onSave={save(p.id, "email")} placeholder="Correo" />
                      </td>
                      <td className="px-1 py-1.5">
                        <EditableField value={p.sent_at ?? ""} type="date" onSave={save(p.id, "sent_at")} />
                      </td>
                      <td className="space-y-1.5 px-2 py-1.5 pt-2">
                        <StatusSelect
                          value={p.receipt}
                          options={RECEIPT_STATUSES}
                          onChange={save(p.id, "receipt")}
                          small
                        />
                        {p.receipt === "No recibidas" && (
                          <div title="Paso 9: pedirle al cliente que apoye con el seguimiento">
                            <p className="text-[10px] font-semibold text-slate-400">Apoyo del cliente</p>
                            <StatusSelect
                              value={p.client_followup}
                              options={CHECK_STATUSES}
                              onChange={save(p.id, "client_followup")}
                              small
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 pt-2">
                        <StatusSelect
                          value={p.tests_done}
                          options={TESTS_DONE_STATUSES}
                          onChange={save(p.id, "tests_done")}
                          small
                        />
                      </td>
                      <td className="px-2 py-1.5 pt-2">
                        <StatusSelect
                          value={p.report_status}
                          options={REPORT_STATUSES}
                          onChange={save(p.id, "report_status")}
                          small
                        />
                        <div className="mt-1">
                          {p.report_url ? (
                            <a
                              href={p.report_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mr-1 text-[11px] font-semibold text-brand-cyan-dark hover:underline"
                            >
                              Abrir reporte ↗
                            </a>
                          ) : null}
                          <EditableField
                            value={p.report_url}
                            type="url"
                            onSave={save(p.id, "report_url")}
                            placeholder="Liga del reporte"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1.5 pt-2">
                        <StatusSelect
                          value={p.result}
                          options={RESULT_STATUSES}
                          onChange={save(p.id, "result")}
                          small
                        />
                      </td>
                      <td className="px-2 py-1.5 pt-2">
                        {needsValidation(p) ? (
                          <StatusSelect
                            value={p.validation}
                            options={CHECK_STATUSES}
                            onChange={save(p.id, "validation")}
                            small
                          />
                        ) : (
                          <span className="text-xs text-slate-300" title="Solo si sale apta con reservas o no apta">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-1 py-1.5">
                        <EditableField
                          value={p.delivered_at ?? ""}
                          type="date"
                          onSave={save(p.id, "delivered_at")}
                        />
                      </td>
                      <td className="px-2 py-1.5 pt-2">
                        <div className="flex items-center gap-2">
                          <InstructionsComposer request={request} person={p} clientName={clientName} />
                          <button
                            onClick={() => remove(p)}
                            disabled={pending}
                            title="Eliminar persona"
                            className="text-slate-300 transition hover:text-red-500"
                          >
                            {trashIcon}
                          </button>
                        </div>
                        <div className="mt-1.5" title="Cancelada: ya no va a hacer las pruebas (no genera tareas)">
                          <StatusSelect
                            value={p.status}
                            options={PERSON_STATUSES}
                            onChange={save(p.id, "status")}
                            small
                          />
                        </div>
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
            {showOut ? "Ocultar" : "Ver"} {out.length} persona{out.length === 1 ? "" : "s"} cancelada
            {out.length === 1 ? "" : "s"}
          </button>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Nombre de la persona…"
            className={`${inputCls} min-w-48 flex-1`}
          />
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Puesto"
            className={`${inputCls} w-44`}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="WhatsApp"
            className={`${inputCls} w-36`}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo"
            className={`${inputCls} w-44`}
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

/**
 * Paso 6: el mensaje para la persona con las ligas de las pruebas y las
 * instrucciones. Se puede retocar antes de copiarlo o abrirlo en WhatsApp;
 * "Ya se las mandé" registra hoy como fecha de envío.
 */
function InstructionsComposer({
  request,
  person,
  clientName,
}: {
  request: PsychometricRequest;
  person: PsychometricPerson;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const generated = buildInstructionsMessage(request, person, clientName);
  const text = edited ?? generated;
  const wa = whatsappLink(person.phone, text);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar; selecciona el texto y cópialo a mano.");
    }
  };

  const markSent = () =>
    startTransition(async () => {
      const res = await updatePsychometricPersonField(person.id, request.id, "sent_at", "hoy");
      if (res?.error) setError(res.error);
      else setOpen(false);
    });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Mensaje con las ligas y las instrucciones"
        className="rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-2 py-0.5 text-[11px] font-semibold text-brand-cyan-dark transition hover:bg-brand-cyan/20"
      >
        💬
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h3 className="font-bold text-brand-navy">Pruebas para {person.name}</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-3">
              {!request.test_links.trim() && (
                <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Aún no hay ligas guardadas en la solicitud. Pégalas en &quot;Ligas de las pruebas&quot;
                  (arriba) para que salgan solas en todos los mensajes, o escríbelas aquí.
                </p>
              )}
              <textarea
                value={text}
                onChange={(e) => setEdited(e.target.value)}
                rows={18}
                className="w-full resize-y rounded-lg border border-slate-300 p-3 text-sm leading-relaxed outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30"
              />
              {edited !== null && (
                <button
                  onClick={() => setEdited(null)}
                  className="mt-1 text-xs font-semibold text-slate-400 hover:text-brand-cyan-dark"
                >
                  ↺ Volver a armarlo
                </button>
              )}
              {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                onClick={copy}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                {copied ? "✓ Copiado" : "Copiar"}
              </button>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Abrir en WhatsApp
                </a>
              )}
              {!person.sent_at && (
                <button
                  onClick={markSent}
                  disabled={pending}
                  className="rounded-lg bg-brand-cyan px-3 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-60"
                >
                  {pending ? "Guardando…" : "Ya se las mandé"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Botón de borrado de la solicitud, con confirmación. */
export function DeletePsychometricButton({
  requestId,
  clientId,
  title,
}: {
  requestId: string;
  clientId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            `¿Eliminar la solicitud "${title}"?\n\nSe borran también sus personas evaluadas. Esta acción no se puede deshacer.`
          )
        ) {
          startTransition(() => deletePsychometricRequestAction(requestId, clientId));
        }
      }}
      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-60"
    >
      {pending ? "Eliminando…" : "Eliminar solicitud"}
    </button>
  );
}
