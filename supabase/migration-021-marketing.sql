-- ============================================================
-- Migración 021 — Módulo de Marketing (Mailing y SEO)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-020)
-- Todo es aditivo: no modifica ni borra datos existentes.
--
-- Basado en los mapas "Proceso de Mailing" (14 pasos, proyecto recurrente
-- mensual) y "Proceso de SEO y páginas" (19 pasos, Proyecto SEO 2026).
--
-- Los pasos de cada flujo viven en el código (src/lib/marketing-flows.ts)
-- con su responsable y su SLA; aquí solo se guarda lo que la gente captura
-- de cada paso: estado, fecha comprometida, evidencia y bloqueos. Así el
-- mes de mailing o la página SEO no hay que "sembrarlos": existen desde
-- que existe el proyecto, y si el proceso cambia, cambia en todos.
--
-- Responsables: Oliver → owner, Perla → director, Óscar → collaborator
-- ("Colaborador responsable", usuario invitado), Eduardo → finance.
-- ============================================================

-- ---------- Proyectos (uno de Mailing, uno de SEO por año) ----------
create table if not exists public.marketing_projects (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'Mailing',          -- Mailing | SEO
  name text not null,
  status text not null default 'Activo',         -- Activo | En pausa | Cerrado
  owner text not null default 'Antonio Oliver',  -- Responsable general / calidad y transferencia
  director text not null default 'Perla Torres', -- Dirección y aprobación
  collaborator text not null default 'Colaborador responsable', -- Apoyo / construcción y análisis
  finance text not null default 'Eduardo Évora', -- Compra de dominios (SEO paso 6)
  started_at date not null default current_date, -- Lo anterior a esta fecha se hizo fuera del CRM
  start_month date not null,                     -- Primer mes del ciclo mensual (día 1)
  end_month date,                                -- Último mes del ciclo (null = sin fin)
  priorities text not null default '',           -- SEO paso 1: prioridades comerciales
  drive_folder_url text not null default '',
  dashboard_url text not null default '',        -- MailerLite / Search Console
  slack_channel_url text not null default '',    -- Canal de Slack de marketing (leads a Perla)
  notes text not null default '',
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists marketing_projects_updated_at on public.marketing_projects;
create trigger marketing_projects_updated_at before update on public.marketing_projects
  for each row execute function public.set_updated_at();

-- ---------- Estado de cada paso del flujo ----------
-- step_key identifica el paso: "2026-11:s4" (paso 4 del mes de noviembre),
-- "2026-11:w-2026-11-09" (reporte semanal del lunes 9), "b:b7" (paso único
-- del proyecto SEO), "p:<id página>:p9" (brief de una página).
create table if not exists public.marketing_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.marketing_projects (id) on delete cascade,
  step_key text not null,
  status text not null default 'Pendiente',      -- Pendiente | En proceso | Listo | No aplica
  -- Rombos del flujo: Aprobado | Cambios solicitados | Sin hallazgos |
  -- Con hallazgos | Corregido | Funciona | Falla | Validado | Nueva práctica |
  -- Autorizado | No autorizado
  result text not null default '',
  due_date date,                                 -- Fecha comprometida (null = la del flujo)
  evidence_url text not null default '',         -- Enlace de evidencia
  notes text not null default '',
  blocker text not null default '',              -- Bloqueo externo comunicado (bono)
  blocker_at date,
  completed_at date,
  rounds int not null default 0,                 -- Veces que regresó por cambios
  updated_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, step_key)
);

create index if not exists marketing_steps_project_id_idx on public.marketing_steps (project_id);

drop trigger if exists marketing_steps_updated_at on public.marketing_steps;
create trigger marketing_steps_updated_at before update on public.marketing_steps
  for each row execute function public.set_updated_at();

-- ---------- Datos de cada mes (criterios del bono) ----------
create table if not exists public.marketing_periods (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.marketing_projects (id) on delete cascade,
  period date not null,                          -- Día 1 del mes
  bonus_criteria text not null default '',       -- Criterios acordados al inicio del mes
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, period)
);

-- ---------- Mailing: envíos del mes (pasos 6-9) ----------
-- Estados por envío: En preparación → Pendiente de aprobación → Aprobado →
-- Probado → Programado → Enviado → Reportado. Correcciones regresan a
-- preparación.
create table if not exists public.marketing_sends (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.marketing_projects (id) on delete cascade,
  period date not null,                          -- Mes al que pertenece (día 1)
  send_date date,
  send_time time,
  type text not null default 'Correo',           -- Correo | Masterclass | Recurso
  base text not null default '',                 -- Base de datos / segmento
  subject text not null default '',
  objective text not null default '',
  cta text not null default '',
  resource text not null default '',             -- Recurso que se regala
  content_url text not null default '',          -- Contenido final
  status text not null default 'En preparación',
  evidence_url text not null default '',         -- Evidencia de la programación
  incidents text not null default '',
  -- Resultados para los informes de los días 15 y 27
  base_size int,
  delivered int,
  bounces int,
  unsubscribes int,
  clicks int,
  signups int,
  replies int,
  leads int,
  scheduled_at date,
  sent_at date,
  notes text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_sends_project_period_idx
  on public.marketing_sends (project_id, period);

drop trigger if exists marketing_sends_updated_at on public.marketing_sends;
create trigger marketing_sends_updated_at before update on public.marketing_sends
  for each row execute function public.set_updated_at();

-- ---------- Suscriptores y leads (mailing paso 10, SEO formularios) ----------
create table if not exists public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.marketing_projects (id) on delete set null,
  channel text not null default 'Mailing',       -- Mailing | SEO | Otro
  lead_date date not null default current_date,
  name text not null default '',
  email text not null default '',
  company text not null default '',
  job_title text not null default '',
  source text not null default '',               -- Formulario o campaña de origen
  segment text not null default '',
  consent text not null default 'Sí',            -- Sí | No | Por confirmar
  lead_type text not null default 'Suscripción', -- Suscripción | Oportunidad comercial
  commercial_action text not null default '',
  responsible text not null default '',
  next_step text not null default '',
  duplicate boolean not null default false,
  sent_to_commercial date,                       -- Cuándo pasó a Perla por Slack
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_leads_lead_date_idx on public.marketing_leads (lead_date);

drop trigger if exists marketing_leads_updated_at on public.marketing_leads;
create trigger marketing_leads_updated_at before update on public.marketing_leads
  for each row execute function public.set_updated_at();

-- ---------- SEO: páginas (pasos 4-13, por página) ----------
create table if not exists public.marketing_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.marketing_projects (id) on delete cascade,
  name text not null,
  service text not null default '',
  city text not null default 'CDMX',
  url text not null default '',
  reference_url text not null default '',        -- Página de Chihuahua que sirve de base
  audience text not null default '',
  offer text not null default '',
  objective text not null default '',
  cta text not null default '',
  main_query text not null default '',           -- Consulta principal
  -- Paso 5: Por decidir | Mejorar URL existente | Nueva URL en sitio principal | Dominio nuevo
  architecture text not null default 'Por decidir',
  domain text not null default '',
  target_date date,                              -- Fecha objetivo de publicación
  status text not null default 'En curso',       -- En curso | Cerrada | En pausa
  data_url text not null default '',             -- Enlace a datos
  lead_origin text not null default 'Pendiente', -- Registro de origen del lead
  notes text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_pages_project_id_idx on public.marketing_pages (project_id);

drop trigger if exists marketing_pages_updated_at on public.marketing_pages;
create trigger marketing_pages_updated_at before update on public.marketing_pages
  for each row execute function public.set_updated_at();

-- ---------- SEO: inventario de URL (paso 2) ----------
create table if not exists public.marketing_urls (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.marketing_projects (id) on delete cascade,
  url text not null,
  service text not null default '',
  city text not null default '',
  purpose text not null default '',
  indexing text not null default 'Por revisar',  -- Indexada | No indexada | Por revisar | Excluida
  form text not null default '',
  responsible text not null default '',
  last_updated date,
  improvement text not null default '',          -- Mejora priorizada (paso 16)
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_urls_project_id_idx on public.marketing_urls (project_id);

drop trigger if exists marketing_urls_updated_at on public.marketing_urls;
create trigger marketing_urls_updated_at before update on public.marketing_urls
  for each row execute function public.set_updated_at();

-- ---------- Seguridad (mismo criterio que el resto del CRM) ----------
alter table public.marketing_projects enable row level security;
alter table public.marketing_steps enable row level security;
alter table public.marketing_periods enable row level security;
alter table public.marketing_sends enable row level security;
alter table public.marketing_leads enable row level security;
alter table public.marketing_pages enable row level security;
alter table public.marketing_urls enable row level security;

drop policy if exists "authenticated all marketing_projects" on public.marketing_projects;
create policy "authenticated all marketing_projects" on public.marketing_projects
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated all marketing_steps" on public.marketing_steps;
create policy "authenticated all marketing_steps" on public.marketing_steps
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated all marketing_periods" on public.marketing_periods;
create policy "authenticated all marketing_periods" on public.marketing_periods
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated all marketing_sends" on public.marketing_sends;
create policy "authenticated all marketing_sends" on public.marketing_sends
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated all marketing_leads" on public.marketing_leads;
create policy "authenticated all marketing_leads" on public.marketing_leads
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated all marketing_pages" on public.marketing_pages;
create policy "authenticated all marketing_pages" on public.marketing_pages
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated all marketing_urls" on public.marketing_urls;
create policy "authenticated all marketing_urls" on public.marketing_urls
  for all to authenticated using (true) with check (true);

-- Recordatorios: el nuevo tipo de tarea "Marketing" queda activado
-- para los perfiles existentes y los que se creen en adelante.
alter table public.profiles
  alter column reminder_prefs set default
    '{"enabled": true, "kinds": ["Logística","Preparación","Material","Revisión","Entrega","Seguimiento","Personal","Petición","Consultoría","Reclutamiento","Marketing"]}';

update public.profiles
set reminder_prefs = jsonb_set(
  reminder_prefs,
  '{kinds}',
  coalesce(reminder_prefs->'kinds', '[]'::jsonb) || '["Marketing"]'::jsonb
)
where not coalesce(reminder_prefs->'kinds', '[]'::jsonb) ? 'Marketing';
