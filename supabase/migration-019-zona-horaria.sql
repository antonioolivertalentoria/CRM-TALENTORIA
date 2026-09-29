-- ============================================================
-- Migración 019 — Zona horaria de la sede
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-018)
-- Aditiva: agrega columnas con valor por omisión = la hora del centro,
-- que es como el CRM trataba todas las horas hasta hoy.
--
-- El hueco que tapa (29-sep-2026): la hora de una sesión se guardaba
-- sola ("09:00") y la invitación de calendario salía siempre como hora
-- del centro. Matamoros cambia de horario igual que Texas y de marzo a
-- noviembre va una hora adelante: la sesión de NOM-035 de Index
-- Matamoros de las 9:00 de allá le llegó a la facilitadora como 9:00 de
-- aquí y llegó una hora tarde.
--
-- Regla desde ahora: la hora se captura como la dice el cliente (hora
-- local de la sede) y cada sesión guarda en qué zona está.
-- ============================================================

-- ---------- Zona de la sede del cliente ----------
-- Se usa para prellenar las sesiones nuevas de sus proyectos y para las
-- reuniones de arranque y entrega de consultoría.
alter table public.clients
  add column if not exists timezone text not null default 'America/Mexico_City';

-- ---------- Zona de cada sesión ----------
-- Por sesión, porque un mismo proyecto puede tener sesiones en sedes
-- distintas. Las nuevas copian la de la sesión anterior o la del cliente.
alter table public.sessions
  add column if not exists timezone text not null default 'America/Mexico_City';

alter table public.consulting_sessions
  add column if not exists timezone text not null default 'America/Mexico_City';

-- ---------- Datos: Index Matamoros ----------
-- Único cliente fuera de la hora del centro al 29-sep-2026. Los demás se
-- ajustan desde la ficha del cliente (Editar > Zona horaria de la sede).
update public.clients
  set timezone = 'America/Matamoros'
  where company ilike '%matamoros%';

-- Las sesiones de clientes con otra zona toman la del cliente.
update public.sessions s
  set timezone = c.timezone
  from public.trainings t
  join public.clients c on c.id = t.client_id
  where s.training_id = t.id
    and c.timezone <> 'America/Mexico_City';

update public.consulting_sessions s
  set timezone = c.timezone
  from public.consulting_projects p
  join public.clients c on c.id = p.client_id
  where s.project_id = p.id
    and c.timezone <> 'America/Mexico_City';
