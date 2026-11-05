import { addDays } from "./format";

/**
 * Mensajes de seguimiento a 20 y 30 días (5-nov-2026). Oli: "no siempre se
 * pueden enviar así, tal cual, con los nombres y eso".
 *
 * El CRM no escribe solo en los grupos de WhatsApp (eso pediría la API de
 * WhatsApp Business con plantillas fijas aprobadas por Meta). Lo que hace es
 * armar el mensaje completo con los datos de la ficha (contacto, curso,
 * facilitador, fecha y lo que se llevaron) para que quien lo manda solo lo
 * revise, lo copie y lo pegue. Si el día 20 y el 30 ya se juntaron sin mandar
 * ninguno, va un solo mensaje que cubre los dos.
 */

export type FollowUpField = "seguimiento_20" | "seguimiento_30";
export type FollowUpStage = "d20" | "d30" | "juntos";
export type FollowUpVariant = "Grupo" | "Una persona" | "Curso abierto";

export const FOLLOW_UP_STAGES: { value: FollowUpStage; label: string; fields: FollowUpField[] }[] = [
  { value: "d20", label: "Día 20", fields: ["seguimiento_20"] },
  { value: "d30", label: "Día 30 (cierre)", fields: ["seguimiento_30"] },
  { value: "juntos", label: "Los dos juntos", fields: ["seguimiento_20", "seguimiento_30"] },
];

export const FOLLOW_UP_VARIANTS: { value: FollowUpVariant; hint: string }[] = [
  { value: "Grupo", hint: "Capacitación para un equipo de la empresa" },
  { value: "Una persona", hint: "La tomó una sola persona: no hay grupo que cerrar" },
  { value: "Curso abierto", hint: "Abierto al público con un intermediario (Coparmex, INDEX…)" },
];

export type FollowUpContext = {
  /** Nombre de pila del contacto; vacío si no hay ninguno capturado. */
  contact: string;
  course: string;
  /** Nombre de pila de quien facilitó; vacío si fueron varios o lo dio quien manda el mensaje. */
  facilitator: string;
  lastDate: string | null;
  sessions: number;
  /** "Lo que se llevaron" (migración 027): completa «¿ya pusieron en práctica …?». */
  takeaways: string;
  whatsapp: string;
  suggestedVariant: FollowUpVariant;
  statuses: Record<FollowUpField, string>;
};

type FollowUpSource = {
  short_name: string;
  official_name?: string;
  client_contact?: string;
  internal_owner?: string;
  aprendizajes?: string;
  seguimiento_20: string;
  seguimiento_30: string;
  clients?: { company?: string; contact_name?: string; whatsapp?: string } | null;
  sessions: {
    session_date: string | null;
    status: string;
    facilitator: string;
    enrolled: number | null;
    attended: number | null;
  }[];
};

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-10-07" → "7 de octubre". */
function longDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/**
 * Nombre de pila para saludar: "Ana Gabriela Andrade Esparza (Gaby)" → "Gaby",
 * "Lic. Valeria Portillo" → "Valeria", "Edna Silva / Ana López" → "Edna".
 */
export function firstName(raw: string): string {
  const clean = (raw ?? "").trim();
  if (!clean) return "";
  const nick = clean.match(/\(([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\)/);
  if (nick) return nick[1];
  const main = clean.replace(/\([^)]*\)/g, " ").split(/[/,;]| y /)[0];
  const words = main
    .split(/\s+/)
    .filter((w) => w && !/^(lic|ing|mtr[oa]|dr[a]?|c\.?p|sr[a]?|srita)\.?$/i.test(w));
  return words[0] ?? "";
}

/**
 * Nombre del curso sin los paréntesis internos ("(1 persona)", "(Safran Cabin)")
 * ni el nombre del cliente al final ("Manejo de estrés Suminsa" → "Manejo de estrés").
 */
export function courseLabel(shortName: string, officialName = "", company = ""): string {
  let name = (shortName || officialName).replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const co = company.trim();
  if (co && name.toLowerCase().endsWith(` ${co.toLowerCase()}`)) name = name.slice(0, -co.length - 1).trim();
  const words = name.split(" ").filter((w) => /[a-záéíóúñ]/i.test(w));
  if (words.length > 1 && name === name.toUpperCase()) {
    name = name.charAt(0) + name.slice(1).toLowerCase();
  }
  return name;
}

/** "la capacitación de Liderazgo Efectivo" o, si el nombre ya dice qué es, "el taller intensivo de…". */
function courseRef(course: string): { text: string; masc: boolean } {
  const m = course.match(/^(taller|curso|diplomado|programa|seminario|certificación|masterclass|clínica)\b/i);
  if (!m) return { text: `la capacitación de ${course}`, masc: false };
  const masc = !/^(certificación|masterclass|clínica)$/i.test(m[1]);
  return { text: `${masc ? "el" : "la"} ${course.charAt(0).toLowerCase()}${course.slice(1)}`, masc };
}

/** "de" + referencia, con la contracción "del". */
function de(ref: string): string {
  return ref.startsWith("el ") ? `del ${ref.slice(3)}` : `de ${ref}`;
}

export function followUpContext(t: FollowUpSource): FollowUpContext {
  const active = (t.sessions ?? []).filter((s) => s.status !== "Cancelada");
  const dates = active.map((s) => s.session_date).filter((d): d is string => Boolean(d)).sort();
  const owner = (t.internal_owner ?? "").trim().toLowerCase();
  const facilitators = [...new Set(active.map((s) => (s.facilitator ?? "").trim()).filter(Boolean))];
  const onlyOne = facilitators.length === 1 ? facilitators[0] : "";
  const facilitator = onlyOne && onlyOne.toLowerCase() !== owner ? firstName(onlyOne) : "";

  const names = `${t.short_name ?? ""} ${t.official_name ?? ""}`;
  const people = Math.max(0, ...active.map((s) => s.attended ?? s.enrolled ?? 0));
  const suggestedVariant: FollowUpVariant =
    /\b(1|una) persona\b/i.test(names) || people === 1 ? "Una persona" : "Grupo";

  return {
    // El contacto del cliente es el que se mantiene al día; el de la ficha queda de respaldo.
    contact: firstName(t.clients?.contact_name || t.client_contact || ""),
    course: courseLabel(t.short_name, t.official_name, t.clients?.company),
    facilitator,
    lastDate: dates[dates.length - 1] ?? null,
    sessions: dates.length,
    takeaways: (t.aprendizajes ?? "").trim(),
    whatsapp: t.clients?.whatsapp ?? "",
    suggestedVariant,
    statuses: { seguimiento_20: t.seguimiento_20, seguimiento_30: t.seguimiento_30 },
  };
}

/**
 * Qué mensaje toca. Si los dos siguen pendientes y el del día 30 ya está
 * encima (misma ventana en que aparece su tarea), va uno solo con los dos.
 */
export function followUpStage(
  statuses: Record<FollowUpField, string>,
  lastDate: string | null,
  today: string,
  field: FollowUpField
): FollowUpStage {
  const bothPending = statuses.seguimiento_20 === "Pendiente" && statuses.seguimiento_30 === "Pendiente";
  if (bothPending && lastDate && today >= addDays(lastDate, 27)) return "juntos";
  return field === "seguimiento_20" ? "d20" : "d30";
}

export function stageFields(stage: FollowUpStage): FollowUpField[] {
  return FOLLOW_UP_STAGES.find((s) => s.value === stage)?.fields ?? [];
}

/** Lo que conviene completar antes de mandar. */
export function followUpMissing(ctx: FollowUpContext): string[] {
  const missing: string[] = [];
  if (!ctx.contact) missing.push("El nombre del contacto: no está en la ficha del cliente ni en la capacitación.");
  if (!ctx.lastDate) missing.push("La fecha de la última sesión.");
  return missing;
}

export function buildFollowUp(
  stage: FollowUpStage,
  variant: FollowUpVariant,
  ctx: FollowUpContext,
  today: string
): string {
  const greet = `Hola, ${ctx.contact || "[nombre]"}.`;
  const ref = courseRef(ctx.course || "este curso");
  const date = ctx.lastDate ? longDate(ctx.lastDate) : "";
  const since =
    ctx.sessions > 1
      ? `desde que cerramos ${ref.text}${ctx.facilitator ? ` con ${ctx.facilitator}` : ""}${date ? ` el ${date}` : ""}`
      : `desde ${ref.text}${ctx.facilitator ? ` que les dio ${ctx.facilitator}` : ""}${
          date ? (ctx.facilitator ? ` el ${date}` : ` del ${date}`) : ""
        }`;
  const days = ctx.lastDate ? daysBetween(ctx.lastDate, today) : 0;
  const elapsed =
    stage === "d20"
      ? days > 40 ? "Ya pasó un tiempo" : "Ya pasaron unas semanas"
      : days > 45 ? "Ya pasó un tiempo" : "Ya pasó un mes";

  const tk = ctx.takeaways;
  const pron = ref.masc ? "lo" : "la";
  const v = {
    Grupo: {
      how: "cómo les ha ido",
      ask: tk ? `¿ya pusieron en práctica ${tk}?` : "¿qué han podido aplicar de lo que vieron?",
      extra: " ¿Han notado algún cambio en el equipo, aunque sea pequeño?",
      help: "Y si algo no ha terminado de aterrizar o alguna herramienta se les está complicando, cuéntanos y con gusto les echamos la mano.",
      thanks: "Fue un gusto trabajar con tu equipo y esperamos que lo que vieron les siga sumando en el día a día.",
      next: "Si más adelante quieren reforzar lo aprendido o dar el siguiente paso, con gusto les armamos una propuesta a la medida: desde una sesión de refuerzo hasta los temas que suelen complementar muy bien lo que ya vieron.",
      shortNext: "Y cuando quieran reforzar lo aprendido o dar el siguiente paso, con gusto les armamos una propuesta a la medida.",
      bye: "Antes de cerrar el grupo, ¿hay algo pendiente en lo que podamos apoyarles?",
      goodbye: "Fue un gusto trabajar con tu equipo.",
    },
    "Una persona": {
      how: `cómo le ha ido a quien ${pron} tomó`,
      ask: tk ? `¿ya puso en práctica ${tk}?` : "¿qué ha podido aplicar de lo que vio?",
      extra: " ¿Han notado algún cambio en su día a día?",
      help: "Y si algo no ha terminado de aterrizar, cuéntanos y con gusto le echamos la mano.",
      thanks: "Fue un gusto acompañarlos y esperamos que lo que vio le siga sumando en su día a día.",
      next: "Si más adelante quieren reforzar lo aprendido, sumar a más personas del equipo o dar el siguiente paso, con gusto les armamos una propuesta a la medida.",
      shortNext: "Y cuando quieran sumar a más personas del equipo o dar el siguiente paso, con gusto les armamos una propuesta a la medida.",
      bye: "Antes de cerrar, ¿hay algo pendiente en lo que podamos apoyarles?",
      goodbye: "Fue un gusto acompañarlos.",
    },
    "Curso abierto": {
      how: "qué tal les ha ido a los participantes",
      ask: tk
        ? `¿les han comentado si ya pusieron en práctica ${tk}?`
        : "¿les han compartido qué han podido aplicar de lo que vieron?",
      extra: "",
      help: "Si alguien se quedó con dudas o quiere profundizar, con gusto lo apoyamos.",
      thanks: "Gracias por abrirnos el espacio con su comunidad; fue un gusto.",
      next: "Si más adelante quieren repetirla o sumar otro tema para sus participantes, con gusto les proponemos opciones que complementan muy bien lo que ya vieron.",
      shortNext: "Y cuando quieran repetirla o sumar otro tema, con gusto les proponemos opciones.",
      bye: "Antes de cerrar el grupo, ¿hay algo pendiente en lo que podamos apoyarles?",
      goodbye: "Gracias por abrirnos el espacio con su comunidad.",
    },
  }[variant];

  if (stage === "d20") {
    return [
      `${greet} ¡Esperamos que estés muy bien! 😊`,
      `${elapsed} ${since} y nos quedamos con ganas de saber ${v.how}: ${v.ask}${v.extra}`,
      v.help,
      "No hace falta nada formal, con que nos cuentes por aquí es más que suficiente. 🙌",
    ].join("\n\n");
  }

  if (stage === "d30") {
    return [
      `${greet} ¡Gracias por todo el apoyo durante estas semanas! 😊`,
      `Con este mensaje cerramos formalmente el acompañamiento ${de(ref.text)}. ${v.thanks}`,
      v.next,
      v.bye,
      "Quedamos a tus órdenes y te deseamos mucho éxito. 🙌",
    ].join("\n\n");
  }

  return [
    `${greet} ¡Esperamos que estés muy bien! 😊`,
    `${elapsed} ${since} y, antes de cerrar el acompañamiento, nos encantaría saber ${v.how}: ${v.ask}${v.extra}`,
    `${v.help} ${v.shortNext}`,
    `${v.goodbye} ${v.bye} 🙌`,
  ].join("\n\n");
}
