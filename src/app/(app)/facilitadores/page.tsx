import { createClient } from "@/lib/supabase/server";
import { fetchFacilitators } from "@/lib/facilitators";
import { FacilitatorsManager } from "@/components/FacilitatorsManager";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Catálogo de facilitadores: los nombres que se sugieren al capturar
 * sesiones y capacitaciones. Los usuarios del CRM (equipo) se sugieren
 * siempre; aquí se administran los demás.
 */
export default async function FacilitatorsPage() {
  const supabase = await createClient();

  const [facilitators, { data: profilesData }] = await Promise.all([
    fetchFacilitators(supabase),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  const profiles = (profilesData ?? []) as unknown as Pick<Profile, "id" | "full_name">[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-brand-navy">Facilitadores</h1>
        <p className="text-sm text-slate-500">
          Los nombres de este catálogo se sugieren al capturar el facilitador de una sesión
          o capacitación. El equipo del CRM ({profiles.map((p) => p.full_name.split(" ")[0]).join(", ") || "—"})
          se sugiere siempre, sin necesidad de agregarlo aquí.
        </p>
      </header>

      <FacilitatorsManager facilitators={facilitators} />
    </div>
  );
}
