import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    id_cliente: string;
  }>;
};

export default async function ClienteDetallePage({ params }: PageProps) {
  const { id_cliente } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: cliente, error } = await supabase
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
    .eq("id_cliente", id_cliente)
    .single();

  if (error || !cliente) {
    redirect("/clientes");
  }

  return (
    <main className="page-shell">
      <section className="page-container">
        <a
          href="/clientes"
          className="inline-flex items-center rounded-xl px-2 py-1 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
        >
          ← Volver a clientes
        </a>

        <div className="card mt-5 overflow-hidden">
          <div className="card-dark p-7">
            <p className="text-sm font-semibold text-emerald-100">Cliente</p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              {cliente.nombre}
            </h1>

            <p className="mt-2 text-emerald-50">
              Teléfono: {cliente.telefono || "Sin teléfono"}
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/clientes/${cliente.id_cliente}/editar`}
                className="rounded-xl bg-white px-4 py-3 text-center font-bold text-emerald-950 hover:bg-emerald-50"
              >
                Editar cliente
              </Link>

              <Link
                href={`/clientes/${cliente.id_cliente}/propiedades/nueva`}
                className="rounded-xl border border-white/40 px-4 py-3 text-center font-bold text-white hover:bg-white/10"
              >
                + Agregar propiedad
              </Link>
            </div>
          </div>

          <div className="p-7">
            <h2 className="text-2xl font-black text-emerald-950">
              Propiedades
            </h2>

            <div className="mt-5 grid gap-4">
              {cliente.propiedad?.length ? (
                cliente.propiedad.map((propiedad) => (
                  <div
                    key={propiedad.id_propiedad}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-black text-slate-900">
                          {propiedad.nombre_propiedad}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          {propiedad.ciudad ? `${propiedad.ciudad} · ` : ""}
                          {propiedad.sector ? `${propiedad.sector} · ` : ""}
                          {propiedad.direccion}
                        </p>
                      </div>

                      <Link
                        href={`/clientes/${cliente.id_cliente}/propiedades/${propiedad.id_propiedad}/editar`}
                        className="rounded-xl border px-4 py-2 text-center font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Editar
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-slate-600">
                  Este cliente aún no tiene propiedades registradas.
                </div>
              )}
              
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}