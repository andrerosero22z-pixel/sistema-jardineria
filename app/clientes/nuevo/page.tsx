import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export default async function NuevoClientePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  async function crearCliente(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const nombre = String(formData.get("nombre") || "").trim();
    const telefono = String(formData.get("telefono") || "").trim();

    if (!nombre) {
      redirect("/clientes/nuevo?error=campos");
    }

    const { error } = await supabase.from("cliente").insert({
      nombre,
      telefono: telefono || null,
    });

    if (error) {
      console.error(error);
      redirect("/clientes/nuevo?error=cliente");
    }

    revalidatePath("/clientes");
    redirect("/clientes");
  }

  return (
  <main className="page-shell">
    <section className="page-container max-w-3xl">
      <Link href="/clientes" className="text-sm font-semibold text-emerald-700">
        ← Volver a clientes
      </Link>

      <div className="card mt-5 overflow-hidden">
        <div className="card-dark p-7">
          <p className="text-sm font-semibold text-emerald-100">
            Clientes
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Registrar cliente
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50">
            Guarda primero los datos del cliente. Después podrás agregar una o
            varias propiedades donde se realizan los trabajos.
          </p>
        </div>

        <form action={crearCliente} className="space-y-6 p-7">
          <div>
            <label className="label">
              Nombre del cliente *
            </label>
            <input
              name="nombre"
              required
              placeholder="Ej: Don Carlos"
              className="input-field"
            />
          </div>

          <div>
            <label className="label">
              Teléfono
            </label>
            <input
              name="telefono"
              placeholder="Ej: 0999999999"
              className="input-field"
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 md:flex-row md:justify-end">
            <Link href="/clientes" className="btn-secondary text-center">
              Cancelar
            </Link>

            <button type="submit" className="btn-primary">
              Guardar cliente
            </button>
          </div>
        </form>
      </div>
    </section>
  </main>
);
}