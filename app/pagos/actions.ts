"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function marcarComoPagado(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const idOrden = String(formData.get("id_orden") || "").trim();
  const metodoPago = String(formData.get("metodo_pago") || "").trim();

  if (!idOrden || !metodoPago) {
    redirect("/pagos?error=campos");
  }

  const { data: usuarioApp } = await supabase
    .from("usuario_app")
    .select("id_usuario")
    .eq("auth_user_id", user.id)
    .single();

  if (!usuarioApp) {
    redirect("/pagos?error=usuario");
  }

  const { data: orden } = await supabase
    .from("orden_servicio")
    .select("id_orden, total_general, estado_pago")
    .eq("id_orden", idOrden)
    .single();

  if (!orden || orden.estado_pago === "pagado") {
    redirect("/pagos?error=orden");
  }

  const hoy = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("pago").insert({
    id_orden: idOrden,
    fecha_pago: hoy,
    monto_pagado: orden.total_general,
    metodo_pago: metodoPago,
    registrado_por: usuarioApp.id_usuario,
  });

  if (error) {
    console.error(error);
    redirect("/pagos?error=pago");
  }

  revalidatePath("/pagos");
  revalidatePath(`/trabajos/${idOrden}`);

  redirect("/pagos?ok=1");
}