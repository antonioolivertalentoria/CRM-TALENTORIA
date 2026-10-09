import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino del enlace de "¿Olvidaste tu contraseña?": canjea el token de un
 * solo uso, deja la sesión abierta en las cookies y manda a crear la
 * contraseña nueva. Si el enlace ya se usó o venció, regresa a pedir otro.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/cambiar-contrasena";
  // Solo rutas internas: nada de redirigir a otro sitio
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/cambiar-contrasena";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL("/recuperar?vencido=1", url.origin));
}
