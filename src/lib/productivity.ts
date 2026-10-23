import { addBusinessDays, addDays } from "./format";
import { TEAM_TZ } from "./timezones";

/**
 * Reporte de productividad (23-oct-2026, pedido de Perla y Ari).
 *
 * Mide si las tareas que salen de los procesos se cerraron a tiempo, con
 * candados para que sea justo y no un instrumento de presión:
 *  1. Lo bloqueado no cuenta en contra: si la tarea quedó "⏸ En espera"
 *     (con de quién dependía) antes de vencer, sale como bloqueada.
 *  2. La misma vara para todos, dirección incluida.
 *  3. Sin ranking: personas en orden alfabético y el porcentaje siempre
 *     junto a la carga.
 *  4. Las horas (⏱) no entran: sirven para costear, no para medir gente.
 *  5. Cada tarea tarde puede llevar su "¿qué pasó?", que sale junto al número.
 *  6. Los acuerdos del mes se escriben al inicio y queda a la vista quién
 *     y cuándo los editó.
 * Además: toda tarea tiene al menos un día hábil desde que aparece, lo que
 * vence en fin de semana se puede cerrar el siguiente día hábil, y lo que
 * ya venía atrasado cuando arrancó la bitácora no cuenta.
 *
 * Este archivo es lógica pura (sin Supabase) para poder probarla aparte.
 * La sincronización vive en task-ledger.ts.
 */

/** Ven el reporte de todo el equipo. Debe coincidir con la migración 024. */
export const PRODUCTIVITY_FULL_ACCESS = [
  "ariannaevora@talentoria.com",
  "perlatorres@talentoria.com",
  "antoniooliver@talentoria.com",
];

export function seesAllProductivity(email?: string | null): boolean {
  return !!email && PRODUCTIVITY_FULL_ACCESS.includes(email.toLowerCase());
}

export type LedgerState = "abierta" | "cerrada" | "excluida";

export type LedgerRow = {
  task_key: string;
  title: string;
  kind: string;
  module: string;
  project: string;
  client: string;
  assignee: string;
  href: string;
  complete: unknown;
  training_id: string;
  first_seen: string;
  last_seen: string;
  engine_due: string | null;
  deadline: string | null;
  user_dated: boolean;
  backlog: boolean;
  state: LedgerState;
  closed_at: string | null;
  exclude_reason: string;
  waiting_for: string;
  waiting_since: string | null;
  context: string;
  context_by: string;
  context_at: string | null;
};

/** Hoy en México (YYYY-MM-DD); el servidor de Vercel vive en UTC. */
export function mexicoToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TEAM_TZ }).format(new Date());
}

/** Fecha en México de un timestamp ("2026-10-23T03:10:00Z" → "2026-10-22"). */
export function mexicoDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TEAM_TZ }).format(new Date(timestamp));
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

function isWeekend(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

/** Lo que vence en sábado o domingo se puede cerrar el lunes. */
export function effectiveDeadline(deadline: string): string {
  return isWeekend(deadline) ? addBusinessDays(deadline, 1) : deadline;
}

/** Días hábiles entre `from` y `to` (0 si `to` no va después). */
export function businessDaysBetween(from: string, to: string): number {
  let n = 0;
  let d = from;
  while (d < to && n < 400) {
    d = addBusinessDays(d, 1);
    if (d <= to) n++;
  }
  return n;
}

/**
 * Fecha límite que cuenta para el reporte.
 *
 * El motor de tareas nunca deja una fecha en el pasado: lo que ya no
 * alcanza lo recorre a hoy o a mañana, todos los días. Si la bitácora
 * copiara esa fecha, nada saldría tarde jamás. Por eso:
 *  - Al aparecer, la tarea tiene al menos un día hábil.
 *  - Mientras el motor dé una fecha futura de verdad (pasado mañana o
 *    después), se sigue: si el cliente movió la sesión, la fecha se mueve.
 *  - Cuando el motor ya da hoy/mañana, la fecha se congela.
 *  - En tareas propias la fecha la pone una persona: si se renegocia,
 *    se respeta.
 * `engineToday` es el "hoy" con el que el motor recorrió las fechas
 * (todayISO del servidor, que en Vercel es UTC): en la tarde de México ya
 * es mañana allá, y con el hoy de México un "mañana" recorrido parecería
 * una fecha futura de verdad.
 */
export function nextDeadline(
  prev: Pick<LedgerRow, "deadline" | "first_seen"> | null,
  engineDue: string | null,
  today: string,
  userDated: boolean,
  engineToday: string = today
): string | null {
  if (!engineDue) return null;
  const floor = addBusinessDays(prev?.first_seen ?? today, 1);
  const candidate = maxDate(engineDue, floor);
  if (!prev || !prev.deadline) return candidate;
  if (userDated) return candidate;
  if (engineDue > addDays(engineToday, 1)) return candidate;
  return prev.deadline;
}

export type Outcome =
  | "a_tiempo"
  | "tarde"
  | "vencida"
  | "bloqueada"
  | "por_vencer"
  | "sin_fecha"
  | "previa"
  | "excluida";

export function outcomeOf(row: LedgerRow, today: string): Outcome {
  if (row.state === "excluida") return "excluida";
  if (row.backlog) return "previa";
  if (!row.deadline) return "sin_fecha";
  const limit = effectiveDeadline(row.deadline);
  const blocked = !!row.waiting_since && row.waiting_since <= limit;
  if (row.state === "cerrada") {
    if (row.closed_at && row.closed_at <= limit) return "a_tiempo";
    return blocked ? "bloqueada" : "tarde";
  }
  if (today <= limit) return "por_vencer";
  return blocked ? "bloqueada" : "vencida";
}

/** Días hábiles de retraso (cerrada tarde o abierta y vencida). */
export function daysLate(row: LedgerRow, today: string): number {
  if (!row.deadline) return 0;
  const end = row.state === "cerrada" ? row.closed_at ?? today : today;
  return businessDaysBetween(effectiveDeadline(row.deadline), end);
}

export type Summary = {
  aTiempo: number;
  tarde: number;
  vencida: number;
  bloqueada: number;
  porVencer: number;
  /** Tareas que vencían en el periodo y ya se pueden evaluar. */
  evaluadas: number;
  /** a tiempo / (a tiempo + tarde + vencidas); null si no hay nada que medir. */
  pct: number | null;
  /** Promedio de días hábiles de retraso de las tarde y vencidas. */
  avgLate: number | null;
};

/** "2026-10-23" → "2026-10". */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonths(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** El mes al que pertenece una tarea: el de su fecha límite (en día hábil). */
export function periodOfRow(row: LedgerRow): string | null {
  return row.deadline ? monthOf(effectiveDeadline(row.deadline)) : null;
}

export function summarize(rows: LedgerRow[], period: string, today: string): Summary {
  const s: Summary = { aTiempo: 0, tarde: 0, vencida: 0, bloqueada: 0, porVencer: 0, evaluadas: 0, pct: null, avgLate: null };
  let lateDays = 0;
  let lateCount = 0;
  for (const r of rows) {
    if (periodOfRow(r) !== period) continue;
    const o = outcomeOf(r, today);
    if (o === "a_tiempo") s.aTiempo++;
    else if (o === "tarde" || o === "vencida") {
      if (o === "tarde") s.tarde++;
      else s.vencida++;
      lateDays += daysLate(r, today);
      lateCount++;
    } else if (o === "bloqueada") s.bloqueada++;
    else if (o === "por_vencer") s.porVencer++;
  }
  s.evaluadas = s.aTiempo + s.tarde + s.vencida + s.bloqueada;
  const base = s.aTiempo + s.tarde + s.vencida;
  s.pct = base > 0 ? Math.round((s.aTiempo / base) * 100) : null;
  s.avgLate = lateCount > 0 ? Math.round((lateDays / lateCount) * 10) / 10 : null;
  return s;
}

export const NO_ASSIGNEE = "Sin responsable";

export function personOf(row: LedgerRow): string {
  return row.assignee.trim() || NO_ASSIGNEE;
}
