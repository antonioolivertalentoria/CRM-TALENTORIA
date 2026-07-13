import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewClientForm } from "@/components/NewClientForm";
import type { Client } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*, trainings(id, status)")
    .order("company");

  const clients = (data ?? []) as unknown as (Client & {
    trainings: { id: string; status: string }[];
  })[];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Clientes</h1>
          <p className="text-sm text-slate-500">
            Da de alta a la empresa y su contacto; después crea sus capacitaciones.
          </p>
        </div>
        <NewClientForm />
      </header>

      {clients.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-slate-600">Aún no hay clientes</p>
          <p className="mt-1 text-sm text-slate-400">
            Usa el botón &ldquo;Dar de alta cliente&rdquo; para registrar el primero.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 font-semibold">Compañía</th>
                <th className="px-3 py-2.5 font-semibold">Contacto</th>
                <th className="px-3 py-2.5 font-semibold">Correo</th>
                <th className="px-3 py-2.5 font-semibold">WhatsApp</th>
                <th className="px-3 py-2.5 font-semibold">Capacitaciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const active = c.trainings.filter(
                  (t) => t.status === "En curso" || t.status === "Confirmada"
                ).length;
                return (
                  <tr key={c.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/clientes/${c.id}`}
                        className="font-semibold text-brand-navy hover:text-brand-cyan-dark hover:underline"
                      >
                        {c.company}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{c.contact_name || "—"}</td>
                    <td className="px-3 py-3">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="text-brand-cyan-dark hover:underline">
                          {c.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {c.whatsapp ? (
                        <a
                          href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 hover:underline"
                        >
                          {c.whatsapp}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {c.trainings.length} total
                      </span>
                      {active > 0 && (
                        <span className="ml-1.5 rounded-full bg-brand-cyan/10 px-2.5 py-1 text-xs font-semibold text-brand-cyan-dark">
                          {active} activas
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
