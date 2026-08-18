-- ============================================================
-- Migración 007 — Catálogo de facilitadores
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-006)
-- Todo es aditivo: no modifica ni borra datos existentes.
-- ============================================================

-- Facilitadores que imparten sesiones. Antes vivían fijos en el código
-- (EXTRA_FACILITATORS); ahora cualquiera del equipo puede darlos de alta.
-- is_internal controla el plazo de entrega de contenido (7 días si es
-- del equipo, 14 si es externo) en el motor de tareas.
create table if not exists public.facilitators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_internal boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.facilitators enable row level security;

drop policy if exists "authenticated all facilitators" on public.facilitators;
create policy "authenticated all facilitators" on public.facilitators
  for all to authenticated using (true) with check (true);

-- Semilla: los facilitadores que ya estaban fijos en el código
insert into public.facilitators (name, is_internal)
select 'Carolina García', true
where not exists (
  select 1 from public.facilitators where lower(name) = lower('Carolina García')
);
