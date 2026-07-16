import { createClient } from "@/lib/supabase/server";
import { computeTasks } from "@/lib/tasks";
import { todayISO } from "@/lib/format";
import { TasksList } from "@/components/TasksList";
import type { Client, Material, Profile, Session, Training } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = await createClient();

  const [{ data: trainingsData }, { data: profilesData }, userRes] = await Promise.all([
    supabase
      .from("trainings")
      .select("*, clients(id, company), sessions(*), materials(*)")
      .order("created_at"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase.auth.getUser(),
  ]);

  const trainings = (trainingsData ?? []) as unknown as (Training & {
    clients: Pick<Client, "id" | "company"> | null;
    sessions: Session[];
    materials: Material[];
  })[];
  const profiles = (profilesData ?? []) as unknown as Profile[];

  const currentProfile = profiles.find((p) => p.id === userRes.data.user?.id);
  const tasks = computeTasks(trainings);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-brand-navy">Mis tareas</h1>
        <p className="text-sm text-slate-500">
          Se generan solas a partir de las capacitaciones. Al completarlas aquí, la capacitación
          se actualiza también (y al revés).
        </p>
      </header>

      <TasksList
        tasks={tasks}
        people={profiles.map((p) => p.full_name)}
        currentUser={currentProfile?.full_name ?? "Todas"}
        today={todayISO()}
      />
    </div>
  );
}
