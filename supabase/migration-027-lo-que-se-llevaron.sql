-- ============================================================
-- Migración 027 — Lo que se llevaron los participantes
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-026)
-- Todo es aditivo: no modifica ni borra datos existentes.
--
-- Mensajes de seguimiento a 20 y 30 días (05-nov-2026): Oli pidió que
-- salgan listos para mandar, con los nombres y lo que se vio en el curso.
--
--   · aprendizajes: una línea que completa «¿ya pusieron en práctica …?»
--     (ej. "el feedback con el modelo TALENT"). Vacío = el mensaje usa
--     una pregunta general.
-- ============================================================

alter table public.trainings
  add column if not exists aprendizajes text not null default '';
