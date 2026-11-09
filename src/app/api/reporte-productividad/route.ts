import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncTaskLedger } from "@/lib/task-ledger";
import { mexicoToday, monthOf } from "@/lib/productivity";
import { loadProductivity, resolvePeriod } from "@/lib/productivity-data";
import { buildProductivityPdf } from "@/lib/productivity-pdf";

/**
 * Reporte de productividad en PDF (botón "Generar reporte" de
 * /productividad): /api/reporte-productividad?mes=2026-11&persona=…&proceso=…
 *  - Sin persona → reporte del equipo (solo para quien ve todo el equipo).
 *  - Con persona → reporte individual.
 * Quien solo ve lo suyo siempre recibe su propio reporte, pida lo que pida
 * (y RLS tampoco le deja leer lo de otros).
 */

export const dynamic = "force-dynamic";

/** El logo sale de /public; si no se puede leer, el reporte va sin él. */
async function loadLogo(request: Request): Promise<Uint8Array | null> {
  try {
    const res = await fetch(new URL("/logo-talentoria.png", request.url), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para descargar el reporte." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const today = mexicoToday();
  const period = resolvePeriod(params.get("mes"), monthOf(today));

  // La bitácora se pone al día antes de leer, igual que al abrir la página
  const [, logo] = await Promise.all([syncTaskLedger(), loadLogo(request)]);
  const data = await loadProductivity(supabase, user, period, today);
  if (data.readError) {
    return NextResponse.json({ error: `No se pudo leer la información (${data.readError}).` }, { status: 500 });
  }

  const requested = params.get("persona")?.trim() ?? "";
  const person = data.seesAll ? requested : data.me;
  if (!person && !data.seesAll) {
    return NextResponse.json({ error: "No encontramos tu perfil para armar el reporte." }, { status: 403 });
  }
  const processName = params.get("proceso")?.trim() ?? "";

  const bytes = await buildProductivityPdf({
    rows: data.rows,
    months: data.months,
    period,
    today,
    person,
    module: processName,
    people: data.people,
    agreements: data.agreements,
    agreementsReady: data.agreementsReady,
    excluded: data.excluded,
    startedOn: data.startedOn,
    logo,
  });

  const filename = `reporte-productividad-${person ? slug(person) : "equipo"}${processName ? `-${slug(processName)}` : ""}-${period}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
