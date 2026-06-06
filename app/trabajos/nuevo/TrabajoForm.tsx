"use client";

import { useMemo, useState } from "react";
import { crearTrabajo } from "./actions";

type Propiedad = {
  id_propiedad: string;
  nombre_propiedad: string;
  ciudad: string | null;
  sector: string | null;
  direccion: string;
};

type Cliente = {
  id_cliente: string;
  nombre: string;
  telefono: string | null;
  propiedad: Propiedad[];
};

type Servicio = {
  id_servicio: string;
  nombre_servicio: string;
};

type ServicioFila = {
  fila_id: string;
  id_servicio: string;
  precio_servicio: string;
  descripcion: string;
};

type TrabajoFormProps = {
  clientes: Cliente[];
  servicios: Servicio[];
  productos: Producto[];
  plantas: Planta[];
};

type Producto = {
  id_producto: string;
  nombre_producto: string;
  categoria: string;
  controla_stock: boolean;
  stock_actual: number;
  unidad_medida: string | null;
};
type Planta = {
  id_planta: string;
  nombre_planta: string;
};

type ProductoFila = {
  fila_id: string;
  id_producto: string;
  id_planta: string;
  cantidad: string;
  costo_unitario: string;
  precio_venta_unitario: string;
  lugar_compra: string;
};
type ProductoStockFila = {
  fila_id: string;
  id_producto: string;
  cantidad: string;
  costo_unitario: string;
  precio_venta_unitario: string;
};

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function limpiarNumero(valor: string) {
  const limpio = valor.replace(",", ".").replace(/[^0-9.]/g, "");
  const partes = limpio.split(".");

  if (partes.length <= 2) {
    return limpio;
  }

  return `${partes[0]}.${partes.slice(1).join("")}`;
}

export default function TrabajoForm({
  clientes,
  servicios,
  productos,
  plantas,
}: TrabajoFormProps) {
  const [idCliente, setIdCliente] = useState("");
  const [estadoPago, setEstadoPago] = useState("pendiente");

  const [filasServicio, setFilasServicio] = useState<ServicioFila[]>([
    {
      fila_id: crypto.randomUUID(),
      id_servicio: "",
      precio_servicio: "",
      descripcion: "",
    },
  ]);
  const [filasProducto, setFilasProducto] = useState<ProductoFila[]>([]);
  const [filasProductoStock, setFilasProductoStock] = useState<
  ProductoStockFila[]
>([]);

  const clienteSeleccionado = useMemo(() => {
    return clientes.find((cliente) => cliente.id_cliente === idCliente);
  }, [clientes, idCliente]);

  const propiedades = clienteSeleccionado?.propiedad ?? [];
  const [recordatorioOpcion, setRecordatorioOpcion] = useState("none");

  function agregarServicio() {
    setFilasServicio((actuales) => [
      ...actuales,
      {
        fila_id: crypto.randomUUID(),
        id_servicio: "",
        precio_servicio: "",
        descripcion: "",
      },
    ]);
  }

  function eliminarServicio(filaId: string) {
    setFilasServicio((actuales) =>
      actuales.length === 1
        ? actuales
        : actuales.filter((fila) => fila.fila_id !== filaId)
    );
  }

  function actualizarServicio(
    filaId: string,
    campo: keyof ServicioFila,
    valor: string
  ) {
    setFilasServicio((actuales) =>
      actuales.map((fila) =>
        fila.fila_id === filaId ? { ...fila, [campo]: valor } : fila
      )
    );
  }
  function agregarProducto() {
  setFilasProducto((actuales) => [
    ...actuales,
    {
      fila_id: crypto.randomUUID(),
      id_producto: "",
      id_planta: "",
      cantidad: "",
      costo_unitario: "",
      precio_venta_unitario: "",
      lugar_compra: "",
    },
  ]);
}

function eliminarProducto(filaId: string) {
  setFilasProducto((actuales) =>
    actuales.filter((fila) => fila.fila_id !== filaId)
  );
}

function actualizarProducto(
  filaId: string,
  campo: keyof ProductoFila,
  valor: string
) {
  setFilasProducto((actuales) =>
    actuales.map((fila) =>
      fila.fila_id === filaId ? { ...fila, [campo]: valor } : fila
    )
  );
}

function agregarProductoStock() {
  setFilasProductoStock((actuales) => [
    ...actuales,
    {
      fila_id: crypto.randomUUID(),
      id_producto: "",
      cantidad: "",
      costo_unitario: "",
      precio_venta_unitario: "",
    },
  ]);
}

function eliminarProductoStock(filaId: string) {
  setFilasProductoStock((actuales) =>
    actuales.filter((fila) => fila.fila_id !== filaId)
  );
}

function actualizarProductoStock(
  filaId: string,
  campo: keyof ProductoStockFila,
  valor: string
) {
  setFilasProductoStock((actuales) =>
    actuales.map((fila) =>
      fila.fila_id === filaId ? { ...fila, [campo]: valor } : fila
    )
  );
}

const productosConStock = productos.filter((producto) => producto.controla_stock);

function productoEsPlanta(idProducto: string) {
  const producto = productos.find((p) => p.id_producto === idProducto);

  if (!producto) return false;

  return (
    producto.nombre_producto.toLowerCase().includes("planta") ||
    producto.categoria?.toLowerCase().includes("planta")
  );
}

  return (
    <form action={crearTrabajo} className="space-y-7 p-7">
      <input
        type="hidden"
        name="servicios_json"
        value={JSON.stringify(filasServicio)}
      />
      <input
        type="hidden"
        name="productos_json"
        value={JSON.stringify(filasProducto)}
        />
        <input
        type="hidden"
        name="productos_stock_json"
        value={JSON.stringify(filasProductoStock)}
        />

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="label">Cliente *</label>
          <select
            required
            value={idCliente}
            onChange={(e) => setIdCliente(e.target.value)}
            className="input-field"
          >
            <option value="">Selecciona un cliente</option>
            {clientes.map((cliente) => (
              <option key={cliente.id_cliente} value={cliente.id_cliente}>
                {cliente.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Propiedad *</label>
          <select
            required
            name="id_propiedad"
            className="input-field"
            disabled={!idCliente}
          >
            <option value="">
              {idCliente
                ? "Selecciona una propiedad"
                : "Primero selecciona un cliente"}
            </option>

            {propiedades.map((propiedad) => (
              <option key={propiedad.id_propiedad} value={propiedad.id_propiedad}>
                {propiedad.nombre_propiedad}
                {propiedad.sector ? ` · ${propiedad.sector}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Fecha del servicio *</label>
        <input
          type="date"
          name="fecha_servicio"
          required
          defaultValue={hoy()}
          className="input-field"
        />
      </div>

      <div className="border-t border-slate-200 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-emerald-950">
              Servicios realizados
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Agrega uno o varios servicios de la visita.
            </p>
          </div>

          <button
            type="button"
            onClick={agregarServicio}
            className="btn-secondary"
          >
            + Agregar servicio
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {filasServicio.map((fila, index) => (
            <div
              key={fila.fila_id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-black text-slate-800">
                  Servicio #{index + 1}
                </p>

                {filasServicio.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => eliminarServicio(fila.fila_id)}
                    className="text-sm font-bold text-red-600"
                  >
                    Quitar
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Tipo de servicio *</label>
                  <select
                    required
                    value={fila.id_servicio}
                    onChange={(e) =>
                      actualizarServicio(
                        fila.fila_id,
                        "id_servicio",
                        e.target.value
                      )
                    }
                    className="input-field"
                  >
                    <option value="">Selecciona un servicio</option>
                    {servicios.map((servicio) => (
                      <option
                        key={servicio.id_servicio}
                        value={servicio.id_servicio}
                      >
                        {servicio.nombre_servicio}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Precio cobrado *</label>
                  <input
                      required
                      type="text"
                      inputMode="decimal"
                      value={fila.precio_servicio}
                      onChange={(e) =>
                        actualizarServicio(
                          fila.fila_id,
                          "precio_servicio",
                          limpiarNumero(e.target.value)
                        )
                      }
                      placeholder="Ej: 20"
                      className="input-field"
                    />
                </div>
              </div>

              <div className="mt-4">
                <label className="label">Detalle opcional</label>
                <input
                  value={fila.descripcion}
                  onChange={(e) =>
                    actualizarServicio(
                      fila.fila_id,
                      "descripcion",
                      e.target.value
                    )
                  }
                  placeholder="Ej: se retiró maleza, se podaron plantas..."
                  className="input-field"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
          <div className="border-t border-slate-200 pt-6">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 className="text-xl font-black text-emerald-950">
        Productos usados o vendidos
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Agrega plantas, tierra, macetas, semillas u otros productos comprados para este trabajo.
      </p>
    </div>

    <button
      type="button"
      onClick={agregarProducto}
      className="btn-secondary"
    >
      + Agregar producto
    </button>
  </div>

  {filasProducto.length === 0 ? (
    <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">
      No se agregaron productos en este trabajo.
    </div>
  ) : null}

  <div className="mt-5 space-y-4">
    {filasProducto.map((fila, index) => (
      <div
        key={fila.fila_id}
        className="rounded-2xl border border-slate-200 bg-white p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-black text-slate-800">
            Producto #{index + 1}
          </p>

          <button
            type="button"
            onClick={() => eliminarProducto(fila.fila_id)}
            className="text-sm font-bold text-red-600"
          >
            Quitar
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
         <div>
  <label className="label">Producto *</label>
  <select
    required
    value={fila.id_producto}
    onChange={(e) =>
      actualizarProducto(
        fila.fila_id,
        "id_producto",
        e.target.value
      )
    }
    className="input-field"
  >
    <option value="">Selecciona un producto</option>
    {productos.map((producto) => (
      <option
        key={producto.id_producto}
        value={producto.id_producto}
      >
        {producto.nombre_producto}
      </option>
    ))}
  </select>

  {productoEsPlanta(fila.id_producto) ? (
    <div className="mt-4">
      <label className="label">Nombre de la planta *</label>
      <select
        required
        value={fila.id_planta}
        onChange={(e) =>
          actualizarProducto(
            fila.fila_id,
            "id_planta",
            e.target.value
          )
        }
        className="input-field"
      >
        <option value="">Selecciona una planta</option>
        {plantas.map((planta) => (
          <option key={planta.id_planta} value={planta.id_planta}>
            {planta.nombre_planta}
          </option>
        ))}
      </select>
    </div>
  ) : null}
</div>

          <div>
            <label className="label">Lugar de compra</label>
            <input
              value={fila.lugar_compra}
              onChange={(e) =>
                actualizarProducto(
                  fila.fila_id,
                  "lugar_compra",
                  e.target.value
                )
              }
              placeholder="Ej: Vivero San José"
              className="input-field"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="label">Cantidad *</label>

                  <input
                    required
                    type="text"
                    inputMode="decimal"
                    value={fila.cantidad}
                    onChange={(e) =>
                      actualizarProducto(
                        fila.fila_id,
                        "cantidad",
                        limpiarNumero(e.target.value)
                      )
                    }
                    placeholder="Ej: 5"
                    className="input-field"
                  />

          </div>

          <div>
            <label className="label">Costo unitario por unidad*</label>
            <input
              required
              type="text"
              inputMode="decimal"
             
              value={fila.costo_unitario}
              onChange={(e) =>
                actualizarProducto(
                  fila.fila_id,
                  "costo_unitario",
                  limpiarNumero(e.target.value)
                )
              }
              placeholder="Ej: 2"
              className="input-field"
            />
          </div>

          <div>
            <label className="label">Precio cobrado por unidad*</label>

            <input
                required
                type="text"
                inputMode="decimal"
                value={fila.precio_venta_unitario}
                onChange={(e) =>
                  actualizarProducto(
                    fila.fila_id,
                    "precio_venta_unitario",
                    limpiarNumero(e.target.value)
                  )
                }
                placeholder="Ej: 20"
                className="input-field"
              />

          </div>
        </div>
      </div>
    ))}
  </div>
</div>



<div className="border-t border-slate-200 pt-6">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 className="text-xl font-black text-emerald-950">
        Productos usados del stock
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Usa productos que ya tienen guardados, como abono orgánico en saquillos.
      </p>
    </div>

    <button
      type="button"
      onClick={agregarProductoStock}
      className="btn-secondary"
    >
      + Usar producto del stock
    </button>
  </div>

  {filasProductoStock.length === 0 ? (
    <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">
      No se usaron productos del stock en este trabajo.
    </div>
  ) : null}

  <div className="mt-5 space-y-4">
    {filasProductoStock.map((fila, index) => (
      <div
        key={fila.fila_id}
        className="rounded-2xl border border-slate-200 bg-white p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-black text-slate-800">
            Producto de stock #{index + 1}
          </p>

          <button
            type="button"
            onClick={() => eliminarProductoStock(fila.fila_id)}
            className="text-sm font-bold text-red-600"
          >
            Quitar
          </button>
        </div>

        <div className="mt-4">
          <label className="label">Producto del stock *</label>
          <select
            required
            value={fila.id_producto}
            onChange={(e) =>
              actualizarProductoStock(
                fila.fila_id,
                "id_producto",
                e.target.value
              )
            }
            className="input-field"
          >
            <option value="">Selecciona un producto</option>
            {productosConStock.map((producto) => (
              <option key={producto.id_producto} value={producto.id_producto}>
                {producto.nombre_producto} · Stock: {producto.stock_actual}{" "}
                {producto.unidad_medida || ""}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="label">Cantidad usada *</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={fila.cantidad}
              onChange={(e) =>
                actualizarProductoStock(
                  fila.fila_id,
                  "cantidad",
                  e.target.value
                )
              }
              placeholder="Ej: 2"
              className="input-field"
            />
          </div>

          <div>
            <label className="label">Costo interno por unidad *</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={fila.costo_unitario}
              onChange={(e) =>
                actualizarProductoStock(
                  fila.fila_id,
                  "costo_unitario",
                  e.target.value
                )
              }
              placeholder="Ej: 1.50"
              className="input-field"
            />
          </div>

          <div>
            <label className="label">Precio cobrado por unidad *</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={fila.precio_venta_unitario}
              onChange={(e) =>
                actualizarProductoStock(
                  fila.fila_id,
                  "precio_venta_unitario",
                  e.target.value
                )
              }
              placeholder="Ej: 4"
              className="input-field"
            />
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">
          <p>
            Costo total aproximado: $
            {(
              Number(fila.cantidad || 0) *
              Number(fila.costo_unitario || 0)
            ).toFixed(2)}
          </p>
          <p>
            Total cobrado al cliente: $
            {(
              Number(fila.cantidad || 0) *
              Number(fila.precio_venta_unitario || 0)
            ).toFixed(2)}
          </p>
          <p className="font-bold">
            Ganancia aproximada: $
            {(
              Number(fila.cantidad || 0) *
              (Number(fila.precio_venta_unitario || 0) -
                Number(fila.costo_unitario || 0))
            ).toFixed(2)}
          </p>
        </div>
      </div>
    ))}
  </div>
</div>




      <div>
              <label className="label">Nota general del trabajo</label>
              <textarea
                name="nota_trabajo"
                rows={4}
                placeholder="Ej: el jardín estaba con bastante maleza, se recomienda volver en un mes..."
                className="input-field"
              />
            </div>

            <div className="border-t border-slate-200 pt-6">
        <h2 className="text-xl font-black text-emerald-950">Recordatorio</h2>

        <p className="mt-1 text-sm text-slate-600">
          Elige si quieres que el sistema recuerde hacer seguimiento después de este
          trabajo.
        </p>

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <label className="label">Recordarme</label>
            <select
              name="recordatorio_opcion"
              value={recordatorioOpcion}
              onChange={(e) => setRecordatorioOpcion(e.target.value)}
              className="input-field"
            >
              <option value="none">No recordar</option>
              <option value="15">En 15 días</option>
              <option value="30">En 30 días</option>
              <option value="60">En 60 días</option>
              <option value="90">En 90 días</option>
              <option value="custom">Elegir fecha</option>
            </select>
          </div>

          {recordatorioOpcion === "custom" ? (
            <div>
              <label className="label">Fecha del recordatorio *</label>
              <input
                type="date"
                name="fecha_recordatorio"
                required
                className="input-field"
              />
            </div>
          ) : null}
        </div>

        {recordatorioOpcion !== "none" ? (
          <div className="mt-4">
            <label className="label">Mensaje del recordatorio</label>
            <textarea
              name="mensaje_recordatorio"
              rows={3}
              placeholder="Ej: volver a revisar el jardín, hacer mantenimiento o preguntar si necesita servicio..."
              className="input-field"
            />
          </div>
        ) : null}
</div>

      <div className="border-t border-slate-200 pt-6">
        <h2 className="text-xl font-black text-emerald-950">Pago</h2>

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <label className="label">Estado del pago *</label>
            <select
              name="estado_pago"
              value={estadoPago}
              onChange={(e) => setEstadoPago(e.target.value)}
              className="input-field"
            >
              <option value="pendiente">Quedó pendiente</option>
              <option value="pagado">Pagó en ese momento</option>
            </select>
          </div>

          {estadoPago === "pagado" ? (
            <div>
              <label className="label">Método de pago *</label>
              <select name="metodo_pago" className="input-field" required>
                <option value="">Selecciona una opción</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
        <a href="/dashboard" className="btn-secondary">
          Cancelar
        </a>

        <button type="submit" className="btn-primary">
          Guardar trabajo
        </button>
      </div>
    </form>
  );
}