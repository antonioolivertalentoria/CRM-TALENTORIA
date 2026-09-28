"use client";

import type { InviteResult } from "@/lib/calendar";

/**
 * Barras de los avisos de calendario por correo, compartidas por las
 * sesiones de capacitación y de consultoría. El CRM nunca manda la
 * invitación solo: la barra ámbar pregunta y la verde/roja cuenta cómo
 * terminó (a quién se mandó o por qué no se pudo).
 */

export type InviteNotice = { ok: boolean; text: string };

/** Convierte el resultado del envío en el texto de la barra de resultado. */
export function inviteNotice(res: InviteResult, mode: "request" | "cancel"): InviteNotice {
  return res.sent
    ? { ok: true, text: `${mode === "cancel" ? "Cancelación enviada" : "Aviso enviado"} a ${res.to.join(", ")}.` }
    : { ok: false, text: `No se pudo mandar el aviso: ${res.reason}` };
}

/** Hoy en la zona del navegador (YYYY-MM-DD), para no ofrecer avisos de fechas pasadas. */
export function isPastLocal(date: string | null): boolean {
  if (!date) return false;
  return date < new Date().toLocaleDateString("en-CA");
}

export function InviteAskBar({
  text,
  sending,
  onSend,
  onDismiss,
}: {
  text: string;
  sending: boolean;
  onSend: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
      <span className="text-sm text-amber-900">{text}</span>
      <span className="ml-auto flex items-center gap-2">
        <button
          onClick={onSend}
          disabled={sending}
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-amber-600 disabled:opacity-60"
        >
          {sending ? "Enviando…" : "Sí, mandar aviso"}
        </button>
        <button onClick={onDismiss} className="text-xs text-slate-500 hover:text-slate-700">
          Ahora no
        </button>
      </span>
    </div>
  );
}

export function InviteResultBar({ notice, onClose }: { notice: InviteNotice; onClose: () => void }) {
  return (
    <div
      className={`flex items-start gap-3 border-b px-4 py-2.5 text-sm ${
        notice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      <span className="min-w-0 flex-1">
        {notice.ok ? "✉️ " : "⚠️ "}
        {notice.text}
      </span>
      <button onClick={onClose} className="shrink-0 opacity-60 transition hover:opacity-100">
        ✕
      </button>
    </div>
  );
}

/** Ícono de sobre del botón ✉️ para mandar o reenviar la invitación. */
export const envelopeIcon = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
    />
  </svg>
);
