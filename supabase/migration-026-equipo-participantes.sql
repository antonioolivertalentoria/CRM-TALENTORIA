-- ============================================================
-- Migración 026 — Qué usan los participantes en cada capacitación
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-025)
-- Todo es aditivo: no modifica ni borra datos existentes.
--
-- Revisión de Arianna a los mensajes de logística (05-nov-2026): no todos
-- los cursos usan IA ni piden computadora, y eso tiene que quedar definido
-- por capacitación para que el mensaje pregunte lo que corresponde.
--
--   · usa_ia: '' (sin definir: el CRM sugiere según el nombre) | 'Sí' | 'No'.
--   · herramientas_ia: las que usarán ("ChatGPT y Gemini"), para avisar
--     desde el primer mensaje que lleguen con usuario.
--   · requiere_computadora: '' | 'Sí' | 'No' (presencial: cada quien lleva
--     su computadora; las encuestas siempre son desde el celular).
-- ============================================================

alter table public.trainings
  add column if not exists usa_ia text not null default '',
  add column if not exists herramientas_ia text not null default '',
  add column if not exists requiere_computadora text not null default '';
