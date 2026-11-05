"use client";

import { useState, useTransition } from "react";
import {
  MESSAGE_VARIANTS,
  OPEN_COURSE_HINT,
  buildLogistics,
  isOpenCourse,
  isPresencial,
  looksLikeAICourse,
  pickTemplate,
  type MessageVariant,
} from "@/lib/templates";
import { updateTrainingField } from "@/lib/actions";

/**
 * Botón "Mensaje de logística": muestra la plantilla adecuada según la
 * modalidad de las sesiones (presencial u online), con copiar al portapapeles,
 * abrir WhatsApp directo y marcar como enviado. La versión de curso abierto al
 * público (tipo INDEX) se elige a mano. Lo que usan los participantes (IA,
 * herramientas, computadora) se define aquí y se guarda en la capacitación.
 */
export function LogisticsMessage({
  trainingId,
  modalities,
  whatsapp,
  status,
  courseNames,
  usaIa,
  herramientasIa,
  requiereComputadora,
}: {
  trainingId: string;
  modalities: string[];
  whatsapp: string;
  status: string;
  /** Nombre corto y oficial: sugieren si es curso de IA mientras no se defina. */
  courseNames: string[];
  usaIa: string;
  herramientasIa: string;
  requiereComputadora: string;
}) {
  const suggested = pickTemplate(modalities);
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<MessageVariant>(suggested);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  // '' = sin definir: el nombre sugiere si es de IA y se asume sin computadora.
  const [ia, setIa] = useState(usaIa);
  const [computer, setComputer] = useState(requiereComputadora);
  const [tools, setTools] = useState(herramientasIa);
  const [savedTools, setSavedTools] = useState(herramientasIa);
  const [saveError, setSaveError] = useState(false);
  const [, startSaving] = useTransition();

  const iaSuggested = looksLikeAICourse(...courseNames);
  const needs = {
    ia: ia ? ia === "Sí" : iaSuggested,
    computer: computer === "Sí",
    tools,
  };
  const presencial = isPresencial(variant);
  const { text, missing } = buildLogistics(variant, needs);
  const waLink = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
    : null;

  // Si la migración 026 no ha corrido, el mensaje igual se ajusta; solo avisa.
  const persist = (field: string, value: string) =>
    startSaving(async () => {
      const res = await updateTrainingField(trainingId, field, value);
      setSaveError(Boolean(res?.error));
    });

  const undefinedShown = !ia || (presencial && !computer);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
          status === "Listo"
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border-brand-magenta/40 bg-brand-magenta/10 text-brand-magenta hover:bg-brand-magenta/20"
        }`}
      >
        💬 Mensaje de logística {status === "Listo" ? "✓ enviado" : ""}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h3 className="font-bold text-brand-navy">Mensaje de logística por WhatsApp</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
              {MESSAGE_VARIANTS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setVariant(value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    variant === value
                      ? "bg-brand-cyan text-white"
                      : "border border-slate-300 text-slate-500 hover:border-brand-cyan"
                  }`}
                >
                  {label}
                  {value === suggested && " (según las sesiones)"}
                </button>
              ))}
            </div>
            {isOpenCourse(variant) && (
              <p className="mx-5 mt-2 text-xs text-slate-500">{OPEN_COURSE_HINT}</p>
            )}

            <div className="mx-5 mt-3 space-y-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs">
              <p className="font-semibold text-slate-500">En este curso los participantes…</p>
              <YesNo
                label="¿Usan IA?"
                value={ia}
                suggested={iaSuggested ? "Sí" : "No"}
                onChange={(v) => {
                  setIa(v);
                  persist("usa_ia", v);
                }}
              />
              {needs.ia && (
                <label className="flex flex-wrap items-center gap-2">
                  <span className="w-40 text-slate-600">¿Qué herramientas?</span>
                  <input
                    value={tools}
                    onChange={(e) => setTools(e.target.value)}
                    onBlur={() => {
                      if (tools.trim() === savedTools.trim()) return;
                      setSavedTools(tools);
                      persist("herramientas_ia", tools.trim());
                    }}
                    placeholder="Ej. ChatGPT y Gemini"
                    className="min-w-48 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-brand-cyan focus:outline-none"
                  />
                </label>
              )}
              {presencial && (
                <YesNo
                  label="¿Llevan computadora?"
                  value={computer}
                  suggested="No"
                  onChange={(v) => {
                    setComputer(v);
                    persist("requiere_computadora", v);
                  }}
                />
              )}
              <p className="text-[11px] text-slate-400">
                Las encuestas siempre se contestan desde el celular. Lo de IA y Drive solo sale en cursos de IA.
                {undefinedShown && " Lo punteado es sugerencia: elige Sí o No para que quede definido en la capacitación."}
              </p>
              {saveError && (
                <p className="text-[11px] text-amber-700">
                  No se pudo guardar en la ficha (falta correr la migración 026), pero el mensaje sí se ajustó.
                </p>
              )}
            </div>

            {missing.length > 0 && (
              <div className="mx-5 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <p className="font-semibold">Falta antes de enviar:</p>
                <ul className="mt-1 list-disc pl-5">
                  {missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            <pre className="m-5 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {text}
            </pre>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="rounded-lg bg-brand-cyan px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark"
              >
                {copied ? "✓ Copiado" : "Copiar mensaje"}
              </button>
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-600"
                >
                  Abrir en WhatsApp
                </a>
              )}
              <button
                disabled={pending || status === "Listo"}
                onClick={() =>
                  startTransition(async () => {
                    await updateTrainingField(trainingId, "mensaje_logistica", "Listo");
                    setOpen(false);
                  })
                }
                className="ml-auto rounded-lg border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
              >
                {status === "Listo" ? "Ya marcado como enviado" : "Marcar como enviado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Sí / No con la sugerencia punteada mientras no se haya elegido nada. */
function YesNo({
  label,
  value,
  suggested,
  onChange,
}: {
  label: string;
  value: string;
  suggested: "Sí" | "No";
  onChange: (value: "Sí" | "No") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-40 text-slate-600">{label}</span>
      {(["Sí", "No"] as const).map((option) => {
        const chosen = value === option;
        const hinted = !value && suggested === option;
        return (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`rounded-full px-3 py-0.5 font-semibold transition ${
              chosen
                ? "bg-brand-cyan text-white"
                : hinted
                  ? "border border-dashed border-brand-cyan text-brand-cyan-dark"
                  : "border border-slate-300 text-slate-500 hover:border-brand-cyan"
            }`}
          >
            {option}
            {hinted && " (sugerido)"}
          </button>
        );
      })}
    </div>
  );
}
