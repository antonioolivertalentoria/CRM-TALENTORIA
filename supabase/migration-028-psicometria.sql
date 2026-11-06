-- ============================================================
-- Migración 028 — Módulo de Psicometría
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, después de la 027)
-- Todo es aditivo: no modifica ni borra datos existentes.
--
-- Basado en el "Mapa del Proceso de Psicometría" que hizo Jaqui
-- (28-oct-2026, 14 pasos con responsables y SLAs). Los rombos del mapa
-- (3: ¿información completa?, 8: ¿recibió las pruebas?, 12: ¿es viable?)
-- son estados; los pasos con SLA se vuelven tareas automáticas en
-- "Mis tareas".
--
-- Los pasos de factura (2 y 5) no generan tareas: las facturas quedaron
-- fuera del CRM el 27-oct-2026.
--
-- El reloj del proceso es requisition_at (paso 1: se recibe la
-- requisición del cliente por el grupo de WhatsApp).
-- ============================================================

-- ---------- Solicitudes (una por requisición del cliente) ----------
create table if not exists public.psychometric_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null,                          -- Ej. "Personal de guardería, noviembre"
  -- Fase: Requisición | En aplicación | Reportes | Entregada | Pausada | Cancelada
  -- (las cuatro primeras se calculan solas con el avance de las personas)
  status text not null default 'Requisición',
  report_type text not null default 'Empresa',  -- Empresa | Guardería (paso 11)
  evaluator text not null default 'Jacqueline Lara', -- PSICOMETRÍA (dueña del proceso)
  comercial text not null default 'Perla Torres',
  tests text not null default '',               -- Pruebas a aplicar (MMPI, 16PF…)
  test_links text not null default '',          -- Ligas y tiempos para el mensaje del paso 6
  requisition_at date,                          -- paso 1: INICIO DE TIEMPOS
  client_deadline date,                         -- Cuándo necesita el cliente los reportes
  -- paso 1: recibir la información y aclarar dudas (Pendiente | Listo)
  requisicion_revisada text not null default 'Pendiente',
  -- rombo 3: Pendiente | Sí | No  ("No" abre el paso 4 para Comercial)
  info_completa text not null default 'Pendiente',
  info_checked_at date,
  whatsapp_group text not null default '',
  drive_folder_url text not null default '',
  notes text not null default '',
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists psychometric_requests_client_id_idx
  on public.psychometric_requests (client_id);
create index if not exists psychometric_requests_status_idx
  on public.psychometric_requests (status);

drop trigger if exists psychometric_requests_updated_at on public.psychometric_requests;
create trigger psychometric_requests_updated_at before update on public.psychometric_requests
  for each row execute function public.set_updated_at();

-- ---------- Personas evaluadas (pasos 6-14) ----------
-- Un renglón por persona: cada una avanza por su cuenta desde el envío de
-- las pruebas hasta la entrega de su reporte.
create table if not exists public.psychometric_people (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.psychometric_requests (id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  job_title text not null default '',           -- Puesto
  status text not null default 'Activa',        -- Activa | Cancelada
  sent_at date,                                 -- paso 6: pruebas enviadas
  -- rombo 8: Pendiente | Recibidas | No recibidas
  receipt text not null default 'Pendiente',
  receipt_at date,
  -- paso 9 (solo si no las recibió): Pendiente | Listo | No aplica
  client_followup text not null default 'Pendiente',
  -- paso 10: Pendiente | Completas
  tests_done text not null default 'Pendiente',
  tests_done_at date,
  -- paso 11: Pendiente | Listo
  report_status text not null default 'Pendiente',
  report_done_at date,
  report_url text not null default '',
  -- rombo 12: Pendiente | Apta | Apta con reservas | No apta
  result text not null default 'Pendiente',
  result_at date,
  -- paso 13 (si no es viable sin reservas): Pendiente | Listo | No aplica
  validation text not null default 'Pendiente',
  validated_at date,
  delivered_at date,                            -- paso 14: reporte entregado
  notes text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists psychometric_people_request_id_idx
  on public.psychometric_people (request_id);

-- ---------- Seguridad (mismo criterio que el resto del equipo) ----------
-- Solo el equipo (no el usuario invitado de marketing), como clientes y
-- reclutamiento desde la migración 022.
alter table public.psychometric_requests enable row level security;
alter table public.psychometric_people enable row level security;

drop policy if exists "team all psychometric_requests" on public.psychometric_requests;
create policy "team all psychometric_requests" on public.psychometric_requests
  for all to authenticated using (public.is_team()) with check (public.is_team());
drop policy if exists "team all psychometric_people" on public.psychometric_people;
create policy "team all psychometric_people" on public.psychometric_people
  for all to authenticated using (public.is_team()) with check (public.is_team());

-- Recordatorios: el nuevo tipo de tarea "Psicometría" queda activado
-- para los perfiles existentes y los que se creen en adelante.
alter table public.profiles
  alter column reminder_prefs set default
    '{"enabled": true, "kinds": ["Logística","Preparación","Material","Revisión","Entrega","Seguimiento","Personal","Petición","Consultoría","Reclutamiento","Marketing","Psicometría"]}';

update public.profiles
set reminder_prefs = jsonb_set(
  reminder_prefs,
  '{kinds}',
  coalesce(reminder_prefs->'kinds', '[]'::jsonb) || '["Psicometría"]'::jsonb
)
where reminder_prefs is not null
  and not coalesce(reminder_prefs->'kinds', '[]'::jsonb) ? 'Psicometría';
