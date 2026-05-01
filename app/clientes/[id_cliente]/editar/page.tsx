import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id_cliente: string;
  }>;
};

export default async function EditarClientePage({ params }: PageProps) {
  const { id_cliente } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: cliente } = await supabase
    .from("cliente")
    .select("id_cliente, nombre, telefono")
    .eq("id_cliente", id_cliente)
    .single();

  if (!cliente) {
    redirect("/clientes");
  }

  async function editarCliente(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const nombre = String(formData.get("nombre") || "").trim();
    const telefono = String(formData.get("telefono") || "").trim();

    if (!nombre) {
      redirect(`/clientes/${id_cliente}/editar?error=campos`);
    }

    const { error } = await supabase
      .from("cliente")
      .update({
        nombre,
        telefono: telefono || null,
      })
      .eq("id_cliente", id_cliente);

    if (error) {
      console.error(error);
      redirect(`/clientes/${id_cliente}/editar?error=guardar`);
    }

    revalidatePath("/clientes");
    revalidatePath(`/clientes/${id_cliente}`);
    redirect(`/clientes/${id_cliente}`);
  }

  return (
    <main className="page-shell">
      <section className="page-container max-w-3xl">
        <Link
          href={`/clientes/${id_cliente}`}
          className="text-sm font-semibold text-emerald-700"
        >
          ← Volver al cliente
        </Link>

        <div className="card mt-5 overflow-hidden">
          <div className="card-dark p-7">
            <p className="text-sm font-semibold text-emerald-100">Cliente</p>
            <h1 className="mt-2 text-3xl font-bold">Editar cliente</h1>
          </div>

          <form action={editarCliente} className="space-y-6 p-7">
            <div>
              <label className="label">Nombre del cliente *</label>
              <input
                name="nombre"
                required
                defaultValue={cliente.nombre}
                className="input-field"
              />
            </div>

            <div>
              <label className="label">Teléfono</label>
              <input
                name="telefono"
                defaultValue={cliente.telefono || ""}
                className="input-field"
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
              <Link href={`/clientes/${id_cliente}`} className="btn-secondary">
                Cancelar
              </Link>

              <button type="submit" className="btn-primary">
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}