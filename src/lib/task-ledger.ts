import { after } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isDemoMode, createDemoClient } from "@/lib/demo/mock";
import { computeTasks, customToComputed, type ComputedTask } from "./tasks";
import { computeConsultingTasks, type ConsultingProjectFull } from "./consulting-tasks";
import { computeRecruitmentTasks, type RecruitmentVacancyFull } from "./recruitment-tasks";
import { computeMarketingTasks } from "./marketing-tasks";
import { fetchFacilitators, internalFacilitatorNames } from "./facilitators";
import { addDays, todayISO } from "./format";
import { mexicoDate, mexicoToday, nextDeadline, type LedgerRow } from "./productivity";

/**
 * Bitácora de tareas (migración 024) para el reporte de productividad.
 *
 * Compara las tareas abiertas que da el motor con la bitácora:
 *  - Tarea nueva → se anota con su fecha límite (ver nextDeadline).
 *  - Tarea que sigue abierta → se actualiza (responsable, fecha, "en espera").
 *  - Tarea que desapareció → se decide si se CERRÓ (cuenta) o si se canceló,
 *    se borró, se marcó "No aplica" o su proyecto se pausó/cerró (no cuenta).
 *  - Tarea que reaparece (se reabrió o se reanudó) → vuelve a abierta.
 *
 * Corre con la llave de servicio (ve todo, sin importar quién dio clic) y
 * se dispara después de cada cambio (logActivity), al abrir Mis tareas,
 * al abrir el reporte y en el cron diario. Si cualquier lectura falla, NO
 * toca nada: una lectura incompleta haría creer que se cerraron tareas.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = any;

export type SyncResult = { ok: true; open: number; closed: number; excluded: number } | { ok: false; reason: string };

/** Cliente con la llave de servicio (o el de demo). Solo para el servidor. */
export function ledgerServiceClient(): AnyClient | null {
  if (isDemoMode()) return createDemoClient();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false },
  });
}

type Sources = {
  tasks: ComputedTask[];
  trainings: Map<string, any>;
  materials: Set<string>;
  requests: Set<string>;
  custom: Map<string, any>;
  consulting: Map<string, any>;
  milestones: Set<string>;
  inputs: Map<string, any>;
  changes: Map<string, any>;
  vacancies: Map<string, any>;
  candidates: Set<string>;
  marketingProjects: Map<string, any>;
  marketingSteps: Map<string, any>;
  sends: Set<string>;
  leads: Map<string, any>;
  progress: Map<string, any>;
};

async function loadSources(sb: AnyClient): Promise<Sources | { error: string }> {
  const results = await Promise.all([
    sb.from("trainings").select("*, clients(id, company), sessions(*), materials(*)"),
    sb.from("profiles").select("id, full_name"),
    sb.from("custom_tasks").select("*, clients(id, company)"),
    sb.from("training_requests").select("*"),
    sb.from("consulting_projects").select("*, clients(id, company)"),
    sb.from("consulting_milestones").select("*"),
    sb.from("consulting_inputs").select("*"),
    sb.from("consulting_changes").select("*"),
    sb.from("recruitment_vacancies").select("*, clients(id, company)"),
    sb.from("recruitment_candidates").select("*"),
    sb.from("task_progress").select("*"),
    sb.from("marketing_projects").select("*").order("created_at"),
    sb.from("marketing_steps").select("*"),
    sb.from("marketing_sends").select("*").order("send_date").order("position"),
    sb.from("marketing_leads").select("*").order("lead_date"),
    sb.from("marketing_pages").select("*").order("position"),
  ]);
  const failed = results.find((r: any) => r.error);
  if (failed) return { error: failed.error.message ?? "lectura fallida" };
  const [
    trainingsR, profilesR, customR, requestsR, consultingR, milestonesR, inputsR, changesR,
    vacanciesR, candidatesR, progressR, mProjectsR, mStepsR, mSendsR, mLeadsR, mPagesR,
  ] = results.map((r: any) => (r.data ?? []) as any[]);

  const facilitators = await fetchFacilitators(sb);
  const internalNames = internalFacilitatorNames(profilesR.map((p) => p.full_name), facilitators);

  const requestsByTraining: Record<string, any[]> = {};
  for (const r of requestsR) (requestsByTraining[r.training_id] ??= []).push(r);
  const trainings = trainingsR.map((t) => ({ ...t, training_requests: requestsByTraining[t.id] ?? [] }));

  const consultingProjects: ConsultingProjectFull[] = consultingR.map((p) => ({
    ...p,
    milestones: milestonesR.filter((m) => m.project_id === p.id),
    inputs: inputsR.filter((i) => i.project_id === p.id),
    changes: changesR.filter((c) => c.project_id === p.id),
  }));
  const vacancies: RecruitmentVacancyFull[] = vacanciesR.map((v) => ({
    ...v,
    candidates: candidatesR.filter((c) => c.vacancy_id === v.id),
  }));

  const tasks = [
    ...computeTasks(trainings, internalNames),
    ...computeConsultingTasks(consultingProjects),
    ...computeRecruitmentTasks(vacancies),
    ...computeMarketingTasks({ projects: mProjectsR, steps: mStepsR, sends: mSendsR, leads: mLeadsR, pages: mPagesR }),
    ...customToComputed(customR.filter((c) => c.status !== "Completada")),
  ];

  return {
    tasks,
    trainings: new Map(trainingsR.map((t) => [t.id, t])),
    materials: new Set(trainingsR.flatMap((t) => (t.materials ?? []).map((m: any) => m.id))),
    requests: new Set(requestsR.map((r) => r.id)),
    custom: new Map(customR.map((c) => [c.id, c])),
    consulting: new Map(consultingR.map((p) => [p.id, p])),
    milestones: new Set(milestonesR.map((m) => m.id)),
    inputs: new Map(inputsR.map((i) => [i.id, i])),
    changes: new Map(changesR.map((c) => [c.id, c])),
    vacancies: new Map(vacanciesR.map((v) => [v.id, v])),
    candidates: new Set(candidatesR.map((c) => c.id)),
    marketingProjects: new Map(mProjectsR.map((p) => [p.id, p])),
    marketingSteps: new Map(mStepsR.map((s) => [`${s.project_id}|${s.step_key}`, s])),
    sends: new Set(mSendsR.map((s) => s.id)),
    leads: new Map(mLeadsR.map((l) => [l.id, l])),
    progress: new Map(progressR.map((p) => [p.task_key, p])),
  };
}

/** Módulo del CRM al que pertenece la tarea (para el desglose "por proceso"). */
function moduleOf(task: ComputedTask, src: Sources): string {
  const k = task.key;
  if (k.startsWith("cons-")) return "Consultoría";
  if (k.startsWith("recl-")) return "Reclutamiento";
  if (k.startsWith("mkt-")) return "Marketing";
  if (k.startsWith("custom-")) return "Tareas propias";
  if (k.startsWith("req-")) return "Team buildings";
  const t = task.trainingId ? src.trainings.get(task.trainingId) : null;
  return t?.kind === "Team building" ? "Team buildings" : "Capacitaciones";
}

/** Id del proyecto de las claves "cons-<uuid>-…", "recl-<uuid>-…" y "mkt-<uuid>-…". */
function projectIdOf(key: string): string {
  if (key.startsWith("cons-") || key.startsWith("recl-")) return key.slice(5, 41);
  if (key.startsWith("mkt-") && !key.startsWith("mkt-lead-")) return key.slice(4, 40);
  return "";
}

type Resolution = { state: "cerrada"; closed_at: string } | { state: "excluida"; reason: string };

function onOrBefore(date: string | null | undefined, today: string): string {
  return date && /^\d{4}-\d{2}-\d{2}/.test(date) && date.slice(0, 10) <= today ? date.slice(0, 10) : today;
}

/** ¿Por qué ya no está abierta? Cerrada cuenta; lo demás no cuenta. */
function resolve(row: LedgerRow, src: Sources, today: string): Resolution {
  const closed = (date: string = today): Resolution => ({ state: "cerrada", closed_at: date });
  const excluded = (reason: string): Resolution => ({ state: "excluida", reason });
  const c = (row.complete ?? {}) as any;

  if (row.training_id) {
    const t = src.trainings.get(row.training_id);
    if (!t) return excluded("eliminada");
    if (t.status === "Cancelada") return excluded("cancelada");
  }

  const pid = projectIdOf(row.task_key);
  if (row.task_key.startsWith("cons-")) {
    const p = src.consulting.get(pid);
    if (!p) return excluded("eliminada");
    if (p.status === "Cancelado") return excluded("cancelada");
    if (p.status === "Finalizado") return excluded("proyecto cerrado");
  }
  if (row.task_key.startsWith("recl-")) {
    const v = src.vacancies.get(pid);
    if (!v) return excluded("eliminada");
    if (v.status === "Cancelada") return excluded("cancelada");
    if (v.status === "Pausada") return excluded("en pausa");
    if (v.status === "Cerrada") return excluded("proyecto cerrado");
  }
  if (pid && row.task_key.startsWith("mkt-")) {
    const p = src.marketingProjects.get(pid);
    if (!p) return excluded("eliminada");
    if (p.status === "En pausa") return excluded("en pausa");
    if (p.status !== "Activo") return excluded("proyecto cerrado");
  }

  switch (c.type) {
    case "training_field": {
      const t = src.trainings.get(row.training_id);
      if (t && t[c.field] === "No aplica") return excluded("no aplica");
      return closed();
    }
    case "material_status":
      return src.materials.has(c.materialId) ? closed() : excluded("eliminada");
    case "custom_task": {
      const ct = src.custom.get(c.taskId);
      if (!ct) return excluded("eliminada");
      return ct.status === "Completada" && ct.completed_at
        ? closed(onOrBefore(mexicoDate(ct.completed_at), today))
        : closed();
    }
    case "training_request":
      return src.requests.has(c.requestId) ? closed() : excluded("eliminada");
    case "consulting_field": {
      const p = src.consulting.get(c.projectId);
      if (p && p[c.field] === "No aplica") return excluded("no aplica");
      return closed();
    }
    case "consulting_milestone":
      return src.milestones.has(c.milestoneId) ? closed() : excluded("eliminada");
    case "consulting_input": {
      const i = src.inputs.get(c.inputId);
      if (!i) return excluded("eliminada");
      return closed(i.received ? onOrBefore(i.received_at, today) : today);
    }
    case "consulting_change":
      return src.changes.has(c.changeId) ? closed() : excluded("eliminada");
    case "recruitment_field": {
      const v = src.vacancies.get(c.vacancyId);
      if (v && v[c.field] === "No aplica") return excluded("no aplica");
      return closed();
    }
    case "recruitment_stamp": {
      const v = src.vacancies.get(c.vacancyId);
      return closed(onOrBefore(v?.[c.field], today));
    }
    case "recruitment_candidate":
      return src.candidates.has(c.candidateId) ? closed() : excluded("eliminada");
    case "marketing_step": {
      const s = src.marketingSteps.get(`${c.projectId}|${c.stepKey}`);
      if (s?.status === "No aplica") return excluded("no aplica");
      return closed(s?.completed_at ? onOrBefore(s.completed_at, today) : today);
    }
    case "marketing_send":
      return src.sends.has(c.sendId) ? closed() : excluded("eliminada");
    case "marketing_lead": {
      const l = src.leads.get(c.leadId);
      if (!l) return excluded("eliminada");
      if (l.duplicate || l.lead_type !== "Oportunidad comercial") return excluded("no aplica");
      return closed();
    }
    default:
      return closed();
  }
}

/** Columnas que escribe la sincronización (nunca toca el "¿qué pasó?"). */
type SyncRow = Omit<LedgerRow, "context" | "context_by" | "context_at">;

const SYNC_COLUMNS: (keyof SyncRow)[] = [
  "task_key", "title", "kind", "module", "project", "client", "assignee", "href", "complete",
  "training_id", "first_seen", "last_seen", "engine_due", "deadline", "user_dated", "backlog",
  "state", "closed_at", "exclude_reason", "waiting_for", "waiting_since",
];

function sameRow(a: SyncRow, b: SyncRow): boolean {
  return SYNC_COLUMNS.every((k) =>
    k === "complete" ? JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null) : (a[k] ?? null) === (b[k] ?? null)
  );
}

async function readLedger(sb: AnyClient): Promise<SyncRow[] | { error: string }> {
  const rows: SyncRow[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data, error } = await sb
      .from("task_ledger")
      .select(SYNC_COLUMNS.join(", "))
      .order("task_key")
      .range(from, from + PAGE - 1);
    if (error) return { error: error.message ?? "no se pudo leer la bitácora" };
    rows.push(...((data ?? []) as SyncRow[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function syncOnce(): Promise<SyncResult> {
  const sb = ledgerServiceClient();
  if (!sb) return { ok: false, reason: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." };

  // Primero la bitácora: si la migración 024 aún no corre, se sale barato
  const ledger = await readLedger(sb);
  if ("error" in ledger) return { ok: false, reason: ledger.error };
  const src = await loadSources(sb);
  if ("error" in src) return { ok: false, reason: `No se pudieron leer los módulos: ${src.error}` };

  const today = mexicoToday();
  const engineToday = todayISO();
  const byKey = new Map(ledger.map((r) => [r.task_key, r]));
  const openNow = ledger.filter((r) => r.state === "abierta");

  // Lectura sospechosa: ninguna tarea abierta cuando la bitácora tiene varias.
  if (src.tasks.length === 0 && openNow.length > 5) {
    return { ok: false, reason: "El motor no dio tareas; no se toca la bitácora por si fue una lectura incompleta." };
  }

  // La primera vez, lo que ya estaba vencido o vence hoy/mañana no cuenta.
  const initialImport = ledger.length === 0;
  const writes: SyncRow[] = [];
  const seen = new Set<string>();

  for (const t of src.tasks) {
    if (seen.has(t.key)) continue;
    seen.add(t.key);
    const prev = byKey.get(t.key) ?? null;
    const userDated = t.complete.type === "custom_task";
    const p = src.progress.get(t.key);
    const waiting = p?.status === "En espera";

    const next: SyncRow = {
      task_key: t.key,
      title: t.title,
      kind: t.kind,
      module: moduleOf(t, src),
      project: t.trainingName,
      client: t.clientName,
      assignee: t.assignee ?? "",
      href: t.href ?? (t.trainingId ? `/capacitaciones/${t.trainingId}` : "/tareas"),
      complete: t.complete,
      training_id: t.trainingId ?? "",
      first_seen: prev?.first_seen ?? today,
      last_seen: today,
      engine_due: t.due,
      deadline: nextDeadline(prev, t.due, today, userDated, engineToday),
      user_dated: userDated,
      backlog: prev ? prev.backlog : initialImport && !!t.due && t.due <= addDays(engineToday, 1),
      state: "abierta",
      closed_at: null,
      exclude_reason: "",
      // Una vez que estuvo en espera, queda anotado (desde cuándo y de quién dependía)
      waiting_for: waiting ? p.waiting_for ?? "" : prev?.waiting_for ?? "",
      waiting_since:
        prev?.waiting_since ?? (waiting ? (p.updated_at ? mexicoDate(p.updated_at) : today) : null),
    };
    // last_seen solo se reescribe si algo más cambió o si cambió de día
    if (!prev || !sameRow(prev, next)) writes.push(next);
  }

  let closedCount = 0;
  let excludedCount = 0;
  for (const r of openNow) {
    if (seen.has(r.task_key)) continue;
    const res = resolve(r as LedgerRow, src, today);
    if (res.state === "cerrada") {
      closedCount++;
      writes.push({ ...r, state: "cerrada", closed_at: res.closed_at, exclude_reason: "" });
    } else {
      excludedCount++;
      writes.push({ ...r, state: "excluida", closed_at: null, exclude_reason: res.reason });
    }
  }

  // Mismas llaves en todos los renglones (si no, supabase-js rellena con null)
  for (let i = 0; i < writes.length; i += 200) {
    const batch = writes.slice(i, i + 200).map((w) => Object.fromEntries(SYNC_COLUMNS.map((k) => [k, w[k] ?? null])));
    const { error } = await sb.from("task_ledger").upsert(batch, { onConflict: "task_key" });
    if (error) return { ok: false, reason: error.message ?? "no se pudo escribir la bitácora" };
  }

  return { ok: true, open: seen.size, closed: closedCount, excluded: excludedCount };
}

// Varias llamadas seguidas (una acción que registra dos eventos, o dos
// personas a la vez) se juntan: si ya hay una corriendo, se repite una
// vez al terminar para que vea el último cambio.
let running: Promise<SyncResult> | null = null;
let again = false;

export function syncTaskLedger(): Promise<SyncResult> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    let result: SyncResult = { ok: false, reason: "sin correr" };
    do {
      again = false;
      try {
        result = await syncOnce();
      } catch (e) {
        result = { ok: false, reason: e instanceof Error ? e.message : "error inesperado" };
      }
    } while (again);
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Sincroniza después de responder (no hace esperar a quien dio clic). */
export function scheduleLedgerSync() {
  try {
    after(async () => {
      try {
        await syncTaskLedger();
      } catch {
        // Nunca debe tumbar la acción que lo llamó.
      }
    });
  } catch {
    // Fuera de un request (scripts): no hay after(), no pasa nada.
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
