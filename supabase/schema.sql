-- ============================================================
-- CRM Talentoría — Esquema de base de datos (Supabase)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- Basado en el Proceso de Logística de Capacitaciones y la
-- Matriz Capacitaciones Talentoría 2026.
-- ============================================================

-- ---------- Perfiles (uno por usuario de auth) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  created_at timestamptz not null default now()
);

-- Crea el perfil automáticamente cuando se da de alta un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Clientes ----------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text not null default '',
  email text not null default '',
  whatsapp text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Capacitaciones (el "proyecto" es la capacitación) ----------
create table public.trainings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  short_name text not null,
  official_name text not null default '',
  -- Estado General: Propuesta | Confirmada | En curso | Finalizada | Cancelada
  status text not null default 'Propuesta',
  total_sessions int,
  internal_owner text not null default '',     -- Responsable interno (Ej. Oliver)
  client_contact text not null default '',     -- Contacto del cliente para este proyecto
  client_email text not null default '',
  whatsapp_group text not null default '',     -- Liga o nombre del grupo de WhatsApp
  temario_url text not null default '',
  drive_folder_url text not null default '',   -- Carpeta del proyecto en Google Drive
  participants_url text not null default '',   -- Lista de participantes (link)
  materials_deadline date,                     -- Fecha límite de materiales
  priority text not null default 'Media',      -- Alta | Media | Baja
  -- Checklist post-capacitación y cierre (máx. 48h + seguimiento):
  -- valores: Pendiente | Listo | No aplica
  envio_manual text not null default 'Pendiente',
  envio_constancias text not null default 'Pendiente',
  envio_insignias text not null default 'Pendiente',
  envio_dc3 text not null default 'Pendiente',
  envio_leads text not null default 'Pendiente',
  encuesta_final text not null default 'Pendiente',   -- Encuesta cliente contratante
  factura text not null default 'Pendiente',          -- Cierre administrativo
  seguimiento_20 text not null default 'Pendiente',   -- Seguimiento día 20
  seguimiento_30 text not null default 'Pendiente',   -- Seguimiento día 30 y cierre de grupo WA
  mensaje_logistica text not null default 'Pendiente', -- Mensaje de logística (WhatsApp) antes del curso
  notes text not null default '',              -- Acciones específicas / notas
  internal_notes text not null default '',     -- Observaciones internas
  questions text not null default '',          -- Dudas
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trainings_client_id_idx on public.trainings (client_id);
create index trainings_status_idx on public.trainings (status);

-- ---------- Sesiones (cada capacitación puede tener varias) ----------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings (id) on delete cascade,
  session_number int not null default 1,
  module text not null default '',
  -- Estado Sesión: Pendiente | Programada | Confirmada | Impartida | Cancelada
  status text not null default 'Programada',
  session_date date,
  start_time time,
  end_time time,
  duration_hours numeric(5,2),
  facilitator text not null default '',
  modality text not null default '',           -- Online | Presencial | Híbrida
  platform text not null default '',           -- Zoom | Meet | Teams | N/A
  session_link text not null default '',
  enrolled int,                                -- # Inscritos
  attended int,                                -- # Asistentes
  survey_status text not null default 'Pendiente',
  survey_url text not null default '',
  survey_results_status text not null default 'Pendiente',
  survey_results_url text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_training_id_idx on public.sessions (training_id);
create index sessions_date_idx on public.sessions (session_date);

-- ---------- Materiales del proyecto (links a Google Drive) ----------
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings (id) on delete cascade,
  -- PPT | Manual participante | Manual ejercicios | Temario |
  -- Lista participantes | Encuesta | Constancias | Otro
  type text not null default 'Otro',
  name text not null,
  url text not null default '',
  status text not null default 'Pendiente',    -- Pendiente | En proceso | Por revisar | Listo
  maker text not null default '',              -- Quién lo hace
  reviewer text not null default '',           -- Quién lo revisa
  due_date date,                               -- Fecha límite del material
  created_at timestamptz not null default now()
);

create index materials_training_id_idx on public.materials (training_id);

-- ---------- Comentarios de revisión sobre materiales ----------
create table public.material_comments (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials (id) on delete cascade,
  author text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create index material_comments_material_id_idx on public.material_comments (material_id);

-- ---------- updated_at automático ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger trainings_updated_at before update on public.trainings
  for each row execute function public.set_updated_at();
create trigger sessions_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();

-- ---------- Seguridad (RLS): solo usuarios autenticados ----------
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.trainings enable row level security;
alter table public.sessions enable row level security;
alter table public.materials enable row level security;
alter table public.material_comments enable row level security;

create policy "authenticated read profiles" on public.profiles
  for select to authenticated using (true);
create policy "own profile update" on public.profiles
  for update to authenticated using (auth.uid() = id);

create policy "authenticated all clients" on public.clients
  for all to authenticated using (true) with check (true);
create policy "authenticated all trainings" on public.trainings
  for all to authenticated using (true) with check (true);
create policy "authenticated all sessions" on public.sessions
  for all to authenticated using (true) with check (true);
create policy "authenticated all materials" on public.materials
  for all to authenticated using (true) with check (true);
create policy "authenticated all material_comments" on public.material_comments
  for all to authenticated using (true) with check (true);
