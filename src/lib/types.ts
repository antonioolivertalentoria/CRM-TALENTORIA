export type Client = {
  id: string;
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
  encuesta_final: string;
  factura: string;
  seguimiento_20: string;
  seguimiento_30: string;
  mensaje_logistica: string;
  logistics_info: string;
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
  created_at: string;
};

export type MaterialComment = {
  id: string;
  material_id: string;
  author: string;
  body: string;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string;
};

export type TrainingWithClient = Training & { clients: Pick<Client, "id" | "company"> };
export type TrainingWithSessions = TrainingWithClient & { sessions: Session[] };
