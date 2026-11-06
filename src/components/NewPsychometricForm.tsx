"use client";

import { useState, useActionState } from "react";
import { createPsychometricRequestAction } from "@/lib/actions";
import { PSYCHOMETRIC_REPORT_TYPES, PSYCHOMETRICS_OWNER, COMMERCIAL_OWNER } from "@/lib/constants";
import { todayISO } from "@/lib/format";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

/**
 * Alta de una solicitud de psicometría (paso 1 del mapa: llega la
 * requisición del cliente por el grupo de WhatsApp). Las personas se
 * pueden pegar de una vez, una por renglón; al crearla nace la tarea de
 * revisar la requisición en 24 horas.
 */
export function NewPsychometricForm({
  clientId,
  people = [],
}: {
  clientId: string;
  people?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createPsychometricRequestAction, null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-gradient-to-r from-brand-navy to-brand-cyan px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
      >
        + Nueva psicometría
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-brand-cyan/30 bg-white p-5 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-brand-navy">Nueva solicitud de psicometría</h2>
        <button onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="client_id" value={clientId} />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Nombre de la solicitud *</label>
          <input
            name="title"
            required
            placeholder="Ej. Personal de guardería, noviembre"
            className={input}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Tipo de reporte</label>
          <select name="report_type" defaultValue="Empresa" className={input}>
            {PSYCHOMETRIC_REPORT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-400">
            En guarderías, si alguien sale con reservas se le entrevista antes de entregar.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Pruebas a aplicar</label>
          <input name="tests" placeholder="Ej. MMPI, I-IPG, Asertividad, Competencias" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">
            Fecha en que llegó la requisición
          </label>
          <input name="requisition_at" type="date" defaultValue={todayISO()} className={input} />
          <p className="mt-1 text-[11px] text-slate-400">Desde aquí corren los plazos del mapa.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">
            ¿Para cuándo necesita los reportes el cliente?
          </label>
          <input name="client_deadline" type="date" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Psicometría (responsable)</label>
          <select name="evaluator" defaultValue={PSYCHOMETRICS_OWNER} className={input}>
            {!people.includes(PSYCHOMETRICS_OWNER) && (
              <option value={PSYCHOMETRICS_OWNER}>{PSYCHOMETRICS_OWNER}</option>
            )}
            {people.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Comercial</label>
          <select name="comercial" defaultValue={COMMERCIAL_OWNER} className={input}>
            {!people.includes(COMMERCIAL_OWNER) && <option value={COMMERCIAL_OWNER}>{COMMERCIAL_OWNER}</option>}
            {people.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">
            Personas a evaluar (una por renglón, opcional)
          </label>
          <textarea
            name="people"
            rows={4}
            placeholder={"Ana López — Asistente educativa\nLuis Pérez — Cocinero"}
            className={input + " resize-y"}
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Puedes poner el puesto después de un guion o una coma. También se agregan después en la ficha.
          </p>
        </div>
        {state?.error && (
          <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-cyan px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-60"
          >
            {pending ? "Creando…" : "Abrir solicitud"}
          </button>
        </div>
      </form>
    </div>
  );
}
