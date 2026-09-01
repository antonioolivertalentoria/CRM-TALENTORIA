import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canSeeRecruitment } from "@/lib/recruitment-access";
import { UnderConstruction } from "@/components/UnderConstruction";
import { updateRecruitmentField } from "@/lib/actions";
import {
  VACANCY_STATUSES,
  VACANCY_MODALITIES,
  RECRUITMENT_CHECKLIST,
  PROFILE_AUTH_STATUSES,
  CONTINUES_STATUSES,
  CHECK_STATUSES,
  PRIORITIES,
} from "@/lib/constants";
import { StatusSelect } from "@/components/StatusSelect";
import { EditableField } from "@/components/EditableField";
import { LinkChip } from "@/components/LinkChip";
import { OwnerSelect } from "@/components/OwnerSelect";
import { CandidatesSection, DeleteVacancyButton } from "@/components/CandidatesSection";
import { RecruitmentAttachments } from "@/components/RecruitmentAttachments";
import { addDays, formatDate, formatMinutes, todayISO } from "@/lib/format";
import type {
  Client,
  Profile,
  RecruitmentAttachment,
  RecruitmentCandidate,
  RecruitmentVacancy,
  TimeEntry,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VacancyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!canSeeRecruitment(userData.user?.email)) {
    return <UnderConstruction moduleName="Reclutamiento" />;
  }

  const { data } = await supabase
    .from("recruitment_vacancies")
    .select("*, clients(*)")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const vacancy = data as unknown as RecruitmentVacancy & { clients: Client };

  const [{ data: candidatesData }, { data: filesData }, { data: profilesData }, { data: timeData }] =
    await Promise.all([
      supabase.from("recruitment_candidates").select("*").eq("vacancy_id", id).order("position"),
      supabase.from("recruitment_attachments").select("*").eq("vacancy_id", id).order("created_at"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase.from("time_entries").select("task_key, minutes"),
    ]);

  const candidates = (candidatesData ?? []) as unknown as RecruitmentCandidate[];
  const files = (filesData ?? []) as unknown as RecruitmentAttachment[];
  const profiles = (profilesData ?? []) as unknown as Pick<Profile, "id" | "full_name">[];
  const people = profiles.map((p) => p.full_name);

  // Archivos agrupados por candidato, para el clip 📎 de cada renglón
  const filesByCandidate: Record<string, RecruitmentAttachment[]> = {};
  const itemLabels: Record<string, string> = {};
  const candidateName = Object.fromEntries(candidates.map((c) => [c.id, c.name]));
  for (const f of files) {
    if (f.candidate_id) {
      (filesByCandidate[f.candidate_id] ??= []).push(f);
      if (candidateName[f.candidate_id]) itemLabels[f.id] = candidateName[f.candidate_id];
    }
  }

  // Tiempo ⏱ invertido en la vacante (todas sus tareas llevan recl-<id>-)
  const spentMinutes = ((timeData ?? []) as unknown as Pick<TimeEntry, "task_key" | "minutes">[])
    .filter((e) => e.task_key.startsWith(`recl-${id}-`))
    .reduce((a, e) => a + e.minutes, 0);

  const save = (field: string) => updateRecruitmentField.bind(null, vacancy.id, field);

  const today = todayISO();
  const guaranteeEnd = vacancy.hire_date
    ? addDays(vacancy.hire_date, vacancy.guarantee_days ?? 90)
    : null;
  const enTerna = candidates.filter((c) =>
    ["Enviado al cliente", "Aprobado por cliente", "Psicometría", "Referencias", "Contratado"].includes(c.status)
  ).length;

  return (
    <div className="space-y-6">
      <nav className="flex items-center justify-between text-sm text-slate-400">
        <span>
          <Link href="/reclutamiento" className="hover:text-brand-cyan-dark hover:underline">
            Reclutamiento
          </Link>{" "}
          /{" "}
          <Link href={`/clientes/${vacancy.clients.id}`} className="hover:text-brand-cyan-dark hover:underline">
            {vacancy.clients.company}
          </Link>{" "}
          / <span className="text-slate-600">{vacancy.position}</span>
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
              value={vacancy.position}
              onSave={save("position")}
              className="!text-2xl font-bold !text-brand-navy"
            />
            <p className="mt-1 px-2 text-xs text-slate-400">
              Comercial: {vacancy.comercial || "—"} · Requisición recibida:{" "}
              {vacancy.requisition_at ? formatDate(vacancy.requisition_at) : "sin fecha"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusSelect value={vacancy.status} options={VACANCY_STATUSES} onChange={save("status")} />
            <StatusSelect value={vacancy.priority} options={PRIORITIES} onChange={save("priority")} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta"
              style={{ width: `${Math.min(enTerna / 3, 1) * 100}%` }}
            />
          </div>
          <span className="text-sm font-medium text-slate-500">
            {enTerna} de 3 a 5 candidatos en terna · {candidates.length} en base
          </span>
          {spentMinutes > 0 && (
            <span className="text-sm text-slate-400" title="Horas registradas con el cuadrito ⏱ en las tareas de la vacante">
              · ⏱ <span className="font-medium text-slate-600">{formatMinutes(spentMinutes)}</span>
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-4">
          <LinkChip label="Publicación" url={vacancy.vacancy_url} onSave={save("vacancy_url")} />
          <LinkChip label="Carpeta Drive" url={vacancy.drive_folder_url} onSave={save("drive_folder_url")} />
          <LinkChip label="Grupo WhatsApp" url={vacancy.whatsapp_group} onSave={save("whatsapp_group")} />
        </div>
      </header>

      {/* Información de la vacante */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Información de la vacante
        </h2>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold text-slate-400">Reclutador</p>
            <OwnerSelect value={vacancy.recruiter} people={people} onChange={save("recruiter")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Comercial</p>
            <OwnerSelect value={vacancy.comercial} people={people} onChange={save("comercial")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Operaciones (respaldo)</p>
            <OwnerSelect value={vacancy.internal_owner} people={people} onChange={save("internal_owner")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Plazas</p>
            <EditableField value={vacancy.openings?.toString() ?? "1"} type="number" onSave={save("openings")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Sueldo ofrecido</p>
            <EditableField value={vacancy.salary} onSave={save("salary")} placeholder="Ej. $35,000 brutos" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Ubicación</p>
            <EditableField value={vacancy.location} onSave={save("location")} placeholder="Ciudad" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Modalidad</p>
            <StatusSelect
              value={vacancy.modality || "Por definir"}
              options={VACANCY_MODALITIES}
              onChange={save("modality")}
              small
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400" title="Tope de gasto en medios de publicación (paso 9)">
              Presupuesto de reclutamiento
            </p>
            <EditableField value={vacancy.budget?.toString() ?? ""} type="number" onSave={save("budget")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400" title="Días naturales de garantía sobre la contratación">
              Garantía (días)
            </p>
            <EditableField
              value={vacancy.guarantee_days?.toString() ?? "90"}
              type="number"
              onSave={save("guarantee_days")}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-400">Perfil (levantamiento con el cliente)</p>
            <EditableField
              value={vacancy.perfil}
              onSave={save("perfil")}
              multiline
              rows={4}
              placeholder="Funciones, requisitos, experiencia, competencias…"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-400">Estrategia y medios de publicación</p>
            <EditableField
              value={vacancy.publication_media}
              onSave={save("publication_media")}
              multiline
              rows={4}
              placeholder="OCC, LinkedIn, bolsas universitarias, referidos…"
            />
          </div>
        </div>
      </section>

      {/* Línea de tiempo del proceso */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Fechas del proceso
        </h2>
        <p className="mb-3 mt-0.5 text-xs text-slate-400">
          Todos los plazos del flujo cuelgan de estas fechas. La de la requisición es el inicio de
          tiempos; la de ingreso dispara facturación, avisos y el reloj de la garantía.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <p className="mb-2 text-xs font-bold text-brand-navy">📥 Requisición (paso 4)</p>
            <EditableField value={vacancy.requisition_at ?? ""} type="date" onSave={save("requisition_at")} />
            <p className="mt-1 text-[11px] text-slate-400">Inicio de tiempos del proceso.</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <p className="mb-2 text-xs font-bold text-brand-navy">🗓️ Reunión de levantamiento (paso 6)</p>
            <EditableField
              value={vacancy.profile_meeting_date ?? ""}
              type="date"
              onSave={save("profile_meeting_date")}
            />
            <p className="mt-1 text-[11px] text-slate-400">Máximo 48h desde la requisición.</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <p className="mb-2 text-xs font-bold text-brand-navy">✍️ Autorización del perfil (paso 8)</p>
            <StatusSelect
              value={vacancy.levantamiento_autorizado}
              options={PROFILE_AUTH_STATUSES}
              onChange={save("levantamiento_autorizado")}
              small
            />
            <p className="mt-1.5 text-[11px] text-slate-400">
              {vacancy.profile_authorized_at
                ? `Autorizado ${formatDate(vacancy.profile_authorized_at)}`
                : "Si el cliente pide cambios, se regresa al paso 5."}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <p className="mb-2 text-xs font-bold text-brand-navy">📣 Publicación (paso 10)</p>
            <EditableField value={vacancy.published_at ?? ""} type="date" onSave={save("published_at")} />
            <p className="mt-1 text-[11px] text-slate-400">Máx. 24h desde la autorización.</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <p className="mb-2 text-xs font-bold text-brand-navy">👥 Terna enviada (paso 15)</p>
            <EditableField
              value={vacancy.candidates_sent_at ?? ""}
              type="date"
              onSave={save("candidates_sent_at")}
            />
            <p className="mt-1 text-[11px] text-slate-400">De 8 a 10 días hábiles desde la publicación.</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <p className="mb-2 text-xs font-bold text-brand-navy">🎯 Fecha de ingreso (paso 20)</p>
            <EditableField value={vacancy.hire_date ?? ""} type="date" onSave={save("hire_date")} />
            <p className="mt-1 text-[11px] text-slate-400">
              {guaranteeEnd
                ? `Garantía hasta ${formatDate(guaranteeEnd)}${guaranteeEnd < today ? " (terminada)" : ""}`
                : "Dispara facturación, avisos y garantía."}
            </p>
          </div>
        </div>

        {vacancy.hire_date && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <p className="text-xs font-bold text-brand-navy">
              🛡️ ¿La persona continúa en la empresa al terminar la garantía?
            </p>
            <StatusSelect
              value={vacancy.continua_persona}
              options={CONTINUES_STATUSES}
              onChange={save("continua_persona")}
              small
            />
            <p className="text-[11px] text-slate-400">
              Si marcas &quot;No&quot;, aparece en tus tareas la reposición: reinicia la búsqueda desde
              la publicación conservando candidatos e historial.
            </p>
          </div>
        )}
      </section>

      <CandidatesSection
        vacancyId={vacancy.id}
        candidates={candidates}
        filesByCandidate={filesByCandidate}
      />

      <RecruitmentAttachments vacancyId={vacancy.id} attachments={files} itemLabels={itemLabels} />

      {/* Checklist del proceso */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Checklist del proceso
        </h2>
        <p className="mb-4 mt-0.5 text-xs text-slate-400">
          Los puntos pendientes generan sus tareas con los plazos del Flujo del Proceso de
          Reclutamiento.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RECRUITMENT_CHECKLIST.map((f) => (
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
                value={(vacancy as unknown as Record<string, string>)[f.key] ?? "Pendiente"}
                options={CHECK_STATUSES}
                onChange={save(f.key)}
                small
              />
            </div>
          ))}
        </div>
      </section>

      {/* Notas */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Notas de la vacante
          </h3>
          <EditableField
            value={vacancy.notes}
            onSave={save("notes")}
            multiline
            placeholder="Acuerdos con el cliente, avances, pendientes…"
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Observaciones internas
          </h3>
          <EditableField
            value={vacancy.internal_notes}
            onSave={save("internal_notes")}
            multiline
            placeholder="Solo para el equipo…"
          />
        </div>
      </section>

      <footer className="flex justify-end border-t border-slate-200 pt-4">
        <DeleteVacancyButton
          vacancyId={vacancy.id}
          clientId={vacancy.clients.id}
          position={vacancy.position}
        />
      </footer>
    </div>
  );
}
