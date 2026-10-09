import type { MarketingData } from "./marketing-tasks";

/**
 * Lee todo lo del módulo de Marketing para el motor de tareas ("Mis
 * tareas", recordatorios y reporte semanal). Tolerante a que la migración
 * 021 aún no exista: cada tabla que falte llega como lista vacía.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadMarketingData(supabase: any): Promise<MarketingData> {
  const [projects, steps, sends, leads, pages] = await Promise.all([
    supabase.from("marketing_projects").select("*").order("created_at"),
    supabase.from("marketing_steps").select("*"),
    supabase.from("marketing_sends").select("*").order("send_date").order("position"),
    supabase.from("marketing_leads").select("*").order("lead_date"),
    supabase.from("marketing_pages").select("*").order("position"),
  ]);
  return {
    projects: projects.data ?? [],
    steps: steps.data ?? [],
    sends: sends.data ?? [],
    leads: leads.data ?? [],
    pages: pages.data ?? [],
  };
}
