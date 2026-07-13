/**
 * Crea los usuarios iniciales del CRM (Arianna y Oliver) en Supabase Auth.
 *
 * Uso:
 *   1. Copia .env.example a .env.local y llena:
 *      NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 *      (la service role key está en Supabase > Settings > API Keys — NUNCA la subas a git)
 *   2. node scripts/seed-users.mjs
 *
 * Cada usuario recibe una contraseña temporal que se imprime en consola.
 * Pídeles que la cambien desde su perfil o con "Reset password".
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

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const users = [
  { email: "ariannaevora@talentoria.com", full_name: "Arianna Évora" },
  { email: "antoniooliver@talentoria.com", full_name: "Antonio Oliver" },
];

for (const u of users) {
  const password = crypto.randomBytes(9).toString("base64url");
  const { error } = await admin.auth.admin.createUser({
    email: u.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: u.full_name },
  });
  if (error) {
    console.error(`✗ ${u.email}: ${error.message}`);
  } else {
    console.log(`✓ ${u.email} creado — contraseña temporal: ${password}`);
  }
}
console.log("\nListo. Comparte las contraseñas de forma segura y pide cambiarlas al entrar.");
