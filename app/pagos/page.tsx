import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { marcarComoPagado } from "./actions";

type PageProps = {
  searchParams: Promise<{
    ok?: string;
    error?: string;
  }>;
};

function dinero(valor: number | string | null | undefined) {
  const numero = Number(valor || 0);
  return `$${numero.toFixed(2)}`;
}

export default async function PagosPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;

  const { data: ordenes, error } = await supabase
    .from("orden_servicio")
    .select(
      `
      id_orden,
      fecha_servicio,
      total_general,
      total_servicios,
      total_productos_venta,
      nota_trabajo,
      propiedad (
        nombre_propiedad,
        ciudad,
        sector,
        direccion,
        cliente (
          nombre,
          telefono
        )
      )
    `
    )
    .eq("estado_pago", "pendiente")
    .eq("estado_orden", "realizada")
    .order("fecha_servicio", { ascending: false });

  return (
    <main className="page-shell">
      <section className="page-container">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-xl px-2 py-1 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
            >
              ← Volver al panel
            </Link>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-emerald-950">
              Pagos pendientes
            </h1>

            <p className="mt-2 text-slate-600">
              Trabajos realizados que todavía no han sido pagados.
            </p>
          </div>

          
        </div>

        {params.ok ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">
            Pago registrado correctamente.
          </div>
        ) : null}

        {params.error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
            No se pudo registrar el pago. Revisa la información.
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 text-red-700">
            {error.message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {ordenes?.length === 0 ? (
            <div className="card p-6">
              <h2 className="text-xl font-black text-emerald-950">
                No hay pagos pendientes
              </h2>

              <p className="mt-2 text-slate-600">
                Todos los trabajos registrados están pagados o aún no hay
                trabajos pendientes.
              </p>
            </div>
          ) : null}

          {ordenes?.map((orden: any) => {
            const propiedad = orden.propiedad;
            const cliente = propiedad?.cliente;

            return (
              <div key={orden.id_orden} className="card p-5">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                          Cliente
                        </p>

                        <h2 className="text-2xl font-black text-emerald-950">
                          {cliente?.nombre || "Sin cliente"}
                        </h2>

                        <p className="mt-1 text-sm text-slate-600">
                          Teléfono: {cliente?.telefono || "Sin teléfono"}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-sm text-slate-500">
                          Total pendiente
                        </p>

                        <p className="text-3xl font-black text-emerald-900">
                          {dinero(orden.total_general)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="font-black text-slate-900">
                        {propiedad?.nombre_propiedad || "Sin propiedad"}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {propiedad?.ciudad ? `${propiedad.ciudad} · ` : ""}
                        {propiedad?.sector ? `${propiedad.sector} · ` : ""}
                        {propiedad?.direccion}
                      </p>

                      <p className="mt-2 text-sm text-slate-500">
                        Fecha del servicio: {orden.fecha_servicio}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-500">
                          Servicios
                        </p>
                        <p className="font-black text-slate-900">
                          {dinero(orden.total_servicios)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-500">
                          Productos
                        </p>
                        <p className="font-black text-slate-900">
                          {dinero(orden.total_productos_venta)}
                        </p>
                      </div>

                      <Link
                        href={`/trabajos/${orden.id_orden}`}
                        className="rounded-xl border border-slate-200 p-3 text-center font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Ver comprobante
                      </Link>
                    </div>
                  </div>

                  <form
                    action={marcarComoPagado}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:w-72"
                  >
                    <input
                      type="hidden"
                      name="id_orden"
                      value={orden.id_orden}
                    />

                    <h3 className="font-black text-slate-900">
                      Registrar pago
                    </h3>

                    <p className="mt-1 text-sm text-slate-600">
                      Marca este trabajo como pagado.
                    </p>

                    <div className="mt-4">
                      <label className="label">Método de pago</label>
                      <select
                        name="metodo_pago"
                        required
                        className="input-field"
                        defaultValue=""
                      >
                        <option value="">Selecciona</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                      </select>
                    </div>

                    <button type="submit" className="btn-primary mt-4 w-full">
                      Marcar como pagado
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}