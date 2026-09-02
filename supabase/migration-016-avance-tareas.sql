-- ============================================================
-- Migración 016 — Avance de tareas ("En proceso" / "En espera")
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-015)
-- Todo es aditivo: no modifica ni borra datos existentes.
-- ============================================================

-- El problema que resuelve: hay tareas que ya se empezaron pero no se
-- pueden cerrar porque falta algo de fuera (p. ej. el mensaje de logística
-- que no se puede mandar porque comercial no ha creado el grupo de WhatsApp).
-- Dejarlas como "pendientes a secas" hace que se olvide lo que ya se hizo;
-- completarlas sería mentira. Con esto la tarea se pinta de amarillo, guarda
-- la bitácora de lo avanzado y SIGUE apareciendo como pendiente.

-- Estado de avance, uno por tarea. La llave es la misma clave estable del
-- motor de tareas que ya usa time_entries (task_key):
--   - derivadas:   "<training_id>-<campo>" o "<material_id>-hacer/-revisar"
--   - personales:  "custom-<custom_task_id>"
--   - consultoría/reclutamiento: sus propias claves
-- Al completar la tarea, la app borra su avance (ya no hace falta).
create table if not exists public.task_progress (
  task_key text primary key,
  task_title text not null default '',
  -- "En proceso" (ya la empecé) | "En espera" (hice mi parte, depende de otro)
  status text not null default 'En proceso',
  -- Solo para "En espera": de qué o de quién depende para poder cerrarse.
  waiting_for text not null default '',
  updated_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists task_progress_updated_at on public.task_progress;
create trigger task_progress_updated_at before update on public.task_progress
  for each row execute function public.set_updated_at();

-- Bitácora: cada anotación de "esto fue lo que hice", con su fecha.
create table if not exists public.task_progress_notes (
  id uuid primary key default gen_random_uuid(),
  task_key text not null,
  note text not null,
  author text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists task_progress_notes_task_key_idx
  on public.task_progress_notes (task_key);

alter table public.task_progress enable row level security;
alter table public.task_progress_notes enable row level security;

drop policy if exists "authenticated all task_progress" on public.task_progress;
create policy "authenticated all task_progress" on public.task_progress
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all task_progress_notes" on public.task_progress_notes;
create policy "authenticated all task_progress_notes" on public.task_progress_notes
  for all to authenticated using (true) with check (true);
