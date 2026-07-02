import { after, NextResponse } from "next/server";
import {
  actualizarBorradorTelegram,
  type BorradorTelegram,
  chatTelegramPermitido,
  crearBorradorTelegram,
  enviarMensajeTelegram,
  obtenerBorradorTelegramPendiente,
  telegramAllowedChatIdsConfigurado,
} from "@/lib/asistente/telegram";
import { POST as consultarAsistente } from "@/app/api/ia/consultar/route";
import { POST as interpretarTrabajo } from "@/app/api/ia/interpretar-trabajo/route";
import { POST as guardarTrabajo } from "@/app/api/ia/guardar-trabajo/route";
import { POST as actualizarPago } from "@/app/api/ia/actualizar-pago/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MensajeTelegram = {
  chatId: string;
  text: string;
  from?: Record<string, unknown>;
  test?: boolean;
};

type PropiedadConsulta = {
  nombre_propiedad?: string | null;
  cliente?: {
    nombre?: string | null;
  } | null;
};

type PagoPendienteTelegram = {
  fecha_servicio?: string | null;
  total_general?: number | string | null;
  propiedad?: PropiedadConsulta | null;
};

type RecordatorioTelegram = {
  fecha_recordatorio?: string | null;
  mensaje?: string | null;
  orden_servicio?: {
    propiedad?: PropiedadConsulta | null;
  } | null;
};

type OpcionTelegram = Record<string, unknown>;

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

function detalleError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    return JSON.stringify(error);
  }

  return String(error);
}

function textoNormalizado(mensaje: string) {
  return mensaje
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function jsonRequest(data: unknown) {
  return new Request("http://internal.local", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-asistente-canal": "telegram",
      "x-asistente-internal-key": process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    },
    body: JSON.stringify(data),
  });
}

async function leerJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

function dinero(valor: number | string | null | undefined) {
  return `$${Number(valor || 0).toFixed(2)}`;
}

function numero(valor: unknown) {
  const n = Number(valor || 0);
  return Number.isFinite(n) ? n : 0;
}

function arreglo(valor: unknown) {
  return Array.isArray(valor) ? valor : [];
}

function idTexto(valor: unknown) {
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number") return String(valor);
  return "";
}

function faltantesBloqueantes(borrador: Record<string, unknown>) {
  const faltantes = arreglo(borrador.faltan_bloqueantes)
    .map((faltante) => texto(faltante).trim())
    .filter(Boolean);

  if (!idTexto(borrador.cliente_id) && !faltantes.includes("seleccionar cliente")) {
    faltantes.push("seleccionar cliente");
  }

  if (
    !idTexto(borrador.propiedad_id) &&
    !faltantes.includes("seleccionar propiedad")
  ) {
    faltantes.push("seleccionar propiedad");
  }

  return Array.from(new Set(faltantes));
}

function puedeGuardarBorrador(borrador: Record<string, unknown>) {
  return (
    borrador.puede_guardar === true &&
    Boolean(idTexto(borrador.cliente_id)) &&
    Boolean(idTexto(borrador.propiedad_id)) &&
    faltantesBloqueantes(borrador).length === 0
  );
}

function etiquetaOpcion(opcion: OpcionTelegram) {
  const nombre =
    texto(opcion.nombre) ||
    texto(opcion.nombre_propiedad) ||
    texto(opcion.cliente_nombre) ||
    "Sin nombre";
  const lugar =
    texto(opcion.sector) ||
    texto(opcion.ciudad) ||
    texto(opcion.direccion) ||
    texto(opcion.telefono);

  return lugar ? `${nombre} - ${lugar}` : nombre;
}

function listaOpciones(titulo: string, opciones: unknown, cierre: string) {
  const items = arreglo(opciones).filter(esObjeto);

  if (items.length === 0) {
    return "";
  }

  return [
    titulo,
    "",
    ...items.map((item, index) => `${index + 1}. ${etiquetaOpcion(item)}`),
    "",
    cierre,
  ].join("\n");
}

function avisoFaltantesTrabajo(borrador: Record<string, unknown>) {
  const faltantes = faltantesBloqueantes(borrador);
  const lineas = [
    "Falta información antes de guardar:",
    "",
    ...(faltantes.length
      ? faltantes.map((faltante) => `- ${faltante}`)
      : ["- completar información pendiente"]),
  ];
  const propiedades = listaOpciones(
    "Encontré varias propiedades para este cliente:",
    borrador.propiedades_posibles,
    "Responde con el número o el nombre de la propiedad."
  );
  const clientes = listaOpciones(
    "Encontré varios clientes parecidos:",
    borrador.clientes_posibles,
    "Responde con el número o el nombre del cliente."
  );
  const preguntaSiguiente = texto(borrador.pregunta_siguiente);

  return [
    ...lineas,
    ...(propiedades ? ["", propiedades] : []),
    ...(clientes ? ["", clientes] : []),
    ...(preguntaSiguiente ? ["", preguntaSiguiente] : []),
  ].join("\n");
}

function nombreProducto(producto: Record<string, unknown>) {
  return (
    texto(producto.producto_original) ||
    texto(producto.nombre) ||
    "Producto"
  );
}

function cantidadProducto(producto: Record<string, unknown>) {
  const cantidad = numero(producto.cantidad);
  const tipo = texto(producto.tipo);
  const tipoInterno = ["venta", "compra", "uso", "usado", "no_claro"].includes(
    tipo.toLowerCase()
  );

  if (cantidad <= 0) return "";
  if (tipo && !tipoInterno) return `${cantidad} ${tipo}`;

  return String(cantidad);
}

function lineasProducto(producto: Record<string, unknown>) {
  const nombre = nombreProducto(producto);
  const cantidad = cantidadProducto(producto);
  const subtotalCosto = numero(producto.subtotal_costo);
  const subtotalVenta = numero(producto.subtotal_venta);
  const ganancia = numero(producto.ganancia_producto);
  const tieneCostoYVenta = subtotalCosto > 0 && subtotalVenta > 0;

  if (tieneCostoYVenta) {
    return [
      `- ${nombre}${cantidad ? `: ${cantidad}` : ""}`,
      `  Costo: ${dinero(subtotalCosto)}`,
      `  Venta: ${dinero(subtotalVenta)}`,
      `  Ganancia: ${dinero(ganancia || subtotalVenta - subtotalCosto)}`,
    ];
  }

  return [
    `- ${nombre}${cantidad ? `: ${cantidad}` : ""} - ${dinero(
      subtotalVenta || numero(producto.total)
    )}`,
  ];
}

function lineasProductos(productos: unknown[]) {
  return productos
    .slice(0, 8)
    .flatMap((producto) => {
      if (!esObjeto(producto)) return [];

      return lineasProducto(producto);
    })
    .filter(Boolean);
}

function fechaActualEcuador() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function diferenciaDias(fechaISO: string) {
  const hoy = new Date(`${fechaActualEcuador()}T00:00:00-05:00`);
  const fecha = new Date(`${fechaISO}T00:00:00-05:00`);
  const msPorDia = 24 * 60 * 60 * 1000;

  return Math.round((fecha.getTime() - hoy.getTime()) / msPorDia);
}

function estadoDias(fechaISO: string | null | undefined) {
  if (!fechaISO) return "sin fecha";

  const dias = diferenciaDias(fechaISO);

  if (dias > 1) return `faltan ${dias} días`;
  if (dias === 1) return "falta 1 día";
  if (dias === 0) return "vence hoy";

  const vencido = Math.abs(dias);
  return vencido === 1 ? "vencido ayer" : `vencido hace ${vencido} días`;
}

function notaRecordatorio(mensaje: string | null | undefined) {
  const limpio = (mensaje || "").replace(/\s+/g, " ").trim();

  if (!limpio) return "";

  const normalizado = limpio
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    normalizado.includes("recordatorio de seguimiento del servicio realizado")
  ) {
    return "";
  }

  return limpio.length <= 50 ? limpio : `${limpio.slice(0, 50).trim()}...`;
}

function formatearPagosTelegram(consulta: Record<string, unknown>) {
  const datos = arreglo(consulta.datos) as PagoPendienteTelegram[];

  if (datos.length === 0) {
    return texto(consulta.respuesta);
  }

  const total = datos.reduce(
    (suma, orden) => suma + Number(orden.total_general || 0),
    0
  );
  const visibles = datos.slice(0, 10);
  const ocultos = datos.length - visibles.length;
  const lineas = visibles.flatMap((orden, index) => {
    const propiedad = orden.propiedad;
    const cliente = propiedad?.cliente?.nombre || "Sin cliente";
    const casa = propiedad?.nombre_propiedad || "Sin propiedad";

    return [
      `${index + 1}. ${cliente}`,
      `   Casa: ${casa}`,
      `   Fecha: ${orden.fecha_servicio || "Sin fecha"}`,
      `   Valor: ${dinero(orden.total_general)}`,
      "",
    ];
  });

  if (ocultos > 0) {
    lineas.push(`Hay ${ocultos} pendientes más que no se muestran.`);
  }

  return [
    "💰 Pagos pendientes",
    "",
    `Tienes ${datos.length} trabajos pendientes.`,
    `Total pendiente: ${dinero(total)}`,
    "",
    ...lineas,
  ]
    .join("\n")
    .trim();
}

function formatearRecordatoriosTelegram(consulta: Record<string, unknown>) {
  const datos = arreglo(consulta.datos) as RecordatorioTelegram[];

  if (datos.length === 0) {
    return texto(consulta.respuesta);
  }

  const visibles = datos.slice(0, 10);
  const ocultos = datos.length - visibles.length;
  const lineas = visibles.flatMap((recordatorio, index) => {
    const propiedad = recordatorio.orden_servicio?.propiedad;
    const cliente = propiedad?.cliente?.nombre || "Sin cliente";
    const casa = propiedad?.nombre_propiedad || "Sin propiedad";
    const nota = notaRecordatorio(recordatorio.mensaje);
    const bloque = [
      `${index + 1}. ${cliente}`,
      `   Casa: ${casa}`,
      `   Fecha: ${recordatorio.fecha_recordatorio || "Sin fecha"}`,
      `   Estado: ${estadoDias(recordatorio.fecha_recordatorio)}`,
    ];

    if (nota) {
      bloque.push(`   Nota: ${nota}`);
    }

    return [...bloque, ""];
  });

  if (ocultos > 0) {
    lineas.push(`Hay ${ocultos} recordatorios más que no se muestran.`);
  }

  return [
    "🔔 Recordatorios pendientes",
    "",
    `Tienes ${datos.length} recordatorios próximos o recientes.`,
    "",
    ...lineas,
  ]
    .join("\n")
    .trim();
}

function extraerMensaje(payload: unknown): MensajeTelegram | null {
  if (!esObjeto(payload)) return null;

  if (payload.test === true) {
    const chatId = texto(payload.chat_id || payload.chatId).trim();
    const text = texto(payload.text).trim();

    if (!chatId || !text) return null;

    return {
      chatId,
      text,
      test: true,
    };
  }

  const message = esObjeto(payload.message) ? payload.message : null;
  if (!message) return null;

  const chat = esObjeto(message.chat) ? message.chat : null;
  const from = esObjeto(message.from) ? message.from : undefined;
  const chatIdValue = chat?.id;
  const body = texto(message.text).trim();

  if ((typeof chatIdValue !== "string" && typeof chatIdValue !== "number") || !body) {
    return null;
  }

  return {
    chatId: String(chatIdValue),
    text: body,
    from,
  };
}

function resumenTrabajo(borrador: Record<string, unknown>) {
  const servicios = Array.isArray(borrador.servicios)
    ? borrador.servicios
    : [];
  const productos = Array.isArray(borrador.productos)
    ? borrador.productos
    : [];
  const lineasServicios = servicios
    .slice(0, 8)
    .map((servicio) => {
      if (!esObjeto(servicio)) return "";

      return `- ${texto(servicio.nombre) || "Servicio"}: $${Number(
        servicio.total || 0
      ).toFixed(2)}`;
    })
    .filter(Boolean);
  const lineasProductosResumen = lineasProductos(productos);
  const totalServicios = servicios.reduce((suma, servicio) => {
    if (!esObjeto(servicio)) return suma;

    return suma + numero(servicio.total);
  }, 0);
  const totalProductos = productos.reduce((suma, producto) => {
    if (!esObjeto(producto)) return suma;

    return suma + (numero(producto.subtotal_venta) || numero(producto.total));
  }, 0);

  const recordatorio =
    texto(borrador.recordatorio) ||
    texto(borrador.fecha_recordatorio) ||
    (Number(borrador.recordatorio_dias || 0) > 0 ? "Si" : "No");
  const preguntaSiguiente = texto(borrador.pregunta_siguiente);
  const puedeGuardar = puedeGuardarBorrador(borrador);

  return [
    "Revisa antes de guardar:",
    "",
    `Cliente: ${texto(borrador.cliente_nombre) || "No detectado"}`,
    `Propiedad: ${texto(borrador.propiedad_o_sector) || "No detectada"}`,
    `Fecha: ${texto(borrador.fecha_trabajo) || "No detectada"}`,
    "",
    "Servicios:",
    ...(lineasServicios.length ? lineasServicios : ["- No detectados"]),
    "",
    ...(lineasProductosResumen.length
      ? ["Productos:", ...lineasProductosResumen, ""]
      : []),
    `Total servicios: ${dinero(totalServicios)}`,
    ...(lineasProductosResumen.length
      ? [`Total productos: ${dinero(totalProductos)}`]
      : []),
    `Total general: ${dinero(borrador.total as number | string | null | undefined)}`,
    `Pagado: ${dinero(borrador.pagado as number | string | null | undefined)}`,
    `Pendiente: ${dinero(borrador.pendiente as number | string | null | undefined)}`,
    `Recordatorio: ${recordatorio}`,
    "",
    ...(puedeGuardar
      ? [
          ...(preguntaSiguiente ? [preguntaSiguiente, ""] : []),
          "Responde GUARDAR para registrar o escribe una correccion.",
        ]
      : [avisoFaltantesTrabajo(borrador), "", "Escribe la correccion para continuar."]),
  ].join("\n");
}

async function procesarGuardarTrabajo(
  chatId: string,
  borrador: BorradorTelegram
) {
  if (!esObjeto(borrador.datos) || !puedeGuardarBorrador(borrador.datos)) {
    const respuesta = esObjeto(borrador.datos)
      ? resumenTrabajo(borrador.datos)
      : "No pude guardar: el borrador pendiente no tiene datos validos.";

    await enviarMensajeTelegram(chatId, respuesta);
    return respuesta;
  }

  const res = await guardarTrabajo(jsonRequest({ borrador: borrador.datos }));
  const data = await leerJson(res);

  if (!res.ok) {
    const detalle = texto(data.detalle) || texto(data.error) || "No se pudo guardar";
    const respuesta = `No pude guardar: ${detalle}`;
    console.error("Error guardando desde Telegram:", JSON.stringify(data, null, 2));
    await enviarMensajeTelegram(chatId, respuesta);
    return respuesta;
  }

  await actualizarBorradorTelegram(borrador.id, "guardado");
  const respuesta = "Trabajo guardado correctamente.";
  await enviarMensajeTelegram(chatId, respuesta);
  return respuesta;
}

async function procesarPagoPendiente(
  chatId: string,
  mensaje: string,
  borrador: BorradorTelegram
) {
  const res = await actualizarPago(
    jsonRequest({
      mensaje,
      accionPendiente: borrador.datos,
    })
  );
  const data = await leerJson(res);

  if (!res.ok) {
    throw new Error(texto(data.detalle) || texto(data.error) || "No se pudo registrar el pago");
  }

  if (data.accionPendiente) {
    await actualizarBorradorTelegram(borrador.id, "pendiente", data.accionPendiente);
  } else {
    await actualizarBorradorTelegram(borrador.id, "guardado");
  }

  const respuesta = texto(data.respuesta) || "Pago registrado correctamente.";
  await enviarMensajeTelegram(chatId, respuesta);
  return respuesta;
}

async function procesarCorreccionTrabajo(
  chatId: string,
  mensaje: string,
  borrador: BorradorTelegram
) {
  const res = await interpretarTrabajo(
    jsonRequest({
      mensaje,
      borradorActual: borrador.datos,
    })
  );
  const data = await leerJson(res);

  if (!res.ok) {
    throw new Error(texto(data.detalle) || texto(data.error) || "No se pudo actualizar");
  }

  await actualizarBorradorTelegram(borrador.id, "pendiente", data);
  const respuesta = resumenTrabajo(data);
  await enviarMensajeTelegram(chatId, respuesta);
  return respuesta;
}

async function procesarMensaje(chatId: string, mensaje: string) {
  if (!chatTelegramPermitido(chatId)) {
    const respuesta = "No estás autorizado para usar este asistente.";
    await enviarMensajeTelegram(chatId, respuesta);
    return respuesta;
  }

  if (!telegramAllowedChatIdsConfigurado()) {
    await enviarMensajeTelegram(
      chatId,
      [
        `Tu chat_id es: ${chatId}.`,
        "Ponlo en TELEGRAM_ALLOWED_CHAT_IDS para cerrar el acceso.",
      ].join("\n")
    );
  }

  const normalizado = textoNormalizado(mensaje);
  const borrador = await obtenerBorradorTelegramPendiente(chatId);

  if (normalizado === "cancelar") {
    if (borrador) {
      await actualizarBorradorTelegram(borrador.id, "cancelado");
    }

    const respuesta = "Listo, cancele la accion pendiente.";
    await enviarMensajeTelegram(chatId, respuesta);
    return respuesta;
  }

  if (normalizado === "guardar" && borrador?.tipo === "registro_trabajo") {
    return procesarGuardarTrabajo(chatId, borrador);
  }

  if (normalizado === "confirmar pago" && borrador?.tipo === "actualizar_pago") {
    return procesarPagoPendiente(chatId, mensaje, borrador);
  }

  if (borrador?.tipo === "actualizar_pago") {
    return procesarPagoPendiente(chatId, mensaje, borrador);
  }

  if (borrador?.tipo === "registro_trabajo") {
    return procesarCorreccionTrabajo(chatId, mensaje, borrador);
  }

  const consultaRes = await consultarAsistente(jsonRequest({ mensaje }));
  const consulta = await leerJson(consultaRes);

  if (!consultaRes.ok) {
    throw new Error(texto(consulta.detalle) || texto(consulta.error));
  }

  if (
    consulta.tipo === "consultar_pagos" ||
    consulta.tipo === "consultar_recordatorios" ||
    consulta.tipo === "desconocido"
  ) {
    const respuesta =
      consulta.tipo === "consultar_pagos"
        ? formatearPagosTelegram(consulta)
        : consulta.tipo === "consultar_recordatorios"
          ? formatearRecordatoriosTelegram(consulta)
          : texto(consulta.respuesta);

    await enviarMensajeTelegram(chatId, respuesta);
    return respuesta;
  }

  if (consulta.tipo === "actualizar_pago") {
    const pagoRes = await actualizarPago(jsonRequest({ mensaje }));
    const pago = await leerJson(pagoRes);

    if (!pagoRes.ok) {
      throw new Error(texto(pago.detalle) || texto(pago.error));
    }

    if (pago.accionPendiente) {
      await crearBorradorTelegram(
        chatId,
        "actualizar_pago",
        mensaje,
        pago.accionPendiente
      );
    }

    const respuesta = texto(pago.respuesta);
    await enviarMensajeTelegram(chatId, respuesta);
    return respuesta;
  }

  const interpretarRes = await interpretarTrabajo(jsonRequest({ mensaje }));
  const borradorTrabajo = await leerJson(interpretarRes);

  if (!interpretarRes.ok) {
    throw new Error(
      texto(borradorTrabajo.detalle) || texto(borradorTrabajo.error)
    );
  }

  await crearBorradorTelegram(chatId, "registro_trabajo", mensaje, borradorTrabajo);
  const respuesta = resumenTrabajo(borradorTrabajo);
  await enviarMensajeTelegram(chatId, respuesta);
  return respuesta;
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const mensaje = extraerMensaje(payload);

    if (!mensaje) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (mensaje.test) {
      const respuesta = await procesarMensaje(mensaje.chatId, mensaje.text);

      return NextResponse.json({
        ok: true,
        test: true,
        chatId: mensaje.chatId,
        respuesta,
      });
    }

    after(async () => {
      try {
        await procesarMensaje(mensaje.chatId, mensaje.text);
      } catch (error) {
        console.error(
          "Error guardando desde Telegram:",
          JSON.stringify(error, null, 2)
        );
        console.error("Error procesando Telegram:", error);

        try {
          await enviarMensajeTelegram(
            mensaje.chatId,
            `No pude procesar el mensaje: ${detalleError(error)}`
          );
        } catch (sendError) {
          console.error("Error enviando error por Telegram:", sendError);
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en POST webhook Telegram:", error);

    return NextResponse.json(
      { ok: false, error: "Error procesando webhook" },
      { status: 500 }
    );
  }
}
