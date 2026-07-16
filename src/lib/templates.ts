// Plantillas del mensaje de logística por WhatsApp.
// La versión presencial es el texto oficial de Talentoría;
// la online es su adaptación para sesiones a distancia.

export const LOGISTICS_PRESENCIAL = `Para preparar adecuadamente la capacitación, ¿me podrías apoyar confirmándome algunos puntos logísticos?
* ¿Hay alguna especificación especial para ingresar o permanecer en sus instalaciones, como ropa, calzado, equipo de seguridad o identificación?
* ¿Podemos ingresar a la sala de capacitación 30min antes de la hora de inicio para instalarnos adecuadamente?
* ¿Nos podrían apoyar con pantalla o proyector y conexión eléctrica? Algunos ejercicios requieren responder encuestas en línea, ¿tendremos acceso a una red WiFi?
* De ser posible, agradeceríamos que el espacio estuviera acomodado en herradura o en una distribución que facilite la participación y el trabajo en equipo. Nos confirman si es posible por favor.
* ¿Me podrían confirmar el número final de participantes? Y es importante que tengamos una semana antes de la capacitación la lista con los nombres completos de los asistentes para generar los certificados del curso, ¿es posible?
* Sugerimos tener un pequeño coffee break para los participantes, pero es opcional.
* ¿Contaremos con una persona de contacto para apoyarnos con el acceso y cualquier necesidad logística al momento de llegar?
Por último, ¿hay alguna indicación adicional que debamos considerar, como acceso al estacionamiento, registro de visitantes u otra disposición interna?
Muchas gracias por el apoyo. Con esta información podremos preparar todo lo necesario para que la capacitación se desarrolle de la mejor manera.`;

export const LOGISTICS_ONLINE = `Para preparar adecuadamente la capacitación en línea, ¿me podrías apoyar confirmándome algunos puntos logísticos?
* Nosotros generamos y compartimos la liga de la sesión con anticipación, ¿o prefieren que se realice en su propia plataforma?
* ¿Los participantes se conectarán de forma individual, o estarán reunidos en una sala con pantalla compartida?
* Si estarán en sala conjunta: ¿nos podrían apoyar con pantalla o proyector, buen audio (bocinas y micrófono) y conexión estable a internet?
* Algunos ejercicios requieren responder encuestas en línea desde el celular o la computadora, ¿los participantes tendrán acceso a WiFi o datos móviles?
* ¿Me podrían confirmar el número final de participantes? Es importante que tengamos una semana antes la lista con los nombres completos y correos de los asistentes, para los accesos y los certificados del curso, ¿es posible?
* ¿Podríamos hacer una breve prueba de conexión unos días antes con la persona responsable del grupo o de la sala?
* ¿Contaremos con una persona de contacto durante la sesión para apoyarnos con cualquier tema técnico o logístico?
Por último, ¿hay alguna indicación adicional que debamos considerar, como políticas de grabación o permisos de su área de sistemas para el uso de la plataforma?
Muchas gracias por el apoyo. Con esta información podremos preparar todo lo necesario para que la capacitación se desarrolle de la mejor manera.`;

/** Decide la plantilla según las modalidades de las sesiones. */
export function pickTemplate(modalities: string[]): "Presencial" | "Online" {
  const clean = modalities.filter(Boolean);
  if (clean.some((m) => m === "Presencial" || m === "Híbrida")) return "Presencial";
  return "Online";
}
