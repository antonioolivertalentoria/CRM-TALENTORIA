import { addDays } from "./format";
import type { MarketingPage, MarketingProject, MarketingStep } from "./types";

/**
 * Flujos del módulo de Marketing: los mapas "Proceso de Mailing" (14 pasos,
 * proyecto recurrente mensual) y "Proceso de SEO y páginas" (19 pasos),
 * escritos una sola vez aquí con su responsable y su SLA.
 *
 * Los pasos NO se siembran en la base: existen desde que existe el proyecto
 * (y el mes, o la página). En marketing_steps solo se guarda lo que la gente
 * captura de cada uno —estado, fecha comprometida, evidencia, bloqueo—,
 * identificado por su step_key ("2026-11:s4", "b:b7", "p:<id>:p9").
 *
 * Lo que el documento dice de "Óscar" aquí es el rol `collaborator`
 * ("Colaborador responsable"); Oliver es `owner`, Perla `director` y
 * Eduardo `finance`. Cada proyecto guarda quién ocupa cada rol, así que si
 * cambia la persona, se cambia una vez en el proyecto y todo la sigue.
 *
 * Regla del documento: si una fecha cae en día no laborable, vence el día
 * hábil anterior (prevBusinessDay).
 */

// ---------------- Roles ----------------

export type MarketingRole = "owner" | "director" | "collaborator" | "finance";

export const ROLE_LABELS: Record<MarketingRole, string> = {
  owner: "Responsable general",
  director: "Dirección y aprobación",
  collaborator: "Colaborador responsable",
  finance: "Finanzas",
};

export function roleName(project: MarketingProject, role: MarketingRole): string {
  return project[role] ?? "";
}

// ---------------- Fechas ----------------

function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** n-ésimo lunes de un mes (month 0-11). */
function nthMonday(year: number, month: number, n: number): string {
  const d = new Date(year, month, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + 7 * (n - 1));
  return toISO(d);
}

/** Descansos obligatorios de la Ley Federal del Trabajo (art. 74). */
function holidays(year: number): Set<string> {
  const days = [
    `${year}-01-01`,
    nthMonday(year, 1, 1), // primer lunes de febrero
    nthMonday(year, 2, 3), // tercer lunes de marzo
    `${year}-05-01`,
    `${year}-09-16`,
    nthMonday(year, 10, 3), // tercer lunes de noviembre
    `${year}-12-25`,
  ];
  // Transmisión del Ejecutivo Federal: 1 de octubre cada seis años (2030, 2036…)
  if ((year - 2024) % 6 === 0) days.push(`${year}-10-01`);
  return new Set(days);
}

export function isWorkingDay(iso: string): boolean {
  const d = toDate(iso);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !holidays(d.getFullYear()).has(iso);
}

/** Si la fecha cae en día no laborable, el día hábil anterior. */
export function prevBusinessDay(iso: string): string {
  let d = iso;
  while (!isWorkingDay(d)) d = addDays(d, -1);
  return d;
}

/** Suma días hábiles saltando también los festivos de ley. */
export function addWorkingDays(iso: string, days: number): string {
  let d = iso;
  let remaining = days;
  while (remaining > 0) {
    d = addDays(d, 1);
    if (isWorkingDay(d)) remaining--;
  }
  return d;
}

/** "2026-11-17" → "2026-11-01". */
export function periodOf(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(period: string, n: number): string {
  const d = toDate(period);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

function lastDayOf(period: string): number {
  const d = toDate(period);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Día `day` del mes (si el mes es más corto, el último día). */
export function dayOf(period: string, day: number): string {
  return `${period.slice(0, 8)}${String(Math.min(day, lastDayOf(period))).padStart(2, "0")}`;
}

/** Lunes que caen dentro del mes. */
export function mondaysOf(period: string): string[] {
  const out: string[] = [];
  const last = lastDayOf(period);
  for (let day = 1; day <= last; day++) {
    const iso = dayOf(period, day);
    if (toDate(iso).getDay() === 1) out.push(iso);
  }
  return out;
}

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-11-01" → "noviembre 2026". */
export function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** "2026-11-01" → "Noviembre 2026" (para títulos y pestañas). */
export function monthTitle(period: string): string {
  const label = monthLabel(period);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Meses del ciclo, de `from` a `to` (ambos día 1, inclusive). */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let p = periodOf(from); p <= to && out.length < 60; p = addMonths(p, 1)) out.push(p);
  return out;
}

// ---------------- Definición de pasos ----------------

export type StepKind =
  | "tarea"
  | "aprobacion"   // ¿Perla aprueba? NO → regresa a backTo
  | "autorizacion" // ¿Dominio nuevo? solo con autorización
  | "auditoria"    // si detecta error, Oliver corrige y documenta
  | "prueba"       // ¿Funciona? NO → corregir y repetir
  | "validacion";  // Oliver valida o asigna nueva práctica

/** Opciones del rombo según el tipo de paso (la primera es "sin decidir"). */
export const RESULT_OPTIONS: Partial<Record<StepKind, readonly string[]>> = {
  aprobacion: ["Pendiente", "Aprobado", "Cambios solicitados"],
  autorizacion: ["Pendiente", "Autorizado", "No autorizado"],
  auditoria: ["Pendiente", "Sin hallazgos", "Con hallazgos", "Corregido"],
  prueba: ["Pendiente", "Funciona", "Falla"],
  validacion: ["Pendiente", "Validado", "Nueva práctica"],
};

/** Resultados que cierran el paso. */
export const POSITIVE_RESULTS = new Set([
  "Aprobado",
  "Autorizado",
  "Sin hallazgos",
  "Con hallazgos", // la auditoría se hizo; la corrección queda como tarea aparte
  "Corregido",
  "Funciona",
  "Validado",
]);

/** Resultados que regresan el flujo a `backTo`. */
export const NEGATIVE_RESULTS = new Set(["Cambios solicitados", "No autorizado", "Falla", "Nueva práctica"]);

type DueCtx = {
  today: string;
  /** Mes del ciclo (día 1), en pasos mensuales. */
  period: string;
  /** Mes anterior (día 1). */
  prev: string;
  startedAt: string;
  page?: MarketingPage;
  /** Fecha en que se cerró un paso del mismo ámbito (null si sigue abierto). */
  doneAt: (id: string) => string | null;
};

export type StepDef = {
  id: string;
  /** Número de paso en el mapa del proceso. */
  no: string;
  title: string;
  /** Lo que dice la columna "Flujo del proceso". */
  flow: string;
  role: MarketingRole;
  support?: MarketingRole;
  /** Columna "Tiempo / SLA" del mapa. */
  sla: string;
  kind?: StepKind;
  /** Pasos que tienen que estar cerrados antes. */
  after?: string[];
  /** Rombo en NO: a qué paso regresa (puede ser el mismo). */
  backTo?: string;
  /** Qué se deja como evidencia. */
  evidence?: string;
  /** Días antes del vencimiento en que la tarea aparece (pasos de calendario). */
  lead?: number;
  group: string;
  /** Hito de la transferencia de Oliver al colaborador (SEO). */
  transfer?: string;
  applies?: (ctx: DueCtx) => boolean;
  due: (ctx: DueCtx) => string | null;
};

/** Cierre + n días hábiles; null mientras el paso anterior siga abierto. */
const afterDone = (ctx: DueCtx, id: string, days: number): string | null => {
  const d = ctx.doneAt(id);
  return d ? addWorkingDays(d, days) : null;
};

// ---- Mailing: un mes de trabajo (la planeación ocurre el mes anterior) ----

export const MAILING_STEPS: StepDef[] = [
  {
    id: "s1",
    no: "1",
    group: "Planeación",
    title: "Definir prioridades comerciales del mes",
    flow: "Perla registra temas, servicios, públicos y necesidades particulares.",
    role: "director",
    sla: "Días 25 a 27 del mes anterior",
    evidence: "Prioridades capturadas en el mes",
    lead: 7,
    due: (c) => prevBusinessDay(dayOf(c.prev, 27)),
  },
  {
    id: "s2",
    no: "2",
    group: "Planeación",
    title: "Confirmar prioridades y preparar el plan",
    flow: "Oliver confirma recepción y registra insumos faltantes. Siempre debe estar incluida una masterclass mensual.",
    role: "owner",
    sla: "Mismo día de recepción",
    after: ["s1"],
    due: (c) => c.doneAt("s1") ?? prevBusinessDay(dayOf(c.prev, 27)),
  },
  {
    id: "s3",
    no: "3",
    group: "Planeación",
    title: "Entregar cierre de campañas del mes",
    flow: "Oliver entrega informe segmentado, aprendizajes y recomendaciones.",
    role: "owner",
    sla: "Día 27 del mes anterior",
    evidence: "Liga del informe de cierre",
    lead: 7,
    due: (c) => prevBusinessDay(dayOf(c.prev, 27)),
  },
  {
    id: "s4",
    no: "4",
    group: "Planeación",
    title: "Presentar el plan completo del mes",
    flow: "Calendario de todos los correos por base de datos, fecha y base; textos, objetivos, llamados a la acción, masterclass y al menos dos recursos mensuales para regalar (playbook, video, simulador, dashboard, etc.).",
    role: "owner",
    sla: "Máximo día 29 del mes anterior",
    evidence: "Liga del plan; los envíos capturados abajo",
    after: ["s2"],
    lead: 7,
    due: (c) => prevBusinessDay(dayOf(c.prev, 29)),
  },
  {
    id: "s5",
    no: "5",
    group: "Planeación",
    title: "Revisar y aprobar plan y contenidos",
    flow: "¿Perla aprueba? NO → Oliver corrige y vuelve a presentar (paso 4). SÍ → se preparan los envíos.",
    role: "director",
    sla: "Días 29 y 30 del mes anterior",
    kind: "aprobacion",
    backTo: "s4",
    after: ["s4"],
    lead: 7,
    due: (c) => prevBusinessDay(dayOf(c.prev, 30)),
  },
  {
    id: "s12",
    no: "12",
    group: "Medición",
    title: "Entregar informe de avance",
    flow: "Resultados por base, objetivo y correo; ajustes para el resto del mes.",
    role: "owner",
    sla: "Día 15",
    evidence: "Liga del informe de avance",
    lead: 7,
    due: (c) => prevBusinessDay(dayOf(c.period, 15)),
  },
  {
    id: "s13",
    no: "13",
    group: "Medición",
    title: "Auditar envíos y bases",
    flow: "Perla revisa una muestra de destinatarios, incorporación de leads, programación y secuencia real. Si detecta error, Oliver corrige y documenta.",
    role: "director",
    support: "owner",
    sla: "Aleatorio durante el mes (fecha sugerida, se puede mover)",
    kind: "auditoria",
    lead: 7,
    due: (c) => prevBusinessDay(dayOf(c.period, 20)),
  },
  {
    id: "s14",
    no: "14",
    group: "Medición",
    title: "Cerrar medición del mes y proponer decisiones",
    flow: "Informe detallado con éxitos, correos más eficaces, lecciones y qué continuar, cambiar o detener. Regresa al paso 1 para el mes siguiente.",
    role: "owner",
    sla: "Día 27",
    evidence: "Liga del informe de cierre",
    lead: 7,
    due: (c) => prevBusinessDay(dayOf(c.period, 27)),
  },
];

/** Paso 11: un reporte de leads por cada lunes del mes. */
export function weeklyStepDef(monday: string): StepDef {
  return {
    id: `w-${monday}`,
    no: "11",
    group: "Reportes semanales",
    title: `Reporte semanal de leads (semana del ${shortDate(addDays(monday, -7))} al ${shortDate(addDays(monday, -1))})`,
    flow: "Nuevas suscripciones, altas por fuente y segmento, acciones comerciales, duplicados y seguimiento pendiente. Distingue suscripción de oportunidad comercial.",
    role: "owner",
    sla: "Cada lunes por la semana previa",
    evidence: "Liga del reporte",
    lead: 3,
    due: () => prevBusinessDay(monday),
  };
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`;
}

// ---- SEO: pasos únicos del proyecto (diagnóstico y transferencia) ----

export const SEO_BASE_STEPS: StepDef[] = [
  {
    id: "b1",
    no: "1",
    group: "Arranque",
    title: "Definir prioridades comerciales",
    flow: "Perla prioriza páginas CDMX: team building, NOM 035 y LEGO; Oliver registra audiencia, oferta, objetivo y llamada a la acción.",
    role: "director",
    support: "owner",
    sla: "Inicio (y revisión mensual en el paso 19)",
    evidence: "Prioridades capturadas en el proyecto",
    due: (c) => addWorkingDays(c.startedAt, 2),
  },
  {
    id: "b2",
    no: "2",
    group: "Arranque",
    title: "Inventariar todas las URL (línea base)",
    flow: "Registrar URL, servicio, ciudad, propósito, estado de indexación, formulario, responsable y fecha de última actualización.",
    role: "collaborator",
    sla: "Primera línea base; después se actualiza mes a mes",
    evidence: "Inventario de URL capturado abajo",
    due: (c) => addWorkingDays(c.startedAt, 5),
  },
  {
    id: "b3",
    no: "3",
    group: "Arranque",
    title: "Diagnosticar SEO técnico",
    flow: "Revisar Search Console, rastreo e indexación, sitemap, títulos, metadescripciones, enlaces rotos, versión móvil, velocidad y errores. Oliver prioriza.",
    role: "collaborator",
    support: "owner",
    sla: "Diagnóstico inicial (después, revisión mensual)",
    evidence: "Liga del diagnóstico",
    due: (c) => addWorkingDays(c.startedAt, 8),
  },
  {
    id: "b7",
    no: "7",
    group: "Transferencia",
    transfer: "1 · Guía documentada",
    title: "Documentar el proceso para el colaborador",
    flow: "Guía paso a paso: investigación, brief, construcción, publicación, SEO, pruebas, medición, accesos institucionales y criterios de aceptación.",
    role: "owner",
    sla: "Antes de la primera página",
    evidence: "Liga de la guía",
    due: (c) => addWorkingDays(c.startedAt, 5),
  },
  {
    id: "b8",
    no: "8",
    group: "Transferencia",
    transfer: "2 · Explicación registrada",
    title: "Explicar y practicar: demostrar una mejora o página",
    flow: "Oliver demuestra una mejora o página, resuelve dudas y registra la explicación.",
    role: "owner",
    support: "collaborator",
    sla: "Primer ciclo",
    evidence: "Liga de la grabación o notas de la explicación",
    after: ["b7"],
    due: (c) => afterDone(c, "b7", 3),
  },
  {
    id: "b8b",
    no: "8",
    group: "Transferencia",
    transfer: "3 · Ejecución acompañada",
    title: "Ejecutar una parte acompañado",
    flow: "El colaborador ejecuta una parte del proceso con Oliver al lado.",
    role: "collaborator",
    support: "owner",
    sla: "Primer ciclo",
    evidence: "Liga de lo ejecutado",
    after: ["b8"],
    due: (c) => afterDone(c, "b8", 3),
  },
  {
    id: "b15",
    no: "15",
    group: "Transferencia",
    title: "Ejecutar una mejora completa sin guía en vivo",
    flow: "El colaborador ejecuta una mejora completa sin guía en vivo, explica sus decisiones, entrega evidencia y atiende correcciones.",
    role: "collaborator",
    support: "owner",
    sla: "Tras la práctica acompañada",
    evidence: "Liga de la mejora y su explicación",
    after: ["b8b"],
    due: (c) => afterDone(c, "b8b", 10),
  },
  {
    id: "b15v",
    no: "15",
    group: "Transferencia",
    transfer: "4 · Ejecución autónoma validada",
    title: "Validar la autonomía del colaborador",
    flow: "Oliver valida o asigna nueva práctica.",
    role: "owner",
    sla: "Tras la entrega de la mejora",
    kind: "validacion",
    backTo: "b15",
    after: ["b15"],
    due: (c) => afterDone(c, "b15", 2),
  },
];

// ---- SEO: ciclo mensual (medición y mejora continua) ----

export const SEO_MONTH_STEPS: StepDef[] = [
  {
    id: "m2",
    no: "2",
    group: "Ciclo mensual",
    title: "Actualizar el inventario de URL",
    flow: "URL nuevas o cambiadas, estado de indexación, formulario, responsable y fecha de última actualización.",
    role: "collaborator",
    sla: "Mes a mes",
    lead: 7,
    due: (c) => prevBusinessDay(dayOf(c.period, 10)),
  },
  {
    id: "m3",
    no: "3",
    group: "Ciclo mensual",
    title: "Revisión técnica mensual",
    flow: "Search Console, rastreo e indexación, sitemap, títulos, metadescripciones, enlaces rotos, versión móvil, velocidad y errores. Oliver prioriza.",
    role: "collaborator",
    support: "owner",
    sla: "Revisión mensual",
    evidence: "Liga de la revisión",
    lead: 7,
    due: (c) => prevBusinessDay(dayOf(c.period, 10)),
  },
  {
    id: "m17",
    no: "17",
    group: "Ciclo mensual",
    title: "Medir todas las URL (corte mensual)",
    flow: "Comparar periodos en Search Console y analítica: indexación, consultas, impresiones, clics, CTR, posición media, visitas, formularios y leads útiles.",
    role: "collaborator",
    sla: "Corte mensual (antes del informe del día 20)",
    evidence: "Liga del corte",
    lead: 7,
    due: (c) => prevBusinessDay(dayOf(c.period, 15)),
  },
  {
    id: "m18",
    no: "18",
    group: "Ciclo mensual",
    title: "Entregar analítica y decisión propuesta",
    flow: "Comparativo de todas las URL, mejores oportunidades, errores, cambios realizados y una recomendación de qué proyectar el mes siguiente.",
    role: "owner",
    sla: "Día 20 de cada mes",
    evidence: "Liga del informe",
    lead: 7,
    due: (c) => prevBusinessDay(dayOf(c.period, 20)),
  },
  {
    id: "m19",
    no: "19",
    group: "Ciclo mensual",
    title: "Aprobar la prioridad siguiente",
    flow: "Perla decide qué URL mejorar, qué página nueva crear o qué campaña impulsar.",
    role: "director",
    support: "owner",
    sla: "Tras el informe del día 20",
    evidence: "Decisión anotada en el paso",
    after: ["m18"],
    due: (c) => afterDone(c, "m18", 2),
  },
  {
    id: "m19r",
    no: "19",
    group: "Ciclo mensual",
    title: "Registrar el entregable y la fecha que se decidió",
    flow: "Oliver registra entregable y fecha: una página nueva en \"Páginas\" (regresa al paso 9) o una mejora en el inventario (regresa al paso 16).",
    role: "owner",
    sla: "Tras la decisión de Dirección",
    after: ["m19"],
    due: (c) => afterDone(c, "m19", 1),
  },
  {
    id: "m16",
    no: "16",
    group: "Ciclo mensual",
    title: "Mantener y optimizar las URL priorizadas",
    flow: "Corregir errores, actualizar información, mejorar enlaces y contenidos con bajo desempeño; Oliver valida los cambios sensibles.",
    role: "collaborator",
    support: "owner",
    sla: "Continuo; priorización mensual",
    lead: 7,
    due: (c) => prevBusinessDay(dayOf(c.period, 31)),
  },
];

// ---- SEO: ciclo de cada página (pasos 4-13 y cierre de la URL) ----

const pageAnchor = (c: DueCtx) => c.page?.created_at.slice(0, 10) ?? c.today;
const isNewDomain = (c: DueCtx) => c.page?.architecture === "Dominio nuevo";

export const SEO_PAGE_STEPS: StepDef[] = [
  {
    id: "p1",
    no: "1",
    group: "Página",
    title: "Registrar audiencia, oferta, objetivo y llamada a la acción",
    flow: "Oliver registra en la ficha de la página lo que Perla priorizó.",
    role: "owner",
    sla: "Al priorizar la página",
    due: (c) => addWorkingDays(pageAnchor(c), 2),
  },
  {
    id: "p4",
    no: "4",
    group: "Página",
    title: "Investigar demanda y la página de Chihuahua",
    flow: "Reunir consultas relevantes e intención de búsqueda; identificar qué estructura sirve y qué casos, oferta y datos deben adaptarse a CDMX.",
    role: "collaborator",
    support: "owner",
    sla: "Antes de cada página",
    evidence: "Liga de la investigación",
    due: (c) => addWorkingDays(pageAnchor(c), 3),
  },
  {
    id: "p5",
    no: "5",
    group: "Página",
    title: "Decidir página satélite y arquitectura",
    flow: "¿Hay necesidad y contenido propios? NO → mejorar URL existente. SÍ → definir URL y relación con el sitio principal. ¿Dominio nuevo? Solo con autorización de Perla.",
    role: "director",
    support: "owner",
    sla: "Antes de construir",
    after: ["p4"],
    due: (c) => afterDone(c, "p4", 2),
  },
  {
    id: "p5d",
    no: "5",
    group: "Página",
    title: "Autorizar el dominio nuevo",
    flow: "Se prefiere una URL en el sitio principal salvo decisión comercial y técnica justificada.",
    role: "director",
    sla: "Antes de construir",
    kind: "autorizacion",
    backTo: "p5",
    after: ["p5"],
    applies: isNewDomain,
    due: (c) => afterDone(c, "p5", 1),
  },
  {
    id: "p6",
    no: "6",
    group: "Página",
    title: "Comprar el dominio y entregar los datos administrativos",
    flow: "Eduardo compra y entrega datos administrativos del dominio. No diseña, construye ni publica la página.",
    role: "finance",
    sla: "Tras la autorización",
    after: ["p5d"],
    applies: isNewDomain,
    due: (c) => afterDone(c, "p5d", 2),
  },
  {
    id: "p9",
    no: "9",
    group: "Página",
    title: "Preparar el brief de la página",
    flow: "Definir URL, público, consulta principal, diferenciación local real, estructura, pruebas de experiencia, enlaces internos, formulario y medición.",
    role: "collaborator",
    sla: "Por página",
    evidence: "Liga del brief",
    after: ["p1", "p5"],
    due: (c) => afterDone(c, "p5", 3),
  },
  {
    id: "p10",
    no: "10",
    group: "Página",
    title: "Aprobar contenido y oferta",
    flow: "¿Perla aprueba promesas, ejemplos y llamada a la acción? NO → el colaborador corrige con Oliver y regresa al paso 9.",
    role: "director",
    support: "owner",
    sla: "Antes de construir",
    kind: "aprobacion",
    backTo: "p9",
    after: ["p9"],
    due: (c) => afterDone(c, "p9", 2),
  },
  {
    id: "p11",
    no: "11",
    group: "Página",
    title: "Construir la página",
    flow: "El colaborador desarrolla la página; Oliver supervisa jerarquía, textos, título, metadescripción, imágenes, enlaces, versión móvil y accesibilidad básica.",
    role: "collaborator",
    support: "owner",
    sla: "Por página",
    evidence: "Liga de la versión de prueba",
    after: ["p10", "p6"],
    due: (c) => afterDone(c, "p10", 5),
  },
  {
    id: "p12",
    no: "12",
    group: "Página",
    title: "Probar formulario y atribución",
    flow: "Envío real, recepción del lead, origen/campaña, privacidad y funcionamiento de recursos. ¿Funciona? NO → corregir y repetir.",
    role: "collaborator",
    support: "owner",
    sla: "Antes de publicar",
    kind: "prueba",
    backTo: "p12",
    after: ["p11"],
    due: (c) => afterDone(c, "p11", 1),
  },
  {
    id: "p13v",
    no: "13",
    group: "Página",
    title: "Validar la página antes de publicar",
    flow: "Oliver valida la versión final.",
    role: "owner",
    sla: "Antes de publicar",
    after: ["p12"],
    due: (c) => afterDone(c, "p12", 1),
  },
  {
    id: "p13",
    no: "13",
    group: "Página",
    title: "Publicar y comprobar indexación",
    flow: "Publicar, enlazar desde páginas pertinentes, actualizar sitemap si aplica y verificar la URL en Search Console.",
    role: "collaborator",
    support: "owner",
    sla: "Por página",
    evidence: "URL publicada",
    after: ["p13v"],
    due: (c) => afterDone(c, "p13v", 1),
  },
  {
    id: "pc",
    no: "Cierre",
    group: "Página",
    title: "Cerrar la URL: indexación, origen del lead y enlace a datos",
    flow: "Cada URL CDMX se cierra con brief, aprobación, versión publicada, prueba del formulario, registro de origen del lead, verificación de indexación y enlace a datos.",
    role: "owner",
    sla: "Tras publicar",
    evidence: "Enlace a datos de la página",
    after: ["p13"],
    due: (c) => afterDone(c, "p13", 5),
  },
];

// ---------------- Resolución ----------------

export type ResolvedStep = {
  /** step_key en marketing_steps. */
  key: string;
  def: StepDef;
  assignee: string;
  supportName: string;
  /** Fecha del flujo (sin la comprometida a mano). */
  defaultDue: string | null;
  /** Fecha comprometida: la capturada o, si no hay, la del flujo. */
  due: string | null;
  status: string;
  result: string;
  rounds: number;
  done: boolean;
  /** Algún paso anterior sigue abierto. */
  locked: boolean;
  /** Ocurrió antes de que el proyecto entrara al CRM (no genera tarea). */
  beforeStart: boolean;
  /** Desde cuándo aparece en "Mis tareas" (null = en cuanto se desbloquea). */
  visibleFrom: string | null;
  /** Se muestra aquí pero es el paso de otro mes (no genera tarea). */
  mirrorOf?: string;
  row?: MarketingStep;
};

export const DONE_STATUSES = new Set(["Listo", "No aplica"]);

/** Fecha en que se cerró un paso (la que se selló o, si no, la última edición). */
function closedOn(r: ResolvedStep, today: string): string | null {
  if (!r.done) return null;
  if (r.beforeStart) return r.due ?? today;
  return r.row?.completed_at ?? r.row?.updated_at?.slice(0, 10) ?? today;
}

function resolveDefs(
  defs: StepDef[],
  prefix: string,
  project: MarketingProject,
  rows: Record<string, MarketingStep>,
  base: Omit<DueCtx, "doneAt">
): ResolvedStep[] {
  const byId: Record<string, ResolvedStep> = {};
  const out: ResolvedStep[] = [];
  const ctx: DueCtx = {
    ...base,
    doneAt: (id) => (byId[id] ? closedOn(byId[id], base.today) : null),
  };

  for (const def of defs) {
    if (def.applies && !def.applies(ctx)) continue;
    const key = `${prefix}:${def.id}`;
    const row = rows[key];
    const locked = (def.after ?? []).some((a) => byId[a] && !byId[a].done);
    const defaultDue = def.due(ctx);
    const due = row?.due_date ?? defaultDue;
    // Lo que vencía antes de que el proyecto existiera en el CRM se hizo
    // por fuera: no se cobra como tarea (a menos que alguien lo capture).
    const beforeStart = !row && !!due && due < project.started_at;
    const status = row?.status ?? (beforeStart ? "No aplica" : "Pendiente");
    const r: ResolvedStep = {
      key,
      def,
      assignee: roleName(project, def.role),
      supportName: def.support ? roleName(project, def.support) : "",
      defaultDue,
      due,
      status,
      result: row?.result ?? "",
      rounds: row?.rounds ?? 0,
      done: DONE_STATUSES.has(status),
      locked,
      beforeStart,
      visibleFrom: def.lead !== undefined && due ? addDays(due, -def.lead) : null,
      row,
    };
    byId[def.id] = r;
    out.push(r);
  }
  return out;
}

export type StepRowsByKey = Record<string, MarketingStep>;

export function indexSteps(rows: MarketingStep[]): StepRowsByKey {
  return Object.fromEntries(rows.map((r) => [r.step_key, r]));
}

/** Clave del mes en step_key: "2026-11". */
export const monthKey = (period: string) => period.slice(0, 7);

/**
 * Los pasos de un mes de mailing. Si el mes anterior también es del
 * proyecto, su paso 14 (cierre del día 27) ES el paso 3 de este mes: se
 * muestra como espejo y la tarea vive allá, para no cobrarlo dos veces.
 */
export function resolveMailingMonth(
  project: MarketingProject,
  period: string,
  rows: StepRowsByKey,
  today: string
): ResolvedStep[] {
  const prev = addMonths(period, -1);
  const prefix = monthKey(period);
  const defs = [
    ...MAILING_STEPS.filter((d) => d.group === "Planeación"),
    ...mondaysOf(period).map(weeklyStepDef),
    ...MAILING_STEPS.filter((d) => d.group !== "Planeación"),
  ];
  const steps = resolveDefs(defs, prefix, project, rows, {
    today,
    period,
    prev,
    startedAt: project.started_at,
  });

  if (prev >= periodOf(project.start_month)) {
    const prevSteps = resolveDefs(
      MAILING_STEPS.filter((d) => d.id === "s14"),
      monthKey(prev),
      project,
      rows,
      { today, period: prev, prev: addMonths(prev, -1), startedAt: project.started_at }
    );
    const s3 = steps.find((s) => s.def.id === "s3");
    const s14 = prevSteps[0];
    if (s3 && s14) Object.assign(s3, { ...s14, def: s3.def, mirrorOf: s14.key });
  }
  return steps;
}

export function resolveSeoBase(
  project: MarketingProject,
  rows: StepRowsByKey,
  today: string
): ResolvedStep[] {
  return resolveDefs(SEO_BASE_STEPS, "b", project, rows, {
    today,
    period: periodOf(today),
    prev: addMonths(periodOf(today), -1),
    startedAt: project.started_at,
  });
}

export function resolveSeoMonth(
  project: MarketingProject,
  period: string,
  rows: StepRowsByKey,
  today: string
): ResolvedStep[] {
  return resolveDefs(SEO_MONTH_STEPS, monthKey(period), project, rows, {
    today,
    period,
    prev: addMonths(period, -1),
    startedAt: project.started_at,
  });
}

export function resolveSeoPage(
  project: MarketingProject,
  page: MarketingPage,
  rows: StepRowsByKey,
  today: string
): ResolvedStep[] {
  return resolveDefs(SEO_PAGE_STEPS, `p:${page.id}`, project, rows, {
    today,
    period: periodOf(today),
    prev: addMonths(periodOf(today), -1),
    startedAt: project.started_at,
    page,
  });
}

/** Meses del ciclo que ya se pueden trabajar (mailing incluye el siguiente, que se planea este). */
export function activeMonths(project: MarketingProject, today: string): string[] {
  const current = periodOf(today);
  const horizon = project.kind === "Mailing" ? addMonths(current, 1) : current;
  const end = project.end_month && periodOf(project.end_month) < horizon ? periodOf(project.end_month) : horizon;
  return monthsBetween(project.start_month, end);
}

/** Orden de los pasos de un ámbito, para reabrir de `backTo` al paso actual. */
export function scopeDefs(kind: "mailing" | "seo-base" | "seo-month" | "seo-page"): StepDef[] {
  if (kind === "mailing") return MAILING_STEPS;
  if (kind === "seo-base") return SEO_BASE_STEPS;
  if (kind === "seo-month") return SEO_MONTH_STEPS;
  return SEO_PAGE_STEPS;
}

/** De qué plantilla es un step_key. */
export function scopeOf(stepKey: string, projectKind: string): {
  kind: "mailing" | "seo-base" | "seo-month" | "seo-page";
  prefix: string;
  id: string;
} {
  const id = stepKey.slice(stepKey.lastIndexOf(":") + 1);
  const prefix = stepKey.slice(0, stepKey.lastIndexOf(":"));
  if (prefix === "b") return { kind: "seo-base", prefix, id };
  if (prefix.startsWith("p:")) return { kind: "seo-page", prefix, id };
  return { kind: projectKind === "SEO" ? "seo-month" : "mailing", prefix, id };
}

/** Busca la definición de un paso por su id dentro de su plantilla. */
export function findDef(stepKey: string, projectKind: string): StepDef | undefined {
  const { kind, id } = scopeOf(stepKey, projectKind);
  if (id.startsWith("w-")) return weeklyStepDef(id.slice(2));
  return scopeDefs(kind).find((d) => d.id === id);
}

/**
 * Pasos que se reabren cuando un rombo dice NO: del paso al que regresa
 * hasta el paso que decidió (en el orden del mapa).
 */
export function loopRange(stepKey: string, projectKind: string): string[] {
  const { kind, prefix, id } = scopeOf(stepKey, projectKind);
  const defs = scopeDefs(kind);
  const def = defs.find((d) => d.id === id);
  if (!def?.backTo) return [];
  const from = defs.findIndex((d) => d.id === def.backTo);
  const to = defs.findIndex((d) => d.id === id);
  if (from < 0 || to < 0 || from > to) return [];
  return defs.slice(from, to + 1).map((d) => `${prefix}:${d.id}`);
}


// ---------------- Vista para la pantalla ----------------

/** Lo que la pantalla necesita de un paso (sin funciones, para pasarlo al cliente). */
export type StepView = {
  key: string;
  no: string;
  title: string;
  flow: string;
  sla: string;
  kind: StepKind;
  group: string;
  transfer?: string;
  evidence?: string;
  assignee: string;
  supportName: string;
  due: string | null;
  defaultDue: string | null;
  status: string;
  result: string;
  rounds: number;
  done: boolean;
  locked: boolean;
  /** Pasos abiertos que lo detienen ("Paso 2"). */
  waitingFor: string[];
  beforeStart: boolean;
  mirrorOf?: string;
  evidenceUrl: string;
  notes: string;
  blocker: string;
  blockerAt: string | null;
  completedAt: string | null;
  resultOptions?: readonly string[];
};

export function toStepViews(steps: ResolvedStep[]): StepView[] {
  const byId = Object.fromEntries(steps.map((s) => [s.def.id, s]));
  return steps.map((s) => ({
    key: s.key,
    no: s.def.no,
    title: s.def.title,
    flow: s.def.flow,
    sla: s.def.sla,
    kind: s.def.kind ?? "tarea",
    group: s.def.group,
    transfer: s.def.transfer,
    evidence: s.def.evidence,
    assignee: s.assignee,
    supportName: s.supportName,
    due: s.due,
    defaultDue: s.defaultDue,
    status: s.status,
    result: s.result,
    rounds: s.rounds,
    done: s.done,
    locked: s.locked,
    waitingFor: (s.def.after ?? [])
      .filter((a) => byId[a] && !byId[a].done)
      .map((a) => `Paso ${byId[a].def.no}`),
    beforeStart: s.beforeStart,
    mirrorOf: s.mirrorOf,
    evidenceUrl: s.row?.evidence_url ?? "",
    notes: s.row?.notes ?? "",
    blocker: s.row?.blocker ?? "",
    blockerAt: s.row?.blocker_at ?? null,
    completedAt: s.row?.completed_at ?? null,
    resultOptions: s.def.kind ? RESULT_OPTIONS[s.def.kind] : undefined,
  }));
}

/**
 * Cumplimiento para el bono: pasos cerrados a tiempo, tarde, vencidos y
 * bloqueos externos registrados antes del vencimiento.
 */
export function compliance(steps: StepView[], today: string) {
  const own = steps.filter((s) => !s.beforeStart && !s.mirrorOf && s.status !== "No aplica" && s.due);
  const closed = own.filter((s) => s.done && s.completedAt);
  return {
    total: own.length,
    onTime: closed.filter((s) => s.completedAt! <= s.due!).length,
    late: closed.filter((s) => s.completedAt! > s.due!).length,
    overdue: own.filter((s) => !s.done && s.due! < today).length,
    blockedInTime: own.filter((s) => s.blocker && s.blockerAt && s.blockerAt <= s.due!).length,
  };
}
