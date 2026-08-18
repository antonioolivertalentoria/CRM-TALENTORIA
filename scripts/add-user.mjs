/**
 * Da de alta un usuario del CRM en Supabase Auth (el perfil se crea solo
 * por el trigger handle_new_user).
 *
 * Uso:
 *   node scripts/add-user.mjs correo@talentoria.com "Nombre Completo"
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.
 * Imprime una contraseña temporal: compártela de forma segura y pide
 * cambiarla al entrar (o usar "Reset password").
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
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

const [email, fullName] = process.argv.slice(2);
if (!email || !fullName) {
  console.error('Uso: node scripts/add-user.mjs correo@talentoria.com "Nombre Completo"');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const password = crypto.randomBytes(9).toString("base64url");
const { error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});

if (error) {
  console.error(`✗ ${email}: ${error.message}`);
  process.exit(1);
}
console.log(`✓ ${email} (${fullName}) creado — contraseña temporal: ${password}`);
console.log("Compártela de forma segura y pide cambiarla al entrar.");
