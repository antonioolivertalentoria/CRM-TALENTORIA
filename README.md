# CRM Talentoría — Gestión de Capacitaciones

CRM tipo Monday para gestionar el proceso completo de capacitaciones de Talentoría:
**Cliente → Capacitación (proyecto) → Sesiones**, con materiales de Google Drive siempre a la mano,
checklist de entregas post-capacitación (48h) y seguimiento a 20/30 días, según el
*Proceso de Logística de Capacitaciones* y la *Matriz Capacitaciones Talentoría 2026*.

**Stack:** Next.js 16 + Supabase (base de datos + login) + Tailwind, listo para GitHub + Vercel.

---

## Puesta en marcha (una sola vez, ~20 minutos)

### 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea una cuenta (puede ser con el Google de talentoria.herramientas@gmail.com).
2. **New project** → nombre `talentoria-crm`, región `Central US` (la más cercana a México), y una contraseña de base de datos (guárdala).
3. Cuando el proyecto esté listo, ve a **SQL Editor → New query**, pega TODO el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Esto crea las tablas (clientes, capacitaciones, sesiones, materiales) con seguridad activada (RLS: solo usuarios autenticados pueden ver o editar). El CRM arranca vacío: los clientes y capacitaciones se dan de alta desde la app.
4. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public` key
   - `service_role` key (solo para el paso 3; es secreta)

### 2. Configurar el proyecto local

```bash
cd talentoria-crm
copy .env.example .env.local
```

Edita `.env.local` con los tres valores de Supabase. (El archivo está en `.gitignore`: nunca se sube a git.)

### 3. Crear los usuarios de Arianna y Oliver

```bash
node scripts/seed-users.mjs
```

Crea `ariannaevora@talentoria.com` y `antoniooliver@talentoria.com` con contraseñas
temporales que se imprimen en consola. Compártelas de forma segura y cámbienlas al entrar
(en Supabase: Authentication → Users → Reset password).

### 4. Probar en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000 e inicia sesión.

### 5. Subir a GitHub y desplegar en Vercel

1. Crea un repositorio **privado** en [github.com/new](https://github.com/new) llamado `talentoria-crm` (sin README).
2. Desde la carpeta `talentoria-crm`:
   ```bash
   git remote add origin https://github.com/TU-USUARIO/talentoria-crm.git
   git push -u origin main
   ```
3. En [vercel.com](https://vercel.com) inicia sesión con GitHub → **Add New Project** → importa `talentoria-crm`.
4. En **Environment Variables** agrega solo estas dos (NO la service role):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. **Deploy**. Vercel te da la URL (p. ej. `talentoria-crm.vercel.app`). Cada `git push` redespliega automáticamente.

---

## Cómo se usa

1. **Clientes** → *Dar de alta cliente*: compañía, contacto, correo, WhatsApp.
2. Dentro del cliente → *Nueva capacitación*: al indicar el total de sesiones, se crean numeradas automáticamente.
3. En la capacitación vive todo el proyecto:
   - **Links rápidos**: carpeta de Drive, temario, lista de participantes, grupo de WhatsApp.
   - **Materiales**: PPTs, manuales, encuestas… cada uno con su link de Google Drive y estado (Pendiente / En proceso / Listo).
   - **Sesiones**: fecha, horario, facilitador/a, modalidad, plataforma, liga, inscritos/asistentes, encuesta. Todo editable en línea (clic en la celda).
   - **Entregas y seguimiento**: checklist del proceso (manual, constancias, insignias, DC-3, leads, encuesta de cliente, factura, seguimiento día 20 y 30).
4. **Tablero**: todas las capacitaciones agrupadas por estado, con próximas sesiones al frente.
5. **Calendario**: agenda de sesiones por fecha.

## Estructura

```
supabase/schema.sql      ← esquema de base de datos (correr en Supabase)
scripts/seed-users.mjs   ← crea los usuarios iniciales
src/app/login            ← inicio de sesión
src/app/(app)/           ← tablero, clientes, capacitaciones, calendario
src/lib/actions.ts       ← operaciones sobre la base de datos (server actions)
src/lib/constants.ts     ← estados, colores y checklist del proceso
```
