export function detalleError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message) {
      return message;
    }
  }

  return JSON.stringify(error);
}

export function lanzarErrorSupabase(error: unknown): never {
  console.error("Error Supabase:", JSON.stringify(error, null, 2));
  throw new Error(detalleError(error));
}
