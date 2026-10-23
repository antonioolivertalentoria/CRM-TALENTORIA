-- ============================================================
-- Migración 025 — Acuerdos de productividad por persona
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, después de la 024)
--
-- Los acuerdos del mes dejan de ser uno general para todo el equipo:
-- cada colaborador tiene los suyos (prioridades, meta de cumplimiento
-- opcional) y confirma que los recibió ("Enterado"). Si dirección los
-- modifica después, el acuse se reinicia.
--
-- La tabla nació vacía en la 024, así que el cambio de llave es seguro.
-- ============================================================

alter table public.productivity_agreements
  add column if not exists person text not null default '',
  add column if not exists target_pct int check (target_pct between 0 and 100),
  add column if not exists acknowledged_at timestamptz;

alter table public.productivity_agreements drop constraint if exists productivity_agreements_pkey;
alter table public.productivity_agreements add primary key (period, person);

-- Cada quien lee sus acuerdos; dirección lee los de todo el equipo.
-- Las escrituras pasan solo por el servidor (llave de servicio).
drop policy if exists "team read productivity_agreements" on public.productivity_agreements;
drop policy if exists "read own productivity_agreements" on public.productivity_agreements;
create policy "read own productivity_agreements" on public.productivity_agreements
  for select to authenticated
  using (public.is_team() and (public.sees_all_productivity() or person = public.my_name()));
