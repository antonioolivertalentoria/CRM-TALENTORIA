-- ============================================================
-- Migración 023 — Vacantes pausadas
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, después de la 022)
--
-- Reclutamiento pidió el estado "Pausada": la vacante se deja de trabajar
-- un tiempo pero no desaparece. Mientras está pausada no genera tareas ni
-- recordatorios. Estas columnas guardan en qué fase iba (para reanudarla
-- ahí mismo) y cuántos días estuvo detenida con la terna corriendo (para
-- que el plazo de 10 días hábiles no amanezca vencido al reanudar).
-- El estado en sí no necesita migración: status es texto libre.
-- ============================================================

alter table public.recruitment_vacancies
  add column if not exists paused_from text,
  add column if not exists paused_at date,
  add column if not exists paused_days integer not null default 0;
