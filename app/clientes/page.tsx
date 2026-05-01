import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function ClientesPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  let query = supabase
    .from("cliente")
    .select(
      `
      id_cliente,
      nombre,
      telefono,
      propiedad (
        id_propiedad,
        nombre_propiedad,
        sector,
        direccion
      )
    `
    )
    .order("nombre", { ascending: true });

  if (q) {
    query = query.ilike("nombre", `%${q}%`);
  }

  const { data: clientes, error } = await query;

  return (
    <main className="page-shell">
      <section className="page-container">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-emerald-700"
            >
              ← Volver al panel
            </Link>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-emerald-950">
              Clientes
            </h1>

            <p className="mt-2 text-slate-600">
              Busca clientes por nombre y revisa sus propiedades.
            </p>
          </div>

          <Link
            href="/clientes/nuevo"
            className="action-card px-6 py-4 text-center text-xl font-extrabold tracking-tight hover:opacity-95"
          >
            + Nuevo cliente
          </Link>
        </div>

        <form className="mt-6">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre del cliente..."
            className="input-field"
          />
        </form>

        {error ? (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">
            {error.message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {clientes?.length === 0 ? (
            <div className="card p-6">
              <p className="text-slate-600">No hay clientes registrados.</p>
            </div>
          ) : null}

          {clientes?.map((cliente) => (
            <div key={cliente.id_cliente} className="card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link
                    href={`/clientes/${cliente.id_cliente}`}
                    className="text-2xl font-black text-emerald-950 hover:text-emerald-700"
                  >
                    {cliente.nombre}
                  </Link>

                  <p className="mt-1 text-slate-600">
                    Teléfono: {cliente.telefono || "Sin teléfono"}
                  </p>
                </div>

                <Link
                  href={`/clientes/${cliente.id_cliente}`}
                  className="rounded-xl bg-emerald-900 px-4 py-2 text-center font-bold text-white hover:bg-emerald-950"
                >
                  Ver cliente
                </Link>
              </div>

              <div className="mt-5">
                <p className="text-sm font-bold text-slate-700">
                  Propiedades
                </p>

                <div className="mt-2 grid gap-2">
                  {cliente.propiedad?.length ? (
                    cliente.propiedad.map((propiedad) => (
                      <div
                        key={propiedad.id_propiedad}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <p className="font-bold text-slate-900">
                          {propiedad.nombre_propiedad}
                        </p>

                        <p className="text-sm text-slate-600">
                          {propiedad.sector ? `${propiedad.sector} · ` : ""}
                          {propiedad.direccion}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      Este cliente aún no tiene propiedades registradas.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}