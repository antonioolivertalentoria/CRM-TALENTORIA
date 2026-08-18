-- ============================================================
-- Migración 009 — Subtareas, aviso de completada e insumos/entregables
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-008)
-- Todo es aditivo: no modifica ni borra datos existentes.
-- ============================================================

-- Aviso opcional: al completarse la tarea se manda correo a quien la pidió.
-- Apagado por defecto (las tareas propias y las automáticas no avisan).
alter table public.custom_tasks
  add column if not exists notify_on_complete boolean not null default false;

-- Adjuntos: insumo (lo que se necesita para trabajar) o entregable
-- (el resultado que se entrega). Los archivos ya subidos quedan como
-- insumos y se pueden reclasificar desde la interfaz con un clic.
alter table public.task_attachments
  add column if not exists category text not null default 'insumo';

-- Subtareas de las tareas propias: partes de una tarea, cada una con
-- su fecha opcional. Alimentan el medidor de avance ("2 de 5").
create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.custom_tasks (id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists subtasks_task_id_idx on public.subtasks (task_id);

alter table public.subtasks enable row level security;

drop policy if exists "authenticated all subtasks" on public.subtasks;
create policy "authenticated all subtasks" on public.subtasks
  for all to authenticated using (true) with check (true);
