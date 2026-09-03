import { LinkChip } from "./LinkChip";

/**
 * Los dos informes de la encuesta de satisfacción (migración 017), iguales
 * en capacitaciones, consultoría y reclutamiento: el de quienes participaron
 * y el del cliente que nos contrató. Solo se pegan los links (los archivos
 * viven en Drive); si un proyecto no lleva alguno, se deja vacío.
 */
export function SurveyReports({
  participantsUrl,
  clientUrl,
  onSaveParticipants,
  onSaveClient,
  participantsLabel = "Informe de participantes",
  hint,
}: {
  participantsUrl: string;
  clientUrl: string;
  onSaveParticipants: (value: string) => Promise<unknown>;
  onSaveClient: (value: string) => Promise<unknown>;
  /** En reclutamiento los encuestados son los candidatos, no participantes. */
  participantsLabel?: string;
  hint?: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Informes de encuesta de satisfacción
      </h2>
      <p className="mb-3 mt-0.5 text-xs text-slate-400">
        {hint ??
          "Pega aquí el link del informe de resultados para tenerlo a la mano: uno es el de quienes participaron y el otro el de la encuesta al cliente que nos contrató."}
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <LinkChip
          label={participantsLabel}
          url={participantsUrl}
          onSave={onSaveParticipants}
          placeholder="Pega el link del informe…"
          hint="Resultados de la encuesta que contestaron los participantes"
        />
        <LinkChip
          label="Informe del cliente contratante"
          url={clientUrl}
          onSave={onSaveClient}
          placeholder="Pega el link del informe…"
          hint="Resultados de la encuesta de satisfacción que contestó el cliente que nos contrató"
        />
      </div>
    </section>
  );
}
