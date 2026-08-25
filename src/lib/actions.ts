"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { addDays, todayISO } from "@/lib/format";
import { syncSessionEvent, syncTrainingEvents } from "@/lib/calendar";
import type { Subtask, TaskAttachment, TimeEntry, TrainingAttachment, TrainingRequest } from "@/lib/types";

export type FormState = { error: string } | null;

// Bucket privado de Supabase Storage donde viven los adjuntos.
// (En un archivo "use server" no se pueden exportar constantes: el cliente
// usa el mismo nombre desde @/lib/constants.)
const ATTACHMENTS_BUCKET = "adjuntos";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
function intOrNull(formData: FormData, key: string): number | null {
  const v = str(formData, key);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

/** Horas entre dos horarios "HH:MM" (null si faltan o son inválidos). */
function hoursBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return null;
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? Math.round((diff / 60) * 100) / 100 : null;
}

/**
 * Registro de actividad (migración 010): apunta quién hizo qué y cuándo,
 * para el panel "Actividad reciente". Es "best effort": si la tabla aún
 * no existe o el insert falla, la acción original sigue como si nada.
 */
async function logActivity(
  supabase: Awaited<ReturnType<typeof createSupabase>>,
  action: string,
  entityType: string,
  entityId: string,
  summary: string
) {
  try {
    const actor = await currentUserName(supabase);
    await supabase.from("activity_log").insert({
      actor,
      action,
      entity_type: entityType,
      entity_id: entityId,
      summary,
    });
  } catch {
    // Nunca debe tumbar la acción que lo llamó.
  }
}

// ---------------- Clientes ----------------

export async function createClientAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const company = str(formData, "company");
  if (!company) return { error: "El nombre de la compañía es obligatorio." };

  const supabase = await createSupabase();
  const payload: Record<string, string | null> = {
    company,
    parent_id: str(formData, "parent_id") || null,
    razon_social: str(formData, "razon_social"),
    rfc: str(formData, "rfc"),
    contact_name: str(formData, "contact_name"),
    email: str(formData, "email"),
    whatsapp: str(formData, "whatsapp"),
    notes: str(formData, "notes"),
  };
  let { data, error } = await supabase
    .from("clients")
    .insert(payload)
    .select("id")
    .single();

  // Respaldo mientras la migración 005 no esté corrida en la base
  if (error && !payload.parent_id && error.message.includes("parent_id")) {
    delete payload.parent_id;
    ({ data, error } = await supabase.from("clients").insert(payload).select("id").single());
  }

  if (error || !data) return { error: `No se pudo crear el cliente: ${error?.message}` };
  await logActivity(supabase, "creó", "cliente", data.id, `creó el cliente "${company}"`);
  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

export async function updateClientAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = str(formData, "id");
  const company = str(formData, "company");
  if (!id || !company) return { error: "Datos incompletos." };

  const supabase = await createSupabase();
  const payload: Record<string, string | null> = {
    company,
    parent_id: str(formData, "parent_id") || null,
    razon_social: str(formData, "razon_social"),
    rfc: str(formData, "rfc"),
    contact_name: str(formData, "contact_name"),
    email: str(formData, "email"),
    whatsapp: str(formData, "whatsapp"),
    notes: str(formData, "notes"),
  };
  let { error } = await supabase.from("clients").update(payload).eq("id", id);

  // Respaldo mientras la migración 005 no esté corrida en la base
  if (error && !payload.parent_id && error.message.includes("parent_id")) {
    delete payload.parent_id;
    ({ error } = await supabase.from("clients").update(payload).eq("id", id));
  }

  if (error) return { error: `No se pudo actualizar: ${error.message}` };
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  return null;
}

export async function deleteClientAction(id: string) {
  const supabase = await createSupabase();
  const { data: client } = await supabase.from("clients").select("company").eq("id", id).maybeSingle();
  await supabase.from("clients").delete().eq("id", id);
  await logActivity(supabase, "eliminó", "cliente", id, `eliminó el cliente "${client?.company ?? ""}"`);
  revalidatePath("/clientes");
  redirect("/clientes");
}

// ---------------- Capacitaciones ----------------

export async function createTrainingAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const clientId = str(formData, "client_id");
  const shortName = str(formData, "short_name");
  if (!clientId || !shortName)
    return { error: "El nombre corto de la capacitación es obligatorio." };

  const supabase = await createSupabase();

  // Datos del cliente para prellenar contacto del proyecto
  const { data: client } = await supabase
    .from("clients")
    .select("contact_name, email, whatsapp")
    .eq("id", clientId)
    .single();

  const totalSessions = intOrNull(formData, "total_sessions");
  // "Capacitación" (por defecto) o "Team building" (sin materiales/checklist)
  const kind = str(formData, "kind") === "Team building" ? "Team building" : "Capacitación";
  const isTeamBuilding = kind === "Team building";

  const trainingPayload: Record<string, string | number | null> = {
    client_id: clientId,
    short_name: shortName,
    official_name: str(formData, "official_name") || shortName,
    kind,
    status: str(formData, "status") || "Propuesta",
    total_sessions: totalSessions,
    internal_owner: str(formData, "internal_owner"),
    client_contact: client?.contact_name ?? "",
    client_email: client?.email ?? "",
  };

  let { data, error } = await supabase
    .from("trainings")
    .insert(trainingPayload)
    .select("id")
    .single();

  // Respaldo mientras la migración 011 no esté corrida en la base
  if (error && !isTeamBuilding && error.message.includes("kind")) {
    delete trainingPayload.kind;
    ({ data, error } = await supabase.from("trainings").insert(trainingPayload).select("id").single());
  }

  if (error || !data)
    return {
      error: `No se pudo crear ${isTeamBuilding ? "el team building" : "la capacitación"}: ${error?.message}${
        isTeamBuilding && error?.message.includes("kind")
          ? " (falta correr la migración 011 en la base)"
          : ""
      }`,
    };

  // Datos que se aplican a todas las sesiones generadas
  const facilitator = str(formData, "facilitator");
  const modality = str(formData, "modality");
  const platform = str(formData, "platform");
  const sessionLink = str(formData, "session_link");
  const startTime = str(formData, "start_time") || null;
  const endTime = str(formData, "end_time") || null;
  const duration = hoursBetween(startTime, endTime);
  const hasDefaults = !!(facilitator || modality || platform || sessionLink || startTime);

  // Pre-crea las sesiones numeradas (al menos 1 si se capturaron datos de sesión)
  const count =
    totalSessions && totalSessions > 0 && totalSessions <= 30
      ? totalSessions
      : hasDefaults
        ? 1
        : 0;
  if (count > 0) {
    // Cada sesión puede traer su propia fecha, horario y facilitador;
    // si no se capturan, hereda los datos generales del formulario.
    const sessions = Array.from({ length: count }, (_, i) => {
      const n = i + 1;
      const sessionDate = str(formData, `session_date_${n}`) || null;
      const sFacilitator = str(formData, `session_facilitator_${n}`) || facilitator;
      const sStart = str(formData, `session_start_${n}`) || startTime;
      const sEnd = str(formData, `session_end_${n}`) || endTime;
      return {
        training_id: data.id,
        session_number: n,
        status: sessionDate ? "Programada" : "Pendiente",
        session_date: sessionDate,
        facilitator: sFacilitator,
        // "Mixta" significa que cada sesión define la suya
        modality: modality === "Mixta" ? "" : modality,
        platform,
        session_link: sessionLink,
        start_time: sStart,
        end_time: sEnd,
        duration_hours: hoursBetween(sStart, sEnd) ?? duration,
      };
    });
    await supabase.from("sessions").insert(sessions);
  }

  // Team building: sin materiales estándar (PPT/manuales); sus pendientes
  // se capturan como peticiones en la página del evento.
  if (!isTeamBuilding) {
    // Materiales estándar del proceso, con fechas según las reglas:
    // PPT y manuales: 14 días antes si el facilitador es externo, 7 si es
    // interno; si ya no alcanza, mañana. Manual del participante presencial:
    // 7 días antes (hay que imprimirlo); online: el día de la última sesión
    // (se envía digital máx. 48h después).
    const { data: profs } = await supabase.from("profiles").select("full_name");
    const names = ((profs ?? []) as { full_name: string }[]).map((p) => p.full_name);
    const maker = names.find((n) => n.includes("Oliver")) ?? "";
    const reviewer = names.find((n) => n.includes("Arianna")) ?? "";

    const internalNames = [...names, "Carolina García", "Caro"];
    // Junta el facilitador general y los capturados por sesión: basta uno
    // externo para aplicar el plazo largo de contenido (14 días).
    const allFacilitators = [
      ...new Set(
        [facilitator, ...Array.from({ length: count }, (_, i) => str(formData, `session_facilitator_${i + 1}`))].filter(Boolean)
      ),
    ];
    const isInternal =
      allFacilitators.length === 0 ||
      allFacilitators.every((f) =>
        internalNames.some((n) => {
          const a = n.toLowerCase();
          const b = f.toLowerCase().trim();
          return a.includes(b) || b.includes(a.split(" ")[0]);
        })
      );
    const contentDays = isInternal ? 7 : 14;

    const today = todayISO();
    const tomorrow = addDays(today, 1);
    const sessionDates: string[] = [];
    for (let i = 1; i <= Math.max(count, 1); i++) {
      const d = str(formData, `session_date_${i}`);
      if (d) sessionDates.push(d);
    }
    sessionDates.sort();
    const firstSessionDate = sessionDates[0] ?? null;
    const lastSessionDate = sessionDates[sessionDates.length - 1] ?? null;

    const beforeDue = (days: number): string | null => {
      if (!firstSessionDate) return null;
      const d = addDays(firstSessionDate, -days);
      return d < tomorrow ? tomorrow : d;
    };

    const isPresencial = modality === "Presencial" || modality === "Mixta";
    const mpDue = isPresencial ? beforeDue(7) : (lastSessionDate ?? null);

    await supabase.from("materials").insert([
      {
        training_id: data.id,
        type: "PPT",
        name: `PPT ${shortName}`,
        maker,
        reviewer,
        due_date: beforeDue(contentDays),
      },
      {
        training_id: data.id,
        type: "Manual ejercicios",
        name: `Manual de ejercicios ${shortName}`,
        maker,
        reviewer: "",
        due_date: beforeDue(contentDays),
      },
      {
        training_id: data.id,
        type: "Manual participante",
        name: `Manual del participante ${shortName}`,
        maker,
        reviewer: "",
        due_date: mpDue,
      },
    ]);
  }

  await logActivity(
    supabase,
    "creó",
    isTeamBuilding ? "team building" : "capacitación",
    data.id,
    `creó ${isTeamBuilding ? "el team building" : "la capacitación"} "${shortName}"`
  );
  // Invitaciones de Google Calendar por correo para las sesiones ya fechadas
  await syncTrainingEvents(supabase, data.id, "request");
  if (isTeamBuilding) revalidatePath("/teambuildings");
  revalidatePath("/");
  revalidatePath("/tareas");
  redirect(`/capacitaciones/${data.id}`);
}

const TRAINING_FIELDS = new Set([
  "mensaje_logistica",
  "logistics_info",
  "short_name",
  "official_name",
  "status",
  "total_sessions",
  "internal_owner",
  "client_contact",
  "client_email",
  "whatsapp_group",
  "temario_url",
  "drive_folder_url",
  "participants_url",
  "materials_deadline",
  "priority",
  "envio_manual",
  "envio_constancias",
  "envio_insignias",
  "envio_dc3",
  "envio_leads",
  "encuesta_participantes",
  "informe_encuesta",
  "encuesta_final",
  "contenido_facilitador",
  "lista_participantes",
  "impresion_manuales",
  "encuestas_qr",
  "liga_sesion_valida",
  "factura",
  "seguimiento_20",
  "seguimiento_30",
  "notes",
  "internal_notes",
  "questions",
]);

export async function updateTrainingField(
  id: string,
  field: string,
  value: string
): Promise<FormState> {
  if (!TRAINING_FIELDS.has(field)) return { error: "Campo no permitido." };

  let parsed: string | number | null = value;
  if (field === "total_sessions") {
    parsed = value ? parseInt(value, 10) : null;
    if (parsed !== null && Number.isNaN(parsed)) parsed = null;
  }
  if (field === "materials_deadline" && !value) parsed = null;

  const supabase = await createSupabase();
  const { error } = await supabase
    .from("trainings")
    .update({ [field]: parsed })
    .eq("id", id);

  if (error) return { error: error.message };

  // Al registro de actividad solo van los cambios con peso: estado general
  // y checklist (completar un punto del checklist ES completar una tarea).
  if (field === "status" || value === "Listo" || value === "No aplica") {
    const { data: tr } = await supabase
      .from("trainings")
      .select("short_name")
      .eq("id", id)
      .maybeSingle();
    const name = tr?.short_name ?? "";
    const summary =
      field === "status"
        ? `cambió el estado de "${name}" a ${value}`
        : `marcó "${field.replaceAll("_", " ")}" como ${value} en "${name}"`;
    await logActivity(supabase, field === "status" ? "cambió" : "completó", "capacitación", id, summary);
  }

  revalidatePath(`/capacitaciones/${id}`);
  revalidatePath("/");
  revalidatePath("/tareas");
  return null;
}

export async function deleteTrainingAction(id: string, clientId: string) {
  const supabase = await createSupabase();
  const { data: tr } = await supabase.from("trainings").select("short_name").eq("id", id).maybeSingle();

  // Quita de los calendarios los eventos de sus sesiones fechadas
  await syncTrainingEvents(supabase, id, "cancel");

  // Los archivos del bucket no se borran solos con la fila (team buildings)
  try {
    const { data: files } = await supabase
      .from("training_attachments")
      .select("storage_path")
      .eq("training_id", id);
    const paths = (files ?? []).map((f: { storage_path: string }) => f.storage_path);
    if (paths.length > 0) {
      await supabase.storage.from(ATTACHMENTS_BUCKET).remove(paths);
    }
  } catch {
    // tabla aún sin migrar: no hay archivos que borrar
  }

  await supabase.from("trainings").delete().eq("id", id);
  await logActivity(supabase, "eliminó", "capacitación", id, `eliminó la capacitación "${tr?.short_name ?? ""}"`);
  revalidatePath("/");
  redirect(`/clientes/${clientId}`);
}

// ---------------- Sesiones ----------------

export async function addSessionAction(trainingId: string) {
  const supabase = await createSupabase();
  const { data: last } = await supabase
    .from("sessions")
    .select("session_number, facilitator, start_time, end_time, duration_hours, modality, platform, session_link")
    .eq("training_id", trainingId)
    .order("session_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  // La sesión nueva hereda horario, facilitador, modalidad, plataforma y
  // liga de la última sesión (la fecha no: esa siempre se captura).
  const nextNumber = (last?.session_number ?? 0) + 1;
  await supabase.from("sessions").insert({
    training_id: trainingId,
    session_number: nextNumber,
    status: "Pendiente",
    facilitator: last?.facilitator ?? "",
    start_time: last?.start_time ?? null,
    end_time: last?.end_time ?? null,
    duration_hours: last?.duration_hours ?? null,
    modality: last?.modality ?? "",
    platform: last?.platform ?? "",
    session_link: last?.session_link ?? "",
  });
  await logActivity(supabase, "creó", "sesión", trainingId, `agregó la sesión ${nextNumber}`);
  revalidatePath(`/capacitaciones/${trainingId}`);
}

const SESSION_FIELDS = new Set([
  "session_number",
  "module",
  "status",
  "session_date",
  "start_time",
  "end_time",
  "duration_hours",
  "facilitator",
  "modality",
  "platform",
  "session_link",
  "enrolled",
  "attended",
  "survey_status",
  "survey_url",
  "survey_results_status",
  "survey_results_url",
  "notes",
]);

export async function updateSessionField(
  id: string,
  trainingId: string,
  field: string,
  value: string
): Promise<FormState> {
  if (!SESSION_FIELDS.has(field)) return { error: "Campo no permitido." };

  let parsed: string | number | null = value;
  const numeric = new Set(["session_number", "enrolled", "attended", "duration_hours"]);
  const nullableWhenEmpty = new Set([
    "session_date",
    "start_time",
    "end_time",
    ...numeric,
  ]);
  if (numeric.has(field) && value) {
    parsed = Number(value);
    if (Number.isNaN(parsed)) parsed = null;
  }
  if (nullableWhenEmpty.has(field) && !value) parsed = null;

  const supabase = await createSupabase();
  const { error } = await supabase
    .from("sessions")
    .update({ [field]: parsed })
    .eq("id", id);

  if (error) return { error: error.message };

  // Al cambiar horarios, recalcula la duración de la sesión
  if (field === "start_time" || field === "end_time") {
    const { data: row } = await supabase
      .from("sessions")
      .select("start_time, end_time")
      .eq("id", id)
      .single();
    if (row) {
      await supabase
        .from("sessions")
        .update({
          duration_hours: hoursBetween(
            row.start_time?.slice(0, 5) ?? null,
            row.end_time?.slice(0, 5) ?? null
          ),
        })
        .eq("id", id);
    }
  }

  if (field === "status") {
    const { data: s } = await supabase.from("sessions").select("session_number").eq("id", id).maybeSingle();
    await logActivity(supabase, "cambió", "sesión", trainingId, `puso la sesión ${s?.session_number ?? ""} en ${value}`);
  }

  // Calendario: mover fecha/horario/facilitador manda la actualización del
  // evento; cancelar la sesión manda la cancelación. (Solo si hay fecha+hora.)
  if (field === "status" && value === "Cancelada") {
    await syncSessionEvent(supabase, id, "cancel");
  } else if (["session_date", "start_time", "end_time", "facilitator"].includes(field)) {
    await syncSessionEvent(supabase, id, "request");
  }

  revalidatePath(`/capacitaciones/${trainingId}`);
  revalidatePath("/");
  return null;
}

export async function deleteSessionAction(id: string, trainingId: string) {
  const supabase = await createSupabase();
  const { data: s } = await supabase.from("sessions").select("session_number").eq("id", id).maybeSingle();
  await syncSessionEvent(supabase, id, "cancel"); // quita el evento de los calendarios
  await supabase.from("sessions").delete().eq("id", id);
  await logActivity(supabase, "eliminó", "sesión", trainingId, `eliminó la sesión ${s?.session_number ?? ""}`);
  revalidatePath(`/capacitaciones/${trainingId}`);
}

// ---------------- Materiales ----------------

export async function createMaterialAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const trainingId = str(formData, "training_id");
  const name = str(formData, "name");
  if (!trainingId || !name) return { error: "El nombre del material es obligatorio." };

  const supabase = await createSupabase();
  const dueDate = str(formData, "due_date");
  const { error } = await supabase.from("materials").insert({
    training_id: trainingId,
    type: str(formData, "type") || "Otro",
    name,
    url: str(formData, "url"),
    status: str(formData, "status") || "Pendiente",
    maker: str(formData, "maker"),
    reviewer: str(formData, "reviewer"),
    due_date: dueDate || null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/capacitaciones/${trainingId}`);
  revalidatePath("/tareas");
  return null;
}

export async function updateMaterialField(
  id: string,
  trainingId: string,
  field: string,
  value: string
): Promise<FormState> {
  if (!new Set(["type", "name", "url", "status", "maker", "reviewer", "due_date"]).has(field))
    return { error: "Campo no permitido." };

  const parsed: string | null = field === "due_date" && !value ? null : value;

  const update: Record<string, string | null> = { [field]: parsed };
  // El plazo del revisor corre desde que el material queda "Por revisar"
  if (field === "status") {
    update.review_requested_at = value === "Por revisar" ? todayISO() : null;
  }

  const supabase = await createSupabase();
  const { error } = await supabase
    .from("materials")
    .update(update)
    .eq("id", id);

  if (error) return { error: error.message };

  if (field === "status") {
    const { data: m } = await supabase.from("materials").select("name").eq("id", id).maybeSingle();
    await logActivity(
      supabase,
      value === "Listo" ? "completó" : "cambió",
      "material",
      id,
      `marcó el material "${m?.name ?? ""}" como ${value}`
    );
  }

  revalidatePath(`/capacitaciones/${trainingId}`);
  revalidatePath("/tareas");
  return null;
}

// ---------------- Recordatorios (preferencias por usuario) ----------------

export async function updateReminderPrefs(prefs: {
  enabled: boolean;
  kinds: string[];
}): Promise<FormState> {
  const supabase = await createSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sin sesión." };

  const { error } = await supabase
    .from("profiles")
    .update({ reminder_prefs: prefs })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/tareas");
  return null;
}

export async function addMaterialCommentAction(
  materialId: string,
  trainingId: string,
  body: string
): Promise<FormState> {
  const text = body.trim();
  if (!text) return { error: "Escribe un comentario." };

  const supabase = await createSupabase();

  // Autor = perfil del usuario con sesión iniciada
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let author = user?.email ?? "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (profile?.full_name) author = profile.full_name;
  }

  const { error } = await supabase.from("material_comments").insert({
    material_id: materialId,
    author,
    body: text,
  });

  if (error) return { error: error.message };
  revalidatePath(`/capacitaciones/${trainingId}`);
  return null;
}

export async function deleteMaterialAction(id: string, trainingId: string) {
  const supabase = await createSupabase();
  await supabase.from("materials").delete().eq("id", id);
  revalidatePath(`/capacitaciones/${trainingId}`);
}

// ---------------- Tareas propias (custom_tasks) ----------------

/** Nombre del perfil con sesión iniciada (o su correo como respaldo). */
async function currentUserName(
  supabase: Awaited<ReturnType<typeof createSupabase>>
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "";
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  return profile?.full_name || user.email || "";
}

/** Devuelve el id de la tarea creada, para poder adjuntarle archivos enseguida. */
export async function createCustomTaskAction(
  formData: FormData
): Promise<{ error: string } | { taskId: string }> {
  const title = str(formData, "title");
  if (!title) return { error: "Escribe qué hay que hacer." };

  const supabase = await createSupabase();
  const requestedBy = await currentUserName(supabase);

  const payload: Record<string, string | boolean | null> = {
    title,
    details: str(formData, "details"),
    assignee: str(formData, "assignee"),
    requested_by: requestedBy,
    client_id: str(formData, "client_id") || null,
    due_date: str(formData, "due_date") || null,
    notify_on_complete: formData.get("notify_on_complete") === "on",
  };

  let { data, error } = await supabase.from("custom_tasks").insert(payload).select("id").single();

  // Respaldo mientras la migración 009 no esté corrida en la base
  if (error && error.message.includes("notify_on_complete")) {
    delete payload.notify_on_complete;
    ({ data, error } = await supabase.from("custom_tasks").insert(payload).select("id").single());
  }

  if (error || !data) return { error: `No se pudo crear la tarea: ${error?.message}` };
  await logActivity(
    supabase,
    "creó",
    "tarea",
    data.id,
    `creó la tarea "${title}"${payload.assignee ? ` para ${payload.assignee}` : ""}`
  );
  revalidatePath("/tareas");
  return { taskId: data.id };
}

export async function updateCustomTaskAction(
  id: string,
  fields: {
    title: string;
    details: string;
    assignee: string;
    client_id: string | null;
    due_date: string | null;
    notify_on_complete?: boolean;
  }
): Promise<FormState> {
  const title = fields.title.trim();
  if (!title) return { error: "El título no puede quedar vacío." };

  const supabase = await createSupabase();
  const payload: Record<string, string | boolean | null> = {
    title,
    details: fields.details.trim(),
    assignee: fields.assignee,
    client_id: fields.client_id || null,
    due_date: fields.due_date || null,
  };
  if (fields.notify_on_complete !== undefined) {
    payload.notify_on_complete = fields.notify_on_complete;
  }

  let { error } = await supabase.from("custom_tasks").update(payload).eq("id", id);

  // Respaldo mientras la migración 009 no esté corrida en la base
  if (error && error.message.includes("notify_on_complete")) {
    delete payload.notify_on_complete;
    ({ error } = await supabase.from("custom_tasks").update(payload).eq("id", id));
  }

  if (error) return { error: error.message };
  await logActivity(supabase, "editó", "tarea", id, `editó la tarea "${title}"`);
  revalidatePath("/tareas");
  return null;
}

export async function reopenCustomTaskAction(id: string): Promise<FormState> {
  const supabase = await createSupabase();
  const { data: task } = await supabase.from("custom_tasks").select("title").eq("id", id).maybeSingle();
  const { error } = await supabase
    .from("custom_tasks")
    .update({ status: "Pendiente", completed_at: null })
    .eq("id", id);
  if (error) return { error: error.message };
  await logActivity(supabase, "reabrió", "tarea", id, `reabrió la tarea "${task?.title ?? ""}"`);
  revalidatePath("/tareas");
  return null;
}

/**
 * Aviso de tarea completada: correo a quien la pidió, solo si la tarea
 * tiene activado notify_on_complete. Nunca truena la acción: si falta la
 * llave de Resend o el correo del solicitante, simplemente no se envía.
 */
async function notifyTaskCompleted(
  supabase: Awaited<ReturnType<typeof createSupabase>>,
  task: { title: string; requested_by: string; assignee: string; due_date: string | null }
) {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey || !task.requested_by) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .ilike("full_name", `%${task.requested_by}%`)
      .maybeSingle();
    if (!profile?.email) return;

    const completedBy = await currentUserName(supabase);
    const from = process.env.REMINDER_FROM ?? "CRM Talentoría <crm@talentoriacursos.com>";
    const html = `
      <div style="font-family:Arial,sans-serif;color:#16345f">
        <div style="height:6px;background:linear-gradient(90deg,#00aeef,#e6007e);border-radius:3px"></div>
        <h2 style="margin:16px 0 4px">✅ Tarea completada</h2>
        <p style="font-size:15px;margin:8px 0"><strong>${task.title}</strong></p>
        <p style="color:#64748b;font-size:13px;margin:4px 0">
          La completó: ${completedBy || task.assignee || "alguien del equipo"}
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-top:16px">
          Recibes este aviso porque al crear la tarea se marcó "avisar al completarla".
          — CRM Talentoría
        </p>
      </div>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [profile.email],
        subject: `✅ Tarea completada: ${task.title}`,
        html,
      }),
    });
  } catch {
    // El aviso es cortesía: si falla, la tarea queda completada igual.
  }
}

export async function completeCustomTaskAction(id: string): Promise<FormState> {
  const supabase = await createSupabase();

  // Se lee antes de actualizar para saber título y si hay que avisar.
  // select("*") tolera que notify_on_complete aún no exista en la base.
  const { data: task } = await supabase.from("custom_tasks").select("*").eq("id", id).maybeSingle();

  const { error } = await supabase
    .from("custom_tasks")
    .update({ status: "Completada", completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  if (task) {
    await logActivity(supabase, "completó", "tarea", id, `completó la tarea "${task.title}"`);
    if (task.notify_on_complete) {
      await notifyTaskCompleted(supabase, task);
    }
  }

  revalidatePath("/tareas");
  return null;
}

export async function deleteCustomTaskAction(id: string) {
  const supabase = await createSupabase();

  const { data: task } = await supabase.from("custom_tasks").select("title").eq("id", id).maybeSingle();

  // Los archivos del bucket no se borran solos con la fila: primero el Storage
  const { data: files } = await supabase
    .from("task_attachments")
    .select("storage_path")
    .eq("task_id", id);
  const paths = (files ?? []).map((f: { storage_path: string }) => f.storage_path);
  if (paths.length > 0) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove(paths);
  }

  await supabase.from("custom_tasks").delete().eq("id", id);
  await logActivity(supabase, "eliminó", "tarea", id, `eliminó la tarea "${task?.title ?? ""}"`);
  revalidatePath("/tareas");
}

// ---------------- Adjuntos de tareas ----------------

/**
 * Registra en la base un archivo que el navegador ya subió al bucket.
 * (Los archivos NO pasan por el servidor: las Server Actions tienen un
 * límite de 1 MB, así que la subida va directa del navegador a Storage.)
 */
export async function registerAttachmentAction(fields: {
  taskId: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  /** "insumo" (por defecto) o "entregable". */
  category?: string;
}): Promise<{ error: string } | { attachment: TaskAttachment }> {
  const supabase = await createSupabase();
  const uploadedBy = await currentUserName(supabase);

  const payload: Record<string, string | number> = {
    task_id: fields.taskId,
    storage_path: fields.storagePath,
    file_name: fields.fileName,
    file_size: fields.fileSize,
    mime_type: fields.mimeType,
    uploaded_by: uploadedBy,
    category: fields.category === "entregable" ? "entregable" : "insumo",
  };

  let { data, error } = await supabase.from("task_attachments").insert(payload).select("*").single();

  // Respaldo mientras la migración 009 no esté corrida en la base
  if (error && error.message.includes("category")) {
    delete payload.category;
    ({ data, error } = await supabase.from("task_attachments").insert(payload).select("*").single());
  }

  if (error || !data) return { error: error?.message ?? "No se pudo registrar el archivo." };
  await logActivity(
    supabase,
    "subió",
    "tarea",
    fields.taskId,
    `subió el archivo "${fields.fileName}" (${fields.category === "entregable" ? "entregable" : "insumo"})`
  );
  revalidatePath("/tareas");
  return { attachment: data as TaskAttachment };
}

/** Mueve un adjunto entre "insumo" y "entregable". */
export async function setAttachmentCategoryAction(
  id: string,
  category: string
): Promise<FormState> {
  const value = category === "entregable" ? "entregable" : "insumo";
  const supabase = await createSupabase();
  const { error } = await supabase.from("task_attachments").update({ category: value }).eq("id", id);
  if (error) {
    if (error.message.includes("category")) {
      return { error: "Falta correr la migración 009 en la base para clasificar archivos." };
    }
    return { error: error.message };
  }
  revalidatePath("/tareas");
  return null;
}

export async function deleteAttachmentAction(id: string): Promise<FormState> {
  const supabase = await createSupabase();

  const { data: file } = await supabase
    .from("task_attachments")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (file?.storage_path) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([file.storage_path]);
  }

  const { error } = await supabase.from("task_attachments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  return null;
}

/**
 * URL temporal (1 hora) para abrir o descargar un adjunto privado.
 * Se genera al momento de dar clic, no se guarda en ningún lado.
 */
export async function getAttachmentUrlAction(
  id: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createSupabase();

  const { data: file } = await supabase
    .from("task_attachments")
    .select("storage_path, file_name")
    .eq("id", id)
    .single();

  if (!file) return { error: "No se encontró el archivo." };

  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(file.storage_path, 3600, { download: file.file_name });

  if (error || !data) return { error: error?.message ?? "No se pudo abrir el archivo." };
  return { url: data.signedUrl };
}

// ---------------- Facilitadores (catálogo, migración 007) ----------------

export async function addFacilitatorAction(
  name: string,
  isInternal: boolean,
  email = ""
): Promise<FormState> {
  const clean = name.trim();
  if (!clean) return { error: "Escribe el nombre del facilitador." };

  const supabase = await createSupabase();

  // Evita duplicados por mayúsculas/acentos de dedo
  const { data: existing } = await supabase
    .from("facilitators")
    .select("id, name")
    .ilike("name", clean)
    .maybeSingle();
  if (existing) return { error: `"${existing.name}" ya está en el catálogo.` };

  const facPayload: Record<string, string | boolean> = { name: clean, is_internal: isInternal };
  if (email.trim()) facPayload.email = email.trim();

  let { data, error } = await supabase
    .from("facilitators")
    .insert(facPayload)
    .select("id")
    .single();

  // Respaldo mientras la migración 012 no esté corrida en la base
  if (error && facPayload.email && error.message.includes("email")) {
    delete facPayload.email;
    ({ data, error } = await supabase.from("facilitators").insert(facPayload).select("id").single());
  }

  if (error || !data) {
    if (error?.message.includes("facilitators")) {
      return { error: "Falta correr la migración 007 en la base (tabla de facilitadores)." };
    }
    return { error: error?.message ?? "No se pudo agregar." };
  }

  await logActivity(supabase, "creó", "facilitador", data.id, `agregó al facilitador "${clean}"`);
  revalidatePath("/facilitadores");
  return null;
}

export async function updateFacilitatorAction(
  id: string,
  fields: { name?: string; is_internal?: boolean; active?: boolean; email?: string }
): Promise<FormState> {
  const supabase = await createSupabase();
  const payload: Record<string, string | boolean> = {};
  if (fields.name !== undefined) {
    const clean = fields.name.trim();
    if (!clean) return { error: "El nombre no puede quedar vacío." };
    payload.name = clean;
  }
  if (fields.is_internal !== undefined) payload.is_internal = fields.is_internal;
  if (fields.active !== undefined) payload.active = fields.active;
  if (fields.email !== undefined) payload.email = fields.email.trim();

  const { error } = await supabase.from("facilitators").update(payload).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/facilitadores");
  return null;
}

export async function deleteFacilitatorAction(id: string): Promise<FormState> {
  const supabase = await createSupabase();
  const { data: f } = await supabase.from("facilitators").select("name").eq("id", id).maybeSingle();
  const { error } = await supabase.from("facilitators").delete().eq("id", id);
  if (error) return { error: error.message };
  await logActivity(supabase, "eliminó", "facilitador", id, `quitó del catálogo a "${f?.name ?? ""}"`);
  revalidatePath("/facilitadores");
  return null;
}

// ---------------- Tiempo invertido (migración 008) ----------------

/**
 * Registra tiempo invertido en una tarea. Recibe horas (acepta decimales:
 * 1.5 = hora y media) y las guarda como minutos enteros.
 */
export async function addTimeEntryAction(fields: {
  taskKey: string;
  taskTitle: string;
  hours: number;
}): Promise<{ error: string } | { entry: TimeEntry }> {
  const minutes = Math.round(fields.hours * 60);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return { error: "Pon un tiempo mayor a cero (ej. 1.5 = hora y media)." };
  }
  if (minutes > 24 * 60) return { error: "Máximo 24 horas por registro." };

  const supabase = await createSupabase();
  const person = await currentUserName(supabase);

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      task_key: fields.taskKey,
      task_title: fields.taskTitle,
      person,
      minutes,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.message.includes("time_entries")) {
      return { error: "Falta correr la migración 008 en la base (registro de tiempo)." };
    }
    return { error: error?.message ?? "No se pudo registrar el tiempo." };
  }

  revalidatePath("/tareas");
  return { entry: data as TimeEntry };
}

export async function deleteTimeEntryAction(id: string): Promise<FormState> {
  const supabase = await createSupabase();
  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  return null;
}

// ---------------- Subtareas (migración 009) ----------------

export async function addSubtaskAction(fields: {
  taskId: string;
  title: string;
  dueDate: string | null;
}): Promise<{ error: string } | { subtask: Subtask }> {
  const title = fields.title.trim();
  if (!title) return { error: "Escribe la subtarea." };

  const supabase = await createSupabase();

  const { count } = await supabase
    .from("subtasks")
    .select("id", { count: "exact", head: true })
    .eq("task_id", fields.taskId);

  const { data, error } = await supabase
    .from("subtasks")
    .insert({
      task_id: fields.taskId,
      title,
      due_date: fields.dueDate || null,
      position: count ?? 0,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.message.includes("subtasks")) {
      return { error: "Falta correr la migración 009 en la base (subtareas)." };
    }
    return { error: error?.message ?? "No se pudo agregar la subtarea." };
  }

  revalidatePath("/tareas");
  return { subtask: data as Subtask };
}

export async function toggleSubtaskAction(id: string, done: boolean): Promise<FormState> {
  const supabase = await createSupabase();
  const { error } = await supabase.from("subtasks").update({ done }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  return null;
}

export async function deleteSubtaskAction(id: string): Promise<FormState> {
  const supabase = await createSupabase();
  const { error } = await supabase.from("subtasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  return null;
}

// ---------------- Peticiones de team building (migración 011) ----------------

export async function addTrainingRequestAction(fields: {
  trainingId: string;
  title: string;
  assignee: string;
  dueDate: string | null;
}): Promise<{ error: string } | { request: TrainingRequest }> {
  const title = fields.title.trim();
  if (!title) return { error: "Escribe la petición." };

  const supabase = await createSupabase();
  const requestedBy = await currentUserName(supabase);

  const { count } = await supabase
    .from("training_requests")
    .select("id", { count: "exact", head: true })
    .eq("training_id", fields.trainingId);

  const { data, error } = await supabase
    .from("training_requests")
    .insert({
      training_id: fields.trainingId,
      title,
      assignee: fields.assignee.trim(),
      requested_by: requestedBy,
      due_date: fields.dueDate || null,
      position: count ?? 0,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.message.includes("training_requests")) {
      return { error: "Falta correr la migración 011 en la base (team buildings)." };
    }
    return { error: error?.message ?? "No se pudo agregar la petición." };
  }

  await logActivity(
    supabase,
    "creó",
    "petición",
    data.id,
    `pidió "${title}"${fields.assignee ? ` a ${fields.assignee.trim()}` : ""}`
  );
  revalidatePath(`/capacitaciones/${fields.trainingId}`);
  revalidatePath("/tareas");
  revalidatePath("/teambuildings");
  return { request: data as TrainingRequest };
}

export async function toggleTrainingRequestAction(
  id: string,
  done: boolean
): Promise<FormState> {
  const supabase = await createSupabase();
  const { data: req } = await supabase
    .from("training_requests")
    .select("title, training_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("training_requests").update({ done }).eq("id", id);
  if (error) return { error: error.message };

  if (done && req) {
    await logActivity(supabase, "completó", "petición", id, `completó la petición "${req.title}"`);
  }
  if (req) revalidatePath(`/capacitaciones/${req.training_id}`);
  revalidatePath("/tareas");
  revalidatePath("/teambuildings");
  return null;
}

export async function deleteTrainingRequestAction(id: string): Promise<FormState> {
  const supabase = await createSupabase();
  const { data: req } = await supabase
    .from("training_requests")
    .select("title, training_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("training_requests").delete().eq("id", id);
  if (error) return { error: error.message };
  await logActivity(supabase, "eliminó", "petición", id, `eliminó la petición "${req?.title ?? ""}"`);
  if (req) revalidatePath(`/capacitaciones/${req.training_id}`);
  revalidatePath("/tareas");
  revalidatePath("/teambuildings");
  return null;
}

// ---------------- Archivos de team building (migración 011) ----------------

/** Igual que los adjuntos de tareas: el navegador sube directo a Storage
 *  (tope de 1 MB en Server Actions) y aquí solo se registran los metadatos. */
export async function registerTrainingAttachmentAction(fields: {
  trainingId: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}): Promise<{ error: string } | { attachment: TrainingAttachment }> {
  const supabase = await createSupabase();
  const uploadedBy = await currentUserName(supabase);

  const { data, error } = await supabase
    .from("training_attachments")
    .insert({
      training_id: fields.trainingId,
      storage_path: fields.storagePath,
      file_name: fields.fileName,
      file_size: fields.fileSize,
      mime_type: fields.mimeType,
      uploaded_by: uploadedBy,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.message.includes("training_attachments")) {
      return { error: "Falta correr la migración 011 en la base (team buildings)." };
    }
    return { error: error?.message ?? "No se pudo registrar el archivo." };
  }

  await logActivity(
    supabase,
    "subió",
    "team building",
    fields.trainingId,
    `subió el archivo "${fields.fileName}"`
  );
  revalidatePath(`/capacitaciones/${fields.trainingId}`);
  return { attachment: data as TrainingAttachment };
}

export async function deleteTrainingAttachmentAction(id: string): Promise<FormState> {
  const supabase = await createSupabase();

  const { data: file } = await supabase
    .from("training_attachments")
    .select("storage_path, training_id")
    .eq("id", id)
    .single();

  if (file?.storage_path) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([file.storage_path]);
  }

  const { error } = await supabase.from("training_attachments").delete().eq("id", id);
  if (error) return { error: error.message };
  if (file) revalidatePath(`/capacitaciones/${file.training_id}`);
  return null;
}

/** URL temporal (1 hora) para abrir o descargar un archivo del team building. */
export async function getTrainingAttachmentUrlAction(
  id: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createSupabase();

  const { data: file } = await supabase
    .from("training_attachments")
    .select("storage_path, file_name")
    .eq("id", id)
    .single();

  if (!file) return { error: "No se encontró el archivo." };

  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(file.storage_path, 3600, { download: file.file_name });

  if (error || !data) return { error: error?.message ?? "No se pudo abrir el archivo." };
  return { url: data.signedUrl };
}
