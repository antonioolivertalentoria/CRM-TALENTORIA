import { addDays, todayISO } from "./format";
import { MARKETING_OWNER } from "./constants";
import {
  activeMonths,
  addWorkingDays,
  indexSteps,
  monthKey,
  monthLabel,
  prevBusinessDay,
  resolveMailingMonth,
  resolveSeoBase,
  resolveSeoMonth,
  resolveSeoPage,
  type ResolvedStep,
} from "./marketing-flows";
import type { ComputedTask } from "./tasks";
import type {
  MarketingLead,
  MarketingPage,
  MarketingProject,
  MarketingSend,
  MarketingStep,
} from "./types";

/**
 * Motor de tareas del módulo de Marketing: convierte los mapas de Mailing y
 * SEO en tareas automáticas. Un paso genera tarea cuando sigue abierto, ya
 * no espera a ningún paso anterior y, si es de calendario (día 15, día 27…),
 * cuando faltan pocos días para su vencimiento.
 *
 * Además de los pasos:
 * - Envíos (pasos 6-9): una tarea por etapa y mes ("Preparar 4 envíos de
 *   noviembre"), y la comprobación de cada envío el día que sale. Solo
 *   arrancan cuando Perla aprobó el plan del mes (paso 5).
 * - Leads (paso 10): cada oportunidad comercial se le pasa a Perla por el
 *   canal de Slack de marketing.
 * - Auditoría con hallazgos (paso 13): Oliver corrige y documenta.
 *
 * Todas las claves llevan "mkt-<proyecto>-…" para sumar el tiempo ⏱ por
 * proyecto (y para que el usuario invitado pueda registrar tiempo y avance).
 */

export type MarketingData = {
  projects: MarketingProject[];
  steps: MarketingStep[];
  sends: MarketingSend[];
  leads: MarketingLead[];
  pages: MarketingPage[];
};

/** Al palomear desde "Mis tareas", qué resultado toma cada rombo. */
const QUICK_RESULT: Record<string, string> = {
  aprobacion: "Aprobado",
  autorizacion: "Autorizado",
  auditoria: "Sin hallazgos",
  prueba: "Funciona",
  validacion: "Validado",
};

const QUICK_HINT: Record<string, string> = {
  aprobacion: "Al palomearla queda aprobado. Si hay cambios, márcalo en la ficha: el paso anterior se reabre solo.",
  autorizacion: "Al palomearla queda autorizado. Si no se autoriza, márcalo en la ficha y se vuelve a decidir la arquitectura.",
  auditoria: "Al palomearla queda sin hallazgos. Si encontraste errores, márcalo en la ficha: Oliver recibe la tarea de corregir y documentar.",
  prueba: "Al palomearla la prueba queda como 'Funciona'. Si falla, márcalo en la ficha y la prueba se repite.",
  validacion: "Al palomearla la autonomía queda validada. Si hace falta otra práctica, márcalo en la ficha.",
};

/** Etapas de un envío que generan tarea agrupada por mes (pasos 6-8). */
const SEND_STAGES: {
  from: string;
  to: string;
  no: string;
  role: "owner" | "director";
  withCollaborator?: boolean;
  title: (n: number, month: string) => string;
  /** Días antes de la fecha límite de programación. */
  before: number;
}[] = [
  {
    from: "En preparación",
    to: "Pendiente de aprobación",
    no: "6",
    role: "owner",
    withCollaborator: true,
    title: (n, m) => `Preparar ${n} envío${n === 1 ? "" : "s"} de ${m}: base, duplicados, segmento, enlaces, formularios, recurso y vista móvil`,
    before: 2,
  },
  {
    from: "Pendiente de aprobación",
    to: "Aprobado",
    no: "7",
    role: "director",
    title: (n, m) => `Aprobar la versión final de ${n} envío${n === 1 ? "" : "s"} de ${m}`,
    before: 1,
  },
  {
    from: "Aprobado",
    to: "Probado",
    no: "7",
    role: "owner",
    title: (n, m) => `Enviar prueba y revisar la versión final de ${n} envío${n === 1 ? "" : "s"} de ${m}`,
    before: 0,
  },
  {
    from: "Probado",
    to: "Programado",
    no: "8",
    role: "owner",
    title: (n, m) => `Programar ${n} envío${n === 1 ? "" : "s"} de ${m} y registrar fecha, hora, base y evidencia`,
    before: 0,
  },
];

/**
 * Fecha límite para programar un envío: antes del inicio del mes (último día
 * hábil del mes anterior). Si el envío se agregó ya empezado el mes, el día
 * hábil anterior a su salida.
 */
export function scheduleDeadline(send: MarketingSend): string {
  const monthEve = prevBusinessDay(addDays(send.period, -1));
  const created = send.created_at.slice(0, 10);
  if (send.send_date && created > monthEve) return prevBusinessDay(addDays(send.send_date, -1));
  return monthEve;
}

/** Revisión del plan del mes: masterclass y al menos dos recursos (paso 2 y 4). */
export function planWarnings(sends: MarketingSend[]): string[] {
  const warnings: string[] = [];
  if (sends.length === 0) return ["El plan todavía no tiene envíos capturados."];
  if (!sends.some((s) => s.type === "Masterclass")) warnings.push("Falta la masterclass del mes.");
  const resources = sends.filter((s) => s.type === "Recurso" || s.resource.trim()).length;
  if (resources < 2) warnings.push(`Lleva ${resources} recurso${resources === 1 ? "" : "s"} para regalar (mínimo 2).`);
  return warnings;
}

function stepTask(
  p: MarketingProject,
  s: ResolvedStep,
  context: string,
  href: string,
  extra?: string
): ComputedTask {
  const kind = s.def.kind ?? "tarea";
  const parts = [
    s.supportName && s.supportName !== s.assignee ? `Con ${s.supportName}.` : "",
    `Paso ${s.def.no} · ${s.def.sla}.`,
    s.rounds > 0 ? `Ronda ${s.rounds + 1}: regresó por cambios.` : "",
    extra ?? "",
    QUICK_HINT[kind] ?? "",
  ].filter(Boolean);
  return {
    key: `mkt-${p.id}-${s.key}`,
    kind: "Marketing",
    title: s.rounds > 0 ? `${s.def.title} (ronda ${s.rounds + 1})` : s.def.title,
    trainingId: "",
    trainingName: context,
    clientName: "Marketing",
    assignee: s.assignee,
    details: parts.join(" "),
    due: s.due,
    href,
    complete: {
      type: "marketing_step",
      projectId: p.id,
      stepKey: s.key,
      result: QUICK_RESULT[kind],
    },
  };
}

/** ¿El paso ya debe aparecer en "Mis tareas"? */
function isActionable(s: ResolvedStep, today: string): boolean {
  if (s.done || s.locked || s.beforeStart || s.mirrorOf) return false;
  return !s.visibleFrom || today >= s.visibleFrom;
}

export function computeMarketingTasks(data: MarketingData): ComputedTask[] {
  const today = todayISO();
  const tasks: ComputedTask[] = [];
  const rows = indexSteps(data.steps);

  for (const p of data.projects) {
    if (p.status !== "Activo") continue;
    const base = `/marketing/${p.id}`;

    if (p.kind === "Mailing") {
      const sendsOf = (period: string) => data.sends.filter((x) => x.project_id === p.id && x.period === period);

      for (const period of activeMonths(p, today)) {
        const label = monthLabel(period);
        const context = `Mailing · ${label}`;
        const href = `${base}?mes=${monthKey(period)}`;
        const steps = resolveMailingMonth(p, period, rows, today);
        const monthSends = sendsOf(period);
        const warnings = planWarnings(monthSends);

        for (const s of steps) {
          if (isActionable(s, today)) {
            const extra =
              (s.def.id === "s4" || s.def.id === "s5") && warnings.length > 0
                ? `⚠️ ${warnings.join(" ")}`
                : undefined;
            tasks.push(stepTask(p, s, context, href, extra));
          }
          // Paso 13: si la auditoría encontró errores, Oliver corrige y documenta
          if (s.def.id === "s13" && s.result === "Con hallazgos") {
            const found = s.row?.completed_at ?? today;
            tasks.push({
              key: `mkt-${p.id}-${s.key}-fix`,
              kind: "Marketing",
              title: "Corregir y documentar los hallazgos de la auditoría",
              trainingId: "",
              trainingName: context,
              clientName: "Marketing",
              assignee: s.supportName || p.owner,
              details: `Paso 13. ${s.row?.notes ? `Hallazgos: ${s.row.notes}. ` : ""}Al palomearla la auditoría queda como 'Corregido'; deja la evidencia en la ficha.`,
              due: addWorkingDays(found, 2),
              href,
              complete: { type: "marketing_step", projectId: p.id, stepKey: s.key, result: "Corregido" },
            });
          }
        }

        // Pasos 6-8: "Preparar cada envío aprobado" → solo con el plan aprobado
        const approval = steps.find((s) => s.def.id === "s5");
        const planApproved = !approval || approval.done;
        if (planApproved) {
          for (const stage of SEND_STAGES) {
            const group = monthSends.filter((x) => x.status === stage.from);
            if (group.length === 0) continue;
            const due = group
              .map((x) => {
                const d = prevBusinessDay(addDays(scheduleDeadline(x), -stage.before));
                const created = x.created_at.slice(0, 10);
                return d < created ? created : d;
              })
              .sort()[0];
            const assignee = stage.role === "director" ? p.director : p.owner;
            tasks.push({
              key: `mkt-${p.id}-${monthKey(period)}-envios-${stage.no}-${stage.from.replaceAll(" ", "_")}`,
              kind: "Marketing",
              title: stage.title(group.length, label.split(" ")[0]),
              trainingId: "",
              trainingName: context,
              clientName: "Marketing",
              assignee,
              details: [
                stage.withCollaborator && p.collaborator ? `Con ${p.collaborator}.` : "",
                `Paso ${stage.no}.`,
                group.map((x) => `«${x.subject || x.type}»${x.send_date ? ` (${x.send_date.slice(8)}/${x.send_date.slice(5, 7)})` : ""}`).join(", ") + ".",
                `Al palomearla pasan todos a "${stage.to}"; si alguno no está listo, muévelo uno por uno en la ficha.`,
              ]
                .filter(Boolean)
                .join(" "),
              due,
              href,
              complete: { type: "marketing_sends", projectId: p.id, period, from: stage.from, to: stage.to },
            });
          }
        }

        // Paso 9: comprobar cada envío el día que sale
        for (const x of monthSends) {
          if (x.status !== "Programado" || !x.send_date || today < x.send_date) continue;
          tasks.push({
            key: `mkt-${p.id}-envio-${x.id}-comprobar`,
            kind: "Marketing",
            title: `Comprobar que salió ${x.type === "Masterclass" ? "la masterclass" : "el envío"} «${x.subject || x.type}» y registrar incidencias`,
            trainingId: "",
            trainingName: context,
            clientName: "Marketing",
            assignee: p.owner,
            details: `Paso 9. Base: ${x.base || "—"}. Al palomearla el envío queda "Enviado"; las incidencias se anotan en la ficha.`,
            due: x.send_date,
            href,
            complete: { type: "marketing_send", projectId: p.id, sendId: x.id, value: "Enviado" },
          });
        }
      }
    }

    if (p.kind === "SEO") {
      for (const s of resolveSeoBase(p, rows, today)) {
        if (isActionable(s, today)) {
          tasks.push(stepTask(p, s, `SEO · ${s.def.group === "Transferencia" ? "Transferencia" : "Arranque"}`, base));
        }
      }
      for (const period of activeMonths(p, today)) {
        for (const s of resolveSeoMonth(p, period, rows, today)) {
          if (isActionable(s, today)) {
            tasks.push(stepTask(p, s, `SEO · ${monthLabel(period)}`, `${base}?mes=${monthKey(period)}`));
          }
        }
      }
      for (const page of data.pages) {
        if (page.project_id !== p.id || page.status !== "En curso") continue;
        for (const s of resolveSeoPage(p, page, rows, today)) {
          if (isActionable(s, today)) {
            const extra =
              s.def.id === "p5"
                ? "Se completa eligiendo la arquitectura en la ficha de la página."
                : undefined;
            tasks.push(stepTask(p, s, `SEO · ${page.name}`, `${base}#pagina-${page.id}`, extra));
          }
        }
      }
    }
  }

  // Paso 10: los leads útiles pasan a Perla por el canal de Slack de marketing
  const byId = Object.fromEntries(data.projects.map((p) => [p.id, p]));
  for (const l of data.leads) {
    if (l.lead_type !== "Oportunidad comercial" || l.duplicate || l.sent_to_commercial) continue;
    const p = l.project_id ? byId[l.project_id] : undefined;
    const created = l.created_at.slice(0, 10);
    const who = [l.name || l.email, l.company].filter(Boolean).join(" · ") || "sin nombre";
    tasks.push({
      key: `mkt-lead-${l.id}`,
      kind: "Marketing",
      title: `Pasar el lead ${who} a ${p?.director || "Perla Torres"} por Slack`,
      trainingId: "",
      trainingName: "Leads de marketing",
      clientName: "Marketing",
      assignee: p?.owner || MARKETING_OWNER,
      details: `Paso 10. Origen: ${l.source || "—"}${l.segment ? ` · ${l.segment}` : ""}. Al palomearla se registra hoy como fecha de entrega a Comercial.`,
      due: l.lead_date < created ? created : l.lead_date,
      href: "/marketing/leads",
      complete: { type: "marketing_lead", leadId: l.id },
    });
  }

  return tasks;
}
