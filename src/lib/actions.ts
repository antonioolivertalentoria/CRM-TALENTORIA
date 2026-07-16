"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { addDays, todayISO } from "@/lib/format";

export type FormState = { error: string } | null;

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

// ---------------- Clientes ----------------

export async function createClientAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const company = str(formData, "company");
  if (!company) return { error: "El nombre de la compañía es obligatorio." };

  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      company,
      razon_social: str(formData, "razon_social"),
      rfc: str(formData, "rfc"),
      contact_name: str(formData, "contact_name"),
      email: str(formData, "email"),
      whatsapp: str(formData, "whatsapp"),
      notes: str(formData, "notes"),
    })
    .select("id")
    .single();

  if (error) return { error: `No se pudo crear el cliente: ${error.message}` };
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
  const { error } = await supabase
    .from("clients")
    .update({
      company,
      razon_social: str(formData, "razon_social"),
      rfc: str(formData, "rfc"),
      contact_name: str(formData, "contact_name"),
      email: str(formData, "email"),
      whatsapp: str(formData, "whatsapp"),
      notes: str(formData, "notes"),
    })
    .eq("id", id);

  if (error) return { error: `No se pudo actualizar: ${error.message}` };
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  return null;
}

export async function deleteClientAction(id: string) {
  const supabase = await createSupabase();
  await supabase.from("clients").delete().eq("id", id);
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

  const { data, error } = await supabase
    .from("trainings")
    .insert({
      client_id: clientId,
      short_name: shortName,
      official_name: str(formData, "official_name") || shortName,
      status: str(formData, "status") || "Propuesta",
      total_sessions: totalSessions,
      internal_owner: str(formData, "internal_owner"),
      client_contact: client?.contact_name ?? "",
      client_email: client?.email ?? "",
    })
    .select("id")
    .single();

  if (error) return { error: `No se pudo crear la capacitación: ${error.message}` };

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
    const sessions = Array.from({ length: count }, (_, i) => {
      const sessionDate = str(formData, `session_date_${i + 1}`) || null;
      return {
        training_id: data.id,
        session_number: i + 1,
        status: sessionDate ? "Programada" : "Pendiente",
        session_date: sessionDate,
        facilitator,
        // "Mixta" significa que cada sesión define la suya
        modality: modality === "Mixta" ? "" : modality,
        platform,
        session_link: sessionLink,
        start_time: startTime,
        end_time: endTime,
        duration_hours: duration,
      };
    });
    await supabase.from("sessions").insert(sessions);
  }

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
  const isInternal =
    !facilitator ||
    internalNames.some((n) => {
      const a = n.toLowerCase();
      const b = facilitator.toLowerCase().trim();
      return a.includes(b) || b.includes(a.split(" ")[0]);
    });
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
  revalidatePath(`/capacitaciones/${id}`);
  revalidatePath("/");
  revalidatePath("/tareas");
  return null;
}

export async function deleteTrainingAction(id: string, clientId: string) {
  const supabase = await createSupabase();
  await supabase.from("trainings").delete().eq("id", id);
  revalidatePath("/");
  redirect(`/clientes/${clientId}`);
}

// ---------------- Sesiones ----------------

export async function addSessionAction(trainingId: string) {
  const supabase = await createSupabase();
  const { data: last } = await supabase
    .from("sessions")
    .select("session_number")
    .eq("training_id", trainingId)
    .order("session_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("sessions").insert({
    training_id: trainingId,
    session_number: (last?.session_number ?? 0) + 1,
    status: "Pendiente",
  });
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

  revalidatePath(`/capacitaciones/${trainingId}`);
  revalidatePath("/");
  return null;
}

export async function deleteSessionAction(id: string, trainingId: string) {
  const supabase = await createSupabase();
  await supabase.from("sessions").delete().eq("id", id);
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
