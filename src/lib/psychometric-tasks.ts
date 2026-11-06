import { addDays, todayISO } from "./format";
import type { ComputedTask } from "./tasks";
import type { Client, PsychometricPerson, PsychometricRequest } from "./types";

/**
 * Motor de tareas del módulo de Psicometría: convierte el "Mapa del
 * Proceso de Psicometría" de Jaqui (14 pasos con responsables y SLAs) en
 * tareas automáticas. Los rombos del mapa (3, 8 y 12) son estados; aquí
 * solo se generan los pasos accionables que siguen pendientes.
 *
 * El reloj del arranque es `requisition_at` (paso 1: llega la requisición
 * por el grupo de WhatsApp). Si aún no se captura, se usa la fecha de alta.
 * De ahí en adelante cada persona lleva su propio reloj, que arranca el
 * día en que se le mandan las pruebas (paso 6).
 *
 * Responsables: PSICOMETRÍA → evaluator; COMERCIAL → comercial; CLIENTE y
 * PERSONA EVALUADA → los persigue Psicometría. Los pasos 2 y 5 (factura)
 * no generan tareas: las facturas quedaron fuera del CRM el 27-oct-2026.
 *
 * Todas las claves de tarea llevan el id de la solicitud ("psic-<id>-…")
 * para poder sumar el tiempo ⏱ invertido por solicitud.
 */

export type PsychometricRequestFull = PsychometricRequest & {
  clients?: Pick<Client, "id" | "company"> | null;
  people?: PsychometricPerson[];
};

/** La fecha nunca queda en el pasado: si ya no alcanza, es `min`. */
function atLeast(date: string, min: string): string {
  return date < min ? min : date;
}

export function activePeople(people: PsychometricPerson[]): PsychometricPerson[] {
  return people.filter((p) => p.status !== "Cancelada");
}

/** Resultados del rombo 12 que piden validar antes de entregar (paso 13). */
export function needsValidation(p: Pick<PsychometricPerson, "result">): boolean {
  return p.result === "Apta con reservas" || p.result === "No apta";
}

/**
 * Fase de la solicitud según cómo van sus personas. Pausada y Cancelada
 * se eligen a mano y no pasan por aquí.
 */
export function psychometricPhase(people: PsychometricPerson[]): string {
  const active = activePeople(people);
  const started = (p: PsychometricPerson) => p.sent_at || p.receipt !== "Pendiente" || p.tests_done === "Completas";
  if (active.length === 0 || !active.some(started)) return "Requisición";
  if (active.every((p) => p.delivered_at)) return "Entregada";
  if (active.every((p) => p.tests_done === "Completas")) return "Reportes";
  return "En aplicación";
}

/** Qué falta para que la solicitud pase a la siguiente fase (para la ficha). */
export function nextPhaseHint(status: string): string {
  switch (status) {
    case "Requisición":
      return "Pasa sola a En aplicación en cuanto se le manden las pruebas a la primera persona.";
    case "En aplicación":
      return "Pasa sola a Reportes cuando todas las personas hayan respondido sus pruebas.";
    case "Reportes":
      return "Pasa sola a Entregada cuando se entregue el último reporte.";
    case "Entregada":
      return "Todos los reportes están entregados.";
    case "Pausada":
      return "Para reanudarla, elige la fase en el menú: el CRM la deja en la que le toca.";
    default:
      return "";
  }
}

export function computePsychometricTasks(requests: PsychometricRequestFull[]): ComputedTask[] {
  const today = todayISO();
  const tasks: ComputedTask[] = [];

  for (const r of requests) {
    if (r.status === "Cancelada" || r.status === "Pausada" || r.status === "Entregada") continue;

    const base = {
      kind: "Psicometría" as const,
      trainingId: "", // no cuelga de una capacitación
      trainingName: r.title,
      clientName: r.clients?.company ?? "",
      href: `/psicometria/${r.id}`,
    };
    // Paso 1: inicio de tiempos
    const ref = r.requisition_at ?? r.created_at.slice(0, 10);
    const field = (f: string, value: string) =>
      ({ type: "psychometric_field", requestId: r.id, field: f, value }) as const;
    const push = (
      key: string,
      title: string,
      assignee: string,
      due: string | null,
      complete: ComputedTask["complete"],
      details?: string
    ) =>
      tasks.push({ ...base, key: `psic-${r.id}-${key}`, title, assignee, due, details, complete });

    // ---- Arranque (pasos 1-4) ----
    if (r.requisicion_revisada === "Pendiente") {
      push(
        "revision",
        "Revisar la requisición y aclarar dudas con el cliente",
        r.evaluator,
        atLeast(addDays(ref, 1), today),
        field("requisicion_revisada", "Listo")
      );
    }
    // Rombo 3: lo confirma Comercial el mismo día
    if (r.requisicion_revisada !== "Pendiente" && r.info_completa === "Pendiente") {
      push(
        "info",
        "Confirmar que la información está completa y el proyecto es viable",
        r.comercial,
        atLeast(addDays(ref, 1), today),
        field("info_completa", "Sí"),
        "Al palomearla la información queda completa y Psicometría puede mandar las pruebas. Si falta algo, marca 'No' en la ficha."
      );
    }
    // Rombo 3, rama NO → paso 4
    if (r.info_completa === "No") {
      push(
        "info_pendiente",
        "Completar o aclarar la información pendiente con el cliente",
        r.comercial,
        atLeast(addDays(r.info_checked_at ?? today, 1), today),
        field("info_completa", "Sí"),
        "Al palomearla la información queda completa y Psicometría puede mandar las pruebas."
      );
    }

    const people = activePeople(r.people ?? []);
    const infoOk = r.info_completa === "Sí";
    const infoDate = r.info_checked_at ?? ref;

    if (infoOk && people.length === 0) {
      push(
        "personas",
        "Capturar a las personas que se van a evaluar",
        r.evaluator,
        atLeast(infoDate, today),
        field("people_pending", ""),
        "Se completa agregando a las personas en la ficha de la solicitud."
      );
    }

    // ---- Cada persona (pasos 6-14) ----
    for (const p of people) {
      const person = (f: string, value: string) =>
        ({ type: "psychometric_person", personId: p.id, requestId: r.id, field: f, value }) as const;
      const pushPerson = (
        key: string,
        title: string,
        due: string | null,
        complete: ComputedTask["complete"],
        details?: string
      ) => push(`p-${p.id}-${key}`, title, r.evaluator, due, complete, details);

      // Si ya avanzó sin fecha de envío capturada, las pruebas ya salieron
      const sent = p.sent_at ?? p.receipt_at ?? p.tests_done_at ?? (p.receipt !== "Pendiente" ? today : null);

      // Paso 6: mismo día que se confirma la información
      if (!sent) {
        if (infoOk) {
          pushPerson(
            "envio",
            `Mandar las pruebas a ${p.name} con las instrucciones`,
            atLeast(infoDate, today),
            person("sent_at", "hoy"),
            "En la ficha está el mensaje listo para copiar, con las ligas. Al palomearla se registra hoy como fecha de envío."
          );
        }
        continue;
      }

      const answered = p.tests_done === "Completas";

      // Pasos 7 y 8: máximo 24h después del envío
      if (!answered && p.receipt === "Pendiente") {
        pushPerson(
          "recepcion",
          `Confirmar que ${p.name} recibió las pruebas`,
          addDays(sent, 1),
          person("receipt", "Recibidas"),
          "Si no le llegaron, marca 'No recibidas' en la tabla: te queda la tarea de pedirle apoyo al cliente."
        );
      }
      // Paso 9 (rombo 8, rama NO): máximo 24h después de enviarlas
      if (!answered && p.receipt === "No recibidas" && p.client_followup === "Pendiente") {
        pushPerson(
          "cliente",
          `Pedirle al cliente que apoye con el seguimiento de ${p.name}`,
          atLeast(addDays(sent, 1), today),
          person("client_followup", "Listo")
        );
      }
      // Paso 10: a las 48h del envío, una vez resuelta la recepción
      const receiptResolved =
        p.receipt === "Recibidas" || (p.receipt === "No recibidas" && p.client_followup !== "Pendiente");
      if (!answered && receiptResolved) {
        pushPerson(
          "verificacion",
          `Verificar en las plataformas que ${p.name} respondió todas las pruebas`,
          addDays(sent, 2),
          person("tests_done", "Completas")
        );
      }
      if (!answered) continue;

      // Paso 11: 48h después de la verificación, sin pasarse de lo que pidió el cliente
      const doneAt = p.tests_done_at ?? today;
      if (p.report_status === "Pendiente") {
        let due = addDays(doneAt, 2);
        if (r.client_deadline && r.client_deadline < due) due = atLeast(r.client_deadline, doneAt);
        pushPerson(
          "reporte",
          `Hacer el reporte de ${p.name}`,
          due,
          person("report_status", "Listo"),
          r.report_type === "Guardería" ? "Formato de guardería." : undefined
        );
        continue;
      }

      // Paso 12 (rombo): máximo 24h después del reporte
      if (p.result === "Pendiente") {
        pushPerson(
          "viabilidad",
          `Revisar el reporte de ${p.name}: ¿es viable para el puesto?`,
          addDays(p.report_done_at ?? today, 1),
          person("result", "Apta"),
          "Al palomearla queda como Apta. Si sale apta con reservas o no apta, elígelo en la tabla: te queda la tarea de validar los hallazgos."
        );
        continue;
      }

      // Paso 13 (rombo 12, rama NO): el mismo día que se revisa el reporte
      const resultAt = p.result_at ?? today;
      if (needsValidation(p) && p.validation === "Pendiente") {
        pushPerson(
          "validacion",
          r.report_type === "Guardería"
            ? `Entrevistar a ${p.name} para validar los hallazgos e informar al cliente`
            : `Validar los hallazgos de ${p.name} e informarle al cliente`,
          atLeast(resultAt, today),
          person("validation", "Listo")
        );
        continue;
      }

      // Paso 14: el mismo día que se valida (o que se revisa, si no hizo falta)
      if (!p.delivered_at) {
        pushPerson(
          "entrega",
          `Entregar el reporte de ${p.name} por el grupo de WhatsApp y confirmar de recibido`,
          needsValidation(p) ? (p.validated_at ?? today) : resultAt,
          person("delivered_at", "hoy"),
          "Al palomearla se registra hoy como fecha de entrega."
        );
      }
    }
  }

  return tasks;
}
