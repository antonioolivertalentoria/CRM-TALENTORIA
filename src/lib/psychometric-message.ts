import { addDays, formatLongDate, todayISO } from "./format";
import type { PsychometricPerson, PsychometricRequest } from "./types";

/**
 * Mensaje del paso 6: las ligas de las pruebas con sus instrucciones, para
 * mandárselo a la persona por WhatsApp. Sale del mensaje que Jaqui ya usa
 * con las guarderías; la versión de empresa solo cambia el porqué.
 *
 * El plazo que se le pide a la persona es el del mapa: a las 48h del envío
 * se verifica que haya respondido, así que se le pide terminar al día
 * siguiente.
 */
export function buildInstructionsMessage(
  request: Pick<PsychometricRequest, "report_type" | "evaluator" | "test_links">,
  person: Pick<PsychometricPerson, "name" | "sent_at">,
  clientName: string
): string {
  const firstName = person.name.trim().split(/\s+/)[0] ?? "";
  const evaluator = request.evaluator.trim();
  const respondBy = formatLongDate(addDays(person.sent_at ?? todayISO(), 1));
  const why =
    request.report_type === "Guardería"
      ? "Como parte de los requisitos, todo el personal que labora en la guardería responde una serie de pruebas psicométricas, por eso te contacto."
      : "Como parte del proceso, es necesario que respondas una serie de pruebas psicométricas, por eso te contacto.";
  const links = request.test_links.trim() || "[Aquí van las ligas de las pruebas, con el tiempo aproximado de cada una]";

  return [
    `Hola ${firstName}, ¡excelente día!`,
    "",
    `${evaluator ? `Mi nombre es ${evaluator} y colaboro` : "Colaboro"} con ${clientName || "la empresa"} realizando las evaluaciones psicométricas del personal. ${why} Toda la información se trata de manera confidencial y no hay respuestas correctas o incorrectas: lo que buscamos es conocerte mejor.`,
    "",
    "Te comparto las ligas para que ingreses. En algunas te va a pedir tus datos para crear un usuario; al crearlo te llega un correo para entrar.",
    "",
    "• Una vez que empiezas una prueba hay que terminarla, no se puede dejar a la mitad. Lo que sí puedes hacer es terminar una y volver a entrar más tarde para hacer las demás.",
    "• Hazlas en un lugar tranquilo y, de preferencia, desde una computadora. Algunas tienen tiempo, así que trabaja lo más rápido que puedas.",
    "",
    links,
    "",
    `Es importante que las termines a más tardar el ${respondBy}, para tener tu reporte a tiempo. Cuando acabes, confírmame por este medio para revisar que todo esté en orden.`,
    "",
    "Cualquier duda o dificultad, aquí estoy. ¡Muchas gracias! ☀️",
  ].join("\n");
}

/** Liga de WhatsApp con el mensaje listo (10 dígitos → se asume México). */
export function whatsappLink(phone: string, text: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
