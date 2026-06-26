export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response("whatsapp ping ok", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}