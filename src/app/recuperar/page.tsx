import Image from "next/image";
import Link from "next/link";
import { ResetForm } from "./ResetForm";

export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { vencido } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-navy p-4">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-cyan via-brand-sky to-brand-magenta" />
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-cyan/15 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-brand-magenta/15 blur-3xl" />

      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-2 flex justify-center">
          <Image src="/logo-talentoria.png" alt="Talentoría — Aceleradora de Talento" width={280} height={63} priority />
        </div>
        <h1 className="mt-4 text-center text-xl font-bold text-brand-navy">¿Olvidaste tu contraseña?</h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          Escribe tu correo y te mandamos un enlace para crear una nueva.
        </p>

        {vencido && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Ese enlace ya se usó o venció (duran una hora). Pide otro aquí abajo.
          </p>
        )}

        <ResetForm />

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="font-medium text-brand-cyan-dark hover:underline">
            ← Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
