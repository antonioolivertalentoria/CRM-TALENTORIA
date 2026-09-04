/**
 * Acceso al módulo de Reclutamiento.
 *
 * ABIERTO A TODO EL EQUIPO desde el 03-sep-2026: con el CRM ya completo
 * (capacitaciones, team buildings, consultoría y reclutamiento), todos
 * los módulos se ven igual y las tareas de reclutamiento se mezclan en
 * "Mis tareas", en el reporte semanal y en los recordatorios.
 *
 * La bandera y la lista se dejan como estaban por si algún día hay que
 * volver a cerrar el módulo: basta poner RECRUITMENT_OPEN_TO_ALL en
 * false y desplegar; quien no esté en ALLOWED_EMAILS verá la pantalla
 * de "en construcción" y no recibirá esas tareas.
 */
export const RECRUITMENT_OPEN_TO_ALL = true;

const ALLOWED_EMAILS = ["antoniooliver@talentoria.com"];

export function canSeeRecruitment(email?: string | null): boolean {
  if (RECRUITMENT_OPEN_TO_ALL) return true;
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}
