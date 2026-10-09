import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

/**
 * Cambiar la contraseña con la sesión abierta: para quien entró con una
 * temporal o con el enlace de "¿Olvidaste tu contraseña?".
 */
export default function ChangePasswordPage() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-brand-navy">Cambiar contraseña</h1>
        <p className="text-sm text-slate-500">
          Elige una que solo tú sepas. A partir de ahora entras con ella.
        </p>
      </header>
      <ChangePasswordForm />
    </div>
  );
}
