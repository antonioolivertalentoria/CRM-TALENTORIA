-- ============================================================
-- CRM Talentoría — Datos iniciales desde la
-- "Matriz Capacitaciones Talentoría 2026" (corte 13-jul-2026)
-- Ejecutar DESPUÉS de schema.sql, en Supabase > SQL Editor.
-- Se puede correr una sola vez (si se corre dos veces, duplica).
-- ============================================================

do $$
declare
  c_id uuid;
  t_id uuid;
begin

-- ---------- SIGMA ----------
insert into clients (company) values ('SIGMA') returning id into c_id;

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner)
values (c_id, 'Comunicación y Feedback', 'Comunicación y Feedback', 'Finalizada', 5, 'Oliver')
returning id into t_id;
insert into sessions (training_id, session_number, module, status, session_date, start_time, end_time, facilitator, modality, platform)
values (t_id, 4, 'Módulo 4', 'Impartida', '2026-05-29', '12:00', '16:00', 'Rocío', 'Online', 'Zoom');

-- ---------- SIGMA MTY ----------
insert into clients (company, contact_name) values ('SIGMA MTY', 'Juan de la Rosa') returning id into c_id;

insert into trainings (client_id, short_name, official_name, status, total_sessions, client_contact,
  envio_manual, envio_constancias, envio_insignias, envio_leads, encuesta_final, notes)
values (c_id, 'Comunicación y Feedback', 'Comunicación y Feedback', 'Finalizada', 5, 'Juan de la Rosa',
  'Listo', 'Listo', 'Listo', 'Listo', 'Listo', 'Sesión de cierre: falta definir fecha. Facilita Carolina.')
returning id into t_id;
insert into sessions (training_id, session_number, module, status, facilitator, notes)
values (t_id, 5, 'Cierre', 'Pendiente', 'Carolina', 'Falta fecha');

-- ---------- Sigma CUU ----------
insert into clients (company, contact_name, email)
values ('Sigma CUU', 'Humberto González', 'hgonzalez@sigma-alimentos.com') returning id into c_id;

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner,
  client_contact, client_email,
  envio_manual, envio_constancias, notes)
values (c_id, 'Accountability', 'Cultura colaborativa y Accountability', 'Finalizada', 2, 'Oliver',
  'Humberto González', 'hgonzalez@sigma-alimentos.com',
  'Listo', 'Listo',
  'Poner al inicio el nombre del programa de Sigma. La constancia debe indicar 8 horas (Cultura colaborativa y Accountability). Se debe dar DC-3: pedir a Humberto la lista actualizada por todos los módulos. Serían dos de ocho horas.')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, duration_hours, facilitator, modality) values
 (t_id, 1, 'Impartida', '2026-06-26', '13:00', '17:00', 4.0, 'Arianna', 'Presencial'),
 (t_id, 2, 'Impartida', '2026-07-03', '13:00', '17:00', 4.0, '', 'Presencial');

-- ---------- Miguel Rosas ----------
insert into clients (company) values ('Miguel Rosas') returning id into c_id;

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner)
values (c_id, 'Gestión del talento con IA', 'Gestión del talento con Inteligencia Artificial', 'Confirmada', 2, 'Oliver')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time) values
 (t_id, 1, 'Impartida', '2026-06-02', '10:00', '13:00'),
 (t_id, 2, 'Impartida', '2026-06-03', '10:00', '13:00');

-- ---------- Coparmex-Ecogas ----------
insert into clients (company) values ('Coparmex-Ecogas') returning id into c_id;

insert into trainings (client_id, short_name, official_name, status, internal_owner,
  envio_manual, envio_constancias, envio_insignias, envio_leads, encuesta_final,
  seguimiento_20, seguimiento_30, questions)
values (c_id, 'Employee Journey Map', 'Employee Journey Map', 'En curso', 'Oliver',
  'Listo', 'Listo', 'Listo', 'Listo', 'Listo',
  'No aplica', 'No aplica',
  '¿Cuántas sesiones totales? ¿Fechas de las anteriores? ¿Horario de cierre? ¿Facilitador? ¿Modalidad/plataforma?')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, facilitator) values
 (t_id, 1, 'Impartida', '2026-06-09', '09:00', '12:00', 'Arianna'),
 (t_id, 2, 'Impartida', '2026-06-10', '09:00', '12:00', 'Arianna'),
 (t_id, 3, 'Impartida', '2026-06-11', '09:00', '13:00', 'Caro');

-- ---------- INDEX Matamoros ----------
insert into clients (company) values ('INDEX Matamoros') returning id into c_id;

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner,
  envio_manual, envio_constancias, envio_insignias, encuesta_final, seguimiento_20, seguimiento_30, notes)
values (c_id, 'Social Recruiting 5.0', 'Social Recruiting 5.0', 'Confirmada', 2, 'Oliver',
  'Listo', 'No aplica', 'No aplica', 'Listo', 'No aplica', 'No aplica',
  'Agregar 3 horas. Traer el taller de head hunter, primera parte hasta bot Alfred. Confirmar una semana antes.')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, facilitator, modality) values
 (t_id, 1, 'Impartida', '2026-06-23', '09:00', '13:00', 'Arianna', 'Online'),
 (t_id, 2, 'Impartida', '2026-06-25', '09:00', '13:00', 'Arianna', 'Online');

insert into trainings (client_id, short_name, official_name, status, internal_owner)
values (c_id, 'Entrevista por competencias', 'Entrevista por competencias', 'Propuesta', 'Oliver')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, facilitator)
values (t_id, 1, 'Programada', '2026-07-16', 'Arianna');

insert into trainings (client_id, short_name, official_name, status, internal_owner, questions)
values (c_id, 'HRBP', 'HRBP', 'Confirmada', 'Oliver',
  '¿Cuántas sesiones totales? ¿Hora de cierre? ¿Facilitador? ¿Modalidad?')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time)
values (t_id, 1, 'Programada', '2026-10-20', '09:00');

-- ---------- Prourvika ----------
insert into clients (company) values ('Prourvika') returning id into c_id;

insert into trainings (client_id, short_name, status, total_sessions, notes)
values (c_id, 'El impacto de nuestras conductas en el ambiente laboral', 'Confirmada', 1,
  'La PPT debía estar lista el 18 de junio.')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, duration_hours, facilitator, modality)
values (t_id, 1, 'Impartida', '2026-06-24', '10:00', '13:00', 3.0, 'Caro', 'Presencial');

-- ---------- Commscope ----------
insert into clients (company, contact_name) values ('Commscope', 'Aurora Juárez') returning id into c_id;

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner,
  envio_manual, envio_constancias, envio_insignias, envio_dc3, envio_leads, encuesta_final,
  seguimiento_20, seguimiento_30, questions)
values (c_id, 'Liderazgo', 'Liderazgo', 'Confirmada', 2, 'Oliver',
  'Listo', 'Listo', 'Listo', 'Listo', 'Listo', 'Listo',
  'No aplica', 'No aplica',
  '¿Hora de cierre? ¿Facilitador? ¿Modalidad? Contacto detectado en calendario: Aurora Juárez')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, facilitator) values
 (t_id, 1, 'Impartida', '2026-06-27', '08:00', '16:00', 'Arianna'),
 (t_id, 2, 'Programada', '2026-07-04', '08:00', '16:00', 'Arianna');

-- ---------- Centro de Competitividad ----------
insert into clients (company) values ('Centro de Competitividad') returning id into c_id;

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner,
  envio_manual, envio_constancias, envio_insignias, envio_leads, encuesta_final,
  seguimiento_20, seguimiento_30, notes)
values (c_id, 'NOM 035', 'NOM 035', 'Confirmada', 2, 'Oliver',
  'Listo', 'Listo', 'Listo', 'Listo', 'Listo', 'No aplica', 'No aplica',
  'Dar seguimiento. Hacer grupo o revisar que esté con Aurora. Caro es la facilitadora.')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, facilitator) values
 (t_id, 1, 'Impartida', '2026-06-29', '08:00', '12:00', 'Caro'),
 (t_id, 2, 'Impartida', '2026-06-30', '08:00', '12:00', 'Caro');

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner, notes)
values (c_id, 'Desarrollo Organizacional', 'Desarrollo Organizacional', 'Confirmada', 2, 'Oliver',
  'Oliver: desarrollar la PPT y manuales conforme al temario creado.')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, facilitator, modality) values
 (t_id, 1, 'Programada', '2026-07-29', '09:00', '13:00', 'Caro', 'Online'),
 (t_id, 2, 'Programada', '2026-07-30', '09:00', '13:00', 'Caro', 'Online');

-- ---------- Technology ----------
insert into clients (company, contact_name) values ('Technology', 'Caro Acopa') returning id into c_id;

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner, notes)
values (c_id, 'IA para RH', 'IA para RH', 'Confirmada', 2, 'Oliver',
  'Pedir temario a Caro Acopa; es un solo grupo.')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, duration_hours, facilitator, modality) values
 (t_id, 1, 'Impartida', '2026-07-01', '10:00', '14:30', 4.5, 'Oliver', 'Online'),
 (t_id, 2, 'Impartida', '2026-07-02', '10:00', '14:30', 4.5, 'Oliver', 'Online');

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner, notes, questions)
values (c_id, 'BEI', 'Entrevista por competencias BEI', 'Confirmada', 3, 'Oliver',
  'Pedir a Caro Acopa el temario y verificar las PPTs con él. Preguntas a Ari antes.',
  '¿Hora de cierre? ¿Facilitador? ¿Modalidad?')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, facilitator) values
 (t_id, 1, 'Programada', '2026-07-08', '10:00', 'Caro'),
 (t_id, 2, 'Programada', '2026-07-09', '10:00', 'Arianna'),
 (t_id, 3, 'Programada', '2026-07-10', '10:00', 'Arianna');

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner, notes, questions)
values (c_id, 'Assessment Center', 'Assessment Center', 'Confirmada', 3, 'Oliver',
  'Pedir a Caro Acopa el temario y verificar las PPTs con él.',
  '¿Hora de cierre? ¿Confirmar que son 3 sesiones totales?')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, facilitator, modality) values
 (t_id, 1, 'Programada', '2026-07-28', '10:00', '14:00', 'Arianna', 'Online'),
 (t_id, 2, 'Programada', '2026-07-29', '10:00', '14:00', 'Arianna', 'Online'),
 (t_id, 3, 'Programada', '2026-07-30', '10:00', '14:00', 'Arianna', 'Online');

-- ---------- Suminsa ----------
insert into clients (company) values ('Suminsa') returning id into c_id;

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner, notes)
values (c_id, 'Comunicación efectiva', 'Entrenamiento Consultor', 'En curso', 5, 'Oliver',
  'Para el área de ingeniería. Sesión 3: 13 de agosto (mismo horario), sesión 4: 8 de octubre, sesión 5: primera semana de diciembre (presencial, 4 horas). No se envían constancias hasta el final, por el total de 12 horas. Preguntar a Ari los nombres de las siguientes sesiones.')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, facilitator, modality) values
 (t_id, 2, 'Impartida', '2026-07-02', '10:00', '12:00', 'Arianna', 'Online'),
 (t_id, 3, 'Programada', '2026-08-13', '10:00', '12:00', 'Arianna', 'Online'),
 (t_id, 4, 'Programada', '2026-10-08', '10:00', '12:00', 'Arianna', 'Online'),
 (t_id, 5, 'Pendiente', null, null, null, 'Arianna', 'Presencial');

-- ---------- Coparmex Chihuahua ----------
insert into clients (company) values ('Coparmex Chihuahua') returning id into c_id;

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner, materials_deadline, notes)
values (c_id, 'Servicio al cliente Disney', 'Servicio al cliente Disney', 'Confirmada', 2, 'Oliver', '2026-06-17',
  'Oliver: confirmar una semana antes si se tienen personas inscritas.')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, facilitator, modality) values
 (t_id, 1, 'Programada', '2026-07-07', '09:00', '13:00', 'Carolina', 'Presencial'),
 (t_id, 2, 'Programada', '2026-07-14', '09:00', '13:00', 'Arianna', 'Presencial');

-- ---------- Coparmex Cuauhtémoc ----------
insert into clients (company, contact_name) values ('Coparmex Cuauhtémoc', 'Perla') returning id into c_id;

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner, notes)
values (c_id, 'Objetivos y feedback', 'Objetivos y feedback', 'Cancelada', 1, 'Oliver',
  'Validar el contacto del cliente con Perla para crear el grupo y confirmar horario. El taller ya se dio para la sesión 3 de Total Gas.')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, duration_hours, facilitator, modality)
values (t_id, 1, 'Cancelada', '2026-07-14', '09:00', '14:00', 5.0, 'Caro', 'Presencial');

-- ---------- Alsuper ----------
insert into clients (company) values ('Alsuper') returning id into c_id;

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner, notes)
values (c_id, 'Admin del tiempo', 'Administración del tiempo', 'Confirmada', 1, 'Oliver',
  'El curso existe pero puede estar desactualizado; asegurar que da para 4 horas. Pedir contacto a Perla para crear el grupo.')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, duration_hours, facilitator, modality)
values (t_id, 1, 'Pendiente', '2026-07-24', '09:00', '13:00', 4.0, 'Arianna', 'Presencial');

-- ---------- Ripipsa ----------
insert into clients (company) values ('Ripipsa') returning id into c_id;

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner)
values (c_id, 'Claude Básico', 'Claude Básico', 'Confirmada', 2, 'Oliver')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, duration_hours, facilitator, modality) values
 (t_id, 1, 'Programada', '2026-07-15', '15:00', '19:00', 4.0, 'Oliver', 'Online'),
 (t_id, 2, 'Programada', '2026-07-23', '15:00', '19:00', 4.0, 'Oliver', 'Online');

-- ---------- Proesmma ----------
insert into clients (company) values ('Proesmma') returning id into c_id;

insert into trainings (client_id, short_name, official_name, status, total_sessions, internal_owner)
values (c_id, 'Diplomado en Alta Dirección', 'Diplomado en Alta Dirección', 'Confirmada', 8, 'Oliver')
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, duration_hours, facilitator)
values (t_id, 1, 'Programada', '2026-07-29', '10:00', '14:00', 4.0, 'Arianna');

-- ---------- MINSA (tres plantas) ----------
insert into clients (company) values ('MINSA Tlanepantla') returning id into c_id;
insert into trainings (client_id, short_name, official_name, status, total_sessions)
values (c_id, 'Liderazgo y Feedback', 'Liderazgo y Feedback', 'Confirmada', 1)
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, duration_hours, facilitator, modality)
values (t_id, 1, 'Programada', '2026-07-21', '08:30', '13:30', 5.0, 'Caro', 'Presencial');

insert into clients (company) values ('MINSA Jaltitlán') returning id into c_id;
insert into trainings (client_id, short_name, official_name, status, total_sessions)
values (c_id, 'Liderazgo y Feedback', 'Liderazgo y Feedback', 'Confirmada', 1)
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, duration_hours, facilitator, modality)
values (t_id, 1, 'Impartida', '2026-07-08', '10:00', '15:00', 5.0, 'Caro', 'Presencial');

insert into clients (company) values ('MINSA Ramos Arizpe') returning id into c_id;
insert into trainings (client_id, short_name, official_name, status, total_sessions)
values (c_id, 'Liderazgo y Feedback', 'Liderazgo y Feedback', 'Confirmada', 2)
returning id into t_id;
insert into sessions (training_id, session_number, status, session_date, start_time, end_time, duration_hours, facilitator, modality) values
 (t_id, 1, 'Programada', '2026-07-14', '08:30', '13:30', 5.0, 'Caro', 'Presencial'),
 (t_id, 2, 'Programada', '2026-07-14', '15:00', '20:00', 5.0, 'Caro', 'Presencial');

end $$;
