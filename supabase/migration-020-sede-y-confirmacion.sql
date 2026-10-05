-- ============================================================
-- Migración 020 — Sede / dirección y mensaje de confirmación
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-019)
-- Todo es aditivo: no modifica ni borra datos existentes.
--
--   · venue: dirección, sala o área y referencia para llegar. Alimenta
--     la línea "Lugar" del mensaje de confirmación.
--   · mensaje_confirmacion: punto del checklist (Pendiente | Listo |
--     No aplica), se envía 2 días antes del curso.
-- ============================================================

alter table public.trainings
  add column if not exists venue text not null default '',
  add column if not exists mensaje_confirmacion text not null default 'Pendiente';
