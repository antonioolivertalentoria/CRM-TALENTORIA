import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { formatDate } from "./format";
import { clean, fit, wrap } from "./pdf-text";
import {
  OUTCOMES,
  OUTCOME_COLOR,
  OUTCOME_LABEL,
  countRows,
  mexicoDate,
  pctOf,
  periodLabel,
  shortPeriodLabel,
  totalOf,
  weeksOfMonth,
  type Counts,
  type DashOutcome,
  type DashRow,
  type PersonAgreement,
} from "./productivity";

/**
 * Reporte de productividad en PDF (botón "Generar reporte" de
 * /productividad). Usa los mismos datos, filtros y paleta que el dashboard:
 *  - Sin persona: reporte del equipo (indicadores, tendencia, carga por
 *    semana, desglose por persona en orden alfabético con su meta y acuse,
 *    por proceso, dependencias y las tareas que requieren seguimiento).
 *  - Con persona: reporte individual (lo mismo para esa persona, sus
 *    acuerdos del mes y el detalle de todas sus tareas).
 * Tono neutro: sin rankings ni lenguaje de presión, como la página.
 * Lógica pura (sin Supabase) para poder probarla fuera de Next.
 */

export type ProductivityReportInput = {
  /** Tareas ya clasificadas (todas las visibles, de los seis meses). */
  rows: DashRow[];
  /** Los seis meses de la tendencia; el último es `period`. */
  months: string[];
  period: string;
  /** Hoy en México (YYYY-MM-DD). */
  today: string;
  /** "" = todo el equipo. */
  person: string;
  /** "" = todos los procesos. */
  module: string;
  /** Personas en orden alfabético ("Sin responsable" al final). */
  people: string[];
  agreements: (PersonAgreement & { period: string })[];
  agreementsReady: boolean;
  excluded: { person: string; module: string }[];
  startedOn: string | null;
  /** Logo de Talentoría (PNG); si no llega, el reporte sale sin él. */
  logo?: Uint8Array | null;
};

const PAGE: [number, number] = [612, 792]; // carta
const M = 40;
const W = PAGE[0] - M * 2;
const BOTTOM = M + 4;

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const NAVY = hex("#16345f");
const CYAN = hex("#00aeef");
const MAGENTA = hex("#e6007e");
const INK = hex("#1e293b");
const BODY = hex("#334155");
const MUTED = hex("#64748b");
const FAINT = hex("#94a3b8");
const RULE = hex("#e2e8f0");
const GRID = hex("#e1e0d9");
const AXIS = hex("#c3c2b7");
const TARGET = hex("#52514e");
const GOOD = hex("#006300");
const BAD = hex("#9a3412");
const WAITING = hex("#1d5fae");
const WHITE = rgb(1, 1, 1);
const OC = Object.fromEntries(OUTCOMES.map((o) => [o, hex(OUTCOME_COLOR[o])])) as Record<DashOutcome, RGB>;

/** Estado de una sola tarea (las etiquetas de OUTCOME_LABEL van en plural). */
const STATUS_ONE: Record<DashOutcome, string> = {
  a_tiempo: "A tiempo",
  tarde: "Con retraso",
  bloqueada: "En espera de terceros",
  vencida: "Vencida",
  por_vencer: "En plazo",
};

/** Encabezados cortos para las tablas (la leyenda da el nombre completo). */
const COLUMN: Record<DashOutcome, string> = {
  a_tiempo: "A tiempo",
  tarde: "Con retraso",
  bloqueada: "En espera",
  vencida: "Vencidas",
  por_vencer: "En plazo",
};

/** Primero lo que requiere seguimiento. */
const ORDER: Record<DashOutcome, number> = { vencida: 0, tarde: 1, bloqueada: 2, por_vencer: 3, a_tiempo: 4 };

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function moduleOf(r: DashRow): string {
  return r.module || "Otros";
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  return Math.ceil(v / 4) * 4;
}

function days(n: number): string {
  return `${n} ${n === 1 ? "día hábil" : "días hábiles"}`;
}

export async function buildProductivityPdf(input: ProductivityReportInput): Promise<Uint8Array> {
  const { rows, months, period, today, person, module, people, agreements, agreementsReady, excluded, startedOn } = input;
  const current = today.slice(0, 7);
  const scopeName = person || "Todo el equipo";
  const moduleName = module || "Todos los procesos";
  const monthName = cap(periodLabel(period));
  const teamView = !person;

  // ---------- Cifras (las mismas del dashboard) ----------
  const inScope = (r: DashRow) => (!person || r.person === person) && (!module || moduleOf(r) === module);
  const scoped = rows.filter(inScope);
  const monthRows = scoped.filter((r) => r.period === period);
  const counts = countRows(monthRows);
  const pct = pctOf(counts);
  const base = counts.a_tiempo + counts.tarde + counts.vencida;
  const prevPeriod = months.length > 1 ? months[months.length - 2] : null;
  const prevPct = prevPeriod ? pctOf(countRows(scoped.filter((r) => r.period === prevPeriod))) : null;
  const lateRows = monthRows.filter((r) => r.outcome === "tarde" || r.outcome === "vencida");
  const avgLate = lateRows.length
    ? Math.round((lateRows.reduce((s, r) => s + r.daysLate, 0) / lateRows.length) * 10) / 10
    : null;
  const agreementOf = (p: string, per: string) => agreements.find((a) => a.person === p && a.period === per) ?? null;
  const target = person ? agreementOf(person, period)?.target_pct ?? null : null;
  const trend = months.map((p) => ({
    period: p,
    pct: pctOf(countRows(scoped.filter((r) => r.period === p))),
    target: person ? agreementOf(person, p)?.target_pct ?? null : null,
  }));
  const excludedCount = excluded.filter((e) => (!person || e.person === person) && (!module || e.module === module)).length;

  // ---------- Documento ----------
  const pdf = await PDFDocument.create();
  pdf.setTitle(clean(`Reporte de productividad - ${scopeName} - ${monthName}`));
  pdf.setAuthor("Talentoría");
  pdf.setCreator("CRM Talentoría");
  pdf.setLanguage("es-MX");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  let logo: PDFImage | null = null;
  if (input.logo) {
    try {
      logo = await pdf.embedPng(input.logo);
    } catch {
      logo = null;
    }
  }

  let page: PDFPage = pdf.addPage(PAGE);
  let y = PAGE[1] - M;

  const strip = () => {
    page.drawRectangle({ x: 0, y: PAGE[1] - 6, width: PAGE[0] / 2, height: 6, color: CYAN });
    page.drawRectangle({ x: PAGE[0] / 2, y: PAGE[1] - 6, width: PAGE[0] / 2, height: 6, color: MAGENTA });
  };
  const newPage = () => {
    page = pdf.addPage(PAGE);
    strip();
    y = PAGE[1] - M;
  };
  /** Salta de página si lo que sigue (alto `h`) no cabe. */
  const ensure = (h: number) => {
    if (y - h < BOTTOM) newPage();
  };

  const text = (s: string, x: number, yy: number, size: number, f: PDFFont = font, color: RGB = BODY) => {
    const c = clean(s);
    if (c) page.drawText(c, { x, y: yy, size, font: f, color });
  };
  const textRight = (s: string, xr: number, yy: number, size: number, f: PDFFont = font, color: RGB = BODY) => {
    const c = clean(s);
    if (c) page.drawText(c, { x: xr - f.widthOfTextAtSize(c, size), y: yy, size, font: f, color });
  };
  const textCenter = (s: string, xc: number, yy: number, size: number, f: PDFFont = font, color: RGB = BODY) => {
    const c = clean(s);
    if (c) page.drawText(c, { x: xc - f.widthOfTextAtSize(c, size) / 2, y: yy, size, font: f, color });
  };
  const hline = (x1: number, x2: number, yy: number, color: RGB = RULE, thickness = 0.6) =>
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness, color });
  const swatch = (x: number, yy: number, o: DashOutcome, size = 6) =>
    page.drawRectangle({ x, y: yy, width: size, height: size, color: OC[o] });
  /** Párrafo con salto de renglón; avanza `y`. */
  const paragraph = (s: string, size: number, f: PDFFont = font, color: RGB = BODY, x = M, width = W, lead = size + 2.5) => {
    for (const l of wrap(s, f, size, width)) {
      ensure(lead);
      text(l, x, y, size, f, color);
      y -= lead;
    }
  };

  const section = (title: string, subtitle?: string, keep = 70) => {
    ensure(keep + 34);
    y -= 10;
    text(title, M, y, 12, bold, NAVY);
    y -= 5;
    hline(M, M + W, y, NAVY, 0.8);
    y -= 12;
    if (subtitle) {
      paragraph(subtitle, 7.5, font, MUTED);
      y -= 3;
    }
  };

  const legend = (x: number) => {
    let cx = x;
    for (const o of OUTCOMES) {
      const label = OUTCOME_LABEL[o];
      swatch(cx, y - 0.5, o, 6.5);
      text(label, cx + 9, y, 7.5, font, MUTED);
      cx += 9 + font.widthOfTextAtSize(clean(label), 7.5) + 12;
    }
  };

  // ---------- Encabezado ----------
  strip();
  if (logo) {
    const h = 30;
    const w = (h * logo.width) / logo.height;
    page.drawImage(logo, { x: PAGE[0] - M - w, y: y - h + 8, width: w, height: h });
  }
  y -= 12;
  text("Reporte de productividad", M, y, 20, bold, NAVY);
  y -= 18;
  text(`${scopeName} · ${moduleName}`, M, y, 11.5, bold, INK);
  y -= 14;
  text(
    `${monthName} (${period === current ? "mes en curso" : "mes cerrado"}) · Generado el ${formatDate(today)}`,
    M,
    y,
    8.5,
    font,
    MUTED
  );
  y -= 20;

  // ---------- Indicadores ----------
  {
    const tileH = 76;
    const gap = 8;
    const firstW = 160;
    const otherW = (W - firstW - gap * 4) / 4;
    const top = y;
    type Note = { s: string; color?: RGB; f?: PDFFont };
    const tile = (x: number, w: number, label: string, value: string, notes: Note[], accent?: DashOutcome, big = false) => {
      page.drawRectangle({ x, y: top - tileH, width: w, height: tileH, color: WHITE, borderColor: RULE, borderWidth: 0.8 });
      let lx = x + 8;
      if (accent) {
        swatch(lx, top - 15.5, accent, 6.5);
        lx += 9;
      }
      text(fit(label, bold, 7.5, x + w - lx - 6), lx, top - 15, 7.5, bold, MUTED);
      text(value, x + 8, top - (big ? 44 : 41), big ? 26 : 20, bold, NAVY);
      let ny = top - 55;
      for (const n of notes) {
        for (const l of wrap(n.s, n.f ?? font, 7, w - 14)) {
          if (ny < top - tileH + 3) break;
          text(l, x + 8, ny, 7, n.f ?? font, n.color ?? MUTED);
          ny -= 8.5;
        }
      }
    };

    const delta = pct !== null && prevPct !== null ? pct - prevPct : null;
    const heroNotes: Note[] = [
      {
        s:
          base === 0
            ? "Aún no hay tareas evaluadas en el periodo."
            : `${counts.a_tiempo} de ${base} ${base === 1 ? "tarea evaluada" : "tareas evaluadas"}`,
      },
    ];
    if (delta !== null && prevPeriod) {
      heroNotes.push(
        delta === 0
          ? { s: `Sin cambio vs ${shortPeriodLabel(prevPeriod)}` }
          : {
              s: `${delta > 0 ? "+" : "-"}${Math.abs(delta)} pts vs ${shortPeriodLabel(prevPeriod)}`,
              color: delta > 0 ? GOOD : BAD,
              f: bold,
            }
      );
    }
    if (target !== null) heroNotes.push({ s: `Meta acordada: ${target}%` });

    let x = M;
    tile(x, firstW, "Cumplimiento a tiempo", pct === null ? "-" : `${pct}%`, heroNotes, undefined, true);
    x += firstW + gap;
    tile(x, otherW, "Tareas del mes", String(totalOf(counts)), [{ s: `${counts.por_vencer} en plazo` }]);
    x += otherW + gap;
    tile(
      x,
      otherW,
      OUTCOME_LABEL.tarde,
      String(counts.tarde),
      [{ s: avgLate !== null ? `Retraso promedio: ${days(avgLate)}` : "Cerradas después de su fecha" }],
      "tarde"
    );
    x += otherW + gap;
    tile(x, otherW, OUTCOME_LABEL.vencida, String(counts.vencida), [{ s: "Abiertas después de su fecha" }], "vencida");
    x += otherW + gap;
    tile(x, otherW, "En espera", String(counts.bloqueada), [{ s: "De terceros; no entran al porcentaje" }], "bloqueada");
    y = top - tileH - 18;
  }

  // ---------- Tendencia y carga semanal ----------
  {
    const leftW = 318;
    const colGap = 18;
    const rightX = M + leftW + colGap;
    const rightW = W - leftW - colGap;
    const chartH = 150;
    ensure(chartH + 50);

    text("Cumplimiento a tiempo por mes", M, y, 10, bold, NAVY);
    text("Tareas por semana", rightX, y, 10, bold, NAVY);
    if (trend.some((t) => t.target !== null)) {
      // Leyenda de la meta, a la derecha del título
      const lx = M + leftW - 150;
      page.drawLine({ start: { x: lx, y: y + 2.5 }, end: { x: lx + 10, y: y + 2.5 }, thickness: 1.6, color: NAVY });
      text("Cumplimiento", lx + 13, y, 7, font, MUTED);
      page.drawLine({ start: { x: lx + 68, y: y + 2.5 }, end: { x: lx + 78, y: y + 2.5 }, thickness: 1.6, color: TARGET });
      text("Meta acordada", lx + 81, y, 7, font, MUTED);
    }
    y -= 10;
    text("Tareas cerradas en su fecha compromiso, últimos seis meses.", M, y, 7, font, MUTED);
    text("Según su fecha compromiso dentro del mes.", rightX, y, 7, font, MUTED);
    y -= 4;
    const top = y;

    // Tendencia (línea navy; la meta como marca horizontal)
    {
      const x0 = M;
      const w = leftW;
      const padL = 30;
      const padR = 6;
      const padT = 16;
      const padB = 16;
      const innerW = w - padL - padR;
      const innerH = chartH - padT - padB;
      const band = innerW / trend.length;
      const X = (i: number) => x0 + padL + band * i + band / 2;
      const Y = (v: number) => top - padT - innerH * (1 - v / 100);
      for (const t of [0, 25, 50, 75, 100]) {
        hline(x0 + padL, x0 + w - padR, Y(t), t === 0 ? AXIS : GRID, 0.6);
        textRight(`${t}%`, x0 + padL - 5, Y(t) - 2.4, 6.5, font, MUTED);
      }
      trend.forEach((p, i) => {
        const now = p.period === period;
        textCenter(cap(shortPeriodLabel(p.period)), X(i), top - chartH + 3, 7, now ? bold : font, now ? INK : MUTED);
      });
      let prev: { x: number; y: number } | null = null;
      for (let i = 0; i < trend.length; i++) {
        const v = trend[i].pct;
        if (v === null) {
          prev = null;
          continue;
        }
        const pt = { x: X(i), y: Y(v) };
        if (prev) page.drawLine({ start: prev, end: pt, thickness: 1.6, color: NAVY });
        prev = pt;
      }
      trend.forEach((p, i) => {
        if (p.target === null) return;
        page.drawLine({
          start: { x: X(i) - 10, y: Y(p.target) },
          end: { x: X(i) + 10, y: Y(p.target) },
          thickness: 1.6,
          color: TARGET,
        });
      });
      trend.forEach((p, i) => {
        if (p.pct === null) return;
        page.drawCircle({ x: X(i), y: Y(p.pct), size: 2.8, color: NAVY, borderColor: WHITE, borderWidth: 1 });
        // En un valle la línea sube a los lados: la etiqueta va abajo para no pisarla
        const v = p.pct;
        const near = [trend[i - 1]?.pct, trend[i + 1]?.pct].filter((n): n is number => n != null);
        const below = near.length > 0 && near.some((n) => n > v) && v > 12;
        textCenter(`${v}%`, X(i), below ? Y(v) - 12 : Y(v) + 6, 7, bold, INK);
      });
      if (trend.every((p) => p.pct === null)) {
        textCenter("Aún no hay tareas evaluadas en estos meses.", x0 + padL + innerW / 2, top - padT - innerH / 2, 8, italic, MUTED);
      }
    }

    // Carga por semana (columnas apiladas por estado)
    {
      const x0 = rightX;
      const w = rightW;
      const weeks = weeksOfMonth(period);
      const data = weeks.map((wk) => countRows(monthRows.filter((r) => r.deadline >= wk.start && r.deadline <= wk.end)));
      const max = niceMax(Math.max(0, ...data.map(totalOf)));
      const padL = 22;
      const padR = 4;
      const padT = 16;
      const padB = 16;
      const innerW = w - padL - padR;
      const innerH = chartH - padT - padB;
      const band = innerW / Math.max(1, weeks.length);
      const barW = Math.min(20, band * 0.6);
      const Y = (v: number) => top - padT - innerH * (1 - v / max);
      for (const t of [0, max / 4, max / 2, (3 * max) / 4, max]) {
        hline(x0 + padL, x0 + w - padR, Y(t), t === 0 ? AXIS : GRID, 0.6);
        textRight(String(t), x0 + padL - 4, Y(t) - 2.4, 6.5, font, MUTED);
      }
      weeks.forEach((wk, i) => {
        const cx = x0 + padL + band * i + band / 2;
        let cum = 0;
        for (const o of OUTCOMES) {
          const n = data[i][o];
          if (!n) continue;
          const sep = cum > 0 ? 0.8 : 0; // separación entre segmentos
          const y0 = Y(cum) + sep;
          const h = Y(cum + n) - y0;
          if (h > 0) page.drawRectangle({ x: cx - barW / 2, y: y0, width: barW, height: h, color: OC[o] });
          cum += n;
        }
        const tot = totalOf(data[i]);
        if (tot > 0) textCenter(String(tot), cx, Y(tot) + 3, 7, bold, INK);
        textCenter(wk.label, cx, top - chartH + 3, 6.5, font, MUTED);
      });
    }
    y = top - chartH - 10;
    legend(M);
    y -= 8;
  }

  // ---------- Tablas de desglose ----------
  type Item = { label: string; counts: Counts; agreement?: PersonAgreement | null };
  const breakdown = (firstHeader: string, items: Item[], withAgreements: boolean, totalLabel: string) => {
    const cols: { key: string; header: string; w: number }[] = [
      { key: "label", header: firstHeader, w: withAgreements ? 104 : 140 },
      { key: "bar", header: "Distribución", w: withAgreements ? 84 : 116 },
      ...OUTCOMES.map((o) => ({ key: o, header: COLUMN[o], w: o === "tarde" ? 36 : o === "bloqueada" ? 38 : o === "vencida" ? 36 : 34 })),
      { key: "total", header: "Total", w: 30 },
      { key: "pct", header: "Cumplimiento", w: withAgreements ? 54 : 68 },
      ...(withAgreements
        ? [
            { key: "meta", header: "Meta", w: 30 },
            { key: "ack", header: "Acuerdos", w: 52 },
          ]
        : []),
    ];
    const xs: number[] = [];
    let acc = M;
    for (const c of cols) {
      xs.push(acc);
      acc += c.w;
    }
    const headerLines = cols.map((c) => wrap(c.header, bold, 6.5, c.w - 4));
    const headerH = Math.max(...headerLines.map((l) => l.length)) * 8 + 5;
    const rowH = 15;
    const maxTot = Math.max(1, ...items.map((i) => totalOf(i.counts)));

    const drawHeader = () => {
      const bottom = y - headerH + 5;
      cols.forEach((c, k) => {
        const lines = headerLines[k];
        lines.forEach((l, j) => {
          const yy = bottom + (lines.length - 1 - j) * 8;
          if (c.key === "label" || c.key === "bar") text(l, xs[k] + 2, yy, 6.5, bold, MUTED);
          else textRight(l, xs[k] + c.w - 3, yy, 6.5, bold, MUTED);
        });
      });
      y -= headerH;
      hline(M, M + W, y, AXIS, 0.6);
    };

    const drawRow = (item: Item, isTotal: boolean) => {
      if (y - rowH < BOTTOM) {
        newPage();
        drawHeader();
      }
      const top = y;
      const baseline = top - 10.5;
      const f = isTotal ? bold : font;
      if (isTotal) hline(M, M + W, top, NAVY, 0.6);
      const tot = totalOf(item.counts);
      const p = pctOf(item.counts);
      cols.forEach((c, k) => {
        const x = xs[k];
        const right = x + c.w - 3;
        if (c.key === "label") text(fit(item.label, f, 8, c.w - 6), x + 2, baseline, 8, f, INK);
        else if (c.key === "bar") {
          if (tot === 0) return;
          const len = isTotal ? c.w - 8 : ((c.w - 8) * tot) / maxTot;
          let bx = x + 2;
          for (const o of OUTCOMES) {
            const n = item.counts[o];
            if (!n) continue;
            const segW = Math.max(1.2, (len * n) / tot);
            page.drawRectangle({ x: bx, y: top - 11.5, width: Math.max(0.6, segW - 0.6), height: 7, color: OC[o] });
            bx += segW;
          }
        } else if ((OUTCOMES as string[]).includes(c.key)) {
          const n = item.counts[c.key as DashOutcome];
          textRight(String(n), right, baseline, 8, f, n === 0 ? FAINT : BODY);
        } else if (c.key === "total") textRight(String(tot), right, baseline, 8, f, INK);
        else if (c.key === "pct") textRight(p === null ? "-" : `${p}%`, right, baseline, 8, bold, NAVY);
        else if (c.key === "meta") {
          const t = item.agreement?.target_pct;
          textRight(t != null ? `${t}%` : "-", right, baseline, 8, font, t != null ? BODY : FAINT);
        } else if (c.key === "ack") {
          const a = item.agreement;
          if (!a) textRight("-", right, baseline, 7.5, font, FAINT);
          else if (a.acknowledged_at) textRight("Enterado", right, baseline, 7.5, bold, GOOD);
          else textRight("Pendiente", right, baseline, 7.5, font, MUTED);
        }
      });
      y -= rowH;
      if (!isTotal) hline(M, M + W, y, RULE, 0.4);
    };

    ensure(headerH + rowH * Math.min(items.length + 1, 4));
    drawHeader();
    if (items.length === 0) {
      y -= 12;
      text("Sin tareas en este periodo.", M + 2, y, 8, italic, MUTED);
      y -= 14;
      return;
    }
    for (const item of items) drawRow(item, false);
    if (items.length > 1) {
      const all = countRows([]);
      for (const i of items) for (const o of OUTCOMES) all[o] += i.counts[o];
      drawRow({ label: totalLabel, counts: all }, true);
    }
    y -= 8;
  };

  if (teamView) {
    section(
      "Por persona",
      "En orden alfabético. Cumplimiento = a tiempo ÷ (a tiempo + con retraso + vencidas); las tareas en espera de terceros y en plazo no entran al porcentaje."
    );
    const items: Item[] = people
      .map((p) => ({
        label: p,
        counts: countRows(monthRows.filter((r) => r.person === p)),
        agreement: agreementsReady ? agreementOf(p, period) : null,
      }))
      .filter((i) => totalOf(i.counts) > 0 || i.agreement);
    breakdown("Persona", items, agreementsReady, "Total del equipo");
  } else if (agreementsReady) {
    // Acuerdos del mes de la persona
    section(`Acuerdos de ${periodLabel(period)}`, undefined, 50);
    const a = agreementOf(person, period);
    if (!a) {
      text("Sin acuerdos registrados para este mes.", M, y, 8.5, italic, MUTED);
      y -= 12;
    } else {
      text("Meta de cumplimiento a tiempo:", M, y, 8.5, bold, INK);
      text(
        a.target_pct != null ? `${a.target_pct}%` : "Sin meta definida",
        M + bold.widthOfTextAtSize("Meta de cumplimiento a tiempo:", 8.5) + 5,
        y,
        8.5,
        a.target_pct != null ? bold : font,
        a.target_pct != null ? NAVY : MUTED
      );
      y -= 15;
      text("Prioridades y entregables del mes", M, y, 7.5, bold, MUTED);
      y -= 11;
      const body = (a.body ?? "").trim();
      if (body) {
        for (const para of body.split(/\n+/)) paragraph(para, 8.5, font, BODY);
      } else {
        text("Sin prioridades registradas.", M, y, 8.5, italic, MUTED);
        y -= 11;
      }
      y -= 3;
      ensure(12);
      const reg = `${a.updated_by ? `Registrado por ${a.updated_by}` : "Registrado"}${a.updated_at ? ` el ${formatDate(mexicoDate(a.updated_at))}` : ""}`;
      text(reg, M, y, 7.5, font, MUTED);
      if (a.acknowledged_at) textRight(`Enterado el ${formatDate(mexicoDate(a.acknowledged_at))}`, M + W, y, 7.5, bold, GOOD);
      else textRight("Pendiente de acuse", M + W, y, 7.5, font, MUTED);
      y -= 12;
    }
  }

  {
    const modules = [...new Set(monthRows.map(moduleOf))].sort((a, b) => a.localeCompare(b, "es"));
    section("Por proceso", "Tareas del mes según el proceso del CRM que las generó.");
    breakdown(
      "Proceso",
      modules.map((m) => ({ label: m, counts: countRows(monthRows.filter((r) => moduleOf(r) === m)) })),
      false,
      "Total"
    );
  }

  // ---------- Dependencias externas ----------
  {
    const map = new Map<string, number>();
    for (const r of monthRows) {
      if (r.outcome !== "bloqueada") continue;
      const who = (r.waitingFor ?? "").trim() || "Sin detalle";
      map.set(who, (map.get(who) ?? 0) + 1);
    }
    const deps = [...map.entries()].sort((a, b) => b[1] - a[1]);
    section("Dependencias externas", "Tareas en espera de terceros y de qué dependen.", 30);
    if (deps.length === 0) {
      text("Sin tareas en espera de terceros en este periodo.", M, y, 8.5, italic, MUTED);
      y -= 12;
    } else {
      const labelW = 180;
      const max = Math.max(1, ...deps.map((d) => d[1]));
      for (const [label, n] of deps.slice(0, 12)) {
        ensure(14);
        text(fit(label, font, 8, labelW - 8), M, y, 8, font, INK);
        const len = ((W - labelW - 30) * n) / max;
        page.drawRectangle({ x: M + labelW, y: y - 1, width: Math.max(2, len), height: 7, color: OC.bloqueada });
        textRight(String(n), M + W, y, 8, bold, INK);
        y -= 13;
      }
      if (deps.length > 12) {
        text(`Y ${deps.length - 12} dependencias más.`, M, y, 7.5, italic, MUTED);
        y -= 11;
      }
    }
  }

  // ---------- Tareas ----------
  const taskItem = (r: DashRow, groupedByStatus: boolean) => {
    const inner = W - 12;
    const late = r.daysLate > 0 ? days(r.daysLate) : "";
    const status = clean(
      groupedByStatus ? (late ? `${late} de retraso` : "") : `${STATUS_ONE[r.outcome]}${late ? ` · ${late}` : ""}`
    );
    const statusW = font.widthOfTextAtSize(status, 7.5);
    const titleLines = wrap(r.title, bold, 8.5, inner - (statusW ? statusW + 12 : 0));
    const meta = [moduleOf(r), r.project, r.client].filter(Boolean).join(" · ");
    const metaLines = meta ? wrap(meta, font, 7.5, inner) : [];
    const dates = `Fecha compromiso: ${formatDate(r.deadline)}${
      r.closedAt ? ` · cerrada el ${formatDate(r.closedAt)}` : r.outcome !== "por_vencer" ? " · abierta" : ""
    }`;
    const waitingFor = (r.waitingFor ?? "").trim();
    const waiting = r.waitingSince
      ? `En espera desde el ${formatDate(r.waitingSince)}${waitingFor ? ` · depende de: ${waitingFor}` : ""}`
      : "";
    const waitingLines = waiting ? wrap(waiting, font, 7.5, inner) : [];
    const context = (r.context ?? "").trim();
    const by = r.contextBy ? ` (${r.contextBy}${r.contextAt ? `, ${formatDate(mexicoDate(r.contextAt))}` : ""})` : "";
    const commentLines = context ? wrap(`Comentario del responsable: ${context}${by}`, italic, 7.5, inner) : [];

    const h = titleLines.length * 10.5 + (metaLines.length + 1 + waitingLines.length + commentLines.length) * 9 + 6;
    ensure(h);
    swatch(M, y - 0.5, r.outcome, 6);
    textRight(status, M + W, y, 7.5, font, MUTED);
    for (const l of titleLines) {
      text(l, M + 12, y, 8.5, bold, INK);
      y -= 10.5;
    }
    for (const l of metaLines) {
      text(l, M + 12, y, 7.5, font, MUTED);
      y -= 9;
    }
    text(dates, M + 12, y, 7.5, font, MUTED);
    y -= 9;
    for (const l of waitingLines) {
      text(l, M + 12, y, 7.5, font, WAITING);
      y -= 9;
    }
    for (const l of commentLines) {
      text(l, M + 12, y, 7.5, italic, BODY);
      y -= 9;
    }
    y -= 6;
  };
  const sorted = (list: DashRow[]) =>
    [...list].sort((a, b) => ORDER[a.outcome] - ORDER[b.outcome] || a.deadline.localeCompare(b.deadline));

  if (teamView) {
    const follow = monthRows.filter((r) => r.outcome === "vencida" || r.outcome === "tarde" || r.outcome === "bloqueada");
    section(
      "Tareas que requieren seguimiento",
      "Vencidas, con retraso y en espera de terceros del mes, por persona. El detalle completo de cada colaborador está en su reporte individual.",
      40
    );
    if (follow.length === 0) {
      text("Sin tareas vencidas, con retraso ni en espera de terceros en el periodo.", M, y, 8.5, italic, MUTED);
      y -= 12;
    }
    for (const p of people) {
      const list = sorted(follow.filter((r) => r.person === p));
      if (list.length === 0) continue;
      ensure(48);
      y -= 2;
      text(`${p} (${list.length})`, M, y, 9.5, bold, NAVY);
      y -= 13;
      for (const r of list) taskItem(r, false);
    }
  } else {
    section("Tareas del mes", "Todas las tareas con fecha compromiso en el mes; primero las que requieren seguimiento.", 40);
    if (monthRows.length === 0) {
      text("Sin tareas en este periodo.", M, y, 8.5, italic, MUTED);
      y -= 12;
    }
    for (const o of [...OUTCOMES].sort((a, b) => ORDER[a] - ORDER[b])) {
      const list = sorted(monthRows.filter((r) => r.outcome === o));
      if (list.length === 0) continue;
      ensure(48);
      y -= 2;
      swatch(M, y - 0.5, o, 7);
      text(`${OUTCOME_LABEL[o]} (${list.length})`, M + 11, y, 9.5, bold, NAVY);
      y -= 13;
      for (const r of list) taskItem(r, true);
    }
  }

  // ---------- Metodología ----------
  section("Metodología del indicador", undefined, 60);
  const method: [string, string][] = [
    [
      "Indicador",
      "Cumplimiento a tiempo = tareas cerradas en o antes de su fecha compromiso ÷ (cerradas a tiempo + cerradas con retraso + vencidas sin cerrar).",
    ],
    [
      "Periodo",
      "Cada tarea pertenece al mes de su fecha compromiso. Las tareas en plazo se muestran como carga del mes y se evalúan al llegar su fecha.",
    ],
    [
      "Fecha compromiso",
      "La que asigna el proceso del CRM, con al menos un día hábil desde la asignación. Los vencimientos en fin de semana se recorren al siguiente día hábil. Si cambia la fecha del evento, la fecha compromiso se recalcula; en tareas propias aplica la fecha vigente.",
    ],
    [
      "Dependencias externas",
      'Las tareas registradas como "En espera" (Mis tareas → Avance) antes de su vencimiento se reportan por separado y no se consideran en el porcentaje.',
    ],
    [
      "Exclusiones",
      `Tareas canceladas, eliminadas o marcadas "No aplica", de proyectos en pausa o cerrados, y pendientes previos al inicio de la medición${
        startedOn ? ` (${formatDate(startedOn)})` : ""
      }. El tiempo registrado no forma parte de este indicador.`,
    ],
  ];
  for (const [label, body] of method) {
    ensure(22);
    text(label, M, y, 8, bold, INK);
    y -= 10;
    paragraph(body.replace(/→/g, ">"), 7.5, font, MUTED);
    y -= 3;
  }
  if (excludedCount > 0) {
    y -= 2;
    paragraph(
      `${excludedCount} ${excludedCount === 1 ? "tarea del periodo no se considera" : "tareas del periodo no se consideran"} en el indicador por las exclusiones anteriores.`,
      7.5,
      italic,
      MUTED
    );
  }

  // ---------- Pie de página ----------
  const pages = pdf.getPages();
  const footer = clean(`CRM Talentoría · Reporte de productividad · ${scopeName}${module ? ` · ${module}` : ""} · ${monthName}`);
  pages.forEach((p, i) => {
    p.drawText(fit(footer, font, 7, W - 70), { x: M, y: 22, size: 7, font, color: FAINT });
    const right = `Página ${i + 1} de ${pages.length}`;
    p.drawText(right, { x: M + W - font.widthOfTextAtSize(right, 7), y: 22, size: 7, font, color: FAINT });
  });

  return pdf.save();
}
