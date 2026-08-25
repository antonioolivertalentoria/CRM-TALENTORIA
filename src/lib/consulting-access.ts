/**
 * Acceso al módulo de Consultoría mientras está en estreno.
 *
 * Mientras CONSULTING_OPEN_TO_ALL sea false, solo los correos de la
 * lista ven el módulo completo; el resto del equipo ve la pantalla de
 * "en construcción" y sus tareas de consultoría no se les mezclan en
 * "Mis tareas" ni en recordatorios.
 *
 * Para abrir el módulo a todo el equipo: cambia CONSULTING_OPEN_TO_ALL
 * a true (un solo cambio, un deploy).
 */
export const CONSULTING_OPEN_TO_ALL = false;

const ALLOWED_EMAILS = ["antoniooliver@talentoria.com"];

export function canSeeConsulting(email?: string | null): boolean {
  if (CONSULTING_OPEN_TO_ALL) return true;
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}
