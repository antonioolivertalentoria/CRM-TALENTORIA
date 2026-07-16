import { addBusinessDays, addDays, todayISO } from "./format";
import type { Client, Material, Session, Training } from "./types";

/**
 * Motor de tareas: las tareas NO se capturan aparte, se derivan de las
 * capacitaciones, sesiones y materiales según el Proceso de Logística.
 * Completar una tarea actualiza el campo correspondiente y viceversa.
 *
 * Reglas de fechas (aprobadas 16-jul-2026):
 * - Mensaje de logística: 20 días antes de la 1ª sesión, o de inmediato.
 * - Contenido al facilitador y PPT: 14 días antes si el facilitador es
 *   externo, 7 si es interno (equipo + Caro); si no alcanza, al día siguiente.
 * - Lista de participantes e impresión de manuales (presencial): 7 días antes.
 * - Encuestas QR y liga de sesión (online): 3 días antes.
 * - Entregas post-curso: 2 días HÁBILES después de la última sesión;
 *   factura el mismo día; seguimientos a 20 y 30 días naturales.
 */

export type ComputedTask = {
  key: string;
  kind: "Logística" | "Preparación" | "Material" | "Revisión" | "Entrega" | "Seguimiento";
  title: string;
  trainingId: string;
  trainingName: string;
  clientName: string;
  assignee: string;
  due: string | null;
  complete:
    | { type: "training_field"; field: string; value: string }
    | { type: "material_status"; materialId: string; nextStatus: string };
};

type TrainingFull = Training & {
  clients: Pick<Client, "id" | "company"> | null;
  sessions: Session[];
  materials: Material[];
};

const POST_ITEMS: { field: string; label: string }[] = [
  { field: "envio_manual", label: "Enviar manual del participante" },
  { field: "envio_constancias", label: "Enviar constancias" },
  { field: "envio_insignias", label: "Enviar insignias" },
  { field: "envio_dc3", label: "Enviar DC-3" },
  { field: "encuesta_participantes", label: "Recabar encuesta de satisfacción de participantes" },
  { field: "envio_leads", label: "Compartir leads con comercial" },
  { field: "encuesta_final", label: "Encuesta del cliente contratante" },
];

function activeSessions(sessions: Session[]): Session[] {
  return sessions.filter((s) => s.status !== "Cancelada");
}

function activeDates(sessions: Session[]): string[] {
  return activeSessions(sessions)
    .filter((s) => s.session_date)
    .map((s) => s.session_date!)
    .sort();
}

/** La fecha nunca queda en el pasado: si ya no alcanza, es `min`. */
function atLeast(date: string, min: string): string {
  return date < min ? min : date;
}

export function isInternalFacilitator(facilitators: string[], internalNames: string[]): boolean {
  const known = internalNames.map((n) => n.toLowerCase());
  const named = facilitators.filter(Boolean);
  if (named.length === 0) return true; // sin facilitador definido: asumimos interno
  return named.every((f) => {
    const fl = f.toLowerCase().trim();
    return known.some((k) => k.includes(fl) || fl.includes(k.split(" ")[0]) || k.split(" ").some((part) => part && fl.includes(part)));
  });
}

export function computeTasks(
  trainings: TrainingFull[],
  internalNames: string[] = []
): ComputedTask[] {
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const tasks: ComputedTask[] = [];

  for (const t of trainings) {
    if (t.status === "Cancelada") continue;

    const clientName = t.clients?.company ?? "";
    const dates = activeDates(t.sessions);
    const firstDate = dates[0] ?? null;
    const lastDate = dates[dates.length - 1] ?? null;
    const modalities = activeSessions(t.sessions).map((s) => s.modality).filter(Boolean);
    const hasPresencial = modalities.some((m) => m === "Presencial" || m === "Híbrida");
    const hasOnline = modalities.some((m) => m === "Online" || m === "Híbrida");
    const facilitators = [...new Set(activeSessions(t.sessions).map((s) => s.facilitator).filter(Boolean))];
    const internal = isInternalFacilitator(facilitators, internalNames);
    const contentDays = internal ? 7 : 14;

    const base = {
      trainingId: t.id,
      trainingName: t.short_name,
      clientName,
      assignee: t.internal_owner,
    };
    const val = (field: string) => (t as unknown as Record<string, string>)[field];
    const trainingField = (field: string) =>
      ({ type: "training_field", field, value: "Listo" }) as const;

    // ---- Antes del curso ----

    // Mensaje de logística: 20 días antes o de inmediato
    if (t.mensaje_logistica === "Pendiente") {
      tasks.push({
        ...base,
        key: `${t.id}-logistica`,
        kind: "Logística",
        title: "Enviar mensaje de logística por WhatsApp",
        due: firstDate ? atLeast(addDays(firstDate, -20), today) : null,
        complete: trainingField("mensaje_logistica"),
      });
    }

    // Preparación previa (solo si el campo sigue Pendiente)
    const PRE_ITEMS: { field: string; label: string; days: number; applies: boolean }[] = [
      {
        field: "contenido_facilitador",
        label: `Entregar contenido completo al facilitador${internal ? "" : " (externo)"}`,
        days: contentDays,
        applies: true,
      },
      {
        field: "lista_participantes",
        label: "Confirmar lista de participantes (nombres completos)",
        days: 7,
        applies: true,
      },
      {
        field: "impresion_manuales",
        label: "Confirmar quién imprime los manuales (cliente o nosotros)",
        days: 7,
        applies: hasPresencial,
      },
      {
        field: "encuestas_qr",
        label: "Validar encuestas: QR y ligas funcionando",
        days: 3,
        applies: true,
      },
      {
        field: "liga_sesion_valida",
        label: "Generar y validar liga de la sesión online",
        days: 3,
        applies: hasOnline,
      },
    ];

    for (const item of PRE_ITEMS) {
      if (!item.applies || val(item.field) !== "Pendiente") continue;
      tasks.push({
        ...base,
        key: `${t.id}-${item.field}`,
        kind: "Preparación",
        title: item.label,
        due: firstDate ? atLeast(addDays(firstDate, -item.days), tomorrow) : null,
        complete: trainingField(item.field),
      });
    }

    // ---- Materiales: hacer y revisar ----
    for (const m of t.materials) {
      const due =
        m.due_date ??
        t.materials_deadline ??
        (firstDate ? atLeast(addDays(firstDate, -contentDays), tomorrow) : null);
      if (m.status === "Pendiente" || m.status === "En proceso") {
        tasks.push({
          ...base,
          key: `${m.id}-hacer`,
          kind: "Material",
          title: `Preparar ${m.type}: ${m.name}`,
          assignee: m.maker || t.internal_owner,
          due,
          complete: {
            type: "material_status",
            materialId: m.id,
            nextStatus: m.reviewer ? "Por revisar" : "Listo",
          },
        });
      }
      if (m.status === "Por revisar") {
        tasks.push({
          ...base,
          key: `${m.id}-revisar`,
          kind: "Revisión",
          title: `Revisar ${m.type}: ${m.name}`,
          assignee: m.reviewer || t.internal_owner,
          due,
          complete: { type: "material_status", materialId: m.id, nextStatus: "Listo" },
        });
      }
    }

    // ---- Después del curso ----
    if (lastDate && today > lastDate) {
      const due48h = addBusinessDays(lastDate, 2);
      for (const item of POST_ITEMS) {
        if (val(item.field) === "Pendiente") {
          tasks.push({
            ...base,
            key: `${t.id}-${item.field}`,
            kind: "Entrega",
            title: item.label,
            due: due48h,
            complete: trainingField(item.field),
          });
        }
      }
    }

    // Factura: el mismo día del curso
    if (lastDate && today >= lastDate && t.factura === "Pendiente") {
      tasks.push({
        ...base,
        key: `${t.id}-factura`,
        kind: "Entrega",
        title: "Solicitar emisión y envío de factura",
        due: lastDate,
        complete: trainingField("factura"),
      });
    }

    // Seguimientos día 20 y 30 (aparecen 3 días antes de vencer)
    if (lastDate) {
      const seg = [
        { field: "seguimiento_20", label: "Seguimiento día 20: validar aplicación de aprendizajes", days: 20 },
        { field: "seguimiento_30", label: "Seguimiento día 30: cierre y clausura del grupo de WhatsApp", days: 30 },
      ];
      for (const s of seg) {
        const due = addDays(lastDate, s.days);
        if (val(s.field) === "Pendiente" && today >= addDays(due, -3)) {
          tasks.push({
            ...base,
            key: `${t.id}-${s.field}`,
            kind: "Seguimiento",
            title: s.label,
            due,
            complete: trainingField(s.field),
          });
        }
      }
    }
  }

  return tasks.sort((a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due < b.due ? -1 : 1;
  });
}
