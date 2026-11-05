// Mensajes de logística por WhatsApp: cuatro versiones (en línea o
// presencial, para una empresa o abierto al público tipo INDEX) que salen del
// ejemplo de Arianna y de su revisión del 05-nov-2026:
//   · Lo de IA y Drive solo va en cursos de IA, y en ellos se dice desde el
//     primer mensaje qué herramientas usarán para que lleguen con usuario.
//   · Las encuestas se contestan desde el celular; en presencial se aclara si
//     cada quien debe llevar computadora (depende del curso).
//   · En línea para empresa, la prueba de conexión solo si están en sala conjunta.
//   · En los abiertos no se preguntan los inscritos en este mensaje: se piden
//     una semana antes, como dice el proceso (tarea de lista de participantes).

/**
 * Versiones de los mensajes de logística y confirmación. Las "abierto" no se
 * pueden deducir de los datos (INDEX y similares lo mismo abren un curso al
 * público que lo dan a otra empresa), así que siempre se eligen a mano.
 */
export type MessageVariant = "Presencial" | "Presencial abierto" | "Online" | "Online abierto";

export const MESSAGE_VARIANTS: { value: MessageVariant; label: string }[] = [
  { value: "Presencial", label: "Presencial · para una empresa" },
  { value: "Presencial abierto", label: "Presencial · abierto al público" },
  { value: "Online", label: "Online · para una empresa" },
  { value: "Online abierto", label: "Online · abierto al público" },
];

export const isOpenCourse = (v: MessageVariant) => v.endsWith("abierto");
export const isPresencial = (v: MessageVariant) => v.startsWith("Presencial");

export const OPEN_COURSE_HINT =
  "Para cursos que un cliente como INDEX abre al público en general: las inscripciones siguen abiertas hasta el último día y, en línea, la liga la mandan ellos. Si el curso es para una empresa en particular, usa la versión «para una empresa».";

/** Lo que usan los participantes durante el curso (se define por capacitación). */
export type CourseNeeds = {
  /** Curso de IA: se piden usuarios de las herramientas y el material va por Drive. */
  ia: boolean;
  /** Herramientas de IA que usarán ("ChatGPT y Gemini"). */
  tools: string;
  /** Solo presencial: cada participante lleva su computadora. */
  computer: boolean;
};

/** Sugerencia para cursos que aún no lo tienen definido: ¿el nombre habla de IA? */
export function looksLikeAICourse(...names: string[]): boolean {
  const text = names.join(" ");
  return /\bIA\b/.test(text) || /inteligencia artificial|chat ?gpt|prompts?\b|copilot|gemini/i.test(text);
}

export type LogisticsMessageText = {
  text: string;
  /** Datos que faltan; cada uno deja su marcador entre corchetes. */
  missing: string[];
};

/** Arma el mensaje de logística de la versión elegida según lo que usa el curso. */
export function buildLogistics(variant: MessageVariant, needs: CourseNeeds): LogisticsMessageText {
  const open = isOpenCourse(variant);
  const missing: string[] = [];
  let tools = needs.tools.trim();
  if (needs.ia && !tools) {
    tools = "[herramientas de IA]";
    missing.push("Herramientas de IA que usarán");
  }

  const curso = open ? "el curso" : "la capacitación";
  const enEste = open ? "En este curso" : "En esta capacitación";
  const durante = open ? "Durante el curso" : "Durante la capacitación";
  const avisarles = open ? "¿nos ayudan a avisarles a los inscritos?" : "¿nos ayudan a avisarles?";

  const presenta =
    "¿Alguien de su equipo presentará al facilitador o prefieren que se presente por su cuenta? Si lo presentan ustedes, con gusto les compartimos su semblanza.";

  // Presencial: qué llevan los participantes y WiFi. Las encuestas siempre son
  // desde el celular; IA y computadora dependen del curso.
  const equipo: string[] = [];
  if (needs.ia && needs.computer) {
    equipo.push(`${enEste} usaremos ${tools}, así que cada participante necesitará llevar su computadora y tener su usuario listo desde antes, ${avisarles}`);
  } else if (needs.ia) {
    equipo.push(`${enEste} usaremos ${tools} desde el celular o la computadora, así que es importante que cada participante tenga su usuario listo desde antes, ${avisarles}`);
  } else if (needs.computer) {
    equipo.push(`Para los ejercicios cada participante necesitará llevar su computadora, ${avisarles}`);
  }
  equipo.push(
    needs.ia
      ? "Además, responderán encuestas en línea desde el celular y les compartiremos el material con un enlace de Drive, ¿tendremos acceso a una red WiFi?"
      : `${durante} los participantes responderán encuestas en línea desde su celular, ¿tendremos acceso a una red WiFi?`
  );

  let intro: string;
  let bullets: (string | false)[];
  let cierre = "Por último, ¿hay alguna otra indicación que debamos considerar?";

  switch (variant) {
    case "Online":
      intro = "Para preparar adecuadamente la capacitación en línea, ¿me podrías apoyar confirmándome algunos puntos logísticos?";
      bullets = [
        "Nosotros generamos y compartimos la liga de la sesión en Zoom, ¿están de acuerdo?",
        "¿Los participantes se conectarán de forma individual o estarán reunidos en una sala con pantalla compartida?",
        "Si estarán en sala conjunta, ¿nos podrían apoyar con pantalla o proyector, buen audio (bocinas y micrófono) y conexión estable a internet? En ese caso, ¿habrá alguien de apoyo para mover la computadora principal y podríamos hacer una breve prueba de conexión 30 minutos antes de iniciar?",
        "¿Me podrían confirmar el número final de participantes? Es importante que una semana antes tengamos la lista con los nombres completos y correos de los asistentes, para los accesos y los certificados del curso, ¿es posible?",
        needs.ia &&
          `${enEste} usaremos ${tools}, así que es importante que cada participante tenga su usuario listo desde antes. También les compartiremos el material con un enlace de Drive, ¿su área de sistemas les permite el acceso a estas herramientas?`,
      ];
      cierre = "Por último, ¿hay alguna otra indicación que debamos considerar, como políticas de grabación?";
      break;

    case "Presencial":
      intro = "Para preparar adecuadamente la capacitación, ¿me podrías apoyar confirmándome algunos puntos logísticos?";
      bullets = [
        "¿Me podrías confirmar la dirección completa de la sede y compartirnos la ubicación por aquí? También nos ayuda saber en qué sala será y alguna referencia para llegar.",
        "¿Hay algo que debamos considerar para ingresar a sus instalaciones, como identificación, registro de visitantes, estacionamiento, ropa, calzado o equipo de seguridad?",
        "¿Podemos entrar a la sala 30 minutos antes para instalarnos? ¿Quién nos recibirá ese día?",
        "¿Nos podrían apoyar con pantalla o proyector y conexión eléctrica?",
        ...equipo,
        "¿Es posible acomodar la sala en herradura (forma de U) o en mesas por equipo? Así todos participan y trabajan mejor en equipo.",
        "¿Me podrían confirmar el número final de participantes? Es importante que una semana antes tengamos la lista con los nombres completos de los asistentes para los certificados del curso, ¿es posible?",
        "Sugerimos un pequeño coffee break para los participantes, es opcional.",
      ];
      break;

    case "Online abierto":
      intro = "Para preparar adecuadamente el curso en línea, ¿me podrías apoyar confirmándome algunos puntos logísticos?";
      bullets = [
        "¿En qué plataforma será la sesión? En cuanto tengan la liga, ¿nos la comparten? Nos ayuda que el facilitador sea coanfitrión, para compartir pantalla, lanzar encuestas y abrir salas pequeñas.",
        "¿Podemos conectarnos 30 minutos antes para probar audio, video y presentación? ¿Quién administrará la sesión y nos apoyará si surge algún problema técnico?",
        presenta,
        needs.ia &&
          `${enEste} usaremos ${tools}, así que es importante que cada participante tenga su usuario listo desde antes, ${avisarles}`,
        `¿Podemos compartir por el chat de la sesión las ligas de las encuestas y ${needs.ia ? "el material (un enlace de Drive)" : "el material"} en ese momento? O si prefieres, el material te lo enviamos antes por correo para que ustedes se lo hagan llegar a los inscritos.`,
        "Para las constancias de participación, ¿ustedes las realizan o necesitan apoyo de nuestra parte?",
      ];
      break;

    case "Presencial abierto":
      intro = "Para preparar adecuadamente el curso, ¿me podrías apoyar confirmándome algunos puntos logísticos?";
      bullets = [
        "¿Me podrías confirmar la dirección completa de la sede y compartirnos la ubicación por aquí? También nos ayuda saber en qué salón será, alguna referencia para llegar y si hay estacionamiento.",
        "¿Podemos entrar al salón 30 minutos antes para instalarnos? ¿Quién nos recibirá ese día?",
        "¿Nos podrían apoyar con pantalla o proyector, conexión eléctrica y, si el grupo es grande, micrófono?",
        ...equipo,
        "¿Es posible acomodar el salón en herradura (forma de U) o en mesas por equipo? Así todos participan y trabajan mejor en equipo.",
        presenta,
        "Para el registro de llegada y las constancias de participación, ¿ustedes se encargan o necesitan apoyo de nuestra parte?",
        "Sugerimos un pequeño coffee break para los participantes, es opcional.",
      ];
      break;
  }

  const text = [
    intro,
    ...bullets.filter((b): b is string => Boolean(b)).map((b) => `* ${b}`),
    cierre,
    `Muchas gracias por el apoyo. Con esta información podremos preparar todo lo necesario para que ${curso} se desarrolle de la mejor manera.`,
  ].join("\n");

  return { text, missing };
}

// Mensajes de seguimiento posteriores al curso (días 20 y 30 del proceso).
// El de los 20 días pregunta cómo les ha ido aplicando lo aprendido; el de
// los 30 cierra el acompañamiento, invita a seguir trabajando juntos y es
// con el que se clausura el grupo de WhatsApp.

export const SEGUIMIENTO_20 = `Hola, [nombre]. Esperamos que estés muy bien 😊

Ya pasaron algunas semanas desde la capacitación y nos quedamos con las ganas de saber cómo les ha ido: ¿qué han podido aplicar de lo que vieron? ¿Han notado algún cambio en el equipo, aunque sea pequeño?

Y también nos sirve mucho lo otro: si algo no ha terminado de aterrizar o si hay alguna herramienta que se les está complicando llevar a la práctica, con gusto les echamos la mano.

No hace falta que nos escribas nada formal, con que nos cuentes por aquí es más que suficiente. ¡Nos encantará conocer su experiencia! 🙌`;

export const CIERRE_30 = `Hola, [nombre]. ¡Gracias por todo el apoyo durante estas semanas! 😊

Con este mensaje cerramos formalmente el acompañamiento de la capacitación. Fue un gusto trabajar con tu equipo y esperamos que las herramientas les sigan sumando en el día a día.

Si más adelante quieren reforzar lo aprendido o dar el siguiente paso, con gusto les armamos una propuesta a la medida: desde una sesión de refuerzo hasta los temas que suelen complementar muy bien lo que ya vieron.

Antes de cerrar el grupo, ¿hay algo pendiente en lo que podamos apoyarles?

Quedamos a tus órdenes y te deseamos mucho éxito. 🙌`;

/** Decide la plantilla según las modalidades de las sesiones. */
export function pickTemplate(modalities: string[]): "Presencial" | "Online" {
  const clean = modalities.filter(Boolean);
  if (clean.some((m) => m === "Presencial" || m === "Híbrida")) return "Presencial";
  return "Online";
}

// Encuesta de satisfacción del cliente contratante (Jotform). Se manda al
// cerrar las entregas para escuchar cómo vivió el proceso quien nos contrató.

export const ENCUESTA_CLIENTE_URL = "https://www.jotform.com/250566091828867";

export const ENCUESTA_CLIENTE = `Hola, [nombre]. ¡Qué gusto saludarte! 😊

Fue un verdadero placer acompañar a tu equipo en esta capacitación, y ahora nos encantaría escucharte a ti: ¿cómo viviste el proceso desde el primer contacto hasta la entrega?

Tu opinión es la que más nos ayuda a mejorar, así que preparamos una encuesta muy breve (te toma menos de 5 minutos) para conocer qué hicimos bien y en qué podemos seguir creciendo:
${ENCUESTA_CLIENTE_URL}

Puedes contestarla con toda confianza, tanto lo bueno como lo que podamos hacer mejor nos sirve muchísimo. ¡Gracias por ayudarnos a seguir dando un mejor servicio! 🙌`;

// Encuesta de satisfacción de team building (formulario distinto al de capacitación).

export const ENCUESTA_CLIENTE_TB_URL = "https://form.jotform.com/251316771126857";

export const ENCUESTA_CLIENTE_TB = `Hola, [nombre]. ¡Qué gusto saludarte! 😊

Nos la pasamos increíble con tu equipo en el team building y esperamos que ustedes también se hayan llevado un gran recuerdo. Ahora nos encantaría escucharte a ti: ¿cómo viviste el proceso desde el primer contacto hasta el día del evento?

Tu opinión es la que más nos ayuda a mejorar, así que preparamos una encuesta muy breve (te toma menos de 5 minutos) para conocer qué hicimos bien y en qué podemos seguir creciendo:
${ENCUESTA_CLIENTE_TB_URL}

Puedes contestarla con toda confianza, tanto lo bueno como lo que podamos hacer mejor nos sirve muchísimo. ¡Gracias por ayudarnos a seguir dando un mejor servicio! 🙌`;
