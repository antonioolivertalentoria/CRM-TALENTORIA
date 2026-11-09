-- Migración 029: pedidos de constancias, DC-3 y gafetes (09-nov-2026)
--
-- Nueva logística: quien lleva el curso o el team building (normalmente
-- Oli) PIDE las constancias, DC-3 o gafetes; América Díaz las HACE y se
-- las ENTREGA; y quien pidió las envía al cliente (en capacitaciones eso
-- sigue siendo envio_constancias / envio_dc3 del checklist).
--
-- Un renglón por pedido: así se puede pedir, corregir y volver a pedir
-- sin perder el historial, y sirve igual para capacitaciones y team
-- buildings (los dos viven en trainings).

create table if not exists public.document_orders (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete cascade,
  doc_type text not null default 'Constancias'
    check (doc_type in ('Constancias', 'DC-3', 'Gafetes')),
  status text not null default 'Pedida'
    check (status in ('Pedida', 'Realizada', 'Entregada')),
  quantity integer,
  -- Instrucciones de quien pide (logo del cliente, quién firma, colores…)
  details text not null default '',
  -- Quien las hace (América) y quien las pidió (a quien se le entregan)
  maker text not null default '',
  requested_by text not null default '',
  -- Para cuándo las necesita quien pidió
  needed_by date,
  -- Dónde quedaron los archivos (carpeta de Drive, PDF…)
  files_url text not null default '',
  -- Veces que se regresó a corregir y la última corrección pedida
  corrections integer not null default 0,
  correction_note text not null default '',
  requested_at timestamptz not null default now(),
  made_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists document_orders_training_id_idx
  on public.document_orders (training_id);
create index if not exists document_orders_status_idx
  on public.document_orders (status);

-- Solo el equipo (no el usuario invitado de marketing), igual que
-- capacitaciones desde la migración 022.
alter table public.document_orders enable row level security;

drop policy if exists "team all document_orders" on public.document_orders;
create policy "team all document_orders" on public.document_orders
  for all to authenticated using (public.is_team()) with check (public.is_team());
