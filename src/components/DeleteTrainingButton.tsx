"use client";

import { useTransition } from "react";
import { deleteTrainingAction } from "@/lib/actions";

export function DeleteTrainingButton({
  trainingId,
  clientId,
  name,
}: {
  trainingId: string;
  clientId: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm(`¿Eliminar la capacitación "${name}" con todas sus sesiones y materiales? Esta acción no se puede deshacer.`)) {
          // El aviso de cancelación solo sale si se pide: puede que las
          // invitaciones nunca se hayan mandado.
          const notify = confirm(
            "¿Le aviso por correo al equipo para que se quiten de sus calendarios las sesiones que venían?"
          );
          startTransition(() => deleteTrainingAction(trainingId, clientId, notify));
        }
      }}
      className="text-xs font-medium text-red-400 transition hover:text-red-600 hover:underline disabled:opacity-50"
    >
      Eliminar capacitación
    </button>
  );
}
