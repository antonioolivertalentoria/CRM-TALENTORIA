"use client";

import { useState, useActionState } from "react";
import { createClientAction } from "@/lib/actions";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

export function NewClientForm({
  parents = [],
  fixedParent,
}: {
  /** Clientes que pueden ser "padre" (para dar de alta un subcliente). */
  parents?: { id: string; company: string }[];
  /** Si se pasa, el nuevo cliente nace como subcliente de este cliente. */
  fixedParent?: { id: string; company: string };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createClientAction, null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={
          fixedParent
            ? "rounded-lg border border-brand-cyan bg-white px-3 py-1.5 text-xs font-semibold text-brand-cyan-dark shadow-sm transition hover:bg-brand-cyan/10"
            : "rounded-lg bg-gradient-to-r from-brand-cyan to-brand-magenta px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
        }
      >
        {fixedParent ? "+ Agregar subcliente" : "+ Dar de alta cliente"}
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-brand-cyan/30 bg-white p-5 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-brand-navy">
          {fixedParent ? `Nuevo subcliente de ${fixedParent.company}` : "Nuevo cliente"}
        </h2>
        <button onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
        {fixedParent && <input type="hidden" name="parent_id" value={fixedParent.id} />}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Compañía *</label>
          <input name="company" required placeholder="Ej. SIGMA Alimentos" className={input} />
        </div>
        {!fixedParent && parents.length > 0 && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              ¿Es subcliente de alguien? (opcional)
            </label>
            <select name="parent_id" defaultValue="" className={input}>
              <option value="">No, es cliente directo</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>Subcliente de {p.company}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Úsalo cuando un cliente grande (Ej. Coparmex) nos subcontrata para capacitar a esta empresa.
            </p>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Razón social</label>
          <input name="razon_social" placeholder="Ej. Sigma Alimentos, S.A. de C.V." className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">RFC</label>
          <input name="rfc" placeholder="Ej. SAL840112ABC" maxLength={13} className={input + " uppercase"} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Nombre del contacto</label>
          <input name="contact_name" placeholder="Ej. Humberto González" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Correo</label>
          <input name="email" type="email" placeholder="correo@empresa.com" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">WhatsApp</label>
          <input name="whatsapp" placeholder="+52 614 123 4567" className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Notas</label>
          <textarea name="notes" rows={3} placeholder="Notas del cliente" className={input + " resize-y"} />
        </div>
        {state?.error && (
          <p className="sm:col-span-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-cyan px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar cliente"}
          </button>
        </div>
      </form>
    </div>
  );
}
