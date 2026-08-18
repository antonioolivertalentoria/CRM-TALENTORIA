-- ============================================================
-- Migración 008 — Registro de tiempo invertido por tarea
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-007)
-- Todo es aditivo: no modifica ni borra datos existentes.
-- ============================================================

-- Cada registro es "X minutos que <persona> invirtió en <tarea>".
-- task_key es la clave estable de la tarea en el motor de tareas:
--   - derivadas:  "<training_id>-<campo>" o "<material_id>-hacer/-revisar"
--   - personales: "custom-<custom_task_id>"
-- Se guarda también el título por si la tarea desaparece después
-- (p. ej. al completarse o borrarse), para no perder el histórico.
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  task_key text not null,
  task_title text not null default '',
  person text not null default '',
  minutes int not null check (minutes > 0),
  entry_date date not null default (now() at time zone 'America/Mexico_City')::date,
  created_at timestamptz not null default now()
);

create index if not exists time_entries_task_key_idx on public.time_entries (task_key);
create index if not exists time_entries_person_idx on public.time_entries (person);

alter table public.time_entries enable row level security;

drop policy if exists "authenticated all time_entries" on public.time_entries;
create policy "authenticated all time_entries" on public.time_entries
  for all to authenticated using (true) with check (true);
