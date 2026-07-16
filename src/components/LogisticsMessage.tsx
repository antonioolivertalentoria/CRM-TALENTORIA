"use client";

import { useState, useTransition } from "react";
import { LOGISTICS_PRESENCIAL, LOGISTICS_ONLINE, pickTemplate } from "@/lib/templates";
import { updateTrainingField } from "@/lib/actions";

/**
 * Botón "Mensaje de logística": muestra la plantilla adecuada según la
 * modalidad de las sesiones (presencial u online), con copiar al portapapeles,
 * abrir WhatsApp directo y marcar como enviado.
 */
export function LogisticsMessage({
  trainingId,
  modalities,
  whatsapp,
  status,
}: {
  trainingId: string;
  modalities: string[];
  whatsapp: string;
  status: string;
}) {
  const suggested = pickTemplate(modalities);
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<"Presencial" | "Online">(suggested);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const text = variant === "Presencial" ? LOGISTICS_PRESENCIAL : LOGISTICS_ONLINE;
  const waLink = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
    : null;

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

            <div className="flex items-center gap-2 px-5 pt-3">
              {(["Presencial", "Online"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVariant(v)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    variant === v
                      ? "bg-brand-cyan text-white"
                      : "border border-slate-300 text-slate-500 hover:border-brand-cyan"
                  }`}
                >
                  {v}
                  {v === suggested && " (según las sesiones)"}
                </button>
              ))}
            </div>

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
