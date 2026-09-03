-- ============================================================
-- Migración 018 — Avisos de cierre y postventa para Comercial
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-017)
-- Todo es aditivo: no modifica ni borra datos existentes.
--
-- El hueco que tapa: Comercial (Perla) no se enteraba de nada del
-- cierre. Ahora, en cuanto un proyecto termina, le llegan dos avisos
-- en sus tareas y en el recordatorio diario:
--   1. CIERRE: se acabó el curso/proyecto → confirmar que los
--      entregables salieron y que la factura existe.
--   2. POSTVENTA: ya pasó el periodo de acompañamiento (30 días en
--      capacitaciones, 20 en consultoría) → retomar al cliente.
-- ============================================================

-- ---------- Comercial responsable de la capacitación ----------
-- Consultoría ya lo tenía; las capacitaciones no sabían de quién eran.
-- Se llena con Perla en todo lo existente y se puede cambiar por ficha.
alter table public.trainings
  add column if not exists comercial text not null default 'Perla Torres';

-- ---------- Puntos de checklist de Comercial ----------
-- Pendiente | Listo | No aplica, igual que el resto del checklist.
alter table public.trainings
  add column if not exists cierre_comercial text not null default 'Pendiente',
  add column if not exists postventa_comercial text not null default 'Pendiente';

alter table public.consulting_projects
  add column if not exists cierre_comercial text not null default 'Pendiente',
  add column if not exists postventa_comercial text not null default 'Pendiente';

-- Los proyectos que ya se cerraron hace mucho no deben llenar de avisos
-- viejos la bandeja: se marcan como no aplica.
update public.trainings
set cierre_comercial = 'No aplica', postventa_comercial = 'No aplica'
where status in ('Finalizada', 'Cancelada');

update public.consulting_projects
set cierre_comercial = 'No aplica', postventa_comercial = 'No aplica'
where status in ('Finalizado', 'Cancelado');
