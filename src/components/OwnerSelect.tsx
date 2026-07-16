"use client";

import { useTransition } from "react";

/** Select de responsable interno alimentado por los perfiles del equipo. */
export function OwnerSelect({
  value,
  people,
  onChange,
}: {
  value: string;
  people: string[];
  onChange: (v: string) => Promise<unknown>;
}) {
  const [pending, startTransition] = useTransition();
  const options = value && !people.includes(value) ? [value, ...people] : people;

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        startTransition(async () => {
          await onChange(v);
        });
      }}
      className={`w-full cursor-pointer rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none transition hover:border-slate-300 focus:border-brand-cyan ${
        value ? "text-slate-800" : "text-slate-400"
      } disabled:opacity-50`}
    >
      <option value="">— Sin responsable</option>
      {options.map((p) => (
        <option key={p} value={p}>{p}</option>
      ))}
    </select>
  );
}
