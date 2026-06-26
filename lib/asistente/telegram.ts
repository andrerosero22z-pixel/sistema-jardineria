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
