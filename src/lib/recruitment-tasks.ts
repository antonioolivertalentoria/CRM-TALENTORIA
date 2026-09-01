import { addBusinessDays, addDays, todayISO } from "./format";
import { FINANCE_OWNER } from "./constants";
import type { ComputedTask } from "./tasks";
import type { Client, RecruitmentCandidate, RecruitmentVacancy } from "./types";

/**
 * Motor de tareas del módulo de Reclutamiento: convierte el "Flujo del
 * Proceso de Reclutamiento" (22 pasos con responsables y SLAs) en tareas
 * automáticas. Los rombos del diagrama (8, 16, 18 y el de garantía) son
 * estados; aquí solo se generan los pasos accionables que siguen pendientes.
 *
 * El reloj de todo el proceso es `requisition_at` (paso 4: "Reclutador
 * recibe requisición — inicio de tiempos"). Si aún no se captura, se usa
 * la fecha de alta de la vacante.
 *
 * Responsables según el diagrama: RECLUTADOR → recruiter; COMERCIAL →
 * comercial; FINANZAS → FINANCE_OWNER; CLIENTE → lo persigue el reclutador.
 *
 * Todas las claves de tarea llevan el id de la vacante ("recl-<id>-…")
 * para poder sumar el tiempo ⏱ invertido por proceso.
 */

export type RecruitmentVacancyFull = RecruitmentVacancy & {
  clients?: Pick<Client, "id" | "company"> | null;
  candidates?: RecruitmentCandidate[];
};

/** La fecha nunca queda en el pasado: si ya no alcanza, es `min`. */
function atLeast(date: string, min: string): string {
  return date < min ? min : date;
}

/** Candidatos que siguen vivos en el embudo. */
function activeCandidates(candidates: RecruitmentCandidate[]): RecruitmentCandidate[] {
  return candidates.filter((c) => c.status !== "Rechazado" && c.status !== "Descartado");
}

export function computeRecruitmentTasks(vacancies: RecruitmentVacancyFull[]): ComputedTask[] {
  const today = todayISO();
  const tasks: ComputedTask[] = [];

  for (const v of vacancies) {
    if (v.status === "Cancelada" || v.status === "Cerrada") continue;

    const clientName = v.clients?.company ?? "";
    const candidates = v.candidates ?? [];
    const base = {
      kind: "Reclutamiento" as const,
      trainingId: "", // no cuelga de una capacitación
      trainingName: v.position,
      clientName,
    };
    // Paso 4: inicio de tiempos
    const ref = v.requisition_at ?? v.created_at.slice(0, 10);
    const field = (f: string) =>
      ({ type: "recruitment_field", vacancyId: v.id, field: f }) as const;
    const push = (
      key: string,
      title: string,
      assignee: string,
      due: string | null,
      complete: ComputedTask["complete"],
      details?: string
    ) =>
      tasks.push({
        ...base,
        key: `recl-${v.id}-${key}`,
        title: `${title} · ${v.position}`,
        assignee,
        due,
        details,
        complete,
      });

    // ---- Arranque: comercial (pasos 2-3) ----
    if (v.factura_anticipo === "Pendiente") {
      push(
        "anticipo",
        "Enviar factura de anticipo al cliente",
        v.comercial,
        atLeast(v.quote_authorized_at ?? ref, today),
        field("factura_anticipo")
      );
    }
    if (v.requisicion_enviada === "Pendiente") {
      push(
        "requisicion",
        "Enviar la requisición al reclutador",
        v.comercial,
        atLeast(v.quote_authorized_at ?? ref, today),
        field("requisicion_enviada")
      );
    }

    // ---- Levantamiento de perfil (pasos 5-8) ----
    if (v.contacto_cliente === "Pendiente") {
      push(
        "contacto",
        "Contactar al cliente para agendar la reunión de levantamiento",
        v.recruiter,
        atLeast(addDays(ref, 1), today),
        field("contacto_cliente")
      );
    }
    if (v.levantamiento_perfil === "Pendiente") {
      push(
        "levantamiento",
        "Realizar el levantamiento de perfil con el cliente",
        v.recruiter,
        atLeast(v.profile_meeting_date ?? addDays(ref, 2), today),
        field("levantamiento_perfil")
      );
    }
    if (v.levantamiento_perfil === "Listo" && v.levantamiento_enviado === "Pendiente") {
      push(
        "envio_levantamiento",
        "Enviar el levantamiento al cliente para autorización",
        v.recruiter,
        atLeast(v.profile_meeting_date ?? addDays(ref, 2), today),
        field("levantamiento_enviado")
      );
    }
    // Rombo 8: el cliente responde el mismo día
    if (v.levantamiento_enviado === "Listo" && v.levantamiento_autorizado === "Pendiente") {
      push(
        "autorizacion",
        "Dar seguimiento a la autorización del levantamiento",
        v.recruiter,
        atLeast(v.profile_meeting_date ?? addDays(ref, 2), today),
        { type: "recruitment_field", vacancyId: v.id, field: "levantamiento_autorizado", value: "Autorizado" },
        "Al palomearla se marca el levantamiento como autorizado por el cliente."
      );
    }
    // Rombo 8, rama NO: el cliente pidió cambios → se regresa al paso 5
    if (v.levantamiento_autorizado === "Cambios solicitados") {
      push(
        "cambios_perfil",
        "El cliente pidió cambios: reagendar y ajustar el levantamiento",
        v.recruiter,
        atLeast(addDays(today, 1), today),
        { type: "recruitment_field", vacancyId: v.id, field: "levantamiento_autorizado", value: "Pendiente" },
        "Al palomearla el levantamiento vuelve a quedar en espera de autorización."
      );
    }

    const authorized = v.levantamiento_autorizado === "Autorizado";

    // ---- Publicación (pasos 9-11) ----
    if (authorized && v.estrategia_publicacion === "Pendiente") {
      push(
        "estrategia",
        "Definir la estrategia de publicación (medios y presupuesto)",
        v.recruiter,
        atLeast(v.profile_authorized_at ?? today, today),
        field("estrategia_publicacion")
      );
    }
    if (authorized && !v.published_at) {
      push(
        "publicar",
        "Publicar la vacante en los medios definidos",
        v.recruiter,
        atLeast(addDays(v.profile_authorized_at ?? ref, 1), today),
        { type: "recruitment_stamp", vacancyId: v.id, field: "published_at" },
        "Al palomearla se registra hoy como fecha de publicación."
      );
    }
    if (v.published_at && v.dashboard_actualizado === "Pendiente") {
      push(
        "dashboard",
        "Subir la información de la vacante al dashboard",
        v.recruiter,
        v.published_at,
        field("dashboard_actualizado")
      );
    }

    // ---- Búsqueda y terna (pasos 12-15) ----
    if (v.published_at) {
      if (v.filtrado_entrevistas === "Pendiente") {
        push(
          "filtrado",
          "Filtrar currículums, capturar candidatos y entrevistar",
          v.recruiter,
          addDays(v.published_at, 3),
          field("filtrado_entrevistas")
        );
      }
      if (!v.candidates_sent_at) {
        const listos = candidates.filter((c) =>
          ["Enviado al cliente", "Aprobado por cliente", "Psicometría", "Referencias", "Contratado"].includes(c.status)
        ).length;
        push(
          "terna",
          `Enviar de 3 a 5 candidatos al cliente${listos ? ` (${listos} listos)` : ""}`,
          v.recruiter,
          addBusinessDays(v.published_at, 10),
          { type: "recruitment_stamp", vacancyId: v.id, field: "candidates_sent_at" },
          "Al palomearla se registra hoy como fecha de envío de la terna."
        );
      }
    }

    // ---- Candidatos: decisión, psicometría y referencias (pasos 16-19) ----
    for (const c of activeCandidates(candidates)) {
      // Paso 16: el cliente responde máx. 24h después de entrevistar
      if (c.status === "Enviado al cliente") {
        tasks.push({
          ...base,
          key: `recl-${v.id}-cand-${c.id}-decision`,
          title: `Confirmar decisión del cliente sobre ${c.name} · ${v.position}`,
          assignee: v.recruiter,
          due: c.client_interview_at
            ? addDays(c.client_interview_at, 1)
            : c.sent_at
              ? addBusinessDays(c.sent_at, 2)
              : null,
          details: "Al palomearla el candidato queda aprobado por el cliente. Si lo rechazan, cámbialo a Rechazado en la tabla de candidatos.",
          complete: {
            type: "recruitment_candidate",
            candidateId: c.id,
            vacancyId: v.id,
            field: "status",
            value: "Aprobado por cliente",
          },
        });
      }
      // Paso 17: psicometrías dentro de las 24h de la aprobación
      if (c.status === "Aprobado por cliente" && c.psychometrics === "Pendiente") {
        tasks.push({
          ...base,
          key: `recl-${v.id}-cand-${c.id}-psico`,
          title: `Aplicar psicometrías online a ${c.name} · ${v.position}`,
          assignee: v.recruiter,
          due: c.client_interview_at ? addDays(c.client_interview_at, 2) : addDays(today, 1),
          details: "Al palomearla la psicometría queda aprobada. Si no la pasa, marca 'No aprobada' en la tabla: el candidato se rechaza solo (paso 18).",
          complete: {
            type: "recruitment_candidate",
            candidateId: c.id,
            vacancyId: v.id,
            field: "psychometrics",
            value: "Aprobada",
          },
        });
      }
      // Paso 19: referencias del finalista, 24h desde la psicometría aprobatoria
      if (
        (c.psychometrics === "Aprobada" || c.psychometrics === "No aplica") &&
        c.references_status === "Pendiente" &&
        c.status !== "Contratado"
      ) {
        tasks.push({
          ...base,
          key: `recl-${v.id}-cand-${c.id}-refs`,
          title: `Verificar y enviar referencias de ${c.name} · ${v.position}`,
          assignee: v.recruiter,
          due: c.psychometrics_at ? addDays(c.psychometrics_at, 1) : addDays(today, 1),
          complete: {
            type: "recruitment_candidate",
            candidateId: c.id,
            vacancyId: v.id,
            field: "references_status",
            value: "Enviadas",
          },
        });
      }
    }

    // ---- Paso 20: acordar la fecha de ingreso ----
    const finalista = activeCandidates(candidates).some(
      (c) => c.references_status === "Enviadas" || c.status === "Referencias" || c.status === "Contratado"
    );
    if (finalista && !v.hire_date) {
      push(
        "ingreso",
        "Acordar con el cliente la fecha de ingreso",
        v.recruiter,
        addDays(today, 1),
        { type: "recruitment_field", vacancyId: v.id, field: "hire_date_pending" },
        "Se completa capturando la fecha de ingreso en la ficha de la vacante."
      );
    }

    // ---- Ingreso, facturación y cierre (pasos 21-22) ----
    if (v.hire_date) {
      const d = v.hire_date;
      if (v.factura_cobertura === "Pendiente") {
        // Antes o el mismo día del ingreso; si la fecha se captura tarde,
        // la tarea nace para hoy en vez de nacer vencida.
        push("factura_sol", "Solicitar la factura de cobertura al área de finanzas", v.recruiter, atLeast(addDays(d, -1), today), field("factura_cobertura"));
      }
      if (v.factura_cobertura === "Listo" && v.factura_enviada === "Pendiente") {
        push("factura_env", "Enviar la factura de cobertura al cliente", FINANCE_OWNER, d, field("factura_enviada"));
      }
      if (v.factura_enviada === "Listo" && v.factura_confirmada === "Pendiente") {
        push("factura_conf", "Confirmar con el cliente que le llegó la factura", v.recruiter, d, field("factura_confirmada"));
      }
      if (today >= d) {
        if (v.ingreso_confirmado === "Pendiente") {
          push("ingreso_ok", "Confirmar que el candidato se presentó y está contratado", v.recruiter, d, field("ingreso_confirmado"));
        }
        if (v.aviso_candidatos === "Pendiente") {
          push("aviso", "Informar a los demás candidatos que la vacante se cubrió", v.recruiter, addDays(d, 1), field("aviso_candidatos"));
        }
        if (v.seguimiento_cliente === "Pendiente") {
          push("seguimiento", "Dar seguimiento con el cliente durante la garantía", v.recruiter, addDays(d, 15), field("seguimiento_cliente"));
        }
      }

      // Cierre de garantía: el correo sale 1 semana antes de que termine
      const guaranteeEnd = addDays(d, v.guarantee_days ?? 90);
      const avisoDue = addDays(guaranteeEnd, -7);
      if (v.correo_garantia === "Pendiente" && today >= addDays(avisoDue, -3)) {
        push(
          "garantia",
          "Enviar correo de término de garantía y cierre del proceso",
          v.recruiter,
          avisoDue,
          field("correo_garantia")
        );
      }
      // Rombo final: ¿la persona continúa en la empresa?
      if (v.continua_persona === "Pendiente" && today >= addDays(guaranteeEnd, -3)) {
        push(
          "continua",
          "Confirmar si la persona continúa en la empresa y cerrar el proceso",
          v.recruiter,
          guaranteeEnd,
          { type: "recruitment_field", vacancyId: v.id, field: "continua_persona", value: "Sí" },
          "Al palomearla se cierra el proceso. Si la persona ya no está, marca 'No' en la ficha: se reabre la búsqueda desde la publicación.",
        );
      }
      // Rama NO: se inicia proceso de nuevo desde la publicación de la vacante
      if (v.continua_persona === "No") {
        push(
          "reposicion",
          "Reposición de garantía: reiniciar la búsqueda desde la publicación",
          v.recruiter,
          atLeast(addDays(today, 1), today),
          { type: "recruitment_field", vacancyId: v.id, field: "reposicion", value: "Sí" },
          "Al palomearla la vacante regresa a 'Publicada' con fecha de hoy y se limpian terna e ingreso; los candidatos y el historial se conservan."
        );
      }
    }
  }

  return tasks;
}
