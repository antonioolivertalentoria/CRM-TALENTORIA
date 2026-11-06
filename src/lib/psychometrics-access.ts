/**
 * Acceso al módulo de Psicometría.
 *
 * EN ESTRENO desde el 06-nov-2026: lo ven Oli y Jaqui (que hizo el mapa
 * del proceso) para probarlo con casos reales antes de abrirlo. El resto
 * del equipo ve la pantalla de "en construcción" y no recibe sus tareas.
 *
 * Para abrirlo a todos basta poner PSYCHOMETRICS_OPEN_TO_ALL en true y
 * desplegar (mismo patrón que Consultoría y Reclutamiento).
 */
export const PSYCHOMETRICS_OPEN_TO_ALL = false;

const ALLOWED_EMAILS = ["antoniooliver@talentoria.com", "jacquelinelara@talentoria.com"];

export function canSeePsychometrics(email?: string | null): boolean {
  if (PSYCHOMETRICS_OPEN_TO_ALL) return true;
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}
