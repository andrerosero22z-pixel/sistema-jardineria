import { GoogleGenAI, Type } from "@google/genai";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type DatosPagoExtraidos = {
  cliente_nombre: string;
  monto_pagado: number;
  metodo_pago: string;
  fecha_pago: string;
  pago_total: boolean;
  mes_pago: string;
  fecha_trabajo: string;
  monto_referencia: number;
  propiedad_nombre: string;
  usar_ultimo_trabajo: boolean;
  servicio_nombre: string;
  solo_servicio: boolean;
};

type OrdenPendiente = {
  id_orden: string;
  fecha_servicio?: string | null;
  total_general?: number | string | null;
  propiedad?: {
    nombre_propiedad?: string | null;
    cliente?: {
      nombre?: string | null;
      telefono?: string | null;
    } | null;
  } | null;
};

type OpcionPago = {
  id_orden: string;
  cliente: string;
  propiedad: string;
  fecha_servicio: string | null;
  total_pendiente: number;
};

type AccionPagoPendiente = {
  estado:
    | "seleccionar_orden"
    | "falta_metodo"
    | "confirmar_monto_completo"
    | "confirmar_pago"
    | "confirmar_pago_grupal";
  opciones?: OpcionPago[];
  ordenes?: OpcionPago[];
  id_orden?: string;
  cliente?: string;
  propiedad?: string;
  fecha_servicio?: string | null;
  total_pendiente?: number;
  monto_pagado?: number;
  monto_mencionado?: number;
  metodo_pago?: string;
  fecha_pago?: string;
  pago_total?: boolean;
};

function mensajeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function dinero(valor: number | string | null | undefined) {
  return `$${Number(valor || 0).toFixed(2)}`;
}

function fechaActualEcuador() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizarTexto(texto: string) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(senor|senora|sr|sra|doctor|doctora|dr|dra|don|dona)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarMetodoPago(metodo: string) {
  const texto = normalizarTexto(metodo);

  if (texto.includes("transfer")) return "transferencia";
  if (texto.includes("efectivo")) return "efectivo";
  if (texto.includes("deposit")) return "deposito";

  return "";
}

function esConfirmarPago(mensaje: string) {
  return normalizarTexto(mensaje).includes("confirmar pago");
}

function esRespuestaSi(mensaje: string) {
  const texto = normalizarTexto(mensaje);
  return (
    texto === "si" ||
    texto.includes("si marcar") ||
    texto.includes("pagado completo") ||
    texto.includes("marcar completo") ||
    texto.includes("todo pagado")
  );
}

function numero(valor: unknown) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function totalOrdenes(opciones: OpcionPago[] | undefined) {
  return (opciones || []).reduce(
    (suma, opcion) => suma + Number(opcion.total_pendiente || 0),
    0
  );
}

function fechaEnMes(fecha: string | null | undefined, mes: string) {
  return Boolean(fecha && mes && fecha.startsWith(`${mes}-`));
}

function montoParecido(total: number | string | null | undefined, monto: number) {
  if (monto <= 0) return true;

  return Math.abs(Number(total || 0) - monto) <= 0.5;
}

function coincidePropiedad(orden: OrdenPendiente, propiedadBuscada: string) {
  const propiedad = normalizarTexto(orden.propiedad?.nombre_propiedad || "");
  const buscada = normalizarTexto(propiedadBuscada);

  if (!buscada) return true;
  if (!propiedad) return false;

  return propiedad.includes(buscada) || buscada.includes(propiedad);
}

function aOpcionPago(orden: OrdenPendiente): OpcionPago {
  const propiedad = orden.propiedad;

  return {
    id_orden: orden.id_orden,
    cliente: propiedad?.cliente?.nombre || "Sin cliente",
    propiedad: propiedad?.nombre_propiedad || "Sin propiedad",
    fecha_servicio: orden.fecha_servicio || null,
    total_pendiente: numero(orden.total_general),
  };
}

function coincideCliente(orden: OrdenPendiente, clienteBuscado: string) {
  const cliente = normalizarTexto(orden.propiedad?.cliente?.nombre || "");
  const buscado = normalizarTexto(clienteBuscado);

  if (!cliente || !buscado) return false;
  if (cliente.includes(buscado) || buscado.includes(cliente)) return true;

  const palabras = buscado.split(" ").filter((palabra) => palabra.length >= 3);
  return palabras.length > 0 && palabras.every((palabra) => cliente.includes(palabra));
}

function lineaOpcion(opcion: OpcionPago, index: number) {
  return `${index + 1}. ${opcion.fecha_servicio || "Sin fecha"} — ${
    opcion.propiedad
  } — ${dinero(opcion.total_pendiente)}`;
}

function accionDesdeOpcion(
  opcion: OpcionPago,
  datos: Partial<DatosPagoExtraidos>
): AccionPagoPendiente {
  const metodoPago = normalizarMetodoPago(datos.metodo_pago || "");
  const montoMencionado = numero(datos.monto_pagado);
  const totalPendiente = opcion.total_pendiente;
  const pagoTotal = datos.pago_total === true;
  const montoPagado =
    pagoTotal || montoMencionado <= 0 ? totalPendiente : montoMencionado;

  return {
    estado: "confirmar_pago",
    id_orden: opcion.id_orden,
    cliente: opcion.cliente,
    propiedad: opcion.propiedad,
    fecha_servicio: opcion.fecha_servicio,
    total_pendiente: totalPendiente,
    monto_pagado: montoPagado,
    monto_mencionado: montoMencionado > 0 ? montoMencionado : undefined,
    metodo_pago: metodoPago,
    fecha_pago: datos.fecha_pago || fechaActualEcuador(),
    pago_total: pagoTotal,
  };
}

function accionNecesitaMontoCompleto(accion: AccionPagoPendiente) {
  const montoMencionado = numero(accion.monto_mencionado);
  const totalPendiente = numero(accion.total_pendiente);

  return montoMencionado > 0 && montoMencionado < totalPendiente && !accion.pago_total;
}

function respuestaConfirmacion(accion: AccionPagoPendiente) {
  if (accion.ordenes?.length) {
    const ordenes = accion.ordenes || [];

    return [
      "Encontre estos pagos pendientes:",
      "",
      `Cliente: ${accion.cliente || "Sin cliente"}`,
      ...ordenes.map(lineaOpcion),
      "",
      `Total a registrar: ${dinero(totalOrdenes(ordenes))}`,
      `Forma de pago: ${accion.metodo_pago || "Falta indicar"}`,
      "",
      "Responde CONFIRMAR PAGO para marcar todos como pagados o escribe una correccion.",
    ].join("\n");
  }

  return [
    "Encontre este pago pendiente:",
    "",
    `Cliente: ${accion.cliente || "Sin cliente"}`,
    `Propiedad: ${accion.propiedad || "Sin propiedad"}`,
    `Fecha del trabajo: ${accion.fecha_servicio || "Sin fecha"}`,
    `Total pendiente: ${dinero(accion.total_pendiente)}`,
    `Pago recibido: ${dinero(accion.monto_pagado)}`,
    `Forma de pago: ${accion.metodo_pago || "Falta indicar"}`,
    "",
    "Responde CONFIRMAR PAGO para marcarlo como pagado o escribe una correccion.",
  ].join("\n");
}

function prepararRespuestaAccion(accion: AccionPagoPendiente) {
  if (!accion.metodo_pago) {
    return {
      ...accion,
      estado: "falta_metodo" as const,
    };
  }

  if (accionNecesitaMontoCompleto(accion)) {
    return {
      ...accion,
      estado: "confirmar_monto_completo" as const,
    };
  }

  return {
    ...accion,
    estado: "confirmar_pago" as const,
  };
}

function respuestaParaAccion(accion: AccionPagoPendiente) {
  if (accion.estado === "falta_metodo") {
    return [
      respuestaConfirmacion(accion),
      "",
      "Como pago: efectivo o transferencia?",
    ].join("\n");
  }

  if (accion.estado === "confirmar_monto_completo") {
    return `El total pendiente es ${dinero(
      accion.total_pendiente
    )} y mencionaste ${dinero(
      accion.monto_mencionado
    )}. Quieres marcarlo como pagado completo?`;
  }

  return respuestaConfirmacion(accion);
}

async function extraerDatosPago(mensaje: string): Promise<DatosPagoExtraidos> {
  const hoy = fechaActualEcuador();
  const prompt = `
Eres un extractor de datos para actualizar pagos de un sistema familiar de jardineria.

Lee el mensaje y extrae:
- cliente_nombre si aparece.
- monto_pagado si aparece, solo numero.
- metodo_pago si aparece: efectivo, transferencia, deposito u otro texto corto.
- fecha_pago en formato YYYY-MM-DD. Si no aparece fecha, usa ${hoy}.
- pago_total: true si dice que pago todo, cancelo todo, ya cancelo o ya esta pagado completo.
- mes_pago en formato YYYY-MM si el usuario dice que pago todo un mes, por ejemplo "lo de mayo", "todo junio" o "el mes de mayo". Si no aparece, vacio.
- fecha_trabajo en formato YYYY-MM-DD si menciona el trabajo de una fecha exacta, por ejemplo "del 14 de mayo". Si no aparece, vacio.
- monto_referencia si dice "el de 100 dolares" o un monto que identifica el trabajo. Si no aparece, 0.
- propiedad_nombre si menciona una propiedad, barrio, quinta, urbanizacion o lugar. Si no aparece, vacio.
- usar_ultimo_trabajo: true si dice el ultimo trabajo, el mas reciente o algo parecido.
- servicio_nombre si menciona que pago solo un servicio especifico como poda, fumigacion o mantenimiento. Si no aparece, vacio.
- solo_servicio: true si dice "solo la poda", "solo fumigacion" o que pago un servicio separado dentro del trabajo.

Mensaje: ${JSON.stringify(mensaje)}

Responde solo JSON valido.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          cliente_nombre: { type: Type.STRING },
          monto_pagado: { type: Type.NUMBER },
          metodo_pago: { type: Type.STRING },
          fecha_pago: { type: Type.STRING },
          pago_total: { type: Type.BOOLEAN },
          mes_pago: { type: Type.STRING },
          fecha_trabajo: { type: Type.STRING },
          monto_referencia: { type: Type.NUMBER },
          propiedad_nombre: { type: Type.STRING },
          usar_ultimo_trabajo: { type: Type.BOOLEAN },
          servicio_nombre: { type: Type.STRING },
          solo_servicio: { type: Type.BOOLEAN },
        },
        required: [
          "cliente_nombre",
          "monto_pagado",
          "metodo_pago",
          "fecha_pago",
          "pago_total",
          "mes_pago",
          "fecha_trabajo",
          "monto_referencia",
          "propiedad_nombre",
          "usar_ultimo_trabajo",
          "servicio_nombre",
          "solo_servicio",
        ],
      },
    },
  });

  const data = JSON.parse(response.text ?? "{}") as Partial<DatosPagoExtraidos>;

  return {
    cliente_nombre: data.cliente_nombre || "",
    monto_pagado: numero(data.monto_pagado),
    metodo_pago: normalizarMetodoPago(data.metodo_pago || ""),
    fecha_pago: data.fecha_pago || hoy,
    pago_total: data.pago_total === true,
    mes_pago: data.mes_pago || "",
    fecha_trabajo: data.fecha_trabajo || "",
    monto_referencia: numero(data.monto_referencia),
    propiedad_nombre: data.propiedad_nombre || "",
    usar_ultimo_trabajo: data.usar_ultimo_trabajo === true,
    servicio_nombre: data.servicio_nombre || "",
    solo_servicio: data.solo_servicio === true,
  };
}

async function cargarPendientes(supabase: SupabaseServerClient) {
  const { data, error } = await supabase
    .from("orden_servicio")
    .select(
      `
      id_orden,
      fecha_servicio,
      total_general,
      propiedad (
        nombre_propiedad,
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
    throw error;
  }

  return (data ?? []) as OrdenPendiente[];
}

async function cargarServiciosOrden(
  supabase: SupabaseServerClient,
  idOrden: string
) {
  const { data, error } = await supabase
    .from("detalle_servicio")
    .select(
      `
      id_detalle_servicio,
      servicio (
        nombre_servicio
      )
    `
    )
    .eq("id_orden", idOrden);

  if (error) {
    console.error("Error cargando servicios de orden:", error);
    return [];
  }

  return data ?? [];
}

async function respuestaServicioSeparadoSiAplica(
  supabase: SupabaseServerClient,
  datos: DatosPagoExtraidos,
  orden: OrdenPendiente
) {
  if (!datos.solo_servicio && !datos.servicio_nombre) {
    return null;
  }

  const servicios = await cargarServiciosOrden(supabase, orden.id_orden);

  if (servicios.length > 1) {
    return "El sistema registra pagos por trabajo completo, no por servicio separado. Ese trabajo tiene varios servicios. Quieres marcar todo el trabajo como pagado?";
  }

  return null;
}

async function obtenerUsuarioApp(supabase: SupabaseServerClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No hay usuario autenticado.", status: 401 as const };
  }

  const { data: usuarioApp } = await supabase
    .from("usuario_app")
    .select("id_usuario")
    .eq("auth_user_id", user.id)
    .single();

  if (!usuarioApp) {
    return { error: "No se encontro el usuario interno.", status: 400 as const };
  }

  return { usuarioApp };
}

async function confirmarPago(
  supabase: SupabaseServerClient,
  accion: AccionPagoPendiente,
  idUsuario: string
): Promise<string> {
  if (!accion.id_orden || !accion.metodo_pago) {
    return "Falta informacion para confirmar el pago.";
  }

  const { data: orden, error: ordenError } = await supabase
    .from("orden_servicio")
    .select("id_orden, total_general, estado_pago")
    .eq("id_orden", accion.id_orden)
    .single();

  if (ordenError || !orden || orden.estado_pago === "pagado") {
    return "No encontre ese trabajo pendiente. Tal vez ya fue marcado como pagado.";
  }

  const montoPagado = numero(accion.monto_pagado) || numero(orden.total_general);

  const { error: pagoError } = await supabase.from("pago").insert({
    id_orden: accion.id_orden,
    fecha_pago: accion.fecha_pago || fechaActualEcuador(),
    monto_pagado: montoPagado,
    metodo_pago: accion.metodo_pago,
    registrado_por: idUsuario,
  });

  if (pagoError) {
    throw pagoError;
  }

  const { error: ordenUpdateError } = await supabase
    .from("orden_servicio")
    .update({ estado_pago: "pagado" })
    .eq("id_orden", accion.id_orden);

  if (ordenUpdateError) {
    throw ordenUpdateError;
  }

  revalidatePath("/pagos");
  revalidatePath("/trabajos");
  revalidatePath(`/trabajos/${accion.id_orden}`);
  revalidatePath("/reportes");

  return `Pago registrado correctamente para ${accion.cliente || "el cliente"}.`;
}

async function confirmarPagoGrupal(
  supabase: SupabaseServerClient,
  accion: AccionPagoPendiente,
  idUsuario: string
): Promise<string> {
  const ordenes = accion.ordenes || [];

  if (ordenes.length === 0 || !accion.metodo_pago) {
    return "Falta informacion para confirmar el pago.";
  }

  for (const ordenPendiente of ordenes) {
    const { data: orden, error: ordenError } = await supabase
      .from("orden_servicio")
      .select("id_orden, total_general, estado_pago")
      .eq("id_orden", ordenPendiente.id_orden)
      .single();

    if (ordenError || !orden || orden.estado_pago === "pagado") {
      continue;
    }

    const { error: pagoError } = await supabase.from("pago").insert({
      id_orden: ordenPendiente.id_orden,
      fecha_pago: accion.fecha_pago || fechaActualEcuador(),
      monto_pagado: orden.total_general,
      metodo_pago: accion.metodo_pago,
      registrado_por: idUsuario,
    });

    if (pagoError) {
      throw pagoError;
    }

    const { error: ordenUpdateError } = await supabase
      .from("orden_servicio")
      .update({ estado_pago: "pagado" })
      .eq("id_orden", ordenPendiente.id_orden);

    if (ordenUpdateError) {
      throw ordenUpdateError;
    }

    revalidatePath(`/trabajos/${ordenPendiente.id_orden}`);
  }

  revalidatePath("/pagos");
  revalidatePath("/trabajos");
  revalidatePath("/reportes");

  return `Pago registrado correctamente para ${ordenes.length} trabajos de ${
    accion.cliente || "el cliente"
  }.`;
}

function responder(respuesta: string, accionPendiente: AccionPagoPendiente | null) {
  return NextResponse.json({
    tipo: "actualizar_pago",
    respuesta,
    datos: [],
    accionPendiente,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      mensaje?: string;
      accionPendiente?: AccionPagoPendiente | null;
    };

    const mensaje = String(body.mensaje || "").trim();

    if (!mensaje) {
      return NextResponse.json(
        { error: "Debes enviar un mensaje de texto." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const usuario = await obtenerUsuarioApp(supabase);

    if ("error" in usuario) {
      return NextResponse.json({ error: usuario.error }, { status: usuario.status });
    }

    const datos = await extraerDatosPago(mensaje);
    const accionActual = body.accionPendiente || null;

    if (accionActual?.estado === "seleccionar_orden") {
      const indice = Number(mensaje.match(/\d+/)?.[0] || 0) - 1;
      const opcion = accionActual.opciones?.[indice];

      if (!opcion) {
        return responder("Indica el numero del trabajo que pago.", accionActual);
      }

      const accion = prepararRespuestaAccion(
        accionDesdeOpcion(opcion, {
          ...datos,
          metodo_pago: datos.metodo_pago || accionActual.metodo_pago || "",
          monto_pagado: datos.monto_pagado || accionActual.monto_pagado || 0,
          pago_total: datos.pago_total || accionActual.pago_total || false,
          fecha_pago: datos.fecha_pago || accionActual.fecha_pago,
        })
      );

      return responder(respuestaParaAccion(accion), accion);
    }

    if (accionActual?.ordenes?.length) {
      const accion: AccionPagoPendiente = { ...accionActual };

      if (datos.metodo_pago) {
        accion.metodo_pago = datos.metodo_pago;
      }

      accion.estado = accion.metodo_pago
        ? "confirmar_pago_grupal"
        : "falta_metodo";

      if (esConfirmarPago(mensaje) && accion.estado === "confirmar_pago_grupal") {
        const respuesta = await confirmarPagoGrupal(
          supabase,
          accion,
          usuario.usuarioApp.id_usuario
        );

        return responder(respuesta, null);
      }

      return responder(respuestaParaAccion(accion), accion);
    }

    if (accionActual?.id_orden) {
      const accion = { ...accionActual };

      if (datos.metodo_pago) {
        accion.metodo_pago = datos.metodo_pago;
      }

      if (accion.estado === "confirmar_monto_completo") {
        if (esRespuestaSi(mensaje) || esConfirmarPago(mensaje)) {
          accion.monto_pagado = numero(accion.total_pendiente);
          accion.pago_total = true;
          accion.estado = "confirmar_pago";
          return responder(respuestaConfirmacion(accion), accion);
        }

        return responder(respuestaParaAccion(accion), accion);
      }

      const accionPreparada = prepararRespuestaAccion(accion);

      if (esConfirmarPago(mensaje) && accionPreparada.estado === "confirmar_pago") {
        const respuesta = await confirmarPago(
          supabase,
          accionPreparada,
          usuario.usuarioApp.id_usuario
        );

        return responder(respuesta, null);
      }

      return responder(respuestaParaAccion(accionPreparada), accionPreparada);
    }

    if (!datos.cliente_nombre) {
      return responder(
        "No encontre un trabajo pendiente para ese cliente. Revisa el nombre o consulta primero quienes deben.",
        null
      );
    }

    const pendientes = await cargarPendientes(supabase);
    const coincidenciasCliente = pendientes.filter((orden) =>
      coincideCliente(orden, datos.cliente_nombre)
    );

    if (coincidenciasCliente.length === 0) {
      return responder(
        "No encontre un trabajo pendiente para ese cliente. Revisa el nombre o consulta primero quienes deben.",
        null
      );
    }

    if (datos.mes_pago) {
      const coincidenciasMes = coincidenciasCliente.filter((orden) =>
        fechaEnMes(orden.fecha_servicio, datos.mes_pago)
      );

      if (coincidenciasMes.length === 0) {
        return responder(
          "No encontre trabajos pendientes de ese cliente en ese mes.",
          null
        );
      }

      const ordenes = coincidenciasMes.map(aOpcionPago);
      const accion: AccionPagoPendiente = {
        estado: datos.metodo_pago ? "confirmar_pago_grupal" : "falta_metodo",
        ordenes,
        cliente: ordenes[0]?.cliente || datos.cliente_nombre,
        total_pendiente: totalOrdenes(ordenes),
        monto_pagado: totalOrdenes(ordenes),
        metodo_pago: datos.metodo_pago,
        fecha_pago: datos.fecha_pago,
        pago_total: true,
      };

      return responder(respuestaParaAccion(accion), accion);
    }

    let coincidencias = [...coincidenciasCliente];

    if (datos.fecha_trabajo) {
      coincidencias = coincidencias.filter(
        (orden) => orden.fecha_servicio === datos.fecha_trabajo
      );
    }

    const montoFiltro = datos.monto_referencia || datos.monto_pagado;

    if (montoFiltro > 0 && !datos.pago_total) {
      coincidencias = coincidencias.filter((orden) =>
        montoParecido(orden.total_general, montoFiltro)
      );
    }

    if (datos.propiedad_nombre) {
      coincidencias = coincidencias.filter((orden) =>
        coincidePropiedad(orden, datos.propiedad_nombre)
      );
    }

    if (datos.usar_ultimo_trabajo && coincidencias.length > 1) {
      coincidencias = [coincidencias[0]];
    }

    if (coincidencias.length === 0) {
      return responder("No encontre ese trabajo pendiente.", null);
    }

    if (coincidencias.length > 1) {
      const opciones = coincidencias.slice(0, 5).map(aOpcionPago);
      const cliente = opciones[0]?.cliente || datos.cliente_nombre;
      const respuesta = [
        `Encontre varios trabajos pendientes de ${cliente}:`,
        "",
        ...opciones.map(lineaOpcion),
        "",
        "Indica cual pago.",
      ].join("\n");

      return responder(respuesta, {
        estado: "seleccionar_orden",
        opciones,
        monto_pagado: datos.monto_pagado || undefined,
        metodo_pago: datos.metodo_pago,
        fecha_pago: datos.fecha_pago,
        pago_total: datos.pago_total,
      });
    }

    const servicioSeparado = await respuestaServicioSeparadoSiAplica(
      supabase,
      datos,
      coincidencias[0]
    );

    if (servicioSeparado) {
      const accion = prepararRespuestaAccion(
        accionDesdeOpcion(aOpcionPago(coincidencias[0]), {
          ...datos,
          pago_total: true,
        })
      );

      return responder(
        [
          servicioSeparado,
          "",
          "Si quieres marcar todo el trabajo, responde CONFIRMAR PAGO.",
        ].join("\n"),
        accion
      );
    }

    const accion = prepararRespuestaAccion(
      accionDesdeOpcion(aOpcionPago(coincidencias[0]), datos)
    );

    return responder(respuestaParaAccion(accion), accion);
  } catch (error: unknown) {
    console.error("Error actualizando pago con IA:", error);

    return NextResponse.json(
      {
        error: "Error al actualizar el pago.",
        detalle: mensajeError(error),
      },
      { status: 500 }
    );
  }
}
