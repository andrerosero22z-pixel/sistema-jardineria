"use client";

import { useState } from "react";
import Link from "next/link";

type ServicioIA = {
  nombre: string;
  categoria: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
};

type ProductoIA = {
  nombre: string;
  tipo: string;
  lugar_compra: string;
  cantidad: number;
  costo_unitario: number;
  subtotal_costo: number;
  precio_venta_unitario: number;
  subtotal_venta: number;
  ganancia_producto: number;
  producto_en_catalogo?: boolean;
  id_producto?: string | null;
};

type RespuestaIA = {
  fecha_trabajo: string;
  cliente_nombre: string;
  propiedad_o_sector: string;
  servicios: ServicioIA[];
  productos: ProductoIA[];
  total: number;
  pagado: number;
  pendiente: number;
  forma_pago: string;
  observaciones: string;
  recordatorio: string;
  faltan_bloqueantes: string[];
  faltan_opcionales: string[];
  pregunta_siguiente: string;
  listo_para_confirmar: boolean;
  cliente_id?: string | null;
clientes_posibles?: ClientePosible[];

propiedad_id?: string | null;
propiedades_posibles?: PropiedadPosible[];

puede_guardar?: boolean;

};
type ClientePosible = {
  id: string;
  nombre: string;
  telefono?: string | null;
};

type PropiedadPosible = {
  id: string;
  nombre?: string | null;
  direccion?: string | null;
  sector?: string | null;
};

type ConsultaDirecta = {
  tipo: "consultar_pagos" | "consultar_recordatorios" | "desconocido";
  respuesta: string;
  datos: unknown[];
};

function mensajeError(error: unknown) {
  return error instanceof Error ? error.message : "Error inesperado";
}

export default function RegistrarTrabajoIA() {
  const [mensaje, setMensaje] = useState("");
  const [respuesta, setRespuesta] = useState<RespuestaIA | null>(null);
  const [consultaDirecta, setConsultaDirecta] =
    useState<ConsultaDirecta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [correccion, setCorreccion] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function analizarConIA() {
    setCargando(true);
    setError("");
    setRespuesta(null);
    setConsultaDirecta(null);

    try {
      const consultaRes = await fetch("/api/ia/consultar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mensaje }),
      });

      const consultaData = await consultaRes.json();

      if (!consultaRes.ok) {
        throw new Error(
          consultaData.detalle || consultaData.error || "Error al consultar"
        );
      }

      if (
        consultaData.tipo === "consultar_pagos" ||
        consultaData.tipo === "consultar_recordatorios" ||
        consultaData.tipo === "desconocido"
      ) {
        setConsultaDirecta(consultaData);
        return;
      }

      const res = await fetch("/api/ia/interpretar-trabajo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mensaje }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detalle || data.error || "Error al usar la IA");
      }

      setRespuesta(data);
    } catch (err: unknown) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  async function actualizarBorradorConIA() {
  if (!respuesta || correccion.trim().length === 0) return;

  setCargando(true);
  setError("");

  try {
    const res = await fetch("/api/ia/interpretar-trabajo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mensaje: correccion,
        borradorActual: respuesta,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detalle || data.error || "Error al actualizar con IA");
    }

    setRespuesta(data);
    setCorreccion("");
  } catch (err: unknown) {
    setError(mensajeError(err));
  } finally {
    setCargando(false);
  }
}

async function guardarTrabajo() {
  if (!respuesta) return;

  const confirmar = window.confirm(
    `¿Seguro que deseas guardar este trabajo?

Cliente: ${respuesta.cliente_nombre}
Propiedad: ${respuesta.propiedad_o_sector || "No indicada"}
Total: $${respuesta.total}
Pagado: $${respuesta.pagado}
Pendiente: $${respuesta.pendiente}

Aceptar = Guardar
Cancelar = Seguir editando`
  );

  if (!confirmar) {
    return;
  }

  setGuardando(true);
  setError("");

  try {
    const res = await fetch("/api/ia/guardar-trabajo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        borrador: respuesta,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detalle || data.error || "Error al guardar");
    }

    alert("Trabajo guardado correctamente");

    setMensaje("");
    setRespuesta(null);
    setConsultaDirecta(null);
    setCorreccion("");
  } catch (err: unknown) {
    setError(mensajeError(err));
  } finally {
    setGuardando(false);
  }
}

  return (
    <main className="min-h-screen bg-green-50 px-4 py-8">
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 rounded-2xl bg-white p-6 shadow">

        <Link
            href="/dashboard"
            className="mb-3 inline-block text-sm font-semibold text-green-800 hover:underline"
          >
            ← Volver al panel
          </Link>
        
        <p className="text-sm font-semibold text-green-700">
          Sistema de jardinería familiar
        </p>
        <h1 className="text-3xl font-bold text-green-950">
          Asistente de jardiner&iacute;a
        </h1>
        <p className="mt-2 text-gray-600">
          Escribe como hablarías normalmente. Puedes registrar trabajos,
          consultar pagos pendientes o revisar recordatorios.
        </p>
      </div>

        <div className="rounded-xl bg-white p-4 shadow">
          <label className="mb-2 block font-semibold text-gray-700">
            Cuéntame qué necesitas
          </label>

          <textarea
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-green-700"
            placeholder="Ejemplo: Hoy donde Don Fernando mantenimiento 80, botada de basura 20 y pagó todo"
          />

         <button
            onClick={analizarConIA}
            disabled={cargando || mensaje.trim().length === 0}
            className="mt-4 rounded-xl bg-green-800 px-5 py-3 font-semibold text-white shadow hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {cargando ? "Analizando..." : "Consultar / Registrar"}
          </button>

          {error && (
            <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">
              {error}
            </div>
          )}
        </div>

        {consultaDirecta && (
          <div className="mt-5 rounded-xl bg-white p-4 shadow">
            <h2 className="mb-3 text-xl font-bold text-green-800">
              Respuesta del asistente
            </h2>

            <p className="whitespace-pre-line break-words text-sm leading-6 text-gray-700">
              {consultaDirecta.respuesta}
            </p>
          </div>
        )}

        {respuesta && (
          <div className="mt-5 rounded-xl bg-white p-4 shadow">
            <h2 className="mb-3 text-xl font-bold text-green-800">
              Resumen detectado
            </h2>

            <div className="grid gap-2 text-sm">
              <p>
                <strong>Fecha:</strong> {respuesta.fecha_trabajo || "No detectada"}
              </p>
              <p>
                <strong>Cliente:</strong> {respuesta.cliente_nombre || "No detectado"}
              </p>
              <p>
                <strong>Propiedad o sector:</strong>{" "}
                {respuesta.propiedad_o_sector || "No indicado"}
              </p>
            </div>

            <div className="mt-4">
              <h3 className="font-semibold text-gray-800">Servicios</h3>

              {respuesta.servicios.length === 0 ? (
                <p className="text-sm text-gray-500">No se detectaron servicios.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full border text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border p-2 text-left">Servicio</th>
                        <th className="border p-2 text-left">Categoría</th>
                        <th className="border p-2 text-right">Cant.</th>
                        <th className="border p-2 text-right">P. Unit.</th>
                        <th className="border p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {respuesta.servicios.map((servicio, index) => (
                        <tr key={index}>
                          <td className="border p-2">{servicio.nombre}</td>
                          <td className="border p-2">{servicio.categoria}</td>
                          <td className="border p-2 text-right">
                            {servicio.cantidad}
                          </td>
                          <td className="border p-2 text-right">
                            ${servicio.precio_unitario}
                          </td>
                          <td className="border p-2 text-right">
                            ${servicio.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            

            {respuesta.productos.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-gray-800">Productos</h3>

                <div className="mt-2 overflow-x-auto">
                 <table className="w-full border text-sm">
  <thead className="bg-gray-100">
    <tr>
      <th className="border p-2 text-left">Producto</th>
      <th className="border p-2 text-left">Tipo</th>
      <th className="border p-2 text-right">Cant.</th>
      <th className="border p-2 text-right">Costo unit.</th>
      <th className="border p-2 text-right">Costo total</th>
      <th className="border p-2 text-right">Venta unit.</th>
      <th className="border p-2 text-right">Venta total</th>
      <th className="border p-2 text-right">Ganancia</th>
    </tr>
  </thead>

  <tbody>
    {respuesta.productos.map((producto, index) => (
      <tr key={index}>
        <td className="border p-2">{producto.nombre}</td>
        <td className="border p-2">{producto.tipo}</td>
        <td className="border p-2 text-right">{producto.cantidad}</td>
        <td className="border p-2 text-right">
          ${Number(producto.costo_unitario || 0).toFixed(2)}
        </td>
        <td className="border p-2 text-right">
          ${Number(producto.subtotal_costo || 0).toFixed(2)}
        </td>
        <td className="border p-2 text-right">
          ${Number(producto.precio_venta_unitario || 0).toFixed(2)}
        </td>
        <td className="border p-2 text-right">
          ${Number(producto.subtotal_venta || 0).toFixed(2)}
        </td>
        <td className="border p-2 text-right">
          ${Number(producto.ganancia_producto || 0).toFixed(2)}
        </td>
      </tr>
    ))}
  </tbody>
</table>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-lg bg-gray-50 p-3">
              <p>
                <strong>Total:</strong> ${respuesta.total}
              </p>
              <p>
                <strong>Pagado:</strong> ${respuesta.pagado}
              </p>
              <p>
                <strong>Pendiente:</strong> ${respuesta.pendiente}
              </p>
              <p>
                <strong>Forma de pago:</strong>{" "}
                {respuesta.forma_pago || "No indicada"}
              </p>
            </div>

            {respuesta.faltan_bloqueantes.length > 0 && (
              <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3">
                <h3 className="font-semibold text-red-700">
                  Falta información obligatoria
                </h3>
                <ul className="mt-2 list-disc pl-5 text-sm text-red-700">
                  {respuesta.faltan_bloqueantes.map((dato, index) => (
                    <li key={index}>{dato}</li>
                  ))}
                </ul>
              </div>
            )}

            {respuesta.faltan_opcionales.length > 0 && (
              <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3">
                <h3 className="font-semibold text-yellow-800">
                  Datos opcionales que faltan
                </h3>
                <ul className="mt-2 list-disc pl-5 text-sm text-yellow-800">
                  {respuesta.faltan_opcionales.map((dato, index) => (
                    <li key={index}>{dato}</li>
                  ))}
                </ul>
              </div>
            )}
            {respuesta.clientes_posibles && respuesta.clientes_posibles.length > 1 && (
  <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3">
    <h3 className="font-semibold text-yellow-800">
      Clientes parecidos encontrados
    </h3>

    <div className="mt-2 space-y-2">
      {respuesta.clientes_posibles.map((cliente) => (
        <button
          key={cliente.id}
          className="block w-full rounded-lg border bg-white p-2 text-left hover:bg-yellow-100"
        >
          <strong>{cliente.nombre}</strong>
          {cliente.telefono && (
            <span className="ml-2 text-sm text-gray-600">
              {cliente.telefono}
            </span>
          )}
        </button>
      ))}
    </div>
  </div>
)}
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
  <label className="mb-2 block font-semibold text-green-950">
    ¿Deseas agregar o corregir algo?
  </label>

  <textarea
    value={correccion}
    onChange={(e) => setCorreccion(e.target.value)}
    rows={3}
    className="w-full rounded-lg border border-green-300 p-3 outline-none focus:border-green-700"
    placeholder="Ejemplo: También se vendieron 3 plantas a 5 cada una y fue en Cumbayá"
  />

  <button
    onClick={actualizarBorradorConIA}
    disabled={cargando || correccion.trim().length === 0}
    className="mt-3 rounded-lg bg-green-800 px-4 py-2 font-semibold text-white hover:bg-green-900 disabled:bg-gray-400"
  >
    {cargando ? "Actualizando..." : "Actualizar resumen"}
  </button>
</div>

            <div className="mt-4 rounded-lg bg-green-50 p-3 text-green-900">
              {respuesta.pregunta_siguiente}
            </div>

            <div className="mt-4 flex gap-2">
             <button
              onClick={guardarTrabajo}
              disabled={!respuesta.puede_guardar || guardando}
              className="rounded-lg bg-green-800 px-4 py-2 font-semibold text-white disabled:bg-gray-400"
            >
              {guardando ? "Guardando..." : "Guardar trabajo"}
            </button>

              
            </div>


          </div>
        )}
      </div>
    </main>
  );
}
