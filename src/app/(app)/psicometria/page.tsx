import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canSeePsychometrics } from "@/lib/psychometrics-access";
import { loadPsychometricRequests } from "@/lib/psychometric-data";
import { activePeople } from "@/lib/psychometric-tasks";
import { UnderConstruction } from "@/components/UnderConstruction";
import { PSYCHOMETRIC_STATUSES, statusColor } from "@/lib/constants";
import { formatDate, todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Módulo de Psicometría: solicitudes según el Mapa del Proceso de Jaqui
 * (14 pasos). Cada tarjeta muestra fase, responsable, tipo de reporte,
 * cuántos reportes van entregados y para cuándo los necesita el cliente.
 */
export default async function PsychometricsPage() {
  const supabase = await createClient();

  // En estreno: el resto del equipo ve la pantalla de construcción
  const { data: userData } = await supabase.auth.getUser();
  if (!canSeePsychometrics(userData.user?.email)) {
    return <UnderConstruction moduleName="Psicometría" />;
  }

  const [requests, { error }] = await Promise.all([
    loadPsychometricRequests(supabase),
    supabase.from("psychometric_requests").select("id").limit(1),
  ]);

  const today = todayISO();
  const groups = PSYCHOMETRIC_STATUSES.map((status) => ({
    status: status as string,
    items: requests.filter((r) => r.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Psicometría</h1>
          <p className="text-sm text-slate-500">
            Solicitudes según el Mapa del Proceso de Psicometría: requisición, envío de pruebas,
            verificación, reporte, revisión y entrega. Las tareas con SLA se generan solas en
            &quot;Mis tareas&quot;.
          </p>
        </div>
        <Link
          href="/clientes"
          className="rounded-lg bg-gradient-to-r from-brand-navy to-brand-cyan px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
        >
          + Nueva psicometría
        </Link>
      </header>

      {error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Para activar el módulo de psicometría falta correr la migración 028 en Supabase.
        </p>
      )}

      {!error && requests.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-slate-600">Aún no hay solicitudes</p>
          <p className="mt-1 text-sm text-slate-400">
            Entra al cliente y usa &quot;+ Nueva psicometría&quot;. Al abrirla nace la tarea de revisar
            la requisición en 24 horas, y de ahí cada persona avanza con sus propios plazos.
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
              {group.items.map((r) => {
                const people = activePeople(r.people ?? []);
                const delivered = people.filter((p) => p.delivered_at).length;
                const late = r.client_deadline && r.client_deadline < today && r.status !== "Entregada";
                return (
                  <Link
                    key={r.id}
                    href={`/psicometria/${r.id}`}
                    className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-cyan hover:shadow-md ${
                      r.status === "Pausada" || r.status === "Cancelada" ? "opacity-70" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-brand-navy">{r.title}</p>
                      <span
                        className={`${statusColor(r.status)} shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {r.clients?.company}
                      {r.evaluator ? ` · ${r.evaluator}` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`${statusColor(r.report_type)} rounded-full px-2 py-0.5 text-[11px] font-semibold text-white`}
                      >
                        {r.report_type}
                      </span>
                      {r.tests && <span className="truncate text-[11px] text-slate-400">{r.tests}</span>}
                    </div>
                    <p className={`mt-2 text-xs ${late ? "font-semibold text-red-600" : "text-slate-500"}`}>
                      {r.client_deadline
                        ? `📅 Reportes para el ${formatDate(r.client_deadline)}${late ? " ⚠️" : ""}`
                        : "Sin fecha del cliente"}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta"
                          style={{ width: `${people.length ? (delivered / people.length) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs font-medium text-slate-500">
                        {delivered}/{people.length} entregados
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
