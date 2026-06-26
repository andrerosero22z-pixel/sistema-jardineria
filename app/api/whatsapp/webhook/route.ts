import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  enviarMensajeWhatsApp,
  numeroPermitido,
} from "@/lib/asistente/whatsapp";
import { POST as consultarAsistente } from "@/app/api/ia/consultar/route";
import { POST as interpretarTrabajo } from "@/app/api/ia/interpretar-trabajo/route";
import { POST as guardarTrabajo } from "@/app/api/ia/guardar-trabajo/route";
import { POST as actualizarPago } from "@/app/api/ia/actualizar-pago/route";

export const runtime = "nodejs";

type MensajeWhatsApp = {
  from: string;
  id?: string;
  text?: {
    body?: string;
  };
  type?: string;
};

type BorradorWhatsApp = {
  id: string;
  tipo: "registro_trabajo" | "actualizar_pago";
  datos: unknown;
};

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

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function extraerMensaje(payload: unknown): MensajeWhatsApp | null {
  if (!esObjeto(payload)) return null;

  const entry = Array.isArray(payload.entry) ? payload.entry[0] : null;
  if (!esObjeto(entry)) return null;

  const changes = Array.isArray(entry.changes) ? entry.changes[0] : null;
  if (!esObjeto(changes) || !esObjeto(changes.value)) return null;

  const messages = Array.isArray(changes.value.messages)
    ? changes.value.messages
    : [];
  const message = messages[0];

  if (!esObjeto(message)) return null;
  if (message.type !== "text") return null;

  const textValue = esObjeto(message.text) ? message.text : {};
  const body = texto(textValue.body).trim();
  const from = texto(message.from).trim();

  if (!from || !body) return null;

  return {
    from,
    id: texto(message.id),
    type: "text",
    text: { body },
  };
}

function textoNormalizado(mensaje: string) {
  return mensaje
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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

async function obtenerBorradorPendiente(telefono: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_borrador")
    .select("id, tipo, datos")
    .eq("telefono", telefono)
    .eq("estado", "pendiente")
    .order("fecha_creacion", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error leyendo borrador WhatsApp:", error);
    return null;
  }

  return data as BorradorWhatsApp | null;
}

async function crearBorrador(
  telefono: string,
  tipo: BorradorWhatsApp["tipo"],
  mensajeOriginal: string,
  datos: unknown
) {
  const supabase = await createClient();
  const { error } = await supabase.from("whatsapp_borrador").insert({
    telefono,
    tipo,
    mensaje_original: mensajeOriginal,
    datos,
    estado: "pendiente",
  });

  if (error) {
    console.error("Error creando borrador WhatsApp:", error);
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
    .from("whatsapp_borrador")
    .update(update)
    .eq("id", id);

  if (error) {
    console.error("Error actualizando borrador WhatsApp:", error);
  }
}

async function procesarGuardar(telefono: string, borrador: BorradorWhatsApp) {
  const res = await guardarTrabajo(jsonRequest({ borrador: borrador.datos }));
  const data = await leerJson(res);

  if (!res.ok) {
    throw new Error(texto(data.detalle) || texto(data.error) || "No se pudo guardar");
  }

  await actualizarBorrador(borrador.id, "guardado");
  await enviarMensajeWhatsApp(telefono, "Trabajo guardado correctamente.");
}

async function procesarConfirmarPago(
  telefono: string,
  mensaje: string,
  borrador: BorradorWhatsApp
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

  await enviarMensajeWhatsApp(
    telefono,
    texto(data.respuesta) || "Pago registrado correctamente."
  );
}

async function procesarMensaje(telefono: string, mensaje: string) {
  if (!numeroPermitido(telefono)) {
    await enviarMensajeWhatsApp(
      telefono,
      "Este numero no esta autorizado para usar el asistente."
    );
    return;
  }

  const normalizado = textoNormalizado(mensaje);
  const borrador = await obtenerBorradorPendiente(telefono);

  if (normalizado === "cancelar") {
    if (borrador) {
      await actualizarBorrador(borrador.id, "cancelado");
    }

    await enviarMensajeWhatsApp(telefono, "Listo, cancele la accion pendiente.");
    return;
  }

  if (normalizado === "guardar" && borrador?.tipo === "registro_trabajo") {
    await procesarGuardar(telefono, borrador);
    return;
  }

  if (normalizado === "confirmar pago" && borrador?.tipo === "actualizar_pago") {
    await procesarConfirmarPago(telefono, mensaje, borrador);
    return;
  }

  if (borrador?.tipo === "actualizar_pago") {
    await procesarConfirmarPago(telefono, mensaje, borrador);
    return;
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
    await enviarMensajeWhatsApp(telefono, texto(consulta.respuesta));
    return;
  }

  if (consulta.tipo === "actualizar_pago") {
    const pagoRes = await actualizarPago(jsonRequest({ mensaje }));
    const pago = await leerJson(pagoRes);

    if (!pagoRes.ok) {
      throw new Error(texto(pago.detalle) || texto(pago.error));
    }

    if (pago.accionPendiente) {
      await crearBorrador(
        telefono,
        "actualizar_pago",
        mensaje,
        pago.accionPendiente
      );
    }

    await enviarMensajeWhatsApp(telefono, texto(pago.respuesta));
    return;
  }

  const interpretarRes = await interpretarTrabajo(jsonRequest({ mensaje }));
  const borradorTrabajo = await leerJson(interpretarRes);

  if (!interpretarRes.ok) {
    throw new Error(texto(borradorTrabajo.detalle) || texto(borradorTrabajo.error));
  }

  await crearBorrador(telefono, "registro_trabajo", mensaje, borradorTrabajo);
  await enviarMensajeWhatsApp(telefono, resumenTrabajo(borradorTrabajo));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    verifyToken === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const payload = (await req.json()) as unknown;
  const mensaje = extraerMensaje(payload);

  if (mensaje) {
    after(async () => {
      try {
        await procesarMensaje(mensaje.from, mensaje.text?.body || "");
      } catch (error) {
        console.error("Error procesando WhatsApp:", error);

        try {
          await enviarMensajeWhatsApp(
            mensaje.from,
            "Hubo un error procesando tu mensaje. Intenta de nuevo."
          );
        } catch (sendError) {
          console.error("Error enviando mensaje de error:", sendError);
        }
      }
    });
  }

  return NextResponse.json({ ok: true });
}
