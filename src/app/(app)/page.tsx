import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TRAINING_STATUSES, PRIORITIES } from "@/lib/constants";
import { StatusSelect } from "@/components/StatusSelect";
import { updateTrainingField } from "@/lib/actions";
import { formatDate, formatTime, todayISO } from "@/lib/format";
import type { TrainingWithSessions, Session } from "@/lib/types";

export const dynamic = "force-dynamic";

const GROUP_ORDER = ["En curso", "Confirmada", "Propuesta", "Finalizada", "Cancelada"];

const GROUP_ACCENT: Record<string, string> = {
  "En curso": "border-l-brand-cyan",
  Confirmada: "border-l-cyan-500",
  Propuesta: "border-l-slate-400",
  Finalizada: "border-l-emerald-500",
  Cancelada: "border-l-red-400",
};

function nextSession(sessions: Session[]): Session | null {
  const today = todayISO();
  const upcoming = sessions
    .filter((s) => s.session_date && s.session_date >= today && s.status !== "Cancelada" && s.status !== "Impartida")
    .sort((a, b) => (a.session_date! < b.session_date! ? -1 : 1));
  return upcoming[0] ?? null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trainings")
    .select("*, clients(id, company), sessions(*)")
    .order("created_at", { ascending: false });

  const trainings = (data ?? []) as unknown as TrainingWithSessions[];

  const groups = GROUP_ORDER.map((status) => ({
    status,
    items: trainings.filter((t) => t.status === status),
  })).filter((g) => g.items.length > 0);

  // Sesiones de los próximos 14 días
  const today = todayISO();
  const upcoming = trainings
    .flatMap((t) =>
      t.sessions.map((s) => ({ ...s, training: t }))
    )
    .filter(
      (s) =>
        s.session_date &&
        s.session_date >= today &&
        s.status !== "Cancelada" &&
        s.status !== "Impartida"
    )
    .sort((a, b) => (a.session_date! < b.session_date! ? -1 : 1))
    .slice(0, 6);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Tablero de capacitaciones</h1>
          <p className="text-sm text-slate-500">
            Todos los proyectos, agrupados por estado — haz clic en una capacitación para ver sesiones y materiales.
          </p>
        </div>
        <Link
          href="/clientes"
          className="rounded-lg bg-gradient-to-r from-brand-cyan to-brand-magenta px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
        >
          + Nueva capacitación
        </Link>
      </header>

      {/* Próximas sesiones */}
      {upcoming.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Próximas sesiones
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((s) => (
              <Link
                key={s.id}
                href={`/capacitaciones/${s.training.id}`}
                className="rounded-lg border border-slate-200 p-3 transition hover:border-brand-cyan hover:shadow"
              >
                <p className="text-xs font-semibold text-brand-magenta">
                  {formatDate(s.session_date)}
                  {s.start_time ? ` · ${formatTime(s.start_time)}` : ""}
                </p>
                <p className="truncate text-sm font-semibold text-brand-navy">
                  {s.training.short_name}
                  <span className="font-normal text-slate-400"> · Sesión {s.session_number}</span>
                </p>
                <p className="truncate text-xs text-slate-500">
                  {s.training.clients?.company}
                  {s.facilitator ? ` · Facilita: ${s.facilitator}` : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Tablero por estado */}
      {groups.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-slate-600">Aún no hay capacitaciones</p>
          <p className="mt-1 text-sm text-slate-400">
            Empieza dando de alta un cliente y crea su primera capacitación.
          </p>
          <Link
            href="/clientes"
            className="mt-4 inline-block rounded-lg bg-gradient-to-r from-brand-cyan to-brand-magenta px-4 py-2 text-sm font-semibold text-white shadow-md"
          >
            Ir a clientes
          </Link>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.status}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-600">
              {group.status}
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500">
                {group.items.length}
              </span>
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 font-semibold">Capacitación</th>
                    <th className="px-3 py-2.5 font-semibold">Cliente</th>
                    <th className="px-3 py-2.5 font-semibold">Estado</th>
                    <th className="px-3 py-2.5 font-semibold">Prioridad</th>
                    <th className="px-3 py-2.5 font-semibold">Responsable</th>
                    <th className="px-3 py-2.5 font-semibold">Sesiones</th>
                    <th className="px-3 py-2.5 font-semibold">Próxima sesión</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((t) => {
                    const total = t.total_sessions ?? t.sessions.length;
                    const done = t.sessions.filter((s) => s.status === "Impartida").length;
                    const next = nextSession(t.sessions);
                    return (
                      <tr
                        key={t.id}
                        className={`border-b border-slate-100 border-l-4 last:border-b-0 hover:bg-slate-50 ${GROUP_ACCENT[group.status] ?? "border-l-slate-300"}`}
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/capacitaciones/${t.id}`}
                            className="font-semibold text-brand-navy hover:text-brand-cyan-dark hover:underline"
                          >
                            {t.short_name}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/clientes/${t.clients?.id}`}
                            className="text-slate-600 hover:text-brand-cyan-dark hover:underline"
                          >
                            {t.clients?.company ?? "—"}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusSelect
                            value={t.status}
                            options={TRAINING_STATUSES}
                            onChange={updateTrainingField.bind(null, t.id, "status")}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusSelect
                            value={t.priority}
                            options={PRIORITIES}
                            onChange={updateTrainingField.bind(null, t.id, "priority")}
                            small
                          />
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{t.internal_owner || "—"}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta"
                                style={{ width: total ? `${(done / total) * 100}%` : "0%" }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-500">
                              {done}/{total || "?"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {next ? (
                            <>
                              <span className="font-semibold text-brand-magenta">{formatDate(next.session_date)}</span>
                              {next.start_time ? ` · ${formatTime(next.start_time)}` : ""}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
