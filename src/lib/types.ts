export type Client = {
  id: string;
  parent_id: string | null;
  company: string;
  razon_social: string;
  rfc: string;
  contact_name: string;
  email: string;
  whatsapp: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type Training = {
  id: string;
  client_id: string;
  short_name: string;
  official_name: string;
  /** "Capacitación" (por defecto) o "Team building" (migración 011). */
  kind?: string;
  status: string;
  total_sessions: number | null;
  internal_owner: string;
  client_contact: string;
  client_email: string;
  whatsapp_group: string;
  temario_url: string;
  drive_folder_url: string;
  participants_url: string;
  materials_deadline: string | null;
  priority: string;
  envio_manual: string;
  envio_constancias: string;
  envio_insignias: string;
  envio_dc3: string;
  envio_leads: string;
  encuesta_participantes: string;
  informe_encuesta: string;
  encuesta_final: string;
  factura: string;
  seguimiento_20: string;
  seguimiento_30: string;
  mensaje_logistica: string;
  logistics_info: string;
  contenido_facilitador: string;
  lista_participantes: string;
  impresion_manuales: string;
  encuestas_qr: string;
  liga_sesion_valida: string;
  notes: string;
  internal_notes: string;
  questions: string;
  created_at: string;
  updated_at: string;
};

export type Session = {
  id: string;
  training_id: string;
  session_number: number;
  module: string;
  status: string;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_hours: number | null;
  facilitator: string;
  modality: string;
  platform: string;
  session_link: string;
  enrolled: number | null;
  attended: number | null;
  survey_status: string;
  survey_url: string;
  survey_results_status: string;
  survey_results_url: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type Material = {
  id: string;
  training_id: string;
  type: string;
  name: string;
  url: string;
  status: string;
  maker: string;
  reviewer: string;
  due_date: string | null;
  review_requested_at: string | null;
  created_at: string;
};

export type MaterialComment = {
  id: string;
  material_id: string;
  author: string;
  body: string;
  created_at: string;
};

export type ReminderPrefs = {
  enabled: boolean;
  kinds: string[];
};

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  reminder_prefs?: ReminderPrefs;
};

export type CustomTask = {
  id: string;
  title: string;
  details: string;
  assignee: string;
  requested_by: string;
  client_id: string | null;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  /** Al completarse, avisar por correo a quien la pidió (migración 009). */
  notify_on_complete?: boolean;
  created_at: string;
  updated_at: string;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  /** "insumo" (material para trabajar) o "entregable" (resultado). */
  category?: string;
  created_at: string;
};

export type Facilitator = {
  id: string;
  name: string;
  is_internal: boolean;
  active: boolean;
  /** Para invitarlo a los eventos de calendario (migración 012). */
  email?: string;
  created_at: string;
};

export type TimeEntry = {
  id: string;
  task_key: string;
  task_title: string;
  person: string;
  minutes: number;
  entry_date: string;
  created_at: string;
};

export type Subtask = {
  id: string;
  task_id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  position: number;
  created_at: string;
};

export type TrainingRequest = {
  id: string;
  training_id: string;
  title: string;
  assignee: string;
  requested_by: string;
  due_date: string | null;
  done: boolean;
  position: number;
  created_at: string;
};

export type TrainingAttachment = {
  id: string;
  training_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
};

export type ActivityEvent = {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  created_at: string;
};

export type TrainingWithClient = Training & { clients: Pick<Client, "id" | "company"> };
export type TrainingWithSessions = TrainingWithClient & { sessions: Session[] };

// ---------------- Consultoría (migración 013) ----------------

export type ConsultingProject = {
  id: string;
  client_id: string;
  name: string;
  status: string;
  priority: string;
  leader: string;
  team: string;
  comercial: string;
  internal_owner: string;
  authorized_at: string | null;
  alcance: string;
  entregables: string;
  contracted_hours: number | null;
  whatsapp_group: string;
  drive_folder_url: string;
  kickoff_date: string | null;
  kickoff_start: string | null;
  kickoff_end: string | null;
  delivery_date: string | null;
  delivery_start: string | null;
  delivery_end: string | null;
  expediente_completo: string;
  grupo_wa: string;
  ficha_interna: string;
  minuta_arranque: string;
  plan_trabajo: string;
  plan_validado: string;
  entregables_enviados: string;
  aceptacion_cliente: string;
  factura: string;
  encuesta: string;
  cierre_interno: string;
  seguimiento_20: string;
  notes: string;
  internal_notes: string;
  created_at: string;
  updated_at: string;
};

export type ConsultingMilestone = {
  id: string;
  project_id: string;
  title: string;
  responsible: string;
  due_date: string | null;
  est_hours: number | null;
  status: string;
  review_requested_at: string | null;
  position: number;
  created_at: string;
};

export type ConsultingInput = {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  received: boolean;
  received_at: string | null;
  created_at: string;
};

export type ConsultingChange = {
  id: string;
  project_id: string;
  title: string;
  in_scope: boolean;
  status: string;
  amount: number | null;
  notes: string;
  created_at: string;
};

export type ConsultingAttachment = {
  id: string;
  project_id: string;
  /** Si el archivo cuelga de un hito (entregable) o insumo (migración 014). */
  milestone_id?: string | null;
  input_id?: string | null;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  category: string;
  created_at: string;
};
