import { CONFIRMATION_TEMPLATES } from "./confirmation-templates";
import { formatLongDate, todayISO } from "./format";
import type { Session } from "./types";

export type ConfirmationInput = {
  clientContact: string;
  officialName: string;
  shortName: string;
  sessions: Session[];
  venue: string;
  logisticsInfo: string;
};

export type ConfirmationMessage = {
  text: string;
  /** Datos que faltan, para avisar antes de enviar. Cada uno deja su marcador entre corchetes. */
  missing: string[];
};

const TITLES = /^(lic|ing|dr|dra|mtro|mtra|sr|sra|srita|arq)\.?$/i;

/** Solo el nombre de pila: "Daniela Pérez" → "Daniela" (sin títulos como "Lic."). */
function firstName(contact: string): string {
  const words = contact.trim().split(/\s+/).filter(Boolean);
  return words.find((w) => !TITLES.test(w)) ?? "";
}

/** "09:00:00" → "9:00". */
function clock(t: string | null): string {
  return t ? t.slice(0, 5).replace(/^0/, "") : "";
}

const unique = (values: (string | null | undefined)[]) => [
  ...new Set(values.map((v) => (v ?? "").toString().trim()).filter(Boolean)),
];

/** Quita guiones y viñetas iniciales y devuelve una viñeta "- " por línea. */
function bullets(info: string): string[] {
  return info
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-–—•·*▪◦●]+\s*)+/, "").trim())
    .filter(Boolean)
    .map((l) => `- ${l}`);
}

/**
 * Arma el mensaje de confirmación con datos que ya viven en el CRM.
 * Lo que falta queda como marcador [así] y se reporta en `missing`.
 */
export function buildConfirmation(
  variant: "Presencial" | "Online",
  d: ConfirmationInput
): ConfirmationMessage {
  const missing: string[] = [];
  const pick = (value: string, marker: string, label: string) => {
    if (value) return value;
    missing.push(label);
    return `[${marker}]`;
  };

  // Sesiones por venir: ni canceladas ni impartidas, con fecha de hoy en adelante.
  const today = todayISO();
  const upcoming = d.sessions
    .filter((s) => s.status !== "Cancelada" && s.status !== "Impartida")
    .filter((s) => !s.session_date || s.session_date >= today)
    .sort(
      (a, b) =>
        (a.session_date ?? "9999").localeCompare(b.session_date ?? "9999") ||
        a.session_number - b.session_number
    );

  const contacto = pick(firstName(d.clientContact), "nombre del contacto", "Contacto del cliente");
  const nombre = pick(
    d.officialName.trim() || d.shortName.trim(),
    "nombre de la capacitación",
    "Nombre de la capacitación"
  );

  // Fecha y horario: una línea por sesión.
  let missingDate = false;
  let missingTime = false;
  const lines = upcoming.map((s) => {
    if (!s.session_date) missingDate = true;
    const start = clock(s.start_time);
    const end = clock(s.end_time);
    if (!start || !end) missingTime = true;
    const date = s.session_date ? formatLongDate(s.session_date) : "[fecha]";
    return `${date}, de ${start || "[hora de inicio]"} a ${end || "[hora de cierre]"} h`;
  });
  if (lines.length === 0) {
    lines.push("[fecha y horario]");
    missing.push("Sesión próxima con fecha y horario");
  } else {
    if (missingDate) missing.push("Fecha de la sesión");
    if (missingTime) missing.push("Horario de la sesión (inicio y cierre)");
  }
  const fechas = lines.length === 1 ? lines[0] : `\n${lines.join("\n")}`;

  const logistica = bullets(d.logisticsInfo);
  if (logistica.length === 0) {
    logistica.push("- [logística confirmada]");
    missing.push("Información logística confirmada");
  }

  const venue = d.venue
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(", ");

  const values: Record<string, string> = {
    contacto,
    nombre,
    fechas,
    plataforma:
      variant === "Online"
        ? pick(
            unique(upcoming.filter((s) => s.modality !== "Presencial").map((s) => s.platform)).join(" y "),
            "plataforma",
            "Plataforma de la sesión"
          )
        : "",
    sede: variant === "Presencial" ? pick(venue, "sede / dirección", "Sede / dirección") : "",
    numero: pick(
      unique(upcoming.map((s) => s.enrolled?.toString())).join(" / "),
      "número de participantes",
      "Participantes (# Insc.)"
    ),
    facilita: pick(
      unique(upcoming.map((s) => s.facilitator)).join(" y "),
      "facilitador/a",
      "Facilitador/a de la sesión"
    ),
    logistica: logistica.join("\n"),
  };

  const text = CONFIRMATION_TEMPLATES[variant]
    .replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "")
    .replace(/[ \t]+$/gm, "");

  return { text, missing };
}
