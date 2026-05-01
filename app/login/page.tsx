"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient();

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-green-50 px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-green-900">
          Sistema de Jardinería
        </h1>

        <p className="mt-3 text-sm text-gray-600">
          Inicia sesión con Google para entrar al sistema.
        </p>

        <button
          onClick={handleGoogleLogin}
          className="mt-6 w-full rounded-xl bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800"
        >
          Iniciar sesión con Google
        </button>
      </section>
    </main>
  );
}