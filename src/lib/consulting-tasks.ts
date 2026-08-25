import { addBusinessDays, addDays, todayISO } from "./format";
import { FINANCE_OWNER } from "./constants";
import type { ComputedTask } from "./tasks";
import type {
  Client,
  ConsultingChange,
  ConsultingInput,
  ConsultingMilestone,
  ConsultingProject,
} from "./types";

/**
 * Motor de tareas del módulo de Consultoría: convierte el "Mapa del
 * Proceso de Consultoría" (32 pasos con responsables y SLAs) en tareas
 * automáticas. Las decisiones del mapa son estados; aquí solo se generan
 * los pasos accionables que siguen pendientes.
 *
 * Responsables según el mapa: OPERACIONES → internal_owner del proyecto;
 * LÍDER → leader; COMERCIAL → comercial; FINANZAS → FINANCE_OWNER.
 *
 * Todas las claves de tarea llevan el id del proyecto ("cons-<id>-…")
 * para poder sumar el tiempo ⏱ invertido por proyecto.
 */

export type ConsultingProjectFull = ConsultingProject & {
  clients?: Pick<Client, "id" | "company"> | null;
  milestones?: ConsultingMilestone[];
  inputs?: ConsultingInput[];
  changes?: ConsultingChange[];
};

/** La fecha nunca queda en el pasado: si ya no alcanza, es `min`. */
function atLeast(date: string, min: string): string {
  return date < min ? min : date;
}

export function computeConsultingTasks(projects: ConsultingProjectFull[]): ComputedTask[] {
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const tasks: ComputedTask[] = [];

  for (const p of projects) {
    if (p.status === "Cancelado" || p.status === "Finalizado") continue;

    const clientName = p.clients?.company ?? "";
    const base = {
      kind: "Consultoría" as const,
      trainingId: "", // no cuelga de una capacitación
      trainingName: p.name,
      clientName,
    };
    const ref = p.authorized_at ?? p.created_at.slice(0, 10);
    const field = (f: string) =>
      ({ type: "consulting_field", projectId: p.id, field: f }) as const;
    const push = (
      key: string,
      title: string,
      assignee: string,
      due: string | null,
      complete: ComputedTask["complete"]
    ) =>
      tasks.push({
        ...base,
        key: `cons-${p.id}-${key}`,
        title: `${title} · ${p.name}`,
        assignee,
        due,
        complete,
      });

    // ---- Transferencia y preparación (pasos 2-12) ----
    if (p.expediente_completo === "Pendiente") {
      push(
        "expediente",
        "Revisar expediente (alcance, entregables, fechas, horas)",
        p.internal_owner,
        atLeast(addDays(ref, 1), today),
        field("expediente_completo")
      );
    }
    if (p.grupo_wa === "Pendiente") {
      push(
        "grupo_wa",
        "Crear grupo de WhatsApp con cliente y equipo",
        p.comercial,
        atLeast(addDays(ref, 1), today),
        field("grupo_wa")
      );
    }
    if (p.ficha_interna === "Pendiente") {
      push(
        "ficha",
        "Preparar ficha interna, riesgos y arranque",
        p.leader,
        atLeast(addDays(ref, 2), today),
        field("ficha_interna")
      );
    }
    if (!p.kickoff_date) {
      // Paso 8: agendar reunión de arranque (24h después del grupo).
      // No lleva palomita: desaparece sola al capturar la fecha de la
      // reunión en la ficha (el intento de completarla lo explica).
      tasks.push({
        ...base,
        key: `cons-${p.id}-agendar`,
        title: `Agendar reunión de arranque con el cliente · ${p.name}`,
        assignee: p.leader,
        due: atLeast(addDays(ref, 2), today),
        details: "Se completa capturando la fecha de la reunión de arranque en la ficha del proyecto.",
        complete: { type: "consulting_field", projectId: p.id, field: "kickoff_pending" },
      });
    }

    if (p.kickoff_date && p.kickoff_date <= today) {
      if (p.minuta_arranque === "Pendiente") {
        push(
          "minuta",
          "Enviar minuta y próximos pasos de la reunión de arranque",
          p.leader,
          addDays(p.kickoff_date, 1),
          field("minuta_arranque")
        );
      }
      if (p.plan_trabajo === "Pendiente") {
        push(
          "plan",
          "Generar plan de trabajo (actividades, hitos, horas)",
          p.leader,
          addDays(p.kickoff_date, 2),
          field("plan_trabajo")
        );
      }
      if (p.plan_trabajo === "Listo" && p.plan_validado === "Pendiente") {
        push(
          "validar_plan",
          "Validar plan y carga de trabajo",
          p.internal_owner,
          atLeast(addDays(p.kickoff_date, 3), tomorrow),
          field("plan_validado")
        );
      }
    }

    // ---- Ejecución: hitos del plan (pasos 13, 17-21) ----
    for (const m of p.milestones ?? []) {
      if (m.status === "Pendiente" || m.status === "En curso") {
        tasks.push({
          ...base,
          key: `cons-${p.id}-mi-${m.id}`,
          title: `Hito: ${m.title} · ${p.name}`,
          assignee: m.responsible || p.leader,
          due: m.due_date,
          complete: {
            type: "consulting_milestone",
            milestoneId: m.id,
            nextStatus: "Por revisar",
          },
        });
      }
      if (m.status === "Por revisar") {
        // Paso 19: revisión técnica de Operaciones; el plazo corre desde
        // que el hito quedó listo para revisión.
        tasks.push({
          ...base,
          key: `cons-${p.id}-mirev-${m.id}`,
          title: `Revisión técnica: ${m.title} · ${p.name}`,
          assignee: p.internal_owner,
          due: m.review_requested_at ? addBusinessDays(m.review_requested_at, 1) : m.due_date,
          complete: {
            type: "consulting_milestone",
            milestoneId: m.id,
            nextStatus: "Entregado",
          },
        });
      }
    }

    // ---- Insumos del cliente (pasos 14-16) ----
    for (const i of p.inputs ?? []) {
      if (i.received || !i.due_date) continue;
      const overdueDays = i.due_date < today;
      const escalate = overdueDays && addDays(i.due_date, 2) < today;
      tasks.push({
        ...base,
        key: `cons-${p.id}-in-${i.id}`,
        title: escalate
          ? `Escalar retraso de insumo: ${i.title} · ${p.name}`
          : `Insumo del cliente: ${i.title} (dar seguimiento) · ${p.name}`,
        // A las 48h de retraso escala al comercial (paso 16)
        assignee: escalate ? p.comercial : p.leader,
        due: i.due_date,
        complete: { type: "consulting_input", inputId: i.id },
      });
    }

    // ---- Cambios de alcance (paso 25: formalizar en 48h) ----
    for (const c of p.changes ?? []) {
      if (c.in_scope || c.status !== "En evaluación") continue;
      tasks.push({
        ...base,
        key: `cons-${p.id}-ch-${c.id}`,
        title: `Formalizar cambio de alcance: ${c.title} · ${p.name}`,
        assignee: p.comercial,
        due: atLeast(addDays(c.created_at.slice(0, 10), 2), today),
        complete: { type: "consulting_change", changeId: c.id },
      });
    }

    // ---- Entrega y cierre (pasos 27-32) ----
    if (p.delivery_date && p.delivery_date <= today) {
      const d = p.delivery_date;
      if (p.entregables_enviados === "Pendiente") {
        push("entregables", "Enviar entregables finales y evidencia de entrega", p.leader, addDays(d, 1), field("entregables_enviados"));
      }
      if (p.aceptacion_cliente === "Pendiente") {
        push("aceptacion", "Confirmar aceptación del cliente", p.leader, addBusinessDays(d, 3), field("aceptacion_cliente"));
      }
      if (p.factura === "Pendiente") {
        push("factura", "Solicitar emisión y envío de factura", FINANCE_OWNER, d, field("factura"));
      }
      if (p.encuesta === "Pendiente") {
        push("encuesta", "Enviar encuesta de satisfacción y dar seguimiento", p.leader, addDays(d, 2), field("encuesta"));
      }
      if (p.cierre_interno === "Pendiente") {
        push("cierre", "Cierre interno: horas, documentación y aprendizajes", p.internal_owner, addBusinessDays(d, 3), field("cierre_interno"));
      }
      // Seguimiento +20 días: aparece 3 días antes de vencer
      const segDue = addDays(d, 20);
      if (p.seguimiento_20 === "Pendiente" && today >= addDays(segDue, -3)) {
        push("seguimiento", "Seguimiento posproyecto y cierre definitivo", p.leader, segDue, field("seguimiento_20"));
      }
    }
  }

  return tasks;
}
