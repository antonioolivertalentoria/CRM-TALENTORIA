-- ============================================================
-- Migración 012 — Correo por facilitador (invitaciones de calendario)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-011)
-- Todo es aditivo: no modifica ni borra datos existentes.
--
-- El CRM manda invitaciones de Google Calendar (.ics por correo) al
-- crear o mover sesiones. Los correos del equipo salen de profiles;
-- este campo permite invitar también a facilitadores del catálogo
-- que no son usuarios del CRM.
-- ============================================================

alter table public.facilitators
  add column if not exists email text not null default '';

update public.facilitators
set email = 'carolinagarcia@talentoria.com'
where lower(name) = lower('Carolina García') and email = '';
