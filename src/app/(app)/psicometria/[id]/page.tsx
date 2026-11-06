import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canSeePsychometrics } from "@/lib/psychometrics-access";
import { UnderConstruction } from "@/components/UnderConstruction";
import { updatePsychometricField } from "@/lib/actions";
import { CHECK_STATUSES, INFO_COMPLETE_STATUSES, PSYCHOMETRIC_REPORT_TYPES } from "@/lib/constants";
import { activePeople, nextPhaseHint, psychometricPhase } from "@/lib/psychometric-tasks";
import { StatusSelect } from "@/components/StatusSelect";
import { EditableField } from "@/components/EditableField";
import { LinkChip } from "@/components/LinkChip";
import { OwnerSelect } from "@/components/OwnerSelect";
import { DeletePsychometricButton, PsychometricPeopleSection } from "@/components/PsychometricPeopleSection";
import { formatDate, formatMinutes } from "@/lib/format";
import type { Client, Profile, PsychometricPerson, PsychometricRequest, TimeEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PsychometricDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!canSeePsychometrics(userData.user?.email)) {
    return <UnderConstruction moduleName="Psicometría" />;
  }

  const { data } = await supabase
    .from("psychometric_requests")
    .select("*, clients(*)")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const request = data as unknown as PsychometricRequest & { clients: Client };

  const [{ data: peopleData }, { data: profilesData }, { data: timeData }] = await Promise.all([
    supabase.from("psychometric_people").select("*").eq("request_id", id).order("position"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase.from("time_entries").select("task_key, minutes"),
  ]);

  const people = (peopleData ?? []) as unknown as PsychometricPerson[];
  const profiles = (profilesData ?? []) as unknown as Pick<Profile, "id" | "full_name">[];
  const team = profiles.map((p) => p.full_name);

  // Tiempo ⏱ invertido en la solicitud (todas sus tareas llevan psic-<id>-)
  const spentMinutes = ((timeData ?? []) as unknown as Pick<TimeEntry, "task_key" | "minutes">[])
    .filter((e) => e.task_key.startsWith(`psic-${id}-`))
    .reduce((a, e) => a + e.minutes, 0);

  const save = (field: string) => updatePsychometricField.bind(null, request.id, field);

  const active = activePeople(people);
  const delivered = active.filter((p) => p.delivered_at).length;

  // La fase va sola: el menú solo ofrece la que le toca, pausar y cancelar
  // (y, si está pausada o cancelada, la fase a la que regresaría).
  const phaseOptions = [...new Set([request.status, psychometricPhase(people), "Pausada", "Cancelada"])];

  return (
    <div className="space-y-6">
      <nav className="flex items-center justify-between text-sm text-slate-400">
        <span>
          <Link href="/psicometria" className="hover:text-brand-cyan-dark hover:underline">
            Psicometría
          </Link>{" "}
          /{" "}
          <Link href={`/clientes/${request.clients.id}`} className="hover:text-brand-cyan-dark hover:underline">
            {request.clients.company}
          </Link>{" "}
          / <span className="text-slate-600">{request.title}</span>
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
              value={request.title}
              onSave={save("title")}
              className="!text-2xl font-bold !text-brand-navy"
            />
            <p className="mt-1 px-2 text-xs text-slate-400">
              Requisición recibida:{" "}
              {request.requisition_at ? formatDate(request.requisition_at) : "sin fecha"}
              {nextPhaseHint(request.status) ? ` · ${nextPhaseHint(request.status)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2" title="La fase avanza sola con las personas; a mano solo se pausa o se cancela.">
            <StatusSelect value={request.status} options={phaseOptions} onChange={save("status")} />
            <StatusSelect value={request.report_type} options={PSYCHOMETRIC_REPORT_TYPES} onChange={save("report_type")} />
          </div>
        </div>

        {request.status === "Pausada" && (
          <p className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            ⏸ <span className="font-semibold">Solicitud pausada.</span> Mientras siga así no genera
            tareas ni recordatorios. Para reanudarla elige cualquier fase: el CRM la pone en la que le
            toca según cómo van las personas.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta"
              style={{ width: `${active.length ? (delivered / active.length) * 100 : 0}%` }}
            />
          </div>
          <span className="text-sm font-medium text-slate-500">
            {delivered} de {active.length} reportes entregados
          </span>
          {spentMinutes > 0 && (
            <span className="text-sm text-slate-400" title="Horas registradas con el cuadrito ⏱ en las tareas de la solicitud">
              · ⏱ <span className="font-medium text-slate-600">{formatMinutes(spentMinutes)}</span>
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-4">
          <LinkChip label="Carpeta Drive" url={request.drive_folder_url} onSave={save("drive_folder_url")} />
          <LinkChip label="Grupo WhatsApp" url={request.whatsapp_group} onSave={save("whatsapp_group")} />
        </div>
      </header>

      {/* Datos de la solicitud */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Datos de la solicitud
        </h2>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold text-slate-400">Psicometría (responsable)</p>
            <OwnerSelect value={request.evaluator} people={team} onChange={save("evaluator")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Comercial</p>
            <OwnerSelect value={request.comercial} people={team} onChange={save("comercial")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Requisición (paso 1)</p>
            <EditableField value={request.requisition_at ?? ""} type="date" onSave={save("requisition_at")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400" title="Topa el plazo del reporte de cada persona">
              Reportes para el cliente
            </p>
            <EditableField value={request.client_deadline ?? ""} type="date" onSave={save("client_deadline")} />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-400">Pruebas a aplicar</p>
            <EditableField
              value={request.tests}
              onSave={save("tests")}
              multiline
              rows={4}
              placeholder="MMPI, I-IPG, Asertividad, Competencias…"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-400">
              Ligas de las pruebas (van en el mensaje 💬 de cada persona)
            </p>
            <EditableField
              value={request.test_links}
              onSave={save("test_links")}
              multiline
              rows={4}
              placeholder={"Liga 1 (1 hora aprox.): https://…\nLiga 2 (30 minutos aprox.): https://…"}
            />
          </div>
        </div>
      </section>

      {/* Arranque: pasos 1-4 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Arranque</h2>
        <p className="mb-3 mt-0.5 text-xs text-slate-400">
          Antes de mandar las pruebas: se revisa la requisición (24h) y Comercial confirma que la
          información está completa y el proyecto es viable (mismo día). Si falta algo, Comercial
          tiene 24h para completarlo. La factura (pasos 2 y 5) se lleva fuera del CRM.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700">Requisición revisada</p>
              <p className="text-[11px] text-slate-400">
                Paso 1 — Datos de las personas y dudas aclaradas con el cliente (máx. 24h)
              </p>
            </div>
            <StatusSelect
              value={request.requisicion_revisada}
              options={CHECK_STATUSES}
              onChange={save("requisicion_revisada")}
              small
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700">¿Información completa y proyecto viable?</p>
              <p className="text-[11px] text-slate-400">
                Pasos 3-4 — Lo confirma Comercial
                {request.info_checked_at ? ` · ${formatDate(request.info_checked_at)}` : ""}
              </p>
            </div>
            <StatusSelect
              value={request.info_completa}
              options={INFO_COMPLETE_STATUSES}
              onChange={save("info_completa")}
              small
            />
          </div>
        </div>
      </section>

      <PsychometricPeopleSection request={request} people={people} clientName={request.clients.company} />

      {/* Notas */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Notas de la solicitud
          </h3>
          <EditableField
            value={request.notes}
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
            value={request.internal_notes}
            onSave={save("internal_notes")}
            multiline
            placeholder="Solo para el equipo…"
          />
        </div>
      </section>

      <footer className="flex justify-end border-t border-slate-200 pt-4">
        <DeletePsychometricButton
          requestId={request.id}
          clientId={request.clients.id}
          title={request.title}
        />
      </footer>
    </div>
  );
}
