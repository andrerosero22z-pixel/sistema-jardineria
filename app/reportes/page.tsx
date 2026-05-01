import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function dinero(valor: number | string | null | undefined) {
  const numero = Number(valor || 0);
  return `$${numero.toFixed(2)}`;
}

export default async function ReportesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: trabajos, error } = await supabase
    .from("orden_servicio")
    .select(
      `
      id_orden,
      fecha_servicio,
      estado_pago,
      total_servicios,
      total_productos_venta,
      total_productos_costo,
      total_general,
      ganancia_productos,
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

  const totalTrabajos = trabajos?.length ?? 0;

  const totalRegistrado =
    trabajos?.reduce((suma: number, trabajo: any) => {
      return suma + Number(trabajo.total_general || 0);
    }, 0) ?? 0;

  const totalPagado =
    trabajos?.reduce((suma: number, trabajo: any) => {
      if (trabajo.estado_pago === "pagado") {
        return suma + Number(trabajo.total_general || 0);
      }
      return suma;
    }, 0) ?? 0;

  const totalPendiente =
    trabajos?.reduce((suma: number, trabajo: any) => {
      if (trabajo.estado_pago === "pendiente") {
        return suma + Number(trabajo.total_general || 0);
      }
      return suma;
    }, 0) ?? 0;

  const totalServicios =
    trabajos?.reduce((suma: number, trabajo: any) => {
      return suma + Number(trabajo.total_servicios || 0);
    }, 0) ?? 0;

  const totalProductos =
    trabajos?.reduce((suma: number, trabajo: any) => {
      return suma + Number(trabajo.total_productos_venta || 0);
    }, 0) ?? 0;

  const gananciaProductos =
    trabajos?.reduce((suma: number, trabajo: any) => {
      return suma + Number(trabajo.ganancia_productos || 0);
    }, 0) ?? 0;

  const ultimosTrabajos = trabajos?.slice(0, 6) ?? [];

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
              Reportes
            </h1>

            <p className="mt-2 text-slate-600">
              Resumen de trabajos, pagos, productos y comprobantes.
            </p>
          </div>

          
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
            {error.message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="card p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Trabajos
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
              {dinero(totalRegistrado)}
            </p>
          </div>

          <div className="card p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Pagado
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-700">
              {dinero(totalPagado)}
            </p>
          </div>

          <div className="card p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Pendiente
            </p>
            <p className="mt-2 text-3xl font-black text-amber-600">
              {dinero(totalPendiente)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Servicios
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-950">
              {dinero(totalServicios)}
            </p>
          </div>

          <div className="card p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Productos vendidos
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-950">
              {dinero(totalProductos)}
            </p>
          </div>

          <div className="card p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Ganancia en productos
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-950">
              {dinero(gananciaProductos)}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-emerald-950">
              Últimos trabajos
            </h2>

            <p className="mt-1 text-slate-600">
              Trabajos registrados recientemente.
            </p>
          </div>

          <a
            href="/trabajos"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center font-bold text-slate-700 hover:bg-slate-50"
          >
            Ver historial completo
          </a>
        </div>

        <div className="mt-5 grid gap-4">
          {ultimosTrabajos.length === 0 ? (
            <div className="card p-6">
              <h2 className="text-xl font-black text-emerald-950">
                No hay trabajos registrados
              </h2>

              <p className="mt-2 text-slate-600">
                Cuando registres trabajos, aparecerán aquí.
              </p>
            </div>
          ) : null}

          {ultimosTrabajos.map((trabajo: any) => {
            const propiedad = trabajo.propiedad;
            const cliente = propiedad?.cliente;

            return (
              <div key={trabajo.id_orden} className="card p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                      {trabajo.fecha_servicio}
                    </p>

                    <h3 className="mt-1 text-xl font-black text-emerald-950">
                      {cliente?.nombre || "Sin cliente"}
                    </h3>

                    <p className="mt-1 text-sm text-slate-600">
                      {propiedad?.nombre_propiedad || "Sin propiedad"}
                      {" · "}
                      {propiedad?.ciudad ? `${propiedad.ciudad} · ` : ""}
                      {propiedad?.sector ? `${propiedad.sector} · ` : ""}
                      {propiedad?.direccion}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:items-end">
                    <p className="text-2xl font-black text-emerald-900">
                      {dinero(trabajo.total_general)}
                    </p>

                    <span
                      className={`rounded-full px-3 py-1 text-sm font-black ${
                        trabajo.estado_pago === "pagado"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {trabajo.estado_pago === "pagado" ? "Pagado" : "Pendiente"}
                    </span>

                    <a
                      href={`/trabajos/${trabajo.id_orden}`}
                      className="text-sm font-bold text-emerald-700 hover:text-emerald-900"
                    >
                      Ver comprobante
                    </a>
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