"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addFacilitatorAction,
  updateFacilitatorAction,
  deleteFacilitatorAction,
} from "@/lib/actions";
import type { Facilitator } from "@/lib/types";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

/**
 * Alta y gestión del catálogo de facilitadores. Cualquiera del equipo puede
 * agregar; en vez de borrar, lo normal es desactivar (deja de sugerirse,
 * pero las sesiones que ya lo tienen no cambian: el nombre queda escrito
 * en cada sesión, así que nada se rompe).
 */
export function FacilitatorsManager({ facilitators }: { facilitators: Facilitator[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const add = () => {
    setError("");
    startTransition(async () => {
      const res = await addFacilitatorAction(name, isInternal, email);
      if (res?.error) {
        setError(res.error);
      } else {
        setName("");
        setEmail("");
        setIsInternal(false);
        router.refresh();
      }
    });
  };

  const update = (id: string, fields: { is_internal?: boolean; active?: boolean; email?: string }) => {
    setError("");
    startTransition(async () => {
      const res = await updateFacilitatorAction(id, fields);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  };

  const remove = (f: Facilitator) => {
    if (
      !confirm(
        `¿Quitar a "${f.name}" del catálogo?\n\nLas sesiones donde ya aparece no cambian (el nombre queda escrito en cada una). Si solo quieres que deje de sugerirse, mejor desactívalo.`
      )
    )
      return;
    setError("");
    startTransition(async () => {
      const res = await deleteFacilitatorAction(f.id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Alta */}
      <div className="rounded-xl border border-brand-cyan/30 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-brand-navy">Agregar facilitador(a)</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Nombre completo</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Ej. Rocío Hernández"
              className={input}
            />
          </div>
          <div className="min-w-52 flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Correo (para invitarle a los eventos de calendario)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="opcional@talentoria.com"
              className={input}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-brand-cyan"
            />
            Es del equipo (interno)
          </label>
          <button
            onClick={add}
            disabled={pending || !name.trim()}
            className="rounded-lg bg-brand-cyan px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Agregar"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          &quot;Interno&quot; afecta los plazos de las tareas automáticas: el contenido se entrega 7 días
          antes si el facilitador es del equipo y 14 si es externo.
        </p>
        {error && (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">
            {error}
          </p>
        )}
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {facilitators.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">
            Sin facilitadores en el catálogo todavía. Agrega el primero arriba.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {facilitators.map((f) => (
              <li
                key={f.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 ${f.active ? "" : "opacity-50"}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-cyan to-brand-magenta text-xs font-bold text-white">
                  {f.name
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <div className="min-w-40 flex-1">
                  <p className="text-sm font-medium text-slate-800">{f.name}</p>
                  <input
                    type="email"
                    defaultValue={f.email ?? ""}
                    placeholder="Sin correo (no recibe eventos de calendario)"
                    title="Correo al que le llegan las invitaciones de calendario de sus sesiones; se guarda al salir del campo"
                    onBlur={(e) => {
                      if (e.target.value.trim() !== (f.email ?? "").trim()) {
                        update(f.id, { email: e.target.value });
                      }
                    }}
                    className="mt-0.5 w-full max-w-72 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs text-slate-500 outline-none transition hover:border-slate-300 focus:border-brand-cyan"
                  />
                </div>

                <label
                  className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500"
                  title="Interno = del equipo: contenido a 7 días. Externo: 14 días."
                >
                  <input
                    type="checkbox"
                    checked={f.is_internal}
                    disabled={pending}
                    onChange={(e) => update(f.id, { is_internal: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-brand-cyan"
                  />
                  Interno
                </label>

                <button
                  onClick={() => update(f.id, { active: !f.active })}
                  disabled={pending}
                  title={f.active ? "Desactivar: deja de sugerirse al capturar sesiones" : "Reactivar"}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
                    f.active
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                  }`}
                >
                  {f.active ? "Activo" : "Inactivo"}
                </button>

                <button
                  onClick={() => remove(f)}
                  disabled={pending}
                  title="Quitar del catálogo"
                  className="text-slate-300 transition hover:text-red-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
