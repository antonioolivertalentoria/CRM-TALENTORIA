import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canSeeRecruitment } from "@/lib/recruitment-access";
import { UnderConstruction } from "@/components/UnderConstruction";
import { statusColor, VACANCY_STATUSES } from "@/lib/constants";
import { addDays, formatDate, todayISO } from "@/lib/format";
import type { Client, RecruitmentCandidate, RecruitmentVacancy } from "@/lib/types";

export const dynamic = "force-dynamic";

type VacancyRow = RecruitmentVacancy & { clients: Pick<Client, "id" | "company"> | null };

/**
 * Módulo de Reclutamiento: vacantes según el Flujo del Proceso (22 pasos).
 * Cada tarjeta muestra fase, reclutador, avance de la terna y el próximo
 * hito con fecha (publicación, ingreso o término de garantía).
 */
export default async function RecruitmentPage() {
  const supabase = await createClient();

  // En construcción: el resto del equipo ve la pantalla de estreno
  const { data: userData } = await supabase.auth.getUser();
  if (!canSeeRecruitment(userData.user?.email)) {
    return <UnderConstruction moduleName="Reclutamiento" />;
  }

  const [{ data, error }, { data: candidatesData }] = await Promise.all([
    supabase
      .from("recruitment_vacancies")
      .select("*, clients(id, company)")
      .order("created_at", { ascending: false }),
    supabase.from("recruitment_candidates").select("*"),
  ]);

  const vacancies = (data ?? []) as unknown as VacancyRow[];
  const candidates = (candidatesData ?? []) as unknown as RecruitmentCandidate[];

  const candidatesByVacancy: Record<string, RecruitmentCandidate[]> = {};
  for (const c of candidates) {
    (candidatesByVacancy[c.vacancy_id] ??= []).push(c);
  }

  const today = todayISO();
  const groups = VACANCY_STATUSES.map((status) => ({
    status,
    items: vacancies.filter((v) => v.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Reclutamiento</h1>
          <p className="text-sm text-slate-500">
            Vacantes según el Flujo del Proceso: requisición, levantamiento, publicación, terna,
            psicometrías, contratación y garantía. Las tareas con SLA se generan solas en &quot;Mis
            tareas&quot;.
          </p>
        </div>
        <Link
          href="/clientes"
          className="rounded-lg bg-gradient-to-r from-brand-navy to-brand-magenta px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
        >
          + Nueva vacante
        </Link>
      </header>

      {error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Para activar el módulo de reclutamiento falta correr la migración 015 en Supabase.
        </p>
      )}

      {!error && vacancies.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-slate-600">Aún no hay vacantes</p>
          <p className="mt-1 text-sm text-slate-400">
            Entra al cliente y usa &quot;+ Nueva vacante&quot;. Al abrirla nacen solas las tareas de
            anticipo, requisición, contacto y levantamiento con sus plazos de 24 y 48 horas.
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
              {group.items.map((v) => {
                const cands = candidatesByVacancy[v.id] ?? [];
                const enTerna = cands.filter((c) =>
                  ["Enviado al cliente", "Aprobado por cliente", "Psicometría", "Referencias", "Contratado"].includes(
                    c.status
                  )
                ).length;
                const guaranteeEnd = v.hire_date ? addDays(v.hire_date, v.guarantee_days ?? 90) : null;
                const next =
                  v.hire_date && v.hire_date >= today
                    ? { label: "Ingreso", date: v.hire_date }
                    : guaranteeEnd && guaranteeEnd >= today
                      ? { label: "Fin de garantía", date: guaranteeEnd }
                      : v.published_at
                        ? { label: "Publicada", date: v.published_at }
                        : null;
                return (
                  <Link
                    key={v.id}
                    href={`/reclutamiento/${v.id}`}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-magenta hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-brand-navy">{v.position}</p>
                      <span
                        className={`${statusColor(v.status)} shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white`}
                      >
                        {v.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {v.clients?.company}
                      {v.recruiter ? ` · ${v.recruiter}` : ""}
                      {v.openings > 1 ? ` · ${v.openings} plazas` : ""}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {next ? `📅 ${next.label}: ${formatDate(next.date)}` : "Sin fecha próxima"}
                      {cands.length > 0 && ` · 👥 ${cands.length} candidatos`}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta"
                          style={{ width: `${Math.min(enTerna / 3, 1) * 100}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs font-medium text-slate-500">{enTerna}/3 terna</span>
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
