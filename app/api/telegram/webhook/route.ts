import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  chatTelegramPermitido,
  enviarMensajeTelegram,
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

type BorradorTelegram = {
  id: string;
  tipo: "registro_trabajo" | "actualizar_pago";
  datos: unknown;
};

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
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
    },
    body: JSON.stringify(data),
  });
}

async function leerJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
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
  const lineasServicios = servicios
    .slice(0, 8)
    .map((servicio) => {
      if (!esObjeto(servicio)) return "";

      return `- ${texto(servicio.nombre) || "Servicio"}: $${Number(
        servicio.total || 0
      ).toFixed(2)}`;
    })
    .filter(Boolean);

  const recordatorio =
    texto(borrador.recordatorio) ||
    texto(borrador.fecha_recordatorio) ||
    (Number(borrador.recordatorio_dias || 0) > 0 ? "Si" : "No");

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
    `Total: $${Number(borrador.total || 0).toFixed(2)}`,
    `Pagado: $${Number(borrador.pagado || 0).toFixed(2)}`,
    `Pendiente: $${Number(borrador.pendiente || 0).toFixed(2)}`,
    `Recordatorio: ${recordatorio}`,
    "",
    "Responde GUARDAR para registrar o escribe una correccion.",
  ].join("\n");
}

async function obtenerBorradorPendiente(chatId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telegram_borrador")
    .select("id, tipo, datos")
    .eq("chat_id", chatId)
    .eq("estado", "pendiente")
    .order("fecha_creacion", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error leyendo telegram_borrador:", error);
    return null;
  }

  return data as BorradorTelegram | null;
}

async function crearBorrador(
  chatId: string,
  tipo: BorradorTelegram["tipo"],
  mensajeOriginal: string,
  datos: unknown
) {
  const supabase = await createClient();
  const { error } = await supabase.from("telegram_borrador").insert({
    chat_id: chatId,
    tipo,
    mensaje_original: mensajeOriginal,
    datos,
    estado: "pendiente",
  });

  if (error) {
    console.error("Error creando telegram_borrador:", error);
  }
}

async function actualizarBorrador(
  id: string,
  estado: "pendiente" | "guardado" | "cancelado",
  datos?: unknown
) {
  const supabase = await createClient();
  const update: Record<string, unknown> = {
    estado,
    fecha_actualizacion: new Date().toISOString(),
  };

  if (datos !== undefined) {
    update.datos = datos;
  }

  const { error } = await supabase
    .from("telegram_borrador")
    .update(update)
    .eq("id", id);

  if (error) {
    console.error("Error actualizando telegram_borrador:", error);
  }
}

async function procesarGuardarTrabajo(
  chatId: string,
  borrador: BorradorTelegram
) {
  const res = await guardarTrabajo(jsonRequest({ borrador: borrador.datos }));
  const data = await leerJson(res);

  if (!res.ok) {
    throw new Error(texto(data.detalle) || texto(data.error) || "No se pudo guardar");
  }

  await actualizarBorrador(borrador.id, "guardado");
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
    await actualizarBorrador(borrador.id, "pendiente", data.accionPendiente);
  } else {
    await actualizarBorrador(borrador.id, "guardado");
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

  await actualizarBorrador(borrador.id, "pendiente", data);
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

  const normalizado = textoNormalizado(mensaje);
  const borrador = await obtenerBorradorPendiente(chatId);

  if (normalizado === "cancelar") {
    if (borrador) {
      await actualizarBorrador(borrador.id, "cancelado");
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
    const respuesta = texto(consulta.respuesta);
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
      await crearBorrador(chatId, "actualizar_pago", mensaje, pago.accionPendiente);
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

  await crearBorrador(chatId, "registro_trabajo", mensaje, borradorTrabajo);
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
        console.error("Error procesando Telegram:", error);

        try {
          await enviarMensajeTelegram(
            mensaje.chatId,
            "Hubo un error procesando tu mensaje. Intenta de nuevo."
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
