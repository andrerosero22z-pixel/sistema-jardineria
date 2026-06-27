import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export async function createApiSupabaseClient(req: Request) {
  if (esCanalChat(req)) {
    return createServiceRoleClient();
  }

  return createClient();
}

export function esCanalChat(req: Request) {
  const canal = req.headers.get("x-asistente-canal");
  const internalKey = req.headers.get("x-asistente-internal-key");

  return (
    (canal === "telegram" || canal === "whatsapp") &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    internalKey === process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
