import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id_cliente: string;
    id_propiedad: string;
  }>;
};

const ciudades = ["Quito", "Cayambe", "Tabacundo", "Otro"];

const sectores = [
  "Cumbayá",
  "Tumbaco",
  "Puembo",
  "Pifo",
  "Yaruquí",
  "El Quinche",
  "Checa",
  "Tababela",
  "Quito norte",
  "Quito centro",
  "Quito sur",
  "Cayambe centro",
  "Tabacundo centro",
  "Otro",
];

export default async function EditarPropiedadPage({ params }: PageProps) {
  const { id_cliente, id_propiedad } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: propiedad } = await supabase
    .from("propiedad")
    .select("id_propiedad, nombre_propiedad, ciudad, sector, direccion")
    .eq("id_propiedad", id_propiedad)
    .eq("id_cliente", id_cliente)
    .single();

  if (!propiedad) {
    redirect(`/clientes/${id_cliente}`);
  }

  async function editarPropiedad(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const nombrePropiedad = String(
      formData.get("nombre_propiedad") || ""
    ).trim();

    const ciudad = String(formData.get("ciudad") || "").trim();
    const sector = String(formData.get("sector") || "").trim();
    const direccion = String(formData.get("direccion") || "").trim();

    if (!nombrePropiedad || !direccion) {
      redirect(
        `/clientes/${id_cliente}/propiedades/${id_propiedad}/editar?error=campos`
      );
    }

    const { error } = await supabase
      .from("propiedad")
      .update({
        nombre_propiedad: nombrePropiedad,
        ciudad: ciudad || null,
        sector: sector || null,
        direccion,
      })
      .eq("id_propiedad", id_propiedad)
      .eq("id_cliente", id_cliente);

    if (error) {
      console.error(error);
      redirect(
        `/clientes/${id_cliente}/propiedades/${id_propiedad}/editar?error=guardar`
      );
    }

    revalidatePath("/clientes");
    revalidatePath(`/clientes/${id_cliente}`);
    redirect(`/clientes/${id_cliente}`);
  }

  return (
    <main className="page-shell">
      <section className="page-container max-w-3xl">
        <a
          href={`/clientes/${id_cliente}`}
          className="inline-flex items-center rounded-xl px-2 py-1 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
        >
          ← Volver al cliente
        </a>

        <div className="card mt-5 overflow-hidden">
          <div className="card-dark p-7">
            <p className="text-sm font-semibold text-emerald-100">
              Propiedad
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Editar propiedad
            </h1>

            <p className="mt-3 text-sm leading-6 text-emerald-50">
              Actualiza el lugar donde se realizan los trabajos.
            </p>
          </div>

          <form action={editarPropiedad} className="space-y-6 p-7">
            <div>
              <label className="label">Nombre del lugar *</label>
              <input
                name="nombre_propiedad"
                required
                defaultValue={propiedad.nombre_propiedad}
                className="input-field"
              />
            </div>

            <div>
              <label className="label">Ciudad / zona general</label>
              <select
                name="ciudad"
                defaultValue={propiedad.ciudad || ""}
                className="input-field"
              >
                <option value="">Selecciona una opción</option>
                {ciudades.map((ciudad) => (
                  <option key={ciudad} value={ciudad}>
                    {ciudad}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Parroquia o sector</label>
              <select
                name="sector"
                defaultValue={propiedad.sector || ""}
                className="input-field"
              >
                <option value="">Selecciona una opción</option>
                {sectores.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Dirección específica *</label>
              <textarea
                name="direccion"
                required
                rows={4}
                defaultValue={propiedad.direccion}
                placeholder="Ej: Calle principal, frente al parque, casa color blanco"
                className="input-field"
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
              <a href={`/clientes/${id_cliente}`} className="btn-secondary">
                Cancelar
              </a>

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