-- ============================================================
-- Migración 004 — Checklist completo del proceso + recordatorios
-- (incluye la migración 003 por si no se corrió)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

alter table public.trainings
  add column if not exists encuesta_participantes text not null default 'Pendiente',
  add column if not exists contenido_facilitador text not null default 'Pendiente',
  add column if not exists lista_participantes text not null default 'Pendiente',
  add column if not exists impresion_manuales text not null default 'Pendiente',
  add column if not exists encuestas_qr text not null default 'Pendiente',
  add column if not exists liga_sesion_valida text not null default 'Pendiente';

-- Preferencias de recordatorios por correo (por usuario)
alter table public.profiles
  add column if not exists reminder_prefs jsonb not null default
    '{"enabled": true, "kinds": ["Logística","Preparación","Material","Revisión","Entrega","Seguimiento"]}';
