import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { statusColor } from "@/lib/constants";
import { formatDate, formatTime, todayISO } from "@/lib/format";
import type { Client, Session, Training, TrainingRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

const GROUP_ORDER = ["En curso", "Confirmada", "Propuesta", "Finalizada", "Cancelada"];

type TBRow = Training & {
  clients: Pick<Client, "id" | "company"> | null;
  sessions: Session[];
};

/**
 * Apartado de team buildings: mismo sistema que las capacitaciones
 * (cliente/subcliente, sesiones, horas) pero sin materiales ni checklist;
 * lo suyo son las peticiones del cliente y los archivos del evento.
 */
export default async function TeamBuildingsPage() {
  const supabase = await createClient();

  const [{ data, error }, { data: requestsData }] = await Promise.all([
    supabase
      .from("trainings")
      .select("*, clients(id, company), sessions(*)")
      .eq("kind", "Team building")
      .order("created_at", { ascending: false }),
    supabase.from("training_requests").select("*"),
  ]);

  const teamBuildings = (data ?? []) as unknown as TBRow[];
  const requests = (requestsData ?? []) as unknown as TrainingRequest[];
  const requestsByTraining: Record<string, TrainingRequest[]> = {};
  for (const r of requests) {
    (requestsByTraining[r.training_id] ??= []).push(r);
  }

  const today = todayISO();
  const groups = GROUP_ORDER.map((status) => ({
    status,
    items: teamBuildings.filter((t) => t.status === status),
  })).filter((g) => g.items.length > 0);

  const nextSession = (t: TBRow) =>
    t.sessions
      .filter((s) => s.session_date && s.session_date >= today && s.status !== "Cancelada")
      .sort((a, b) => (a.session_date! < b.session_date! ? -1 : 1))[0] ?? null;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Team buildings</h1>
          <p className="text-sm text-slate-500">
            Eventos de integración: cliente, fechas, peticiones (gafetes, tarjetas, lo que pidan)
            y archivos. Se crean desde la página del cliente, igual que las capacitaciones.
          </p>
        </div>
        <Link
          href="/clientes"
          className="rounded-lg bg-gradient-to-r from-brand-magenta to-brand-navy px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
        >
          + Nuevo team building
        </Link>
      </header>

      {error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Para activar los team buildings falta correr la migración 011 en Supabase.
        </p>
      )}

      {!error && teamBuildings.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-slate-600">Aún no hay team buildings</p>
          <p className="mt-1 text-sm text-slate-400">
            Entra al cliente y usa &quot;+ Nuevo team building&quot;. Funciona igual que una
            capacitación (fechas, horarios, facilitadores, subclientes), pero en vez de
            materiales lleva las peticiones del cliente y sus archivos.
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
              {group.items.map((t) => {
                const reqs = requestsByTraining[t.id] ?? [];
                const doneReqs = reqs.filter((r) => r.done).length;
                const next = nextSession(t);
                const totalHours = t.sessions
                  .filter((s) => s.status !== "Cancelada")
                  .reduce((acc, s) => acc + (Number(s.duration_hours) || 0), 0);
                return (
                  <Link
                    key={t.id}
                    href={`/capacitaciones/${t.id}`}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-magenta hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-brand-navy">{t.short_name}</p>
                      <span
                        className={`${statusColor(t.status)} shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{t.clients?.company}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {next ? (
                        <>
                          📅 {formatDate(next.session_date)}
                          {next.start_time ? ` · ${formatTime(next.start_time)}` : ""}
                        </>
                      ) : (
                        "Sin fecha próxima"
                      )}
                      {totalHours > 0 && ` · ⏱ ${totalHours} h`}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta"
                          style={{
                            width: reqs.length ? `${(doneReqs / reqs.length) * 100}%` : "0%",
                          }}
                        />
                      </div>
                      <span className="shrink-0 text-xs font-medium text-slate-500">
                        {doneReqs}/{reqs.length} peticiones
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
