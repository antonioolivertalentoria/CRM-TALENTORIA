import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { NavLinks } from "@/components/NavLinks";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName = user?.email ?? "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (profile?.full_name) displayName = profile.full_name;
  }

  return (
    <div className="flex min-h-screen">
      {/* Barra lateral */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-brand-navy text-white">
        <div className="border-b border-white/10 p-4">
          <Link href="/">
            <span className="block rounded-lg bg-white p-2.5">
              <Image
                src="/logo-talentoria.png"
                alt="Talentoría"
                width={200}
                height={45}
                priority
              />
            </span>
          </Link>
        </div>

        <NavLinks />

        <div className="mt-auto border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="truncate text-xs text-white/50">{user?.email}</p>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
            >
              Cerrar sesión
            </button>
          </form>
        </div>

        <div className="h-1.5 bg-gradient-to-r from-brand-cyan via-brand-sky to-brand-magenta" />
      </aside>

      {/* Contenido */}
      <main className="ml-60 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
