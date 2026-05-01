import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (error) {
    console.error("Error en OAuth:", error, errorDescription);
    return NextResponse.redirect(`${requestUrl.origin}/login?error=oauth`);
  }

  if (code) {
    const supabase = await createClient();

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
    }

    console.error("Error al intercambiar sesión:", exchangeError.message);
  }

  return NextResponse.redirect(`${requestUrl.origin}/login?error=auth`);
}