import { addBusinessDays, addDays, todayISO } from "./format";
import type { Client, Material, Session, Training } from "./types";

/**
 * Motor de tareas: las tareas NO se capturan aparte, se derivan de las
 * capacitaciones, sesiones y materiales. Completar una tarea actualiza
 * el campo correspondiente de la capacitación o del material, así el
 * tablero y el perfil siempre están sincronizados.
 */

export type ComputedTask = {
  key: string;
  kind: "Logística" | "Material" | "Revisión" | "Entrega" | "Seguimiento";
  title: string;
  trainingId: string;
  trainingName: string;
  clientName: string;
  assignee: string; // full_name del perfil, o "" si no hay responsable
  due: string | null; // fecha límite ISO
  // Cómo se completa:
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

function activeDates(sessions: Session[]): string[] {
  return sessions
    .filter((s) => s.session_date && s.status !== "Cancelada")
    .map((s) => s.session_date!)
    .sort();
}

export function computeTasks(trainings: TrainingFull[]): ComputedTask[] {
  const today = todayISO();
  const tasks: ComputedTask[] = [];

  for (const t of trainings) {
    if (t.status === "Cancelada") continue;

    const clientName = t.clients?.company ?? "";
    const dates = activeDates(t.sessions);
    const firstDate = dates[0] ?? null;
    const lastDate = dates[dates.length - 1] ?? null;
    const base = {
      trainingId: t.id,
      trainingName: t.short_name,
      clientName,
      assignee: t.internal_owner,
    };

    // 1. Mensaje de logística por WhatsApp (antes de la capacitación)
    if (t.mensaje_logistica === "Pendiente") {
      tasks.push({
        ...base,
        key: `${t.id}-logistica`,
        kind: "Logística",
        title: "Enviar mensaje de logística por WhatsApp",
        due: firstDate ? addDays(firstDate, -7) : null,
        complete: { type: "training_field", field: "mensaje_logistica", value: "Listo" },
      });
    }

    // 2. Materiales: hacer y revisar
    for (const m of t.materials) {
      const due = m.due_date ?? t.materials_deadline ?? (firstDate ? addDays(firstDate, -3) : null);
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

    // 3. Post-capacitación: aparecen al día siguiente de la última sesión,
    //    vencen a los 2 días hábiles (fines de semana no se trabaja).
    if (lastDate && today > lastDate) {
      const due48h = addBusinessDays(lastDate, 2);
      for (const item of POST_ITEMS) {
        const value = (t as unknown as Record<string, string>)[item.field];
        if (value === "Pendiente") {
          tasks.push({
            ...base,
            key: `${t.id}-${item.field}`,
            kind: "Entrega",
            title: item.label,
            due: due48h,
            complete: { type: "training_field", field: item.field, value: "Listo" },
          });
        }
      }
    }

    // Factura: se solicita el mismo día del curso
    if (lastDate && today >= lastDate && t.factura === "Pendiente") {
      tasks.push({
        ...base,
        key: `${t.id}-factura`,
        kind: "Entrega",
        title: "Solicitar emisión y envío de factura",
        due: lastDate,
        complete: { type: "training_field", field: "factura", value: "Listo" },
      });
    }

    // 4. Seguimientos día 20 y 30 (aparecen 3 días antes de vencer)
    if (lastDate) {
      const seg = [
        { field: "seguimiento_20", label: "Seguimiento día 20: validar aplicación de aprendizajes", days: 20 },
        { field: "seguimiento_30", label: "Seguimiento día 30: cierre y clausura del grupo de WhatsApp", days: 30 },
      ];
      for (const s of seg) {
        const value = (t as unknown as Record<string, string>)[s.field];
        const due = addDays(lastDate, s.days);
        if (value === "Pendiente" && today >= addDays(due, -3)) {
          tasks.push({
            ...base,
            key: `${t.id}-${s.field}`,
            kind: "Seguimiento",
            title: s.label,
            due,
            complete: { type: "training_field", field: s.field, value: "Listo" },
          });
        }
      }
    }
  }

  // Ordena por fecha límite (sin fecha al final)
  return tasks.sort((a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due < b.due ? -1 : 1;
  });
}
