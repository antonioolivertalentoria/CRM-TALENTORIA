"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setDocumentOrderStatusAction, updateTrainingField } from "@/lib/actions";
import { DOC_STATUS_COLORS, DOC_TYPES, firstName } from "@/lib/constants";
import { orderMaker, orderWhat, receiverShort } from "@/lib/document-orders";
import { formatDate } from "@/lib/format";
import type { DocumentOrder } from "@/lib/types";

export type BoardOrder = DocumentOrder & {
  trainingName: string;
  clientName: string;
  isTeamBuilding: boolean;
  firstDate: string | null;
  lastDate: string | null;
  /** envio_constancias / envio_dc3 cuando aplica (capacitaciones). */
  sendField?: string;
  sendValue?: string;
};

const DOC_ICONS: Record<string, string> = { Constancias: "🎓", "DC-3": "📋", Gafetes: "🪪" };

const COLUMNS = [
  { status: "Pedida", title: "Pedidas", hint: "Por hacer" },
  { status: "Realizada", title: "Realizadas", hint: "Por entregar a quien las pidió" },
  { status: "Entregada", title: "Entregadas", hint: "Últimos 30 días y las que falta enviar" },
] as const;

/** Tablero de pedidos: Pedidas → Realizadas → Entregadas. */
export function OrdersBoard({ orders: initial, today }: { orders: BoardOrder[]; today: string }) {
  const [orders, setOrders] = useState(initial);
  const [type, setType] = useState<string>("Todos");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const visible = orders.filter((o) => type === "Todos" || o.doc_type === type);

  const move = (o: BoardOrder, status: string) => {
    startTransition(async () => {
      const res = await setDocumentOrderStatusAction(o.id, status);
      if ("error" in res) setError(res.error);
      else {
        setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, ...res.order } : x)));
        setError("");
      }
    });
  };

  const markSent = (o: BoardOrder) => {
    if (!o.sendField) return;
    const field = o.sendField;
    startTransition(async () => {
      const res = await updateTrainingField(o.training_id, field, "Listo");
      if (res?.error) setError(res.error);
      else
        setOrders((prev) =>
          prev.map((x) => (x.training_id === o.training_id && x.sendField === field ? { ...x, sendValue: "Listo" } : x))
        );
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {["Todos", ...DOC_TYPES].map((d) => (
          <button
            key={d}
            onClick={() => setType(d)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              type === d ? "bg-brand-navy text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {d !== "Todos" && `${DOC_ICONS[d]} `}
            {d}
            <span className="ml-1 opacity-70">
              {orders.filter((o) => (d === "Todos" || o.doc_type === d) && o.status !== "Entregada").length || ""}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = visible
            .filter((o) => o.status === col.status)
            .sort((a, b) => ((a.needed_by ?? "9999") < (b.needed_by ?? "9999") ? -1 : 1));
          return (
            <section key={col.status} className="rounded-xl border border-slate-200 bg-slate-50/70">
              <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold text-brand-navy">
                    <span className={`h-2.5 w-2.5 rounded-full ${DOC_STATUS_COLORS[col.status]}`} />
                    {col.title}
                    <span className="text-xs font-semibold text-slate-400">{items.length}</span>
                  </h2>
                  <p className="text-[11px] text-slate-400">{col.hint}</p>
                </div>
              </header>
              <div className="space-y-2 p-2">
                {items.length === 0 && <p className="px-1 py-3 text-center text-xs text-slate-400">Nada por aquí</p>}
                {items.map((o) => {
                  const late = o.status !== "Entregada" && o.needed_by && o.needed_by < today;
                  return (
                    <article
                      key={o.id}
                      className={`rounded-lg border bg-white p-2.5 text-xs shadow-sm ${late ? "border-red-200" : "border-slate-200"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-slate-800">
                          {DOC_ICONS[o.doc_type]} {orderWhat(o)}
                        </p>
                        {o.needed_by && o.status !== "Entregada" && (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${
                              late ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                            }`}
                            title="Para cuándo las necesita quien pidió"
                          >
                            {late ? "Vencido · " : ""}
                            {formatDate(o.needed_by)}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/capacitaciones/${o.training_id}`}
                        className="mt-0.5 block font-semibold text-brand-cyan-dark hover:underline"
                      >
                        {o.trainingName}
                        {o.isTeamBuilding && <span className="ml-1 text-brand-magenta">· TB</span>}
                      </Link>
                      <p className="text-slate-500">
                        {o.clientName}
                        {o.lastDate && (
                          <>
                            {" "}
                            ·{" "}
                            {o.firstDate && o.firstDate !== o.lastDate
                              ? `${formatDate(o.firstDate)} – ${formatDate(o.lastDate)}`
                              : formatDate(o.lastDate)}
                          </>
                        )}
                      </p>
                      <p className="mt-1 text-slate-400">
                        Pidió {firstName(o.requested_by) || "—"} · hace {firstName(orderMaker(o))}
                      </p>
                      {o.status === "Pedida" && o.corrections > 0 && o.correction_note ? (
                        <p className="mt-1 rounded bg-orange-50 px-1.5 py-1 text-orange-700">↩ Corregir: {o.correction_note}</p>
                      ) : (
                        o.details && <p className="mt-1 whitespace-pre-line text-slate-600">{o.details}</p>
                      )}
                      {o.files_url && (
                        <a href={o.files_url} target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold text-brand-cyan-dark hover:underline">
                          Archivos ↗
                        </a>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {o.status === "Pedida" && (
                          <button onClick={() => move(o, "Realizada")} disabled={pending} className={btn}>
                            ✓ Ya están hechos
                          </button>
                        )}
                        {o.status === "Realizada" && (
                          <button onClick={() => move(o, "Entregada")} disabled={pending} className={btn}>
                            ✓ Entregados a {receiverShort(o)}
                          </button>
                        )}
                        {o.status === "Entregada" && o.sendValue === "Pendiente" && (
                          <>
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                              Falta enviarlos al cliente
                            </span>
                            <button onClick={() => markSent(o)} disabled={pending} className={btn}>
                              ✓ Enviados
                            </button>
                          </>
                        )}
                        {o.status === "Entregada" && o.sendValue === "Listo" && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                            ✓ Enviados al cliente
                          </span>
                        )}
                        {o.status === "Entregada" && !o.sendField && o.delivered_at && (
                          <span className="text-slate-400">Entregados el {formatDate(o.delivered_at.slice(0, 10))}</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

const btn =
  "rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50";
