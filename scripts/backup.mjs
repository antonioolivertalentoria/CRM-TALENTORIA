/**
 * Respaldo completo de los datos del CRM (solo lectura).
 *
 * Uso:
 *   node scripts/backup.mjs [etiqueta]
 *
 * Guarda una copia JSON de cada tabla en backups/<AAAAMMDD-HHMMSS>[-etiqueta]/
 * (la carpeta backups/ no se sube a git). Requiere NEXT_PUBLIC_SUPABASE_URL
 * y SUPABASE_SERVICE_ROLE_KEY en .env.local. No modifica nada en la base.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

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
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const TABLES = [
  "activity_log", "clients", "consulting_attachments", "consulting_changes",
  "consulting_inputs", "consulting_milestones", "consulting_projects",
  "consulting_sessions", "custom_tasks", "document_orders", "facilitators",
  "marketing_leads", "marketing_pages", "marketing_periods", "marketing_projects",
  "marketing_sends", "marketing_steps", "marketing_urls", "material_comments",
  "materials", "productivity_agreements", "profiles", "psychometric_people",
  "psychometric_requests", "recruitment_attachments", "recruitment_candidates",
  "recruitment_vacancies", "sessions", "subtasks", "task_attachments",
  "task_ledger", "task_progress", "task_progress_notes", "time_entries",
  "training_attachments", "training_requests", "trainings",
];

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const label = process.argv[2] ? `-${process.argv[2]}` : "";
const dir = `backups/${stamp}${label}`;
mkdirSync(dir, { recursive: true });

let total = 0;
const resumen = {};
for (const table of TABLES) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + 999);
    if (error) {
      console.warn(`  ${table}: ${error.message}`);
      break;
    }
    rows.push(...data);
    if (data.length < 1000) break;
  }
  writeFileSync(`${dir}/${table}.json`, JSON.stringify(rows, null, 2));
  resumen[table] = rows.length;
  total += rows.length;
}
writeFileSync(`${dir}/_resumen.json`, JSON.stringify({ fecha: now.toISOString(), total, tablas: resumen }, null, 2));
console.log(`Respaldo en ${dir}: ${total} renglones en ${TABLES.length} tablas`);
for (const [t, n] of Object.entries(resumen)) console.log(`  ${t}: ${n}`);
