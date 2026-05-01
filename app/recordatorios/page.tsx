import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cambiarEstadoRecordatorio } from "./actions";

type PageProps = {
  searchParams: Promise<{
    estado?: string;
    ok?: string;
    error?: string;
  }>;
};

function fechaBonita(fecha: string | null | undefined) {
  if (!fecha) return "Sin fecha";
  return fecha;
}

function estadoTexto(estado: string) {
  if (estado === "pendiente") return "Pendiente";
  if (estado === "notificado") return "Notificado";
  if (estado === "cancelado") return "Cancelado";
  return estado;
}

function estadoClase(estado: string) {
  if (estado === "pendiente") return "bg-amber-50 text-amber-700";
  if (estado === "notificado") return "bg-emerald-50 text-emerald-700";
  if (estado === "cancelado") return "bg-slate-100 text-slate-600";
  return "bg-slate-100 text-slate-600";
}

export default async function RecordatoriosPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const estado = params.estado ?? "pendiente";

  let query = supabase
    .from("recordatorio")
    .select(
      `
      id_recordatorio,
      fecha_recordatorio,
      mensaje,
      estado_recordatorio,

      orden_servicio (
        id_orden,
        fecha_servicio,
        total_general,
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
      ),

      detalle_servicio (
        servicio (
          nombre_servicio
        )
      )
    `
    )
    .order("fecha_recordatorio", { ascending: true });

  if (estado !== "todos") {
    query = query.eq("estado_recordatorio", estado);
  }

  const { data: recordatorios, error } = await query;

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
              Recordatorios
            </h1>

            <p className="mt-2 text-slate-600">
              Revisa trabajos que necesitan seguimiento o mantenimiento.
            </p>
          </div>

          
        </div>

        {params.ok ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">
            Recordatorio actualizado correctamente.
          </div>
        ) : null}

        {params.error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
            No se pudo actualizar el recordatorio.
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href="/recordatorios"
            className={`rounded-xl px-4 py-3 text-center font-bold ${
              estado === "pendiente"
                ? "bg-emerald-900 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Pendientes
          </a>

          <a
            href="/recordatorios?estado=notificado"
            className={`rounded-xl px-4 py-3 text-center font-bold ${
              estado === "notificado"
                ? "bg-emerald-900 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Notificados
          </a>

          <a
            href="/recordatorios?estado=cancelado"
            className={`rounded-xl px-4 py-3 text-center font-bold ${
              estado === "cancelado"
                ? "bg-emerald-900 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Cancelados
          </a>

          <a
            href="/recordatorios?estado=todos"
            className={`rounded-xl px-4 py-3 text-center font-bold ${
              estado === "todos"
                ? "bg-emerald-900 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Todos
          </a>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
            {error.message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {recordatorios?.length === 0 ? (
            <div className="card p-6">
              <h2 className="text-xl font-black text-emerald-950">
                No hay recordatorios
              </h2>

              <p className="mt-2 text-slate-600">
                Cuando registres recordatorios de mantenimiento, aparecerán aquí.
              </p>
            </div>
          ) : null}

          {recordatorios?.map((recordatorio: any) => {
            const orden = recordatorio.orden_servicio;
            const propiedad = orden?.propiedad;
            const cliente = propiedad?.cliente;
            const servicio =
              recordatorio.detalle_servicio?.servicio?.nombre_servicio;

            return (
              <div key={recordatorio.id_recordatorio} className="card p-5">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                          Recordar el {fechaBonita(recordatorio.fecha_recordatorio)}
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

                      <span
                        className={`rounded-full px-3 py-1 text-sm font-black ${estadoClase(
                          recordatorio.estado_recordatorio
                        )}`}
                      >
                        {estadoTexto(recordatorio.estado_recordatorio)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Servicio
                        </p>
                        <p className="font-black text-slate-900">
                          {servicio || "Recordatorio general"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Trabajo original
                        </p>
                        <p className="font-black text-slate-900">
                          {fechaBonita(orden?.fecha_servicio)}
                        </p>
                      </div>

                      <a
                        href={`/trabajos/${orden?.id_orden}`}
                        className="rounded-xl border border-slate-200 p-3 text-center font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Ver comprobante
                      </a>
                    </div>

                    {recordatorio.mensaje ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                        {recordatorio.mensaje}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-3 lg:w-56">
                    {recordatorio.estado_recordatorio !== "notificado" ? (
                      <form action={cambiarEstadoRecordatorio}>
                        <input
                          type="hidden"
                          name="id_recordatorio"
                          value={recordatorio.id_recordatorio}
                        />
                        <input
                          type="hidden"
                          name="estado_recordatorio"
                          value="notificado"
                        />
                        <button type="submit" className="btn-primary w-full">
                          Marcar notificado
                        </button>
                      </form>
                    ) : null}

                    {recordatorio.estado_recordatorio !== "cancelado" ? (
                      <form action={cambiarEstadoRecordatorio}>
                        <input
                          type="hidden"
                          name="id_recordatorio"
                          value={recordatorio.id_recordatorio}
                        />
                        <input
                          type="hidden"
                          name="estado_recordatorio"
                          value="cancelado"
                        />
                        <button
                          type="submit"
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                      </form>
                    ) : null}

                    {recordatorio.estado_recordatorio !== "pendiente" ? (
                      <form action={cambiarEstadoRecordatorio}>
                        <input
                          type="hidden"
                          name="id_recordatorio"
                          value={recordatorio.id_recordatorio}
                        />
                        <input
                          type="hidden"
                          name="estado_recordatorio"
                          value="pendiente"
                        />
                        <button
                          type="submit"
                          className="w-full rounded-xl bg-amber-500 px-4 py-3 text-center font-bold text-white hover:bg-amber-600"
                        >
                          Volver a pendiente
                        </button>
                      </form>
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