"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function cambiarEstadoRecordatorio(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const idRecordatorio = String(formData.get("id_recordatorio") || "").trim();
  const nuevoEstado = String(formData.get("estado_recordatorio") || "").trim();

  if (
    !idRecordatorio ||
    !["pendiente", "notificado", "cancelado"].includes(nuevoEstado)
  ) {
    redirect("/recordatorios?error=campos");
  }

  const { error } = await supabase
    .from("recordatorio")
    .update({
      estado_recordatorio: nuevoEstado,
    })
    .eq("id_recordatorio", idRecordatorio);

  if (error) {
    console.error(error);
    redirect("/recordatorios?error=guardar");
  }

  revalidatePath("/recordatorios");
  redirect("/recordatorios?ok=1");
}