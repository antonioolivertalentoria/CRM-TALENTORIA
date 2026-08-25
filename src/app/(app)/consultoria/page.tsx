import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { statusColor, CONSULTING_STATUSES } from "@/lib/constants";
import { formatDate, todayISO } from "@/lib/format";
import type { Client, ConsultingMilestone, ConsultingProject, TimeEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

type ProjectRow = ConsultingProject & { clients: Pick<Client, "id" | "company"> | null };

/**
 * Módulo de Consultoría: proyectos según el Mapa del Proceso (32 pasos).
 * Cada tarjeta muestra fase, líder, avance de hitos y horas invertidas
 * contra contratadas.
 */
export default async function ConsultingPage() {
  const supabase = await createClient();

  const [{ data, error }, { data: milestonesData }, { data: timeData }] = await Promise.all([
    supabase
      .from("consulting_projects")
      .select("*, clients(id, company)")
      .order("created_at", { ascending: false }),
    supabase.from("consulting_milestones").select("*"),
    supabase.from("time_entries").select("task_key, minutes"),
  ]);

  const projects = (data ?? []) as unknown as ProjectRow[];
  const milestones = (milestonesData ?? []) as unknown as ConsultingMilestone[];
  const timeEntries = (timeData ?? []) as unknown as Pick<TimeEntry, "task_key" | "minutes">[];

  const milestonesByProject: Record<string, ConsultingMilestone[]> = {};
  for (const m of milestones) {
    (milestonesByProject[m.project_id] ??= []).push(m);
  }

  const hoursSpent = (projectId: string) =>
    Math.round(
      (timeEntries
        .filter((e) => e.task_key.startsWith(`cons-${projectId}-`))
        .reduce((a, e) => a + e.minutes, 0) /
        60) *
        10
    ) / 10;

  const today = todayISO();
  const groups = CONSULTING_STATUSES.map((status) => ({
    status,
    items: projects.filter((p) => p.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Consultoría</h1>
          <p className="text-sm text-slate-500">
            Proyectos según el Mapa del Proceso: transferencia, arranque, plan, ejecución,
            entrega y cierre. Las tareas con SLA se generan solas en &quot;Mis tareas&quot;.
          </p>
        </div>
        <Link
          href="/clientes"
          className="rounded-lg bg-gradient-to-r from-brand-navy to-brand-cyan px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
        >
          + Nueva consultoría
        </Link>
      </header>

      {error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Para activar el módulo de consultoría falta correr la migración 013 en Supabase.
        </p>
      )}

      {!error && projects.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-slate-600">Aún no hay proyectos de consultoría</p>
          <p className="mt-1 text-sm text-slate-400">
            Entra al cliente y usa &quot;+ Nueva consultoría&quot;. Al crearlo nacen solas las tareas de
            transferencia y arranque con los plazos del proceso.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.status}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              {group.status}
              <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500">
                {group.items.length}
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((p) => {
                const ms = milestonesByProject[p.id] ?? [];
                const done = ms.filter((m) => m.status === "Entregado").length;
                const spent = hoursSpent(p.id);
                const nextDate =
                  p.kickoff_date && p.kickoff_date >= today
                    ? { label: "Arranque", date: p.kickoff_date }
                    : p.delivery_date && p.delivery_date >= today
                      ? { label: "Entrega", date: p.delivery_date }
                      : null;
                return (
                  <Link
                    key={p.id}
                    href={`/consultoria/${p.id}`}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-cyan hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-brand-navy">{p.name}</p>
                      <span
                        className={`${statusColor(p.status)} shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {p.clients?.company}
                      {p.leader ? ` · Líder: ${p.leader}` : ""}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {nextDate ? `📅 ${nextDate.label}: ${formatDate(nextDate.date)}` : "Sin fecha próxima"}
                      {(spent > 0 || p.contracted_hours) &&
                        ` · ⏱ ${spent}${p.contracted_hours ? ` / ${p.contracted_hours}` : ""} h`}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta"
                          style={{ width: ms.length ? `${(done / ms.length) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="shrink-0 text-xs font-medium text-slate-500">
                        {done}/{ms.length} hitos
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
