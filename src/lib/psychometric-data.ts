import type { PsychometricRequestFull } from "./psychometric-tasks";
import type { PsychometricPerson } from "./types";

/**
 * Solicitudes de psicometría con sus personas colgadas, listas para el
 * motor de tareas. Tolerante a que la migración 028 no haya corrido: si
 * las tablas no existen, regresa una lista vacía y todo lo demás sigue.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadPsychometricRequests(supabase: any): Promise<PsychometricRequestFull[]> {
  try {
    const [{ data: requests, error }, { data: people }] = await Promise.all([
      supabase.from("psychometric_requests").select("*, clients(id, company)").order("created_at", { ascending: false }),
      supabase.from("psychometric_people").select("*").order("position"),
    ]);
    if (error || !requests) return [];
    const byRequest: Record<string, PsychometricPerson[]> = {};
    for (const p of (people ?? []) as PsychometricPerson[]) {
      (byRequest[p.request_id] ??= []).push(p);
    }
    return (requests as PsychometricRequestFull[]).map((r) => ({ ...r, people: byRequest[r.id] ?? [] }));
  } catch {
    return [];
  }
}
