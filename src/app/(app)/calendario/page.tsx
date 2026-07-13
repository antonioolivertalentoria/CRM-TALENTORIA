import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { statusColor } from "@/lib/constants";
import { formatDate, formatTime, todayISO } from "@/lib/format";
import type { Session, Training, Client } from "@/lib/types";

export const dynamic = "force-dynamic";

type SessionRow = Session & {
  trainings: Training & { clients: Pick<Client, "id" | "company"> };
};

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("*, trainings(*, clients(id, company))")
    .not("session_date", "is", null)
    .order("session_date")
    .order("start_time");

  const sessions = (data ?? []) as unknown as SessionRow[];
  const today = todayISO();

  const upcoming = sessions.filter((s) => s.session_date! >= today);
  const past = sessions.filter((s) => s.session_date! < today).reverse().slice(0, 15);

  const groupByDate = (list: SessionRow[]) => {
    const map = new Map<string, SessionRow[]>();
    for (const s of list) {
      const key = s.session_date!;
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  };

  const SessionCard = ({ s }: { s: SessionRow }) => (
    <Link
      href={`/capacitaciones/${s.trainings.id}`}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-brand-cyan hover:shadow"
    >
      <span className="w-24 shrink-0 text-sm font-bold text-brand-navy">
        {s.start_time ? formatTime(s.start_time) : "—"}
        {s.end_time ? `–${formatTime(s.end_time)}` : ""}
      </span>
      <div className="min-w-48 flex-1">
        <p className="font-semibold text-brand-navy">
          {s.trainings.short_name}
          <span className="font-normal text-slate-400"> · Sesión {s.session_number}</span>
        </p>
        <p className="text-xs text-slate-500">
          {s.trainings.clients?.company}
          {s.facilitator ? ` · Facilita: ${s.facilitator}` : ""}
          {s.modality ? ` · ${s.modality}` : ""}
        </p>
      </div>
      <span className={`${statusColor(s.status)} rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white`}>
        {s.status}
      </span>
    </Link>
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-brand-navy">Calendario de sesiones</h1>
        <p className="text-sm text-slate-500">Agenda de todas las sesiones programadas.</p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Próximas</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            No hay sesiones futuras con fecha asignada.
          </p>
        ) : (
          <div className="space-y-5">
            {groupByDate(upcoming).map(([date, list]) => (
              <div key={date}>
                <p className="mb-2 text-sm font-bold text-brand-magenta">{formatDate(date)}</p>
                <div className="space-y-2">
                  {list.map((s) => <SessionCard key={s.id} s={s} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Recientes</h2>
          <div className="space-y-5 opacity-70">
            {groupByDate(past).map(([date, list]) => (
              <div key={date}>
                <p className="mb-2 text-sm font-bold text-slate-500">{formatDate(date)}</p>
                <div className="space-y-2">
                  {list.map((s) => <SessionCard key={s.id} s={s} />)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
