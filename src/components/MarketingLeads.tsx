"use client";

import { Fragment, useState, useTransition } from "react";
import {
  addMarketingLeadAction,
  deleteMarketingLeadAction,
  markMarketingLeadSentAction,
  updateMarketingLeadField,
} from "@/lib/actions";
import { CONSENT_STATUSES, LEAD_CHANNELS, LEAD_TYPES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { MarketingLead } from "@/lib/types";
import { EditableField } from "./EditableField";
import { StatusSelect } from "./StatusSelect";

const inputCls =
  "rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

/**
 * Registro de suscriptores y leads (mailing paso 10 y formularios SEO).
 * Cada alta conserva origen, fecha, segmento, consentimiento y acción
 * comercial; las oportunidades pasan a Perla por el canal de Slack de
 * marketing y eso genera su tarea hasta que se marca como enviada.
 */
export function LeadsSection({
  leads,
  projects,
  people,
  today,
  director,
}: {
  leads: MarketingLead[];
  projects: { id: string; name: string; kind: string }[];
  people: string[];
  today: string;
  director: string;
}) {
  const [leadDate, setLeadDate] = useState(today);
  const [leadType, setLeadType] = useState<string>("Suscripción");
  const [channel, setChannel] = useState<string>("Mailing");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("");
  const [segment, setSegment] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  const projectFor = (ch: string) => projects.find((p) => p.kind === (ch === "SEO" ? "SEO" : "Mailing"))?.id ?? null;

  const add = () => {
    if (!email.trim() && !name.trim()) return;
    startTransition(async () => {
      const res = await addMarketingLeadAction({
        projectId: channel === "Otro" ? null : projectFor(channel),
        channel,
        leadDate,
        name,
        email,
        company,
        source,
        segment,
        leadType,
      });
      if ("error" in res) setError(res.error);
      else {
        setName("");
        setEmail("");
        setCompany("");
        setError("");
        setNotice(res.lead.duplicate ? "Ese correo ya estaba registrado: quedó marcado como duplicado." : "");
      }
    });
  };

  const save = (id: string, field: string) => async (value: string) => {
    const res = await updateMarketingLeadField(id, field, value);
    if (res?.error) setError(res.error);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Registro de suscriptores y leads</h3>
        <p className="mt-0.5 text-xs text-slate-400">
          Cada alta conserva origen, fecha, segmento, consentimiento y acción comercial. Las oportunidades
          comerciales le llegan a {director} por el canal de Slack de marketing.
        </p>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input type="date" value={leadDate} onChange={(e) => setLeadDate(e.target.value)} className={inputCls} />
          <select value={leadType} onChange={(e) => setLeadType(e.target.value)} className={inputCls}>
            {LEAD_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
            {LEAD_CHANNELS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Formulario o campaña de origen" className={inputCls} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className={inputCls} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo" type="email" className={inputCls} />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa" className={inputCls} />
          <div className="flex gap-2">
            <input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Segmento" className={`${inputCls} min-w-0 flex-1`} />
            <button
              onClick={add}
              disabled={pending || (!email.trim() && !name.trim())}
              className="rounded-lg bg-brand-cyan px-3.5 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-50"
            >
              {pending ? "…" : "Registrar"}
            </button>
          </div>
        </div>
        {notice && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">{notice}</p>}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</p>}

        {leads.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Todavía no hay leads registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="w-32 px-2 py-2 font-semibold">Fecha</th>
                  <th className="min-w-52 px-2 py-2 font-semibold">Contacto</th>
                  <th className="w-44 px-2 py-2 font-semibold">Origen</th>
                  <th className="w-44 px-2 py-2 font-semibold">Tipo</th>
                  <th className="w-44 px-2 py-2 font-semibold">A Comercial</th>
                  <th className="w-20 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <Fragment key={l.id}>
                    <tr className={`border-b border-slate-100 align-top hover:bg-slate-50/60 ${l.duplicate ? "opacity-60" : ""}`}>
                      <td className="px-2 py-2 text-xs text-slate-600">{formatDate(l.lead_date)}</td>
                      <td className="px-2 py-2">
                        <p className="text-sm font-medium text-slate-800">
                          {l.name || l.email || "—"}
                          {l.duplicate && (
                            <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">duplicado</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">{[l.name ? l.email : "", l.company, l.job_title].filter(Boolean).join(" · ")}</p>
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-500">
                        {l.source || "—"}
                        <br />
                        <span className="text-slate-400">{[l.channel, l.segment].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className="px-2 py-2">
                        <StatusSelect value={l.lead_type} options={LEAD_TYPES} onChange={save(l.id, "lead_type")} small />
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {l.sent_to_commercial ? (
                          <span className="text-emerald-600">✓ {formatDate(l.sent_to_commercial)}</span>
                        ) : l.lead_type === "Oportunidad comercial" && !l.duplicate ? (
                          <button
                            onClick={() => startTransition(async () => void (await markMarketingLeadSentAction(l.id)))}
                            className="rounded-full border border-brand-magenta/40 bg-brand-magenta/10 px-2.5 py-0.5 font-semibold text-brand-magenta hover:bg-brand-magenta/20"
                            title={`Ya se la pasé a ${director} por Slack`}
                          >
                            Marcar enviado
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => setOpen(open === l.id ? null : l.id)}
                          className={`text-xs font-semibold ${open === l.id ? "text-brand-magenta" : "text-slate-400 hover:text-brand-cyan-dark"}`}
                        >
                          {open === l.id ? "▾" : "▸"} Más
                        </button>
                      </td>
                    </tr>
                    {open === l.id && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={6} className="px-3 py-3">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Labeled label="Nombre"><EditableField value={l.name} onSave={save(l.id, "name")} /></Labeled>
                            <Labeled label="Correo"><EditableField value={l.email} onSave={save(l.id, "email")} /></Labeled>
                            <Labeled label="Empresa"><EditableField value={l.company} onSave={save(l.id, "company")} /></Labeled>
                            <Labeled label="Cargo"><EditableField value={l.job_title} onSave={save(l.id, "job_title")} /></Labeled>
                            <Labeled label="Origen"><EditableField value={l.source} onSave={save(l.id, "source")} /></Labeled>
                            <Labeled label="Segmento"><EditableField value={l.segment} onSave={save(l.id, "segment")} /></Labeled>
                            <Labeled label="Fecha"><EditableField value={l.lead_date} type="date" onSave={save(l.id, "lead_date")} /></Labeled>
                            <Labeled label="Consentimiento">
                              <StatusSelect value={l.consent} options={CONSENT_STATUSES} onChange={save(l.id, "consent")} small />
                            </Labeled>
                            <Labeled label="Acción comercial"><EditableField value={l.commercial_action} onSave={save(l.id, "commercial_action")} placeholder="Qué se hizo" /></Labeled>
                            <Labeled label="Próximo paso"><EditableField value={l.next_step} onSave={save(l.id, "next_step")} placeholder="Qué sigue" /></Labeled>
                            <Labeled label="Responsable"><EditableField value={l.responsible} onSave={save(l.id, "responsible")} suggestions={people} /></Labeled>
                            <Labeled label="Canal">
                              <StatusSelect value={l.channel} options={LEAD_CHANNELS} onChange={save(l.id, "channel")} small />
                            </Labeled>
                            <div className="sm:col-span-2 lg:col-span-3">
                              <Labeled label="Notas"><EditableField value={l.notes} onSave={save(l.id, "notes")} /></Labeled>
                            </div>
                            <div className="flex items-end justify-end gap-3">
                              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                                <input
                                  type="checkbox"
                                  checked={l.duplicate}
                                  onChange={(e) => startTransition(async () => void (await save(l.id, "duplicate")(String(e.target.checked))))}
                                />
                                Duplicado
                              </label>
                              {l.sent_to_commercial && (
                                <button
                                  onClick={() => startTransition(async () => void (await save(l.id, "sent_to_commercial")("")))}
                                  className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
                                >
                                  Quitar envío
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (confirm("¿Eliminar este lead?")) {
                                    startTransition(async () => void (await deleteMarketingLeadAction(l.id)));
                                  }
                                }}
                                className="text-xs font-semibold text-red-400 hover:text-red-600"
                              >
                                Eliminar
                              </button>
                            </div>
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
      </div>
    </section>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      {children}
    </div>
  );
}
