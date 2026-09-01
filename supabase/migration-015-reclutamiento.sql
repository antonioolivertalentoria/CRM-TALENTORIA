-- ============================================================
-- Migración 015 — Módulo de Reclutamiento
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-014)
-- Todo es aditivo: no modifica ni borra datos existentes.
--
-- Basado en el "Flujo del Proceso de Reclutamiento" (22 pasos con
-- responsables y SLAs). Las decisiones del diagrama (rombos 8, 16, 18
-- y el de garantía) son estados; los pasos con SLA se vuelven tareas
-- automáticas en "Mis tareas".
--
-- El reloj de todos los plazos es requisition_at (paso 4: "Reclutador
-- recibe requisición — inicio de tiempos").
-- ============================================================

-- ---------- Vacantes (un proceso de reclutamiento por requisición) ----------
create table if not exists public.recruitment_vacancies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  position text not null,                       -- Puesto solicitado
  -- Fase: Requisición | Levantamiento | Publicada | Terna enviada |
  --       Validación | Contratado | En garantía | Cerrada | Cancelada
  status text not null default 'Requisición',
  priority text not null default 'Media',
  recruiter text not null default '',           -- RECLUTADOR (dueño del proceso)
  comercial text not null default 'Perla Torres',
  internal_owner text not null default '',      -- Operaciones (respaldo y cierre)
  openings int not null default 1,              -- Número de plazas
  salary text not null default '',
  location text not null default '',
  modality text not null default '',            -- Presencial | Híbrida | Remoto
  perfil text not null default '',              -- Resumen del levantamiento (paso 6)
  publication_media text not null default '',   -- Medios de la estrategia (paso 9)
  budget numeric(12,2),                         -- Presupuesto de reclutamiento
  vacancy_url text not null default '',         -- Liga de la publicación
  whatsapp_group text not null default '',
  drive_folder_url text not null default '',

  -- ---- Fechas que mueven los relojes del diagrama ----
  quote_authorized_at date,                     -- paso 1: cliente autoriza cotización
  requisition_at date,                          -- paso 4: INICIO DE TIEMPOS
  profile_meeting_date date,                    -- paso 6: reunión de levantamiento
  profile_authorized_at date,                   -- paso 8: cliente autoriza el perfil
  published_at date,                            -- paso 10: vacante publicada
  candidates_sent_at date,                      -- paso 15: terna enviada al cliente
  hire_date date,                               -- paso 20: fecha de ingreso
  guarantee_days int not null default 90,       -- Garantía pactada (días naturales)

  -- ---- Decisiones del diagrama (rombos) ----
  -- paso 8: Pendiente | Autorizado | Cambios solicitados
  levantamiento_autorizado text not null default 'Pendiente',
  -- garantía: Pendiente | Sí | No  ("No" reabre el proceso desde publicación)
  continua_persona text not null default 'Pendiente',

  -- ---- Checklist del proceso (Pendiente | Listo | No aplica) ----
  factura_anticipo text not null default 'Pendiente',       -- paso 2 (Comercial)
  requisicion_enviada text not null default 'Pendiente',    -- paso 3 (Comercial)
  contacto_cliente text not null default 'Pendiente',       -- paso 5 (24h)
  levantamiento_perfil text not null default 'Pendiente',   -- paso 6 (48h)
  levantamiento_enviado text not null default 'Pendiente',  -- paso 7 (mismo día)
  estrategia_publicacion text not null default 'Pendiente', -- paso 9 (inmediato)
  dashboard_actualizado text not null default 'Pendiente',  -- paso 11 (mismo día)
  filtrado_entrevistas text not null default 'Pendiente',   -- pasos 12-14
  factura_cobertura text not null default 'Pendiente',      -- paso 21 (solicitud)
  factura_enviada text not null default 'Pendiente',        -- paso 21 (Finanzas)
  factura_confirmada text not null default 'Pendiente',     -- paso 21 (confirmar con cliente)
  ingreso_confirmado text not null default 'Pendiente',     -- paso 22 (se presentó)
  aviso_candidatos text not null default 'Pendiente',       -- paso 22 (24h)
  seguimiento_cliente text not null default 'Pendiente',    -- paso 22 (continuo)
  correo_garantia text not null default 'Pendiente',        -- cierre (1 semana antes)

  notes text not null default '',
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recruitment_vacancies_client_id_idx
  on public.recruitment_vacancies (client_id);
create index if not exists recruitment_vacancies_status_idx
  on public.recruitment_vacancies (status);

drop trigger if exists recruitment_vacancies_updated_at on public.recruitment_vacancies;
create trigger recruitment_vacancies_updated_at before update on public.recruitment_vacancies
  for each row execute function public.set_updated_at();

-- ---------- Candidatos (pasos 12-19) ----------
-- Un renglón por persona: es la "base de datos de candidatos" del paso 13.
-- El estado es el embudo; psicometría y referencias son los rombos 18 y el
-- paso 19, y disparan sus propias tareas de 24 horas.
create table if not exists public.recruitment_candidates (
  id uuid primary key default gen_random_uuid(),
  vacancy_id uuid not null references public.recruitment_vacancies (id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  source text not null default '',              -- Medio por el que llegó
  cv_url text not null default '',
  -- Prospecto | Entrevistado | Enviado al cliente | Aprobado por cliente |
  -- Psicometría | Referencias | Contratado | Rechazado | Descartado
  status text not null default 'Prospecto',
  interviewed_at date,                          -- paso 14
  sent_at date,                                 -- paso 15
  client_interview_at date,                     -- arranca las 24h del paso 16
  -- Pendiente | Aprobada | No aprobada | No aplica  (rombo 18)
  psychometrics text not null default 'Pendiente',
  psychometrics_at date,
  -- Pendiente | Enviadas | No aplica  (paso 19)
  references_status text not null default 'Pendiente',
  notes text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists recruitment_candidates_vacancy_id_idx
  on public.recruitment_candidates (vacancy_id);

-- ---------- Archivos de la vacante (CVs, psicometrías, referencias) ----------
create table if not exists public.recruitment_attachments (
  id uuid primary key default gen_random_uuid(),
  vacancy_id uuid not null references public.recruitment_vacancies (id) on delete cascade,
  candidate_id uuid references public.recruitment_candidates (id) on delete set null,
  storage_path text not null,
  file_name text not null,
  file_size bigint not null default 0,
  mime_type text not null default '',
  uploaded_by text not null default '',
  category text not null default 'candidato',   -- candidato | proceso
  created_at timestamptz not null default now()
);

create index if not exists recruitment_attachments_vacancy_id_idx
  on public.recruitment_attachments (vacancy_id);
create index if not exists recruitment_attachments_candidate_id_idx
  on public.recruitment_attachments (candidate_id);

-- ---------- Seguridad (mismo criterio que el resto del CRM) ----------
alter table public.recruitment_vacancies enable row level security;
alter table public.recruitment_candidates enable row level security;
alter table public.recruitment_attachments enable row level security;

drop policy if exists "authenticated all recruitment_vacancies" on public.recruitment_vacancies;
create policy "authenticated all recruitment_vacancies" on public.recruitment_vacancies
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated all recruitment_candidates" on public.recruitment_candidates;
create policy "authenticated all recruitment_candidates" on public.recruitment_candidates
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated all recruitment_attachments" on public.recruitment_attachments;
create policy "authenticated all recruitment_attachments" on public.recruitment_attachments
  for all to authenticated using (true) with check (true);

-- Recordatorios: el nuevo tipo de tarea "Reclutamiento" queda activado
-- para los perfiles existentes y los que se creen en adelante.
alter table public.profiles
  alter column reminder_prefs set default
    '{"enabled": true, "kinds": ["Logística","Preparación","Material","Revisión","Entrega","Seguimiento","Personal","Petición","Consultoría","Reclutamiento"]}';

update public.profiles
set reminder_prefs = jsonb_set(
  reminder_prefs,
  '{kinds}',
  coalesce(reminder_prefs->'kinds', '[]'::jsonb) || '["Reclutamiento"]'::jsonb
)
where not coalesce(reminder_prefs->'kinds', '[]'::jsonb) ? 'Reclutamiento';
