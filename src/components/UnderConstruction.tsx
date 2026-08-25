import Link from "next/link";

/** Pantalla que ve el equipo mientras un módulo nuevo está en estreno. */
export function UnderConstruction({ moduleName }: { moduleName: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <p className="text-5xl">🚧</p>
        <h1 className="mt-4 text-2xl font-bold text-brand-navy">{moduleName}</h1>
        <p className="mt-2 text-sm text-slate-500">
          Este módulo está en construcción. Muy pronto estará disponible para todo el equipo —
          por ahora se está afinando antes del estreno.
        </p>
        <div className="mx-auto mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-brand-cyan to-brand-magenta" />
        </div>
        <Link
          href="/tareas"
          className="mt-6 inline-block rounded-lg bg-gradient-to-r from-brand-cyan to-brand-magenta px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
        >
          Volver a Mis tareas
        </Link>
      </div>
    </div>
  );
}
