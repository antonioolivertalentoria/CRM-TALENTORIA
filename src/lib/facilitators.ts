import { EXTRA_FACILITATORS } from "./constants";
import type { Facilitator } from "./types";

/** Cliente mínimo: nos sirve el de server o el de browser. */
type SupabaseLike = {
  from: (table: string) => {
    select: (cols: string) => {
      order: (col: string) => PromiseLike<{ data: unknown; error: unknown }>;
    };
  };
};

/**
 * Catálogo de facilitadores (migración 007). Tolerante: si la tabla aún
 * no existe en producción, regresa vacío y el resto del CRM sigue
 * funcionando con los nombres fijos de EXTRA_FACILITATORS.
 */
export async function fetchFacilitators(supabase: SupabaseLike): Promise<Facilitator[]> {
  try {
    const { data, error } = await supabase.from("facilitators").select("*").order("name");
    if (error) return [];
    return (data ?? []) as Facilitator[];
  } catch {
    return [];
  }
}

function dedupeNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const key = n.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(n.trim());
  }
  return out;
}

/** Nombres para sugerir en campos de facilitador: equipo + catálogo activo. */
export function facilitatorSuggestions(
  people: string[],
  facilitators: Facilitator[]
): string[] {
  const fromCatalog = facilitators.filter((f) => f.active).map((f) => f.name);
  // EXTRA_FACILITATORS se queda como respaldo mientras la migración 007
  // no corra en producción; el dedupe evita que salgan dobles.
  return dedupeNames([...people, ...fromCatalog, ...EXTRA_FACILITATORS]);
}

/**
 * Nombres considerados "internos" para el motor de tareas (contenido a
 * 7 días en vez de 14): el equipo del CRM + facilitadores marcados como
 * internos en el catálogo.
 */
export function internalFacilitatorNames(
  people: string[],
  facilitators: Facilitator[]
): string[] {
  const internal = facilitators.filter((f) => f.is_internal).map((f) => f.name);
  return dedupeNames([...people, ...internal, ...EXTRA_FACILITATORS]);
}
