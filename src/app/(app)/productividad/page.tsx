import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/mock";
import { syncTaskLedger } from "@/lib/task-ledger";
import { updateLedgerContextAction, updateProductivityAgreementsAction } from "@/lib/actions";
import { EditableField } from "@/components/EditableField";
import { addDays, formatDate } from "@/lib/format";
import {
  NO_ASSIGNEE,
  PRODUCTIVITY_FULL_ACCESS,
  addMonths,
  daysLate,
  mexicoDate,
  mexicoToday,
  monthOf,
  outcomeOf,
  periodLabel,
  periodOfRow,
  personOf,
  seesAllProductivity,
  summarize,
  type LedgerRow,
  type Outcome,
} from "@/lib/productivity";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

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

const OUTCOME_LABEL: Record<Outcome, string> = {
  a_tiempo: "A tiempo",
  tarde: "Tarde",
  vencida: "Vencida",
  bloqueada: "Bloqueada",
  por_vencer: "Por vencer",
  sin_fecha: "Sin fecha",
  previa: "De antes del reporte",
  excluida: "No cuenta",
};

const OUTCOME_STYLE: Record<Outcome, string> = {
  a_tiempo: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  tarde: "bg-amber-50 text-amber-700 ring-amber-200",
  vencida: "bg-orange-50 text-orange-700 ring-orange-200",
  bloqueada: "bg-sky-50 text-sky-700 ring-sky-200",
  por_vencer: "bg-slate-50 text-slate-500 ring-slate-200",
  sin_fecha: "bg-slate-50 text-slate-500 ring-slate-200",
  previa: "bg-slate-50 text-slate-500 ring-slate-200",
  excluida: "bg-slate-50 text-slate-400 ring-slate-200",
};

/** Orden dentro de la lista de una persona: primero lo que pide atención. */
const OUTCOME_ORDER: Record<Outcome, number> = {
  vencida: 0,
  tarde: 1,
  bloqueada: 2,
  por_vencer: 3,
  a_tiempo: 4,
  sin_fecha: 5,
  previa: 6,
  excluida: 7,
};

export default async function ProductivityPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { mes } = await searchParams;
  const today = mexicoToday();
  const current = monthOf(today);
  const period = typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) && mes <= current ? mes : current;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const seesAll = seesAllProductivity(user?.email) || isDemoMode();

  // Antes de leer, la bitácora se pone al día (con la llave de servicio)
  const sync = await syncTaskLedger();

  // Tres meses para la tendencia, con margen por fechas de fin de semana
  const from = addDays(`${addMonths(period, -2)}-01`, -3);
  const to = `${addMonths(period, 1)}-01`;

  const [{ rows: allRows, error: readError }, { data: profilesData }, { data: agreementData }, { data: firstData }] =
    await Promise.all([
      readRows(supabase, from, to),
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("productivity_agreements").select("*").eq("period", period).maybeSingle(),
      supabase.from("task_ledger").select("first_seen").order("first_seen").limit(1),
    ]);

  const profiles = (profilesData ?? []) as { id: string; full_name: string; email: string }[];
  const myName = profiles.find((p) => p.id === user?.id)?.full_name ?? "";
  const teamNames = new Set(profiles.map((p) => p.full_name));
  const directionNames = profiles
    .filter((p) => PRODUCTIVITY_FULL_ACCESS.includes((p.email ?? "").toLowerCase()))
    .map((p) => p.full_name.split(" ")[0]);
  const startedOn = ((firstData ?? []) as { first_seen: string }[])[0]?.first_seen ?? null;
  const agreement = agreementData as { body: string; updated_by: string; updated_at: string } | null;

  // RLS ya filtra; esto es la segunda llave (y lo que aplica en modo demo)
  const rows = seesAll ? allRows : allRows.filter((r) => r.assignee === myName);
  const inPeriod = rows.filter((r) => periodOfRow(r) === period);

  // Personas: orden alfabético, sin ranking. "Sin responsable" al final.
  const people = seesAll
    ? [...new Set(rows.map(personOf))].sort((a, b) =>
        a === NO_ASSIGNEE ? 1 : b === NO_ASSIGNEE ? -1 : a.localeCompare(b, "es")
      )
    : [myName || "Tú"];

  const trendPeriods = [addMonths(period, -2), addMonths(period, -1), period];
  const modules = [...new Set(inPeriod.map((r) => r.module || "Otros"))].sort((a, b) => a.localeCompare(b, "es"));
  const notCounted = inPeriod.filter((r) => {
    const o = outcomeOf(r, today);
    return o === "excluida" || o === "previa";
  }).length;

  // Pestañas de meses: desde que arrancó la bitácora (máximo 6 hacia atrás)
  const firstMonth = startedOn ? monthOf(startedOn) : current;
  const tabs: string[] = [];
  for (let p = current; p >= firstMonth && tabs.length < 6; p = addMonths(p, -1)) tabs.unshift(p);
  if (!tabs.includes(period)) tabs.unshift(period);

  // En el mes en que arrancó el reporte los acuerdos por fuerza se escriben tarde
  const editedLate =
    !!agreement?.updated_at &&
    period !== (startedOn ? monthOf(startedOn) : current) &&
    mexicoDate(agreement.updated_at) > `${period}-07`;
  const migrationMissing = (readError ?? (sync.ok ? "" : sync.reason)).includes("task_ledger");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Productividad</h1>
          <p className="max-w-3xl text-sm text-slate-500">
            Qué tareas le tocaron a cada quien en el mes y si salieron a tiempo. Las tareas salen solas de los procesos del
            CRM (capacitaciones, team buildings, consultoría, reclutamiento, marketing y tareas propias); las reglas están
            abajo, a la vista de todos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link
              key={t}
              href={`/productividad?mes=${t}`}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                t === period
                  ? "bg-gradient-to-r from-brand-cyan to-brand-magenta text-white shadow"
                  : "border border-slate-300 bg-white text-slate-600 hover:border-brand-cyan"
              }`}
            >
              <span className="capitalize">{periodLabel(t)}</span>
              {t === current ? " · en curso" : ""}
            </Link>
          ))}
        </div>
      </header>

      {migrationMissing ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Falta correr la <strong>migración 024</strong> (bitácora de productividad) en la base. En cuanto corra, el CRM
          empieza a anotar las tareas solo.
        </div>
      ) : (
        (!sync.ok || readError) && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            La bitácora no se pudo poner al día ({readError ?? (!sync.ok ? sync.reason : "")}). Lo que ves puede estar
            desfasado; se vuelve a intentar con cada cambio en el CRM.
          </div>
        )
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-brand-navy">Cómo se mide</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            <li>
              Cuenta cada tarea que vencía en el mes. <strong>A tiempo</strong> = se cerró a más tardar en su fecha límite;
              si la fecha cae en fin de semana, vale cerrarla el siguiente día hábil.
            </li>
            <li>
              Toda tarea tiene <strong>al menos un día hábil</strong>{" "}desde que aparece en el CRM, aunque el proceso
              diga &quot;de inmediato&quot;.
            </li>
            <li>
              Si el cliente mueve la sesión, la fecha límite se mueve con ella. En tareas propias, si se renegocia la fecha,
              cuenta la nueva.
            </li>
            <li>
              <strong>Lo bloqueado no cuenta en contra:</strong> si marcaste la tarea{" "}
              <strong>⏸ En espera</strong> (Mis tareas → 🟡 Avance) antes de que venciera, sale como bloqueada y no baja el
              porcentaje.
            </li>
            <li>
              No cuentan las tareas canceladas, borradas o marcadas &quot;No aplica&quot;, las de proyectos pausados o
              cerrados, ni lo que ya venía atrasado cuando arrancó el reporte
              {startedOn ? ` (${formatDate(startedOn)})` : ""}.
            </li>
            <li>
              Las horas registradas (⏱) <strong>no entran</strong>: sirven para costear proyectos, no para medir personas.
            </li>
            <li>
              Personas en orden alfabético, sin ranking, y el porcentaje siempre junto a cuántas tareas fueron. Cada quien
              ve su reporte; {directionNames.length ? `${joinNames(directionNames)} ven` : "dirección ve"} el de todo el
              equipo, y el suyo cuenta igual.
            </li>
            <li>Cada tarea tarde o vencida puede llevar su &quot;¿qué pasó?&quot;, que se lee junto al número.</li>
          </ul>
          <p className="mt-3 text-xs text-slate-400">Porcentaje = a tiempo ÷ (a tiempo + tarde + vencidas).</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-brand-navy">
            Acuerdos de <span className="capitalize">{periodLabel(period)}</span>
          </h2>
          <p className="text-xs text-slate-400">
            Se escriben al empezar el mes: qué se espera, qué cuenta y qué no. Si se cambian después, aquí queda la fecha.
          </p>
          <div className="mt-2">
            {seesAll ? (
              <EditableField
                value={agreement?.body ?? ""}
                onSave={updateProductivityAgreementsAction.bind(null, period)}
                multiline
                rows={6}
                placeholder="Ej. prioridades del mes, qué tareas pesan más, vacaciones o cargas especiales que hay que tomar en cuenta…"
              />
            ) : agreement?.body ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700">{agreement.body}</p>
            ) : (
              <p className="text-sm italic text-slate-400">Aún no se escriben los acuerdos de este mes.</p>
            )}
          </div>
          {agreement?.updated_at && (
            <p className={`mt-2 text-xs ${editedLate ? "font-semibold text-amber-700" : "text-slate-400"}`}>
              Última edición: {formatDate(mexicoDate(agreement.updated_at))}
              {agreement.updated_by ? ` por ${agreement.updated_by}` : ""}
              {editedLate ? " — ya avanzado el mes" : ""}
            </p>
          )}
        </div>
      </section>

      {seesAll && inPeriod.length > 0 && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-brand-navy">Por proceso</h2>
            <p className="text-xs text-slate-400">Todo el equipo junto: dónde fluye y dónde se atora el proceso.</p>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-1 font-semibold">Módulo</th>
                  <th className="py-1 text-right font-semibold">A tiempo</th>
                  <th className="py-1 text-right font-semibold">Tarde</th>
                  <th className="py-1 text-right font-semibold">Vencidas</th>
                  <th className="py-1 text-right font-semibold">Bloqueadas</th>
                  <th className="py-1 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => {
                  const s = summarize(inPeriod.filter((r) => (r.module || "Otros") === m), period, today);
                  return (
                    <tr key={m} className="border-t border-slate-100">
                      <td className="py-1.5 text-slate-700">{m}</td>
                      <td className="py-1.5 text-right tabular-nums">{s.aTiempo}</td>
                      <td className="py-1.5 text-right tabular-nums">{s.tarde}</td>
                      <td className="py-1.5 text-right tabular-nums">{s.vencida}</td>
                      <td className="py-1.5 text-right tabular-nums">{s.bloqueada}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums text-brand-navy">
                        {s.pct === null ? "—" : `${s.pct}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <BlockedPanel rows={inPeriod} today={today} />
        </section>
      )}

      <section className="space-y-4">
        {people.map((person) => {
          const mine = rows.filter((r) => personOf(r) === person);
          return (
            <PersonCard
              key={person}
              person={person}
              rows={mine}
              period={period}
              trendPeriods={trendPeriods}
              today={today}
              canEdit={(r) => r.assignee === myName || (seesAll && !teamNames.has(r.assignee))}
            />
          );
        })}
      </section>

      {notCounted > 0 && (
        <p className="text-xs text-slate-400">
          {notCounted} {notCounted === 1 ? "tarea de este mes no cuenta" : "tareas de este mes no cuentan"}{" "}
          (canceladas, borradas, &quot;No aplica&quot;, de proyectos pausados o cerrados, o que ya venían atrasadas del
          arranque).
        </p>
      )}
    </div>
  );
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function PersonCard({
  person,
  rows,
  period,
  trendPeriods,
  today,
  canEdit,
}: {
  person: string;
  rows: LedgerRow[];
  period: string;
  trendPeriods: string[];
  today: string;
  canEdit: (r: LedgerRow) => boolean;
}) {
  const s = summarize(rows, period, today);
  const trend = trendPeriods.map((p) => ({ p, s: summarize(rows, p, today) }));
  const monthRows = rows
    .filter((r) => periodOfRow(r) === period)
    .map((r) => ({ r, o: outcomeOf(r, today) }))
    .filter(({ o }) => o !== "excluida" && o !== "previa")
    .sort((a, b) => OUTCOME_ORDER[a.o] - OUTCOME_ORDER[b.o] || (a.r.deadline ?? "").localeCompare(b.r.deadline ?? ""));
  const attention = monthRows.filter(({ o }) => o === "tarde" || o === "vencida" || o === "bloqueada");
  const rest = monthRows.filter(({ o }) => !(o === "tarde" || o === "vencida" || o === "bloqueada"));

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-brand-navy">{person}</h3>
          <p className="text-sm text-slate-500">
            {s.evaluadas === 0
              ? "Todavía no hay tareas que evaluar este mes."
              : `${s.aTiempo} de ${s.aTiempo + s.tarde + s.vencida} a tiempo · ${s.evaluadas} ${
                  s.evaluadas === 1 ? "tarea evaluada" : "tareas evaluadas"
                }`}
            {s.porVencer > 0 ? ` · ${s.porVencer} por vencer` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums text-brand-navy">{s.pct === null ? "—" : `${s.pct}%`}</p>
          <p className="text-xs text-slate-400">
            Tendencia:{" "}
            {trend.map(({ p, s: ts }, i) => (
              <span key={p} className="capitalize">
                {i > 0 ? " · " : ""}
                {periodLabel(p).split(" ")[0].slice(0, 3)} {ts.pct === null ? "—" : `${ts.pct}%`}
              </span>
            ))}
          </p>
        </div>
      </div>

      {s.pct !== null && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta" style={{ width: `${s.pct}%` }} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Chip outcome="a_tiempo" n={s.aTiempo} />
        <Chip outcome="tarde" n={s.tarde} />
        <Chip outcome="vencida" n={s.vencida} />
        <Chip outcome="bloqueada" n={s.bloqueada} />
        {s.avgLate !== null && (
          <span className="self-center text-slate-400">
            Retraso promedio de tarde y vencidas: {s.avgLate} {s.avgLate === 1 ? "día hábil" : "días hábiles"}
          </span>
        )}
      </div>

      {attention.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-400">Para platicar (con su contexto)</p>
          {attention.map(({ r, o }) => (
            <TaskRow key={r.task_key} row={r} outcome={o} today={today} editable={canEdit(r)} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-brand-navy hover:underline">
            {rest.length === 1 ? "Ver la otra tarea del mes" : `Ver las otras ${rest.length} tareas del mes`}
          </summary>
          <div className="mt-2 space-y-2">
            {rest.map(({ r, o }) => (
              <TaskRow key={r.task_key} row={r} outcome={o} today={today} editable={false} />
            ))}
          </div>
        </details>
      )}
    </article>
  );
}

function Chip({ outcome, n }: { outcome: Outcome; n: number }) {
  return (
    <span className={`rounded-full px-2.5 py-1 font-semibold ring-1 ${OUTCOME_STYLE[outcome]}`}>
      {OUTCOME_LABEL[outcome]}: {n}
    </span>
  );
}

function TaskRow({
  row,
  outcome,
  today,
  editable,
}: {
  row: LedgerRow;
  outcome: Outcome;
  today: string;
  editable: boolean;
}) {
  const late = outcome === "tarde" || outcome === "vencida" ? daysLate(row, today) : 0;
  const showContext = outcome === "tarde" || outcome === "vencida" || outcome === "bloqueada";
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={row.href || "/tareas"} className="text-sm font-medium text-slate-800 hover:text-brand-cyan hover:underline">
            {row.title}
          </Link>
          <p className="text-xs text-slate-400">
            {[row.module, row.project, row.client].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${OUTCOME_STYLE[outcome]}`}>
          {OUTCOME_LABEL[outcome]}
          {late > 0 ? ` · ${late} ${late === 1 ? "día háb." : "días háb."}` : ""}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Fecha límite: {formatDate(row.deadline)}
        {row.state === "cerrada" && row.closed_at ? ` · se cerró el ${formatDate(row.closed_at)}` : ""}
        {row.state === "abierta" && outcome !== "por_vencer" ? " · sigue abierta" : ""}
      </p>
      {row.waiting_since && (
        <p className="mt-1 text-xs text-sky-700">
          ⏸ En espera desde el {formatDate(row.waiting_since)}
          {row.waiting_for ? ` — dependía de: ${row.waiting_for}` : ""}
        </p>
      )}
      {showContext && (
        <div className="mt-2">
          <p className="text-[11px] font-semibold text-slate-400">¿Qué pasó?</p>
          {editable ? (
            <EditableField
              value={row.context}
              onSave={updateLedgerContextAction.bind(null, row.task_key)}
              multiline
              rows={2}
              placeholder="Cuéntalo en una línea (p. ej. el cliente no mandó la lista a tiempo)"
            />
          ) : row.context ? (
            <p className="text-sm text-slate-700">{row.context}</p>
          ) : (
            <p className="text-sm italic text-slate-400">Sin contexto todavía.</p>
          )}
          {row.context && row.context_by && (
            <p className="text-[11px] text-slate-400">
              Escrito por {row.context_by}
              {row.context_at ? ` el ${formatDate(mexicoDate(row.context_at))}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BlockedPanel({ rows, today }: { rows: LedgerRow[]; today: string }) {
  const blocked = rows.filter((r) => outcomeOf(r, today) === "bloqueada");
  const byWho = new Map<string, number>();
  for (const r of blocked) {
    const who = r.waiting_for.trim() || "Sin detalle";
    byWho.set(who, (byWho.get(who) ?? 0) + 1);
  }
  const list = [...byWho.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-brand-navy">Lo que se atoró por depender de alguien</h2>
      <p className="text-xs text-slate-400">
        Tareas bloqueadas del mes y de qué o de quién dependían. Sirve para quitar obstáculos, también los de dirección.
      </p>
      {list.length === 0 ? (
        <p className="mt-3 text-sm italic text-slate-400">Nada bloqueado este mes.</p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-sm">
          {list.map(([who, n]) => (
            <li key={who} className="flex items-center justify-between gap-3 border-t border-slate-100 pt-1.5">
              <span className="text-slate-700">{who}</span>
              <span className="tabular-nums font-semibold text-sky-700">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
