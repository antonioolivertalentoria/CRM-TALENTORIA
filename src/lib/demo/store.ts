/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Modo demostración: datos de ejemplo en memoria para ver el CRM
 * sin conectar Supabase. Se activa solo cuando NEXT_PUBLIC_SUPABASE_URL
 * está vacío o contiene "placeholder". Los cambios viven en memoria
 * y se pierden al reiniciar el servidor.
 */

export type DemoStore = {
  profiles: any[];
  clients: any[];
  trainings: any[];
  sessions: any[];
  materials: any[];
  material_comments: any[];
};

function iso(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const now = new Date().toISOString();

function createInitialData(): DemoStore {
  const c1 = "demo-cliente-1";
  const c2 = "demo-cliente-2";
  const t1 = "demo-cap-1";
  const t2 = "demo-cap-2";
  const t3 = "demo-cap-3";

  const training = (base: any) => ({
    official_name: "",
    status: "Propuesta",
    total_sessions: null,
    internal_owner: "",
    client_contact: "",
    client_email: "",
    whatsapp_group: "",
    temario_url: "",
    drive_folder_url: "",
    participants_url: "",
    materials_deadline: null,
    priority: "Media",
    envio_manual: "Pendiente",
    envio_constancias: "Pendiente",
    envio_insignias: "Pendiente",
    envio_dc3: "Pendiente",
    envio_leads: "Pendiente",
    encuesta_final: "Pendiente",
    factura: "Pendiente",
    seguimiento_20: "Pendiente",
    seguimiento_30: "Pendiente",
    mensaje_logistica: "Pendiente",
    logistics_info: "",
    notes: "",
    internal_notes: "",
    questions: "",
    created_at: now,
    updated_at: now,
    ...base,
  });

  const session = (base: any) => ({
    module: "",
    status: "Programada",
    session_date: null,
    start_time: null,
    end_time: null,
    duration_hours: null,
    facilitator: "",
    modality: "",
    platform: "",
    session_link: "",
    enrolled: null,
    attended: null,
    survey_status: "Pendiente",
    survey_url: "",
    survey_results_status: "Pendiente",
    survey_results_url: "",
    notes: "",
    created_at: now,
    updated_at: now,
    ...base,
  });

  return {
    profiles: [
      {
        id: "demo-user",
        full_name: "Vista previa (demo)",
        email: "demo@talentoria.com",
        created_at: now,
      },
    ],
    clients: [
      {
        id: c1,
        company: "Industrias Delta (ejemplo)",
        contact_name: "Mariana López",
        email: "mlopez@industriasdelta.mx",
        whatsapp: "+52 614 555 0101",
        notes: "Cliente de ejemplo para la vista previa.",
        created_at: now,
        updated_at: now,
      },
      {
        id: c2,
        company: "Grupo Aurora (ejemplo)",
        contact_name: "Ricardo Peña",
        email: "rpena@grupoaurora.mx",
        whatsapp: "+52 55 555 0202",
        notes: "",
        created_at: now,
        updated_at: now,
      },
    ],
    trainings: [
      training({
        id: t1,
        client_id: c1,
        short_name: "Liderazgo y Feedback",
        official_name: "Liderazgo y Feedback",
        status: "En curso",
        total_sessions: 3,
        internal_owner: "Oliver",
        client_contact: "Mariana López",
        client_email: "mlopez@industriasdelta.mx",
        priority: "Alta",
        drive_folder_url: "https://drive.google.com/drive/folders/ejemplo",
        temario_url: "https://docs.google.com/document/d/ejemplo",
        envio_manual: "Listo",
        notes: "Ejemplo: así se ve una capacitación en curso con materiales y sesiones.",
        questions: "¿El cliente imprime los manuales de la sesión presencial?",
      }),
      training({
        id: t2,
        client_id: c1,
        short_name: "Comunicación efectiva",
        official_name: "Comunicación efectiva",
        status: "Confirmada",
        total_sessions: 2,
        internal_owner: "Arianna",
        client_contact: "Mariana López",
        client_email: "mlopez@industriasdelta.mx",
      }),
      training({
        id: t3,
        client_id: c2,
        short_name: "NOM 035",
        official_name: "NOM 035",
        status: "Propuesta",
        total_sessions: 2,
        internal_owner: "Oliver",
        client_contact: "Ricardo Peña",
      }),
    ],
    sessions: [
      session({
        id: "demo-s1",
        training_id: t1,
        session_number: 1,
        status: "Impartida",
        session_date: iso(-1),
        start_time: "09:00",
        end_time: "13:00",
        duration_hours: 4,
        facilitator: "Arianna",
        modality: "Online",
        platform: "Zoom",
        enrolled: 18,
        attended: 17,
        survey_status: "Listo",
      }),
      session({
        id: "demo-s2",
        training_id: t1,
        session_number: 2,
        status: "Confirmada",
        session_date: iso(1),
        start_time: "09:00",
        end_time: "13:00",
        facilitator: "Arianna",
        modality: "Online",
        platform: "Zoom",
      }),
      session({
        id: "demo-s3",
        training_id: t1,
        session_number: 3,
        status: "Programada",
        session_date: iso(8),
        start_time: "09:00",
        end_time: "13:00",
        facilitator: "Caro",
        modality: "Presencial",
      }),
      session({
        id: "demo-s4",
        training_id: t2,
        session_number: 1,
        status: "Programada",
        session_date: iso(14),
        start_time: "10:00",
        end_time: "14:00",
        facilitator: "Caro",
        modality: "Presencial",
      }),
      session({
        id: "demo-s5",
        training_id: t2,
        session_number: 2,
        status: "Pendiente",
        session_date: iso(15),
        start_time: "10:00",
        end_time: "14:00",
        facilitator: "Caro",
        modality: "Presencial",
      }),
      session({ id: "demo-s6", training_id: t3, session_number: 1, status: "Pendiente" }),
      session({ id: "demo-s7", training_id: t3, session_number: 2, status: "Pendiente" }),
    ],
    materials: [
      {
        id: "demo-m1",
        training_id: t1,
        type: "PPT",
        name: "PPT Liderazgo y Feedback",
        url: "https://drive.google.com/file/d/ejemplo-ppt",
        status: "Por revisar",
        maker: "Antonio Oliver",
        reviewer: "Arianna Évora",
        due_date: iso(5),
        created_at: now,
      },
      {
        id: "demo-m2",
        training_id: t1,
        type: "Manual participante",
        name: "Manual del participante",
        url: "",
        status: "En proceso",
        maker: "Antonio Oliver",
        reviewer: "",
        due_date: iso(5),
        created_at: now,
      },
      {
        id: "demo-m3",
        training_id: t1,
        type: "Encuesta",
        name: "Encuesta de satisfacción",
        url: "",
        status: "Pendiente",
        maker: "Antonio Oliver",
        reviewer: "",
        due_date: null,
        created_at: now,
      },
    ],
    material_comments: [
      {
        id: "demo-mc1",
        material_id: "demo-m1",
        author: "Arianna Évora",
        body: "Ejemplo de comentario de revisión: cambia el caso de la diapositiva 12 por uno de la industria del cliente.",
        created_at: now,
      },
    ],
  };
}

// Sobrevive a recargas de módulos en dev
const g = globalThis as any;

export function getDemoStore(): DemoStore {
  if (!g.__talentoriaDemoStore) g.__talentoriaDemoStore = createInitialData();
  return g.__talentoriaDemoStore;
}
