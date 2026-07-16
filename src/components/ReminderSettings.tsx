"use client";

import { useState, useTransition } from "react";
import { updateReminderPrefs } from "@/lib/actions";
import type { ReminderPrefs } from "@/lib/types";

const ALL_KINDS = ["Logística", "Preparación", "Material", "Revisión", "Entrega", "Seguimiento"];

/**
 * Preferencias personales de recordatorios por correo:
 * apagarlos por completo o elegir qué tipos de tarea avisan.
 */
export function ReminderSettings({ prefs }: { prefs: ReminderPrefs }) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(prefs.enabled);
  const [kinds, setKinds] = useState<string[]>(prefs.kinds ?? ALL_KINDS);
  const [pending, startTransition] = useTransition();

  const save = (nextEnabled: boolean, nextKinds: string[]) => {
    setEnabled(nextEnabled);
    setKinds(nextKinds);
    startTransition(async () => {
      await updateReminderPrefs({ enabled: nextEnabled, kinds: nextKinds });
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
          enabled
            ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan-dark hover:bg-brand-cyan/20"
            : "border-slate-300 bg-slate-100 text-slate-500 hover:bg-slate-200"
        }`}
      >
        🔔 Recordatorios por correo: {enabled ? "activados" : "apagados"}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          <label className="flex cursor-pointer items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-700">Recibir correos diarios</span>
            <input
              type="checkbox"
              checked={enabled}
              disabled={pending}
              onChange={(e) => save(e.target.checked, kinds)}
              className="h-4 w-4 accent-[#00aeef]"
            />
          </label>
          <p className="mb-3 mt-1 text-[11px] text-slate-400">
            Un solo correo al día (8:00 am) y únicamente si tienes tareas vencidas o para hoy.
          </p>
          <p className="mb-1.5 text-xs font-semibold text-slate-500">Avisarme sobre:</p>
          <div className="space-y-1.5">
            {ALL_KINDS.map((k) => (
              <label key={k} className={`flex cursor-pointer items-center gap-2 text-sm ${enabled ? "text-slate-700" : "text-slate-400"}`}>
                <input
                  type="checkbox"
                  checked={kinds.includes(k)}
                  disabled={pending || !enabled}
                  onChange={(e) =>
                    save(enabled, e.target.checked ? [...kinds, k] : kinds.filter((x) => x !== k))
                  }
                  className="h-4 w-4 accent-[#00aeef]"
                />
                {k}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
