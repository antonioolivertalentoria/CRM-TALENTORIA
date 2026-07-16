"use client";

import { useState, useActionState } from "react";
import { updateClientAction, deleteClientAction } from "@/lib/actions";
import type { Client } from "@/lib/types";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

export function ClientEditForm({ client }: { client: Client }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateClientAction, null);

  if (!editing) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Datos del cliente</h2>
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-brand-cyan-dark hover:underline"
          >
            Editar
          </button>
        </div>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-slate-400">Contacto</dt>
            <dd className="text-slate-700">{client.contact_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-400">Correo</dt>
            <dd>
              {client.email ? (
                <a href={`mailto:${client.email}`} className="text-brand-cyan-dark hover:underline">
                  {client.email}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-400">WhatsApp</dt>
            <dd>
              {client.whatsapp ? (
                <a
                  href={`https://wa.me/${client.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 hover:underline"
                >
                  {client.whatsapp}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold text-slate-400">Notas</dt>
            <dd className="whitespace-pre-wrap text-slate-700">{client.notes || "—"}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-cyan/40 bg-white p-5 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Editar cliente</h2>
        <button onClick={() => setEditing(false)} className="text-sm text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
      <form
        action={(fd) => {
          formAction(fd);
          setEditing(false);
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <input type="hidden" name="id" value={client.id} />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Compañía *</label>
          <input name="company" required defaultValue={client.company} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Contacto</label>
          <input name="contact_name" defaultValue={client.contact_name} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Correo</label>
          <input name="email" type="email" defaultValue={client.email} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">WhatsApp</label>
          <input name="whatsapp" defaultValue={client.whatsapp} className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Notas</label>
          <textarea name="notes" rows={5} defaultValue={client.notes} className={input + " resize-y"} />
        </div>
        {state?.error && (
          <p className="sm:col-span-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-cyan px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`¿Eliminar a ${client.company} y todas sus capacitaciones? Esta acción no se puede deshacer.`)) {
                deleteClientAction(client.id);
              }
            }}
            className="text-sm font-medium text-red-500 hover:underline"
          >
            Eliminar cliente
          </button>
        </div>
      </form>
    </div>
  );
}
