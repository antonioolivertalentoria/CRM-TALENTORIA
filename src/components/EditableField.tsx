"use client";

import { useId, useState, useTransition } from "react";

/**
 * Campo editable inline: guarda al salir del campo (blur) o con Enter.
 */
export function EditableField({
  value,
  onSave,
  type = "text",
  placeholder = "—",
  className = "",
  multiline = false,
  rows = 3,
  suggestions,
}: {
  value: string;
  onSave: (value: string) => Promise<unknown>;
  type?: "text" | "date" | "time" | "number" | "url";
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();
  const listId = useId();

  const save = () => {
    if (draft === value) return;
    startTransition(async () => {
      await onSave(draft);
    });
  };

  const base = `w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none transition hover:border-slate-300 focus:border-brand-cyan focus:bg-white focus:ring-2 focus:ring-brand-cyan/20 ${
    pending ? "opacity-50" : ""
  } ${className}`;

  if (multiline) {
    return (
      <textarea
        value={draft}
        placeholder={placeholder}
        rows={rows}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        className={base + " resize-y"}
      />
    );
  }

  return (
    <>
      <input
        type={type}
        value={draft}
        placeholder={placeholder}
        list={suggestions ? listId : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={base}
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </>
  );
}
