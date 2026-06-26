import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  console.log("Verificando webhook WhatsApp:", {
    mode,
    verifyToken,
    challenge,
    envToken: process.env.WHATSAPP_VERIFY_TOKEN ? "existe" : "no existe",
  });

  if (
    mode === "subscribe" &&
    verifyToken === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    console.log("Webhook WhatsApp recibido:", JSON.stringify(payload, null, 2));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en POST webhook WhatsApp:", error);

    return NextResponse.json(
      { ok: false, error: "Error procesando webhook" },
      { status: 500 }
    );
  }
}