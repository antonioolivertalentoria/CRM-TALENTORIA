import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeTasks, type ComputedTask } from "@/lib/tasks";
import { todayISO, formatDate } from "@/lib/format";
import { EXTRA_FACILITATORS } from "@/lib/constants";
import type { ReminderPrefs } from "@/lib/types";

/**
 * Recordatorios diarios por correo (Vercel Cron, 8:00 am hora de Chihuahua).
 * Envía a cada persona un solo correo con sus tareas vencidas y para hoy,
 * respetando sus preferencias (activado/desactivado y tipos de tarea).
 *
 * Requiere en Vercel: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET.
 * Sin RESEND_API_KEY responde sin enviar nada (modo apagado).
 */

export const dynamic = "force-dynamic";

const APP_URL = "https://crm-talentoria.vercel.app";

function taskLine(t: ComputedTask, today: string): string {
  const overdue = t.due && t.due < today;
  return `<li style="margin-bottom:8px;">
    <strong style="color:${overdue ? "#dc2626" : "#16345f"};">${t.title}</strong><br/>
    <span style="color:#64748b;font-size:13px;">${t.trainingName}${t.clientName ? " · " + t.clientName : ""} — vence ${t.due ? formatDate(t.due) : "sin fecha"}${overdue ? " ⚠️ VENCIDA" : ""}</span>
  </li>`;
}

export async function GET(request: Request) {
  // Solo el cron de Vercel (o quien tenga el secreto) puede ejecutarlo
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!resendKey || !serviceKey) {
    return NextResponse.json({ sent: 0, reason: "Recordatorios no configurados (falta RESEND_API_KEY o SUPABASE_SERVICE_ROLE_KEY)" });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  });

  const [
    { data: trainingsData, error: trainingsError },
    { data: profilesData, error: profilesError },
  ] = await Promise.all([
    supabase.from("trainings").select("*, clients(id, company), sessions(*), materials(*)"),
    supabase.from("profiles").select("id, full_name, email, reminder_prefs"),
  ]);

  if (trainingsError || profilesError) {
    return NextResponse.json({
      sent: 0,
      error: trainingsError?.message ?? profilesError?.message,
      // Diagnóstico sin exponer secretos: largo y extremos de la llave recibida
      debug: {
        serviceKeyLength: serviceKey.length,
        serviceKeyStart: serviceKey.slice(0, 10),
        serviceKeyEnd: serviceKey.slice(-2),
      },
    });
  }

  const profiles = (profilesData ?? []) as {
    id: string;
    full_name: string;
    email: string;
    reminder_prefs: ReminderPrefs | null;
  }[];
  const internalNames = [...profiles.map((p) => p.full_name), ...EXTRA_FACILITATORS];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks = computeTasks((trainingsData ?? []) as any, internalNames);

  const today = todayISO();
  const from = process.env.REMINDER_FROM ?? "CRM Talentoría <crm@talentoriacursos.com>";
  let sent = 0;
  const results: string[] = [];

  for (const p of profiles) {
    const prefs = p.reminder_prefs ?? { enabled: true, kinds: [] };
    if (!prefs.enabled) {
      results.push(`${p.full_name}: recordatorios apagados`);
      continue;
    }
    const kinds = prefs.kinds ?? [];
    // Solo tareas vencidas o que vencen hoy, del tipo elegido,
    // asignadas a la persona o sin asignar
    const mine = tasks.filter(
      (t) =>
        (t.assignee === p.full_name || !t.assignee) &&
        kinds.includes(t.kind) &&
        t.due !== null &&
        t.due <= today
    );
    if (mine.length === 0) {
      results.push(`${p.full_name}: sin tareas para hoy`);
      continue;
    }

    const overdueCount = mine.filter((t) => t.due! < today).length;
    const subject = `📋 Tienes ${mine.length} tarea${mine.length === 1 ? "" : "s"}${overdueCount ? ` (${overdueCount} vencida${overdueCount === 1 ? "" : "s"})` : ""} — CRM Talentoría`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
        <div style="height:6px;background:linear-gradient(to right,#00aeef,#e6007e);border-radius:3px;"></div>
        <h2 style="color:#16345f;">Hola, ${p.full_name.split(" ")[0]} 👋</h2>
        <p style="color:#334155;">Esto es lo que tienes pendiente hoy en el CRM de capacitaciones:</p>
        <ul style="padding-left:18px;">${mine.map((t) => taskLine(t, today)).join("")}</ul>
        <a href="${APP_URL}/tareas" style="display:inline-block;background:linear-gradient(to right,#00aeef,#e6007e);color:#fff;font-weight:bold;padding:10px 22px;border-radius:8px;text-decoration:none;margin-top:8px;">Abrir mis tareas</a>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Puedes apagar estos correos o elegir qué tipos recibir desde "Mis tareas" → 🔔 Recordatorios.</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [p.email], subject, html }),
    });

    if (res.ok) {
      sent++;
      results.push(`${p.full_name}: enviado (${mine.length} tareas)`);
    } else {
      results.push(`${p.full_name}: error ${res.status} ${await res.text()}`);
    }
  }

  return NextResponse.json({ sent, results });
}
