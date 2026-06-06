import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/components/PrintButton";

type PageProps = {
  params: Promise<{
    id_orden: string;
  }>;
};

function dinero(valor: number | string | null | undefined) {
  const numero = Number(valor || 0);
  return `$${numero.toFixed(2)}`;
}

export default async function TrabajoDetallePage({ params }: PageProps) {
  const { id_orden } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
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
      ),

      detalle_servicio (
        precio_servicio,
        descripcion,
        servicio (
          nombre_servicio
        )
      ),

      producto_orden (
        cantidad,
        costo_unitario_aplicado,
        precio_venta_unitario,
        subtotal_costo,
        subtotal_venta,
        producto (
          nombre_producto,
          unidad_medida
        )
      ),
       planta (
      nombre_planta
     )

      pago (
        fecha_pago,
        metodo_pago,
        monto_pagado
      )
    `
    )
    .eq("id_orden", id_orden)
    .single();

  if (error || !data) {
    redirect("/dashboard");
  }

  const trabajo = data as any;
  const propiedad = trabajo.propiedad;
  const cliente = propiedad?.cliente;
  const pago = Array.isArray(trabajo.pago) ? trabajo.pago[0] : trabajo.pago;

  return (
    <main className="page-shell">
      <section className="page-container max-w-5xl">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-xl px-2 py-1 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
          >
            ← Volver al panel
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row">
          <PrintButton />
          

          <Link
            href="/trabajos/nuevo"
            className="btn-primary text-center"
          >
            + Registrar otro trabajo
          </Link>
        </div>
        </div>

        <div className="card invoice-paper overflow-hidden">
          <div className="card-dark px-5 py-4">
            <p className="text-sm font-semibold text-emerald-100">
              Comprobante interno
            </p>

            <h1 className="mt-1 text-2xl font-black tracking-tight">
              Trabajo registrado
            </h1>
            <p className="mt-3 text-sm text-emerald-50">
            No válido como factura electrónica. Uso interno del negocio.
          </p>

            <p className="mt-2 text-sm text-emerald-50">
              Fecha del servicio: {trabajo.fecha_servicio}
            </p>
          </div>

          <div className="space-y-4 p-4">
            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold text-slate-500">Cliente</p>
                <h2 className="mt-1 text-xl font-black text-emerald-950">
                  {cliente?.nombre || "Sin cliente"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Teléfono: {cliente?.telefono || "Sin teléfono"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-bold text-slate-500">Propiedad</p>
                <h2 className="mt-1 text-xl font-black text-emerald-950">
                  {propiedad?.nombre_propiedad || "Sin propiedad"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {propiedad?.ciudad ? `${propiedad.ciudad} · ` : ""}
                  {propiedad?.sector ? `${propiedad.sector} · ` : ""}
                  {propiedad?.direccion}
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-black text-emerald-950">
                Servicios realizados
              </h2>

              <div className="mt-4 grid gap-3">
                {trabajo.detalle_servicio?.map((detalle: any, index: number) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-black text-slate-900">
                          {detalle.servicio?.nombre_servicio}
                        </p>

                        {detalle.descripcion ? (
                          <p className="mt-1 text-sm text-slate-600">
                            {detalle.descripcion}
                          </p>
                        ) : null}
                      </div>

                      <p className="font-black text-slate-900">
                        {dinero(detalle.precio_servicio)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-black text-emerald-950">
                Productos usados o vendidos
              </h2>

              {trabajo.producto_orden?.length ? (
                <div className="mt-4 grid gap-3">
                  {trabajo.producto_orden.map((productoOrden: any, index: number) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-black text-slate-900">
                            {productoOrden.producto?.nombre_producto}
                          </p>
                          {productoOrden.planta?.nombre_planta ? (
                        <p className="mt-1 text-sm font-bold text-emerald-800">
                          Planta: {productoOrden.planta.nombre_planta}
                        </p>
                      ) : null}

                          <p className="mt-1 text-sm text-slate-600">
                            Cantidad: {productoOrden.cantidad}{" "}
                            {productoOrden.producto?.unidad_medida || ""}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            Costo por unidad:{" "}
                            {dinero(productoOrden.costo_unitario_aplicado)} ·
                            Precio cobrado por unidad:{" "}
                            {dinero(productoOrden.precio_venta_unitario)}
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="text-sm text-slate-500">
                            Total cobrado
                          </p>
                          <p className="font-black text-emerald-900">
                            {dinero(productoOrden.subtotal_venta)}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            Costo: {dinero(productoOrden.subtotal_costo)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-5 text-slate-600">
                  No se registraron productos en este trabajo.
                </div>
              )}
            </section>

            {trabajo.nota_trabajo ? (
              <section>
                <h2 className="text-xl font-black text-emerald-950">
                  Nota del trabajo
                </h2>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-700">
                  {trabajo.nota_trabajo}
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl bg-slate-950 p-6 text-white">
              <h2 className="text-2xl font-black">Resumen</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="flex justify-between gap-4">
                    <span>Total servicios</span>
                    <strong>{dinero(trabajo.total_servicios)}</strong>
                  </p>

                  <p className="flex justify-between gap-4">
                    <span>Total productos</span>
                    <strong>{dinero(trabajo.total_productos_venta)}</strong>
                  </p>

                  <p className="flex justify-between gap-4 border-t border-white/20 pt-2 text-xl">
                    <span>Total a cobrar</span>
                    <strong>{dinero(trabajo.total_general)}</strong>
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="flex justify-between gap-4">
                    <span>Estado del pago</span>
                    <strong>
                      {trabajo.estado_pago === "pagado"
                        ? "Pagado"
                        : "Pendiente"}
                    </strong>
                  </p>

                  {pago ? (
                    <>
                      <p className="flex justify-between gap-4">
                        <span>Método</span>
                        <strong>
                          {pago.metodo_pago === "efectivo"
                            ? "Efectivo"
                            : "Transferencia"}
                        </strong>
                      </p>

                      <p className="flex justify-between gap-4">
                        <span>Monto pagado</span>
                        <strong>{dinero(pago.monto_pagado)}</strong>
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-300">
                      Este trabajo todavía tiene pago pendiente.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}