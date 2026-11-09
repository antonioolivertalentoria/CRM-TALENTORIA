import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { syncTaskLedger } from "@/lib/task-ledger";
import { ProductivityDashboard } from "@/components/ProductivityDashboard";
import { formatDate } from "@/lib/format";
import { addMonths, mexicoToday, monthOf, periodLabel } from "@/lib/productivity";
import { loadProductivity, resolvePeriod } from "@/lib/productivity-data";

export const dynamic = "force-dynamic";

export default async function ProductivityPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { mes } = await searchParams;
  const today = mexicoToday();
  const current = monthOf(today);
  const period = resolvePeriod(mes, current);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Antes de leer, la bitácora se pone al día (con la llave de servicio)
  const sync = await syncTaskLedger();

  const { months, seesAll, me, people, rows, agreements, agreementsReady, excluded, startedOn, directionNames, readError } =
    await loadProductivity(supabase, user, period, today);

  // Pestañas de meses: desde que arrancó la medición (máximo 6 hacia atrás)
  const firstMonth = startedOn ? monthOf(startedOn) : current;
  const tabs: string[] = [];
  for (let p = current; p >= firstMonth && tabs.length < 6; p = addMonths(p, -1)) tabs.unshift(p);
  if (!tabs.includes(period)) tabs.unshift(period);

  const syncProblem = readError ?? (sync.ok ? "" : sync.reason);
  const migrationMissing = syncProblem.includes("task_ledger");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Productividad</h1>
          <p className="max-w-3xl text-sm text-slate-500">
            Cumplimiento de las tareas que generan los procesos del CRM (capacitaciones, team buildings, consultoría,
            reclutamiento, psicometría, marketing y tareas propias), por persona, proceso y mes. La metodología está al final de la
            página.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Mes">
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
        </nav>
      </header>

      {migrationMissing ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Falta correr la <strong>migración 024</strong> (bitácora de productividad) en la base.
        </div>
      ) : (
        syncProblem && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            La información no se pudo actualizar ({syncProblem}). Se vuelve a intentar con cada cambio en el CRM.
          </div>
        )
      )}

      <ProductivityDashboard
        rows={rows}
        months={months}
        period={period}
        seesAll={seesAll}
        me={me}
        people={people}
        agreements={agreements}
        agreementsReady={agreementsReady}
        excluded={excluded}
      />

      <details className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-base font-bold text-brand-navy">Metodología del indicador</summary>
        <dl className="mt-3 grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-700">Indicador</dt>
            <dd className="text-slate-600">
              Cumplimiento a tiempo = tareas cerradas en o antes de su fecha compromiso ÷ (cerradas a tiempo + cerradas con
              retraso + vencidas sin cerrar).
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Periodo</dt>
            <dd className="text-slate-600">
              Cada tarea pertenece al mes de su fecha compromiso. Las tareas en plazo se muestran como carga del mes y se
              evalúan al llegar su fecha.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Fecha compromiso</dt>
            <dd className="text-slate-600">
              La que asigna el proceso del CRM, con al menos un día hábil desde la asignación. Los vencimientos en fin de
              semana se recorren al siguiente día hábil. Si cambia la fecha del evento, la fecha compromiso se recalcula; en
              tareas propias aplica la fecha vigente.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Dependencias externas</dt>
            <dd className="text-slate-600">
              Las tareas registradas como &quot;En espera&quot; (Mis tareas → Avance) antes de su vencimiento se reportan
              por separado y no se consideran en el porcentaje.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Exclusiones</dt>
            <dd className="text-slate-600">
              Tareas canceladas, eliminadas o marcadas &quot;No aplica&quot;, de proyectos en pausa o cerrados, y pendientes
              previos al inicio de la medición{startedOn ? ` (${formatDate(startedOn)})` : ""}. El tiempo registrado no
              forma parte de este indicador.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Acuerdos y comentarios</dt>
            <dd className="text-slate-600">
              Los acuerdos de cada mes se registran por persona y cada colaborador confirma su recepción. El responsable de
              una tarea con retraso puede documentar el contexto en su comentario.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Consulta</dt>
            <dd className="text-slate-600">
              Cada colaborador consulta su información
              {directionNames.length ? `; ${joinNames(directionNames)} consultan la del equipo` : "; dirección consulta la del equipo"}.
            </dd>
          </div>
        </dl>
      </details>
    </div>
  );
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}
