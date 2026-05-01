import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id_producto: string;
  }>;
};

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function numero(valor: number | string | null | undefined) {
  return Number(valor || 0).toFixed(2);
}

export default async function EntradaStockPage({ params }: PageProps) {
  const { id_producto } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: producto } = await supabase
    .from("producto")
    .select(
      "id_producto, nombre_producto, controla_stock, stock_actual, unidad_medida"
    )
    .eq("id_producto", id_producto)
    .single();

  if (!producto || !producto.controla_stock) {
    redirect("/productos");
  }

  async function agregarEntrada(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const { data: usuarioApp } = await supabase
      .from("usuario_app")
      .select("id_usuario")
      .eq("auth_user_id", user.id)
      .single();

    if (!usuarioApp) {
      redirect(`/productos/${id_producto}/entrada?error=usuario`);
    }

    const tipoEntrada = String(formData.get("tipo_entrada") || "").trim();
    const cantidad = Number(formData.get("cantidad") || 0);
    const costoUnitario = Number(formData.get("costo_unitario") || 0);
    const descripcion = String(formData.get("descripcion") || "").trim();
    const lugarCompra = String(formData.get("lugar_compra") || "").trim();
    const fechaCompra = String(formData.get("fecha_compra") || hoy()).trim();

    if (
      !tipoEntrada ||
      Number.isNaN(cantidad) ||
      Number.isNaN(costoUnitario) ||
      cantidad <= 0 ||
      costoUnitario < 0
    ) {
      redirect(`/productos/${id_producto}/entrada?error=campos`);
    }

    if (tipoEntrada === "produccion") {
      const { error } = await supabase.from("movimiento_producto").insert({
        id_producto,
        tipo_movimiento: "entrada_produccion",
        cantidad,
        costo_unitario: costoUnitario,
        descripcion: descripcion || "Entrada por producción propia",
        registrado_por: usuarioApp.id_usuario,
      });

      if (error) {
        console.error(error);
        redirect(`/productos/${id_producto}/entrada?error=produccion`);
      }
    }

    if (tipoEntrada === "compra") {
      const { data: compra, error: compraError } = await supabase
        .from("compra")
        .insert({
          fecha_compra: fechaCompra,
          lugar_compra: lugarCompra || null,
          registrado_por: usuarioApp.id_usuario,
        })
        .select("id_compra")
        .single();

      if (compraError || !compra) {
        console.error(compraError);
        redirect(`/productos/${id_producto}/entrada?error=compra`);
      }

      const { data: detalleCompra, error: detalleError } = await supabase
        .from("detalle_compra")
        .insert({
          id_compra: compra.id_compra,
          id_producto,
          cantidad,
          costo_unitario: costoUnitario,
        })
        .select("id_detalle_compra")
        .single();

      if (detalleError || !detalleCompra) {
        console.error(detalleError);
        redirect(`/productos/${id_producto}/entrada?error=detalle`);
      }

      const { error: movimientoError } = await supabase
        .from("movimiento_producto")
        .insert({
          id_producto,
          id_detalle_compra: detalleCompra.id_detalle_compra,
          tipo_movimiento: "entrada_compra",
          cantidad,
          costo_unitario: costoUnitario,
          descripcion: descripcion || "Entrada por compra para stock",
          registrado_por: usuarioApp.id_usuario,
        });

      if (movimientoError) {
        console.error(movimientoError);
        redirect(`/productos/${id_producto}/entrada?error=movimiento`);
      }
    }

    revalidatePath("/productos");
    revalidatePath(`/productos/${id_producto}/entrada`);

    redirect("/productos");
  }

  return (
    <main className="page-shell">
      <section className="page-container max-w-3xl">
        <a
          href="/productos"
          className="inline-flex items-center rounded-xl px-2 py-1 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
        >
          ← Volver a productos
        </a>

        <div className="card mt-5 overflow-hidden">
          <div className="card-dark p-7">
            <p className="text-sm font-semibold text-emerald-100">
              Producto con stock
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Agregar entrada
            </h1>

            <p className="mt-3 text-sm leading-6 text-emerald-50">
              {producto.nombre_producto} · Stock actual:{" "}
              {numero(producto.stock_actual)} {producto.unidad_medida || ""}
            </p>
          </div>

          <form action={agregarEntrada} className="space-y-6 p-7">
            <div>
              <label className="label">Tipo de entrada *</label>
              <select
                name="tipo_entrada"
                required
                defaultValue=""
                className="input-field"
              >
                <option value="">Selecciona una opción</option>
                <option value="produccion">Producción propia</option>
                <option value="compra">Compra para stock</option>
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Cantidad *</label>
                <input
                  name="cantidad"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="Ej: 20"
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Costo por unidad *</label>
                <input
                  name="costo_unitario"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="Ej: 1.50"
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="label">
                Lugar de compra, si aplica
              </label>
              <input
                name="lugar_compra"
                placeholder="Ej: Vivero, proveedor, mercado..."
                className="input-field"
              />
            </div>

            <div>
              <label className="label">Fecha de compra / entrada</label>
              <input
                name="fecha_compra"
                type="date"
                defaultValue={hoy()}
                className="input-field"
              />
            </div>

            <div>
              <label className="label">Descripción</label>
              <textarea
                name="descripcion"
                rows={4}
                placeholder="Ej: producción semanal de abono, compra para reponer stock..."
                className="input-field"
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
              <a href="/productos" className="btn-secondary">
                Cancelar
              </a>

              <button type="submit" className="btn-primary">
                Guardar entrada
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}