import { lanzarErrorSupabase } from "@/lib/supabase/errors";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type BorradorTelegram = {
  id: string;
  tipo: "registro_trabajo" | "actualizar_pago";
  datos: unknown;
};

export async function enviarMensajeTelegram(
  chatId: string | number,
  texto: string
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("Falta la variable de entorno TELEGRAM_BOT_TOKEN.");
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto,
    }),
  });

  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`Error enviando Telegram: ${detalle}`);
  }
}

export function chatTelegramPermitido(chatId: string | number) {
  const permitidos = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!permitidos.length) {
    return true;
  }

  return permitidos.includes(String(chatId));
}

export function telegramAllowedChatIdsConfigurado() {
  return Boolean(process.env.TELEGRAM_ALLOWED_CHAT_IDS?.trim());
}

export async function obtenerBorradorTelegramPendiente(chatId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("telegram_borrador")
    .select("id, tipo, datos")
    .eq("chat_id", chatId)
    .eq("estado", "pendiente")
    .order("fecha_creacion", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    lanzarErrorSupabase(error);
  }

  return data as BorradorTelegram | null;
}

export async function crearBorradorTelegram(
  chatId: string,
  tipo: BorradorTelegram["tipo"],
  mensajeOriginal: string,
  datos: unknown
) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("telegram_borrador").insert({
    chat_id: chatId,
    tipo,
    mensaje_original: mensajeOriginal,
    datos,
    estado: "pendiente",
  });

  if (error) {
    lanzarErrorSupabase(error);
  }
}

export async function actualizarBorradorTelegram(
  id: string,
  estado: "pendiente" | "guardado" | "cancelado",
  datos?: unknown
) {
  const supabase = createServiceRoleClient();
  const update: Record<string, unknown> = {
    estado,
    fecha_actualizacion: new Date().toISOString(),
  };

  if (datos !== undefined) {
    update.datos = datos;
  }

  const { error } = await supabase
    .from("telegram_borrador")
    .update(update)
    .eq("id", id);

  if (error) {
    lanzarErrorSupabase(error);
  }
}
