"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { changePassword } from "@/app/login/actions";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, null);
  const [show, setShow] = useState(false);

  if (state && "saved" in state) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">
        <p className="font-semibold">✓ Contraseña guardada.</p>
        <p className="mt-1">La próxima vez que entres, usa la nueva.</p>
        <Link href="/tareas" className="mt-3 inline-block font-semibold text-brand-cyan-dark hover:underline">
          Ir a mis tareas →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
          Contraseña nueva
        </label>
        <input id="password" name="password" type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} className={input} />
        <p className="mt-1 text-[11px] text-slate-400">Mínimo 8 caracteres.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-slate-700">
          Escríbela otra vez
        </label>
        <input id="confirm" name="confirm" type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} className={input} />
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-500">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        Mostrar lo que escribo
      </label>
      {state && "error" in state && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-gradient-to-r from-brand-cyan to-brand-magenta px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
