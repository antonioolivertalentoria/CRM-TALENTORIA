import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadMarketingData } from "@/lib/marketing-data";
import { computeMarketingTasks } from "@/lib/marketing-tasks";
import {
  addMonths,
  indexSteps,
  monthLabel,
  periodOf,
  resolveMailingMonth,
  resolveSeoBase,
  resolveSeoPage,
  type ResolvedStep,
} from "@/lib/marketing-flows";
import {
  MARKETING_COLLABORATOR,
  MARKETING_DIRECTOR,
  MARKETING_OWNER,
  statusColor,
} from "@/lib/constants";
import { addDays, formatDate, todayISO } from "@/lib/format";
import { NewMarketingProjectForm } from "@/components/MarketingSections";
import type { MarketingProject, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

/** El siguiente paso abierto (el que vence primero). */
function nextOpen(steps: ResolvedStep[]): ResolvedStep | undefined {
  return steps
    .filter((s) => !s.done && !s.locked && !s.beforeStart && !s.mirrorOf && s.due)
    .sort((a, b) => (a.due! < b.due! ? -1 : 1))[0];
}

/**
 * Módulo de Marketing: los mapas de Mailing (proyecto recurrente mensual) y
 * de SEO y páginas. Cada proyecto muestra su próximo paso; las tareas con
 * SLA se generan solas en "Mis tareas".
 */
export default async function MarketingPage() {
  const supabase = await createClient();
  const today = todayISO();

  const [{ error }, data, { data: profilesData }] = await Promise.all([
    supabase.from("marketing_projects").select("id").limit(1),
    loadMarketingData(supabase),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  const people = ((profilesData ?? []) as Pick<Profile, "full_name">[]).map((p) => p.full_name);
  const rows = indexSteps(data.steps);
  const tasks = computeMarketingTasks(data);

  // Tareas abiertas de marketing por persona
  const byPerson: Record<string, { total: number; overdue: number }> = {};
  for (const t of tasks) {
    const k = t.assignee || "Sin asignar";
    byPerson[k] ??= { total: 0, overdue: 0 };
    byPerson[k].total++;
    if (t.due && t.due < today) byPerson[k].overdue++;
  }

  const weekAgo = addDays(today, -7);
  const recentLeads = data.leads.filter((l) => l.lead_date >= weekAgo);
  const pendingOpps = data.leads.filter(
    (l) => l.lead_type === "Oportunidad comercial" && !l.duplicate && !l.sent_to_commercial
  );

  const thisMonth = periodOf(today);

  const card = (p: MarketingProject) => {
    if (p.kind === "Mailing") {
      const current = resolveMailingMonth(p, thisMonth, rows, today);
      const next = resolveMailingMonth(p, addMonths(thisMonth, 1), rows, today);
      const step = nextOpen([...current, ...next]);
      const sends = data.sends.filter((s) => s.project_id === p.id && s.period === thisMonth);
      const sent = sends.filter((s) => s.status === "Enviado" || s.status === "Reportado").length;
      const plan = next.find((s) => s.def.id === "s5");
      return (
        <>
          <p className="mt-2 text-xs text-slate-500">
            📬 {monthLabel(thisMonth)}: {sent} de {sends.length} envíos salieron
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            🗓️ Plan de {monthLabel(addMonths(thisMonth, 1))}:{" "}
            {plan?.done ? "aprobado ✓" : plan?.rounds ? `en ronda ${plan.rounds + 1}` : "por aprobar"}
          </p>
          {step && (
            <p className="mt-2 text-xs font-medium text-slate-700">
              Sigue: {step.def.title} · {step.assignee} ·{" "}
              <span className={step.due! < today ? "text-red-600" : ""}>{formatDate(step.due)}</span>
            </p>
          )}
        </>
      );
    }
    const pages = data.pages.filter((x) => x.project_id === p.id);
    const closed = pages.filter((x) => x.status === "Cerrada").length;
    const base = resolveSeoBase(p, rows, today);
    const transfer = base.filter((s) => s.def.transfer);
    const pageSteps = pages.filter((x) => x.status === "En curso").flatMap((x) => resolveSeoPage(p, x, rows, today));
    const step = nextOpen([...base, ...pageSteps]);
    return (
      <>
        <p className="mt-2 text-xs text-slate-500">
          🌐 Páginas: {closed} cerradas de {pages.length} · objetivo 2026: team building, NOM 035 y LEGO en CDMX
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          🎓 Transferencia: {transfer.filter((s) => s.done).length} de {transfer.length} hitos
        </p>
        {step && (
          <p className="mt-2 text-xs font-medium text-slate-700">
            Sigue: {step.def.title} · {step.assignee} ·{" "}
            <span className={step.due! < today ? "text-red-600" : ""}>{formatDate(step.due)}</span>
          </p>
        )}
      </>
    );
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Marketing</h1>
          <p className="text-sm text-slate-500">
            Mailing (proyecto recurrente mensual) y SEO y páginas, según sus mapas de proceso. Las tareas con
            SLA se generan solas en &quot;Mis tareas&quot;.
          </p>
        </div>
        <NewMarketingProjectForm
          people={people}
          defaults={{ owner: MARKETING_OWNER, director: MARKETING_DIRECTOR, collaborator: MARKETING_COLLABORATOR }}
          thisMonth={today.slice(0, 7)}
          nextMonth={addMonths(thisMonth, 1).slice(0, 7)}
        />
      </header>

      {error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Para activar el módulo de marketing falta correr la migración 021 en Supabase.
        </p>
      )}

      {!error && data.projects.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-slate-600">Aún no hay proyectos de marketing</p>
          <p className="mt-1 text-sm text-slate-400">
            Usa &quot;+ Nuevo proyecto&quot;: uno de Mailing (se trabaja mes a mes) y uno de SEO. Al crearlos nacen
            solos sus pasos, con responsable y fecha.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.projects.map((p) => (
            <Link
              key={p.id}
              href={`/marketing/${p.id}`}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-magenta hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-magenta">{p.kind}</p>
                  <p className="text-lg font-semibold text-brand-navy">{p.name}</p>
                </div>
                <span className={`${statusColor(p.status)} shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white`}>
                  {p.status}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {p.owner} · {p.director} · {p.collaborator}
              </p>
              {card(p)}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Link
          href="/marketing/leads"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-magenta hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-brand-magenta">Leads</p>
          <p className="text-lg font-semibold text-brand-navy">Suscriptores y oportunidades</p>
          <p className="mt-2 text-xs text-slate-500">
            {recentLeads.length} registrados en los últimos 7 días · {data.leads.length} en total
          </p>
          <p className={`mt-0.5 text-xs ${pendingOpps.length ? "font-semibold text-brand-magenta" : "text-slate-500"}`}>
            {pendingOpps.length
              ? `${pendingOpps.length} oportunidad${pendingOpps.length === 1 ? "" : "es"} por pasar a Comercial`
              : "Ninguna oportunidad pendiente de pasar a Comercial"}
          </p>
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-magenta">Tareas abiertas</p>
          {Object.keys(byPerson).length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Sin tareas de marketing por ahora.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {Object.entries(byPerson)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([person, c]) => (
                  <li key={person} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{person}</span>
                    <span className="text-xs text-slate-500">
                      {c.total} tarea{c.total === 1 ? "" : "s"}
                      {c.overdue > 0 && <span className="ml-1 font-semibold text-red-600">· {c.overdue} vencidas</span>}
                    </span>
                  </li>
                ))}
            </ul>
          )}
          <Link href="/tareas" className="mt-3 inline-block text-xs font-semibold text-brand-cyan-dark hover:underline">
            Ver en Mis tareas →
          </Link>
        </div>
      </div>
    </div>
  );
}
