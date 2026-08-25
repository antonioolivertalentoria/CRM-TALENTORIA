-- ============================================================
-- Migración 013 — Módulo de Consultoría
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-012)
-- Todo es aditivo: no modifica ni borra datos existentes.
--
-- Basado en el "Mapa del Proceso de Consultoría" (32 pasos con
-- responsables y SLAs). Las decisiones del mapa son estados; los
-- pasos con SLA se vuelven tareas automáticas en "Mis tareas".
-- ============================================================

-- ---------- Proyectos de consultoría ----------
create table if not exists public.consulting_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  -- Fase: Transferido | En preparación | En ejecución | En entrega | Finalizado | Cancelado
  status text not null default 'Transferido',
  priority text not null default 'Media',
  leader text not null default '',          -- Líder de proyecto
  team text not null default '',            -- Equipo consultor (nombres separados por coma)
  comercial text not null default 'Perla Torres',
  internal_owner text not null default '',  -- Operaciones (revisiones y cierre interno)
  authorized_at date,                       -- Fecha de autorización / transferencia
  alcance text not null default '',
  entregables text not null default '',
  contracted_hours numeric(7,2),            -- Horas contratadas (vs. ⏱ invertidas)
  whatsapp_group text not null default '',
  drive_folder_url text not null default '',
  -- Reunión de arranque (paso 9) y de entrega (paso 26): generan
  -- invitaciones de calendario al equipo
  kickoff_date date,
  kickoff_start time,
  kickoff_end time,
  delivery_date date,
  delivery_start time,
  delivery_end time,
  -- Checklist del proceso (Pendiente | Listo | No aplica)
  expediente_completo text not null default 'Pendiente', -- pasos 2-4
  grupo_wa text not null default 'Pendiente',            -- paso 6
  ficha_interna text not null default 'Pendiente',       -- paso 7
  minuta_arranque text not null default 'Pendiente',     -- paso 10
  plan_trabajo text not null default 'Pendiente',        -- paso 11
  plan_validado text not null default 'Pendiente',       -- paso 12
  entregables_enviados text not null default 'Pendiente',-- paso 27
  aceptacion_cliente text not null default 'Pendiente',  -- paso 28
  factura text not null default 'Pendiente',             -- paso 29 (Finanzas)
  encuesta text not null default 'Pendiente',            -- paso 30
  cierre_interno text not null default 'Pendiente',      -- paso 31
  seguimiento_20 text not null default 'Pendiente',      -- paso 32
  notes text not null default '',
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consulting_projects_client_id_idx on public.consulting_projects (client_id);
create index if not exists consulting_projects_status_idx on public.consulting_projects (status);

drop trigger if exists consulting_projects_updated_at on public.consulting_projects;
create trigger consulting_projects_updated_at before update on public.consulting_projects
  for each row execute function public.set_updated_at();

-- ---------- Hitos del plan de trabajo (pasos 11, 17-21) ----------
-- El estado "Por revisar" dispara la tarea de revisión técnica de
-- Operaciones (paso 19), igual que el flujo hacer→revisar de materiales.
create table if not exists public.consulting_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.consulting_projects (id) on delete cascade,
  title text not null,
  responsible text not null default '',
  due_date date,
  est_hours numeric(6,2),
  -- Pendiente | En curso | Por revisar | Entregado
  status text not null default 'Pendiente',
  review_requested_at date,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists consulting_milestones_project_id_idx
  on public.consulting_milestones (project_id);

-- ---------- Insumos del cliente (pasos 14-16) ----------
-- Si no llegan en la fecha acordada: tarea de seguimiento al líder y,
-- a las 48 horas, tarea de escalamiento al comercial.
create table if not exists public.consulting_inputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.consulting_projects (id) on delete cascade,
  title text not null,
  due_date date,
  received boolean not null default false,
  received_at date,
  created_at timestamptz not null default now()
);

create index if not exists consulting_inputs_project_id_idx
  on public.consulting_inputs (project_id);

-- ---------- Cambios de alcance (pasos 23-25) ----------
-- Nada fuera de alcance se trabaja sin formalizar: cada solicitud se
-- registra con su estado y, si aplica, el monto de la cotización.
create table if not exists public.consulting_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.consulting_projects (id) on delete cascade,
  title text not null,
  in_scope boolean not null default false,   -- ¿incluido en el alcance original?
  -- En evaluación | Cotizado | Aprobado | Rechazado | Aplicado
  status text not null default 'En evaluación',
  amount numeric(12,2),                      -- Monto de la cotización adicional (opcional)
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists consulting_changes_project_id_idx
  on public.consulting_changes (project_id);

-- ---------- Archivos del proyecto (insumos / entregables) ----------
create table if not exists public.consulting_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.consulting_projects (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size bigint not null default 0,
  mime_type text not null default '',
  uploaded_by text not null default '',
  category text not null default 'insumo',   -- insumo | entregable
  created_at timestamptz not null default now()
);

create index if not exists consulting_attachments_project_id_idx
  on public.consulting_attachments (project_id);

-- ---------- Seguridad (mismo criterio que el resto del CRM) ----------
alter table public.consulting_projects enable row level security;
alter table public.consulting_milestones enable row level security;
alter table public.consulting_inputs enable row level security;
alter table public.consulting_changes enable row level security;
alter table public.consulting_attachments enable row level security;

drop policy if exists "authenticated all consulting_projects" on public.consulting_projects;
create policy "authenticated all consulting_projects" on public.consulting_projects
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated all consulting_milestones" on public.consulting_milestones;
create policy "authenticated all consulting_milestones" on public.consulting_milestones
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated all consulting_inputs" on public.consulting_inputs;
create policy "authenticated all consulting_inputs" on public.consulting_inputs
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated all consulting_changes" on public.consulting_changes;
create policy "authenticated all consulting_changes" on public.consulting_changes
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated all consulting_attachments" on public.consulting_attachments;
create policy "authenticated all consulting_attachments" on public.consulting_attachments
  for all to authenticated using (true) with check (true);

-- Recordatorios: el nuevo tipo de tarea "Consultoría" queda activado
-- para los perfiles existentes y los que se creen en adelante.
alter table public.profiles
  alter column reminder_prefs set default
    '{"enabled": true, "kinds": ["Logística","Preparación","Material","Revisión","Entrega","Seguimiento","Personal","Petición","Consultoría"]}';

update public.profiles
set reminder_prefs = jsonb_set(
  reminder_prefs,
  '{kinds}',
  coalesce(reminder_prefs->'kinds', '[]'::jsonb) || '["Consultoría"]'::jsonb
)
where not coalesce(reminder_prefs->'kinds', '[]'::jsonb) ? 'Consultoría';
