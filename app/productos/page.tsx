import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function numero(valor: number | string | null | undefined) {
  return Number(valor || 0).toFixed(2);
}

export default async function ProductosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: productos, error } = await supabase
    .from("producto")
    .select(
      `
      id_producto,
      nombre_producto,
      categoria,
      tipo_producto,
      controla_stock,
      stock_actual,
      unidad_medida,
      estado_producto
    `
    )
    .eq("estado_producto", "activo")
    .order("nombre_producto", { ascending: true });

  return (
    <main className="page-shell">
      <section className="page-container">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <a
              href="/dashboard"
              className="inline-flex items-center rounded-xl px-2 py-1 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
            >
              ← Volver al panel
            </a>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-emerald-950">
              Productos y stock
            </h1>

            <p className="mt-2 text-slate-600">
              Revisa productos, existencias y entradas de stock.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
            {error.message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {productos?.map((producto) => (
            <div key={producto.id_producto} className="card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                    {producto.categoria}
                  </p>

                  <h2 className="mt-1 text-2xl font-black text-emerald-950">
                    {producto.nombre_producto}
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    {producto.controla_stock
                      ? "Este producto controla stock."
                      : "Este producto normalmente se compra para un trabajo."}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-sm font-bold text-slate-500">
                    Stock actual
                  </p>

                  <p className="text-3xl font-black text-emerald-900">
                    {producto.controla_stock
                      ? `${numero(producto.stock_actual)} ${
                          producto.unidad_medida || ""
                        }`
                      : "No aplica"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                {producto.controla_stock ? (
                  <a
                    href={`/productos/${producto.id_producto}/entrada`}
                    className="btn-primary text-center"
                  >
                    + Agregar entrada de stock
                  </a>
                ) : (
                  <span className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-bold text-slate-600">
                    Se registra al venderlo en un trabajo
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}