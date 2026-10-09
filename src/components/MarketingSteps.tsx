"use client";

import { useState } from "react";
import Link from "next/link";
import { updateMarketingStepAction } from "@/lib/actions";
import { MARKETING_STEP_STATUSES, statusColor } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { StepView } from "@/lib/marketing-flows";
import { EditableField } from "./EditableField";
import { LinkChip } from "./LinkChip";
import { StatusSelect } from "./StatusSelect";

/**
 * Línea de pasos de un mapa de Marketing: cada renglón es un paso del
 * documento con su responsable, su SLA, la fecha comprometida (editable),
 * el estado —o el rombo, si el paso es una decisión— y la evidencia.
 * "Cada fila se registra con fecha comprometida, enlace de evidencia,
 * responsable y estado."
 */
export function StepsTimeline({
  projectId,
  steps,
  today,
  title,
  subtitle,
  mirrorHref,
}: {
  projectId: string;
  steps: StepView[];
  today: string;
  title?: string;
  subtitle?: string;
  /** A dónde lleva el paso espejo (el cierre del mes anterior). */
  mirrorHref?: string;
}) {
  if (steps.length === 0) return null;
  const done = steps.filter((s) => s.done && !s.beforeStart).length;
  const own = steps.filter((s) => !s.beforeStart).length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {own > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta"
                  style={{ width: `${Math.round((done / own) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-500">
                {done}/{own}
              </span>
            </div>
          )}
        </div>
      )}
      <ul className="divide-y divide-slate-100">
        {steps.map((s) => (
          <StepRow key={s.key} projectId={projectId} step={s} today={today} mirrorHref={mirrorHref} />
        ))}
      </ul>
    </section>
  );
}

function StepRow({
  projectId,
  step: s,
  today,
  mirrorHref,
}: {
  projectId: string;
  step: StepView;
  today: string;
  mirrorHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const save = (field: string) => async (value: string) => {
    setError("");
    const res = await updateMarketingStepAction(projectId, s.key, field, value);
    if (res?.error) setError(res.error);
  };

  const overdue = !s.done && !s.beforeStart && s.due && s.due < today;
  const muted = s.beforeStart || s.mirrorOf;
  const hasResult = !!s.resultOptions;
  const resultValue = s.result || "Pendiente";
  const blockerOnTime = s.blockerAt && s.due ? s.blockerAt <= s.due : null;

  return (
    <li className={`px-4 py-3 ${muted ? "bg-slate-50/70" : s.locked ? "bg-slate-50/40" : ""}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={`mt-0.5 flex h-6 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
            s.done ? "bg-emerald-100 text-emerald-700" : overdue ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"
          }`}
          title={`Paso ${s.no} del mapa`}
        >
          {s.no.length > 4 ? "Fin" : s.no}
        </span>

        <div className="min-w-60 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setOpen(!open)}
              className={`text-left text-sm font-semibold ${muted ? "text-slate-400" : "text-slate-800"} hover:text-brand-cyan-dark`}
              title="Ver el flujo, notas y bloqueos"
            >
              {s.title}
            </button>
            {s.transfer && (
              <span className="rounded-full bg-brand-magenta/10 px-2 py-0.5 text-[10px] font-semibold text-brand-magenta">
                Transferencia {s.transfer}
              </span>
            )}
            {s.rounds > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Ronda {s.rounds + 1}
              </span>
            )}
            {s.locked && !s.done && !muted && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                🔒 Espera: {s.waitingFor.join(", ")}
              </span>
            )}
            {s.blocker && (
              <span
                className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600"
                title={s.blocker}
              >
                ⛔ Bloqueo externo
              </span>
            )}
            {s.notes && !open && <span className="text-[11px] text-slate-400" title={s.notes}>📝</span>}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            👤 {s.assignee || "Sin responsable"}
            {s.supportName && s.supportName !== s.assignee ? ` con ${s.supportName}` : ""}
            <span className="text-slate-300"> · </span>⏱ {s.sla}
          </p>
          {s.mirrorOf && (
            <p className="mt-0.5 text-xs text-slate-400">
              Es el cierre del mes anterior (paso 14): se entrega y se palomea allá.{" "}
              {mirrorHref && (
                <Link href={mirrorHref} className="font-medium text-brand-cyan-dark hover:underline">
                  Ir al mes anterior →
                </Link>
              )}
            </p>
          )}
          {s.beforeStart && (
            <p className="mt-0.5 text-xs text-slate-400">Venció antes de que el proyecto entrara al CRM.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-36" title={s.defaultDue && s.due !== s.defaultDue ? `Fecha del flujo: ${formatDate(s.defaultDue)}` : "Fecha comprometida"}>
            {muted ? (
              <p className="px-2 text-xs text-slate-400">{formatDate(s.due)}</p>
            ) : (
              <EditableField
                value={s.due ?? ""}
                type="date"
                onSave={save("due_date")}
                className={overdue ? "!text-red-600 font-semibold" : ""}
              />
            )}
          </div>
          {muted ? (
            <span className={`${statusColor(s.status)} rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white`}>
              {s.beforeStart ? "Antes del CRM" : s.status}
            </span>
          ) : hasResult ? (
            <StatusSelect value={resultValue} options={s.resultOptions!} onChange={save("result")} small />
          ) : (
            <StatusSelect value={s.status} options={MARKETING_STEP_STATUSES} onChange={save("status")} small />
          )}
        </div>
      </div>

      {(s.evidence || s.evidenceUrl) && !muted && (
        <div className="ml-12 mt-1.5 max-w-xl">
          <LinkChip
            label="Evidencia"
            url={s.evidenceUrl}
            onSave={save("evidence_url")}
            placeholder={s.evidence ? `${s.evidence}…` : "Pega el enlace de evidencia…"}
          />
        </div>
      )}

      {error && (
        <p className="ml-12 mt-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</p>
      )}

      {open && (
        <div className="ml-12 mt-2 space-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-xs text-slate-600">{s.flow}</p>
          {hasResult && (
            <p className="text-[11px] text-slate-400">
              {s.kind === "aprobacion" &&
                "Si marcas \"Cambios solicitados\", el paso anterior se reabre con fecha nueva y esta aprobación vuelve a esperar."}
              {s.kind === "autorizacion" &&
                "Si no se autoriza el dominio, la arquitectura regresa a \"Por decidir\"."}
              {s.kind === "auditoria" &&
                "Con hallazgos: Oliver recibe la tarea de corregir y documentar; al terminar queda \"Corregido\"."}
              {s.kind === "prueba" && "Si falla, la prueba se repite (ronda nueva) hasta que funcione."}
              {s.kind === "validacion" && "\"Nueva práctica\" reabre la mejora sin guía con 10 días hábiles."}
            </p>
          )}
          {!s.evidence && !s.evidenceUrl && !s.mirrorOf && (
            <LinkChip label="Evidencia" url="" onSave={save("evidence_url")} placeholder="Pega el enlace de evidencia…" />
          )}
          <div>
            <p className="mb-1 text-[11px] font-semibold text-slate-400">Notas</p>
            <EditableField
              value={s.notes}
              onSave={save("notes")}
              multiline
              rows={2}
              placeholder={s.kind === "aprobacion" ? "Qué cambios se pidieron, acuerdos…" : "Acuerdos, decisiones, pendientes…"}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold text-slate-400">
              Bloqueo externo comunicado{" "}
              <span className="font-normal">
                (para el bono: se registra aparte si se avisó y gestionó antes del vencimiento)
              </span>
            </p>
            <EditableField
              value={s.blocker}
              onSave={save("blocker")}
              placeholder="¿De qué o de quién depende? Ej. el cliente no ha mandado el logo"
            />
            {s.blocker && s.blockerAt && (
              <p className={`mt-1 text-[11px] ${blockerOnTime ? "text-emerald-600" : "text-red-500"}`}>
                Registrado el {formatDate(s.blockerAt)} —{" "}
                {blockerOnTime ? "antes del vencimiento ✓" : "después del vencimiento"}
              </p>
            )}
          </div>
          {s.completedAt && (
            <p className="text-[11px] text-slate-400">
              Cerrado el {formatDate(s.completedAt)}
              {s.due && (s.completedAt <= s.due ? " · a tiempo ✓" : " · fuera de fecha")}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** Resumen de cumplimiento del mes (para evaluar el bono). */
export function ComplianceChips({
  onTime,
  late,
  overdue,
  blockedInTime,
  total,
}: {
  onTime: number;
  late: number;
  overdue: number;
  blockedInTime: number;
  total: number;
}) {
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">✓ {onTime} a tiempo</span>
      {late > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700">{late} tarde</span>}
      {overdue > 0 && <span className="rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-600">{overdue} vencidos</span>}
      {blockedInTime > 0 && (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
          ⛔ {blockedInTime} bloqueo{blockedInTime === 1 ? "" : "s"} avisado{blockedInTime === 1 ? "" : "s"} a tiempo
        </span>
      )}
      <span className="text-slate-400">de {total} pasos con fecha</span>
    </div>
  );
}
