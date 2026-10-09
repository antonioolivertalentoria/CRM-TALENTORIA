"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string } | null;

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Escribe tu correo y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Correo o contraseña incorrectos." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// ---------------- ¿Olvidaste tu contraseña? ----------------

export type ResetState = { error: string } | { sent: true } | null;

/**
 * Manda por correo (Resend, desde crm@talentoriacursos.com) un enlace de un
 * solo uso para crear una contraseña nueva. No usa el correo de Supabase:
 * el que trae por defecto solo le llega a los miembros de la cuenta de
 * Supabase. El enlace pasa por /auth/confirm, que abre la sesión, y de ahí
 * a /cambiar-contrasena.
 *
 * Siempre responde lo mismo, exista o no el correo, para no revelar quién
 * tiene cuenta. Los usuarios invitados no tienen buzón: a ellos no se manda.
 */
export async function requestPasswordReset(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "Escribe tu correo." };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!serviceKey || !resendKey) {
    return { error: "El envío de correos no está configurado. Pídele a Oliver una contraseña temporal." };
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  // Correo inexistente o invitado: misma respuesta, sin correo de por medio
  if (error || !data?.properties?.hashed_token || data.user?.app_metadata?.role === "invitado") {
    return { sent: true };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "crm-talentoria.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const link = `${proto}://${host}/auth/confirm?token_hash=${encodeURIComponent(
    data.properties.hashed_token
  )}&type=recovery&next=/cambiar-contrasena`;

  const name = String(data.user?.user_metadata?.full_name ?? "").split(" ")[0];
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
      <div style="height:6px;background:linear-gradient(to right,#00aeef,#e6007e);border-radius:3px;"></div>
      <h2 style="color:#16345f;">Hola${name ? `, ${name}` : ""} 👋</h2>
      <p style="color:#334155;">Nos pidieron cambiar la contraseña de tu cuenta del CRM Talentoría. Dale clic al botón y elige una nueva; en un minuto estás de regreso.</p>
      <a href="${link}" style="display:inline-block;background:linear-gradient(to right,#00aeef,#e6007e);color:#fff;font-weight:bold;padding:10px 22px;border-radius:8px;text-decoration:none;margin-top:8px;">Crear mi nueva contraseña</a>
      <p style="color:#64748b;font-size:13px;margin-top:20px;">El enlace sirve una sola vez y durante una hora. Si no fuiste tú, ignora este correo: tu contraseña sigue igual. 🙌</p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.REMINDER_FROM ?? "CRM Talentoría <crm@talentoriacursos.com>",
      to: [email],
      subject: "🔑 Crea tu nueva contraseña del CRM Talentoría",
      html,
    }),
  });
  if (!res.ok) {
    return { error: "No se pudo mandar el correo. Intenta en un momento o pídele a Oliver una contraseña temporal." };
  }
  return { sent: true };
}

// ---------------- Cambiar contraseña (ya con sesión) ----------------

export type PasswordState = { error: string } | { saved: true } | null;

export async function changePassword(
  _prev: PasswordState,
  formData: FormData
): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Usa al menos 8 caracteres." };
  if (password !== confirm) return { error: "Las dos contraseñas no coinciden." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión se cerró. Pide otro enlace en “¿Olvidaste tu contraseña?”." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.message.toLowerCase().includes("different from the old")) {
      return { error: "Elige una contraseña distinta de la anterior." };
    }
    return { error: `No se pudo guardar: ${error.message}` };
  }
  return { saved: true };
}
