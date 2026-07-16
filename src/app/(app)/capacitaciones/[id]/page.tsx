import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateTrainingField } from "@/lib/actions";
import {
  TRAINING_STATUSES,
  PRIORITIES,
  CHECK_STATUSES,
  CHECKLIST_FIELDS,
} from "@/lib/constants";
import { StatusSelect } from "@/components/StatusSelect";
import { EditableField } from "@/components/EditableField";
import { LinkChip } from "@/components/LinkChip";
import { SessionsTable } from "@/components/SessionsTable";
import { MaterialsSection } from "@/components/MaterialsSection";
import { DeleteTrainingButton } from "@/components/DeleteTrainingButton";
import { LogisticsMessage } from "@/components/LogisticsMessage";
import { OwnerSelect } from "@/components/OwnerSelect";
import type { Client, Training, Session, Material, MaterialComment, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TrainingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("trainings")
    .select("*, clients(*), sessions(*), materials(*)")
    .eq("id", id)
    .single();

  if (!data) notFound();

  const training = data as unknown as Training & {
    clients: Client;
    sessions: Session[];
    materials: Material[];
  };
  const sessions = [...training.sessions].sort(
    (a, b) => a.session_number - b.session_number
  );
  const materials = [...training.materials].sort((a, b) =>
    a.created_at < b.created_at ? -1 : 1
  );

  const [{ data: profilesData }, { data: commentsData }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    materials.length > 0
      ? supabase
          .from("material_comments")
          .select("*")
          .in("material_id", materials.map((m) => m.id))
          .order("created_at")
      : Promise.resolve({ data: [] }),
  ]);
  const profiles = (profilesData ?? []) as unknown as Profile[];
  const people = profiles.map((p) => p.full_name);
  const comments = (commentsData ?? []) as unknown as MaterialComment[];

  const save = (field: string) => updateTrainingField.bind(null, training.id, field);
  const done = sessions.filter((s) => s.status === "Impartida").length;
  const total = training.total_sessions ?? sessions.length;

  const active = sessions.filter((s) => s.status !== "Cancelada");
  const uniqueModalities = [...new Set(active.map((s) => s.modality).filter(Boolean))];
  const trainingModality =
    uniqueModalities.length === 0 ? "" : uniqueModalities.length === 1 ? uniqueModalities[0] : "Mixta";
  const totalHours = active.reduce((acc, s) => acc + (Number(s.duration_hours) || 0), 0);
  const facilitators = [...new Set(active.map((s) => s.facilitator).filter(Boolean))];

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-400">
        <Link href="/" className="hover:text-brand-cyan-dark hover:underline">Tablero</Link>{" "}
        /{" "}
        <Link href={`/clientes/${training.clients.id}`} className="hover:text-brand-cyan-dark hover:underline">
          {training.clients.company}
        </Link>{" "}
        / <span className="text-slate-600">{training.short_name}</span>
      </nav>

      {/* Encabezado */}
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-64 flex-1">
            <EditableField
              value={training.short_name}
              onSave={save("short_name")}
              className="!text-2xl font-bold !text-brand-navy"
            />
            <div className="mt-1 flex items-center gap-2 px-2 text-xs text-slate-400">
              <span>Nombre oficial:</span>
              <EditableField
                value={training.official_name}
                onSave={save("official_name")}
                placeholder="Como irá en constancias"
                className="!text-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusSelect
              value={training.status}
              options={TRAINING_STATUSES}
              onChange={save("status")}
            />
            <StatusSelect
              value={training.priority}
              options={PRIORITIES}
              onChange={save("priority")}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta"
              style={{ width: total ? `${(done / total) * 100}%` : "0%" }}
            />
          </div>
          <span className="text-sm font-medium text-slate-500">
            {done} de {total || "?"} sesiones impartidas
          </span>
          <span className="text-sm text-slate-400">
            {trainingModality && <>· <span className="font-medium text-slate-600">{trainingModality}</span></>}
            {totalHours > 0 && <> · <span className="font-medium text-slate-600">{totalHours} h totales</span></>}
            {facilitators.length > 0 && <> · Facilita: <span className="font-medium text-slate-600">{facilitators.join(", ")}</span></>}
          </span>
        </div>

        {/* Links siempre a la mano */}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-4">
          <LogisticsMessage
            trainingId={training.id}
            modalities={sessions.map((s) => s.modality)}
            whatsapp={training.clients.whatsapp}
            status={training.mensaje_logistica}
          />
          <LinkChip label="Carpeta Drive" url={training.drive_folder_url} onSave={save("drive_folder_url")} />
          <LinkChip label="Temario" url={training.temario_url} onSave={save("temario_url")} />
          <LinkChip label="Lista de participantes" url={training.participants_url} onSave={save("participants_url")} />
          <LinkChip label="Grupo WhatsApp" url={training.whatsapp_group} onSave={save("whatsapp_group")} />
        </div>
      </header>

      {/* Información general */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Información general
        </h2>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold text-slate-400">Responsable interno</p>
            <OwnerSelect value={training.internal_owner} people={people} onChange={save("internal_owner")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Total de sesiones</p>
            <EditableField value={training.total_sessions?.toString() ?? ""} type="number" onSave={save("total_sessions")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Fecha límite de materiales</p>
            <EditableField value={training.materials_deadline ?? ""} type="date" onSave={save("materials_deadline")} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Contacto del cliente</p>
            <EditableField value={training.client_contact} onSave={save("client_contact")} placeholder="Nombre del contacto" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Correo del contacto</p>
            <EditableField value={training.client_email} onSave={save("client_email")} placeholder="correo@empresa.com" />
          </div>
        </div>
      </section>

      {/* Respuestas logísticas del cliente */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Información logística confirmada
        </h2>
        <p className="mb-3 mt-0.5 text-xs text-slate-400">
          Pega aquí las respuestas del cliente al mensaje de logística (vestimenta, accesos,
          sala, participantes, estacionamiento…). Se respetan los saltos de línea y viñetas.
        </p>
        <EditableField
          value={training.logistics_info}
          onSave={save("logistics_info")}
          multiline
          rows={10}
          placeholder={"Ejemplo:\n• Vestimenta: casual, sin calzado de seguridad.\n• Acceso: registro en recepción con INE.\n• Sala: disponible 30 min antes, acomodo en herradura.\n• WiFi y proyector confirmados…"}
        />
      </section>

      <MaterialsSection
        trainingId={training.id}
        materials={materials}
        comments={comments}
        people={people}
      />

      <SessionsTable trainingId={training.id} sessions={sessions} people={people} />

      {/* Checklist post-capacitación */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Entregas y seguimiento
        </h2>
        <p className="mb-4 mt-0.5 text-xs text-slate-400">
          Según el proceso Talentoría: entregas en máximo 48h después del curso, cierre administrativo y seguimiento a 20 y 30 días.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHECKLIST_FIELDS.map((f) => (
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
                value={(training as unknown as Record<string, string>)[f.key] ?? "Pendiente"}
                options={CHECK_STATUSES}
                onChange={save(f.key)}
                small
              />
            </div>
          ))}
        </div>
      </section>

      {/* Notas */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Acciones específicas / notas
          </h3>
          <EditableField value={training.notes} onSave={save("notes")} multiline placeholder="Notas visibles del proyecto…" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Observaciones internas
          </h3>
          <EditableField value={training.internal_notes} onSave={save("internal_notes")} multiline placeholder="Solo para el equipo…" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Dudas por resolver
          </h3>
          <EditableField value={training.questions} onSave={save("questions")} multiline placeholder="¿Qué falta confirmar con el cliente?" />
        </div>
      </section>

      <footer className="flex justify-end border-t border-slate-200 pt-4">
        <DeleteTrainingButton
          trainingId={training.id}
          clientId={training.clients.id}
          name={training.short_name}
        />
      </footer>
    </div>
  );
}
