"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  createDocumentOrderAction,
  deleteDocumentOrderAction,
  requestDocumentCorrectionAction,
  setDocumentOrderStatusAction,
  updateDocumentOrderField,
  updateTrainingField,
} from "@/lib/actions";
import {
  DOC_SEND_FIELD,
  DOC_STATUS_COLORS,
  DOC_TYPES,
  DOCUMENTS_MAKER,
  firstName,
} from "@/lib/constants";
import { defaultNeededBy, docNoun, orderMaker, orderWhat, receiverShort } from "@/lib/document-orders";
import { formatDate } from "@/lib/format";
import { EditableField } from "@/components/EditableField";
import type { DocumentOrder } from "@/lib/types";

const inputCls =
  "rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

const DOC_ICONS: Record<string, string> = { Constancias: "🎓", "DC-3": "📋", Gafetes: "🪪" };

export type OrderCourseData = {
  officialName: string;
  dates: string[];
  hours: number;
  facilitators: string[];
  participantsUrl: string;
};

/**
 * Pedidos de constancias, DC-3 y gafetes de una capacitación o team
 * building: quien lleva el proyecto los pide, América los hace y se los
 * entrega, y (en capacitaciones) quien pidió los envía al cliente.
 */
export function DocumentOrdersSection({
  trainingId,
  orders: initialOrders,
  people,
  isTeamBuilding,
  today,
  suggestedQuantity,
  course,
  sendStatus,
}: {
  trainingId: string;
  orders: DocumentOrder[];
  people: string[];
  isTeamBuilding: boolean;
  today: string;
  suggestedQuantity: number | null;
  course: OrderCourseData;
  /** Estado de envio_constancias / envio_dc3 (solo capacitaciones). */
  sendStatus: Record<string, string>;
}) {
  const [orders, setOrders] = useState<DocumentOrder[]>(initialOrders);
  const [sent, setSent] = useState<Record<string, string>>(sendStatus);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const firstDate = course.dates[0] ?? null;
  const lastDate = course.dates[course.dates.length - 1] ?? null;
  const defaultType = isTeamBuilding
    ? "Gafetes"
    : DOC_TYPES.find((d) => d !== "Gafetes" && !orders.some((o) => o.doc_type === d)) ?? "Constancias";

  const [formOpen, setFormOpen] = useState(false);
  const [docType, setDocType] = useState<string>(defaultType);
  const [quantity, setQuantity] = useState(suggestedQuantity ? String(suggestedQuantity) : "");
  const [neededBy, setNeededBy] = useState(defaultNeededBy(defaultType, firstDate, lastDate, today));
  const [details, setDetails] = useState("");
  const [maker, setMaker] = useState(DOCUMENTS_MAKER);
  const [notify, setNotify] = useState(true);

  const makers = people.includes(DOCUMENTS_MAKER) ? people : [DOCUMENTS_MAKER, ...people];

  const pickType = (value: string) => {
    setDocType(value);
    setNeededBy(defaultNeededBy(value, firstDate, lastDate, today));
  };

  const replace = (o: DocumentOrder) => setOrders((prev) => prev.map((x) => (x.id === o.id ? o : x)));

  const submit = () => {
    startTransition(async () => {
      const res = await createDocumentOrderAction({
        trainingId,
        docType,
        quantity: quantity ? parseInt(quantity, 10) : null,
        neededBy: neededBy || null,
        details,
        maker,
        notify,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOrders((prev) => [...prev, res.order]);
      const field = isTeamBuilding ? undefined : DOC_SEND_FIELD[res.order.doc_type];
      if (field && sent[field] === "No aplica") setSent((prev) => ({ ...prev, [field]: "Pendiente" }));
      setError("");
      setDetails("");
      setFormOpen(false);
    });
  };

  const move = (o: DocumentOrder, status: string) => {
    startTransition(async () => {
      const res = await setDocumentOrderStatusAction(o.id, status);
      if ("error" in res) setError(res.error);
      else {
        replace(res.order);
        setError("");
      }
    });
  };

  const correct = (o: DocumentOrder, note: string) => {
    startTransition(async () => {
      const res = await requestDocumentCorrectionAction(o.id, note);
      if ("error" in res) setError(res.error);
      else {
        replace(res.order);
        setError("");
      }
    });
  };

  const markSent = (field: string) => {
    startTransition(async () => {
      const res = await updateTrainingField(trainingId, field, "Listo");
      if (res?.error) setError(res.error);
      else setSent((prev) => ({ ...prev, [field]: "Listo" }));
    });
  };

  const remove = (o: DocumentOrder) => {
    if (!confirm(`¿Cancelar el pedido de ${orderWhat(o)}? Se borra del CRM.`)) return;
    startTransition(async () => {
      const res = await deleteDocumentOrderAction(o.id);
      if (res?.error) setError(res.error);
      else setOrders((prev) => prev.filter((x) => x.id !== o.id));
    });
  };

  const sorted = [...orders].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const openCount = orders.filter((o) => o.status !== "Entregada").length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {isTeamBuilding ? "Gafetes y documentos" : "Constancias, DC-3 y gafetes"}
            {openCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold normal-case text-amber-700">
                {openCount} en proceso
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Se le piden a {firstName(DOCUMENTS_MAKER)}: ella los hace y te los entrega
            {isTeamBuilding ? "." : "; después tú los envías al cliente."}
          </p>
        </div>
        {!formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            className="rounded-lg bg-brand-cyan px-3.5 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark"
          >
            + Pedir a {firstName(DOCUMENTS_MAKER)}
          </button>
        )}
      </div>

      <div className="space-y-3 p-4">
        {/* Lo que necesita quien los hace, siempre a la vista */}
        <CourseData course={course} isTeamBuilding={isTeamBuilding} />

        {formOpen && (
          <div className="rounded-lg border border-brand-cyan/40 bg-brand-cyan/5 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-semibold text-slate-500">
                Qué
                <select value={docType} onChange={(e) => pickType(e.target.value)} className={`${inputCls} mt-0.5 block`}>
                  {DOC_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {DOC_ICONS[d]} {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Cuántos
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="—"
                  className={`${inputCls} mt-0.5 block w-24`}
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Para cuándo
                <input
                  type="date"
                  value={neededBy}
                  onChange={(e) => setNeededBy(e.target.value)}
                  className={`${inputCls} mt-0.5 block`}
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Los hace
                <select value={maker} onChange={(e) => setMaker(e.target.value)} className={`${inputCls} mt-0.5 block`}>
                  {makers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              placeholder={
                docType === "Gafetes"
                  ? "Instrucciones: colores por equipo, solo nombre de pila, gafetes en blanco de repuesto…"
                  : "Instrucciones: quién firma, logo del cliente, nombres a corregir, si van impresas…"
              }
              className={`${inputCls} mt-2 w-full resize-y`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={submit}
                disabled={pending}
                className="rounded-lg bg-brand-cyan px-3.5 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-50"
              >
                {pending ? "…" : `Pedir ${docNoun(docType)}`}
              </button>
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                Avisarle por correo
              </label>
              <button onClick={() => setFormOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {sorted.length === 0 && !formOpen && (
          <p className="text-sm text-slate-400">
            Aún no se ha pedido nada.
            {!isTeamBuilding && " Los cursos que terminan desde el 9 de noviembre te recuerdan pedirlas 3 días antes del último día."}
          </p>
        )}

        {sorted.map((o) => {
          const sendField = isTeamBuilding ? undefined : DOC_SEND_FIELD[o.doc_type];
          return (
            <OrderCard
              key={o.id}
              order={o}
              today={today}
              makers={makers}
              pending={pending}
              sendField={sendField}
              sendValue={sendField ? sent[sendField] ?? "Pendiente" : undefined}
              onMove={(status) => move(o, status)}
              onCorrect={(note) => correct(o, note)}
              onMarkSent={() => sendField && markSent(sendField)}
              onRemove={() => remove(o)}
              onLocalChange={(patch) => replace({ ...o, ...patch })}
            />
          );
        })}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</p>
        )}
      </div>
    </section>
  );
}

function CourseData({ course, isTeamBuilding }: { course: OrderCourseData; isTeamBuilding: boolean }) {
  const items: ReactNode[] = [];
  if (!isTeamBuilding) {
    items.push(
      <span key="n">
        Nombre oficial:{" "}
        {course.officialName ? (
          <strong className="text-slate-700">{course.officialName}</strong>
        ) : (
          <strong className="text-amber-600">falta capturarlo (arriba, junto al nombre)</strong>
        )}
      </span>
    );
  }
  items.push(
    <span key="f">
      Fechas:{" "}
      <strong className="text-slate-700">
        {course.dates.length > 0 ? course.dates.map((d) => formatDate(d)).join(", ") : "sin fecha"}
      </strong>
    </span>
  );
  if (course.hours > 0) items.push(<span key="h"><strong className="text-slate-700">{course.hours} h</strong></span>);
  if (course.facilitators.length > 0)
    items.push(
      <span key="fa">
        Facilita: <strong className="text-slate-700">{course.facilitators.join(", ")}</strong>
      </span>
    );
  items.push(
    <span key="l">
      Lista de participantes:{" "}
      {course.participantsUrl ? (
        <a href={course.participantsUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-cyan-dark hover:underline">
          abrir ↗
        </a>
      ) : (
        <strong className="text-amber-600">falta la liga</strong>
      )}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
      {items}
    </div>
  );
}

const STEPS = ["Pedida", "Realizada", "Entregada"] as const;

function OrderCard({
  order: o,
  today,
  makers,
  pending,
  sendField,
  sendValue,
  onMove,
  onCorrect,
  onMarkSent,
  onRemove,
  onLocalChange,
}: {
  order: DocumentOrder;
  today: string;
  makers: string[];
  pending: boolean;
  sendField?: string;
  sendValue?: string;
  onMove: (status: string) => void;
  onCorrect: (note: string) => void;
  onMarkSent: () => void;
  onRemove: () => void;
  onLocalChange: (patch: Partial<DocumentOrder>) => void;
}) {
  const [correcting, setCorrecting] = useState(false);
  const [note, setNote] = useState("");
  const stepIndex = STEPS.indexOf(o.status as (typeof STEPS)[number]);
  const late = o.status !== "Entregada" && o.needed_by && o.needed_by < today;
  const steps: { label: string; done: boolean; when: string | null }[] = [
    { label: "Pedida", done: true, when: o.requested_at },
    { label: "Realizada", done: stepIndex >= 1, when: o.made_at },
    { label: "Entregada", done: stepIndex >= 2, when: o.delivered_at },
  ];
  if (sendField) steps.push({ label: "Enviada", done: sendValue === "Listo", when: null });
  const maker = orderMaker(o);

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${late ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-slate-50/60"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-bold text-brand-navy">
          {DOC_ICONS[o.doc_type]} {o.doc_type}
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-500">
          Cuántos:
          <span className="w-16">
            <EditableField
              value={o.quantity?.toString() ?? ""}
              type="number"
              onSave={async (v) => {
                const r = await updateDocumentOrderField(o.id, "quantity", v);
                if (!r) onLocalChange({ quantity: v ? parseInt(v, 10) : null });
              }}
            />
          </span>
        </span>

        {/* Avance: Pedida → Realizada → Entregada (→ Enviada al cliente) */}
        <ol className="flex flex-wrap items-center gap-1">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-center gap-1">
              {i > 0 && <span className="text-slate-300">→</span>}
              <span
                title={s.when ? `${s.label}: ${formatDate(s.when.slice(0, 10))}` : s.label}
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  s.done ? `${DOC_STATUS_COLORS[s.label]} text-white` : "bg-slate-100 text-slate-400"
                }`}
              >
                {s.done ? "✓ " : ""}
                {s.label}
              </span>
            </li>
          ))}
        </ol>

        {o.corrections > 0 && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700" title={o.correction_note}>
            ↩ {o.corrections} corrección{o.corrections > 1 ? "es" : ""}
          </span>
        )}

        <button onClick={onRemove} disabled={pending} title="Cancelar pedido" className="ml-auto text-slate-300 transition hover:text-red-500">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-2 grid gap-x-4 gap-y-1 text-xs text-slate-500 sm:grid-cols-3">
        <div className="flex items-center gap-1">
          <span className="shrink-0">Para cuándo:</span>
          <EditableField
            value={o.needed_by ?? ""}
            type="date"
            className={late ? "!text-red-600 font-semibold" : ""}
            onSave={async (v) => {
              const r = await updateDocumentOrderField(o.id, "needed_by", v);
              if (!r) onLocalChange({ needed_by: v || null });
            }}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="shrink-0">Los hace:</span>
          <select
            value={maker}
            disabled={pending}
            onChange={async (e) => {
              const v = e.target.value;
              const r = await updateDocumentOrderField(o.id, "maker", v);
              if (!r) onLocalChange({ maker: v });
            }}
            className="rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-slate-300"
          >
            {(makers.includes(maker) ? makers : [maker, ...makers]).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="truncate pt-1">
          Pidió: <strong className="text-slate-600">{o.requested_by || "—"}</strong>
          {o.requested_at && <> · {formatDate(o.requested_at.slice(0, 10))}</>}
        </div>
      </div>

      <div className="mt-1 grid gap-x-4 sm:grid-cols-2">
        <div className="text-xs text-slate-500">
          Instrucciones:
          <EditableField
            value={o.details}
            multiline
            rows={2}
            placeholder="—"
            onSave={async (v) => {
              const r = await updateDocumentOrderField(o.id, "details", v);
              if (!r) onLocalChange({ details: v });
            }}
          />
        </div>
        <div className="text-xs text-slate-500">
          Archivos (Drive / PDF):
          <div className="flex items-center gap-1">
            <EditableField
              value={o.files_url}
              type="url"
              placeholder="Pega aquí la liga cuando estén…"
              onSave={async (v) => {
                const r = await updateDocumentOrderField(o.id, "files_url", v);
                if (!r) onLocalChange({ files_url: v });
              }}
            />
            {o.files_url && (
              <a href={o.files_url} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-brand-cyan-dark hover:underline">
                abrir ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {o.status === "Pedida" && o.corrections > 0 && o.correction_note && (
        <p className="mt-1 rounded-md bg-orange-50 px-2 py-1 text-xs text-orange-700">
          Corregir: {o.correction_note}
        </p>
      )}

      {/* Botón del siguiente paso */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {o.status === "Pedida" && (
          <button onClick={() => onMove("Realizada")} disabled={pending} className={btnPrimary}>
            ✓ Ya están hechos
          </button>
        )}
        {o.status === "Realizada" && (
          <button onClick={() => onMove("Entregada")} disabled={pending} className={btnPrimary}>
            ✓ Entregados a {receiverShort(o)}
          </button>
        )}
        {o.status === "Entregada" && sendField && sendValue === "Pendiente" && (
          <button onClick={onMarkSent} disabled={pending} className={btnPrimary}>
            ✓ Ya se enviaron al cliente
          </button>
        )}
        {o.status !== "Pedida" && !correcting && (
          <button onClick={() => setCorrecting(true)} disabled={pending} className={btnGhost}>
            ↩ Pedir corrección
          </button>
        )}
        {o.status !== "Pedida" && (
          <button
            onClick={() => onMove(o.status === "Entregada" ? "Realizada" : "Pedida")}
            disabled={pending}
            title="Si se marcó por error"
            className="text-[11px] text-slate-400 hover:text-slate-600"
          >
            deshacer último paso
          </button>
        )}
        {correcting && (
          <div className="flex min-w-64 flex-1 items-center gap-2">
            <input
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && note.trim()) {
                  onCorrect(note);
                  setCorrecting(false);
                  setNote("");
                }
              }}
              placeholder="¿Qué hay que corregir? Ej. el nombre de Juan va con acento…"
              className={`${inputCls} flex-1`}
            />
            <button
              onClick={() => {
                onCorrect(note);
                setCorrecting(false);
                setNote("");
              }}
              disabled={pending || !note.trim()}
              className={btnPrimary}
            >
              Regresar a {firstName(maker)}
            </button>
            <button onClick={() => setCorrecting(false)} className="text-xs text-slate-400 hover:text-slate-600">
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const btnPrimary =
  "rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50";
