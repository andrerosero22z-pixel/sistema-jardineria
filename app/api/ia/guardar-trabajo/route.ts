import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function numero(valor: any) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}
function sumarDiasFechaISO(fechaISO: string, dias: number) {
  const [year, month, day] = fechaISO.split("-").map(Number);

  const fecha = new Date(Date.UTC(year, month - 1, day));
  fecha.setUTCDate(fecha.getUTCDate() + dias);

  return fecha.toISOString().slice(0, 10);
}
function normalizarMetodoPago(metodo: string) {
  const m = (metodo || "").toLowerCase().trim();

  if (m.includes("transfer")) return "transferencia";
  if (m.includes("efectivo")) return "efectivo";
  if (m.includes("deposit")) return "deposito";
  if (m.includes("depósito")) return "deposito";

  return "";
}

async function obtenerOCrearServicio(supabase: any, nombreServicio: string) {
  const nombre = (nombreServicio || "").trim();

  if (!nombre) {
    throw new Error("Servicio sin nombre.");
  }

  const { data: existente, error: errorBuscar } = await supabase
    .from("servicio")
    .select("id_servicio, nombre_servicio")
    .ilike("nombre_servicio", `%${nombre}%`)
    .limit(1)
    .maybeSingle();

  if (errorBuscar) {
    throw errorBuscar;
  }

  if (existente) {
    return existente.id_servicio;
  }

  const { data: nuevo, error: errorCrear } = await supabase
    .from("servicio")
    .insert({
      nombre_servicio: nombre,
      descripcion: "Creado automáticamente desde registro con IA",
    })
    .select("id_servicio")
    .single();

  if (errorCrear) {
    throw errorCrear;
  }

  return nuevo.id_servicio;
}

async function obtenerProductoParaOrden(supabase: any, producto: any) {
  if (producto.id_producto) {
    return producto.id_producto;
  }

  const nombre = (producto.nombre || "").trim();

  if (nombre) {
    const { data: encontrado, error } = await supabase
      .from("producto")
      .select("id_producto, nombre_producto")
      .ilike("nombre_producto", `%${nombre}%`)
      .eq("estado_producto", "activo")
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (encontrado) {
      return encontrado.id_producto;
    }
  }

  const { data: otro, error: errorOtro } = await supabase
    .from("producto")
    .select("id_producto, nombre_producto")
    .ilike("nombre_producto", `%Otro producto%`)
    .eq("estado_producto", "activo")
    .limit(1)
    .maybeSingle();

  if (errorOtro) {
    throw errorOtro;
  }

  if (!otro) {
    throw new Error(
      `No se encontró el producto "${nombre}" ni existe "Otro producto".`
    );
  }

  return otro.id_producto;
}

export async function POST(req: Request) {
  try {
    const { borrador } = await req.json();

    if (!borrador) {
      return NextResponse.json(
        { error: "No se recibió el borrador del trabajo." },
        { status: 400 }
      );
    }

    if (!borrador.cliente_id) {
      return NextResponse.json(
        { error: "Falta resolver el cliente real." },
        { status: 400 }
      );
    }

    if (!borrador.propiedad_id) {
      return NextResponse.json(
        { error: "Falta resolver la propiedad real." },
        { status: 400 }
      );
    }

    if (!borrador.fecha_trabajo) {
      return NextResponse.json(
        { error: "Falta la fecha del trabajo." },
        { status: 400 }
      );
    }

    if (!borrador.servicios || borrador.servicios.length === 0) {
      return NextResponse.json(
        { error: "Debe existir al menos un servicio." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: errorUser,
    } = await supabase.auth.getUser();

    if (errorUser || !user) {
      return NextResponse.json(
        { error: "No hay usuario autenticado." },
        { status: 401 }
      );
    }

    const { data: usuarioApp, error: errorUsuarioApp } = await supabase
      .from("usuario_app")
      .select("id_usuario")
      .eq("auth_user_id", user.id)
      .single();

    if (errorUsuarioApp || !usuarioApp) {
      return NextResponse.json(
        { error: "No se encontró el usuario interno del sistema." },
        { status: 400 }
      );
    }

    const servicios = borrador.servicios || [];
    const productos = borrador.productos || [];

    const totalServicios = servicios.reduce(
      (sum: number, servicio: any) => sum + numero(servicio.total),
      0
    );

    const totalProductosVenta = productos.reduce(
      (sum: number, producto: any) => sum + numero(producto.subtotal_venta),
      0
    );

    const totalProductosCosto = productos.reduce(
      (sum: number, producto: any) => sum + numero(producto.subtotal_costo),
      0
    );

    const gananciaProductos = totalProductosVenta - totalProductosCosto;
    const totalGeneral = totalServicios + totalProductosVenta;

    const pagado = numero(borrador.pagado);
    const pendiente = numero(borrador.pendiente);

    const metodoPago = normalizarMetodoPago(borrador.forma_pago);

    if (pagado > 0 && !metodoPago) {
      return NextResponse.json(
        {
          error:
            "El trabajo tiene pago registrado, pero falta la forma de pago.",
        },
        { status: 400 }
      );
    }

    const estadoPago = pendiente > 0 ? "pendiente" : "pagado";

    const notaServicios = servicios
      .map(
        (s: any) =>
          `${s.nombre} - Categoría: ${s.categoria || "sin categoría"} - Cantidad: ${s.cantidad} - Total: $${s.total}`
      )
      .join("\n");

    const notaProductos = productos
      .map(
        (p: any) =>
          `${p.nombre}${p.producto_original && p.producto_original !== p.nombre ? ` (${p.producto_original})` : ""} - Cantidad: ${p.cantidad} - Costo total: $${p.subtotal_costo} - Venta total: $${p.subtotal_venta} - Ganancia: $${p.ganancia_producto}`
      )
      .join("\n");

    const notaTrabajo = [
      "Registrado con IA.",
      borrador.observaciones ? `Observaciones: ${borrador.observaciones}` : "",
      borrador.forma_pago ? `Forma de pago: ${borrador.forma_pago}` : "",
      "Servicios:",
      notaServicios,
      productos.length > 0 ? "Productos:" : "",
      productos.length > 0 ? notaProductos : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { data: orden, error: errorOrden } = await supabase
      .from("orden_servicio")
      .insert({
        id_propiedad: borrador.propiedad_id,
        fecha_servicio: borrador.fecha_trabajo,
        estado_pago: estadoPago,
        total_servicios: totalServicios,
        total_productos_venta: totalProductosVenta,
        total_productos_costo: totalProductosCosto,
        total_general: totalGeneral,
        ganancia_productos: gananciaProductos,
        nota_trabajo: notaTrabajo,
        creado_por: usuarioApp.id_usuario,
      })
      .select("id_orden")
      .single();

    if (errorOrden) {
      throw errorOrden;
    }

    const diasRecordatorio = Number(borrador.recordatorio_dias || 0);

let fechaRecordatorio = borrador.fecha_recordatorio || "";

if (!fechaRecordatorio && diasRecordatorio > 0) {
  fechaRecordatorio = sumarDiasFechaISO(
    borrador.fecha_trabajo,
    diasRecordatorio
  );
}

if (fechaRecordatorio) {
  const mensajeRecordatorio =
    borrador.mensaje_recordatorio ||
    borrador.recordatorio ||
    `Recordatorio del trabajo realizado el ${borrador.fecha_trabajo}`;

  const { error: errorRecordatorio } = await supabase
  .from("recordatorio")
  .insert({
    id_orden: orden.id_orden,
    fecha_recordatorio: fechaRecordatorio,
    mensaje: mensajeRecordatorio,
    estado_recordatorio: "pendiente",
    creado_por: usuarioApp.id_usuario,
  });



  if (errorRecordatorio) {
    throw new Error(`Error guardando recordatorio: ${errorRecordatorio.message}`);
  }
}

    for (const servicio of servicios) {
      const idServicio = await obtenerOCrearServicio(supabase, servicio.nombre);

      const { error: errorDetalle } = await supabase
        .from("detalle_servicio")
        .insert({
          id_orden: orden.id_orden,
          id_servicio: idServicio,
          descripcion: servicio.categoria || null,
          precio_servicio: numero(servicio.total),
        });

      if (errorDetalle) {
        throw errorDetalle;
      }
    }

    let compraCreada: any = null;

    if (productos.length > 0 && totalProductosCosto > 0) {
      const lugarCompra =
        productos.find((p: any) => p.lugar_compra && p.lugar_compra.trim())
          ?.lugar_compra || null;

      const { data: compra, error: errorCompra } = await supabase
        .from("compra")
        .insert({
          id_orden: orden.id_orden,
          fecha_compra: borrador.fecha_trabajo,
          lugar_compra: lugarCompra,
          total_compra: totalProductosCosto,
          registrado_por: usuarioApp.id_usuario,
        })
        .select("id_compra")
        .single();

      if (errorCompra) {
        throw errorCompra;
      }

      compraCreada = compra;
    }

    for (const producto of productos) {
      const idProducto = await obtenerProductoParaOrden(supabase, producto);

      let detalleCompraId: string | null = null;

      if (compraCreada && numero(producto.subtotal_costo) > 0) {
        const { data: detalleCompra, error: errorDetalleCompra } =
          await supabase
            .from("detalle_compra")
            .insert({
              id_compra: compraCreada.id_compra,
              id_producto: idProducto,
              cantidad: numero(producto.cantidad),
              costo_unitario: numero(producto.costo_unitario),
            })
            .select("id_detalle_compra")
            .single();

        if (errorDetalleCompra) {
          throw errorDetalleCompra;
        }

        detalleCompraId = detalleCompra.id_detalle_compra;
      }

      const { error: errorProductoOrden } = await supabase
        .from("producto_orden")
        .insert({
          id_orden: orden.id_orden,
          id_producto: idProducto,
          id_detalle_compra: detalleCompraId,
          cantidad: numero(producto.cantidad),
          costo_unitario_aplicado: numero(producto.costo_unitario),
          precio_venta_unitario: numero(producto.precio_venta_unitario),
          
        });

      if (errorProductoOrden) {
        throw errorProductoOrden;
      }
    }

    if (pagado > 0) {
      const { error: errorPago } = await supabase.from("pago").insert({
        id_orden: orden.id_orden,
        fecha_pago: borrador.fecha_trabajo,
        monto_pagado: pagado,
        metodo_pago: metodoPago,
        registrado_por: usuarioApp.id_usuario,
      });

      if (errorPago) {
        throw errorPago;
      }
    }

    return NextResponse.json({
      ok: true,
      id_orden: orden.id_orden,
      mensaje: "Trabajo guardado correctamente.",
    });
  } catch (error: any) {
    console.error("Error guardando trabajo IA:", error);

    return NextResponse.json(
      {
        error: "Error al guardar el trabajo.",
        detalle: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}