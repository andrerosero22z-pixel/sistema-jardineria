import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/api";
import { detalleError, lanzarErrorSupabase } from "@/lib/supabase/errors";

export const runtime = "nodejs";

type TipoAsistente =
  | "consultar_pagos"
  | "consultar_recordatorios"
  | "registrar_trabajo"
  | "actualizar_pago"
  | "desconocido";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

type SupabaseServerClient = Awaited<ReturnType<typeof createApiSupabaseClient>>;

type ClienteResumen = {
  nombre?: string | null;
  telefono?: string | null;
};

type PropiedadResumen = {
  nombre_propiedad?: string | null;
  ciudad?: string | null;
  sector?: string | null;
  direccion?: string | null;
  cliente?: ClienteResumen | null;
};

type OrdenPendiente = {
  id_orden: string;
  fecha_servicio?: string | null;
  total_general?: number | string | null;
  nota_trabajo?: string | null;
  propiedad?: PropiedadResumen | null;
};

type RecordatorioPendiente = {
  id_recordatorio: string;
  fecha_recordatorio?: string | null;
  mensaje?: string | null;
  estado_recordatorio?: string | null;
  orden_servicio?: {
    id_orden?: string | null;
    fecha_servicio?: string | null;
    propiedad?: PropiedadResumen | null;
  } | null;
};

async function clasificarIntencion(mensaje: string): Promise<TipoAsistente> {
  const prompt = `
Eres un clasificador de intención para un sistema familiar de jardinería.

Debes leer el mensaje del usuario y decidir qué quiere hacer.

Categorías posibles:

- consultar_pagos: cuando el usuario quiere saber quién debe, quién no pagó, qué trabajos están pendientes de pago, a quién falta cobrar, quién falta que cancele, cuánto falta cobrar, trabajos fiados o deudas.
- consultar_recordatorios: cuando el usuario quiere saber qué recordatorios tiene, a quién toca volver, qué trabajos toca revisar, visitas pendientes, trabajos por recordar o recordatorios vencidos/próximos.
- registrar_trabajo: cuando el usuario está contando un trabajo realizado, un servicio, una venta, una poda, mantenimiento, fumigación, productos usados, pagos o registro de una visita.
- actualizar_pago: cuando el usuario dice que alguien ya pagó, canceló, pagó todo, pagó por transferencia o efectivo, pide marcar un trabajo como pagado, cambiarlo a pagado o confirmar un pago pendiente. No lo confundas con registrar un trabajo nuevo.
- desconocido: cuando no se entiende qué quiere hacer.

Mensaje del usuario: ${JSON.stringify(mensaje)}

Responde únicamente en JSON válido con esta forma:
{
  "tipo": "consultar_pagos" | "consultar_recordatorios" | "registrar_trabajo" | "actualizar_pago" | "desconocido"
}

No agregues explicación.
`;

  const modelos = ["gemini-3.1-flash-lite", "gemini-2.5-flash"];
  const tiposValidos: TipoAsistente[] = [
    "consultar_pagos",
    "consultar_recordatorios",
    "registrar_trabajo",
    "actualizar_pago",
    "desconocido",
  ];

  let ultimoError: unknown = null;

  for (const modelo of modelos) {
    for (let intento = 1; intento <= 2; intento++) {
      try {
        const response = await ai.models.generateContent({
          model: modelo,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                tipo: {
                  type: Type.STRING,
                  enum: tiposValidos,
                },
              },
              required: ["tipo"],
            },
          },
        });

        const data = JSON.parse(response.text ?? "{}") as {
          tipo?: string;
        };

        if (tiposValidos.includes(data.tipo as TipoAsistente)) {
          return data.tipo as TipoAsistente;
        }

        return "desconocido";
      } catch (error: unknown) {
        ultimoError = error;

        const mensajeError =
          error instanceof Error ? error.message : String(error);
        const esSaturacion =
          mensajeError.includes("503") ||
          mensajeError.includes("UNAVAILABLE") ||
          mensajeError.includes("high demand");

        if (!esSaturacion) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 1500 * intento));
      }
    }
  }

  throw ultimoError;
}

function dinero(valor: number | string | null | undefined) {
  return `$${Number(valor || 0).toFixed(2)}`;
}

function nombrePropiedad(propiedad: PropiedadResumen | null | undefined) {
  return propiedad?.nombre_propiedad || "Sin propiedad";
}

function mensajeCorto(mensaje: string | null | undefined) {
  const limpio = (mensaje || "").replace(/\s+/g, " ").trim();

  if (!limpio) {
    return "";
  }

  const normalizado = limpio
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    normalizado.includes("recordatorio de seguimiento del servicio realizado")
  ) {
    return "";
  }

  if (limpio.length <= 60) {
    return ` — ${limpio}`;
  }

  return ` — ${limpio.slice(0, 60).trim()}...`;
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

function textoDias(fechaISO: string | null | undefined) {
  if (!fechaISO) {
    return "sin fecha";
  }

  const dias = diferenciaDias(fechaISO);

  if (dias > 1) {
    return `faltan ${dias} días`;
  }

  if (dias === 1) {
    return "falta 1 día";
  }

  if (dias === 0) {
    return "vence hoy";
  }

  const vencido = Math.abs(dias);
  return vencido === 1
    ? "vencido ayer"
    : `vencido hace ${vencido} días`;
}

async function consultarPagos(supabase: SupabaseServerClient) {
  const { data: ordenes, error } = await supabase
    .from("orden_servicio")
    .select(
      `
      id_orden,
      fecha_servicio,
      total_general,
      nota_trabajo,
      propiedad (
        nombre_propiedad,
        ciudad,
        sector,
        direccion,
        cliente (
          nombre,
          telefono
        )
      )
    `
    )
    .eq("estado_pago", "pendiente")
    .eq("estado_orden", "realizada")
    .order("fecha_servicio", { ascending: false });

  if (error) {
    lanzarErrorSupabase(error);
  }

  const datos = (ordenes ?? []) as OrdenPendiente[];

  if (datos.length === 0) {
    return {
      tipo: "consultar_pagos" as const,
      respuesta: "No tienes trabajos pendientes de pago.",
      datos,
    };
  }

  const total = datos.reduce((suma, orden) => {
    return suma + Number(orden.total_general || 0);
  }, 0);

  const lineas = datos.map((orden, index) => {
    const propiedad = orden.propiedad;
    const cliente = propiedad?.cliente?.nombre || "Sin cliente";
    const lugar = nombrePropiedad(propiedad);

    return `${index + 1}. ${cliente} — ${lugar} — ${orden.fecha_servicio} — ${dinero(
      orden.total_general
    )}`;
  });

  return {
    tipo: "consultar_pagos" as const,
    respuesta: [
      `Tienes ${datos.length} trabajos pendientes de pago.`,
      `Total pendiente: ${dinero(total)}`,
      "",
      ...lineas,
    ].join("\n"),
    datos,
  };
}

async function consultarRecordatorios(supabase: SupabaseServerClient) {
  const { data: recordatorios, error } = await supabase
    .from("recordatorio")
    .select(
      `
      id_recordatorio,
      fecha_recordatorio,
      mensaje,
      estado_recordatorio,
      orden_servicio (
        id_orden,
        fecha_servicio,
        propiedad (
          nombre_propiedad,
          ciudad,
          sector,
          direccion,
          cliente (
            nombre,
            telefono
          )
        )
      )
    `
    )
    .eq("estado_recordatorio", "pendiente")
    .order("fecha_recordatorio", { ascending: true });

  if (error) {
    lanzarErrorSupabase(error);
  }

  const todos = (recordatorios ?? []) as RecordatorioPendiente[];
  const datos = todos.filter((recordatorio) => {
    const dias = recordatorio.fecha_recordatorio
      ? diferenciaDias(recordatorio.fecha_recordatorio)
      : 0;

    return dias >= -7;
  });
  const viejosOcultos = todos.length - datos.length;

  if (datos.length === 0) {
    const extra =
      viejosOcultos > 0
        ? ` Además, hay ${viejosOcultos} recordatorios vencidos hace más de 7 días que no se muestran.`
        : "";

    return {
      tipo: "consultar_recordatorios" as const,
      respuesta: `No tienes recordatorios pendientes próximos o recientes.${extra}`,
      datos,
    };
  }

  const lineas = datos.map((recordatorio, index) => {
    const orden = recordatorio.orden_servicio;
    const propiedad = orden?.propiedad;
    const cliente = propiedad?.cliente?.nombre || "Sin cliente";
    const lugar = nombrePropiedad(propiedad);
    const mensaje = mensajeCorto(recordatorio.mensaje);

    return `${index + 1}. ${cliente} — ${lugar} — ${
      recordatorio.fecha_recordatorio
    } — ${textoDias(recordatorio.fecha_recordatorio)}${mensaje}`;
  });

  const respuesta = [
    `Tienes ${datos.length} recordatorios pendientes próximos o recientes:`,
    "",
    ...lineas,
  ];

  if (viejosOcultos > 0) {
    respuesta.push(
      `Además, hay ${viejosOcultos} recordatorios vencidos hace más de 7 días que no se muestran.`
    );
  }

  return {
    tipo: "consultar_recordatorios" as const,
    respuesta: respuesta.join("\n"),
    datos,
  };
}

export async function POST(req: Request) {
  try {
    const { mensaje } = await req.json();

    if (!mensaje || typeof mensaje !== "string") {
      return NextResponse.json(
        { error: "Debes enviar un mensaje de texto." },
        { status: 400 }
      );
    }

    const tipo = await clasificarIntencion(mensaje);

    if (tipo === "registrar_trabajo" || tipo === "actualizar_pago") {
      return NextResponse.json({
        tipo,
        respuesta: "",
        datos: [],
      });
    }

    if (tipo === "desconocido") {
      return NextResponse.json({
        tipo,
        respuesta:
          "No entendí bien. Puedes pedirme pagos pendientes, recordatorios o registrar un trabajo.",
        datos: [],
      });
    }

    const supabase = await createApiSupabaseClient(req);

    await supabase.auth.getUser();

    if (tipo === "consultar_pagos") {
      return NextResponse.json(await consultarPagos(supabase));
    }

    return NextResponse.json(await consultarRecordatorios(supabase));
  } catch (error: unknown) {
    console.error("Error consultando asistente:", error);

    return NextResponse.json(
      {
        error: "Error al consultar el asistente.",
        detalle: detalleError(error),
      },
      { status: 500 }
    );
  }
}
