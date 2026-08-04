import { createClient } from "@/lib/supabase/server";
import { computeTasks, customToComputed, sortByDue } from "@/lib/tasks";
import { todayISO } from "@/lib/format";
import { EXTRA_FACILITATORS } from "@/lib/constants";
import { TasksList } from "@/components/TasksList";
import { NewTaskForm } from "@/components/NewTaskForm";
import { CompletedCustomTasks } from "@/components/CompletedCustomTasks";
import { ReminderSettings } from "@/components/ReminderSettings";
import type { Client, CustomTask, Material, Profile, Session, Training } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = await createClient();

  const [
    { data: trainingsData },
    { data: profilesData },
    { data: customData },
    { data: completedData },
    { data: clientsData },
    userRes,
  ] = await Promise.all([
    supabase
      .from("trainings")
      .select("*, clients(id, company), sessions(*), materials(*)")
      .order("created_at"),
    supabase.from("profiles").select("id, full_name, email, reminder_prefs").order("full_name"),
    supabase.from("custom_tasks").select("*").eq("status", "Pendiente").order("due_date"),
    supabase
      .from("custom_tasks")
      .select("*, clients(id, company)")
      .eq("status", "Completada")
      .order("completed_at", { ascending: false })
      .limit(30),
    supabase.from("clients").select("id, company").order("company"),
    supabase.auth.getUser(),
  ]);

  const trainings = (trainingsData ?? []) as unknown as (Training & {
    clients: Pick<Client, "id" | "company"> | null;
    sessions: Session[];
    materials: Material[];
  })[];
  const profiles = (profilesData ?? []) as unknown as Profile[];
  const customTasks = (customData ?? []) as unknown as CustomTask[];
  const completedTasks = (completedData ?? []) as unknown as (CustomTask & {
    clients?: { id: string; company: string } | null;
  })[];
  const clients = (clientsData ?? []) as unknown as Pick<Client, "id" | "company">[];
  const clientNameById = Object.fromEntries(clients.map((c) => [c.id, c.company]));

  const currentProfile = profiles.find((p) => p.id === userRes.data.user?.id);
  const internalNames = [...profiles.map((p) => p.full_name), ...EXTRA_FACILITATORS];
  const tasks = sortByDue([
    ...computeTasks(trainings, internalNames),
    ...customToComputed(customTasks, clientNameById),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Mis tareas</h1>
          <p className="text-sm text-slate-500">
            Se generan solas a partir de las capacitaciones y se mezclan con las tareas que
            capturen tú o Arianna. Al completarlas aquí, todo se actualiza también (y al revés).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/reporte-semanal"
            title="PDF con las tareas de los próximos 5 días hábiles, para enviar a dirección"
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-magenta/40 bg-brand-magenta/10 px-3 py-1.5 text-xs font-semibold text-brand-magenta transition hover:bg-brand-magenta/20"
          >
            📄 Reporte semanal (PDF)
          </a>
          <ReminderSettings
            prefs={
              currentProfile?.reminder_prefs ?? {
                enabled: true,
                kinds: [
                  "Logística",
                  "Preparación",
                  "Material",
                  "Revisión",
                  "Entrega",
                  "Seguimiento",
                  "Personal",
                ],
              }
            }
          />
        </div>
      </header>

      <NewTaskForm
        people={profiles.map((p) => p.full_name)}
        clients={clients}
        currentUser={currentProfile?.full_name ?? ""}
      />

      <TasksList
        tasks={tasks}
        people={profiles.map((p) => p.full_name)}
        clients={clients}
        currentUser={currentProfile?.full_name ?? "Todas"}
        today={todayISO()}
      />

      <CompletedCustomTasks tasks={completedTasks} />
    </div>
  );
}
