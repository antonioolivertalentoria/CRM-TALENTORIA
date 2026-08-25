import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientEditForm } from "@/components/ClientEditForm";
import { NewClientForm } from "@/components/NewClientForm";
import { NewTrainingForm } from "@/components/NewTrainingForm";
import { NewConsultingForm } from "@/components/NewConsultingForm";
import { fetchFacilitators, facilitatorSuggestions } from "@/lib/facilitators";
import { statusColor } from "@/lib/constants";
import type { Client, ConsultingProject, Training, Session } from "@/lib/types";

export const dynamic = "force-dynamic";

type TrainingCard = Training & {
  sessions: Pick<Session, "id" | "status">[];
  clients?: Pick<Client, "id" | "company"> | null;
};

function TrainingCardLink({ t, subLabel }: { t: TrainingCard; subLabel?: string }) {
  const total = t.total_sessions ?? t.sessions.length;
  const done = t.sessions.filter((s) => s.status === "Impartida").length;
  return (
    <Link
      href={`/capacitaciones/${t.id}`}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-cyan hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-brand-navy">
          {t.short_name}
          {t.kind === "Team building" && (
            <span className="ml-1.5 align-middle rounded-full bg-brand-magenta/10 px-2 py-0.5 text-[10px] font-semibold text-brand-magenta">
              Team building
            </span>
          )}
        </p>
        <span
          className={`${statusColor(t.status)} shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white`}
        >
          {t.status}
        </span>
      </div>
      {subLabel && (
        <p className="mt-0.5 text-xs font-medium text-brand-cyan-dark">Para: {subLabel}</p>
      )}
      {t.official_name && t.official_name !== t.short_name && (
        <p className="mt-0.5 truncate text-xs text-slate-400">{t.official_name}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta"
            style={{ width: total ? `${(done / total) * 100}%` : "0%" }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium text-slate-500">
          {done}/{total || "?"} sesiones
        </span>
      </div>
    </Link>
  );
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const client = data as unknown as Client;

  const [
    { data: trainingsData },
    { data: profilesData },
    { data: allClientsData },
    userRes,
    catalog,
  ] = await Promise.all([
    supabase
      .from("trainings")
      .select("*, sessions(id, status)")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase.from("clients").select("id, company, parent_id").order("company"),
    supabase.auth.getUser(),
    fetchFacilitators(supabase),
  ]);
  const profiles = (profilesData ?? []) as { id: string; full_name: string }[];
  const people = profiles.map((p) => p.full_name);
  const currentUser =
    profiles.find((p) => p.id === userRes.data.user?.id)?.full_name ?? "";

  const allClients = (allClientsData ?? []) as Pick<Client, "id" | "company" | "parent_id">[];
  const parent = client.parent_id
    ? allClients.find((c) => c.id === client.parent_id) ?? null
    : null;
  const subclients = allClients.filter((c) => c.parent_id === client.id);
  // Posibles padres al editar: clientes directos que no sean este ni sus subclientes
  // (más el padre actual, para que siempre aparezca seleccionado).
  const parentOptions = allClients.filter(
    (c) =>
      c.id !== client.id &&
      c.parent_id !== client.id &&
      (!c.parent_id || c.id === client.parent_id)
  );

  const trainings = (trainingsData ?? []) as unknown as TrainingCard[];
  const courses = trainings.filter((t) => t.kind !== "Team building");
  const teamBuildings = trainings.filter((t) => t.kind === "Team building");

  // Proyectos de consultoría del cliente (tolerante a que falte la migración 013)
  const { data: consultingData } = await supabase
    .from("consulting_projects")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });
  const consulting = (consultingData ?? []) as unknown as ConsultingProject[];

  // Capacitaciones que este cliente dio a sus subclientes
  let subTrainings: TrainingCard[] = [];
  if (subclients.length > 0) {
    const { data: subTrainingsData } = await supabase
      .from("trainings")
      .select("*, sessions(id, status), clients(id, company)")
      .in("client_id", subclients.map((s) => s.id))
      .order("created_at", { ascending: false });
    subTrainings = (subTrainingsData ?? []) as unknown as TrainingCard[];
  }

  const recipients =
    subclients.length > 0
      ? [
          { id: client.id, label: `${client.company} (directo / público en general)` },
          ...subclients.map((s) => ({ id: s.id, label: s.company })),
        ]
      : undefined;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-400">
        <Link href="/clientes" className="hover:text-brand-cyan-dark hover:underline">
          Clientes
        </Link>{" "}
        {parent && (
          <>
            /{" "}
            <Link href={`/clientes/${parent.id}`} className="hover:text-brand-cyan-dark hover:underline">
              {parent.company}
            </Link>{" "}
          </>
        )}
        / <span className="text-slate-600">{client.company}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">{client.company}</h1>
          {parent && (
            <p className="text-sm text-slate-500">
              Subcliente de{" "}
              <Link href={`/clientes/${parent.id}`} className="font-medium text-brand-cyan-dark hover:underline">
                {parent.company}
              </Link>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <NewTrainingForm
            clientId={client.id}
            people={people}
            facilitators={facilitatorSuggestions(people, catalog)}
            currentUser={currentUser}
            recipients={recipients}
          />
          <NewTrainingForm
            clientId={client.id}
            people={people}
            facilitators={facilitatorSuggestions(people, catalog)}
            currentUser={currentUser}
            recipients={recipients}
            kind="Team building"
          />
          <NewConsultingForm clientId={client.id} people={people} currentUser={currentUser} />
        </div>
      </header>

      <ClientEditForm client={client} parents={parentOptions} parentName={parent?.company ?? ""} />

      {/* Subclientes (solo tiene sentido para clientes directos) */}
      {!client.parent_id && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Subclientes ({subclients.length})
            </h2>
            <NewClientForm fixedParent={{ id: client.id, company: client.company }} />
          </div>
          {subclients.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-400">
              Sin subclientes. Si este cliente nos subcontrata para capacitar a otras empresas,
              agrégalas aquí; si vende al público en general, no necesita subclientes.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subclients.map((s) => (
                <Link
                  key={s.id}
                  href={`/clientes/${s.id}`}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-cyan hover:shadow-md"
                >
                  <p className="font-semibold text-brand-navy">{s.company}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {subTrainings.filter((t) => t.client_id === s.id).length} capacitaciones
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Capacitaciones ({courses.length})
        </h2>
        {courses.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            Este cliente aún no tiene capacitaciones. Crea la primera con el botón de arriba.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((t) => (
              <TrainingCardLink key={t.id} t={t} />
            ))}
          </div>
        )}
      </section>

      {teamBuildings.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Team buildings ({teamBuildings.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teamBuildings.map((t) => (
              <TrainingCardLink key={t.id} t={t} />
            ))}
          </div>
        </section>
      )}

      {consulting.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Consultorías ({consulting.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {consulting.map((p) => (
              <Link
                key={p.id}
                href={`/consultoria/${p.id}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-cyan hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-brand-navy">{p.name}</p>
                  <span
                    className={`${statusColor(p.status)} shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white`}
                  >
                    {p.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {p.leader ? `Líder: ${p.leader}` : "Sin líder asignado"}
                  {p.contracted_hours ? ` · ${p.contracted_hours} h contratadas` : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {subTrainings.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Capacitaciones de sus subclientes ({subTrainings.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subTrainings.map((t) => (
              <TrainingCardLink key={t.id} t={t} subLabel={t.clients?.company ?? ""} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
