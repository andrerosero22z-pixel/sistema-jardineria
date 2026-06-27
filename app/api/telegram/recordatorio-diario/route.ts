import { NextResponse } from "next/server";
import { enviarMensajeTelegram } from "@/lib/asistente/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MENSAJE_RECORDATORIO = `🌿 Recordatorio de registro diario

No te olvides de registrar los trabajos realizados hoy.

Puedes escribirlo así:

Cliente:
Propiedad o sector:
Fecha:
Servicios realizados:

* Servicio 1: $...
* Servicio 2: $...

Productos usados o vendidos:

* Producto: cantidad, costo y precio de venta

Pago:

* Pagó todo / quedó pendiente
* Forma de pago: efectivo o transferencia

Recordatorio:

* No quiero recordatorio
* O: recuérdame en 15 días

Ejemplo:

Sra Paulina, hoy se hizo mantenimiento general por 75 dólares. Pagó todo por transferencia. No quiero recordatorio.

O:

Dr Fernando, hoy se hizo limpieza de reservorio por 50. Se usaron 100 algas, costaron 15 en total y se cobraron a 0.50 cada una. Quedó pendiente. Recuérdame en 30 días.

Luego el bot interpretará el mensaje y pedirá confirmación antes de guardar.`;

function obtenerChatsPermitidos() {
  return (process.env.TELEGRAM_ALLOWED_CHAT_IDS || "")
    .split(",")
    .map((chatId) => chatId.trim())
    .filter(Boolean);
}

export async function GET(req: Request) {
  const authorization = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, error: "No autorizado." },
      { status: 401 }
    );
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "Falta TELEGRAM_BOT_TOKEN." },
      { status: 500 }
    );
  }

  const chatIds = obtenerChatsPermitidos();

  if (chatIds.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "TELEGRAM_ALLOWED_CHAT_IDS está vacío. No se envió el recordatorio.",
      },
      { status: 400 }
    );
  }

  const resultados = await Promise.allSettled(
    chatIds.map((chatId) => enviarMensajeTelegram(chatId, MENSAJE_RECORDATORIO))
  );
  const enviados = resultados.filter(
    (resultado) => resultado.status === "fulfilled"
  ).length;
  const fallidos = resultados
    .map((resultado, index) => ({ resultado, chatId: chatIds[index] }))
    .filter(({ resultado }) => resultado.status === "rejected")
    .map(({ resultado, chatId }) => ({
      chatId,
      error:
        resultado.status === "rejected"
          ? resultado.reason instanceof Error
            ? resultado.reason.message
            : String(resultado.reason)
          : "",
    }));

  if (fallidos.length > 0) {
    console.error("Errores enviando recordatorio Telegram:", fallidos);
  }

  return NextResponse.json(
    {
      ok: fallidos.length === 0,
      enviados,
      fallidos,
    },
    { status: fallidos.length === 0 ? 200 : 500 }
  );
}
