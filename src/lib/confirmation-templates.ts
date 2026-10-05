// Plantillas del mensaje de confirmación por WhatsApp.
// Texto pendiente de aprobación de Arianna: se edita aquí y nada más.
//
// Marcadores que el CRM llena solo (ver src/lib/confirmation.ts):
//   {contacto}   nombre de pila del contacto del cliente
//   {nombre}     nombre oficial de la capacitación (o el corto si falta)
//   {fechas}     fecha y horario de cada sesión próxima (una por línea si hay varias)
//   {plataforma} plataforma de la sesión online
//   {sede}       campo "Sede / dirección"
//   {numero}     participantes inscritos
//   {facilita}   facilitador/a de la sesión
//   {logistica}  viñetas de "Información logística confirmada"

export const CONFIRMATION_TEMPLATES = {
  Presencial: `¡Hola, {contacto}! Buen día. Te comparto la confirmación de la capacitación:

*{nombre}*
Fecha: {fechas}
Modalidad: presencial
Lugar: {sede}
Participantes: {numero}
Facilita: {facilita}

Logística confirmada:
- Llegamos 30 minutos antes para instalarnos
{logistica}

¡Cualquier cosa, estoy al pendiente!`,

  Online: `¡Hola, {contacto}! Buen día. Te comparto la confirmación de la capacitación:

*{nombre}*
Fecha: {fechas}
Modalidad: en línea por {plataforma}. La liga se las compartimos por aquí antes de la sesión.
Participantes: {numero}
Facilita: {facilita}

Logística confirmada:
{logistica}

¡Cualquier cosa, estoy al pendiente!`,
} as const;
