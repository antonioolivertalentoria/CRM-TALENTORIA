import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateMarketingPeriodField, updateMarketingProjectField } from "@/lib/actions";
import { MARKETING_PROJECT_STATUSES } from "@/lib/constants";
import {
  activeMonths,
  addMonths,
  compliance,
  indexSteps,
  monthKey,
  monthLabel,
  monthTitle,
  monthsBetween,
  periodOf,
  resolveMailingMonth,
  resolveSeoBase,
  resolveSeoMonth,
  resolveSeoPage,
  toStepViews,
} from "@/lib/marketing-flows";
import { planWarnings } from "@/lib/marketing-tasks";
import { formatDate, formatMinutes, todayISO } from "@/lib/format";
import { StatusSelect } from "@/components/StatusSelect";
import { EditableField } from "@/components/EditableField";
import { LinkChip } from "@/components/LinkChip";
import { OwnerSelect } from "@/components/OwnerSelect";
import { ComplianceChips, StepsTimeline } from "@/components/MarketingSteps";
import {
  DeleteMarketingProjectButton,
  MonthField,
  PagesSection,
  SendsSection,
  UrlsSection,
} from "@/components/MarketingSections";
import type {
  MarketingPage,
  MarketingPeriod,
  MarketingProject,
  MarketingSend,
  MarketingStep,
  MarketingUrl,
  Profile,
  TimeEntry,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MarketingProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const { mes } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase.from("marketing_projects").select("*").eq("id", id).single();
  if (!data) notFound();
  const project = data as unknown as MarketingProject;

  const [
    { data: stepsData },
    { data: sendsData },
    { data: pagesData },
    { data: urlsData },
    { data: periodsData },
    { data: leadsData },
    { data: profilesData },
    { data: timeData },
  ] = await Promise.all([
    supabase.from("marketing_steps").select("*").eq("project_id", id),
    supabase.from("marketing_sends").select("*").eq("project_id", id).order("send_date").order("position"),
    supabase.from("marketing_pages").select("*").eq("project_id", id).order("position"),
    supabase.from("marketing_urls").select("*").eq("project_id", id).order("created_at"),
    supabase.from("marketing_periods").select("*").eq("project_id", id),
    supabase.from("marketing_leads").select("id, lead_date, lead_type, duplicate, sent_to_commercial").eq("project_id", id),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase.from("time_entries").select("task_key, minutes"),
  ]);

  const today = todayISO();
  const rows = indexSteps((stepsData ?? []) as unknown as MarketingStep[]);
  const sends = (sendsData ?? []) as unknown as MarketingSend[];
  const pages = (pagesData ?? []) as unknown as MarketingPage[];
  const urls = (urlsData ?? []) as unknown as MarketingUrl[];
  const periods = (periodsData ?? []) as unknown as MarketingPeriod[];
  const leads = (leadsData ?? []) as unknown as { lead_date: string; lead_type: string; duplicate: boolean; sent_to_commercial: string | null }[];
  const people = ((profilesData ?? []) as unknown as Pick<Profile, "full_name">[]).map((p) => p.full_name);

  // Tiempo ⏱ invertido en el proyecto (todas sus tareas llevan mkt-<id>-)
  const spentMinutes = ((timeData ?? []) as unknown as Pick<TimeEntry, "task_key" | "minutes">[])
    .filter((e) => e.task_key.startsWith(`mkt-${id}-`))
    .reduce((a, e) => a + e.minutes, 0);

  const save = (field: string) => updateMarketingProjectField.bind(null, project.id, field);
  const isMailing = project.kind === "Mailing";

  // Meses que se pueden ver: del arranque al horizonte (mailing: el siguiente,
  // que se planea este mes), más cualquiera que ya tenga envíos capturados.
  const months = activeMonths(project, today);
  const thisMonth = periodOf(today);
  const fallback = months.includes(thisMonth) ? thisMonth : months[months.length - 1] ?? periodOf(project.start_month);
  const requested = typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) ? `${mes}-01` : null;
  const period = requested ?? fallback;
  const tabs = monthsBetween(
    [periodOf(project.start_month), ...months].sort()[0],
    [...months, period].sort().slice(-1)[0]
  );

  return (
    <div className="space-y-6">
      <nav className="flex items-center justify-between text-sm text-slate-400">
        <span>
          <Link href="/marketing" className="hover:text-brand-cyan-dark hover:underline">
            Marketing
          </Link>{" "}
          / <span className="text-slate-600">{project.name}</span>
        </span>
        <span className="text-xs text-slate-400" title="Los campos se guardan al salir de ellos o al elegir una opción.">
          ✓ Todo se guarda automáticamente
        </span>
      </nav>

      {/* Encabezado */}
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-64 flex-1">
            <p className="px-2 text-xs font-bold uppercase tracking-wide text-brand-magenta">
              {isMailing ? "Mailing · proyecto recurrente mensual" : "SEO y páginas"}
            </p>
            <EditableField value={project.name} onSave={save("name")} className="!text-2xl font-bold !text-brand-navy" />
            <p className="mt-1 px-2 text-xs text-slate-400">
              En el CRM desde {formatDate(project.started_at)}: lo que vencía antes se tomó como hecho por fuera.
              {spentMinutes > 0 && (
                <>
                  {" "}· ⏱ <span className="font-medium text-slate-600">{formatMinutes(spentMinutes)}</span> registradas
                </>
              )}
            </p>
          </div>
          <StatusSelect value={project.status} options={MARKETING_PROJECT_STATUSES} onChange={save("status")} />
        </div>

        <div className="mt-4 grid gap-x-6 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold text-slate-400">Responsable general</p>
            <OwnerSelect value={project.owner} people={people} onChange={save("owner")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Dirección y aprobación</p>
            <OwnerSelect value={project.director} people={people} onChange={save("director")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400" title="Quien en el documento aparece como Óscar">
              Colaborador responsable
            </p>
            <OwnerSelect value={project.collaborator} people={people} onChange={save("collaborator")} />
          </div>
          {!isMailing && (
            <div>
              <p className="text-xs font-semibold text-slate-400">Finanzas (compra de dominios)</p>
              <OwnerSelect value={project.finance} people={people} onChange={save("finance")} />
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-slate-400">
              {isMailing ? "Primer mes" : "Primer mes de medición"}
            </p>
            <MonthField value={project.start_month} onSave={save("start_month")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Último mes</p>
            <MonthField value={project.end_month} onSave={save("end_month")} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-4">
          <LinkChip label="Carpeta Drive" url={project.drive_folder_url} onSave={save("drive_folder_url")} />
          <LinkChip
            label={isMailing ? "MailerLite" : "Search Console"}
            url={project.dashboard_url}
            onSave={save("dashboard_url")}
            placeholder={isMailing ? "Liga del panel de MailerLite…" : "Liga de Search Console o analítica…"}
          />
          <LinkChip
            label="Slack de marketing"
            url={project.slack_channel_url}
            onSave={save("slack_channel_url")}
            placeholder="Liga del canal donde pasan los leads…"
          />
          <Link href="/marketing/leads" className="text-xs font-semibold text-brand-cyan-dark hover:underline">
            👥 Leads: {leads.length} registrados
            {leads.filter((l) => l.lead_type === "Oportunidad comercial" && !l.duplicate && !l.sent_to_commercial).length > 0 &&
              ` · ${leads.filter((l) => l.lead_type === "Oportunidad comercial" && !l.duplicate && !l.sent_to_commercial).length} por pasar a Comercial`}
          </Link>
        </div>
      </header>

      {isMailing ? (
        <MailingView
          project={project}
          period={period}
          tabs={tabs}
          rows={rows}
          sends={sends}
          periods={periods}
          today={today}
        />
      ) : (
        <SeoView
          project={project}
          period={period}
          tabs={tabs}
          rows={rows}
          pages={pages}
          urls={urls}
          people={people}
          today={today}
        />
      )}

      {/* Notas */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Notas del proyecto</h3>
          <EditableField value={project.notes} onSave={save("notes")} multiline placeholder="Acuerdos, decisiones, pendientes…" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Observaciones internas</h3>
          <EditableField value={project.internal_notes} onSave={save("internal_notes")} multiline placeholder="Solo para el equipo…" />
        </div>
      </section>

      <footer className="flex justify-end border-t border-slate-200 pt-4">
        <DeleteMarketingProjectButton projectId={project.id} name={project.name} />
      </footer>
    </div>
  );
}

function MonthTabs({ projectId, tabs, period, today }: { projectId: string; tabs: string[]; period: string; today: string }) {
  const current = periodOf(today);
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => (
        <Link
          key={t}
          href={`/marketing/${projectId}?mes=${monthKey(t)}`}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            t === period
              ? "bg-gradient-to-r from-brand-cyan to-brand-magenta text-white shadow"
              : "border border-slate-300 bg-white text-slate-600 hover:border-brand-cyan"
          }`}
        >
          {monthTitle(t)}
          {t === current ? " · en curso" : t > current ? " · planeación" : ""}
        </Link>
      ))}
    </div>
  );
}

function MailingView({
  project,
  period,
  tabs,
  rows,
  sends,
  periods,
  today,
}: {
  project: MarketingProject;
  period: string;
  tabs: string[];
  rows: ReturnType<typeof indexSteps>;
  sends: MarketingSend[];
  periods: MarketingPeriod[];
  today: string;
}) {
  const steps = toStepViews(resolveMailingMonth(project, period, rows, today));
  const planning = steps.filter((s) => s.group === "Planeación");
  const weekly = steps.filter((s) => s.group === "Reportes semanales");
  const measurement = steps.filter((s) => s.group === "Medición");
  const monthSends = sends.filter((s) => s.period === period);
  const approval = steps.find((s) => s.key.endsWith(":s5"));
  const periodRow = periods.find((p) => p.period === period);
  const c = compliance(steps, today);
  const name = monthLabel(period);
  const prev = addMonths(period, -1);

  return (
    <div className="space-y-5">
      <MonthTabs projectId={project.id} tabs={tabs} period={period} today={today} />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-navy">Proyecto mensual · {monthTitle(period)}</h2>
            <p className="text-xs text-slate-400">
              La planeación ocurre a finales de {monthLabel(prev)} (pasos 1 a 5); los envíos salen en {name}; el
              informe de avance es el día 15 y el cierre el 27, que a su vez abre el mes siguiente.
            </p>
          </div>
          <ComplianceChips {...c} />
        </div>
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-slate-400">
            Criterios del bono acordados al inicio del mes{" "}
            <span className="font-normal">(se evalúan resultados terminados en fecha y con calidad)</span>
          </p>
          <EditableField
            value={periodRow?.bonus_criteria ?? ""}
            onSave={updateMarketingPeriodField.bind(null, project.id, period, "bonus_criteria")}
            multiline
            rows={2}
            placeholder="Ej. todos los envíos programados antes del día 1, informes 15 y 27 en fecha, ≥ X leads comerciales…"
          />
        </div>
      </section>

      <StepsTimeline
        projectId={project.id}
        steps={planning}
        today={today}
        title={`Planeación de ${name} — pasos 1 a 5`}
        subtitle="Perla define prioridades (días 25-27), Oliver confirma, presenta el plan (máx. día 29) y Perla lo aprueba (días 29-30)."
        mirrorHref={`/marketing/${project.id}?mes=${monthKey(prev)}`}
      />

      <SendsSection
        projectId={project.id}
        period={period}
        monthName={name.split(" ")[0]}
        sends={monthSends}
        warnings={planWarnings(monthSends)}
        planApproved={!approval || approval.done}
      />

      <StepsTimeline
        projectId={project.id}
        steps={weekly}
        today={today}
        title="Reporte semanal de leads — paso 11"
        subtitle="Cada lunes por la semana previa: suscripciones, altas por fuente y segmento, acciones comerciales, duplicados y seguimiento pendiente."
      />

      <StepsTimeline
        projectId={project.id}
        steps={measurement}
        today={today}
        title="Medición y auditoría — pasos 12 a 14"
        subtitle="Los informes de los días 15 y 27 van por base, segmento y campaña. Al cerrarlos, los envíos que ya salieron quedan como Reportado."
      />
    </div>
  );
}

function SeoView({
  project,
  period,
  tabs,
  rows,
  pages,
  urls,
  people,
  today,
}: {
  project: MarketingProject;
  period: string;
  tabs: string[];
  rows: ReturnType<typeof indexSteps>;
  pages: MarketingPage[];
  urls: MarketingUrl[];
  people: string[];
  today: string;
}) {
  const save = (field: string) => updateMarketingProjectField.bind(null, project.id, field);
  const base = toStepViews(resolveSeoBase(project, rows, today));
  const arranque = base.filter((s) => s.group === "Arranque");
  const transfer = base.filter((s) => s.group === "Transferencia");
  const monthSteps = toStepViews(resolveSeoMonth(project, period, rows, today));
  const stepsByPage = Object.fromEntries(
    pages.map((p) => [p.id, toStepViews(resolveSeoPage(project, p, rows, today))])
  );
  const closed = pages.filter((p) => p.status === "Cerrada").length;
  const transferDone = transfer.filter((s) => s.transfer && s.done).length;
  const transferTotal = transfer.filter((s) => s.transfer).length;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-64 flex-1">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Prioridades comerciales — paso 1</h2>
            <p className="mb-2 mt-0.5 text-xs text-slate-400">
              Perla prioriza; Oliver registra audiencia, oferta, objetivo y llamada a la acción en cada página.
            </p>
            <EditableField
              value={project.priorities}
              onSave={save("priorities")}
              multiline
              rows={3}
              placeholder="Páginas CDMX: team building, NOM 035 y LEGO…"
            />
          </div>
          <div className="grid gap-2 text-sm sm:w-72">
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <p className="text-xs font-bold text-brand-navy">🎯 Objetivo 2026</p>
              <p className="text-xs text-slate-500">Team building, NOM 035 y LEGO en CDMX, con contenido propio.</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {closed} de {Math.max(3, pages.length)} páginas cerradas
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <p className="text-xs font-bold text-brand-navy">🎓 Transferencia al colaborador</p>
              <p className="text-xs text-slate-500">Se evalúa aparte del rendimiento comercial de las páginas.</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {transferDone} de {transferTotal} hitos
              </p>
            </div>
          </div>
        </div>
      </section>

      <StepsTimeline
        projectId={project.id}
        steps={arranque}
        today={today}
        title="Arranque — pasos 1 a 3"
        subtitle="Prioridades, inventario de todas las URL (línea base) y diagnóstico técnico inicial."
      />

      <StepsTimeline
        projectId={project.id}
        steps={transfer}
        today={today}
        title="Transferencia de Oliver al colaborador — pasos 7, 8 y 15"
        subtitle="1 guía documentada · 2 explicación registrada · 3 ejecución acompañada · 4 ejecución autónoma validada. Cada hito con fecha, evidencia y criterio de aprobación."
      />

      <div>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">Páginas — pasos 4 a 13</h2>
        <p className="mb-3 text-xs text-slate-400">
          Cada URL CDMX se cierra con brief, aprobación, versión publicada, prueba del formulario, registro de origen
          del lead, verificación de indexación y enlace a datos. Se prefiere una URL en el sitio principal; un
          dominio nuevo solo con autorización de Perla (y lo compra Eduardo).
        </p>
        <PagesSection projectId={project.id} pages={pages} stepsByPage={stepsByPage} today={today} />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Ciclo mensual — pasos 2, 3, 16 a 19</h2>
        {tabs.length > 0 ? (
          <>
            <MonthTabs projectId={project.id} tabs={tabs} period={period} today={today} />
            <StepsTimeline
              projectId={project.id}
              steps={monthSteps}
              today={today}
              title={`Medición y mejora · ${monthLabel(period)}`}
              subtitle="Inventario y revisión técnica (día 10), corte de medición (día 15), analítica de Oliver (día 20) y decisión de Perla; mantenimiento continuo de las URL priorizadas."
            />
          </>
        ) : (
          <p className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
            El ciclo mensual arranca en {monthLabel(periodOf(project.start_month))}.
          </p>
        )}
      </div>

      <UrlsSection projectId={project.id} urls={urls} people={people} />
    </div>
  );
}
