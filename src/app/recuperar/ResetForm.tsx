"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/login/actions";

export function ResetForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null);

  if (state && "sent" in state) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
        Listo. Si ese correo tiene cuenta en el CRM, ya te llegó un enlace para crear tu contraseña nueva
        (revisa también spam). Sirve una sola vez y durante una hora.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nombre@talentoria.com"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30"
        />
      </div>
      {state && "error" in state && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-gradient-to-r from-brand-cyan to-brand-magenta px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Mandarme el enlace"}
      </button>
    </form>
  );
}
