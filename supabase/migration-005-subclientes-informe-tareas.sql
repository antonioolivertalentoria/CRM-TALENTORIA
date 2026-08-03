-- ============================================================
-- Migración 005 — Subclientes, informe de encuesta y tareas propias
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene schema.sql + 002/003/004)
-- Todo es aditivo: no modifica ni borra datos existentes.
-- ============================================================

-- Clientes "paraguas" que nos subcontratan (Ej. Coparmex → Sigma):
-- un cliente puede colgar de otro. Si parent_id es null es cliente normal
-- o cliente paraguas; sus subclientes lo referencian.
alter table public.clients
  add column if not exists parent_id uuid references public.clients (id) on delete set null;

create index if not exists clients_parent_id_idx on public.clients (parent_id);

-- Entrega del informe de resultados de la encuesta de satisfacción
-- (Pendiente | Listo | No aplica), parte del checklist post-capacitación.
alter table public.trainings
  add column if not exists informe_encuesta text not null default 'Pendiente';

-- Tareas propias (no derivadas de capacitaciones): lo que pide la jefa,
-- lo que se le pide a ella, pendientes de marca blanca, etc.
create table if not exists public.custom_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text not null default '',
  assignee text not null default '',        -- Para quién es la tarea
  requested_by text not null default '',    -- Quién la pidió
  client_id uuid references public.clients (id) on delete set null,
  due_date date,
  status text not null default 'Pendiente', -- Pendiente | Completada
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_tasks_status_idx on public.custom_tasks (status);
create index if not exists custom_tasks_client_id_idx on public.custom_tasks (client_id);

drop trigger if exists custom_tasks_updated_at on public.custom_tasks;
create trigger custom_tasks_updated_at before update on public.custom_tasks
  for each row execute function public.set_updated_at();

alter table public.custom_tasks enable row level security;

drop policy if exists "authenticated all custom_tasks" on public.custom_tasks;
create policy "authenticated all custom_tasks" on public.custom_tasks
  for all to authenticated using (true) with check (true);

-- Recordatorios: el nuevo tipo de tarea "Personal" queda activado para
-- los perfiles existentes y para los que se creen en adelante.
alter table public.profiles
  alter column reminder_prefs set default
    '{"enabled": true, "kinds": ["Logística","Preparación","Material","Revisión","Entrega","Seguimiento","Personal"]}';

update public.profiles
set reminder_prefs = jsonb_set(
  reminder_prefs,
  '{kinds}',
  coalesce(reminder_prefs->'kinds', '[]'::jsonb) || '["Personal"]'::jsonb
)
where not coalesce(reminder_prefs->'kinds', '[]'::jsonb) ? 'Personal';
