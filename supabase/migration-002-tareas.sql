-- ============================================================
-- Migración 002 — Tareas, responsables de materiales y logística
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene schema.sql)
-- ============================================================

-- Materiales: quién lo hace, quién lo revisa y fecha límite
alter table public.materials
  add column if not exists maker text not null default '',
  add column if not exists reviewer text not null default '',
  add column if not exists due_date date;

-- Capacitaciones: mensaje de logística por WhatsApp (Pendiente | Listo | No aplica)
-- e información logística confirmada por el cliente (texto libre)
alter table public.trainings
  add column if not exists mensaje_logistica text not null default 'Pendiente',
  add column if not exists logistics_info text not null default '';

-- Comentarios de revisión sobre materiales
create table if not exists public.material_comments (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials (id) on delete cascade,
  author text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists material_comments_material_id_idx
  on public.material_comments (material_id);

alter table public.material_comments enable row level security;

drop policy if exists "authenticated all material_comments" on public.material_comments;
create policy "authenticated all material_comments" on public.material_comments
  for all to authenticated using (true) with check (true);
