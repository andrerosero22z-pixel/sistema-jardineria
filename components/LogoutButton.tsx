import { cerrarSesion } from "@/app/actions/auth";

export default function LogoutButton() {
  return (
    <form action={cerrarSesion}>
      <button
        type="submit"
        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
      >
        Cerrar sesión
      </button>
    </form>
  );
}