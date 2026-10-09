"use client";

import { Fragment, useActionState, useState, useTransition } from "react";
import {
  addMarketingPageAction,
  addMarketingSendAction,
  addMarketingUrlAction,
  createMarketingProjectAction,
  deleteMarketingPageAction,
  deleteMarketingProjectAction,
  deleteMarketingSendAction,
  deleteMarketingUrlAction,
  updateMarketingPageField,
  updateMarketingSendField,
  updateMarketingUrlField,
} from "@/lib/actions";
import {
  CHECK_STATUSES,
  PAGE_ARCHITECTURES,
  PAGE_STATUSES,
  SEND_STATUSES,
  SEND_TYPES,
  URL_INDEXING,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { StepView } from "@/lib/marketing-flows";
import type { MarketingPage, MarketingSend, MarketingUrl } from "@/lib/types";
import { EditableField } from "./EditableField";
import { LinkChip } from "./LinkChip";
import { StatusSelect } from "./StatusSelect";
import { StepsTimeline } from "./MarketingSteps";

const inputCls =
  "rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

const trashIcon = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

function ErrorNote({ error }: { error: string }) {
  if (!error) return null;
  return <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</p>;
}

// ================= Mailing: envíos del mes (pasos 6-9) =================

const METRICS: { key: keyof MarketingSend; label: string }[] = [
  { key: "base_size", label: "Tamaño de base" },
  { key: "delivered", label: "Entregas" },
  { key: "bounces", label: "Rebotes" },
  { key: "unsubscribes", label: "Bajas" },
  { key: "clicks", label: "Clics" },
  { key: "signups", label: "Inscripciones" },
  { key: "replies", label: "Respuestas" },
  { key: "leads", label: "Leads comerciales" },
];

export function SendsSection({
  projectId,
  period,
  monthName,
  sends,
  warnings,
  planApproved,
}: {
  projectId: string;
  period: string;
  monthName: string;
  sends: MarketingSend[];
  warnings: string[];
  planApproved: boolean;
}) {
  const [date, setDate] = useState("");
  const [type, setType] = useState<string>("Correo");
  const [base, setBase] = useState("");
  const [subject, setSubject] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const save = (id: string, field: string) => async (value: string) => {
    const res = await updateMarketingSendField(id, projectId, field, value);
    if (res?.error) setError(res.error);
  };

  const add = () => {
    if (!subject.trim()) return;
    startTransition(async () => {
      const res = await addMarketingSendAction({ projectId, period, sendDate: date || null, type, base, subject });
      if ("error" in res) setError(res.error);
      else {
        setSubject("");
        setDate("");
        setError("");
      }
    });
  };

  const remove = (s: MarketingSend) => {
    if (!confirm(`¿Eliminar el envío "${s.subject || s.type}"?`)) return;
    startTransition(async () => {
      await deleteMarketingSendAction(s.id, projectId);
    });
  };

  const count = (st: string) => sends.filter((s) => s.status === st).length;
  const scheduled = sends.filter((s) => ["Programado", "Enviado", "Reportado"].includes(s.status)).length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Envíos de {monthName} — pasos 6 a 9
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Calendario de correos por base y fecha. Estados: En preparación → Pendiente de aprobación →
            Aprobado → Probado → Programado → Enviado → Reportado. Las correcciones regresan a preparación.
          </p>
        </div>
        {sends.length > 0 && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {scheduled} de {sends.length} programados
          </span>
        )}
      </div>

      <div className="space-y-3 p-4">
        {warnings.length > 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠️ {warnings.join(" ")} Siempre va una masterclass mensual y al menos dos recursos para regalar
            (playbook, video, simulador, dashboard…).
          </p>
        )}
        {!planApproved && sends.some((s) => s.status === "En preparación") && (
          <p className="text-xs text-slate-400">
            Las tareas de preparación arrancan cuando se apruebe el plan del mes (paso 5).
          </p>
        )}

        {sends.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {SEND_STATUSES.map((st) =>
              count(st) > 0 ? (
                <span key={st} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {st}: {count(st)}
                </span>
              ) : null
            )}
          </div>
        )}

        {sends.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="w-36 px-2 py-2 font-semibold">Fecha</th>
                  <th className="w-32 px-2 py-2 font-semibold">Tipo</th>
                  <th className="w-44 px-2 py-2 font-semibold">Base / segmento</th>
                  <th className="min-w-56 px-2 py-2 font-semibold">Asunto o tema</th>
                  <th className="w-44 px-2 py-2 font-semibold">Estado</th>
                  <th className="w-16 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sends.map((s) => (
                  <Fragment key={s.id}>
                    <tr className="border-b border-slate-100 align-top hover:bg-slate-50/60">
                      <td className="px-1 py-1.5">
                        <EditableField value={s.send_date ?? ""} type="date" onSave={save(s.id, "send_date")} />
                      </td>
                      <td className="px-2 py-1.5 pt-2">
                        <StatusSelect value={s.type} options={SEND_TYPES} onChange={save(s.id, "type")} small />
                      </td>
                      <td className="px-1 py-1.5">
                        <EditableField value={s.base} onSave={save(s.id, "base")} placeholder="Base de datos" />
                      </td>
                      <td className="px-1 py-1.5">
                        <EditableField value={s.subject} onSave={save(s.id, "subject")} />
                      </td>
                      <td className="px-2 py-1.5 pt-2">
                        <StatusSelect value={s.status} options={SEND_STATUSES} onChange={save(s.id, "status")} small />
                      </td>
                      <td className="px-2 py-1.5 pt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setOpen(open === s.id ? null : s.id)}
                            title="Objetivo, llamado a la acción, evidencia, incidencias y resultados"
                            className={`text-xs font-semibold ${open === s.id ? "text-brand-magenta" : "text-slate-400 hover:text-brand-cyan-dark"}`}
                          >
                            {open === s.id ? "▾" : "▸"} Más
                          </button>
                          <button onClick={() => remove(s)} disabled={pending} title="Eliminar envío" className="text-slate-300 transition hover:text-red-500">
                            {trashIcon}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {open === s.id && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={6} className="px-3 py-3">
                          <div className="grid gap-3 md:grid-cols-3">
                            <div>
                              <p className="text-[11px] font-semibold text-slate-400">Objetivo</p>
                              <EditableField value={s.objective} onSave={save(s.id, "objective")} placeholder="Qué buscamos con este correo" />
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-slate-400">Llamado a la acción</p>
                              <EditableField value={s.cta} onSave={save(s.id, "cta")} placeholder="Ej. Inscríbete a la masterclass" />
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-slate-400">Recurso que se regala</p>
                              <EditableField value={s.resource} onSave={save(s.id, "resource")} placeholder="Playbook, video, simulador…" />
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-slate-400">Hora programada</p>
                              <EditableField value={s.send_time?.slice(0, 5) ?? ""} type="time" onSave={save(s.id, "send_time")} />
                            </div>
                            <div className="md:col-span-2 flex flex-wrap items-end gap-4">
                              <LinkChip label="Contenido final" url={s.content_url} onSave={save(s.id, "content_url")} placeholder="Liga del texto final…" />
                              <LinkChip label="Evidencia" url={s.evidence_url} onSave={save(s.id, "evidence_url")} placeholder="Captura de la programación…" />
                            </div>
                            <div className="md:col-span-3">
                              <p className="text-[11px] font-semibold text-slate-400">Incidencias del envío (paso 9)</p>
                              <EditableField value={s.incidents} onSave={save(s.id, "incidents")} multiline rows={2} placeholder="Si algo falló al salir, anótalo aquí" />
                            </div>
                          </div>
                          <p className="mb-1 mt-3 text-[11px] font-semibold text-slate-400">
                            Resultados para los informes de los días 15 y 27
                            {s.scheduled_at ? ` · programado el ${formatDate(s.scheduled_at)}` : ""}
                            {s.sent_at ? ` · enviado el ${formatDate(s.sent_at)}` : ""}
                          </p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                            {METRICS.map((m) => (
                              <div key={m.key}>
                                <p className="text-[10px] text-slate-400">{m.label}</p>
                                <EditableField
                                  value={(s[m.key] as number | null)?.toString() ?? ""}
                                  type="number"
                                  onSave={save(s.id, m.key)}
                                />
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {SEND_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input value={base} onChange={(e) => setBase(e.target.value)} placeholder="Base / segmento" className={`${inputCls} w-44`} />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Asunto o tema del envío…"
            className={`${inputCls} min-w-56 flex-1`}
          />
          <button
            onClick={add}
            disabled={pending || !subject.trim()}
            className="rounded-lg bg-brand-cyan px-3.5 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-50"
          >
            {pending ? "…" : "Agregar envío"}
          </button>
        </div>
        <ErrorNote error={error} />
      </div>
    </section>
  );
}

// ================= SEO: páginas (pasos 4-13) =================

export function PagesSection({
  projectId,
  pages,
  stepsByPage,
  today,
}: {
  projectId: string;
  pages: MarketingPage[];
  stepsByPage: Record<string, StepView[]>;
  today: string;
}) {
  const [name, setName] = useState("");
  const [service, setService] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const add = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await addMarketingPageAction({ projectId, name, service, city: "CDMX" });
      if ("error" in res) setError(res.error);
      else {
        setName("");
        setService("");
        setError("");
      }
    });
  };

  return (
    <section className="space-y-3">
      {pages.map((p) => (
        <PageCard key={p.id} projectId={projectId} page={p} steps={stepsByPage[p.id] ?? []} today={today} />
      ))}

      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-slate-600">+ Nueva página (o mejora de una URL)</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Ej. Team building CDMX"
            className={`${inputCls} min-w-56 flex-1`}
          />
          <input value={service} onChange={(e) => setService(e.target.value)} placeholder="Servicio" className={`${inputCls} w-48`} />
          <button
            onClick={add}
            disabled={pending || !name.trim()}
            className="rounded-lg bg-brand-cyan px-3.5 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-50"
          >
            {pending ? "…" : "Agregar página"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Al agregarla nacen sus pasos: registrar audiencia y oferta, investigar, decidir arquitectura, brief,
          aprobación, construcción, prueba del formulario, publicación y cierre de la URL.
        </p>
        <ErrorNote error={error} />
      </div>
    </section>
  );
}

function PageCard({
  projectId,
  page: p,
  steps,
  today,
}: {
  projectId: string;
  page: MarketingPage;
  steps: StepView[];
  today: string;
}) {
  const [open, setOpen] = useState(p.status === "En curso");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const save = (field: string) => async (value: string) => {
    const res = await updateMarketingPageField(p.id, projectId, field, value);
    if (res?.error) setError(res.error);
  };
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done && !s.locked);

  return (
    <article id={`pagina-${p.id}`} className="scroll-mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button onClick={() => setOpen(!open)} className="text-slate-400 hover:text-brand-cyan-dark" title="Abrir o cerrar">
          {open ? "▾" : "▸"}
        </button>
        <div className="min-w-48 flex-1">
          <EditableField value={p.name} onSave={save("name")} className="!text-base font-bold !text-brand-navy" />
          <p className="px-2 text-xs text-slate-400">
            {[p.service, p.city].filter(Boolean).join(" · ")}
            {next ? ` · Sigue: ${next.title} (${next.assignee})` : done === steps.length && steps.length > 0 ? " · Todos los pasos cerrados" : ""}
          </p>
        </div>
        <StatusSelect value={p.architecture} options={PAGE_ARCHITECTURES} onChange={save("architecture")} small />
        <StatusSelect value={p.status} options={PAGE_STATUSES} onChange={save("status")} small />
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta"
              style={{ width: `${steps.length ? Math.round((done / steps.length) * 100) : 0}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-500">
            {done}/{steps.length}
          </span>
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-slate-100 p-4">
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Audiencia" value={p.audience} onSave={save("audience")} placeholder="A quién le habla" />
            <Field label="Oferta" value={p.offer} onSave={save("offer")} placeholder="Qué se ofrece" />
            <Field label="Objetivo" value={p.objective} onSave={save("objective")} placeholder="Qué debe lograr" />
            <Field label="Llamada a la acción" value={p.cta} onSave={save("cta")} placeholder="Ej. Cotiza tu team building" />
            <Field label="Consulta principal" value={p.main_query} onSave={save("main_query")} placeholder="Ej. team building cdmx" />
            <div>
              <p className="text-xs font-semibold text-slate-400">Fecha objetivo de publicación</p>
              <EditableField value={p.target_date ?? ""} type="date" onSave={save("target_date")} />
            </div>
            {p.architecture === "Dominio nuevo" && (
              <Field label="Dominio" value={p.domain} onSave={save("domain")} placeholder="ejemplo.com.mx" />
            )}
            <div>
              <p className="text-xs font-semibold text-slate-400" title="Que el formulario guarde de qué página y campaña vino el lead">
                Registro de origen del lead
              </p>
              <StatusSelect value={p.lead_origin || "Pendiente"} options={CHECK_STATUSES} onChange={save("lead_origin")} small />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <LinkChip label="URL publicada" url={p.url} onSave={save("url")} placeholder="https://…" />
            <LinkChip label="Página de Chihuahua" url={p.reference_url} onSave={save("reference_url")} placeholder="La que sirve de base…" />
            <LinkChip label="Enlace a datos" url={p.data_url} onSave={save("data_url")} placeholder="Search Console / analítica…" />
          </div>

          <StepsTimeline projectId={projectId} steps={steps} today={today} />

          <div>
            <p className="mb-1 text-xs font-semibold text-slate-400">Notas</p>
            <EditableField value={p.notes} onSave={save("notes")} multiline rows={2} placeholder="Diferenciación local, casos, datos de CDMX…" />
          </div>
          <ErrorNote error={error} />
          <div className="flex justify-end">
            <button
              disabled={pending}
              onClick={() => {
                if (confirm(`¿Eliminar la página "${p.name}" y todo su avance?`)) {
                  startTransition(async () => {
                    await deleteMarketingPageAction(p.id, projectId);
                  });
                }
              }}
              className="text-xs font-semibold text-red-400 hover:text-red-600"
            >
              Eliminar página
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function Field({
  label,
  value,
  onSave,
  placeholder,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<unknown>;
  placeholder?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <EditableField value={value} onSave={onSave} placeholder={placeholder} />
    </div>
  );
}

// ================= SEO: inventario de URL (paso 2) =================

export function UrlsSection({
  projectId,
  urls,
  people,
}: {
  projectId: string;
  urls: MarketingUrl[];
  people: string[];
}) {
  const [url, setUrl] = useState("");
  const [service, setService] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const save = (id: string, field: string) => async (value: string) => {
    const res = await updateMarketingUrlField(id, projectId, field, value);
    if (res?.error) setError(res.error);
  };

  const add = () => {
    if (!url.trim()) return;
    startTransition(async () => {
      const res = await addMarketingUrlAction({ projectId, url, service, city });
      if ("error" in res) setError(res.error);
      else {
        setUrl("");
        setError("");
      }
    });
  };

  const indexed = urls.filter((u) => u.indexing === "Indexada").length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Inventario de URL — paso 2</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            URL, servicio, ciudad, propósito, indexación, formulario, responsable y última actualización. La
            medición del día 20 cubre todas, no solo las nuevas.
          </p>
        </div>
        {urls.length > 0 && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {indexed} de {urls.length} indexadas
          </span>
        )}
      </div>
      <div className="space-y-3 p-4">
        {urls.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="min-w-56 px-2 py-2 font-semibold">URL</th>
                  <th className="w-36 px-2 py-2 font-semibold">Servicio</th>
                  <th className="w-24 px-2 py-2 font-semibold">Ciudad</th>
                  <th className="w-40 px-2 py-2 font-semibold">Propósito</th>
                  <th className="w-32 px-2 py-2 font-semibold">Indexación</th>
                  <th className="w-32 px-2 py-2 font-semibold">Formulario</th>
                  <th className="w-40 px-2 py-2 font-semibold">Responsable</th>
                  <th className="w-36 px-2 py-2 font-semibold">Actualizada</th>
                  <th className="w-48 px-2 py-2 font-semibold" title="Paso 16: mejora priorizada para este mes">Mejora priorizada</th>
                  <th className="w-10 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {urls.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/60">
                    <td className="px-1 py-1.5">
                      <EditableField value={u.url} onSave={save(u.id, "url")} />
                    </td>
                    <td className="px-1 py-1.5">
                      <EditableField value={u.service} onSave={save(u.id, "service")} />
                    </td>
                    <td className="px-1 py-1.5">
                      <EditableField value={u.city} onSave={save(u.id, "city")} />
                    </td>
                    <td className="px-1 py-1.5">
                      <EditableField value={u.purpose} onSave={save(u.id, "purpose")} placeholder="Vender, captar…" />
                    </td>
                    <td className="px-2 py-1.5 pt-2">
                      <StatusSelect value={u.indexing} options={URL_INDEXING} onChange={save(u.id, "indexing")} small />
                    </td>
                    <td className="px-1 py-1.5">
                      <EditableField value={u.form} onSave={save(u.id, "form")} placeholder="Cuál" />
                    </td>
                    <td className="px-1 py-1.5">
                      <EditableField value={u.responsible} onSave={save(u.id, "responsible")} suggestions={people} />
                    </td>
                    <td className="px-1 py-1.5">
                      <EditableField value={u.last_updated ?? ""} type="date" onSave={save(u.id, "last_updated")} />
                    </td>
                    <td className="px-1 py-1.5">
                      <EditableField value={u.improvement} onSave={save(u.id, "improvement")} placeholder="—" />
                    </td>
                    <td className="px-2 py-1.5 pt-2.5">
                      <button
                        onClick={() => {
                          if (confirm(`¿Quitar ${u.url} del inventario?`)) {
                            startTransition(async () => {
                              await deleteMarketingUrlAction(u.id, projectId);
                            });
                          }
                        }}
                        title="Quitar del inventario"
                        className="text-slate-300 transition hover:text-red-500"
                      >
                        {trashIcon}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="https://talentoria.com/…"
            className={`${inputCls} min-w-64 flex-1`}
          />
          <input value={service} onChange={(e) => setService(e.target.value)} placeholder="Servicio" className={`${inputCls} w-40`} />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ciudad" className={`${inputCls} w-28`} />
          <button
            onClick={add}
            disabled={pending || !url.trim()}
            className="rounded-lg bg-brand-cyan px-3.5 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-50"
          >
            {pending ? "…" : "Agregar URL"}
          </button>
        </div>
        <ErrorNote error={error} />
      </div>
    </section>
  );
}

// ================= Alta y baja de proyectos =================

const formInput =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

export function NewMarketingProjectForm({
  people,
  defaults,
  thisMonth,
  nextMonth,
}: {
  people: string[];
  defaults: { owner: string; director: string; collaborator: string };
  thisMonth: string;
  nextMonth: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("Mailing");
  const [state, formAction, pending] = useActionState(createMarketingProjectAction, null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-gradient-to-r from-brand-navy to-brand-magenta px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
      >
        + Nuevo proyecto
      </button>
    );
  }

  const options = (value: string) => (
    <>
      {!people.includes(value) && value && <option value={value}>{value}</option>}
      {people.map((p) => (
        <option key={p} value={p}>{p}</option>
      ))}
    </>
  );

  return (
    <div className="w-full rounded-xl border border-brand-magenta/30 bg-white p-5 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-brand-navy">Nuevo proyecto de marketing</h2>
        <button onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Flujo</label>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={formInput}>
            <option value="Mailing">Mailing (proyecto recurrente mensual)</option>
            <option value="SEO">SEO y páginas</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Nombre</label>
          <input
            name="name"
            key={kind}
            defaultValue={kind === "SEO" ? `Proyecto SEO ${thisMonth.slice(0, 4)}` : "Mailing mensual"}
            className={formInput}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">
            {kind === "SEO" ? "Primer mes del ciclo de medición" : "Primer mes de trabajo"}
          </label>
          <input key={`start-${kind}`} name="start_month" type="month" defaultValue={kind === "SEO" ? nextMonth : thisMonth} className={formInput} />
          <p className="mt-1 text-[11px] text-slate-400">
            {kind === "SEO"
              ? "El diagnóstico y la transferencia arrancan hoy; la medición mensual (días 10, 15 y 20) desde este mes."
              : "Lo que vencía antes de hoy se toma como hecho fuera del CRM."}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Último mes (opcional)</label>
          <input key={`end-${kind}`} name="end_month" type="month" defaultValue={kind === "SEO" ? `${thisMonth.slice(0, 4)}-12` : ""} className={formInput} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Responsable general</label>
          <select name="owner" defaultValue={defaults.owner} className={formInput}>
            {options(defaults.owner)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Dirección y aprobación</label>
          <select name="director" defaultValue={defaults.director} className={formInput}>
            {options(defaults.director)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Colaborador responsable</label>
          <select name="collaborator" defaultValue={defaults.collaborator} className={formInput}>
            {options(defaults.collaborator)}
          </select>
        </div>
        <div className="flex items-end justify-end gap-3 sm:col-span-2">
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-gradient-to-r from-brand-cyan to-brand-magenta px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Creando…" : "Crear proyecto"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function DeleteMarketingProjectButton({ projectId, name }: { projectId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            `¿Eliminar el proyecto "${name}"?\n\nSe borra todo su avance (pasos, envíos, páginas e inventario). Los leads se conservan. Esta acción no se puede deshacer.`
          )
        ) {
          startTransition(() => deleteMarketingProjectAction(projectId));
        }
      }}
      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-60"
    >
      {pending ? "Eliminando…" : "Eliminar proyecto"}
    </button>
  );
}

/** Mes "AAAA-MM" editable (arranque y fin del ciclo). */
export function MonthField({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(value?.slice(0, 7) ?? "");
  const [pending, startTransition] = useTransition();
  return (
    <input
      type="month"
      value={draft}
      disabled={pending}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft === (value?.slice(0, 7) ?? "")) return;
        startTransition(async () => {
          await onSave(draft);
        });
      }}
      className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none transition hover:border-slate-300 focus:border-brand-cyan disabled:opacity-50"
    />
  );
}
