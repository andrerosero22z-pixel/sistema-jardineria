"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-xl bg-emerald-900 px-4 py-3 text-center font-bold text-white hover:bg-emerald-950"
    >
      Descargar PDF
    </button>
  );
}