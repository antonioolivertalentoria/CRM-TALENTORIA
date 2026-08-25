# CRM Talentoría — Documentación técnica

> Versión: agosto 2026 · Producción: https://crm-talentoria.vercel.app
> Pensada para entender el sistema y evaluar su integración con otras aplicaciones de Talentoría.

---

## 1. ¿Qué es?

CRM interno (estilo Monday) para gestionar el proceso completo de capacitaciones:

**Cliente → Capacitación (el "proyecto") → Sesiones**, con materiales, checklist de entregas
post-capacitación, tareas automáticas derivadas del proceso, tareas propias capturadas a mano,
recordatorios diarios por correo y un reporte semanal en PDF para dirección.

Usuarios actuales: el equipo Talentoría (Arianna, Oliver, Eduardo). No es multi-tenant:
todos los usuarios autenticados ven y editan todo.

## 2. Stack

| Capa | Tecnología |
|---|---|
| Frontend + backend | **Next.js 16** (App Router, React Server Components + Server Actions) |
| Base de datos y login | **Supabase** (Postgres + Auth, con Row Level Security) |
| Archivos adjuntos | **Supabase Storage** (bucket privado `adjuntos`, URLs firmadas) |
| Estilos | Tailwind CSS v4 (colores de marca: cyan `#00AEEF`, magenta `#E6007E`, navy `#16345F`) |
| PDF | `pdf-lib` (generación del reporte semanal en el servidor) |
| Correo | Resend (recordatorios diarios; dominio verificado: `talentoriacursos.com`) |
| Hosting | Vercel (deploy automático con cada push a `main` del repo GitHub) |

Repos y servicios:
- GitHub: `antonioolivertalentoria/CRM-TALENTORIA` (el código vive en `talentoria-crm/`)
- Supabase: proyecto `djvyfgapaehafauoemvl`
- Vercel: proyecto `crm-talentoria`

## 3. Estructura del código

```
talentoria-crm/
├── src/
│   ├── app/
│   │   ├── (app)/                  # Rutas protegidas (requieren sesión)
│   │   │   ├── page.tsx            # Tablero: capacitaciones por estado + próximas sesiones
│   │   │   ├── clientes/           # Lista (con jerarquía) y detalle de clientes
│   │   │   ├── capacitaciones/[id] # Detalle: sesiones, materiales, checklist, notas
│   │   │   ├── tareas/             # Mis tareas (automáticas + propias) + recordatorios
│   │   │   └── calendario/         # Vista de calendario de sesiones
│   │   ├── api/
│   │   │   ├── recordatorios/      # GET: cron diario que envía correos (Resend)
│   │   │   └── reporte-semanal/    # GET: PDF con las tareas de los próximos 5 días hábiles
│   │   └── login/                  # Login con correo/contraseña (Supabase Auth)
│   ├── components/                 # Componentes cliente (formularios, tablas, chips…)
│   ├── lib/
│   │   ├── actions.ts              # TODAS las escrituras (Server Actions)
│   │   ├── tasks.ts                # Motor de tareas: deriva tareas de las capacitaciones
│   │   ├── constants.ts            # Catálogos (estados, checklist, colores)
│   │   ├── format.ts               # Fechas (ISO, días hábiles, formato es-MX)
│   │   ├── types.ts                # Tipos TypeScript de todas las tablas
│   │   ├── supabase/               # Clientes de Supabase (server con cookies / browser)
│   │   └── demo/                   # Modo demo en memoria (si no hay env de Supabase)
│   └── proxy.ts                    # Protección de rutas (refresca sesión, redirige a /login)
├── supabase/
│   ├── schema.sql                  # Esquema completo inicial
│   └── migration-00X-*.sql         # Migraciones incrementales (se corren en el SQL Editor)
└── scripts/seed-users.mjs          # Alta inicial de usuarios
```

Patrón general: las páginas son **Server Components** que consultan Supabase directamente y
las escrituras pasan por **Server Actions** (`src/lib/actions.ts`) con `revalidatePath` para
refrescar. No hay API REST propia para los datos (solo los 2 endpoints de `api/`).

## 4. Modelo de datos (Postgres / Supabase)

```
clients ──< trainings ──< sessions
   │            └──────< materials ──< material_comments
   └──< clients (subclientes, via parent_id)
custom_tasks ──< task_attachments   (archivos en Supabase Storage)
   │        └──< subtasks             (partes de una tarea, con medidor de avance)
   └── clients (opcional)
profiles (1 por usuario de auth)
facilitators  (catálogo de facilitadores)
time_entries  (tiempo invertido por tarea; task_key referencia lógica)
activity_log  (quién hizo qué; se limpia a 90 días desde el cron)
```

| Tabla | Qué guarda | Campos clave |
|---|---|---|
| `clients` | Empresas cliente | `company`, contacto, RFC/razón social, **`parent_id`** (si es subcliente de un cliente "paraguas" que nos subcontrata, ej. Coparmex → empresa final; `null` = cliente directo o venta al público en general) |
| `trainings` | La capacitación **o el team building** = el proyecto (columna **`kind`**; los team buildings no llevan checklist/materiales/logística) | `client_id`, nombres, `status` (Propuesta/Confirmada/En curso/Finalizada/Cancelada), responsable interno, links (Drive, temario, WhatsApp), y ~17 columnas de **checklist** (`Pendiente`/`Listo`/`No aplica`): mensaje de logística, contenido al facilitador, lista de participantes, envío de manual/constancias/insignias/DC-3, encuesta de participantes, **informe de encuesta**, factura, seguimientos día 20/30, etc. |
| `sessions` | Sesiones de cada capacitación | `training_id`, número, fecha, horario (inicio/cierre, duración calculada), **facilitador propio por sesión**, modalidad (Online/Presencial/Híbrida), plataforma, liga, inscritos/asistentes |
| `materials` | Materiales del proyecto (links a Drive) | tipo (PPT, manuales…), quién lo hace (`maker`), quién lo revisa (`reviewer`), estado (Pendiente → En proceso → Por revisar → Listo), fecha límite |
| `material_comments` | Comentarios de revisión | autor, texto |
| `custom_tasks` | Tareas capturadas a mano | título, detalles, para quién (`assignee`), quién la pidió (`requested_by`), `client_id` opcional (`null` = "marca blanca / interno"), fecha límite, estado (Pendiente/Completada), **`notify_on_complete`** (correo a quien la pidió al completarse) |
| `task_attachments` | Archivos adjuntos de una tarea propia | `task_id`, `storage_path` (ruta en el bucket), nombre original, tamaño, tipo, quién lo subió, **`category`** (`insumo` = material para trabajar, `entregable` = resultado que se entrega) |
| `subtasks` | Partes de una tarea propia | `task_id`, título, fecha opcional, `done`, `position`; alimentan el medidor de avance ("2 de 5") |
| `facilitators` | Catálogo de facilitadores | nombre, `is_internal` (interno = contenido a 7 días; externo = 14), `active` y **`email`** (para invitarle a los eventos de calendario); se administra en `/facilitadores` |
| `time_entries` | Tiempo invertido por tarea | `task_key` (clave lógica de la tarea, derivada o personal), título, persona, minutos; sobrevive aunque la tarea se complete o borre, para sumar tiempos |
| `activity_log` | Registro de actividad | actor, acción, entidad y resumen legible; el cron diario borra lo de más de 90 días |
| `training_requests` | Peticiones de un team building (gafetes, tarjetas…) | `training_id`, título, responsable, fecha, `done`; las pendientes salen en "Mis tareas" como tipo "Petición" |
| `training_attachments` | Archivos de un team building | igual que `task_attachments` pero colgado de `trainings`; bucket "adjuntos", ruta `teambuildings/<id>/` |
| `profiles` | Perfil por usuario de auth | nombre, correo, `reminder_prefs` (JSON: recordatorios on/off y tipos de tarea) |

Seguridad: **RLS activado en todas las tablas** con política simple: cualquier usuario
autenticado puede leer y escribir todo (`to authenticated using (true)`). No hay roles.

### Archivos adjuntos (Supabase Storage)

Bucket **privado** `adjuntos`, con tope de **20 MB por archivo**; los archivos viven en
`tareas/<task_id>/<uuid>-<nombre>`. Detalles importantes del diseño:

- La subida va **directa del navegador a Storage** (con la sesión del usuario, así que aplica
  RLS). No pasa por el servidor porque las Server Actions de Next.js tienen un límite de 1 MB
  de payload. La Server Action solo registra los metadatos en `task_attachments`.
- La descarga usa **URLs firmadas temporales** (1 hora) generadas al momento del clic: sin
  firma, el archivo devuelve error. Nada es público.
- Al borrar una tarea o un adjunto, el archivo también se borra del bucket (la cascada de la
  base solo elimina la fila, no el objeto en Storage).
- El plan gratuito de Supabase da **1 GB** de almacenamiento total. Para material pesado
  (videos, PPTs grandes) se sigue usando Google Drive con link.

Las migraciones (`supabase/migration-001…005.sql`) se corren a mano en el SQL Editor del
dashboard de Supabase; todas son aditivas.

## 5. Motor de tareas (lo más "de negocio" del sistema)

`src/lib/tasks.ts` **no guarda tareas**: las deriva en cada carga a partir del estado de
capacitaciones, sesiones y materiales, según el Proceso de Logística de Capacitaciones.
Completar una tarea actualiza el campo correspondiente (y viceversa). Reglas de fechas:

- Mensaje de logística (WhatsApp): 20 días antes de la 1ª sesión, o de inmediato.
- Contenido/PPT al facilitador: 14 días antes si es externo, 7 si es interno; si no alcanza, mañana.
- Lista de participantes e impresión de manuales (presencial): 7 días antes.
- Encuestas QR y liga de sesión (online): 3 días antes.
- Entregas post-curso (manual, constancias, insignias, DC-3, encuesta, informe de encuesta,
  leads): 2 días **hábiles** después de la última sesión. Factura: el mismo día.
- Seguimientos: día 20 y día 30 naturales.

Las tareas de `custom_tasks` (tipo "Personal") se mezclan en la misma lista, en los
recordatorios por correo y en el reporte semanal.

### Invitaciones de Google Calendar (src/lib/calendar.ts)

Al crear una capacitación o team building con sesiones fechadas, cada sesión
manda por Resend una invitación de calendario estándar (.ics, METHOD:REQUEST,
zona America/Mexico_City): Gmail/Google Calendar la agrega al calendario del
invitado con todos los datos. Mover fecha/horario/facilitador manda la
actualización (mismo UID, SEQUENCE creciente) y cancelar o borrar la sesión
(o el proyecto) manda la cancelación (METHOD:CANCEL). Invitados: el equipo
base (ALWAYS_INVITED en calendar.ts: Antonio y Arianna), quien creó el
proyecto, el responsable interno y el/la facilitador(a) de la sesión —
correos resueltos vía profiles, facilitators.email y el mapa EXTRA_EMAILS
(Carolina, Adrián Hernández). Todo es best-effort: sin RESEND_API_KEY o ante
cualquier error, la acción original no se afecta.

## 6. Endpoints y procesos automáticos

| Endpoint | Método | Auth | Qué hace |
|---|---|---|---|
| `/api/recordatorios` | GET | Header `Bearer CRON_SECRET` | Cron de Vercel (8:00 am Chihuahua). Un correo por persona con sus tareas vencidas/del día, según sus preferencias. Usa la **service role key** (salta RLS). |
| `/api/reporte-semanal` | GET | Cookie de sesión | Genera el PDF de tareas de los próximos 5 días hábiles (incluye el día actual) + vencidas + sin fecha. Botón en /tareas. |

## 7. Variables de entorno

| Variable | Dónde | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Local + Vercel | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Local + Vercel | Llave pública (el acceso real lo controla RLS + auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (+ local solo para scripts) | Solo la usa el cron de recordatorios y `scripts/seed-users.mjs`. **Secreta.** |
| `RESEND_API_KEY` | Vercel | Envío de correos (llave de solo envío) |
| `CRON_SECRET` | Vercel | Protege `/api/recordatorios` |

Sin las env de Supabase, la app arranca en **modo demo** (datos de ejemplo en memoria).

## 8. Autenticación

- Supabase Auth con correo/contraseña (sin registro público: los usuarios se crean con
  `scripts/seed-users.mjs` o desde el dashboard de Supabase).
- Al crearse un usuario en `auth.users`, un trigger crea su fila en `profiles`.
- `src/proxy.ts` protege todas las rutas de `(app)` y refresca la sesión (cookies via `@supabase/ssr`).

## 9. Ideas para la integración con otra aplicación

Opciones ordenadas de menor a mayor esfuerzo:

1. **Compartir el mismo proyecto de Supabase (recomendado como primer paso).**
   La otra app puede usar la misma base y el mismo Auth: un solo login para todo Talentoría.
   Las tablas del CRM ya están en el esquema `public`; la otra app puede usar sus propias
   tablas en el mismo esquema (o uno aparte, ej. `otra_app.*`) sin tocarse entre sí.
   Con esto, "unir" las apps es en gran parte compartir sesión y datos.

2. **Unificación visual ligera:** mantener dos deployments y enlazarlos con un menú común
   (links cruzados). Cero riesgo, cero refactor; se siente como una sola app si comparten
   login (opción 1) y estilos (mismos colores de marca).

3. **Monorepo / una sola app Next.js:** montar el CRM bajo una ruta (ej. `/capacitaciones`)
   y la otra app bajo otra. El CRM ya está encapsulado: sus páginas viven en `src/app/(app)`
   y toda su lógica en `src/lib`; moverlo a un subárbol de rutas es mecánico. Requisitos:
   que la otra app sea Next.js (App Router) o se migre, y unificar el layout/navegación.

4. **Exponer una API:** si la otra app está en otro stack y necesita datos del CRM, lo más
   simple es que consulte Supabase directamente (con la anon key + RLS, o vistas propias);
   el CRM no necesita cambios porque no tiene estado fuera de la base.

Puntos a decidir con el compañero: stack de su app, si comparte Supabase (auth y datos),
quién es "dueño" del layout/navegación, y dominio final (ej. `app.talentoria.com` con rutas
por módulo).

## 10. Operación

- **Deploy:** push a `main` → Vercel construye y publica solo (~2 min).
- **Migraciones:** pegar el SQL de `supabase/migration-00X.sql` en el SQL Editor del
  dashboard y correrlo una vez. Siempre aditivas hasta ahora.
- **Respaldos:** los datos se pueden exportar por REST (hay respaldos JSON locales en
  `backups/`, fuera de git). Supabase también hace backups diarios automáticos (plan free: 7 días).
- **Correr en local:** `npm install && npm run dev` con `.env.local` (ver `.env.example`).
