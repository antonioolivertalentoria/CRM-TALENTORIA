import { createClient } from "@/lib/supabase/server";
import { computeTasks, customToComputed, sortByDue } from "@/lib/tasks";
import { computeConsultingTasks, type ConsultingProjectFull } from "@/lib/consulting-tasks";
import { computeRecruitmentTasks, type RecruitmentVacancyFull } from "@/lib/recruitment-tasks";
import { todayISO } from "@/lib/format";
import { fetchFacilitators, internalFacilitatorNames } from "@/lib/facilitators";
import { canSeeConsulting } from "@/lib/consulting-access";
import { canSeeRecruitment } from "@/lib/recruitment-access";
import { TasksList } from "@/components/TasksList";
import { NewTaskForm } from "@/components/NewTaskForm";
import { CompletedCustomTasks } from "@/components/CompletedCustomTasks";
import { ReminderSettings } from "@/components/ReminderSettings";
import type {
  Client,
  CustomTask,
  Material,
  Profile,
  Session,
  Subtask,
  TaskAttachment,
  TaskProgress,
  TaskProgressNote,
  TimeEntry,
  Training,
  TrainingRequest,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = await createClient();

  const [
    { data: trainingsData },
    { data: profilesData },
    { data: customData },
    { data: completedData },
    { data: clientsData },
    { data: attachmentsData },
    userRes,
    facilitators,
    { data: timeData },
    { data: subtasksData },
    { data: requestsData },
    { data: consultingData },
    { data: cMilestonesData },
    { data: cInputsData },
    { data: cChangesData },
    { data: vacanciesData },
    { data: rCandidatesData },
    { data: progressData },
    { data: progressNotesData },
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
    supabase.from("task_attachments").select("*").order("created_at"),
    supabase.auth.getUser(),
    fetchFacilitators(supabase),
    // Tolerantes a que las migraciones 008/009/011 no hayan corrido aún:
    // si la tabla no existe, data llega null y seguimos con listas vacías.
    supabase.from("time_entries").select("*").order("created_at"),
    supabase.from("subtasks").select("*").order("position"),
    supabase.from("training_requests").select("*").order("position"),
    supabase.from("consulting_projects").select("*, clients(id, company)"),
    supabase.from("consulting_milestones").select("*"),
    supabase.from("consulting_inputs").select("*"),
    supabase.from("consulting_changes").select("*"),
    // Reclutamiento (migración 015): tolerante a que aún no exista
    supabase.from("recruitment_vacancies").select("*, clients(id, company)"),
    supabase.from("recruitment_candidates").select("*"),
    // Avance de tareas (migración 016): tolerante a que aún no exista
    supabase.from("task_progress").select("*"),
    supabase.from("task_progress_notes").select("*").order("created_at"),
  ]);

  // Peticiones de team building, colgadas de su training para el motor de tareas
  const allRequests = (requestsData ?? []) as unknown as TrainingRequest[];
  const requestsByTraining: Record<string, TrainingRequest[]> = {};
  for (const r of allRequests) {
    (requestsByTraining[r.training_id] ??= []).push(r);
  }

  const trainings = ((trainingsData ?? []) as unknown as (Training & {
    clients: Pick<Client, "id" | "company"> | null;
    sessions: Session[];
    materials: Material[];
  })[]).map((t) => ({ ...t, training_requests: requestsByTraining[t.id] ?? [] }));
  const profiles = (profilesData ?? []) as unknown as Profile[];
  const customTasks = (customData ?? []) as unknown as CustomTask[];
  const completedTasks = (completedData ?? []) as unknown as (CustomTask & {
    clients?: { id: string; company: string } | null;
  })[];
  const clients = (clientsData ?? []) as unknown as Pick<Client, "id" | "company">[];

  // Adjuntos agrupados por tarea, para pasarlos ya listos a cada fila
  const attachments = (attachmentsData ?? []) as unknown as TaskAttachment[];
  const attachmentsByTask: Record<string, TaskAttachment[]> = {};
  for (const a of attachments) {
    (attachmentsByTask[a.task_id] ??= []).push(a);
  }
  const clientNameById = Object.fromEntries(clients.map((c) => [c.id, c.company]));

  // Tiempo invertido agrupado por tarea (y completo, para la sumatoria)
  const timeEntries = (timeData ?? []) as unknown as TimeEntry[];
  const timeByTask: Record<string, TimeEntry[]> = {};
  for (const e of timeEntries) {
    (timeByTask[e.task_key] ??= []).push(e);
  }

  // Subtareas agrupadas por tarea propia
  const subtasks = (subtasksData ?? []) as unknown as Subtask[];
  const subtasksByTask: Record<string, Subtask[]> = {};
  for (const s of subtasks) {
    (subtasksByTask[s.task_id] ??= []).push(s);
  }

  // Tareas empezadas pero sin cerrar, con su bitácora de avances
  const progressByTask: Record<string, TaskProgress> = {};
  for (const pr of (progressData ?? []) as unknown as TaskProgress[]) {
    progressByTask[pr.task_key] = pr;
  }
  const progressNotesByTask: Record<string, TaskProgressNote[]> = {};
  for (const n of (progressNotesData ?? []) as unknown as TaskProgressNote[]) {
    (progressNotesByTask[n.task_key] ??= []).push(n);
  }

  const currentProfile = profiles.find((p) => p.id === userRes.data.user?.id);
  const internalNames = internalFacilitatorNames(
    profiles.map((p) => p.full_name),
    facilitators
  );
  // Proyectos de consultoría con sus hitos/insumos/cambios colgados
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const consultingProjects: ConsultingProjectFull[] = ((consultingData ?? []) as any[]).map(
    (pr) => ({
      ...pr,
      milestones: ((cMilestonesData ?? []) as any[]).filter((m) => m.project_id === pr.id),
      inputs: ((cInputsData ?? []) as any[]).filter((i) => i.project_id === pr.id),
      changes: ((cChangesData ?? []) as any[]).filter((c) => c.project_id === pr.id),
    })
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Vacantes de reclutamiento con sus candidatos colgados
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const vacancies: RecruitmentVacancyFull[] = ((vacanciesData ?? []) as any[]).map((v) => ({
    ...v,
    candidates: ((rCandidatesData ?? []) as any[]).filter((c) => c.vacancy_id === v.id),
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const tasks = sortByDue([
    ...computeTasks(trainings, internalNames),
    // Mientras el módulo esté en estreno, sus tareas solo se mezclan
    // para quien puede verlo (misma lista que la pantalla de construcción)
    ...(canSeeConsulting(userRes.data.user?.email)
      ? computeConsultingTasks(consultingProjects)
      : []),
    // Reclutamiento en construcción: igual, solo para quien ve el módulo
    ...(canSeeRecruitment(userRes.data.user?.email)
      ? computeRecruitmentTasks(vacancies)
      : []),
    ...customToComputed(customTasks, clientNameById),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Mis tareas</h1>
          <p className="text-sm text-slate-500">
            Se generan solas a partir de capacitaciones, team buildings, consultorías y vacantes, y se mezclan con las tareas que
            capturen tú o Arianna. Al completarlas aquí, todo se actualiza también (y al revés).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
                  "Petición",
                  "Consultoría",
                  "Reclutamiento",
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
        attachmentsByTask={attachmentsByTask}
        timeByTask={timeByTask}
        allTimeEntries={timeEntries}
        subtasksByTask={subtasksByTask}
        progressByTask={progressByTask}
        progressNotesByTask={progressNotesByTask}
        currentUser={currentProfile?.full_name ?? "Todas"}
        today={todayISO()}
      />

      <CompletedCustomTasks tasks={completedTasks} />
    </div>
  );
}
