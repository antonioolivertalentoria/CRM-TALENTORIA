/**
 * Zona horaria de la sede (migración 019, 29-sep-2026).
 *
 * El CRM guardaba la hora "sola" (09:00) y la invitación de calendario la
 * mandaba siempre como hora del centro. Matamoros cambia de horario igual
 * que Texas: el 29-sep, una sesión de las 9:00 de allá le llegó a la
 * facilitadora como 9:00 de aquí y llegó una hora tarde.
 *
 * Regla desde entonces: la hora de una sesión se captura como la dice el
 * cliente (hora local de la sede) y cada sesión guarda en qué zona está.
 * El .ics sale en UTC, así que Calendar la acomoda sola en la zona de cada
 * quien, y las pantallas enseñan la equivalencia en hora del equipo.
 *
 * Este archivo no usa nada de servidor: lo comparten páginas, componentes
 * de cliente y el correo de calendario.
 */

/** Zona por omisión de clientes y sesiones (la de siempre del CRM). */
export const DEFAULT_TZ = "America/Mexico_City";

/** Donde vive el equipo; es la hora "de aquí" en pantallas y correos. */
export const TEAM_TZ = "America/Mexico_City";
export const TEAM_PLACE = "Chihuahua";

export type TimezoneOption = {
  value: string;
  /** Nombre corto para "hora de …". */
  short: string;
  /** Texto del menú: qué ciudades caen ahí. */
  label: string;
};

// Las que le tocan a México desde que se quitó el horario de verano (2022).
// Solo la frontera norte (y no toda) lo sigue usando, al ritmo de EE.UU.
export const TIMEZONES: TimezoneOption[] = [
  {
    value: "America/Mexico_City",
    short: "centro",
    label: "Centro — Chihuahua, CDMX, Monterrey, Guadalajara, Mérida",
  },
  {
    value: "America/Matamoros",
    short: "Matamoros",
    label: "Frontera noreste — Matamoros, Reynosa, Nuevo Laredo, Piedras Negras (cambia de horario)",
  },
  {
    value: "America/Ciudad_Juarez",
    short: "Cd. Juárez",
    label: "Cd. Juárez (cambia de horario)",
  },
  {
    value: "America/Hermosillo",
    short: "Sonora",
    label: "Sonora — Hermosillo, Cd. Obregón, Nogales",
  },
  {
    value: "America/Mazatlan",
    short: "Mazatlán",
    label: "Pacífico — Sinaloa, Nayarit, Baja California Sur",
  },
  {
    value: "America/Tijuana",
    short: "Tijuana",
    label: "Baja California — Tijuana, Mexicali, Ensenada (cambia de horario)",
  },
  {
    value: "America/Cancun",
    short: "Cancún",
    label: "Quintana Roo — Cancún, Playa del Carmen",
  },
];

/** La zona guardada, o la de omisión si viene vacía o no existe. */
export function normalizeTz(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

/** "America/Matamoros" → "Matamoros" (para "hora de Matamoros"). */
export function tzShort(tz: string | null | undefined): string {
  const z = normalizeTz(tz);
  return TIMEZONES.find((o) => o.value === z)?.short ?? z.split("/").pop()!.replace(/_/g, " ");
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Minutos que la zona le suma a UTC en ese instante (ej. Matamoros en verano: -300). */
function offsetMinutes(tz: string, instant: number): number {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatters.set(tz, f);
  }
  const parts = f.formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((wall - Math.floor(instant / 60000) * 60000) / 60000);
}

/** "2026-09-29" + "09:00" en Matamoros → el instante real (Date en UTC). */
export function zonedToUtc(date: string, time: string, tz: string | null | undefined): Date {
  const z = normalizeTz(tz);
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.slice(0, 5).split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  // Dos pasadas: la segunda corrige si el cambio de horario cae en medio.
  let utc = naive - offsetMinutes(z, naive) * 60000;
  utc = naive - offsetMinutes(z, utc) * 60000;
  return new Date(utc);
}

/** El mismo instante, visto en otra zona: { date: "YYYY-MM-DD", time: "HH:MM" }. */
function wallTime(instant: Date, tz: string): { date: string; time: string } {
  const shifted = new Date(instant.getTime() + offsetMinutes(tz, instant.getTime()) * 60000);
  const iso = shifted.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/**
 * ¿La hora de la sede es distinta a la del equipo ese día? Matamoros solo
 * lo es de marzo a noviembre; en invierno coincide con el centro.
 */
export function differsFromTeam(tz: string | null | undefined, date: string | null | undefined): boolean {
  const z = normalizeTz(tz);
  if (z === TEAM_TZ) return false;
  // Se compara al mediodía de ese día (18:00 UTC): lejos de los cambios de horario de madrugada.
  let ref = Date.now();
  if (date) {
    const [y, m, d] = date.split("-").map(Number);
    ref = Date.UTC(y, m - 1, d, 18);
  }
  return offsetMinutes(z, ref) !== offsetMinutes(TEAM_TZ, ref);
}

/** "09:00" de la sede → "08:00" del equipo (con aviso si cambia de día). */
export function toTeamTime(date: string, time: string, tz: string | null | undefined): string {
  const t = wallTime(zonedToUtc(date, time, tz), TEAM_TZ);
  if (t.date === date) return t.time;
  return `${t.time} (${t.date < date ? "día anterior" : "día siguiente"})`;
}

/**
 * Horario en texto para correos y avisos:
 *  - misma hora que el equipo: "09:00–13:00 (hora del centro)"
 *  - otra zona: "09:00–13:00 hora de Matamoros (08:00–12:00 en Chihuahua)"
 */
export function describeSchedule(
  date: string,
  start: string,
  end: string | null,
  tz: string | null | undefined
): string {
  const s = start.slice(0, 5);
  const e = end ? end.slice(0, 5) : "";
  const range = e ? `${s}–${e}` : s;
  if (!differsFromTeam(tz, date)) return `${range} (hora del centro de México)`;
  const teamRange = e ? `${toTeamTime(date, s, tz)}–${toTeamTime(date, e, tz)}` : toTeamTime(date, s, tz);
  return `${range} hora de ${tzShort(tz)} (${teamRange} en ${TEAM_PLACE})`;
}
