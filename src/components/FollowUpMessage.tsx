"use client";

import { useState, useTransition } from "react";
import { updateTrainingField } from "@/lib/actions";

/**
 * Botón de mensaje de seguimiento (días 20 y 30 del proceso), con el mismo
 * mecanismo que el mensaje de logística: muestra la plantilla, la copia al
 * portapapeles, abre WhatsApp con el texto listo y marca el punto del
 * checklist como enviado (con eso desaparece la tarea de "Mis tareas").
 */
export function FollowUpMessage({
  trainingId,
  field,
  label,
  title,
  text,
  whatsapp,
  status,
}: {
  trainingId: string;
  /** Campo del checklist que se palomea al marcarlo como enviado. */
  field: "seguimiento_20" | "seguimiento_30";
  label: string;
  title: string;
  text: string;
  whatsapp: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const sent = status === "Listo";
  const waLink = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
    : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
          sent
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border-brand-magenta/40 bg-brand-magenta/10 text-brand-magenta hover:bg-brand-magenta/20"
        }`}
      >
        💬 {label} {sent ? "✓ enviado" : ""}
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
              <h3 className="font-bold text-brand-navy">{title}</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <p className="px-5 pt-3 text-xs text-slate-400">
              Cambia <span className="font-semibold text-slate-500">[nombre]</span> por el del
              contacto antes de enviarlo.
            </p>

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
                disabled={pending || sent}
                onClick={() =>
                  startTransition(async () => {
                    await updateTrainingField(trainingId, field, "Listo");
                    setOpen(false);
                  })
                }
                className="ml-auto rounded-lg border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
              >
                {sent ? "Ya marcado como enviado" : "Marcar como enviado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
