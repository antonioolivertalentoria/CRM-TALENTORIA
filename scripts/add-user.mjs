/**
 * Da de alta un usuario del CRM en Supabase Auth (el perfil se crea solo
 * por el trigger handle_new_user).
 *
 * Uso:
 *   node scripts/add-user.mjs correo@talentoria.com "Nombre Completo"
 *   node scripts/add-user.mjs correo@talentoria.com "Nombre Completo" --invitado --copiar
 *
 * --invitado  Usuario invitado (migración 022): solo ve Marketing y sus
 *             tareas, y nace con los recordatorios por correo apagados (su
 *             correo puede no existir todavía). Para volverlo parte del
 *             equipo basta quitarle app_metadata.role en Supabase Auth.
 * --copiar    NO imprime la contraseña: la deja en el portapapeles de
 *             Windows (así no queda en la terminal ni en ningún log).
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.
 * Comparte la contraseña temporal de forma segura y pide cambiarla al entrar.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import crypto from "node:crypto";

// Carga .env.local sin dependencias extra
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const guest = args.includes("--invitado");
const toClipboard = args.includes("--copiar");
const [email, fullName] = args.filter((a) => !a.startsWith("--"));
if (!email || !fullName) {
  console.error('Uso: node scripts/add-user.mjs correo@talentoria.com "Nombre Completo" [--invitado] [--copiar]');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const password = crypto.randomBytes(9).toString("base64url");

// Con --copiar, primero se prueba el portapapeles: si falla, no se crea nada
if (toClipboard) {
  try {
    execSync("clip", { input: password });
  } catch {
    console.error("✗ No se pudo usar el portapapeles (clip.exe). No se creó el usuario.");
    process.exit(1);
  }
}

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
  ...(guest ? { app_metadata: { role: "invitado" } } : {}),
});

if (error || !data.user) {
  console.error(`✗ ${email}: ${error?.message ?? "no se pudo crear"}`);
  process.exit(1);
}

if (guest) {
  // Su correo puede no existir aún: sin recordatorios hasta que tenga uno real
  const { error: prefsError } = await admin
    .from("profiles")
    .update({
      reminder_prefs: {
        enabled: false,
        kinds: ["Personal", "Marketing"],
      },
    })
    .eq("id", data.user.id);
  if (prefsError) console.error(`⚠️ No se pudieron apagar sus recordatorios: ${prefsError.message}`);
}

console.log(
  `✓ ${email} (${fullName})${guest ? " — usuario INVITADO (solo Marketing y sus tareas)" : ""} creado — ` +
    (toClipboard ? "contraseña temporal copiada al portapapeles (no se muestra)." : `contraseña temporal: ${password}`)
);
console.log("Compártela de forma segura y pide cambiarla al entrar.");
