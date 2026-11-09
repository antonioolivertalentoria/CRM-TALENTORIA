import { isDemoMode } from "@/lib/demo/mock";
import { addDays } from "@/lib/format";
import {
  NO_ASSIGNEE,
  OUTCOMES,
  PRODUCTIVITY_FULL_ACCESS,
  addMonths,
  daysLate,
  effectiveDeadline,
  outcomeOf,
  periodOfRow,
  personOf,
  seesAllProductivity,
  type DashOutcome,
  type DashRow,
  type LedgerRow,
  type PersonAgreement,
} from "@/lib/productivity";

/**
 * Lectura de la bitácora para /productividad y su reporte en PDF: así los
 * dos muestran exactamente las mismas cifras. RLS ya limita lo que cada
 * quien puede leer; aquí se aplica además la segunda llave (y es lo que
 * filtra en modo demo).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const MONTHS_SHOWN = 6;

/** "?mes=2026-10" válido y no futuro; si no, el mes en curso. */
export function resolvePeriod(mes: unknown, current: string): string {
  return typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) && mes <= current ? mes : current;
}

/** Lee la bitácora en páginas de 1000 (límite de Supabase por consulta). */
async function readRows(supabase: any, from: string, to: string): Promise<{ rows: LedgerRow[]; error: string | null }> {
  const rows: LedgerRow[] = [];
  for (let start = 0; start < 50_000; start += 1000) {
    const { data, error } = await supabase
      .from("task_ledger")
      .select("*")
      .gte("deadline", from)
      .lt("deadline", to)
      .order("deadline")
      .range(start, start + 999);
    if (error) return { rows, error: error.message ?? "No se pudo leer la bitácora." };
    rows.push(...((data ?? []) as LedgerRow[]));
    if (!data || data.length < 1000) break;
  }
  return { rows, error: null };
}

export type ProductivityData = {
  /** Los seis meses de la tendencia; el último es `period`. */
  months: string[];
  seesAll: boolean;
  /** Nombre (perfil) de quien consulta. */
  me: string;
  /** Personas con tareas, en orden alfabético; "Sin responsable" al final. */
  people: string[];
  rows: DashRow[];
  agreements: (PersonAgreement & { period: string })[];
  agreementsReady: boolean;
  /** Tareas del periodo que no entran al indicador (para la nota al pie). */
  excluded: { person: string; module: string }[];
  /** Fecha de la primera anotación de la bitácora (inicio de la medición). */
  startedOn: string | null;
  /** Nombres de pila de quienes consultan la información del equipo. */
  directionNames: string[];
  readError: string | null;
};

export async function loadProductivity(
  supabase: any,
  user: { id: string; email?: string | null } | null,
  period: string,
  today: string
): Promise<ProductivityData> {
  const seesAll = seesAllProductivity(user?.email) || isDemoMode();

  const months = Array.from({ length: MONTHS_SHOWN }, (_, i) => addMonths(period, i - (MONTHS_SHOWN - 1)));
  // Margen de tres días: un vencimiento en fin de semana se recorre al mes siguiente
  const from = addDays(`${months[0]}-01`, -3);
  const to = `${addMonths(period, 1)}-01`;

  const [{ rows: allRows, error: readError }, { data: profilesData }, agreementsRes, { data: firstData }] = await Promise.all([
    readRows(supabase, from, to),
    supabase.from("profiles").select("id, full_name, email"),
    supabase
      .from("productivity_agreements")
      .select("period, person, body, target_pct, updated_by, updated_at, acknowledged_at")
      .in("period", months),
    supabase.from("task_ledger").select("first_seen").order("first_seen").limit(1),
  ]);

  const profiles = (profilesData ?? []) as { id: string; full_name: string; email: string }[];
  const me = profiles.find((p) => p.id === user?.id)?.full_name ?? "";
  const teamNames = new Set(profiles.map((p) => p.full_name));
  const directionNames = profiles
    .filter((p) => PRODUCTIVITY_FULL_ACCESS.includes((p.email ?? "").toLowerCase()))
    .map((p) => p.full_name.split(" ")[0]);
  const startedOn = ((firstData ?? []) as { first_seen: string }[])[0]?.first_seen ?? null;
  const agreementsReady = !agreementsRes.error;
  const agreements = (agreementsReady ? agreementsRes.data ?? [] : []) as (PersonAgreement & { period: string })[];

  // RLS ya filtra; esto es la segunda llave (y lo que aplica en modo demo)
  const visible = seesAll ? allRows : allRows.filter((r) => r.assignee === me);

  const rows: DashRow[] = [];
  const excluded: { person: string; module: string }[] = [];
  for (const r of visible) {
    const p = periodOfRow(r);
    if (!p || !r.deadline) continue;
    const o = outcomeOf(r, today);
    if (!(OUTCOMES as string[]).includes(o)) {
      if (p === period) excluded.push({ person: personOf(r), module: r.module || "Otros" });
      continue;
    }
    const person = personOf(r);
    rows.push({
      key: r.task_key,
      title: r.title,
      module: r.module,
      project: r.project,
      client: r.client,
      person,
      href: r.href,
      period: p,
      deadline: effectiveDeadline(r.deadline),
      closedAt: r.state === "cerrada" ? r.closed_at : null,
      open: r.state === "abierta",
      outcome: o as DashOutcome,
      daysLate: o === "tarde" || o === "vencida" ? daysLate(r, today) : 0,
      waitingFor: r.waiting_for,
      waitingSince: r.waiting_since,
      context: r.context,
      contextBy: r.context_by,
      contextAt: r.context_at,
      canComment: r.assignee === me || (seesAll && !teamNames.has(r.assignee)),
    });
  }

  // Personas en orden alfabético; "Sin responsable" al final
  const people = seesAll
    ? [...new Set(rows.map((r) => r.person))].sort((a, b) =>
        a === NO_ASSIGNEE ? 1 : b === NO_ASSIGNEE ? -1 : a.localeCompare(b, "es")
      )
    : [me];

  return { months, seesAll, me, people, rows, agreements, agreementsReady, excluded, startedOn, directionNames, readError };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
