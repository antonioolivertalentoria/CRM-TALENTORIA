-- ============================================================
-- Migración 022 — Usuarios invitados
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, después de la 021)
--
-- Un invitado es alguien que todavía no es parte del equipo (p. ej. el
-- "Colaborador responsable" de Marketing mientras se define si entra a
-- trabajar). Ve el módulo de Marketing y SUS tareas; no ve clientes,
-- capacitaciones, consultoría, reclutamiento ni las tareas de los demás.
--
-- Quién es invitado lo marca app_metadata.role = 'invitado' en Supabase
-- Auth (solo se puede poner con la llave de servicio: el usuario no puede
-- quitárselo). Para volverlo parte del equipo basta borrar ese rol; nadie
-- más cambia: quien no tiene rol sigue viendo todo, como siempre.
-- ============================================================

create or replace function public.is_team()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'invitado'
$$;

-- Nombre del usuario que hace la consulta (para "sus" tareas)
create or replace function public.my_name()
returns text
language sql
stable
as $$
  select full_name from public.profiles where id = auth.uid()
$$;

-- ---------- Tablas solo del equipo ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'trainings', 'sessions', 'materials', 'material_comments',
    'facilitators', 'training_requests', 'training_attachments',
    'consulting_projects', 'consulting_milestones', 'consulting_inputs',
    'consulting_changes', 'consulting_attachments', 'consulting_sessions',
    'recruitment_vacancies', 'recruitment_candidates', 'recruitment_attachments'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', 'authenticated all ' || t, t);
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_team()) with check (public.is_team())',
        'authenticated all ' || t, t
      );
    end if;
  end loop;
end $$;

-- ---------- Tareas propias: el invitado solo ve las suyas ----------
drop policy if exists "authenticated all custom_tasks" on public.custom_tasks;
create policy "authenticated all custom_tasks" on public.custom_tasks
  for all to authenticated
  using (public.is_team() or assignee = public.my_name() or requested_by = public.my_name())
  with check (public.is_team() or assignee = public.my_name() or requested_by = public.my_name());

-- Subtareas y adjuntos cuelgan de la tarea (la regla de arriba ya filtra)
drop policy if exists "authenticated all subtasks" on public.subtasks;
create policy "authenticated all subtasks" on public.subtasks
  for all to authenticated
  using (public.is_team() or exists (select 1 from public.custom_tasks c where c.id = task_id))
  with check (public.is_team() or exists (select 1 from public.custom_tasks c where c.id = task_id));

drop policy if exists "authenticated all task_attachments" on public.task_attachments;
create policy "authenticated all task_attachments" on public.task_attachments
  for all to authenticated
  using (public.is_team() or exists (select 1 from public.custom_tasks c where c.id = task_id))
  with check (public.is_team() or exists (select 1 from public.custom_tasks c where c.id = task_id));

-- Tiempo y avance: solo de tareas de Marketing ("mkt-…") y propias ("custom-…")
drop policy if exists "authenticated all time_entries" on public.time_entries;
create policy "authenticated all time_entries" on public.time_entries
  for all to authenticated
  using (public.is_team() or task_key like 'mkt-%' or task_key like 'custom-%')
  with check (public.is_team() or task_key like 'mkt-%' or task_key like 'custom-%');

drop policy if exists "authenticated all task_progress" on public.task_progress;
create policy "authenticated all task_progress" on public.task_progress
  for all to authenticated
  using (public.is_team() or task_key like 'mkt-%' or task_key like 'custom-%')
  with check (public.is_team() or task_key like 'mkt-%' or task_key like 'custom-%');

drop policy if exists "authenticated all task_progress_notes" on public.task_progress_notes;
create policy "authenticated all task_progress_notes" on public.task_progress_notes
  for all to authenticated
  using (public.is_team() or task_key like 'mkt-%' or task_key like 'custom-%')
  with check (public.is_team() or task_key like 'mkt-%' or task_key like 'custom-%');

-- Bitácora: el invitado deja registro de lo que hace, pero no lee la del equipo
drop policy if exists "authenticated read activity_log" on public.activity_log;
create policy "authenticated read activity_log" on public.activity_log
  for select to authenticated using (public.is_team());

-- ---------- Archivos: el invitado solo toca tareas/ y marketing/ ----------
drop policy if exists "adjuntos leer autenticados" on storage.objects;
create policy "adjuntos leer autenticados" on storage.objects
  for select to authenticated
  using (bucket_id = 'adjuntos' and (public.is_team() or name like 'tareas/%' or name like 'marketing/%'));

drop policy if exists "adjuntos subir autenticados" on storage.objects;
create policy "adjuntos subir autenticados" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'adjuntos' and (public.is_team() or name like 'tareas/%' or name like 'marketing/%'));

drop policy if exists "adjuntos actualizar autenticados" on storage.objects;
create policy "adjuntos actualizar autenticados" on storage.objects
  for update to authenticated
  using (bucket_id = 'adjuntos' and (public.is_team() or name like 'tareas/%' or name like 'marketing/%'));

drop policy if exists "adjuntos borrar autenticados" on storage.objects;
create policy "adjuntos borrar autenticados" on storage.objects
  for delete to authenticated
  using (bucket_id = 'adjuntos' and (public.is_team() or name like 'tareas/%' or name like 'marketing/%'));
