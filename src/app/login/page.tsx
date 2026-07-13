"use client";

import Image from "next/image";
import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-navy p-4 relative overflow-hidden">
      {/* Franjas decorativas de marca */}
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-cyan via-brand-sky to-brand-magenta" />
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-cyan/15 blur-3xl" />
      <div className="absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-brand-magenta/15 blur-3xl" />

      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl relative">
        <div className="flex justify-center mb-2">
          <Image
            src="/logo-talentoria.png"
            alt="Talentoría — Aceleradora de Talento"
            width={280}
            height={63}
            priority
          />
        </div>
        <h1 className="text-center text-xl font-bold text-brand-navy mt-4">
          CRM de Capacitaciones
        </h1>
        <p className="text-center text-sm text-slate-500 mb-6">
          Inicia sesión con tu cuenta Talentoría
        </p>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
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
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30"
            />
          </div>

          {state?.error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-gradient-to-r from-brand-cyan to-brand-magenta px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Entrando…" : "Iniciar sesión"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Acceso exclusivo para el equipo Talentoría.
        </p>
      </div>
    </main>
  );
}
