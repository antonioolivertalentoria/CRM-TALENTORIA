-- ============================================================
-- Migración 011 — Team buildings (peticiones y archivos)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-010)
-- Todo es aditivo: no modifica ni borra datos existentes.
--
-- Un team building usa el MISMO sistema que una capacitación
-- (cliente/subcliente, sesiones con fecha/horario/facilitador,
-- horas calculadas, calendario), distinguido por trainings.kind.
-- Lo que cambia: no lleva materiales/checklist/logística; en su
-- lugar lleva "peticiones" (gafetes, tarjetas, lo que pida el
-- cliente) que se palomean, y archivos para subir/bajar.
-- ============================================================

-- Tipo de proyecto: 'Capacitación' (todo lo existente) o 'Team building'
alter table public.trainings
  add column if not exists kind text not null default 'Capacitación';

create index if not exists trainings_kind_idx on public.trainings (kind);

-- Peticiones del team building: qué hay que preparar/conseguir.
-- Se palomean en la página del evento y aparecen en "Mis tareas"
-- (tipo "Petición") si tienen responsable o fecha.
create table if not exists public.training_requests (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings (id) on delete cascade,
  title text not null,
  assignee text not null default '',      -- Quién la va a resolver
  requested_by text not null default '',  -- Quién la pidió/capturó
  due_date date,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists training_requests_training_id_idx
  on public.training_requests (training_id);

alter table public.training_requests enable row level security;

drop policy if exists "authenticated all training_requests" on public.training_requests;
create policy "authenticated all training_requests" on public.training_requests
  for all to authenticated using (true) with check (true);

-- Archivos del team building (mismo bucket privado "adjuntos",
-- ruta teambuildings/<training_id>/...; las políticas de storage
-- de la migración 006 ya cubren todo el bucket).
create table if not exists public.training_attachments (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size bigint not null default 0,
  mime_type text not null default '',
  uploaded_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists training_attachments_training_id_idx
  on public.training_attachments (training_id);

alter table public.training_attachments enable row level security;

drop policy if exists "authenticated all training_attachments" on public.training_attachments;
create policy "authenticated all training_attachments" on public.training_attachments
  for all to authenticated using (true) with check (true);

-- Recordatorios: el nuevo tipo de tarea "Petición" queda activado para
-- los perfiles existentes y para los que se creen en adelante.
alter table public.profiles
  alter column reminder_prefs set default
    '{"enabled": true, "kinds": ["Logística","Preparación","Material","Revisión","Entrega","Seguimiento","Personal","Petición"]}';

update public.profiles
set reminder_prefs = jsonb_set(
  reminder_prefs,
  '{kinds}',
  coalesce(reminder_prefs->'kinds', '[]'::jsonb) || '["Petición"]'::jsonb
)
where not coalesce(reminder_prefs->'kinds', '[]'::jsonb) ? 'Petición';
