-- ============================================================
-- Migración 024 — Reporte de productividad (bitácora de tareas)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-023)
-- Todo es aditivo: no modifica ni borra datos existentes.
--
-- El problema que resuelve: las tareas del CRM se derivan de los
-- procesos y, al completarse, solo cambia un campo ("Enviado", "Listo"…).
-- No quedaba registro de cuándo vencían ni de quién eran, así que no se
-- podía saber si se cumplieron a tiempo. Esta bitácora lo anota sola:
-- la app la sincroniza con la llave de servicio cada vez que algo cambia.
--
-- Privacidad: cada persona solo puede leer SUS renglones; dirección
-- (lista de correos de abajo) lee todos. Nadie escribe directo desde el
-- navegador: todo pasa por el servidor, que revisa permisos. Así nadie
-- puede mover sus fechas por fuera ni ver los números de otro compañero.
-- ============================================================

-- Quién ve el reporte de todo el equipo. Debe coincidir con
-- PRODUCTIVITY_FULL_ACCESS en src/lib/productivity.ts.
create or replace function public.sees_all_productivity()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'ariannaevora@talentoria.com',
    'perlatorres@talentoria.com',
    'antoniooliver@talentoria.com'
  )
$$;

create table if not exists public.task_ledger (
  -- Misma clave estable del motor de tareas que usan time_entries y task_progress
  task_key text primary key,
  title text not null default '',
  kind text not null default '',
  module text not null default '',          -- Capacitaciones | Team buildings | Consultoría | Reclutamiento | Marketing | Tareas propias
  project text not null default '',
  client text not null default '',
  assignee text not null default '',
  href text not null default '',
  complete jsonb,                           -- Cómo se completa (para saber si se cerró, se canceló o se marcó "No aplica")
  training_id text not null default '',
  first_seen date not null,                 -- Primer día que la bitácora vio la tarea abierta
  last_seen date not null,
  engine_due date,                          -- Última fecha que dio el motor de tareas
  deadline date,                            -- Fecha límite que cuenta para el reporte (ver productivity.ts)
  user_dated boolean not null default false,-- La fecha la pone una persona (tareas propias): se respetan las renegociaciones
  backlog boolean not null default false,   -- Ya venía atrasada cuando arrancó la bitácora: no cuenta
  state text not null default 'abierta',    -- abierta | cerrada | excluida
  closed_at date,
  exclude_reason text not null default '',  -- cancelada | eliminada | no aplica | proyecto cerrado | en pausa
  waiting_for text not null default '',     -- "⏸ En espera": de qué o de quién dependía
  waiting_since date,                       -- Desde cuándo quedó en espera (si fue antes de vencer, no cuenta en contra)
  context text not null default '',         -- "¿Qué pasó?" — contexto que escribe la persona
  context_by text not null default '',
  context_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_ledger_assignee_idx on public.task_ledger (assignee);
create index if not exists task_ledger_deadline_idx on public.task_ledger (deadline);

drop trigger if exists task_ledger_updated_at on public.task_ledger;
create trigger task_ledger_updated_at before update on public.task_ledger
  for each row execute function public.set_updated_at();

alter table public.task_ledger enable row level security;

drop policy if exists "read own task_ledger" on public.task_ledger;
create policy "read own task_ledger" on public.task_ledger
  for select to authenticated
  using (public.is_team() and (public.sees_all_productivity() or assignee = public.my_name()));

-- Acuerdos de cada mes ("cómo nos vamos a medir"), escritos al inicio del
-- periodo. Se guarda quién y cuándo los editó por última vez, a la vista.
create table if not exists public.productivity_agreements (
  period text primary key,                  -- "AAAA-MM"
  body text not null default '',
  updated_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists productivity_agreements_updated_at on public.productivity_agreements;
create trigger productivity_agreements_updated_at before update on public.productivity_agreements
  for each row execute function public.set_updated_at();

alter table public.productivity_agreements enable row level security;

drop policy if exists "team read productivity_agreements" on public.productivity_agreements;
create policy "team read productivity_agreements" on public.productivity_agreements
  for select to authenticated using (public.is_team());
