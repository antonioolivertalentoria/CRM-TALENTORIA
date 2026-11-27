import { addBusinessDays, addDays, todayISO } from "./format";
import { COMMERCIAL_CHANNEL_TRAININGS, CONTENT_OWNER, DOC_ORDERS_START, DOC_SEND_FIELD, DOCUMENTS_MAKER, LOGISTICS_OWNER, firstName } from "./constants";
import { orderMaker, orderWhat, receiverShort } from "./document-orders";
import { followUpContext, followUpStage, type FollowUpContext, type FollowUpField, type FollowUpStage } from "./follow-up";
import type { Client, CustomTask, DocumentOrder, Material, Session, Training, TrainingRequest } from "./types";

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
 *   seguimientos a 20 y 30 días naturales.
 *
 * Quién hace qué (Oli, 25-nov-2026): la responsable de la ficha
 * (internal_owner, por default Pao) lleva toda la logística; quien hace el
 * contenido (maker de los materiales, por default Oli) prepara PPT y
 * manuales y arma el informe de la encuesta subiendo la liga, y Pao lo envía.
 *
 * Facturas: fuera del CRM desde el 27-oct-2026 (decisión de Oli). Ningún
 * módulo genera tareas de factura y los campos quedaron en "No aplica".
 */

export type ComputedTask = {
  key: string;
  kind: "Logística" | "Preparación" | "Material" | "Revisión" | "Entrega" | "Seguimiento" | "Personal" | "Petición" | "Consultoría" | "Reclutamiento" | "Marketing" | "Psicometría";
  title: string;
  /** Vacío en tareas personales (no cuelgan de una capacitación). */
  trainingId: string;
  trainingName: string;
  clientName: string;
  assignee: string;
  requestedBy?: string;
  details?: string;
  /** La tarea propia original (solo en tareas kind "Personal"), para editarla. */
  custom?: CustomTask;
  /** A dónde lleva el renglón cuando la tarea no cuelga de una capacitación. */
  href?: string;
  due: string | null;
  /** Seguimientos día 20/30: el mensaje armado con los datos de la ficha. */
  followUp?: { stage: FollowUpStage; context: FollowUpContext };
  complete:
    | { type: "training_field"; field: string; value: string }
    /**
     * Pide pegar una liga (p. ej. el informe de la encuesta) y la guarda en
     * `field`. `statusField` es el paso del checklist que habilita: si ese
     * paso queda "No aplica", la tarea no cuenta en la bitácora.
     */
    | { type: "training_link"; field: string; statusField: string; prompt: string }
    | { type: "material_status"; materialId: string; nextStatus: string }
    | { type: "custom_task"; taskId: string }
    | { type: "training_request"; requestId: string }
    /** Pedido de constancias/DC-3/gafetes: pasa al siguiente estado (Realizada, Entregada). */
    | { type: "document_order"; orderId: string; nextStatus: string }
    /** "Pedir constancias a América" palomeado desde Mis tareas: crea el pedido. */
    | { type: "document_order_new"; trainingId: string; docType: string }
    | { type: "consulting_field"; projectId: string; field: string }
    | { type: "consulting_milestone"; milestoneId: string; nextStatus: string }
    | { type: "consulting_input"; inputId: string }
    | { type: "consulting_change"; changeId: string }
    | { type: "recruitment_field"; vacancyId: string; field: string; value?: string }
    /** Sella una fecha del proceso (publicación, terna) con el día de hoy. */
    | { type: "recruitment_stamp"; vacancyId: string; field: string }
    | { type: "recruitment_candidate"; candidateId: string; vacancyId: string; field: string; value: string }
    /** Psicometría: un campo de la solicitud (arranque y rombo 3). */
    | { type: "psychometric_field"; requestId: string; field: string; value: string }
    /** Psicometría: el avance de una persona evaluada ("hoy" sella la fecha). */
    | { type: "psychometric_person"; personId: string; requestId: string; field: string; value: string }
    /** Cierra un paso de los mapas de Marketing (con el resultado del rombo, si lo tiene). */
    | { type: "marketing_step"; projectId: string; stepKey: string; result?: string }
    /** Pasa todos los envíos del mes de una etapa a la siguiente. */
    | { type: "marketing_sends"; projectId: string; period: string; from: string; to: string }
    | { type: "marketing_send"; projectId: string; sendId: string; value: string }
    | { type: "marketing_lead"; leadId: string };
};

type TrainingFull = Training & {
  /** Contacto y WhatsApp solo llegan si el select los pide (Mis tareas, para los seguimientos). */
  clients: (Pick<Client, "id" | "company"> & Partial<Pick<Client, "contact_name" | "whatsapp">>) | null;
  sessions: Session[];
  materials: Material[];
  /** Peticiones de team building (solo llega si el select las incluye). */
  training_requests?: TrainingRequest[];
  /** Pedidos de constancias, DC-3 y gafetes (migración 029; se cuelgan aparte). */
  document_orders?: DocumentOrder[];
};

/**
 * Las tareas de América por cada pedido abierto: hacerlo y entregarlo a
 * quien lo pidió. Al entregarse ya no le toca nada a ella.
 */
function documentOrderTasks(
  t: TrainingFull,
  clientName: string
): ComputedTask[] {
  const out: ComputedTask[] = [];
  for (const o of t.document_orders ?? []) {
    const base = {
      trainingId: t.id,
      trainingName: t.short_name,
      clientName,
      assignee: orderMaker(o),
      requestedBy: o.requested_by,
      due: o.needed_by,
    };
    if (o.status === "Pedida") {
      const correction = o.corrections > 0 && o.correction_note;
      out.push({
        ...base,
        key: `ped-${o.id}-hacer`,
        kind: "Petición",
        title: `${correction ? "Corregir" : "Hacer"} ${orderWhat(o)}`,
        details: correction ? `Corrección: ${o.correction_note}` : o.details || undefined,
        complete: { type: "document_order", orderId: o.id, nextStatus: "Realizada" },
      });
    } else if (o.status === "Realizada") {
      out.push({
        ...base,
        key: `ped-${o.id}-entregar`,
        kind: "Petición",
        title: `Entregar ${orderWhat(o)} a ${receiverShort(o)}`,
        details: o.files_url ? `Archivos: ${o.files_url}` : undefined,
        complete: { type: "document_order", orderId: o.id, nextStatus: "Entregada" },
      });
    }
  }
  return out;
}

const POST_ITEMS: { field: string; label: string }[] = [
  { field: "envio_manual", label: "Enviar manual del participante" },
  { field: "envio_constancias", label: "Enviar constancias" },
  { field: "envio_insignias", label: "Enviar insignias" },
  { field: "envio_dc3", label: "Enviar DC-3" },
  { field: "encuesta_participantes", label: "Recabar encuesta de satisfacción de participantes" },
  { field: "informe_encuesta", label: "Entregar informe de la encuesta de satisfacción al cliente" },
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

/**
 * Quién hace el contenido del curso (PPT, manuales, informe de la encuesta):
 * quien más materiales tiene a su cargo en la ficha; si nadie, Oli.
 */
export function contentOwner(materials: Pick<Material, "maker">[]): string {
  const counts = new Map<string, number>();
  for (const m of materials) {
    if (m.maker) counts.set(m.maker, (counts.get(m.maker) ?? 0) + 1);
  }
  let best = "";
  let max = 0;
  for (const [name, n] of counts) {
    if (n > max) {
      best = name;
      max = n;
    }
  }
  return best || CONTENT_OWNER;
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

    // Pedidos de constancias, DC-3 y gafetes: las tareas de quien los hace
    tasks.push(...documentOrderTasks(t, clientName));

    // Team buildings: sin checklist/materiales/logística. Sus tareas son
    // las peticiones pendientes (gafetes, tarjetas, lo que pida el cliente)
    // y la encuesta de satisfacción al cliente después del evento.
    if (t.kind === "Team building") {
      for (const r of t.training_requests ?? []) {
        if (r.done) continue;
        tasks.push({
          key: `req-${r.id}`,
          kind: "Petición",
          title: r.title,
          trainingId: t.id,
          trainingName: t.short_name,
          clientName,
          assignee: r.assignee || t.internal_owner,
          requestedBy: r.requested_by,
          due: r.due_date,
          complete: { type: "training_request", requestId: r.id },
        });
      }

      // Encuesta de satisfacción del cliente contratante: se manda en las
      // 48h siguientes al evento (misma regla que en capacitaciones).
      const tbDates = activeDates(t.sessions);
      const tbLast = tbDates[tbDates.length - 1] ?? null;
      if (tbLast && today > tbLast && t.encuesta_final === "Pendiente") {
        tasks.push({
          key: `${t.id}-encuesta_final`,
          kind: "Seguimiento",
          title: "Enviar encuesta de satisfacción al cliente contratante",
          details: "Manda por WhatsApp el mensaje 'Encuesta al cliente' desde la ficha del team building.",
          trainingId: t.id,
          trainingName: t.short_name,
          clientName,
          assignee: t.internal_owner,
          due: addBusinessDays(tbLast, 2),
          complete: { type: "training_field", field: "encuesta_final", value: "Listo" },
        });
      }
      continue;
    }

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

    // Mensaje de confirmación: 2 días antes del curso (solo cursos por venir,
    // para no llenar de tareas viejas lo que ya se impartió)
    if (t.mensaje_confirmacion === "Pendiente" && firstDate && firstDate >= today) {
      tasks.push({
        ...base,
        key: `${t.id}-confirmacion`,
        kind: "Logística",
        title: "Enviar mensaje de confirmación por WhatsApp",
        due: atLeast(addDays(firstDate, -2), today),
        complete: trainingField("mensaje_confirmacion"),
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
        // En los cursos abiertos al público aquí se piden los inscritos a la fecha
        // (Arianna, 05-nov-2026: no en el mensaje de logística).
        label: "Confirmar lista de participantes (nombres completos; si es abierto, inscritos a la fecha)",
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

    // Quien lleva la logística envía el contenido; quien lo hace solo sube
    // la liga. Que vea desde Mis tareas qué le falta recibir.
    const notReady = t.materials.filter((m) => m.status !== "Listo");
    const contentDetails =
      t.materials.length === 0
        ? undefined
        : notReady.length > 0
          ? `Material que todavía no está listo: ${notReady.map((m) => `${m.type} «${m.name}» (${m.status})`).join(", ")}.`
          : "Todo el material ya está listo en la ficha.";

    for (const item of PRE_ITEMS) {
      if (!item.applies || val(item.field) !== "Pendiente") continue;
      tasks.push({
        ...base,
        key: `${t.id}-${item.field}`,
        kind: "Preparación",
        title: item.label,
        details: item.field === "contenido_facilitador" ? contentDetails : undefined,
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
        // El plazo del revisor corre desde que se subió el material,
        // no desde la fecha límite de quien lo hizo.
        const reviewDue = m.review_requested_at
          ? addBusinessDays(m.review_requested_at, 1)
          : due;
        tasks.push({
          ...base,
          key: `${m.id}-revisar`,
          kind: "Revisión",
          title: `Revisar ${m.type}: ${m.name}`,
          assignee: m.reviewer || t.internal_owner,
          due: reviewDue,
          complete: { type: "material_status", materialId: m.id, nextStatus: "Listo" },
        });
      }
    }

    // ---- Constancias y DC-3: pedirlas a América (desde el 09-nov-2026) ----
    // Cursos que terminan desde DOC_ORDERS_START: primero se piden, y el
    // "Enviar" solo aparece cuando América ya las entregó. Los que
    // terminaron antes siguen como siempre (solo "Enviar"), salvo que se
    // les haga un pedido desde la ficha.
    const orders = t.document_orders ?? [];
    const newFlow = !!lastDate && lastDate >= DOC_ORDERS_START;
    const sendState: Record<string, "legacy" | "esperando" | "lista"> = {};
    for (const [docType, field] of Object.entries(DOC_SEND_FIELD)) {
      if (val(field) !== "Pendiente") continue;
      const mine = orders.filter((o) => o.doc_type === docType);
      if (mine.length === 0 && !newFlow) {
        sendState[field] = "legacy";
        continue;
      }
      sendState[field] = mine.some((o) => o.status === "Entregada") ? "lista" : "esperando";
      // Recordatorio de pedirlas: aparece 3 días antes del último día
      // del curso y vence ese día (América tiene 1 día hábil para hacerlas).
      if (mine.length === 0 && lastDate && today >= addDays(lastDate, -3)) {
        tasks.push({
          ...base,
          key: `${t.id}-pedir_${field.replace("envio_", "")}`,
          kind: "Entrega",
          title: `Pedir ${docType === "DC-3" ? "DC-3" : "constancias"} a ${firstName(DOCUMENTS_MAKER)}`,
          details:
            "Desde la ficha puedes poner cuántas, para cuándo e instrucciones. Si la palomeas aquí, se piden con los datos de la ficha. Si no llevan, márcalas «No aplica» en el checklist.",
          due: atLeast(lastDate, today),
          complete: { type: "document_order_new", trainingId: t.id, docType },
        });
      }
    }

    // ---- Después del curso ----
    if (lastDate && today > lastDate) {
      const due48h = addBusinessDays(lastDate, 2);
      for (const item of POST_ITEMS) {
        if (val(item.field) === "Pendiente") {
          // Constancias y DC-3 del flujo nuevo: solo cuando ya se las entregaron
          const state = sendState[item.field];
          if (state === "esperando") continue;

          // Informe de la encuesta (Oli, 25-nov-2026): quien hace el contenido
          // arma el informe y sube la liga en cuanto se recabó la encuesta;
          // quien lleva la logística lo envía, y solo le aparece con la liga.
          // Si no hubo encuesta de participantes, queda como antes (lo cierra
          // o lo marca «No aplica» quien lleva el curso).
          if (item.field === "informe_encuesta" && !t.informe_encuesta_url && val("encuesta_participantes") !== "No aplica") {
            if (val("encuesta_participantes") === "Listo") {
              const sender = t.internal_owner ? firstName(t.internal_owner) : "quien lleva la logística";
              tasks.push({
                ...base,
                assignee: contentOwner(t.materials),
                key: `${t.id}-hacer_informe`,
                kind: "Material",
                title: "Hacer el informe de la encuesta y subir la liga",
                details: `La encuesta ya se recabó. Pega la liga del informe y ${sender} se lo envía al cliente.`,
                due: atLeast(due48h, tomorrow),
                complete: {
                  type: "training_link",
                  field: "informe_encuesta_url",
                  statusField: "informe_encuesta",
                  prompt: "Pega la liga del informe de la encuesta (Drive o página publicada):",
                },
              });
            }
            continue;
          }
          if (item.field === "informe_encuesta" && t.informe_encuesta_url) {
            tasks.push({
              ...base,
              key: `${t.id}-${item.field}`,
              kind: "Entrega",
              title: "Enviar informe de la encuesta de satisfacción al cliente",
              details: `El informe ya está listo: ${t.informe_encuesta_url}`,
              due: atLeast(due48h, tomorrow),
              complete: trainingField(item.field),
            });
            continue;
          }
          const delivered =
            state === "lista"
              ? orders.find((o) => DOC_SEND_FIELD[o.doc_type] === item.field && o.status === "Entregada")
              : undefined;
          tasks.push({
            ...base,
            key: `${t.id}-${item.field}`,
            kind: "Entrega",
            title: delivered ? `${item.label} al cliente` : item.label,
            details: delivered
              ? `${firstName(orderMaker(delivered))} ya te las entregó${delivered.files_url ? `: ${delivered.files_url}` : "."}`
              : undefined,
            due: due48h,
            complete: trainingField(item.field),
          });
        }
      }
    }

    // ---- Notificación a comercial del cierre (Ari, 26-nov-2026) ----
    // Antes eran dos tareas de Comercial (cierre y fin de postventa). Ahora
    // es una sola y la hace Logística (Pao): en cuanto el facilitador dio
    // las sesiones programadas avisa en Slack que el proyecto terminó, sin
    // esperar la encuesta, y marca la casilla. Llave nueva (aviso_comercial)
    // para que las de Comercial salgan de la bitácora sin contarse como hechas.
    if (lastDate && today >= lastDate && t.cierre_comercial === "Pendiente") {
      tasks.push({
        ...base,
        assignee: LOGISTICS_OWNER,
        key: `${t.id}-aviso_comercial`,
        kind: "Entrega",
        title: `Notificar a comercial el cierre en ${COMMERCIAL_CHANNEL_TRAININGS}`,
        details: `El facilitador ya dio las sesiones programadas: avisa en ${COMMERCIAL_CHANNEL_TRAININGS} que el proyecto terminó (no hace falta esperar la encuesta) y marca la casilla.`,
        due: addBusinessDays(lastDate, 1),
        complete: trainingField("cierre_comercial"),
      });
    }

    // Seguimientos día 20 y 30 (aparecen 3 días antes de vencer), con el
    // mensaje ya armado para mandarlo desde Mis tareas
    if (lastDate) {
      const seg: { field: FollowUpField; label: string; days: number }[] = [
        { field: "seguimiento_20", label: "Seguimiento día 20: validar aplicación de aprendizajes", days: 20 },
        { field: "seguimiento_30", label: "Seguimiento día 30: cierre y clausura del grupo de WhatsApp", days: 30 },
      ];
      const context = followUpContext(t);
      for (const s of seg) {
        const due = addDays(lastDate, s.days);
        if (val(s.field) === "Pendiente" && today >= addDays(due, -3)) {
          tasks.push({
            ...base,
            key: `${t.id}-${s.field}`,
            kind: "Seguimiento",
            title: s.label,
            due,
            followUp: { stage: followUpStage(context.statuses, context.lastDate, today, s.field), context },
            complete: trainingField(s.field),
          });
        }
      }
    }
  }

  return sortByDue(tasks);
}

export function sortByDue(tasks: ComputedTask[]): ComputedTask[] {
  return tasks.sort((a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due < b.due ? -1 : 1;
  });
}

/**
 * Convierte las tareas propias (custom_tasks) al mismo formato que las
 * tareas derivadas, para mostrarlas juntas en "Mis tareas", en los
 * recordatorios y en el reporte semanal.
 */
export function customToComputed(
  tasks: (CustomTask & { clients?: Pick<Client, "id" | "company"> | null })[],
  clientNameById: Record<string, string> = {}
): ComputedTask[] {
  return tasks
    .filter((t) => t.status !== "Completada")
    .map((t) => ({
      key: `custom-${t.id}`,
      kind: "Personal" as const,
      title: t.title,
      trainingId: "",
      trainingName: "",
      clientName:
        t.clients?.company ||
        (t.client_id ? clientNameById[t.client_id] : "") ||
        "Marca blanca / interno",
      assignee: t.assignee,
      requestedBy: t.requested_by,
      details: t.details,
      custom: t,
      due: t.due_date,
      complete: { type: "custom_task" as const, taskId: t.id },
    }));
}
