/**
 * Personas a las que el CRM NO les manda ningún aviso por correo: ni el
 * recordatorio diario, ni invitaciones de calendario, ni "terminó el
 * curso", ni "tarea completada", ni pedidos. Sus tareas siguen en el CRM;
 * solo se apagan los correos.
 *
 * Perla Torres (25-nov-2026, pedido de Oli: "quita el 100 % de las
 * notificaciones que le llegan a Perla").
 *
 * No aplica a "¿Olvidaste tu contraseña?": ese correo lo pide la persona.
 */
export const MUTED_EMAILS = ["perlatorres@talentoria.com"];

const muted = new Set(MUTED_EMAILS.map((e) => e.trim().toLowerCase()));

export function isMuted(email: string | null | undefined): boolean {
  return !!email && muted.has(email.trim().toLowerCase());
}

export function withoutMuted<T extends string | { email: string }>(list: T[]): T[] {
  return list.filter((x) => !isMuted(typeof x === "string" ? x : x.email));
}
