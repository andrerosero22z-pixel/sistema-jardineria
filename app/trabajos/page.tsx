import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    estado?: string;
  }>;
};

function dinero(valor: number | string | null | undefined) {
  const numero = Number(valor || 0);
  return `$${numero.toFixed(2)}`;
}

export default async function TrabajosPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const estado = params.estado ?? "todos";

  let query = supabase
    .from("orden_servicio")
    .select(
      `
      id_orden,
      fecha_servicio,
      estado_pago,
      total_servicios,
      total_productos_venta,
      total_general,
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
    .eq("estado_orden", "realizada")
    .order("fecha_servicio", { ascending: false });

  if (estado === "pendiente" || estado === "pagado") {
    query = query.eq("estado_pago", estado);
  }

  const { data: trabajos, error } = await query;

  const totalTrabajos = trabajos?.length ?? 0;

  const totalDinero =
    trabajos?.reduce((suma: number, trabajo: any) => {
      return suma + Number(trabajo.total_general || 0);
    }, 0) ?? 0;

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
              Trabajos registrados
            </h1>

            <p className="mt-2 text-slate-600">
              Historial de servicios realizados, pagos y totales.
            </p>
          </div>

          <a href="/trabajos/nuevo" className="btn-primary text-center">
            + Registrar trabajo
          </a>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="card p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Trabajos encontrados
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-950">
              {totalTrabajos}
            </p>
          </div>

          <div className="card p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Total registrado
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-950">
              {dinero(totalDinero)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href="/trabajos"
            className={`rounded-xl px-4 py-3 text-center font-bold ${
              estado === "todos"
                ? "bg-emerald-900 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Todos
          </a>

          <a
            href="/trabajos?estado=pendiente"
            className={`rounded-xl px-4 py-3 text-center font-bold ${
              estado === "pendiente"
                ? "bg-emerald-900 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Pendientes
          </a>

          <a
            href="/trabajos?estado=pagado"
            className={`rounded-xl px-4 py-3 text-center font-bold ${
              estado === "pagado"
                ? "bg-emerald-900 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Pagados
          </a>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
            {error.message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {trabajos?.length === 0 ? (
            <div className="card p-6">
              <h2 className="text-xl font-black text-emerald-950">
                No hay trabajos registrados
              </h2>

              <p className="mt-2 text-slate-600">
                Cuando registres trabajos, aparecerán aquí.
              </p>
            </div>
          ) : null}

          {trabajos?.map((trabajo: any) => {
            const propiedad = trabajo.propiedad;
            const cliente = propiedad?.cliente;

            return (
              <div key={trabajo.id_orden} className="card p-5">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                          {trabajo.fecha_servicio}
                        </p>

                        <h2 className="mt-1 text-2xl font-black text-emerald-950">
                          {cliente?.nombre || "Sin cliente"}
                        </h2>

                        <p className="mt-1 text-sm text-slate-600">
                          {propiedad?.nombre_propiedad || "Sin propiedad"}
                          {" · "}
                          {propiedad?.ciudad ? `${propiedad.ciudad} · ` : ""}
                          {propiedad?.sector ? `${propiedad.sector} · ` : ""}
                          {propiedad?.direccion}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-sm text-slate-500">
                          Total del trabajo
                        </p>

                        <p className="text-3xl font-black text-emerald-900">
                          {dinero(trabajo.total_general)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Servicios
                        </p>
                        <p className="font-black text-slate-900">
                          {dinero(trabajo.total_servicios)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Productos
                        </p>
                        <p className="font-black text-slate-900">
                          {dinero(trabajo.total_productos_venta)}
                        </p>
                      </div>

                      <div
                        className={`rounded-xl p-3 ${
                          trabajo.estado_pago === "pagado"
                            ? "bg-emerald-50"
                            : "bg-amber-50"
                        }`}
                      >
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Pago
                        </p>
                        <p
                          className={`font-black ${
                            trabajo.estado_pago === "pagado"
                              ? "text-emerald-800"
                              : "text-amber-700"
                          }`}
                        >
                          {trabajo.estado_pago === "pagado"
                            ? "Pagado"
                            : "Pendiente"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 lg:w-56">
                    <a
                      href={`/trabajos/${trabajo.id_orden}`}
                      className="rounded-xl border border-slate-200 px-4 py-3 text-center font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Ver comprobante
                    </a>

                    {trabajo.estado_pago === "pendiente" ? (
                      <a
                        href="/pagos"
                        className="rounded-xl bg-amber-500 px-4 py-3 text-center font-bold text-white hover:bg-amber-600"
                      >
                        Registrar pago
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}