export async function enviarMensajeWhatsApp(numero: string, mensaje: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error("Faltan variables de entorno de WhatsApp.");
  }

  const res = await fetch(
    `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: numero,
        type: "text",
        text: {
          body: mensaje,
        },
      }),
    }
  );

  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`Error enviando WhatsApp: ${detalle}`);
  }
}

export function numeroPermitido(numero: string) {
  const permitidos = (process.env.WHATSAPP_ALLOWED_NUMBERS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return permitidos.includes(numero);
}
