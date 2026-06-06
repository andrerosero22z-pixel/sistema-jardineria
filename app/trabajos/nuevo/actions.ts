"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ServicioFormulario = {
  id_servicio: string;
  precio_servicio: string;
  descripcion?: string;
};

type ProductoFormulario = {
  id_producto: string;
  id_planta?: string;
  cantidad: string;
  costo_unitario: string;
  precio_venta_unitario: string;
  lugar_compra?: string;
};
type ProductoStockFormulario = {
  id_producto: string;
  cantidad: string;
  costo_unitario: string;
  precio_venta_unitario: string;
};


function sumarDias(fecha: string, dias: number) {
  const base = new Date(`${fecha}T00:00:00`);
  base.setDate(base.getDate() + dias);
  return base.toISOString().slice(0, 10);


}
function toMoney(value: string | number) {
  const normalized = String(value).replace(",", ".").trim();
  const number = Number(normalized);

  if (Number.isNaN(number)) {
    return NaN;
  }

  return Math.round(number * 100) / 100;
}






export async function crearTrabajo(formData: FormData) {
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
    redirect("/trabajos/nuevo?error=usuario");
  }

  const idPropiedad = String(formData.get("id_propiedad") || "").trim();
  const fechaServicio = String(formData.get("fecha_servicio") || "").trim();
  const notaTrabajo = String(formData.get("nota_trabajo") || "").trim();
  const estadoPago = String(formData.get("estado_pago") || "pendiente");
  const metodoPago = String(formData.get("metodo_pago") || "").trim();

  const recordatorioOpcion = String(
  formData.get("recordatorio_opcion") || "none"
).trim();

const fechaRecordatorioManual = String(
  formData.get("fecha_recordatorio") || ""
).trim();

const mensajeRecordatorio = String(
  formData.get("mensaje_recordatorio") || ""
).trim();

  const serviciosRaw = String(formData.get("servicios_json") || "[]");
  const productosRaw = String(formData.get("productos_json") || "[]");
  const productosStockRaw = String(formData.get("productos_stock_json") || "[]");
  

  let servicios: ServicioFormulario[] = [];
  let productos: ProductoFormulario[] = [];
  let productosStock: ProductoStockFormulario[] = [];

  try {
    servicios = JSON.parse(serviciosRaw);
    productos = JSON.parse(productosRaw);
    productosStock = JSON.parse(productosStockRaw);
  } catch {
    redirect("/trabajos/nuevo?error=json");
  }

  const serviciosValidos = servicios
    .map((servicio) => ({
      id_servicio: servicio.id_servicio?.trim(),
      precio_servicio: toMoney(servicio.precio_servicio),
      descripcion: servicio.descripcion?.trim() || null,
    }))
    .filter(
      (servicio) =>
        servicio.id_servicio &&
        !Number.isNaN(servicio.precio_servicio) &&
        servicio.precio_servicio >= 0
    );

  const productosValidos = productos
    .map((producto) => ({
      id_producto: producto.id_producto?.trim(),
      id_planta: producto.id_planta?.trim() || null,
      cantidad: Number(producto.cantidad),
      costo_unitario: toMoney(producto.costo_unitario),
    precio_venta_unitario: toMoney(producto.precio_venta_unitario),
      lugar_compra: producto.lugar_compra?.trim() || null,
    }))
    .filter(
      (producto) =>
        producto.id_producto &&
        !Number.isNaN(producto.cantidad) &&
        !Number.isNaN(producto.costo_unitario) &&
        !Number.isNaN(producto.precio_venta_unitario) &&
        producto.cantidad > 0 &&
        producto.costo_unitario >= 0 &&
        producto.precio_venta_unitario >= 0
    );
    const productosStockValidos = productosStock
  .map((producto) => ({
    id_producto: producto.id_producto?.trim(),
    cantidad: Number(producto.cantidad),
    costo_unitario: toMoney(producto.costo_unitario),
    precio_venta_unitario: toMoney(producto.precio_venta_unitario),
  }))
  .filter(
    (producto) =>
      producto.id_producto &&
      !Number.isNaN(producto.cantidad) &&
      !Number.isNaN(producto.costo_unitario) &&
      !Number.isNaN(producto.precio_venta_unitario) &&
      producto.cantidad > 0 &&
      producto.costo_unitario >= 0 &&
      producto.precio_venta_unitario >= 0
  );

  if (!idPropiedad || !fechaServicio || serviciosValidos.length === 0) {
    redirect("/trabajos/nuevo?error=campos");
  }

  const { data: orden, error: ordenError } = await supabase
    .from("orden_servicio")
    .insert({
      id_propiedad: idPropiedad,
      fecha_servicio: fechaServicio,
      nota_trabajo: notaTrabajo || null,
      creado_por: usuarioApp.id_usuario,
      estado_pago: "pendiente",
      estado_orden: "realizada",
    })
    .select("id_orden")
    .single();

  if (ordenError || !orden) {
    console.error(ordenError);
    redirect("/trabajos/nuevo?error=orden");
  }

  const detallesServicio = serviciosValidos.map((servicio) => ({
    id_orden: orden.id_orden,
    id_servicio: servicio.id_servicio,
    descripcion: servicio.descripcion,
    precio_servicio: servicio.precio_servicio,
  }));

  const { error: detalleError } = await supabase
    .from("detalle_servicio")
    .insert(detallesServicio);

  if (detalleError) {
    console.error(detalleError);
    redirect("/trabajos/nuevo?error=detalle");
  }

  for (const producto of productosValidos) {
    const { data: compra, error: compraError } = await supabase
      .from("compra")
      .insert({
        id_orden: orden.id_orden,
        fecha_compra: fechaServicio,
        lugar_compra: producto.lugar_compra,
        registrado_por: usuarioApp.id_usuario,
      })
      .select("id_compra")
      .single();

    if (compraError || !compra) {
      console.error(compraError);
      redirect("/trabajos/nuevo?error=compra");
    }

    const { data: detalleCompra, error: detalleCompraError } = await supabase
      .from("detalle_compra")
      .insert({
        id_compra: compra.id_compra,
        id_producto: producto.id_producto,
        cantidad: producto.cantidad,
        costo_unitario: producto.costo_unitario,
      })
      .select("id_detalle_compra")
      .single();

    if (detalleCompraError || !detalleCompra) {
      console.error(detalleCompraError);
      redirect("/trabajos/nuevo?error=detalle_compra");
    }

    const { error: productoOrdenError } = await supabase
      .from("producto_orden")
      .insert({
        id_orden: orden.id_orden,
        id_producto: producto.id_producto,
        id_planta: producto.id_planta,
        id_detalle_compra: detalleCompra.id_detalle_compra,
        cantidad: producto.cantidad,
        precio_venta_unitario: producto.precio_venta_unitario,
      });

    if (productoOrdenError) {
      console.error(productoOrdenError);
      redirect("/trabajos/nuevo?error=producto_orden");
    }
  }

  for (const producto of productosStockValidos) {
  const { data: movimiento, error: movimientoError } = await supabase
    .from("movimiento_producto")
    .insert({
      id_producto: producto.id_producto,
      id_orden: orden.id_orden,
      tipo_movimiento: "salida_orden",
      cantidad: producto.cantidad,
      costo_unitario: producto.costo_unitario,
      descripcion: "Salida de stock usada en trabajo",
      registrado_por: usuarioApp.id_usuario,
    })
    .select("id_movimiento")
    .single();

  if (movimientoError || !movimiento) {
    console.error(movimientoError);
    redirect("/trabajos/nuevo?error=stock");
  }

}
let fechaRecordatorio: string | null = null;

if (recordatorioOpcion !== "none") {
  if (recordatorioOpcion === "custom") {
    if (!fechaRecordatorioManual) {
      redirect("/trabajos/nuevo?error=recordatorio");
    }

    fechaRecordatorio = fechaRecordatorioManual;
  } else {
    const dias = Number(recordatorioOpcion);

    if ([15, 30, 60, 90].includes(dias)) {
      fechaRecordatorio = sumarDias(fechaServicio, dias);
    }
  }

  if (fechaRecordatorio) {
    const { error: recordatorioError } = await supabase
      .from("recordatorio")
      .insert({
        id_orden: orden.id_orden,
        fecha_recordatorio: fechaRecordatorio,
        mensaje:
          mensajeRecordatorio ||
          "Recordatorio de seguimiento del servicio realizado.",
        estado_recordatorio: "pendiente",
        creado_por: usuarioApp.id_usuario,
      });

    if (recordatorioError) {
      console.error(recordatorioError);
      redirect("/trabajos/nuevo?error=recordatorio");
    }
  }
}


  if (estadoPago === "pagado") {
    const { data: ordenConTotal } = await supabase
      .from("orden_servicio")
      .select("total_general")
      .eq("id_orden", orden.id_orden)
      .single();

    const total = Number(ordenConTotal?.total_general || 0);

    if (!metodoPago) {
      redirect("/trabajos/nuevo?error=metodo");
    }

    const { error: pagoError } = await supabase.from("pago").insert({
      id_orden: orden.id_orden,
      fecha_pago: fechaServicio,
      monto_pagado: total,
      metodo_pago: metodoPago,
      registrado_por: usuarioApp.id_usuario,
    });

    if (pagoError) {
      console.error(pagoError);
      redirect("/trabajos/nuevo?error=pago");
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/clientes");

  redirect(`/trabajos/${orden.id_orden}`);
}