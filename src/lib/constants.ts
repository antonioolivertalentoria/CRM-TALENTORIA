// Catálogos y colores tipo Monday para todo el CRM.

// Adjuntos: bucket privado de Supabase Storage y tope por archivo.
export const ATTACHMENTS_BUCKET = "adjuntos";
export const MAX_ATTACHMENT_MB = 20;

export const TRAINING_STATUSES = [
  "Propuesta",
  "Confirmada",
  "En curso",
  "Finalizada",
  "Cancelada",
] as const;

export const SESSION_STATUSES = [
  "Pendiente",
  "Programada",
  "Confirmada",
  "Impartida",
  "Cancelada",
] as const;

export const CHECK_STATUSES = ["Pendiente", "Listo", "No aplica"] as const;

export const MATERIAL_STATUSES = ["Pendiente", "En proceso", "Por revisar", "Listo"] as const;

export const PRIORITIES = ["Alta", "Media", "Baja"] as const;

export const MODALITIES = ["Online", "Presencial", "Híbrida"] as const;

export const PLATFORMS = ["Zoom", "Google Meet", "Teams", "Presencial / N.A."] as const;

// Facilitadores frecuentes que no son usuarios del CRM
// (el campo siempre acepta cualquier nombre escrito a mano)
export const EXTRA_FACILITATORS = ["Carolina García"] as const;

export const MATERIAL_TYPES = [
  "PPT",
  "Manual participante",
  "Manual ejercicios",
  "Temario",
  "Lista participantes",
  "Encuesta",
  "Constancias",
  "Otro",
] as const;

// Colores estilo Monday (fondo sólido, texto blanco)
export const STATUS_COLORS: Record<string, string> = {
  // Estado general / sesión
  Propuesta: "bg-slate-400",
  Pendiente: "bg-slate-400",
  Programada: "bg-amber-400",
  Confirmada: "bg-cyan-500",
  "En curso": "bg-brand-cyan",
  "En proceso": "bg-amber-400",
  "Por revisar": "bg-violet-500",
  Impartida: "bg-emerald-500",
  Finalizada: "bg-emerald-600",
  Cancelada: "bg-red-500",
  Listo: "bg-emerald-500",
  "No aplica": "bg-slate-300 !text-slate-600",
  Sí: "bg-emerald-500",
  // Prioridad
  Alta: "bg-brand-magenta",
  Media: "bg-amber-400",
  Baja: "bg-slate-400",
};

export function statusColor(value: string): string {
  return STATUS_COLORS[value] ?? "bg-slate-400";
}

// Checklist post-capacitación (según el Proceso de Logística):
// entregas en máx. 48h, cierre administrativo y seguimiento 20/30 días.
export const CHECKLIST_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "mensaje_logistica", label: "Mensaje de logística", hint: "Enviar mensaje de logística por WhatsApp (20 días antes o de inmediato)" },
  { key: "contenido_facilitador", label: "Contenido al facilitador", hint: "Entregar todo el contenido (14 días antes si es externo, 7 si es interno)" },
  { key: "lista_participantes", label: "Lista de participantes", hint: "Nombres completos confirmados (7 días antes, para constancias)" },
  { key: "impresion_manuales", label: "Impresión de manuales", hint: "Presencial: confirmar si imprime el cliente o llevamos nosotros (7 días antes)" },
  { key: "encuestas_qr", label: "Encuestas QR/ligas", hint: "Códigos QR y accesos de encuesta funcionando (3 días antes)" },
  { key: "liga_sesion_valida", label: "Liga de sesión validada", hint: "Online: liga generada, compartida y accesos probados (3 días antes)" },
  { key: "envio_manual", label: "Envío de manual", hint: "Enviar manual del participante al cliente (máx. 48h)" },
  { key: "envio_constancias", label: "Constancias", hint: "Enviar constancias de participación (máx. 48h)" },
  { key: "envio_insignias", label: "Insignias", hint: "Enviar insignias digitales (máx. 48h)" },
  { key: "envio_dc3", label: "DC-3", hint: "Formatos DC-3 si el cliente los requiere" },
  { key: "encuesta_participantes", label: "Encuesta de satisfacción", hint: "Aplicar la encuesta a participantes y recabar resultados" },
  { key: "informe_encuesta", label: "Informe de encuesta", hint: "Entregar al cliente el informe de resultados de la encuesta de satisfacción" },
  { key: "envio_leads", label: "Leads a comercial", hint: "Compartir referidos de la encuesta con comercial" },
  { key: "encuesta_final", label: "Encuesta cliente contratante", hint: "Encuesta de satisfacción del cliente que contrató" },
  { key: "factura", label: "Factura", hint: "Solicitar emisión/envío de factura el mismo día del curso" },
  { key: "seguimiento_20", label: "Seguimiento día 20", hint: "Llamada/mensaje para validar aplicación de aprendizajes" },
  { key: "seguimiento_30", label: "Seguimiento día 30", hint: "Cierre formal de soporte y clausura del grupo de WhatsApp" },
];

// ---------------- Consultoría ----------------

export const CONSULTING_STATUSES = [
  "Transferido",
  "En preparación",
  "En ejecución",
  "En entrega",
  "Finalizado",
  "Cancelado",
] as const;

export const MILESTONE_STATUSES = ["Pendiente", "En curso", "Por revisar", "Entregado"] as const;

export const CHANGE_STATUSES = [
  "En evaluación",
  "Cotizado",
  "Aprobado",
  "Rechazado",
  "Aplicado",
] as const;

// Quien recibe las tareas de facturación de consultoría (paso 29 del mapa)
export const FINANCE_OWNER = "Eduardo Évora";

// Checklist del proceso de consultoría (con el paso y SLA del mapa)
export const CONSULTING_CHECKLIST: { key: string; label: string; hint: string }[] = [
  { key: "expediente_completo", label: "Expediente completo", hint: "Revisar alcance, entregables, fechas, horas y condiciones (24h desde la transferencia)" },
  { key: "grupo_wa", label: "Grupo de WhatsApp", hint: "Comercial crea el grupo con cliente y equipo (mismo día)" },
  { key: "ficha_interna", label: "Ficha interna y riesgos", hint: "Líder revisa alcance, horas y capacidad; prepara ficha y arranque (24h)" },
  { key: "minuta_arranque", label: "Minuta de arranque", hint: "Enviar minuta, acuerdos y próximos pasos (24h después de la reunión)" },
  { key: "plan_trabajo", label: "Plan de trabajo", hint: "Actividades, hitos, horas, responsables y dependencias (48h)" },
  { key: "plan_validado", label: "Plan validado", hint: "Operaciones valida plan, capacidad y fechas (24h)" },
  { key: "entregables_enviados", label: "Entregables finales enviados", hint: "Archivos finales y acta o correo de entrega (24h tras la entrega)" },
  { key: "aceptacion_cliente", label: "Aceptación del cliente", hint: "Cliente confirma aceptación o ajustes finales (3 días hábiles)" },
  { key: "factura", label: "Factura", hint: "Solicitar y enviar factura (mismo día de la entrega — Finanzas)" },
  { key: "encuesta", label: "Encuesta de satisfacción", hint: "Enviar encuesta y dar seguimiento (48h después de la entrega)" },
  { key: "cierre_interno", label: "Cierre interno", hint: "Horas, documentación y aprendizajes (3 días hábiles)" },
  { key: "seguimiento_20", label: "Seguimiento posproyecto", hint: "Seguimiento al cliente y cierre definitivo (20 días después)" },
];

// Colores de estados de consultoría (se suman a STATUS_COLORS)
STATUS_COLORS["Transferido"] = "bg-slate-400";
STATUS_COLORS["En preparación"] = "bg-amber-400";
STATUS_COLORS["En ejecución"] = "bg-brand-cyan";
STATUS_COLORS["En entrega"] = "bg-violet-500";
STATUS_COLORS["Entregado"] = "bg-emerald-500";
STATUS_COLORS["En evaluación"] = "bg-amber-400";
STATUS_COLORS["Cotizado"] = "bg-violet-500";
STATUS_COLORS["Aprobado"] = "bg-emerald-500";
STATUS_COLORS["Rechazado"] = "bg-red-500";
STATUS_COLORS["Aplicado"] = "bg-emerald-600";
