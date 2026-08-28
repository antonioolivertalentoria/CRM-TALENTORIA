import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canSeeConsulting } from "@/lib/consulting-access";
import { UnderConstruction } from "@/components/UnderConstruction";
import { updateConsultingField } from "@/lib/actions";
import {
  CONSULTING_STATUSES,
  CONSULTING_CHECKLIST,
  CHECK_STATUSES,
  PRIORITIES,
} from "@/lib/constants";
import { StatusSelect } from "@/components/StatusSelect";
import { EditableField } from "@/components/EditableField";
import { LinkChip } from "@/components/LinkChip";
import { OwnerSelect } from "@/components/OwnerSelect";
import {
  MilestonesSection,
  InputsSection,
  ChangesSection,
  DeleteConsultingButton,
} from "@/components/ConsultingSections";
import { ConsultingAttachments } from "@/components/ConsultingAttachments";
import { fetchFacilitators, facilitatorSuggestions } from "@/lib/facilitators";
import { formatMinutes } from "@/lib/format";
import type {
  Client,
  ConsultingAttachment,
  ConsultingChange,
  ConsultingInput,
  ConsultingMilestone,
  ConsultingProject,
  Profile,
  TimeEntry,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConsultingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!canSeeConsulting(userData.user?.email)) {
    return <UnderConstruction moduleName="Consultoría" />;
  }

  const { data } = await supabase
    .from("consulting_projects")
    .select("*, clients(*)")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const project = data as unknown as ConsultingProject & { clients: Client };

  const [
    { data: milestonesData },
    { data: inputsData },
    { data: changesData },
    { data: filesData },
    { data: profilesData },
    { data: timeData },
    catalog,
  ] = await Promise.all([
    supabase.from("consulting_milestones").select("*").eq("project_id", id).order("position"),
    supabase.from("consulting_inputs").select("*").eq("project_id", id).order("created_at"),
    supabase.from("consulting_changes").select("*").eq("project_id", id).order("created_at"),
    supabase.from("consulting_attachments").select("*").eq("project_id", id).order("created_at"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase.from("time_entries").select("task_key, minutes"),
    fetchFacilitators(supabase),
  ]);

  const milestones = (milestonesData ?? []) as unknown as ConsultingMilestone[];
  const inputs = (inputsData ?? []) as unknown as ConsultingInput[];
  const changes = (changesData ?? []) as unknown as ConsultingChange[];
  const files = (filesData ?? []) as unknown as ConsultingAttachment[];
  const profiles = (profilesData ?? []) as unknown as Pick<Profile, "id" | "full_name">[];
  const people = profiles.map((p) => p.full_name);
  const suggestions = facilitatorSuggestions(people, catalog);

  // Tiempo ⏱ invertido en el proyecto (todas sus tareas llevan cons-<id>-)
  const spentMinutes = ((timeData ?? []) as unknown as Pick<TimeEntry, "task_key" | "minutes">[])
    .filter((e) => e.task_key.startsWith(`cons-${id}-`))
    .reduce((a, e) => a + e.minutes, 0);

  const save = (field: string) => updateConsultingField.bind(null, project.id, field);
  const doneMilestones = milestones.filter((m) => m.status === "Entregado").length;

  return (
    <div className="space-y-6">
      <nav className="flex items-center justify-between text-sm text-slate-400">
        <span>
          <Link href="/consultoria" className="hover:text-brand-cyan-dark hover:underline">Consultoría</Link>{" "}
          /{" "}
          <Link href={`/clientes/${project.clients.id}`} className="hover:text-brand-cyan-dark hover:underline">
            {project.clients.company}
          </Link>{" "}
          / <span className="text-slate-600">{project.name}</span>
        </span>
        <span className="text-xs text-slate-400" title="Los campos se guardan al salir de ellos o al elegir una opción.">
          ✓ Todo se guarda automáticamente
        </span>
      </nav>

      {/* Encabezado */}
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-64 flex-1">
            <EditableField
              value={project.name}
              onSave={save("name")}
              className="!text-2xl font-bold !text-brand-navy"
            />
            <p className="mt-1 px-2 text-xs text-slate-400">
              Comercial: {project.comercial || "—"} · Autorizado: {project.authorized_at ?? "sin fecha"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusSelect value={project.status} options={CONSULTING_STATUSES} onChange={save("status")} />
            <StatusSelect value={project.priority} options={PRIORITIES} onChange={save("priority")} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta"
              style={{ width: milestones.length ? `${(doneMilestones / milestones.length) * 100}%` : "0%" }}
            />
          </div>
          <span className="text-sm font-medium text-slate-500">
            {doneMilestones} de {milestones.length || "?"} hitos entregados
          </span>
          <span
            className="text-sm text-slate-400"
            title="Horas registradas con el cuadrito ⏱ en las tareas del proyecto, contra las contratadas"
          >
            · ⏱ <span className="font-medium text-slate-600">{formatMinutes(spentMinutes)}</span>
            {project.contracted_hours ? (
              <> de <span className="font-medium text-slate-600">{project.contracted_hours} h contratadas</span></>
            ) : (
              " registradas"
            )}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-4">
          <LinkChip label="Carpeta Drive" url={project.drive_folder_url} onSave={save("drive_folder_url")} />
          <LinkChip label="Grupo WhatsApp" url={project.whatsapp_group} onSave={save("whatsapp_group")} />
        </div>
      </header>

      {/* Información general */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Información general
        </h2>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold text-slate-400">Líder de proyecto</p>
            <OwnerSelect value={project.leader} people={people} onChange={save("leader")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Operaciones (revisiones y cierre)</p>
            <OwnerSelect value={project.internal_owner} people={people} onChange={save("internal_owner")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Comercial</p>
            <OwnerSelect value={project.comercial} people={people} onChange={save("comercial")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400" title="Nombres separados por coma; reciben las invitaciones de calendario">Equipo consultor</p>
            <EditableField value={project.team} onSave={save("team")} placeholder="Nombres separados por coma" suggestions={suggestions} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Fecha de autorización</p>
            <EditableField value={project.authorized_at ?? ""} type="date" onSave={save("authorized_at")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Horas contratadas</p>
            <EditableField value={project.contracted_hours?.toString() ?? ""} type="number" onSave={save("contracted_hours")} />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-400">Alcance</p>
            <EditableField value={project.alcance} onSave={save("alcance")} multiline rows={3} placeholder="Qué incluye el proyecto…" />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-400">Entregables pactados</p>
            <EditableField value={project.entregables} onSave={save("entregables")} multiline rows={3} placeholder="Qué se entrega al cliente…" />
          </div>
        </div>
      </section>

      {/* Reuniones clave: generan invitaciones de calendario */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Reuniones clave</h2>
        <p className="mb-3 mt-0.5 text-xs text-slate-400">
          Al capturar fecha y hora se manda la invitación de Google Calendar al equipo
          (líder, comercial, operaciones y equipo consultor); si cambian, llega la actualización sola.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <p className="mb-2 text-xs font-bold text-brand-navy">🧭 Reunión de arranque</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[11px] font-medium text-slate-400">Fecha</p>
                <EditableField value={project.kickoff_date ?? ""} type="date" onSave={save("kickoff_date")} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Inicio</p>
                <EditableField value={project.kickoff_start?.slice(0, 5) ?? ""} type="time" onSave={save("kickoff_start")} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Fin</p>
                <EditableField value={project.kickoff_end?.slice(0, 5) ?? ""} type="time" onSave={save("kickoff_end")} />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <p className="mb-2 text-xs font-bold text-brand-navy">🏁 Reunión de entrega</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[11px] font-medium text-slate-400">Fecha</p>
                <EditableField value={project.delivery_date ?? ""} type="date" onSave={save("delivery_date")} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Inicio</p>
                <EditableField value={project.delivery_start?.slice(0, 5) ?? ""} type="time" onSave={save("delivery_start")} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Fin</p>
                <EditableField value={project.delivery_end?.slice(0, 5) ?? ""} type="time" onSave={save("delivery_end")} />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Desde esta fecha corren factura (mismo día), encuesta (48h), cierre (3 días) y seguimiento (+20).
            </p>
          </div>
        </div>
      </section>

      <MilestonesSection projectId={project.id} milestones={milestones} people={suggestions} />

      <InputsSection projectId={project.id} inputs={inputs} />

      <ChangesSection projectId={project.id} changes={changes} />

      {/* Checklist del proceso */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Checklist del proceso
        </h2>
        <p className="mb-4 mt-0.5 text-xs text-slate-400">
          Los puntos pendientes generan sus tareas con los plazos del Mapa del Proceso de Consultoría.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONSULTING_CHECKLIST.map((f) => (
            <div
              key={f.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5"
              title={f.hint}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-700">{f.label}</p>
                <p className="truncate text-[11px] text-slate-400">{f.hint}</p>
              </div>
              <StatusSelect
                value={(project as unknown as Record<string, string>)[f.key] ?? "Pendiente"}
                options={CHECK_STATUSES}
                onChange={save(f.key)}
                small
              />
            </div>
          ))}
        </div>
      </section>

      <ConsultingAttachments projectId={project.id} attachments={files} />

      {/* Notas */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Notas del proyecto
          </h3>
          <EditableField value={project.notes} onSave={save("notes")} multiline placeholder="Acuerdos, minutas, avances…" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Observaciones internas
          </h3>
          <EditableField value={project.internal_notes} onSave={save("internal_notes")} multiline placeholder="Solo para el equipo…" />
        </div>
      </section>

      <footer className="flex justify-end border-t border-slate-200 pt-4">
        <DeleteConsultingButton projectId={project.id} clientId={project.clients.id} name={project.name} />
      </footer>
    </div>
  );
}
