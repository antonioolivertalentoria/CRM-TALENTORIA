-- ============================================================
-- Migración 014 — Archivos ligados a hitos e insumos de consultoría
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-013)
-- Todo es aditivo: no modifica ni borra datos existentes.
--
-- Cada archivo del proyecto puede colgar de un hito (entregable listo)
-- o de un insumo (documento que entregó el cliente). Si el hito o
-- insumo se borra, el archivo queda a nivel proyecto (set null).
-- ============================================================

alter table public.consulting_attachments
  add column if not exists milestone_id uuid references public.consulting_milestones (id) on delete set null,
  add column if not exists input_id uuid references public.consulting_inputs (id) on delete set null;

create index if not exists consulting_attachments_milestone_id_idx
  on public.consulting_attachments (milestone_id);
create index if not exists consulting_attachments_input_id_idx
  on public.consulting_attachments (input_id);
