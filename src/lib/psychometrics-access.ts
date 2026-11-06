/**
 * Acceso al módulo de Psicometría.
 *
 * ABIERTO A TODO EL EQUIPO desde el 06-nov-2026 (pedido de Oli el mismo
 * día del estreno): todos ven el módulo y sus tareas se mezclan en "Mis
 * tareas", en el reporte semanal y en los recordatorios.
 *
 * La bandera y la lista se dejan por si algún día hay que volver a cerrar
 * el módulo: basta poner PSYCHOMETRICS_OPEN_TO_ALL en false y desplegar;
 * quien no esté en ALLOWED_EMAILS verá la pantalla de "en construcción" y
 * no recibirá esas tareas.
 */
export const PSYCHOMETRICS_OPEN_TO_ALL = true;

const ALLOWED_EMAILS = ["antoniooliver@talentoria.com", "jacquelinelara@talentoria.com"];

export function canSeePsychometrics(email?: string | null): boolean {
  if (PSYCHOMETRICS_OPEN_TO_ALL) return true;
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}
