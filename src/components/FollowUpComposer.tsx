"use client";

import { useState, useTransition } from "react";
import {
  FOLLOW_UP_STAGES,
  FOLLOW_UP_VARIANTS,
  buildFollowUp,
  followUpMissing,
  stageFields,
  type FollowUpContext,
  type FollowUpField,
  type FollowUpStage,
  type FollowUpVariant,
} from "@/lib/follow-up";
import { updateTrainingField } from "@/lib/actions";

/**
 * Mensaje de seguimiento día 20 / día 30 armado con los datos de la ficha:
 * contacto, curso, facilitador, fecha y "lo que se llevaron". Se puede
 * cambiar el tipo de grupo y retocar el texto antes de copiarlo; al marcarlo
 * como enviado se palomean los puntos del checklist que cubre (los dos, si
 * va el mensaje combinado) y sus tareas salen de Mis tareas.
 */
export function FollowUpComposer({
  trainingId,
  context,
  stage: suggestedStage,
  today,
  label,
  compact = false,
  onSent,
}: {
  trainingId: string;
  context: FollowUpContext;
  /** El mensaje que toca según las fechas; se puede cambiar en el modal. */
  stage: FollowUpStage;
  today: string;
  /** Texto del botón en la ficha (en Mis tareas va la pastilla "💬 Mensaje"). */
  label?: string;
  compact?: boolean;
  onSent?: (fields: FollowUpField[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<FollowUpStage>(suggestedStage);
  const [variant, setVariant] = useState<FollowUpVariant>(context.suggestedVariant);
  const [takeaways, setTakeaways] = useState(context.takeaways);
  const [savedTakeaways, setSavedTakeaways] = useState(context.takeaways);
  /** Texto retocado a mano; null = el que arma el CRM. */
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sentNow, setSentNow] = useState<FollowUpField[]>([]);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [, startSaving] = useTransition();

  const ctx = { ...context, takeaways: takeaways.trim() };
  const generated = buildFollowUp(stage, variant, ctx, today);
  const text = edited ?? generated;
  const missing = followUpMissing(ctx);

  const isSent = (f: FollowUpField) => context.statuses[f] !== "Pendiente" || sentNow.includes(f);
  const fields = stageFields(stage);
  const toMark = fields.filter((f) => !isSent(f));
  const buttonSent = label ? fields.every(isSent) : false;

  const waLink = ctx.whatsapp
    ? `https://wa.me/${ctx.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
    : null;

  // Sin la migración 027 el mensaje igual se ajusta; solo no queda guardado.
  const persistTakeaways = () => {
    if (takeaways.trim() === savedTakeaways.trim()) return;
    setSavedTakeaways(takeaways);
    startSaving(async () => {
      const res = await updateTrainingField(trainingId, "aprendizajes", takeaways.trim());
      setSaveError(Boolean(res?.error));
    });
  };

  const markSent = () =>
    startTransition(async () => {
      setError("");
      for (const f of toMark) {
        const res = await updateTrainingField(trainingId, f, "Listo");
        if (res?.error) {
          setError(res.error);
          return;
        }
      }
      setSentNow((prev) => [...prev, ...toMark]);
      setOpen(false);
      onSent?.(toMark);
    });

  return (
    <>
      {compact ? (
        <button
          onClick={() => setOpen(true)}
          title="Ver el mensaje de seguimiento listo para mandar"
          className="shrink-0 rounded-full border border-brand-magenta/40 bg-brand-magenta/10 px-2 py-0.5 text-[11px] font-semibold text-brand-magenta transition hover:bg-brand-magenta/20"
        >
          💬 Mensaje
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
            buttonSent
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-brand-magenta/40 bg-brand-magenta/10 text-brand-magenta hover:bg-brand-magenta/20"
          }`}
        >
          💬 {label} {buttonSent ? "✓ enviado" : ""}
        </button>
      )}

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
              <h3 className="font-bold text-brand-navy">Mensaje de seguimiento por WhatsApp</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="overflow-y-auto">
              <div className="space-y-2 px-5 pt-3 text-xs">
                <Pills
                  label="Mensaje"
                  options={FOLLOW_UP_STAGES.map((s) => ({ value: s.value, label: s.label }))}
                  value={stage}
                  suggested={suggestedStage}
                  onChange={(v) => {
                    setStage(v);
                    setEdited(null);
                  }}
                />
                <Pills
                  label="Para"
                  options={FOLLOW_UP_VARIANTS.map((v) => ({ value: v.value, label: v.value, title: v.hint }))}
                  value={variant}
                  suggested={context.suggestedVariant}
                  onChange={(v) => {
                    setVariant(v);
                    setEdited(null);
                  }}
                />
                {stage === "juntos" && (
                  <p className="text-slate-500">
                    Ya se juntaron el día 20 y el 30: va un solo mensaje que pregunta cómo les ha ido y
                    cierra el acompañamiento. Al marcarlo como enviado se palomean los dos.
                  </p>
                )}
              </div>

              {stage !== "d30" && (
                <label className="mx-5 mt-3 block rounded-lg border border-slate-200 px-3 py-2.5 text-xs">
                  <span className="font-semibold text-slate-500">Lo que se llevaron</span>
                  <span className="ml-1 text-slate-400">(completa «¿ya pusieron en práctica …?»)</span>
                  <input
                    value={takeaways}
                    onChange={(e) => {
                      setTakeaways(e.target.value);
                      setEdited(null);
                    }}
                    onBlur={persistTakeaways}
                    placeholder="Ej. el feedback con el modelo TALENT o las herramientas de liderazgo situacional"
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-brand-cyan focus:outline-none"
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">
                    {takeaways.trim()
                      ? "Se guarda en la capacitación."
                      : "Vacío: el mensaje pregunta «¿qué han podido aplicar de lo que vieron?»."}
                  </span>
                  {saveError && (
                    <span className="mt-1 block text-[11px] text-amber-700">
                      No se pudo guardar en la ficha (falta correr la migración 027), pero el mensaje sí se ajustó.
                    </span>
                  )}
                </label>
              )}

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

              <div className="mx-5 mt-3 flex items-center justify-between text-[11px] text-slate-400">
                <span>Puedes retocar el texto antes de copiarlo.</span>
                {edited !== null && (
                  <button onClick={() => setEdited(null)} className="font-semibold text-brand-cyan-dark hover:underline">
                    ↺ Volver a armarlo con los datos
                  </button>
                )}
              </div>
              <textarea
                value={text}
                onChange={(e) => setEdited(e.target.value)}
                rows={12}
                className="mx-5 mb-4 mt-1 w-[calc(100%-2.5rem)] rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 focus:border-brand-cyan focus:outline-none"
              />
            </div>

            {error && <p className="px-5 pb-2 text-xs text-red-600">{error}</p>}

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
                disabled={pending || toMark.length === 0}
                onClick={markSent}
                className="ml-auto rounded-lg border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
              >
                {toMark.length === 0 ? "Ya marcado como enviado" : pending ? "Guardando…" : "Marcar como enviado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Pastillas de opción con la sugerida marcada mientras no se cambie. */
function Pills<T extends string>({
  label,
  options,
  value,
  suggested,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; title?: string }[];
  value: T;
  suggested: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 text-slate-500">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1 font-semibold transition ${
            value === o.value
              ? "bg-brand-cyan text-white"
              : "border border-slate-300 text-slate-500 hover:border-brand-cyan"
          }`}
        >
          {o.label}
          {o.value === suggested && value !== o.value && " (sugerido)"}
        </button>
      ))}
    </div>
  );
}
