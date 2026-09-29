import {
  DEFAULT_TZ,
  TEAM_PLACE,
  TIMEZONES,
  differsFromTeam,
  normalizeTz,
  toTeamTime,
  tzShort,
} from "@/lib/timezones";

/**
 * Piezas de zona horaria (migración 019). Sin hooks ni "use client": sirven
 * igual en páginas del servidor que dentro de componentes de cliente.
 */

/** Las opciones del menú de zona; si llega una zona fuera del catálogo, también sale. */
export function TimezoneOptions({ current }: { current?: string | null }) {
  const value = normalizeTz(current);
  const known = TIMEZONES.some((z) => z.value === value);
  return (
    <>
      {!known && <option value={value}>{value}</option>}
      {TIMEZONES.map((z) => (
        <option key={z.value} value={z.value}>
          {z.label}
        </option>
      ))}
    </>
  );
}

/** Igual que TimezoneOptions pero con nombres cortos, para tablas angostas. */
export function TimezoneShortOptions({ current }: { current?: string | null }) {
  const value = normalizeTz(current);
  const known = TIMEZONES.some((z) => z.value === value);
  return (
    <>
      {!known && <option value={value}>{value}</option>}
      {TIMEZONES.map((z) => (
        <option key={z.value} value={z.value} title={z.label}>
          {z.value === DEFAULT_TZ ? "Centro" : z.short}
        </option>
      ))}
    </>
  );
}

/**
 * Aviso ámbar cuando la sede no está en la hora del equipo ese día:
 * "🕐 hora de Matamoros · 08:00–12:00 en Chihuahua". Si coinciden, no pinta nada.
 */
export function ZoneNote({
  date,
  start,
  end,
  tz,
  compact = false,
  className = "",
}: {
  date: string | null | undefined;
  start: string | null | undefined;
  end?: string | null;
  tz: string | null | undefined;
  /** Solo "08:00 en Chihuahua", para tarjetas donde ya se ve la hora local. */
  compact?: boolean;
  className?: string;
}) {
  if (!date || !start || !differsFromTeam(tz, date)) return null;
  const s = start.slice(0, 5);
  const e = end ? end.slice(0, 5) : "";
  const team = e ? `${toTeamTime(date, s, tz)}–${toTeamTime(date, e, tz)}` : toTeamTime(date, s, tz);
  return (
    <span
      title={`La hora capturada es la de la sede (${tzShort(tz)}). Para el equipo en ${TEAM_PLACE} es ${team}.`}
      className={`inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 ${className}`}
    >
      🕐 {compact ? "" : `hora de ${tzShort(tz)} · `}
      {team} en {TEAM_PLACE}
    </span>
  );
}
