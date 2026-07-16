-- Migración 003 — Encuesta de satisfacción de participantes
-- como parte de Entregas y seguimiento de la capacitación.
alter table public.trainings
  add column if not exists encuesta_participantes text not null default 'Pendiente';
