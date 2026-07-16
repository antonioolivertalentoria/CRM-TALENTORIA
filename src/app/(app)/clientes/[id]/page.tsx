import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientEditForm } from "@/components/ClientEditForm";
import { NewTrainingForm } from "@/components/NewTrainingForm";
import { statusColor } from "@/lib/constants";
import type { Client, Training, Session } from "@/lib/types";

export const dynamic = "force-dynamic";

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

  const [{ data: trainingsData }, { data: profilesData }, userRes] = await Promise.all([
    supabase
      .from("trainings")
      .select("*, sessions(id, status)")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase.auth.getUser(),
  ]);
  const profiles = (profilesData ?? []) as { id: string; full_name: string }[];
  const people = profiles.map((p) => p.full_name);
  const currentUser =
    profiles.find((p) => p.id === userRes.data.user?.id)?.full_name ?? "";

  const trainings = (trainingsData ?? []) as unknown as (Training & {
    sessions: Pick<Session, "id" | "status">[];
  })[];

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-400">
        <Link href="/clientes" className="hover:text-brand-cyan-dark hover:underline">
          Clientes
        </Link>{" "}
        / <span className="text-slate-600">{client.company}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-brand-navy">{client.company}</h1>
        <NewTrainingForm clientId={client.id} people={people} currentUser={currentUser} />
      </header>

      <ClientEditForm client={client} />

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Capacitaciones ({trainings.length})
        </h2>
        {trainings.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            Este cliente aún no tiene capacitaciones. Crea la primera con el botón de arriba.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trainings.map((t) => {
              const total = t.total_sessions ?? t.sessions.length;
              const done = t.sessions.filter((s) => s.status === "Impartida").length;
              return (
                <Link
                  key={t.id}
                  href={`/capacitaciones/${t.id}`}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-cyan hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-brand-navy">{t.short_name}</p>
                    <span
                      className={`${statusColor(t.status)} shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white`}
                    >
                      {t.status}
                    </span>
                  </div>
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
            })}
          </div>
        )}
      </section>
    </div>
  );
}
