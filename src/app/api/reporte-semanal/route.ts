import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { computeTasks, customToComputed, sortByDue, type ComputedTask } from "@/lib/tasks";
import { computeConsultingTasks } from "@/lib/consulting-tasks";
import { addDays, formatDate, todayISO } from "@/lib/format";
import { fetchFacilitators, internalFacilitatorNames } from "@/lib/facilitators";
import type { CustomTask, ReminderPrefs } from "@/lib/types";

/**
 * Reporte semanal de tareas en PDF: todo lo que hay que hacer en los
 * próximos 5 días hábiles (contando el día en que se genera, si es hábil),
 * más lo que ya está vencido. Se descarga desde "Mis tareas" y se envía
 * a dirección cada lunes.
 */

export const dynamic = "force-dynamic";

// Colores de marca Talentoría
const NAVY = rgb(0.086, 0.204, 0.373); // #16345f
const CYAN = rgb(0, 0.682, 0.937); // #00aeef
const MAGENTA = rgb(0.902, 0, 0.494); // #e6007e
const SLATE = rgb(0.4, 0.45, 0.51);
const RED = rgb(0.86, 0.15, 0.15);

/** Los 5 días hábiles de la semana del reporte (incluye hoy si es hábil). */
function businessWindow(today: string): string[] {
  const days: string[] = [];
  let d = today;
  while (days.length < 5) {
    const [y, m, dd] = d.split("-").map(Number);
    const dow = new Date(y, m - 1, dd).getDay();
    if (dow !== 0 && dow !== 6) days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

/** El día hábil en que se atiende una fecha (sábado/domingo pasan al lunes). */
function nextBusiness(d: string): string {
  let x = d;
  for (;;) {
    const [y, m, dd] = x.split("-").map(Number);
    const dow = new Date(y, m - 1, dd).getDay();
    if (dow !== 0 && dow !== 6) return x;
    x = addDays(x, 1);
  }
}

/** pdf-lib usa WinAnsi: sustituye puntuación tipográfica y quita emojis. */
function clean(text: string): string {
  return text
    .replace(/[—–]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^ -ÿ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = clean(text).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para descargar el reporte." }, { status: 401 });
  }

  const [
    { data: trainingsData },
    { data: profilesData },
    { data: customData },
    facilitators,
    { data: requestsData },
    { data: consultingData },
    { data: cMilestonesData },
    { data: cInputsData },
    { data: cChangesData },
  ] =
    await Promise.all([
      supabase.from("trainings").select("*, clients(id, company), sessions(*), materials(*)"),
      supabase.from("profiles").select("id, full_name, email, reminder_prefs"),
      supabase.from("custom_tasks").select("*, clients(id, company)").eq("status", "Pendiente"),
      fetchFacilitators(supabase),
      // Peticiones de team building y consultoría (tolerantes a migraciones faltantes)
      supabase.from("training_requests").select("*"),
      supabase.from("consulting_projects").select("*, clients(id, company)"),
      supabase.from("consulting_milestones").select("*"),
      supabase.from("consulting_inputs").select("*"),
      supabase.from("consulting_changes").select("*"),
    ]);

  // Consultoría: proyectos con hitos/insumos/cambios para el motor de tareas
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const consultingProjects = ((consultingData ?? []) as any[]).map((pr) => ({
    ...pr,
    milestones: ((cMilestonesData ?? []) as any[]).filter((m) => m.project_id === pr.id),
    inputs: ((cInputsData ?? []) as any[]).filter((i) => i.project_id === pr.id),
    changes: ((cChangesData ?? []) as any[]).filter((c) => c.project_id === pr.id),
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */


  const requestsByTraining: Record<string, unknown[]> = {};
  for (const r of (requestsData ?? []) as { training_id: string }[]) {
    (requestsByTraining[r.training_id] ??= []).push(r);
  }
  const trainingsWithRequests = ((trainingsData ?? []) as { id: string }[]).map((t) => ({
    ...t,
    training_requests: requestsByTraining[t.id] ?? [],
  }));

  const profiles = (profilesData ?? []) as {
    id: string;
    full_name: string;
    email: string;
    reminder_prefs: ReminderPrefs | null;
  }[];
  const internalNames = internalFacilitatorNames(profiles.map((p) => p.full_name), facilitators);
  const allTasks = sortByDue([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...computeTasks(trainingsWithRequests as any, internalNames),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...computeConsultingTasks(consultingProjects as any),

    ...customToComputed((customData ?? []) as (CustomTask & { clients: { id: string; company: string } | null })[]),
  ]);

  // El reporte respeta el filtro de persona seleccionado en "Mis tareas":
  // /api/reporte-semanal?persona=Arianna → solo sus tareas (y las sin
  // asignar, que aparecen en el perfil de todos). Sin parámetro o con
  // "Todas", el reporte trae todo, como antes.
  const persona = new URL(request.url).searchParams.get("persona")?.trim() ?? "";
  const filtered = persona && persona !== "Todas";
  const tasks = filtered
    ? allTasks.filter((t) => t.assignee === persona || !t.assignee)
    : allTasks;

  const today = todayISO();
  const week = businessWindow(today);
  const weekEnd = week[week.length - 1];

  const overdue = tasks.filter((t) => t.due && t.due < week[0]);
  const noDate = tasks.filter((t) => !t.due);
  // Tareas que vencen en fin de semana se agrupan en el día hábil siguiente
  const byDay = week.map((day) => ({
    day,
    items: tasks.filter(
      (t) => t.due && t.due >= week[0] && t.due <= weekEnd && nextBusiness(t.due) === day
    ),
  }));

  // ---------- Armado del PDF ----------
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [612, 792]; // Carta
  const margin = 48;
  const width = pageSize[0] - margin * 2;

  let page: PDFPage = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = pdf.addPage(pageSize);
      y = pageSize[1] - margin;
    }
  };

  // Encabezado con la franja de marca (cyan → magenta)
  page.drawRectangle({ x: 0, y: pageSize[1] - 8, width: pageSize[0] / 2, height: 8, color: CYAN });
  page.drawRectangle({ x: pageSize[0] / 2, y: pageSize[1] - 8, width: pageSize[0] / 2, height: 8, color: MAGENTA });

  page.drawText(clean(filtered ? `Reporte semanal de ${persona} — Talentoría` : "Reporte semanal de tareas — Talentoría"), {
    x: margin, y: y - 10, size: 18, font: bold, color: NAVY,
  });
  y -= 32;
  page.drawText(clean(`Semana del ${formatDate(week[0])} al ${formatDate(weekEnd)} · Generado el ${formatDate(today)}`), {
    x: margin, y, size: 10, font, color: SLATE,
  });
  y -= 14;
  page.drawText(clean(`${overdue.length} vencidas · ${byDay.reduce((a, d) => a + d.items.length, 0)} programadas esta semana · ${noDate.length} sin fecha`), {
    x: margin, y, size: 10, font, color: SLATE,
  });
  y -= 24;

  const drawTask = (t: ComputedTask, showOverdue = false) => {
    const titleLines = wrap(t.title, bold, 10, width - 16);
    const context = t.trainingId
      ? [t.trainingName, t.clientName].filter(Boolean).join(" · ")
      : [t.clientName, t.requestedBy ? `Pidió: ${t.requestedBy}` : ""].filter(Boolean).join(" · ");
    const meta = [
      `[${t.kind}]`,
      context,
      t.assignee ? `Responsable: ${t.assignee}` : "Sin asignar",
      showOverdue && t.due ? `Vencía: ${formatDate(t.due)}` : "",
    ]
      .filter(Boolean)
      .join("  ·  ");
    const metaLines = wrap(meta, font, 8.5, width - 16);

    const needed = titleLines.length * 12 + metaLines.length * 10 + 8;
    ensureSpace(needed);

    // Viñeta
    page.drawCircle({ x: margin + 3, y: y + 3, size: 2, color: showOverdue ? RED : CYAN });
    for (const line of titleLines) {
      page.drawText(line, { x: margin + 12, y, size: 10, font: bold, color: rgb(0.12, 0.16, 0.23) });
      y -= 12;
    }
    for (const line of metaLines) {
      page.drawText(line, { x: margin + 12, y, size: 8.5, font, color: SLATE });
      y -= 10;
    }
    y -= 6;
  };

  const drawSection = (title: string, color = NAVY) => {
    ensureSpace(40);
    y -= 6;
    page.drawText(clean(title).toUpperCase(), { x: margin, y, size: 11, font: bold, color });
    y -= 6;
    page.drawRectangle({ x: margin, y, width, height: 1.2, color });
    y -= 14;
  };

  if (overdue.length > 0) {
    drawSection(`Vencidas (${overdue.length})`, RED);
    overdue.forEach((t) => drawTask(t, true));
  }

  for (const d of byDay) {
    drawSection(`${formatDate(d.day)}${d.day === today ? " (hoy)" : ""} — ${d.items.length} tarea${d.items.length === 1 ? "" : "s"}`);
    if (d.items.length === 0) {
      ensureSpace(16);
      page.drawText("Sin tareas programadas.", { x: margin + 12, y, size: 9, font, color: SLATE });
      y -= 18;
    } else {
      d.items.forEach((t) => drawTask(t));
    }
  }

  if (noDate.length > 0) {
    drawSection(`Sin fecha definida (${noDate.length})`);
    noDate.forEach((t) => drawTask(t));
  }

  // Pie de página
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(clean(`CRM Talentoría · Reporte semanal · Página ${i + 1} de ${pages.length}`), {
      x: margin, y: 24, size: 7.5, font, color: SLATE,
    });
  });

  const bytes = await pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="reporte-semanal-${filtered ? `${persona.toLowerCase().replace(/\s+/g, "-")}-` : ""}${today}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
