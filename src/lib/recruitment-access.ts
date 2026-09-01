/**
 * Acceso al módulo de Reclutamiento mientras está en construcción.
 *
 * Mientras RECRUITMENT_OPEN_TO_ALL sea false, solo los correos de la
 * lista ven el módulo completo; el resto del equipo ve la pantalla de
 * "en construcción" y sus tareas de reclutamiento no se les mezclan en
 * "Mis tareas" ni en los recordatorios por correo.
 *
 * Para abrir el módulo a todo el equipo: cambia RECRUITMENT_OPEN_TO_ALL
 * a true (un solo cambio, un deploy).
 */
export const RECRUITMENT_OPEN_TO_ALL = false;

const ALLOWED_EMAILS = ["antoniooliver@talentoria.com"];

export function canSeeRecruitment(email?: string | null): boolean {
  if (RECRUITMENT_OPEN_TO_ALL) return true;
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}
