import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MARKETING_DIRECTOR } from "@/lib/constants";
import { addDays, formatDate, todayISO } from "@/lib/format";
import { LeadsSection } from "@/components/MarketingLeads";
import type { MarketingLead, MarketingProject, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Lunes de la semana de una fecha. */
function mondayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

function countBy(list: MarketingLead[], key: (l: MarketingLead) => string): [string, number][] {
  const map = new Map<string, number>();
  for (const l of list) {
    const k = key(l) || "Sin dato";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * Leads de marketing: el registro continuo del paso 10 y el resumen que
 * alimenta el reporte semanal de cada lunes (paso 11): suscripciones, altas
 * por fuente y segmento, acciones comerciales, duplicados y seguimiento.
 */
export default async function MarketingLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { semana } = await searchParams;
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: leadsData, error }, { data: projectsData }, { data: profilesData }] = await Promise.all([
    supabase.from("marketing_leads").select("*").order("lead_date", { ascending: false }),
    supabase.from("marketing_projects").select("id, name, kind, director"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  const leads = (leadsData ?? []) as unknown as MarketingLead[];
  const projects = (projectsData ?? []) as unknown as Pick<MarketingProject, "id" | "name" | "kind" | "director">[];
  const people = ((profilesData ?? []) as unknown as Pick<Profile, "full_name">[]).map((p) => p.full_name);
  const director = projects.find((p) => p.kind === "Mailing")?.director || MARKETING_DIRECTOR;

  // Semana del reporte: el lunes, la semana previa (la que se entrega hoy);
  // los demás días, la semana en curso (la que se reporta el próximo lunes).
  const isMonday = mondayOf(today) === today;
  const weekStart =
    typeof semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(semana)
      ? mondayOf(semana)
      : isMonday
        ? addDays(today, -7)
        : mondayOf(today);
  const weekEnd = addDays(weekStart, 6);
  const week = leads.filter((l) => l.lead_date >= weekStart && l.lead_date <= weekEnd);
  const subs = week.filter((l) => l.lead_type === "Suscripción" && !l.duplicate);
  const opps = week.filter((l) => l.lead_type === "Oportunidad comercial" && !l.duplicate);
  const dups = week.filter((l) => l.duplicate);
  const followUp = leads.filter(
    (l) => l.lead_type === "Oportunidad comercial" && !l.duplicate && (!l.sent_to_commercial || !l.next_step)
  );

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-400">
        <Link href="/marketing" className="hover:text-brand-cyan-dark hover:underline">
          Marketing
        </Link>{" "}
        / <span className="text-slate-600">Leads</span>
      </nav>

      <header>
        <h1 className="text-2xl font-bold text-brand-navy">Suscriptores y leads</h1>
        <p className="text-sm text-slate-500">
          El reporte de cada lunes distingue suscripción de oportunidad comercial. Las oportunidades pasan a{" "}
          {director} por el canal de Slack de marketing y, mientras no se marquen como enviadas, son tarea.
        </p>
      </header>

      {error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Para activar el módulo de marketing falta correr la migración 021 en Supabase.
        </p>
      )}

      {/* Resumen para el reporte semanal (paso 11) */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Resumen para el reporte semanal</h2>
            <p className="text-xs text-slate-400">
              Semana del {formatDate(weekStart)} al {formatDate(weekEnd)}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Link href={`/marketing/leads?semana=${addDays(weekStart, -7)}`} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-600 hover:border-brand-cyan">
              ← Anterior
            </Link>
            <Link href={`/marketing/leads?semana=${addDays(weekStart, 7)}`} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-600 hover:border-brand-cyan">
              Siguiente →
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Nuevas suscripciones" value={subs.length} />
          <Stat label="Oportunidades comerciales" value={opps.length} accent />
          <Stat label="Duplicados depurados" value={dups.length} />
          <Stat label="Seguimiento pendiente (todas)" value={followUp.length} />
        </div>

        {week.length > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Breakdown title="Altas por fuente" rows={countBy(week.filter((l) => !l.duplicate), (l) => l.source)} />
            <Breakdown title="Altas por segmento" rows={countBy(week.filter((l) => !l.duplicate), (l) => l.segment)} />
            <Breakdown
              title="Acciones comerciales"
              rows={countBy(opps, (l) => l.commercial_action || (l.sent_to_commercial ? "Pasado a Comercial" : "Sin acción aún"))}
            />
          </div>
        )}
      </section>

      <LeadsSection
        leads={leads}
        projects={projects.map((p) => ({ id: p.id, name: p.name, kind: p.kind }))}
        people={people}
        today={today}
        director={director}
      />
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${accent ? "text-brand-magenta" : "text-brand-navy"}`}>{value}</p>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-slate-400">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-300">—</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map(([k, n]) => (
            <li key={k} className="flex justify-between text-xs text-slate-600">
              <span className="truncate">{k}</span>
              <span className="font-semibold">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
