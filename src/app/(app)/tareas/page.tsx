import { createClient } from "@/lib/supabase/server";
import { computeTasks } from "@/lib/tasks";
import { todayISO } from "@/lib/format";
import { EXTRA_FACILITATORS } from "@/lib/constants";
import { TasksList } from "@/components/TasksList";
import { ReminderSettings } from "@/components/ReminderSettings";
import type { Client, Material, Profile, Session, Training } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = await createClient();

  const [{ data: trainingsData }, { data: profilesData }, userRes] = await Promise.all([
    supabase
      .from("trainings")
      .select("*, clients(id, company), sessions(*), materials(*)")
      .order("created_at"),
    supabase.from("profiles").select("id, full_name, email, reminder_prefs").order("full_name"),
    supabase.auth.getUser(),
  ]);

  const trainings = (trainingsData ?? []) as unknown as (Training & {
    clients: Pick<Client, "id" | "company"> | null;
    sessions: Session[];
    materials: Material[];
  })[];
  const profiles = (profilesData ?? []) as unknown as Profile[];

  const currentProfile = profiles.find((p) => p.id === userRes.data.user?.id);
  const internalNames = [...profiles.map((p) => p.full_name), ...EXTRA_FACILITATORS];
  const tasks = computeTasks(trainings, internalNames);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Mis tareas</h1>
          <p className="text-sm text-slate-500">
            Se generan solas a partir de las capacitaciones. Al completarlas aquí, la capacitación
            se actualiza también (y al revés).
          </p>
        </div>
        <ReminderSettings
          prefs={
            currentProfile?.reminder_prefs ?? {
              enabled: true,
              kinds: ["Logística", "Preparación", "Material", "Revisión", "Entrega", "Seguimiento"],
            }
          }
        />
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
