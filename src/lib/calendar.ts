import { COMMERCIAL_OWNER } from "./constants";
import { TEAM_PLACE, TEAM_TZ, describeSchedule, differsFromTeam, toTeamTime, tzShort, zonedToUtc } from "./timezones";
import type { Session, Training } from "./types";

/**
 * Invitaciones de calendario por correo (archivo .ics estándar).
 *
 * Cuando se crea una capacitación o team building con sesiones fechadas,
 * cada sesión genera una invitación que Gmail/Google Calendar agrega al
 * calendario del invitado con todos los datos. Si la fecha u hora cambian
 * se manda la actualización (mismo UID, SEQUENCE mayor) y si la sesión se
 * cancela o borra, la cancelación. No requiere permisos de Google: viaja
 * por Resend, la misma tubería de los recordatorios.
 *
 * Invitados de cada sesión:
 *  - SIEMPRE el equipo base (ALWAYS_INVITED, editable aquí abajo),
 *  - quien creó la capacitación,
 *  - el responsable interno,
 *  - el/la facilitador(a) de la sesión,
 * resolviendo correos por perfiles del CRM, catálogo de facilitadores
 * (campo email, migración 012) y el mapa fijo EXTRA_EMAILS.
 *
 * Quien NO va nunca es el/la comercial de la ficha (15-sep-2026): pidió
 * dejar de recibir el .ics de cada reunión y sesión del proceso. Lo único
 * que le llega por correo es el aviso de proyecto terminado, que vive en
 * `notifyCommercialTrainingFinished` (src/lib/actions.ts).
 *
 * NINGUNA invitación sale sola (28-sep-2026). Capacitaciones ya preguntaba
 * desde el 02-sep; Consultoría seguía mandando una por cada sesión agregada
 * y por cada dato editado, y al dar de alta tres proyectos de golpe el
 * equipo recibió decenas de correos. Ahora todo sale solo cuando alguien lo
 * pide (✉️, "Sí, mandar aviso" o la casilla al crear), y nunca para fechas
 * que ya pasaron.
 *
 * La hora sale con la zona de la sede (29-sep-2026). Antes todo iba como
 * hora del centro y una sesión de las 9:00 en Matamoros (una hora
 * adelante en verano) llegó a los calendarios como 9:00 de aquí. Ahora el
 * evento viaja en UTC y Calendar lo pone a la hora correcta de cada quien;
 * el título y el correo dicen además la hora local de la sede.
 */

// Estos dos siempre reciben el evento en su calendario.
const ALWAYS_INVITED: { name: string; email: string }[] = [
  { name: "Antonio Oliver", email: "antoniooliver@talentoria.com" },
  { name: "Arianna Évora", email: "ariannaevora@talentoria.com" },
];

// Correos conocidos de gente que aún no es usuaria del CRM ni está en el
// catálogo con correo. Se usan cuando su nombre aparece como facilitador
// o responsable ("cuando sea necesario").
const EXTRA_EMAILS: Record<string, string> = {
  "carolina garcia": "carolinagarcia@talentoria.com",
  "adrian hernandez": "adrianhernandez@talentoria.com",
};

// Buzón de solo envío: talentoriacursos.com no tiene registro MX, así que
// NADIE puede escribirle. Por eso los invitados van con RSVP=FALSE más
// abajo: si Calendar mandara la respuesta aquí, rebotaría y el que
// contestó recibiría un "Delivery Status Notification".
const ORGANIZER_EMAIL = "crm@talentoriacursos.com";
/** Hoy en México (YYYY-MM-DD); el servidor de Vercel vive en UTC. */
function todayMx(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TEAM_TZ }).format(new Date());
}

/**
 * Nada de calendario para fechas que ya pasaron: al capturar un proyecto a
 * destiempo (sesiones de agosto dadas de alta en septiembre) cada una
 * mandaba su invitación sin que sirviera de nada.
 */
const PAST_REASON = "La fecha ya pasó: no hace falta mandarla al calendario.";
export function isPast(date: string): boolean {
  return date < todayMx();
}

/** Manda el correo por Resend; reintenta una vez si topa con el límite (~2 por segundo). */
async function postToResend(
  resendKey: string,
  payload: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const body = JSON.stringify(payload);
  const post = () =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body,
    });

  let res = await post();
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1200));
    res = await post();
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, reason: `Resend respondió ${res.status}: ${detail.slice(0, 300)}` };
  }
  return { ok: true };
}

/** Cliente mínimo de Supabase; sirve el de server actions o el de service key. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Coincidencia laxa de nombres: "Caro" ↔ "Carolina García", etc. */
function namesMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const firstA = na.split(" ")[0];
  const firstB = nb.split(" ")[0];
  return firstA.length > 2 && firstA === firstB;
}

type Person = { name: string; email: string };

/** Resuelve correos de una lista de nombres usando perfiles, catálogo y mapa fijo. */
function resolveEmails(
  names: string[],
  profiles: { full_name: string; email: string }[],
  facilitators: { name: string; email?: string }[]
): Person[] {
  const out: Person[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;

    const profile = profiles.find((p) => namesMatch(p.full_name, name));
    if (profile?.email) {
      out.push({ name: profile.full_name, email: profile.email });
      continue;
    }
    const fac = facilitators.find((f) => f.email && namesMatch(f.name, name));
    if (fac?.email) {
      out.push({ name: fac.name, email: fac.email });
      continue;
    }
    const extraKey = Object.keys(EXTRA_EMAILS).find((k) => namesMatch(k, name));
    if (extraKey) {
      out.push({ name, email: EXTRA_EMAILS[extraKey] });
    }
  }
  return out;
}

/**
 * Quita al comercial de la lista de invitados (15-sep-2026).
 *
 * Quien vendió el proyecto no necesita el .ics de cada reunión ni de cada
 * sesión: pidió que lo único que le llegue por correo sea el cierre. Se
 * filtra por correo resuelto (no por nombre escrito) para que dé igual si
 * entró como comercial de la ficha, como responsable o porque fue quien
 * apretó el botón. La única excepción es el equipo base: ALWAYS_INVITED
 * significa siempre.
 */
function withoutCommercial(
  attendees: Person[],
  comercialName: string,
  profiles: { full_name: string; email: string }[],
  facilitators: { name: string; email?: string }[]
): Person[] {
  const name = (comercialName ?? "").trim() || COMMERCIAL_OWNER;
  const muted = new Set(
    resolveEmails([name], profiles, facilitators).map((p) => p.email.toLowerCase())
  );
  if (muted.size === 0) return attendees;
  const base = new Set(ALWAYS_INVITED.map((p) => p.email.toLowerCase()));
  return attendees.filter((a) => {
    const email = a.email.toLowerCase();
    return base.has(email) || !muted.has(email);
  });
}

function dedupe(people: Person[]): Person[] {
  const seen = new Set<string>();
  const out: Person[] = [];
  for (const p of people) {
    const key = p.email.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** Texto seguro para un valor ICS (comas, punto y coma, saltos de línea). */
function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Pliega líneas ICS a máximo ~74 caracteres (RFC 5545). */
function foldLine(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  parts.push(rest);
  return parts.join("\r\n");
}

/** "2026-09-29" + "09:00" en Matamoros → "20260929T140000Z" (el instante real, en UTC). */
function icsUtc(date: string, time: string, tz: string | undefined): string {
  return zonedToUtc(date, time, tz).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** " · 09:00 hora de Matamoros" para el título, solo si la sede no está en la hora del equipo. */
function localTimeTag(date: string, time: string, tz: string | undefined): string {
  return differsFromTeam(tz, date) ? ` · ${time} hora de ${tzShort(tz)}` : "";
}

/** "09:00" o, si la sede está en otra zona, "09:00 hora de Matamoros (08:00 Chihuahua)". */
function subjectTime(date: string, time: string, tz: string | undefined): string {
  return differsFromTeam(tz, date)
    ? `${time} hora de ${tzShort(tz)} (${toTeamTime(date, time, tz)} ${TEAM_PLACE})`
    : time;
}

/** Renglón de fecha y horario del correo, con la equivalencia si la sede está en otra zona. */
function scheduleHtml(date: string, dateNice: string, start: string, end: string, tz: string | undefined): string {
  const text = describeSchedule(date, start, end, tz);
  return differsFromTeam(tz, date)
    ? `<p style="color:#334155;">📅 ${dateNice} · ${text}</p>
        <p style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:8px 10px;color:#92400e;font-size:13px;">
          ⚠️ La sede está en otra zona horaria. Tu Google Calendar ya la pone a tu hora; si viajas a la sede, se ajusta sola.
        </p>`
    : `<p style="color:#334155;">📅 ${dateNice} · ${text}</p>`;
}

function utcNowStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** "09:00" + 2h → "11:00" (tope 23:59 del mismo día). */
function plusTwoHours(time: string): string {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  const hh = Math.min(h + 2, 23);
  return `${String(hh).padStart(2, "0")}:${String(h + 2 > 23 ? 59 : m).padStart(2, "0")}`;
}

function buildIcs(opts: {
  method: "REQUEST" | "CANCEL";
  uid: string;
  summary: string;
  description: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  /** Zona de la sede; la hora capturada es la de allá. */
  timezone?: string;
  attendees: Person[];
  url?: string;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Talentoria//CRM//ES",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${opts.method}`,
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    // SEQUENCE creciente para que Calendar aplique siempre la versión más nueva
    `SEQUENCE:${Math.floor(Date.now() / 1000)}`,
    `DTSTAMP:${utcNowStamp()}`,
    // En UTC: no depende de que Calendar u Outlook conozcan la zona de la sede.
    `DTSTART:${icsUtc(opts.date, opts.startTime, opts.timezone)}`,
    `DTEND:${icsUtc(opts.date, opts.endTime, opts.timezone)}`,
    `SUMMARY:${icsEscape(opts.summary)}`,
    `DESCRIPTION:${icsEscape(opts.description)}`,
    `LOCATION:${icsEscape(opts.location)}`,
    `STATUS:${opts.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    `ORGANIZER;CN=CRM Talentoria:mailto:${ORGANIZER_EMAIL}`,
    // Outlook mandaría la contrapropuesta al organizador: mismo rebote.
    "X-MICROSOFT-DISALLOW-COUNTER:TRUE",
    ...(opts.url ? [`URL:${opts.url}`] : []),
    // PARTSTAT=ACCEPTED + RSVP=FALSE: el evento entra al calendario ya
    // aceptado y Calendar no pide confirmación, así que nunca manda la
    // respuesta al organizador (que no recibe correo).
    ...opts.attendees.map(
      (a) =>
        `ATTENDEE;CN=${icsEscape(a.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${a.email}`
    ),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n");
}

type SessionRow = Session & {
  trainings: Training & { clients: { company: string } | null };
};

/**
 * Qué pasó con el aviso. Antes esto era silencioso y por eso, cuando un
 * correo no llegaba, no había forma de saber por qué. Ahora la razón se
 * devuelve para poder enseñarla en pantalla.
 */
export type InviteResult =
  | { sent: true; to: string[]; mode: "request" | "cancel" }
  | { sent: false; reason: string };

/**
 * Manda (o cancela) la invitación de calendario de UNA sesión.
 * Nunca lanza: devuelve si se mandó y, si no, por qué, para que quien la
 * llame pueda enseñarlo en pantalla. Solo actúa si la sesión tiene fecha
 * y hora de inicio y hay RESEND_API_KEY configurada.
 */
export async function syncSessionEvent(
  supabase: SupabaseLike,
  sessionId: string,
  mode: "request" | "cancel"
): Promise<InviteResult> {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return { sent: false, reason: "No hay RESEND_API_KEY configurada: el CRM no puede mandar correos." };
    }

    const { data: sessionData } = await supabase
      .from("sessions")
      .select("*, trainings(*, clients(company))")
      .eq("id", sessionId)
      .maybeSingle();
    const s = sessionData as SessionRow | null;
    if (!s || !s.trainings) return { sent: false, reason: "No se encontró la sesión." };
    if (!s.session_date || !s.start_time) {
      return {
        sent: false,
        reason: "La sesión necesita fecha y hora de inicio para poder mandar la invitación.",
      };
    }
    if (isPast(s.session_date)) return { sent: false, reason: PAST_REASON };

    const t = s.trainings;
    const clientName = t.clients?.company ?? "";
    const isTB = t.kind === "Team building";

    const [{ data: profilesData }, { data: facilitatorsData }, userRes] = await Promise.all([
      supabase.from("profiles").select("full_name, email"),
      supabase.from("facilitators").select("name, email"),
      supabase.auth.getUser(),
    ]);
    const profiles = (profilesData ?? []) as { full_name: string; email: string }[];
    const facilitators = (facilitatorsData ?? []) as { name: string; email?: string }[];

    const creator: Person[] = userRes?.data?.user?.email
      ? [{ name: "", email: userRes.data.user.email }]
      : [];

    const attendees = withoutCommercial(
      dedupe([
        ...ALWAYS_INVITED,
        ...creator.map((c) => ({
          name: profiles.find((p) => p.email === c.email)?.full_name ?? c.email,
          email: c.email,
        })),
        ...resolveEmails([t.internal_owner, s.facilitator], profiles, facilitators),
      ]),
      t.comercial,
      profiles,
      facilitators
    );
    if (attendees.length === 0) {
      return { sent: false, reason: "No hay a quién avisarle: nadie con correo conocido." };
    }

    const startTime = s.start_time.slice(0, 5);
    const endTime = s.end_time ? s.end_time.slice(0, 5) : plusTwoHours(startTime);
    const totalSessions = t.total_sessions ?? 0;
    const sessionLabel =
      totalSessions > 1 || s.session_number > 1 ? ` — Sesión ${s.session_number}` : "";

    const tz = s.timezone;
    const summary = `${isTB ? "🎉 " : "📚 "}${t.short_name}${sessionLabel}${clientName ? ` (${clientName})` : ""}${localTimeTag(s.session_date, startTime, tz)}`;
    const descriptionLines = [
      `${isTB ? "Team building" : "Capacitación"}: ${t.short_name}`,
      clientName ? `Cliente: ${clientName}` : "",
      `Horario: ${describeSchedule(s.session_date, startTime, endTime, tz)}`,
      s.facilitator ? `Facilita: ${s.facilitator}` : "",
      t.internal_owner ? `Responsable interno: ${t.internal_owner}` : "",
      s.modality ? `Modalidad: ${s.modality}` : "",
      s.platform && s.modality !== "Presencial" ? `Plataforma: ${s.platform}` : "",
      s.session_link ? `Liga: ${s.session_link}` : "",
      "",
      `Ficha en el CRM: https://crm-talentoria.vercel.app/capacitaciones/${t.id}`,
    ].filter((l) => l !== "");
    const location =
      s.modality === "Presencial"
        ? "Presencial"
        : s.session_link || s.platform || "";

    const ics = buildIcs({
      method: mode === "cancel" ? "CANCEL" : "REQUEST",
      uid: `sesion-${s.id}@crm-talentoria.vercel.app`,
      summary,
      description: descriptionLines.join("\n"),
      location,
      date: s.session_date,
      startTime,
      endTime,
      timezone: tz,
      attendees,
      url: s.session_link || undefined,
    });

    const from = process.env.REMINDER_FROM ?? "CRM Talentoría <crm@talentoriacursos.com>";
    const dateNice = s.session_date.split("-").reverse().join("/");
    const subject =
      mode === "cancel"
        ? `❌ Cancelada: ${t.short_name}${sessionLabel} · ${dateNice}`
        : `📅 ${t.short_name}${sessionLabel} · ${dateNice} ${subjectTime(s.session_date, startTime, tz)}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
        <div style="height:6px;background:linear-gradient(to right,#00aeef,#e6007e);border-radius:3px;"></div>
        <h2 style="color:#16345f;">${mode === "cancel" ? "Sesión cancelada" : "Sesión en calendario"}</h2>
        <p style="color:#334155;"><strong>${summary}</strong></p>
        ${scheduleHtml(s.session_date, dateNice, startTime, endTime, tz)}
        ${location ? `<p style="color:#64748b;">📍 ${location}</p>` : ""}
        <p style="color:#94a3b8;font-size:12px;margin-top:16px;">
          ${
            mode === "cancel"
              ? "El evento adjunto quita la sesión de tu Google Calendar."
              : "Abre la invitación adjunta (o el aviso de Gmail) para que quede en tu Google Calendar con todos los datos. Si la fecha cambia, te mandaremos la actualización."
          }
        </p>
      </div>`;

    const res = await postToResend(resendKey, {
      from,
      to: attendees.map((a) => a.email),
      subject,
      html,
      attachments: [
        {
          filename: mode === "cancel" ? "cancelacion.ics" : "invitacion.ics",
          content: Buffer.from(ics).toString("base64"),
          content_type: `text/calendar; method=${mode === "cancel" ? "CANCEL" : "REQUEST"}; charset=UTF-8`,
        },
      ],
    });
    if (!res.ok) return { sent: false, reason: res.reason };

    return { sent: true, to: attendees.map((a) => a.email), mode };
  } catch (e) {
    // Las invitaciones son cortesía: nunca rompen la acción original,
    // pero sí se dice qué pasó.
    return {
      sent: false,
      reason: e instanceof Error ? e.message : "Error inesperado al mandar el aviso.",
    };
  }
}

/** Manda (o cancela) las invitaciones de TODAS las sesiones fechadas de un proyecto. */
export async function syncTrainingEvents(
  supabase: SupabaseLike,
  trainingId: string,
  mode: "request" | "cancel"
): Promise<void> {
  try {
    const { data } = await supabase
      .from("sessions")
      .select("id, session_date, start_time, status")
      .eq("training_id", trainingId);
    const sessions = (data ?? []) as Pick<Session, "id" | "session_date" | "start_time" | "status">[];
    for (const s of sessions) {
      if (!s.session_date || !s.start_time || s.status === "Cancelada" || isPast(s.session_date)) continue;
      await syncSessionEvent(supabase, s.id, mode);
    }
  } catch {
    // silencioso
  }
}

// ---------------- Reuniones de consultoría (arranque y entrega) ----------------

type ConsultingRow = {
  id: string;
  name: string;
  leader: string;
  team: string;
  comercial: string;
  internal_owner: string;
  whatsapp_group: string;
  kickoff_date: string | null;
  kickoff_start: string | null;
  kickoff_end: string | null;
  delivery_date: string | null;
  delivery_start: string | null;
  delivery_end: string | null;
  clients: { company: string; timezone?: string } | null;
};

/**
 * Invitación de calendario para la reunión de arranque (paso 9) o la de
 * entrega (paso 26) de un proyecto de consultoría. Mismo mecanismo que
 * las sesiones: .ics por Resend, actualizable y cancelable por UID.
 * Solo se llama cuando alguien la pide; dice si se mandó y, si no, por qué.
 */
export async function syncConsultingMeeting(
  supabase: SupabaseLike,
  projectId: string,
  which: "kickoff" | "delivery",
  mode: "request" | "cancel"
): Promise<InviteResult> {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return { sent: false, reason: "No hay RESEND_API_KEY configurada: el CRM no puede mandar correos." };
    }

    const { data } = await supabase
      .from("consulting_projects")
      .select("id, name, leader, team, comercial, internal_owner, whatsapp_group, kickoff_date, kickoff_start, kickoff_end, delivery_date, delivery_start, delivery_end, clients(*)")
      .eq("id", projectId)
      .maybeSingle();
    const p = data as ConsultingRow | null;
    if (!p) return { sent: false, reason: "No se encontró el proyecto." };

    const date = which === "kickoff" ? p.kickoff_date : p.delivery_date;
    const start = which === "kickoff" ? p.kickoff_start : p.delivery_start;
    const end = which === "kickoff" ? p.kickoff_end : p.delivery_end;
    if (!date || !start) {
      return { sent: false, reason: "La reunión necesita fecha y hora de inicio para poder mandar la invitación." };
    }
    if (isPast(date)) return { sent: false, reason: PAST_REASON };

    const clientName = p.clients?.company ?? "";

    const [{ data: profilesData }, { data: facilitatorsData }, userRes] = await Promise.all([
      supabase.from("profiles").select("full_name, email"),
      supabase.from("facilitators").select("name, email"),
      supabase.auth.getUser(),
    ]);
    const profiles = (profilesData ?? []) as { full_name: string; email: string }[];
    const facilitators = (facilitatorsData ?? []) as { name: string; email?: string }[];

    const creator: Person[] = userRes?.data?.user?.email
      ? [{
          name: profiles.find((x) => x.email === userRes.data.user.email)?.full_name ?? userRes.data.user.email,
          email: userRes.data.user.email,
        }]
      : [];

    const teamNames = p.team.split(",").map((t: string) => t.trim()).filter(Boolean);
    // El comercial ya no entra: ver withoutCommercial.
    const attendees = withoutCommercial(
      dedupe([
        ...ALWAYS_INVITED,
        ...creator,
        ...resolveEmails([p.leader, p.internal_owner, ...teamNames], profiles, facilitators),
      ]),
      p.comercial,
      profiles,
      facilitators
    );
    if (attendees.length === 0) {
      return { sent: false, reason: "No hay a quién avisarle: nadie con correo conocido." };
    }

    const startTime = start.slice(0, 5);
    const endTime = end ? end.slice(0, 5) : plusTwoHours(startTime);
    const label = which === "kickoff" ? "Reunión de arranque" : "Reunión de entrega";
    // Arranque y entrega no tienen zona propia: van en la hora de la sede del cliente.
    const tz = p.clients?.timezone;
    const summary = `🧭 ${label}: ${p.name}${clientName ? ` (${clientName})` : ""}${localTimeTag(date, startTime, tz)}`;

    const description = [
      `Consultoría: ${p.name}`,
      clientName ? `Cliente: ${clientName}` : "",
      `Horario: ${describeSchedule(date, startTime, endTime, tz)}`,
      p.leader ? `Líder: ${p.leader}` : "",
      teamNames.length ? `Equipo: ${teamNames.join(", ")}` : "",
      which === "kickoff"
        ? "Agenda: objetivo, alcance, entregables, roles, fechas y comunicación."
        : "Agenda: resultados, entregables y recomendaciones.",
      "",
      `Ficha en el CRM: https://crm-talentoria.vercel.app/consultoria/${p.id}`,
    ].filter((l) => l !== "");

    const ics = buildIcs({
      method: mode === "cancel" ? "CANCEL" : "REQUEST",
      uid: `cons-${which}-${p.id}@crm-talentoria.vercel.app`,
      summary,
      description: description.join("\n"),
      location: "",
      date,
      startTime,
      endTime,
      timezone: tz,
      attendees,
    });

    const from = process.env.REMINDER_FROM ?? "CRM Talentoría <crm@talentoriacursos.com>";
    const dateNice = date.split("-").reverse().join("/");
    const subject =
      mode === "cancel"
        ? `❌ Cancelada: ${label} · ${p.name}`
        : `📅 ${label}: ${p.name} · ${dateNice} ${subjectTime(date, startTime, tz)}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
        <div style="height:6px;background:linear-gradient(to right,#00aeef,#e6007e);border-radius:3px;"></div>
        <h2 style="color:#16345f;">${mode === "cancel" ? `${label} cancelada` : label}</h2>
        <p style="color:#334155;"><strong>${summary}</strong></p>
        ${scheduleHtml(date, dateNice, startTime, endTime, tz)}
        <p style="color:#94a3b8;font-size:12px;margin-top:16px;">
          ${mode === "cancel" ? "El evento adjunto quita la reunión de tu Google Calendar." : "Abre la invitación adjunta para que quede en tu Google Calendar. Si la fecha cambia, te mandaremos la actualización."}
        </p>
      </div>`;

    const res = await postToResend(resendKey, {
      from,
      to: attendees.map((a) => a.email),
      subject,
      html,
      attachments: [
        {
          filename: mode === "cancel" ? "cancelacion.ics" : "invitacion.ics",
          content: Buffer.from(ics).toString("base64"),
          content_type: `text/calendar; method=${mode === "cancel" ? "CANCEL" : "REQUEST"}; charset=UTF-8`,
        },
      ],
    });
    if (!res.ok) return { sent: false, reason: res.reason };
    return { sent: true, to: attendees.map((a) => a.email), mode };
  } catch (e) {
    // cortesía: nunca rompe la acción original, pero dice qué pasó
    return { sent: false, reason: e instanceof Error ? e.message : "Error inesperado al mandar el aviso." };
  }
}

// ---------------- Sesiones de consultoría (migración 017) ----------------

type ConsultingSessionRow = {
  id: string;
  title: string;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
  timezone?: string;
  modality: string;
  platform: string;
  session_link: string;
  facilitator: string;
  status: string;
  consulting_projects: Pick<
    ConsultingRow,
    "id" | "name" | "leader" | "team" | "comercial" | "internal_owner" | "clients"
  > | null;
};

/**
 * Manda (o cancela) la invitación de UNA sesión de consultoría, las que el
 * equipo agrega libremente además de arranque y entrega. Mismo mecanismo
 * que las reuniones fijas: .ics por Resend, actualizable por UID.
 * Es cortesía: nunca lanza ni rompe la acción original, y dice qué pasó.
 */
export async function syncConsultingSessionEvent(
  supabase: SupabaseLike,
  sessionId: string,
  mode: "request" | "cancel"
): Promise<InviteResult> {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return { sent: false, reason: "No hay RESEND_API_KEY configurada: el CRM no puede mandar correos." };
    }

    const { data } = await supabase
      .from("consulting_sessions")
      .select(
        "*, consulting_projects(id, name, leader, team, comercial, internal_owner, whatsapp_group, clients(company))"
      )
      .eq("id", sessionId)
      .maybeSingle();
    const s = data as ConsultingSessionRow | null;
    if (!s || !s.consulting_projects) return { sent: false, reason: "No se encontró la sesión." };
    if (!s.session_date || !s.start_time) {
      return { sent: false, reason: "La sesión necesita fecha y hora de inicio para poder mandar la invitación." };
    }
    if (isPast(s.session_date)) return { sent: false, reason: PAST_REASON };

    const p = s.consulting_projects;
    const clientName = p.clients?.company ?? "";

    const [{ data: profilesData }, { data: facilitatorsData }, userRes] = await Promise.all([
      supabase.from("profiles").select("full_name, email"),
      supabase.from("facilitators").select("name, email"),
      supabase.auth.getUser(),
    ]);
    const profiles = (profilesData ?? []) as { full_name: string; email: string }[];
    const facilitators = (facilitatorsData ?? []) as { name: string; email?: string }[];

    const creator: Person[] = userRes?.data?.user?.email
      ? [{
          name: profiles.find((x) => x.email === userRes.data.user.email)?.full_name ?? userRes.data.user.email,
          email: userRes.data.user.email,
        }]
      : [];

    const teamNames = p.team.split(",").map((t: string) => t.trim()).filter(Boolean);
    // El comercial ya no entra: ver withoutCommercial.
    const attendees = withoutCommercial(
      dedupe([
        ...ALWAYS_INVITED,
        ...creator,
        ...resolveEmails(
          [p.leader, p.internal_owner, s.facilitator, ...teamNames],
          profiles,
          facilitators
        ),
      ]),
      p.comercial,
      profiles,
      facilitators
    );
    if (attendees.length === 0) {
      return { sent: false, reason: "No hay a quién avisarle: nadie con correo conocido." };
    }

    const startTime = s.start_time.slice(0, 5);
    const endTime = s.end_time ? s.end_time.slice(0, 5) : plusTwoHours(startTime);
    const label = s.title.trim() || "Sesión de consultoría";
    const tz = s.timezone;
    const summary = `🧩 ${label}: ${p.name}${clientName ? ` (${clientName})` : ""}${localTimeTag(s.session_date, startTime, tz)}`;

    const description = [
      `Consultoría: ${p.name}`,
      clientName ? `Cliente: ${clientName}` : "",
      `Horario: ${describeSchedule(s.session_date, startTime, endTime, tz)}`,
      s.facilitator ? `Lleva la sesión: ${s.facilitator}` : "",
      p.leader ? `Líder: ${p.leader}` : "",
      s.modality ? `Modalidad: ${s.modality}` : "",
      s.platform && s.modality !== "Presencial" ? `Plataforma: ${s.platform}` : "",
      s.session_link ? `Liga: ${s.session_link}` : "",
      "",
      `Ficha en el CRM: https://crm-talentoria.vercel.app/consultoria/${p.id}`,
    ].filter((l) => l !== "");

    const location =
      s.modality === "Presencial" ? "Presencial" : s.session_link || s.platform || "";

    const ics = buildIcs({
      method: mode === "cancel" ? "CANCEL" : "REQUEST",
      uid: `cons-sesion-${s.id}@crm-talentoria.vercel.app`,
      summary,
      description: description.join("\n"),
      location,
      date: s.session_date,
      startTime,
      endTime,
      timezone: tz,
      attendees,
      url: s.session_link || undefined,
    });

    const from = process.env.REMINDER_FROM ?? "CRM Talentoría <crm@talentoriacursos.com>";
    const dateNice = s.session_date.split("-").reverse().join("/");
    const subject =
      mode === "cancel"
        ? `❌ Cancelada: ${label} · ${p.name}`
        : `📅 ${label}: ${p.name} · ${dateNice} ${subjectTime(s.session_date, startTime, tz)}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
        <div style="height:6px;background:linear-gradient(to right,#00aeef,#e6007e);border-radius:3px;"></div>
        <h2 style="color:#16345f;">${mode === "cancel" ? `${label} cancelada` : label}</h2>
        <p style="color:#334155;"><strong>${summary}</strong></p>
        ${scheduleHtml(s.session_date, dateNice, startTime, endTime, tz)}
        ${location ? `<p style="color:#64748b;">📍 ${location}</p>` : ""}
        <p style="color:#94a3b8;font-size:12px;margin-top:16px;">
          ${mode === "cancel" ? "El evento adjunto quita la sesión de tu Google Calendar." : "Abre la invitación adjunta para que quede en tu Google Calendar. Si la fecha cambia, te mandaremos la actualización."}
        </p>
      </div>`;

    const res = await postToResend(resendKey, {
      from,
      to: attendees.map((a) => a.email),
      subject,
      html,
      attachments: [
        {
          filename: mode === "cancel" ? "cancelacion.ics" : "invitacion.ics",
          content: Buffer.from(ics).toString("base64"),
          content_type: `text/calendar; method=${mode === "cancel" ? "CANCEL" : "REQUEST"}; charset=UTF-8`,
        },
      ],
    });
    if (!res.ok) return { sent: false, reason: res.reason };
    return { sent: true, to: attendees.map((a) => a.email), mode };
  } catch (e) {
    // cortesía: nunca rompe la acción original, pero dice qué pasó
    return { sent: false, reason: e instanceof Error ? e.message : "Error inesperado al mandar el aviso." };
  }
}
