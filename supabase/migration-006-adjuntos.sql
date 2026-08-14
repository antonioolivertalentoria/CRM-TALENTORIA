-- ============================================================
-- Migración 006 — Archivos adjuntos en tareas propias
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- (una sola vez, sobre la base que ya tiene 001-005)
-- Todo es aditivo: no modifica ni borra datos existentes.
--
-- NOTA: el bucket "adjuntos" (privado, límite 20 MB por archivo) ya fue
-- creado vía API. Si no existiera, créalo en Storage > New bucket:
-- nombre "adjuntos", NO público, file size limit 20 MB.
-- ============================================================

-- Adjuntos de tareas propias. El archivo vive en Storage (bucket "adjuntos");
-- aquí solo guardamos la referencia y sus datos para mostrarlo.
create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.custom_tasks (id) on delete cascade,
  -- Ruta dentro del bucket: tareas/<task_id>/<archivo>
  storage_path text not null,
  file_name text not null,        -- Nombre original, para mostrar y descargar
  file_size bigint not null default 0,
  mime_type text not null default '',
  uploaded_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists task_attachments_task_id_idx
  on public.task_attachments (task_id);

alter table public.task_attachments enable row level security;

drop policy if exists "authenticated all task_attachments" on public.task_attachments;
create policy "authenticated all task_attachments" on public.task_attachments
  for all to authenticated using (true) with check (true);

-- ---------- Permisos sobre los archivos del bucket ----------
-- Cualquier usuario con sesión puede subir, ver, reemplazar y borrar
-- archivos del bucket "adjuntos" (mismo criterio que el resto del CRM).
-- Los archivos NO son públicos: se sirven con URLs firmadas temporales.

drop policy if exists "adjuntos leer autenticados" on storage.objects;
create policy "adjuntos leer autenticados" on storage.objects
  for select to authenticated using (bucket_id = 'adjuntos');

drop policy if exists "adjuntos subir autenticados" on storage.objects;
create policy "adjuntos subir autenticados" on storage.objects
  for insert to authenticated with check (bucket_id = 'adjuntos');

drop policy if exists "adjuntos actualizar autenticados" on storage.objects;
create policy "adjuntos actualizar autenticados" on storage.objects
  for update to authenticated using (bucket_id = 'adjuntos');

drop policy if exists "adjuntos borrar autenticados" on storage.objects;
create policy "adjuntos borrar autenticados" on storage.objects
  for delete to authenticated using (bucket_id = 'adjuntos');
