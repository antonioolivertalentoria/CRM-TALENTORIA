-- ============================================================
-- Migración 010 — Registro de actividad (quién hizo qué y cuándo)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-009)
-- Todo es aditivo: no modifica ni borra datos existentes.
--
-- Espacio: cada evento pesa ~200 bytes; con uso normal son unos
-- cuantos MB al año. Además, el cron diario de recordatorios borra
-- los eventos con más de 90 días, así que nunca crece sin control.
-- ============================================================

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null default '',        -- Quién hizo el cambio
  action text not null default '',       -- creó | completó | editó | eliminó | cambió | reabrió | registró
  entity_type text not null default '',  -- tarea | capacitación | sesión | material | cliente | facilitador
  entity_id text not null default '',    -- id de la fila afectada (texto, por si ya no existe)
  summary text not null default '',      -- Descripción legible: "completó la tarea 'Enviar manual' (Minsa)"
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx
  on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;

-- Todos los usuarios pueden ver el registro y agregar eventos;
-- nadie lo edita ni lo borra desde la app (solo la limpieza del cron,
-- que usa la service role key y no pasa por RLS).
drop policy if exists "authenticated read activity_log" on public.activity_log;
create policy "authenticated read activity_log" on public.activity_log
  for select to authenticated using (true);

drop policy if exists "authenticated insert activity_log" on public.activity_log;
create policy "authenticated insert activity_log" on public.activity_log
  for insert to authenticated with check (true);
