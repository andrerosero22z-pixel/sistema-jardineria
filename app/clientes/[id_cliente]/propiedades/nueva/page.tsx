import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id_cliente: string;
  }>;
};

export default async function NuevaPropiedadPage({ params }: PageProps) {
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
    .select("id_cliente, nombre")
    .eq("id_cliente", id_cliente)
    .single();

  if (!cliente) {
    redirect("/clientes");
  }

  async function crearPropiedad(formData: FormData) {
    "use server";

    const ciudad = String(formData.get("ciudad") || "").trim();
    

    const supabase = await createClient();

    const nombrePropiedad = String(
      formData.get("nombre_propiedad") || ""
    ).trim();
    const sector = String(formData.get("sector") || "").trim();
    const direccion = String(formData.get("direccion") || "").trim();

    if (!nombrePropiedad || !direccion) {
      redirect(`/clientes/${id_cliente}/propiedades/nueva?error=campos`);
    }

    const { error } = await supabase.from("propiedad").insert({
        id_cliente,
        nombre_propiedad: nombrePropiedad,
        ciudad: ciudad || null,
        sector: sector || null,
        direccion,
      });

    if (error) {
      console.error(error);
      redirect(`/clientes/${id_cliente}/propiedades/nueva?error=guardar`);
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
            <p className="text-sm font-semibold text-emerald-100">
              {cliente.nombre}
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Agregar propiedad
            </h1>

            <p className="mt-3 text-sm leading-6 text-emerald-50">
              Registra una casa, quinta, terreno o lugar donde se realizan los
              trabajos.
            </p>
          </div>

          <form action={crearPropiedad} className="space-y-6 p-7">
            <div>
              <label className="label">Nombre del lugar *</label>
              <input
                name="nombre_propiedad"
                required
                placeholder="Ej: Casa principal, Quinta, Casa de la mamá"
                className="input-field"
              />
            </div>

            <div>
  <label className="label">Ciudad / zona general</label>
          <select name="ciudad" className="input-field" defaultValue="">
            <option value="">Selecciona una opción</option>
            <option value="Quito">Quito</option>
            <option value="Cayambe">Cayambe</option>
            <option value="Tabacundo">Tabacundo</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        <div>
          <label className="label">Parroquia o sector</label>
          <select name="sector" className="input-field" defaultValue="">
            <option value="">Selecciona una opción</option>
            <option value="Cumbayá">Cumbayá</option>
            <option value="Tumbaco">Tumbaco</option>
            <option value="Puembo">Puembo</option>
            <option value="Pifo">Pifo</option>
            <option value="Yaruquí">Yaruquí</option>
            <option value="El Quinche">El Quinche</option>
            <option value="Checa">Checa</option>
            <option value="Tababela">Tababela</option>
            <option value="Quito norte">Quito norte</option>
            <option value="Quito centro">Quito centro</option>
            <option value="Quito sur">Quito sur</option>
            <option value="Cayambe centro">Cayambe centro</option>
            <option value="Tabacundo centro">Tabacundo centro</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

            <div>
              <label className="label">Dirección específica *</label>
              <textarea
                name="direccion"
                required
                placeholder="Ej: Calle principal, frente al parque, casa color blanco"
                rows={4}
                className="input-field"
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
              <Link href={`/clientes/${id_cliente}`} className="btn-secondary">
                Cancelar
              </Link>

              <button type="submit" className="btn-primary">
                Guardar propiedad
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}