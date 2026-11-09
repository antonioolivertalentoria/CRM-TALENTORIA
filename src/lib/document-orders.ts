import { addBusinessDays, addDays } from "./format";
import { DOCUMENTS_MAKER, firstName } from "./constants";
import type { DocumentOrder } from "./types";

/**
 * Pedidos de constancias, DC-3 y gafetes (migración 029).
 *
 * Flujo (desde el 09-nov-2026): quien lleva el proyecto PIDE → América
 * HACE (Realizada) → América ENTREGA a quien pidió (Entregada) → quien
 * pidió ENVÍA al cliente. En capacitaciones el envío sigue siendo el
 * campo envio_constancias / envio_dc3 del checklist; los gafetes y todo
 * lo de team buildings terminan al entregarse.
 *
 * Archivo sin "use client" ni "use server": lo usan el motor de tareas,
 * las páginas y las acciones.
 */

/** Resta días hábiles (salta sábados y domingos). */
export function subtractBusinessDays(iso: string, days: number): string {
  let d = iso;
  let remaining = days;
  while (remaining > 0) {
    d = addDays(d, -1);
    const dow = new Date(`${d}T12:00:00`).getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return d;
}

/** "Constancias" → "constancias", "Gafetes" → "gafetes", "DC-3" se queda. */
export function docNoun(docType: string): string {
  return docType === "DC-3" ? "DC-3" : docType.toLowerCase();
}

/** "40 constancias", "constancias", "12 DC-3". */
export function orderWhat(o: Pick<DocumentOrder, "doc_type" | "quantity">): string {
  const noun = docNoun(o.doc_type);
  return o.quantity ? `${o.quantity} ${noun}` : noun;
}

/**
 * Para cuándo se necesitan, si quien pide no dice otra cosa:
 * - Constancias y DC-3: 1 día hábil después del último día del curso
 *   (así quien pidió alcanza a enviarlas dentro de las 48h).
 * - Gafetes: 2 días hábiles antes del primer día del evento.
 * Nunca antes de 1 día hábil desde hoy (América necesita su tiempo).
 */
export function defaultNeededBy(
  docType: string,
  firstDate: string | null,
  lastDate: string | null,
  today: string
): string {
  const floor = addBusinessDays(today, 1);
  let target: string | null = null;
  if (docType === "Gafetes") {
    target = firstDate ? subtractBusinessDays(firstDate, 2) : null;
  } else {
    target = lastDate ? addBusinessDays(lastDate, 1) : null;
  }
  if (!target || target < floor) return floor;
  return target;
}

/** El pedido vigente de un tipo de documento (el más reciente). */
export function latestOrder(orders: DocumentOrder[], docType: string): DocumentOrder | null {
  const mine = orders
    .filter((o) => o.doc_type === docType)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return mine[0] ?? null;
}

/** Quien hace el pedido, con respaldo a América. */
export function orderMaker(o: Pick<DocumentOrder, "maker">): string {
  return o.maker || DOCUMENTS_MAKER;
}

/** Nombre corto de quien recibe (para "Entregar gafetes a Antonio"). */
export function receiverShort(o: Pick<DocumentOrder, "requested_by">): string {
  return firstName(o.requested_by) || "quien los pidió";
}

/**
 * Lee todos los pedidos agrupados por capacitación. Tolerante a que la
 * migración 029 no haya corrido: si la tabla no existe, regresa vacío.
 */
export async function loadDocumentOrders(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  trainingId?: string
): Promise<{ orders: DocumentOrder[]; byTraining: Record<string, DocumentOrder[]>; missing: boolean }> {
  let query = supabase.from("document_orders").select("*").order("created_at");
  if (trainingId) query = query.eq("training_id", trainingId);
  const { data, error } = await query;
  if (error) return { orders: [], byTraining: {}, missing: true };
  const orders = (data ?? []) as DocumentOrder[];
  const byTraining: Record<string, DocumentOrder[]> = {};
  for (const o of orders) (byTraining[o.training_id] ??= []).push(o);
  return { orders, byTraining, missing: false };
}
