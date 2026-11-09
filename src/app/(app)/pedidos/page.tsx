import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DOC_SEND_FIELD, DOCUMENTS_MAKER, firstName } from "@/lib/constants";
import { loadDocumentOrders } from "@/lib/document-orders";
import { addDays, todayISO } from "@/lib/format";
import { OrdersBoard, type BoardOrder } from "@/components/OrdersBoard";
import type { Client, Session, Training } from "@/lib/types";

export const dynamic = "force-dynamic";

type TrainingRow = Pick<
  Training,
  "id" | "short_name" | "kind" | "status" | "internal_owner" | "envio_constancias" | "envio_dc3"
> & {
  clients: Pick<Client, "company"> | null;
  sessions: Pick<Session, "session_date" | "status">[];
};

/**
 * Pedidos de constancias, DC-3 y gafetes de todo el CRM (migración 029):
 * lo que está pedido, lo que ya se hizo y lo que ya se entregó. Pensada
 * para América (quien los hace) y para quien pide (qué le falta recibir
 * y qué le falta enviar al cliente).
 */
export default async function OrdersPage() {
  const supabase = await createClient();
  const [{ orders, missing }, { data: trainingsData }] = await Promise.all([
    loadDocumentOrders(supabase),
    supabase
      .from("trainings")
      .select("id, short_name, kind, status, internal_owner, envio_constancias, envio_dc3, clients(company), sessions(session_date, status)"),
  ]);

  const trainings = new Map(
    ((trainingsData ?? []) as unknown as TrainingRow[]).map((t) => [t.id, t])
  );
  const today = todayISO();
  const recentFrom = addDays(today, -30);

  const rows: BoardOrder[] = [];
  for (const o of orders) {
    const t = trainings.get(o.training_id);
    if (!t) continue;
    const dates = t.sessions
      .filter((s) => s.status !== "Cancelada" && s.session_date)
      .map((s) => s.session_date!)
      .sort();
    const sendField = t.kind === "Team building" ? undefined : DOC_SEND_FIELD[o.doc_type];
    const sendValue = sendField ? (t as unknown as Record<string, string>)[sendField] ?? "Pendiente" : undefined;
    // Entregadas: solo las de los últimos 30 días o las que falta enviar
    if (
      o.status === "Entregada" &&
      sendValue !== "Pendiente" &&
      (o.delivered_at ?? o.created_at).slice(0, 10) < recentFrom
    ) {
      continue;
    }
    rows.push({
      ...o,
      trainingName: t.short_name,
      clientName: t.clients?.company ?? "",
      isTeamBuilding: t.kind === "Team building",
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
      sendField,
      sendValue,
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-brand-navy">Pedidos de constancias, DC-3 y gafetes</h1>
        <p className="text-sm text-slate-500">
          Quien lleva el proyecto los pide desde la ficha de la capacitación o del team building,{" "}
          {firstName(DOCUMENTS_MAKER)} los hace y se los entrega, y quien pidió los envía al cliente.
          Cada paso le aparece a quien le toca en &quot;Mis tareas&quot;.
        </p>
      </header>

      {missing ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Para activar los pedidos falta correr la migración 029 en Supabase.
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-slate-600">Aún no hay pedidos</p>
          <p className="mt-1 text-sm text-slate-400">
            Entra a una capacitación o team building y usa &quot;+ Pedir a {firstName(DOCUMENTS_MAKER)}&quot;.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-brand-cyan-dark hover:underline">
            Ir al tablero →
          </Link>
        </div>
      ) : (
        <OrdersBoard orders={rows} today={today} />
      )}
    </div>
  );
}
