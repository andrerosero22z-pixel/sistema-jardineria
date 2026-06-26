
import LogoutButton from "@/components/LogoutButton";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: usuarioApp, error } = await supabase
    .from("usuario_app")
    .select("nombre, email, rol")
    .eq("auth_user_id", user.id)
    .single();

  if (error) {
    return (
      <main className="min-h-screen bg-red-50 p-8">
        <section className="rounded-2xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold text-red-700">
            Error cargando usuario
          </h1>

          <p className="mt-4 text-gray-700">
            Iniciaste sesión, pero no se pudo cargar tu usuario en el sistema.
          </p>

          <pre className="mt-4 rounded bg-gray-100 p-4 text-sm text-red-700">
            {error.message}
          </pre>
        </section>
      </main>
    );
  }

  return (
  <main className="min-h-screen bg-green-50 p-6">
    <section className="mx-auto max-w-6xl">
      <div className="rounded-2xl bg-white px-6 py-4 shadow">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-green-700">
              Sistema de jardinería familiar
            </p>

            <h1 className="text-2xl font-bold text-green-950">
              Panel principal
            </h1>
          </div>

          <div className="flex flex-col gap-3 text-sm text-gray-600 sm:flex-row sm:items-center">
            <div>
              <span className="font-semibold text-gray-800">
                {usuarioApp?.nombre}
              </span>{" "}
              · {usuarioApp?.rol === "admin" ? "Administrador" : "Familiar"}
            </div>

            <LogoutButton />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Link
          href="/trabajos/nuevo"
          className="action-card p-6 hover:opacity-95"
        >
          <h2 className="text-xl font-bold">+ Registrar trabajo</h2>
          <p className="mt-2 text-sm text-green-50">
            Registrar un servicio realizado, productos, pago y recordatorio.
          </p>
        </Link>
        

        <Link
          href="/clientes"
          className="rounded-2xl bg-white p-6 shadow hover:bg-green-50"
        >
          <h2 className="text-xl font-bold text-green-950">Clientes</h2>
          <p className="mt-2 text-sm text-gray-600">
            Registrar y buscar clientes por nombre.
          </p>
        </Link>

        <Link
          href="/pagos"
          className="rounded-2xl bg-white p-6 shadow hover:bg-green-50"
        >
          <h2 className="text-xl font-bold text-green-950">
            Pagos pendientes
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Ver clientes que aún deben pagar.
          </p>
        </Link>

        <Link
          href="/recordatorios"
          className="rounded-2xl bg-white p-6 shadow hover:bg-green-50"
        >
          <h2 className="text-xl font-bold text-green-950">
            Recordatorios
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Ver servicios que ya necesitan seguimiento.
          </p>
        </Link>

        <Link
          href="/productos"
          className="rounded-2xl bg-white p-6 shadow hover:bg-green-50"
        >
          <h2 className="text-xl font-bold text-green-950">
            Productos y stock
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Ver abono, productos y existencias.
          </p>
        </Link>

        <Link
          href="/reportes"
          className="rounded-2xl bg-white p-6 shadow hover:bg-green-50"
        >
          <h2 className="text-xl font-bold text-green-950">Reportes</h2>
          <p className="mt-2 text-sm text-gray-600">
            Ver resumen de trabajos, pagos y ganancias.
          </p>
        </Link>

        <Link
          href="/trabajos/ia"
          className="rounded-2xl bg-white p-6 shadow hover:bg-green-50"
        >
          <h2 className="text-xl font-bold text-green-950">
            Analizar con IA
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Escribir o dictar el trabajo para que la IA lo ordene.
          </p>
        </Link>
      </div>
    </section>
  </main>
);
}