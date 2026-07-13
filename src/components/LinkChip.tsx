"use client";

import { useState } from "react";
import { EditableField } from "./EditableField";

/**
 * Muestra un link como botón (abre en pestaña nueva) con opción de editarlo.
 * Si está vacío, muestra el campo para pegarlo.
 */
export function LinkChip({
  label,
  url,
  onSave,
}: {
  label: string;
  url: string;
  onSave: (value: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);

  if (!url || editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-slate-500 shrink-0">{label}:</span>
        <EditableField
          value={url}
          type="url"
          placeholder="Pega el link de Drive…"
          onSave={async (v) => {
            await onSave(v);
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1 text-xs font-semibold text-brand-cyan-dark transition hover:bg-brand-cyan/20"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
        {label}
      </a>
      <button
        onClick={() => setEditing(true)}
        title={`Editar link de ${label}`}
        className="text-slate-300 transition hover:text-slate-500"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
        </svg>
      </button>
    </div>
  );
}
