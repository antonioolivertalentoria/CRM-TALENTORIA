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

const ORGANIZER_EMAIL = "crm@talentoriacursos.com";
const TZID = "America/Mexico_City"; // UTC-6 fijo (sin horario de verano)

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

/** "2026-09-20" + "09:00" → "20260920T090000" (hora local de México). */
function icsLocal(date: string, time: string): string {
  return `${date.replaceAll("-", "")}T${time.slice(0, 5).replace(":", "")}00`;
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
  attendees: Person[];
  url?: string;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Talentoria//CRM//ES",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${opts.method}`,
    "BEGIN:VTIMEZONE",
    `TZID:${TZID}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0600",
    "TZOFFSETTO:-0600",
    "TZNAME:CST",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    // SEQUENCE creciente para que Calendar aplique siempre la versión más nueva
    `SEQUENCE:${Math.floor(Date.now() / 1000)}`,
    `DTSTAMP:${utcNowStamp()}`,
    `DTSTART;TZID=${TZID}:${icsLocal(opts.date, opts.startTime)}`,
    `DTEND;TZID=${TZID}:${icsLocal(opts.date, opts.endTime)}`,
    `SUMMARY:${icsEscape(opts.summary)}`,
    `DESCRIPTION:${icsEscape(opts.description)}`,
    `LOCATION:${icsEscape(opts.location)}`,
    `STATUS:${opts.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    `ORGANIZER;CN=CRM Talentoria:mailto:${ORGANIZER_EMAIL}`,
    ...(opts.url ? [`URL:${opts.url}`] : []),
    ...opts.attendees.map(
      (a) =>
        `ATTENDEE;CN=${icsEscape(a.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`
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
 * Manda (o cancela) la invitación de calendario de UNA sesión.
 * Silencioso por diseño: cualquier falla se ignora para no romper la
 * acción que lo llamó. Solo actúa si la sesión tiene fecha y hora de
 * inicio y hay RESEND_API_KEY configurada.
 */
export async function syncSessionEvent(
  supabase: SupabaseLike,
  sessionId: string,
  mode: "request" | "cancel"
): Promise<void> {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return;

    const { data: sessionData } = await supabase
      .from("sessions")
      .select("*, trainings(*, clients(company))")
      .eq("id", sessionId)
      .maybeSingle();
    const s = sessionData as SessionRow | null;
    if (!s || !s.session_date || !s.start_time || !s.trainings) return;

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

    const attendees = dedupe([
      ...ALWAYS_INVITED,
      ...creator.map((c) => ({
        name: profiles.find((p) => p.email === c.email)?.full_name ?? c.email,
        email: c.email,
      })),
      ...resolveEmails([t.internal_owner, s.facilitator], profiles, facilitators),
    ]);
    if (attendees.length === 0) return;

    const startTime = s.start_time.slice(0, 5);
    const endTime = s.end_time ? s.end_time.slice(0, 5) : plusTwoHours(startTime);
    const totalSessions = t.total_sessions ?? 0;
    const sessionLabel =
      totalSessions > 1 || s.session_number > 1 ? ` — Sesión ${s.session_number}` : "";

    const summary = `${isTB ? "🎉 " : "📚 "}${t.short_name}${sessionLabel}${clientName ? ` (${clientName})` : ""}`;
    const descriptionLines = [
      `${isTB ? "Team building" : "Capacitación"}: ${t.short_name}`,
      clientName ? `Cliente: ${clientName}` : "",
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
      attendees,
      url: s.session_link || undefined,
    });

    const from = process.env.REMINDER_FROM ?? "CRM Talentoría <crm@talentoriacursos.com>";
    const dateNice = s.session_date.split("-").reverse().join("/");
    const subject =
      mode === "cancel"
        ? `❌ Cancelada: ${t.short_name}${sessionLabel} · ${dateNice}`
        : `📅 ${t.short_name}${sessionLabel} · ${dateNice} ${startTime}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
        <div style="height:6px;background:linear-gradient(to right,#00aeef,#e6007e);border-radius:3px;"></div>
        <h2 style="color:#16345f;">${mode === "cancel" ? "Sesión cancelada" : "Sesión en calendario"}</h2>
        <p style="color:#334155;"><strong>${summary}</strong></p>
        <p style="color:#334155;">📅 ${dateNice} · ${startTime}–${endTime} (hora de México)</p>
        ${location ? `<p style="color:#64748b;">📍 ${location}</p>` : ""}
        <p style="color:#94a3b8;font-size:12px;margin-top:16px;">
          ${
            mode === "cancel"
              ? "El evento adjunto quita la sesión de tu Google Calendar."
              : "Abre la invitación adjunta (o el aviso de Gmail) para que quede en tu Google Calendar con todos los datos. Si la fecha cambia, te llegará la actualización sola."
          }
        </p>
      </div>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });
  } catch {
    // Las invitaciones son cortesía: nunca rompen la acción original.
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
      if (!s.session_date || !s.start_time || s.status === "Cancelada") continue;
      await syncSessionEvent(supabase, s.id, mode);
    }
  } catch {
    // silencioso
  }
}
