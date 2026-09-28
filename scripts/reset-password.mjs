/**
 * Le pone una contraseña temporal nueva a un usuario que ya existe en el CRM
 * (p. ej. si nunca recibió la suya o la perdió). Supabase no guarda las
 * contraseñas en claro, así que la única forma de "recuperarla" es poner otra.
 *
 * Uso:
 *   node scripts/reset-password.mjs correo@talentoria.com
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.
 * Imprime la contraseña temporal: compártela de forma segura y pide
 * cambiarla al entrar.
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

const [email] = process.argv.slice(2);
if (!email) {
  console.error("Uso: node scripts/reset-password.mjs correo@talentoria.com");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 });
if (listError) {
  console.error(`✗ No se pudo leer la lista de usuarios: ${listError.message}`);
  process.exit(1);
}
const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`✗ ${email} no existe en el CRM. Para darlo de alta usa scripts/add-user.mjs`);
  process.exit(1);
}

const password = crypto.randomBytes(9).toString("base64url");
const { error } = await admin.auth.admin.updateUserById(user.id, { password });
if (error) {
  console.error(`✗ ${email}: ${error.message}`);
  process.exit(1);
}
console.log(`✓ ${email} — contraseña temporal nueva: ${password}`);
console.log("La anterior ya no sirve. Compártela de forma segura y pide cambiarla al entrar.");
