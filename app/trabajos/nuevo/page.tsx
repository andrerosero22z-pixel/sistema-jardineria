import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TrabajoForm from "./TrabajoForm";

type PageProps = {
  searchParams: Promise<{
    ok?: string;
    error?: string;
  }>;
};

export default async function NuevoTrabajoPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;

  const { data: clientes } = await supabase
    .from("cliente")
    .select(
      `
      id_cliente,
      nombre,
      telefono,
      propiedad (
        id_propiedad,
        nombre_propiedad,
        ciudad,
        sector,
        direccion
      )
    `
    )
    .order("nombre", { ascending: true });

  const { data: servicios } = await supabase
    .from("servicio")
    .select("id_servicio, nombre_servicio")
    .eq("estado_servicio", "activo")
    .order("nombre_servicio", { ascending: true });

    const { data: productos } = await supabase
  .from("producto")
  .select("id_producto, nombre_producto, categoria, controla_stock, stock_actual, unidad_medida")
  .eq("estado_producto", "activo")
  .order("nombre_producto", { ascending: true });

  const { data: plantas } = await supabase
  .from("planta")
  .select("id_planta, nombre_planta")
  .eq("estado_planta", "activo")
  .order("nombre_planta", { ascending: true });
  

  return (
    <main className="page-shell">
      <section className="page-container max-w-4xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-xl px-2 py-1 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
        >
          ← Volver al panel
        </Link>

        {params.ok ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">
            Trabajo guardado correctamente.
          </div>
        ) : null}

        {params.error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
              No se pudo guardar el trabajo. Error: {params.error}
            </div>
          ) : null}

        <div className="card mt-5 overflow-hidden">
          <div className="card-dark p-7">
            <p className="text-sm font-semibold text-emerald-100">
              Trabajos
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Registrar trabajo
            </h1>

            <p className="mt-3 text-sm leading-6 text-emerald-50">
              Registra un servicio que ya fue realizado, con sus precios y el
              estado del pago.
            </p>
          </div>

          <TrabajoForm
            clientes={clientes ?? []}
            servicios={servicios ?? []}
            productos={productos ?? []}
            plantas={plantas ?? []}
          />
        </div>
      </section>
    </main>
  );
}