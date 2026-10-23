"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { EditableField } from "@/components/EditableField";
import {
  acknowledgeAgreementAction,
  updateLedgerContextAction,
  updatePersonAgreementAction,
} from "@/lib/actions";
import { formatDate } from "@/lib/format";
import {
  mexicoDate,
  periodLabel,
  shortPeriodLabel,
  weeksOfMonth,
  type DashOutcome,
  type DashRow,
  type PersonAgreement,
} from "@/lib/productivity";

/**
 * Dashboard de productividad: indicadores, tendencia, carga semanal,
 * desglose por persona y por proceso, dependencias externas, acuerdos del
 * mes por persona y el detalle de tareas. Todo responde a los mismos
 * filtros (persona, proceso y estado).
 *
 * Paleta de estados validada con validate_palette.js sobre fondo blanco, en
 * este orden de apilado: verde | amarillo | azul | naranja (todas las
 * parejas vecinas pasan CVD y visión normal). "En plazo" es el riel gris:
 * todavía no se evalúa. El amarillo queda bajo 3:1 de contraste, por eso
 * siempre hay leyenda, etiquetas y la tabla de resumen.
 */

const OUTCOMES: DashOutcome[] = ["a_tiempo", "tarde", "bloqueada", "vencida", "por_vencer"];

const LABEL: Record<DashOutcome, string> = {
  a_tiempo: "A tiempo",
  tarde: "Con retraso",
  bloqueada: "En espera de terceros",
  vencida: "Vencidas",
  por_vencer: "En plazo",
};

const COLOR: Record<DashOutcome, string> = {
  a_tiempo: "#008300",
  tarde: "#eda100",
  bloqueada: "#2a78d6",
  vencida: "#eb6834",
  por_vencer: "#e1e0d9",
};

const LINE = "#16345F"; // navy de la marca: serie única de la tendencia
const GRID = "#e1e0d9";
const AXIS = "#c3c2b7";
const MUTED = "#898781";
const TARGET = "#52514e";

type Counts = Record<DashOutcome, number>;

function emptyCounts(): Counts {
  return { a_tiempo: 0, tarde: 0, bloqueada: 0, vencida: 0, por_vencer: 0 };
}

function countRows(rows: DashRow[]): Counts {
  const c = emptyCounts();
  for (const r of rows) c[r.outcome]++;
  return c;
}

function total(c: Counts): number {
  return OUTCOMES.reduce((s, o) => s + c[o], 0);
}

/** a tiempo ÷ (a tiempo + con retraso + vencidas); null si aún no hay nada evaluable. */
function pctOf(c: Counts): number | null {
  const base = c.a_tiempo + c.tarde + c.vencida;
  return base > 0 ? Math.round((c.a_tiempo / base) * 100) : null;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

// ---------------------------------------------------------------------------

export function ProductivityDashboard({
  rows,
  months,
  period,
  seesAll,
  me,
  people,
  agreements,
  agreementsReady,
  excluded,
}: {
  rows: DashRow[];
  months: string[];
  period: string;
  seesAll: boolean;
  me: string;
  people: string[];
  agreements: (PersonAgreement & { period: string })[];
  agreementsReady: boolean;
  /** Tareas del periodo que no entran al indicador (para la nota al pie). */
  excluded: { person: string; module: string }[];
}) {
  const [person, setPerson] = useState(seesAll ? "" : me);
  const [module, setModule] = useState("");
  const [outcome, setOutcome] = useState<DashOutcome | "">("");

  const modules = useMemo(
    () => [...new Set(rows.map((r) => r.module || "Otros"))].sort((a, b) => a.localeCompare(b, "es")),
    [rows]
  );

  const scoped = useMemo(
    () => rows.filter((r) => (!person || r.person === person) && (!module || (r.module || "Otros") === module)),
    [rows, person, module]
  );
  const monthRows = useMemo(() => scoped.filter((r) => r.period === period), [scoped, period]);
  const counts = useMemo(() => countRows(monthRows), [monthRows]);
  const pct = pctOf(counts);
  const prevPeriod = months.length > 1 ? months[months.length - 2] : null;
  const prevPct = prevPeriod ? pctOf(countRows(scoped.filter((r) => r.period === prevPeriod))) : null;
  const lateRows = monthRows.filter((r) => r.outcome === "tarde" || r.outcome === "vencida");
  const avgLate = lateRows.length
    ? Math.round((lateRows.reduce((s, r) => s + r.daysLate, 0) / lateRows.length) * 10) / 10
    : null;

  const agreementOf = (p: string, per: string) => agreements.find((a) => a.person === p && a.period === per) ?? null;
  const target = person ? agreementOf(person, period)?.target_pct ?? null : null;

  const trend = months.map((p) => {
    const c = countRows(scoped.filter((r) => r.period === p));
    return {
      period: p,
      pct: pctOf(c),
      aTiempo: c.a_tiempo,
      base: c.a_tiempo + c.tarde + c.vencida,
      target: person ? agreementOf(person, p)?.target_pct ?? null : null,
    };
  });

  const byPerson = people.map((p) => ({
    label: p,
    counts: countRows(rows.filter((r) => r.period === period && r.person === p && (!module || (r.module || "Otros") === module))),
  }));
  const byModule = modules.map((m) => ({
    label: m,
    counts: countRows(monthRows.filter((r) => (r.module || "Otros") === m)),
  }));
  const dependencies = (() => {
    const map = new Map<string, number>();
    for (const r of monthRows) {
      if (r.outcome !== "bloqueada") continue;
      const who = r.waitingFor.trim() || "Sin detalle";
      map.set(who, (map.get(who) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n }));
  })();

  const excludedCount = excluded.filter((e) => (!person || e.person === person) && (!module || e.module === module)).length;
  const filtered = person || module || outcome;
  const teamView = seesAll && !person;

  return (
    <div className="space-y-5">
      {/* Filtros: una sola fila, arriba de todo lo que afectan */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        {seesAll && (
          <label className="text-xs font-semibold text-slate-500">
            Persona
            <select
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              className="mt-1 block min-w-48 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-700 focus:border-brand-cyan focus:outline-none"
            >
              <option value="">Todo el equipo</option>
              {people.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs font-semibold text-slate-500">
          Proceso
          <select
            value={module}
            onChange={(e) => setModule(e.target.value)}
            className="mt-1 block min-w-44 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-700 focus:border-brand-cyan focus:outline-none"
          >
            <option value="">Todos</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Estado
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as DashOutcome | "")}
            className="mt-1 block min-w-44 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-700 focus:border-brand-cyan focus:outline-none"
          >
            <option value="">Todos</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {LABEL[o]}
              </option>
            ))}
          </select>
        </label>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              if (seesAll) setPerson("");
              setModule("");
              setOutcome("");
            }}
            className="rounded-md px-2 py-1.5 text-sm font-medium text-brand-navy hover:bg-slate-100"
          >
            Quitar filtros
          </button>
        )}
        <p className="ml-auto self-center text-xs text-slate-400">
          {person || "Todo el equipo"} · {module || "todos los procesos"} · <span className="capitalize">{periodLabel(period)}</span>
        </p>
      </div>

      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <HeroTile pct={pct} prevPct={prevPct} prevLabel={prevPeriod ? shortPeriodLabel(prevPeriod) : ""} counts={counts} target={target} trend={trend} />
        <StatTile
          label="Tareas del mes"
          value={total(counts)}
          note={`${counts.por_vencer} en plazo`}
          active={outcome === ""}
          onClick={() => setOutcome("")}
        />
        <StatTile
          label={LABEL.tarde}
          value={counts.tarde}
          note={avgLate !== null ? `Retraso promedio: ${avgLate} ${avgLate === 1 ? "día hábil" : "días hábiles"}` : "Cerradas después de su fecha"}
          swatch={COLOR.tarde}
          active={outcome === "tarde"}
          onClick={() => setOutcome(outcome === "tarde" ? "" : "tarde")}
        />
        <StatTile
          label={LABEL.vencida}
          value={counts.vencida}
          note="Abiertas después de su fecha"
          swatch={COLOR.vencida}
          active={outcome === "vencida"}
          onClick={() => setOutcome(outcome === "vencida" ? "" : "vencida")}
        />
        <StatTile
          label={LABEL.bloqueada}
          value={counts.bloqueada}
          note="No entran al porcentaje"
          swatch={COLOR.bloqueada}
          active={outcome === "bloqueada"}
          onClick={() => setOutcome(outcome === "bloqueada" ? "" : "bloqueada")}
        />
      </div>

      {/* Tendencia y carga semanal */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title="Cumplimiento a tiempo por mes"
          subtitle="Porcentaje de tareas cerradas en su fecha compromiso, últimos seis meses."
        >
          <TrendChart points={trend} />
        </Card>
        <Card className="lg:col-span-2" title="Tareas por semana" subtitle="Según su fecha compromiso dentro del mes.">
          <Legend />
          <WeekChart period={period} rows={monthRows} />
        </Card>
      </div>

      {/* Desglose */}
      <div className="grid gap-4 lg:grid-cols-2">
        {teamView ? (
          <Card title="Por persona" subtitle="Clic en una persona para ver su detalle.">
            <Legend />
            <StackedRows rows={byPerson} onPick={(p) => setPerson(p)} empty="Sin tareas en este periodo." />
          </Card>
        ) : (
          <AgreementCard
            period={period}
            person={person}
            agreement={agreementOf(person, period)}
            editable={seesAll}
            isMe={person === me}
            ready={agreementsReady}
          />
        )}
        <Card title="Por proceso" subtitle="Clic en un proceso para filtrar.">
          <Legend />
          <StackedRows rows={byModule} onPick={(m) => setModule(m === module ? "" : m)} empty="Sin tareas en este periodo." />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Dependencias externas" subtitle="Tareas en espera de terceros y de qué dependen.">
          <DependencyBars items={dependencies} />
        </Card>
        {teamView ? (
          <AgreementsOverview
            period={period}
            people={people}
            agreementOf={(p) => agreementOf(p, period)}
            ready={agreementsReady}
            onPick={(p) => setPerson(p)}
          />
        ) : (
          <Card title="Resumen" subtitle={`${person} · ${periodLabel(period)}`}>
            <SummaryTable rows={[{ label: person, counts }]} />
          </Card>
        )}
      </div>

      <TaskList rows={monthRows} outcome={outcome} setOutcome={setOutcome} showPerson={teamView} />

      {teamView && (
        <details className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-brand-navy">Ver resumen en tabla</summary>
          <div className="mt-3">
            <SummaryTable rows={byPerson} />
          </div>
        </details>
      )}

      {excludedCount > 0 && (
        <p className="text-xs text-slate-400">
          {plural(excludedCount, "tarea del periodo no se considera", "tareas del periodo no se consideran")} en el
          indicador (ver metodología).
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Piezas

function Card({
  title,
  subtitle,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h2 className="text-base font-bold text-brand-navy">{title}</h2>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Legend({ items = OUTCOMES }: { items?: DashOutcome[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
      {items.map((o) => (
        <span key={o} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[o] }} />
          {LABEL[o]}
        </span>
      ))}
    </div>
  );
}

function Tooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
      style={{ left: x, top: y - 8 }}
    >
      {children}
    </div>
  );
}

function TipRow({ color, label, value }: { color?: string; label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-500">
        {color && <span className="inline-block h-0.5 w-3 rounded" style={{ background: color }} />}
        {label}
      </span>
      <span className="font-semibold tabular-nums text-slate-900">{value}</span>
    </div>
  );
}

function Sparkline({ values }: { values: (number | null)[] }) {
  const W = 120;
  const H = 32;
  const n = values.length;
  const pts = values.map((v, i) => (v === null ? null : { x: (i / Math.max(1, n - 1)) * (W - 8) + 4, y: 4 + (H - 8) * (1 - v / 100) }));
  const known = pts.filter((p): p is { x: number; y: number } => p !== null);
  if (known.length === 0) return null;
  const last = pts[n - 1];
  return (
    <svg width={W} height={H} aria-hidden="true">
      <polyline points={known.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={AXIS} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={last.x} cy={last.y} r={4} fill={LINE} stroke="#fff" strokeWidth={2} />}
    </svg>
  );
}

function HeroTile({
  pct,
  prevPct,
  prevLabel,
  counts,
  target,
  trend,
}: {
  pct: number | null;
  prevPct: number | null;
  prevLabel: string;
  counts: Counts;
  target: number | null;
  trend: { pct: number | null }[];
}) {
  const base = counts.a_tiempo + counts.tarde + counts.vencida;
  const delta = pct !== null && prevPct !== null ? pct - prevPct : null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2">
      <p className="text-sm font-semibold text-slate-500">Cumplimiento a tiempo</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div>
          <p className="text-5xl font-bold text-brand-navy">{pct === null ? "—" : `${pct}%`}</p>
          <p className="mt-1 text-sm text-slate-500">
            {base === 0 ? "Aún no hay tareas evaluadas en el periodo." : `${counts.a_tiempo} de ${base} tareas evaluadas`}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
            {delta !== null && (
              <span className={delta >= 0 ? "font-semibold text-[#006300]" : "font-semibold text-[#9a3412]"}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} pts vs {prevLabel}
              </span>
            )}
            {target !== null && <span className="text-slate-500">Meta acordada: {target}%</span>}
          </div>
        </div>
        <Sparkline values={trend.map((t) => t.pct)} />
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  note,
  swatch,
  active,
  onClick,
}: {
  label: string;
  value: number;
  note: string;
  swatch?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-brand-cyan ${
        active ? "border-brand-cyan ring-2 ring-brand-cyan/20" : "border-slate-200"
      }`}
    >
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500">
        {swatch && <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: swatch }} />}
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold text-brand-navy">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Gráficas

function TrendChart({
  points,
}: {
  points: { period: string; pct: number | null; aTiempo: number; base: number; target: number | null }[];
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 230;
  const padL = 44;
  const padR = 20;
  const padT = 18;
  const padB = 30;
  const innerW = Math.max(0, w - padL - padR);
  const innerH = H - padT - padB;
  const n = points.length;
  const band = n ? innerW / n : 0;
  const x = (i: number) => padL + band * i + band / 2;
  const y = (v: number) => padT + innerH * (1 - v / 100);

  // Tramos de meses consecutivos con dato (un mes sin tareas corta la línea)
  const segments: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    if (p.pct === null) {
      if (cur.length) segments.push(cur);
      cur = [];
    } else cur.push({ i, v: p.pct });
  });
  if (cur.length) segments.push(cur);
  const lastIdx = [...points.keys()].reverse().find((i) => points[i].pct !== null);
  const anyTarget = points.some((p) => p.target !== null);
  const empty = points.every((p) => p.pct === null);

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      {anyTarget && (
        <div className="mb-2 flex gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: LINE }} />
            Cumplimiento
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: TARGET }} />
            Meta acordada
          </span>
        </div>
      )}
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-label="Cumplimiento a tiempo por mes">
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
              <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} className="tabular-nums">
                {t}%
              </text>
            </g>
          ))}
          {points.map((p, i) => (
            <text key={p.period} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={MUTED} className="capitalize">
              {shortPeriodLabel(p.period)}
            </text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH} stroke={AXIS} strokeWidth={1} />}
          {segments.map((seg, k) => (
            <g key={k}>
              {seg.length > 1 && (
                <path
                  d={`M${x(seg[0].i)},${y(0)} ${seg.map((s) => `L${x(s.i)},${y(s.v)}`).join(" ")} L${x(seg[seg.length - 1].i)},${y(0)} Z`}
                  fill={LINE}
                  opacity={0.08}
                />
              )}
              <polyline
                points={seg.map((s) => `${x(s.i)},${y(s.v)}`).join(" ")}
                fill="none"
                stroke={LINE}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          ))}
          {points.map((p, i) =>
            p.target !== null ? (
              <line key={`t${i}`} x1={x(i) - 14} x2={x(i) + 14} y1={y(p.target)} y2={y(p.target)} stroke={TARGET} strokeWidth={2} strokeLinecap="round" />
            ) : null
          )}
          {points.map((p, i) =>
            p.pct !== null ? (
              <circle key={`c${i}`} cx={x(i)} cy={y(p.pct)} r={hover === i ? 5 : 4} fill={LINE} stroke="#fff" strokeWidth={2} />
            ) : null
          )}
          {lastIdx !== undefined && points[lastIdx].pct !== null && (
            <text x={x(lastIdx)} y={y(points[lastIdx].pct!) - 12} textAnchor="middle" fontSize={12} fontWeight={600} fill="#0b0b0b">
              {points[lastIdx].pct}%
            </text>
          )}
          {points.map((p, i) => (
            <rect
              key={`h${i}`}
              x={padL + band * i}
              y={padT}
              width={band}
              height={innerH}
              fill="transparent"
              tabIndex={0}
              aria-label={`${periodLabel(p.period)}: ${p.pct === null ? "sin tareas evaluadas" : `${p.pct}%`}`}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          ))}
        </svg>
      )}
      {empty && w > 0 && (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-slate-400">
          Aún no hay tareas evaluadas en estos meses.
        </p>
      )}
      {hover !== null && w > 0 && (
        <Tooltip x={Math.min(Math.max(x(hover), 80), w - 80)} y={points[hover].pct !== null ? y(points[hover].pct!) : padT + innerH / 2}>
          <p className="mb-1 font-semibold capitalize text-slate-700">{periodLabel(points[hover].period)}</p>
          <TipRow color={LINE} label="Cumplimiento" value={points[hover].pct === null ? "—" : `${points[hover].pct}%`} />
          <TipRow label="A tiempo" value={`${points[hover].aTiempo} de ${points[hover].base}`} />
          {points[hover].target !== null && <TipRow color={TARGET} label="Meta acordada" value={`${points[hover].target}%`} />}
        </Tooltip>
      )}
    </div>
  );
}

/** Rectángulo con las esquinas de arriba redondeadas (punta de la columna). */
function topRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const step = Math.ceil(v / 4);
  return step * 4;
}

function WeekChart({ period, rows }: { period: string; rows: DashRow[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const weeks = weeksOfMonth(period);
  const data = weeks.map((wk) => countRows(rows.filter((r) => r.deadline >= wk.start && r.deadline <= wk.end)));
  const max = niceMax(Math.max(0, ...data.map(total)));
  const H = 230;
  const padL = 32;
  const padR = 8;
  const padT = 22;
  const padB = 30;
  const innerW = Math.max(0, w - padL - padR);
  const innerH = H - padT - padB;
  const band = weeks.length ? innerW / weeks.length : 0;
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => padT + innerH * (1 - v / max);
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-label="Tareas por semana del mes">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
              <text x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} className="tabular-nums">
                {t}
              </text>
            </g>
          ))}
          {weeks.map((wk, i) => {
            const cx = padL + band * i + band / 2;
            const c = data[i];
            const tot = total(c);
            let cum = 0;
            const present = OUTCOMES.filter((o) => c[o] > 0);
            return (
              <g key={wk.start} opacity={hover === null || hover === i ? 1 : 0.55}>
                {present.map((o, k) => {
                  const yTop = y(cum + c[o]);
                  let yBot = y(cum);
                  if (k > 0) yBot -= 2; // 2px de separación entre segmentos
                  cum += c[o];
                  const h = yBot - yTop;
                  if (h <= 0) return null;
                  const isTop = k === present.length - 1;
                  return isTop ? (
                    <path key={o} d={topRoundedRect(cx - barW / 2, yTop, barW, h, 4)} fill={COLOR[o]} />
                  ) : (
                    <rect key={o} x={cx - barW / 2} y={yTop} width={barW} height={h} fill={COLOR[o]} />
                  );
                })}
                {tot > 0 && (
                  <text x={cx} y={y(tot) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0b0b0b">
                    {tot}
                  </text>
                )}
                <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill={MUTED}>
                  {wk.label}
                </text>
                <rect
                  x={padL + band * i}
                  y={padT}
                  width={band}
                  height={innerH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`Semana ${wk.label}: ${tot} tareas`}
                  onPointerEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && w > 0 && (
        <Tooltip x={Math.min(Math.max(padL + band * hover + band / 2, 80), w - 80)} y={y(total(data[hover]))}>
          <p className="mb-1 font-semibold text-slate-700">Semana {weeks[hover].label}</p>
          {OUTCOMES.map((o) => (data[hover][o] > 0 ? <TipRow key={o} color={COLOR[o]} label={LABEL[o]} value={data[hover][o]} /> : null))}
          <TipRow label="Total" value={total(data[hover])} />
        </Tooltip>
      )}
    </div>
  );
}

function StackedRows({
  rows,
  onPick,
  empty,
}: {
  rows: { label: string; counts: Counts }[];
  onPick?: (label: string) => void;
  empty: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; label: string; o: DashOutcome; n: number; tot: number } | null>(null);
  const visible = rows.filter((r) => total(r.counts) > 0);
  const max = Math.max(1, ...visible.map((r) => total(r.counts)));
  if (visible.length === 0) return <p className="text-sm italic text-slate-400">{empty}</p>;

  return (
    <div ref={boxRef} className="relative space-y-2" onPointerLeave={() => setTip(null)}>
      {visible.map((r) => {
        const tot = total(r.counts);
        const pct = pctOf(r.counts);
        return (
          <button
            key={r.label}
            type="button"
            onClick={() => onPick?.(r.label)}
            className="grid w-full grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-3 rounded-md px-1 py-1 text-left hover:bg-slate-50"
          >
            <span className="truncate text-sm text-slate-700">{r.label}</span>
            <span className="flex h-5 items-center">
              <span className="flex h-4 gap-[2px]" style={{ width: `${(tot / max) * 100}%` }}>
                {OUTCOMES.filter((o) => r.counts[o] > 0).map((o, i, arr) => (
                  <span
                    key={o}
                    className={`h-full ${i === arr.length - 1 ? "rounded-r" : ""}`}
                    style={{ flexGrow: r.counts[o], flexBasis: 0, background: COLOR[o], minWidth: 3 }}
                    onPointerMove={(e) => {
                      const box = boxRef.current?.getBoundingClientRect();
                      if (!box) return;
                      setTip({ x: e.clientX - box.left, y: e.clientY - box.top, label: r.label, o, n: r.counts[o], tot });
                    }}
                  />
                ))}
              </span>
            </span>
            <span className="text-right text-sm tabular-nums text-slate-500">
              {tot}
              {pct !== null && <span className="ml-1 text-xs text-slate-400">· {pct}%</span>}
            </span>
          </button>
        );
      })}
      {tip && (
        <Tooltip x={tip.x} y={tip.y}>
          <p className="mb-1 font-semibold text-slate-700">{tip.label}</p>
          <TipRow color={COLOR[tip.o]} label={LABEL[tip.o]} value={tip.n} />
          <TipRow label="Total del mes" value={tip.tot} />
        </Tooltip>
      )}
    </div>
  );
}

function DependencyBars({ items }: { items: { label: string; n: number }[] }) {
  if (items.length === 0) return <p className="text-sm italic text-slate-400">Sin tareas en espera de terceros en este periodo.</p>;
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div className="space-y-2">
      {items.slice(0, 8).map((i) => (
        <div key={i.label} className="grid grid-cols-[minmax(0,12rem)_1fr_2rem] items-center gap-3">
          <span className="truncate text-sm text-slate-700" title={i.label}>
            {i.label}
          </span>
          <span className="flex h-4 items-center">
            <span className="h-4 rounded-r" style={{ width: `${(i.n / max) * 100}%`, background: COLOR.bloqueada, minWidth: 3 }} />
          </span>
          <span className="text-right text-sm tabular-nums text-slate-500">{i.n}</span>
        </div>
      ))}
    </div>
  );
}

function SummaryTable({ rows }: { rows: { label: string; counts: Counts }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400">
            <th className="py-1 pr-2 font-semibold">Persona</th>
            {OUTCOMES.map((o) => (
              <th key={o} className="px-2 py-1 text-right font-semibold">
                {LABEL[o]}
              </th>
            ))}
            <th className="py-1 pl-2 text-right font-semibold">Cumplimiento</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = pctOf(r.counts);
            return (
              <tr key={r.label} className="border-t border-slate-100">
                <td className="py-1.5 pr-2 text-slate-700">{r.label}</td>
                {OUTCOMES.map((o) => (
                  <td key={o} className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                    {r.counts[o]}
                  </td>
                ))}
                <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-brand-navy">{pct === null ? "—" : `${pct}%`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Acuerdos por persona

function AgreementCard({
  period,
  person,
  agreement,
  editable,
  isMe,
  ready,
}: {
  period: string;
  person: string;
  agreement: PersonAgreement | null;
  editable: boolean;
  isMe: boolean;
  ready: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <Card title={`Acuerdos de ${periodLabel(period)}`} subtitle={person}>
      {!ready ? (
        <p className="text-sm text-amber-700">Para registrar acuerdos por persona falta correr la migración 025 en la base.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-400">Prioridades y entregables del mes</p>
            {editable ? (
              <EditableField
                value={agreement?.body ?? ""}
                onSave={(v) => updatePersonAgreementAction(period, person, "body", v)}
                multiline
                rows={4}
                placeholder="Prioridades, entregables clave y consideraciones del mes (vacaciones, cargas especiales…)"
              />
            ) : agreement?.body ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700">{agreement.body}</p>
            ) : (
              <p className="text-sm italic text-slate-400">Sin acuerdos registrados para este mes.</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-slate-400">Meta de cumplimiento a tiempo</p>
            {editable ? (
              <span className="inline-flex w-24 items-center gap-1">
                <EditableField
                  value={agreement?.target_pct?.toString() ?? ""}
                  onSave={(v) => updatePersonAgreementAction(period, person, "target_pct", v)}
                  type="number"
                  placeholder="—"
                />
                <span className="text-sm text-slate-500">%</span>
              </span>
            ) : (
              <span className="text-sm font-semibold text-brand-navy">
                {agreement?.target_pct != null ? `${agreement.target_pct}%` : "Sin meta definida"}
              </span>
            )}
          </div>
          {agreement && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-400">
              <span>
                {agreement.updated_by ? `Registrado por ${agreement.updated_by}` : "Registrado"}
                {agreement.updated_at ? ` el ${formatDate(mexicoDate(agreement.updated_at))}` : ""}
              </span>
              {agreement.acknowledged_at ? (
                <span className="font-semibold text-[#006300]">✓ Enterado el {formatDate(mexicoDate(agreement.acknowledged_at))}</span>
              ) : isMe ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await acknowledgeAgreementAction(period);
                      setError(res?.error ?? "");
                    })
                  }
                  className="rounded-md bg-gradient-to-r from-brand-cyan to-brand-magenta px-3 py-1 text-xs font-semibold text-white shadow disabled:opacity-50"
                >
                  Enterado
                </button>
              ) : (
                <span>Pendiente de acuse</span>
              )}
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </Card>
  );
}

function AgreementsOverview({
  period,
  people,
  agreementOf,
  ready,
  onPick,
}: {
  period: string;
  people: string[];
  agreementOf: (person: string) => PersonAgreement | null;
  ready: boolean;
  onPick: (person: string) => void;
}) {
  return (
    <Card title={`Acuerdos de ${periodLabel(period)}`} subtitle="Por persona. Clic para ver o registrar.">
      {!ready ? (
        <p className="text-sm text-amber-700">Para registrar acuerdos por persona falta correr la migración 025 en la base.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="py-1 font-semibold">Persona</th>
              <th className="py-1 text-right font-semibold">Meta</th>
              <th className="py-1 text-right font-semibold">Acuse</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const a = agreementOf(p);
              return (
                <tr key={p} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => onPick(p)}>
                  <td className="py-1.5 text-slate-700">{p}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-600">{a?.target_pct != null ? `${a.target_pct}%` : "—"}</td>
                  <td className="py-1.5 text-right text-xs">
                    {!a ? (
                      <span className="text-slate-400">Sin acuerdos</span>
                    ) : a.acknowledged_at ? (
                      <span className="font-semibold text-[#006300]">✓ Enterado</span>
                    ) : (
                      <span className="text-slate-500">Pendiente</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tareas

const ORDER: Record<DashOutcome, number> = { vencida: 0, tarde: 1, bloqueada: 2, por_vencer: 3, a_tiempo: 4 };

function TaskList({
  rows,
  outcome,
  setOutcome,
  showPerson,
}: {
  rows: DashRow[];
  outcome: DashOutcome | "";
  setOutcome: (o: DashOutcome | "") => void;
  showPerson: boolean;
}) {
  const [limit, setLimit] = useState(30);
  const list = rows
    .filter((r) => !outcome || r.outcome === outcome)
    .sort((a, b) => ORDER[a.outcome] - ORDER[b.outcome] || a.deadline.localeCompare(b.deadline));
  const counts = countRows(rows);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-brand-navy">Tareas del mes</h2>
          <p className="text-xs text-slate-400">Primero las que requieren seguimiento. Clic en un estado para filtrar.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {OUTCOMES.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={outcome === o}
              onClick={() => setOutcome(outcome === o ? "" : o)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                outcome === o ? "border-brand-navy bg-brand-navy text-white" : "border-slate-200 text-slate-600 hover:border-brand-cyan"
              }`}
            >
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR[o] }} />
              {LABEL[o]} · {counts[o]}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="mt-4 text-sm italic text-slate-400">No hay tareas con estos filtros.</p>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {list.slice(0, limit).map((r) => (
            <TaskItem key={r.key} row={r} showPerson={showPerson} />
          ))}
        </div>
      )}
      {list.length > limit && (
        <button
          type="button"
          onClick={() => setLimit(limit + 30)}
          className="mt-3 text-sm font-medium text-brand-navy hover:underline"
        >
          Ver más ({list.length - limit} restantes)
        </button>
      )}
    </section>
  );
}

function TaskItem({ row, showPerson }: { row: DashRow; showPerson: boolean }) {
  const needsComment = row.outcome === "tarde" || row.outcome === "vencida" || row.outcome === "bloqueada";
  return (
    <div className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={row.href || "/tareas"} className="text-sm font-medium text-slate-800 hover:text-brand-cyan hover:underline">
            {row.title}
          </Link>
          <p className="text-xs text-slate-400">
            {[showPerson ? row.person : "", row.module, row.project, row.client].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR[row.outcome] }} />
          {LABEL[row.outcome]}
          {row.daysLate > 0 ? ` · ${row.daysLate} ${row.daysLate === 1 ? "día hábil" : "días hábiles"}` : ""}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Fecha compromiso: {formatDate(row.deadline)}
        {row.closedAt ? ` · cerrada el ${formatDate(row.closedAt)}` : row.outcome !== "por_vencer" ? " · abierta" : ""}
      </p>
      {row.waitingSince && (
        <p className="mt-1 text-xs text-slate-500">
          <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: COLOR.bloqueada }} />
          En espera desde el {formatDate(row.waitingSince)}
          {row.waitingFor ? ` · depende de: ${row.waitingFor}` : ""}
        </p>
      )}
      {needsComment && (
        <div className="mt-2 max-w-3xl">
          <p className="text-[11px] font-semibold text-slate-400">Comentario del responsable</p>
          {row.canComment ? (
            <EditableField
              value={row.context}
              onSave={(v) => updateLedgerContextAction(row.key, v)}
              multiline
              rows={2}
              placeholder="Contexto de la tarea (p. ej. el cliente envió la información el lunes)"
            />
          ) : row.context ? (
            <p className="text-sm text-slate-700">{row.context}</p>
          ) : (
            <p className="text-sm italic text-slate-400">Sin comentarios.</p>
          )}
          {row.context && row.contextBy && (
            <p className="text-[11px] text-slate-400">
              {row.contextBy}
              {row.contextAt ? ` · ${formatDate(mexicoDate(row.contextAt))}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
