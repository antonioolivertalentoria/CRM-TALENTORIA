-- ============================================================
-- Migración 017 — Informes de encuesta, documentos de consultoría
--                 y sesiones libres de consultoría
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-016)
-- Todo es aditivo: no modifica ni borra datos existentes.
--
-- Qué agrega:
--  1. En capacitaciones, consultoría y reclutamiento: dónde pegar el
--     link del informe de la encuesta de satisfacción de participantes
--     y el del informe de la encuesta al cliente contratante.
--  2. En consultoría: un segundo link de Drive con los documentos y
--     formatos que el equipo usa siempre.
--  3. En consultoría: sesiones ilimitadas (antes solo existían las dos
--     reuniones fijas de arranque y entrega).
-- ============================================================

-- ---------- 1. Informes de encuesta de satisfacción ----------
-- Dos links por proyecto: el de participantes y el del cliente que contrató.
alter table public.trainings
  add column if not exists informe_encuesta_url text not null default '',
  add column if not exists informe_encuesta_cliente_url text not null default '';

alter table public.consulting_projects
  add column if not exists informe_encuesta_url text not null default '',
  add column if not exists informe_encuesta_cliente_url text not null default '';

alter table public.recruitment_vacancies
  add column if not exists informe_encuesta_url text not null default '',
  add column if not exists informe_encuesta_cliente_url text not null default '';

-- ---------- 2. Carpeta de documentos de trabajo (consultoría) ----------
-- Distinta de drive_folder_url (que es la carpeta del proyecto): aquí van
-- los formatos y documentos que se usan en todas las consultorías.
alter table public.consulting_projects
  add column if not exists documents_url text not null default '';

-- ---------- 3. Sesiones de consultoría ----------
-- Las reuniones de arranque y entrega siguen viviendo en el proyecto
-- (de ahí cuelgan los plazos del mapa del proceso). Esta tabla es para
-- todas las demás: diagnóstico, avances, talleres, cierre, las que sean.
create table if not exists public.consulting_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.consulting_projects (id) on delete cascade,
  title text not null default '',
  session_date date,
  start_time time,
  end_time time,
  -- Online | Presencial | Híbrida
  modality text not null default 'Online',
  platform text not null default '',
  session_link text not null default '',
  -- Quién la lleva por parte de Talentoría
  facilitator text not null default '',
  -- Pendiente | Programada | Realizada | Cancelada
  status text not null default 'Programada',
  notes text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consulting_sessions_project_id_idx
  on public.consulting_sessions (project_id);

drop trigger if exists consulting_sessions_updated_at on public.consulting_sessions;
create trigger consulting_sessions_updated_at before update on public.consulting_sessions
  for each row execute function public.set_updated_at();

alter table public.consulting_sessions enable row level security;

drop policy if exists "authenticated all consulting_sessions" on public.consulting_sessions;
create policy "authenticated all consulting_sessions" on public.consulting_sessions
  for all to authenticated using (true) with check (true);
