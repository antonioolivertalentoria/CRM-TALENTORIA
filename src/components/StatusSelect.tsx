"use client";

import { useTransition } from "react";
import { statusColor } from "@/lib/constants";

/**
 * Pill de estado editable estilo Monday: se ve como etiqueta de color,
 * al hacer clic despliega las opciones y guarda al instante.
 */
export function StatusSelect({
  value,
  options,
  onChange,
  small = false,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => Promise<unknown>;
  small?: boolean;
}) {
  const [pending, startTransition] = useTransition();

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
      className={`${statusColor(value)} ${
        small ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
      } cursor-pointer appearance-none rounded-full text-center font-semibold text-white shadow-sm outline-none transition hover:opacity-90 disabled:opacity-50`}
    >
      {options.map((o) => (
        <option key={o} value={o} className="bg-white text-slate-800">
          {o}
        </option>
      ))}
    </select>
  );
}
