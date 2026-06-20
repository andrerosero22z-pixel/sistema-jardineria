import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

function fechaActualEcuador() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}





function normalizarCategoria(nombre: string, categoria: string) {
  const n = (nombre || "").toLowerCase();
  const c = (categoria || "").toLowerCase();

  if (n.includes("botada") || n.includes("basura") || n.includes("rama")) {
    return "basura";
  }

  if (n.includes("fumig")) {
    return "fumigacion";
  }

  if (
    n.includes("planta") ||
    n.includes("abono") ||
    n.includes("fertilizante") ||
    n.includes("tierra negra")
  ) {
    return "productos";
  }

  if (
    n.includes("mantenimiento") ||
    n.includes("jardín") ||
    n.includes("jardin") ||
    n.includes("césped") ||
    n.includes("cesped") ||
    n.includes("poda") ||
    n.includes("fertilización") ||
    n.includes("fertilizacion")
  ) {
    return "jardineria";
  }

  if (
    c === "jardineria" ||
    c === "fumigacion" ||
    c === "basura" ||
    c === "productos" ||
    c === "otros"
  ) {
    return c;
  }

  return "otros";
}

export async function POST(req: Request) {
  try {
    const { mensaje, borradorActual } = await req.json();

    if (!mensaje || typeof mensaje !== "string") {
      return NextResponse.json(
        { error: "Debes enviar un mensaje de texto." },
        { status: 400 }
      );
    }

    const fechaActual = fechaActualEcuador();
    const supabase = await createClient();

const { data: serviciosCatalogo } = await supabase
  .from("servicio")
  .select("id_servicio, nombre_servicio")
  .eq("estado_servicio", "activo")
  .order("nombre_servicio");

const listaServiciosCatalogo =
  serviciosCatalogo && serviciosCatalogo.length > 0
    ? serviciosCatalogo.map((s: any) => `- ${s.nombre_servicio}`).join("\n")
    : "- mantenimiento de jardín\n- poda\n- fumigación\n- botada de basura vegetal\n- otros";

    const prompt = `
Eres un asistente administrativo para un negocio familiar de jardinería en Ecuador.

Tu función es ayudar a los trabajadores a registrar trabajos realizados después de hacer el servicio.
La persona puede escribir de forma incompleta, con palabras simples o como habla normalmente.
Debes ordenar la información, detectar lo que falta y hacer preguntas cortas.

CONTEXTO DEL NEGOCIO:
- El negocio realiza servicios de jardinería y mantenimiento.
- Los trabajos normalmente se registran después de realizarlos.
- Un cliente puede tener una o varias propiedades.
- Se manejan trabajos, servicios, productos, pagos pendientes, recordatorios y observaciones.
- A veces los trabajadores se olvidan de decir precios, pago, productos o servicios adicionales.
- El sistema debe ayudar a completar la información antes de guardar.
- No debes guardar nada directamente.
- Siempre debe existir confirmación antes de guardar.

FECHA:
- Fecha actual en Ecuador: ${fechaActual}.
- Si no se menciona fecha, usa la fecha actual.
- Si dice "hoy", usa la fecha actual.
- Si dice "ayer", usa la fecha anterior.
- Si menciona una fecha específica como "13 de mayo", úsala.
- Si dice "mañana", normalmente interprétalo como recordatorio, no como fecha de trabajo, salvo que el usuario diga claramente que el trabajo será mañana.
- La fecha es obligatoria, pero se puede asumir como hoy si no se menciona.

SERVICIOS COMUNES:
- mantenimiento de jardín
- corte de césped
- poda
- botada de basura vegetal
- fumigación de plantas
- fumigación de maleza
- fertilización
- sacada de árboles
- botado de tierra negra
- limpieza de jardín
- retiro de ramas
- venta de plantas
- venta de abono
- otros

La categoria del servicio debe ser exactamente una de estas:
jardineria, fumigacion, basura, productos, otros.

No uses otras categorías como "servicio" o "mantenimiento".


REGLAS PARA TRABAJOS FUERA DE JARDINERÍA:
- Si el usuario menciona un trabajo que no está en la lista normal de jardinería, pero fue realizado y cobrado, clasifícalo como servicio con categoría "otros".
- Ejemplos de otros: limpieza de reservorio, lavado de patio, mover materiales, cargar sacos, transporte, arreglo pequeño, ayuda adicional, colocación de algas, limpieza de lodo.
- No elimines trabajos raros. Si se cobraron, deben registrarse como "otros".
- Conserva el nombre real del trabajo en el campo nombre.

REGLAS PARA PRODUCTOS CON COSTO Y VENTA:
- Si el usuario dice que compró un producto y luego lo cobró al cliente, debe registrarse como producto vendido/usado en el trabajo.
- Si dice "100 algas nos costaron 15", entonces costo total = 15 y costo unitario = 15 / 100 = 0.15.
- Si dice "se cobraron a 0.50 cada una", entonces precio_venta_unitario = 0.50 y subtotal_venta = cantidad * precio_venta_unitario.
- El total a cobrar al cliente incluye servicios + subtotal_venta de productos.
- El costo del producto NO se suma al total cobrado al cliente; sirve para calcular ganancia.
- Si falta el costo del producto, ponlo en faltan_opcionales.
- Si falta el precio de venta del producto y afecta el cobro, ponlo en faltan_bloqueantes.
- Si el producto no existe claramente en el catálogo, no inventes id_producto. Marca "producto no encontrado".

REGLAS PARA CLIENTES PARECIDOS:
- Si el sistema muestra varios clientes posibles y el usuario responde "el primero", "el segundo", "el de arriba", "el doctor Fernando", "la doctora Liseth" o escribe parte del nombre, debes actualizar el cliente al candidato correcto.
- No inventes cliente.
- Si el usuario aclara cuál cliente es, usa el nombre exacto del cliente encontrado.
- Si todavía hay duda, pregunta de nuevo.

PRODUCTOS COMUNES:
- plantas
- abono
- fertilizante
- tierra negra
- saquillos
- químicos para fumigar

DATOS BLOQUEANTES:
Si falta cualquiera de estos datos, NO se puede confirmar el guardado:
- cliente_nombre
- al menos un servicio o producto
- total del trabajo
- pago claro, es decir: pagó todo, pagó una parte o quedó pendiente

DATOS NO BLOQUEANTES:
Estos datos son importantes, pero NO deben impedir guardar:
- propiedad_o_sector
- forma_pago
- observaciones
- recordatorio
- detalle adicional
REGLAS PARA RECORDATORIOS:
- El recordatorio es opcional, pero antes de guardar siempre se debe preguntar una vez si quiere dejar recordatorio.
- Si el usuario no menciona recordatorio y tampoco ha dicho que no quiere, agrega "confirmar_recordatorio" en faltan_bloqueantes, coloca listo_para_confirmar en false y pregunta: "¿Quieres dejar un recordatorio? Puedes decir: no, o recuérdame en 15 días."
- Si el usuario responde “no”, “no quiero”, “sin recordatorio”, “no hace falta” o algo similar, deja recordatorio_dias en 0, fecha_recordatorio vacío y mensaje_recordatorio vacío. En ese caso el recordatorio ya no debe impedir guardar.
- Si el usuario dice “recuérdame en X días”, “volver en X días”, “revisar en X días” o algo parecido, calcula la fecha desde fecha_trabajo, coloca recordatorio_dias y fecha_recordatorio.
- Si el usuario pide recordatorio pero no dice cuántos días, agrega "recordatorio_dias" en faltan_bloqueantes, coloca listo_para_confirmar en false y pregunta: "¿En cuántos días quieres el recordatorio?"
- No inventes días de recordatorio. Si no se indica la cantidad de días, pregunta.


REGLAS DE SERVICIOS:
- Si menciona "botada", normalmente interpreta como botada de basura vegetal.
- Si menciona "fumigar maleza", clasifica como fumigación de maleza.
- Si menciona "fumigar plantas", clasifica como fumigación de plantas.
- Si dice "mantenimiento", interpreta como mantenimiento de jardín.
- Si dice "lo mismo", "como siempre" o "lo de siempre", NO inventes servicios. Debes poner "detalle del servicio" en faltan_bloqueantes.
- Si menciona un servicio pero no dice precio y tampoco hay total general, pon "total o precio del servicio" en faltan_bloqueantes.
- Si menciona varios servicios y solo da un total general, se puede confirmar, pero agrega "precios individuales de servicios" en faltan_opcionales.
- Si el usuario menciona un trabajo que no es claramente de jardinería, pero fue realizado y cobrado, clasifícalo como servicio "otros".
- No elimines servicios no relacionados a jardinería. Si se cobraron o forman parte del trabajo, deben registrarse.
- En servicios "otros", conserva el nombre real de lo que dijo el usuario.
- Ejemplos de "otros": limpieza general, mover objetos, cargar sacos, transporte de materiales, lavado de patio, ayuda adicional, arreglo pequeño.
- Si el servicio "otros" tiene precio, inclúyelo normalmente en el total.
- Si el servicio "otros" no tiene precio y no hay total general, pon "precio del servicio otros" en faltan_bloqueantes.
SERVICIOS REGISTRADOS EN EL SISTEMA:
${listaServiciosCatalogo}

REGLA IMPORTANTE SOBRE SERVICIOS:
- Si el trabajo coincide con un servicio registrado, usa ese nombre.
- Si el trabajo no existe en el catálogo, clasifícalo como categoría "otros".
- Ejemplos de otros: limpieza de reservorio, colocación de algas, limpieza de lodo, lavado de patio, mover materiales.
REGLAS DE PRODUCTOS:
- Si menciona plantas, abono, fertilizante, tierra negra o saquillos, debes detectar si fue venta, compra o uso.
- Si no está claro si fue venta, compra o uso, pon tipo "no_claro".
- Si el producto afecta el cobro al cliente y no hay cantidad o precio, ponlo en faltan_bloqueantes.
- Si fue una compra interna del negocio y falta detalle, ponlo en faltan_opcionales, salvo que el usuario quiera registrar la compra como gasto.
- Si dice "compramos plantas", no lo tomes automáticamente como venta al cliente. Pregunta si fue compra para el trabajo o venta al cliente.
- Si dice "vendimos plantas", debe tener cantidad y precio, o total de venta.

REGLAS DE PAGOS:
- Si dice "pagó todo", entonces pagado = total y pendiente = 0.
- Si dice "quedó debiendo X", entonces pendiente = X.
- Si hay total y pendiente, calcula pagado = total - pendiente.
- Si hay pagado y pendiente, calcula total = pagado + pendiente.
- Si hay servicios con precios, calcula el total.
- Si no se sabe si pagó todo, pagó una parte o quedó pendiente, pon "estado del pago" en faltan_bloqueantes.
- Si menciona transferencia, efectivo o depósito, ponlo en forma_pago.
- Si no menciona forma de pago, déjalo vacío y agrégalo en faltan_opcionales.
- Si el usuario dice "quedó pendiente", "queda pendiente", "no pagó", "debe todo" o "queda por pagar", entonces pagado = 0 y pendiente = total.
- Si pagado = 0, deja forma_pago vacío aunque el usuario haya mencionado transferencia de forma confusa.
- Solo coloca forma_pago si realmente hubo un monto pagado.
- Si todo quedó pendiente, no pongas "transferencia", "efectivo" ni "depósito" como forma de pago.
PROPIEDAD:
- La propiedad o sector no bloquea el análisis inicial.
- No inventes la propiedad.
- Si el usuario no menciona propiedad, deja propiedad_o_sector vacío.
- Si el usuario dice "la única que tiene", "la de siempre" o "la misma propiedad", marca que se debe resolver con la base de datos.
- Si hay una sola propiedad registrada para el cliente, el sistema puede usarla automáticamente.
- Si hay varias propiedades registradas, se debe preguntar cuál.
- Si el usuario dice "la única que tiene", "la unica que tiene", "la de siempre" o "la misma propiedad", NO pongas esa frase en propiedad_o_sector.
- En ese caso deja propiedad_o_sector vacío.
- Agrega "resolver propiedad con base de datos" en faltan_opcionales.
- La propiedad real debe buscarse en Supabase, no inventarse.

REGLAS DE CONVERSACIÓN:
- Haz máximo 3 preguntas a la vez.
- Las preguntas deben ser simples y claras.
- No uses lenguaje técnico.
- Si faltan datos bloqueantes, listo_para_confirmar debe ser false.
- Si no faltan datos bloqueantes, listo_para_confirmar debe ser true.
- Si solo faltan datos opcionales, permite confirmar.
- Si listo_para_confirmar es true, pregunta_siguiente debe pedir confirmación o preguntar si desea agregar algo más.
- Si listo_para_confirmar es false, pregunta_siguiente debe preguntar primero por los datos bloqueantes.
- Nunca inventes cliente, precios, cantidades ni pagos.
- Antes de confirmar, genera un resumen claro mediante los campos JSON.

${borradorActual ? `
BORRADOR ACTUAL:
${JSON.stringify(borradorActual, null, 2)}

El usuario quiere agregar, corregir o completar información sobre este borrador.
No empieces desde cero si ya hay datos válidos.
Actualiza el borrador con el nuevo mensaje.
` : ""}

Mensaje del usuario:
"${mensaje}"
`;

    async function llamarGeminiConReintentos(prompt: string) {
  const modelos = [
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
  ];

  let ultimoError: any = null;

  for (const modelo of modelos) {
    for (let intento = 1; intento <= 3; intento++) {
      try {
        return await ai.models.generateContent({
          model: modelo,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
  type: Type.OBJECT,
  properties: {
    fecha_trabajo: { type: Type.STRING },
    cliente_nombre: { type: Type.STRING },
    propiedad_o_sector: { type: Type.STRING },
    recordatorio_dias: { type: Type.NUMBER },
fecha_recordatorio: { type: Type.STRING },
mensaje_recordatorio: { type: Type.STRING },

    servicios: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nombre: { type: Type.STRING },
          categoria: { type: Type.STRING },
          cantidad: { type: Type.NUMBER },
          precio_unitario: { type: Type.NUMBER },
          total: { type: Type.NUMBER },
        },
        required: [
          "nombre",
          "categoria",
          "cantidad",
          "precio_unitario",
          "total",
          "recordatorio_dias",
"fecha_recordatorio",
"mensaje_recordatorio",
        ],
      },
    },

    productos: {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      nombre: { type: Type.STRING },
      tipo: { type: Type.STRING },
      lugar_compra: { type: Type.STRING },
      cantidad: { type: Type.NUMBER },
      costo_unitario: { type: Type.NUMBER },
      subtotal_costo: { type: Type.NUMBER },
      precio_venta_unitario: { type: Type.NUMBER },
      subtotal_venta: { type: Type.NUMBER },
      ganancia_producto: { type: Type.NUMBER },
      producto_en_catalogo: { type: Type.BOOLEAN },
    },
    required: [
      "nombre",
      "tipo",
      "lugar_compra",
      "cantidad",
      "costo_unitario",
      "subtotal_costo",
      "precio_venta_unitario",
      "subtotal_venta",
      "ganancia_producto",
      "producto_en_catalogo",
    ],
  },
},

    total: { type: Type.NUMBER },
    pagado: { type: Type.NUMBER },
    pendiente: { type: Type.NUMBER },
    forma_pago: { type: Type.STRING },
    observaciones: { type: Type.STRING },
    recordatorio: { type: Type.STRING },

    faltan_bloqueantes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },

    faltan_opcionales: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },

    pregunta_siguiente: { type: Type.STRING },
    listo_para_confirmar: { type: Type.BOOLEAN },
  },

  required: [
    "fecha_trabajo",
    "cliente_nombre",
    "propiedad_o_sector",
    "servicios",
    "productos",
    "total",
    "pagado",
    "pendiente",
    "forma_pago",
    "observaciones",
    "recordatorio",
    "faltan_bloqueantes",
    "faltan_opcionales",
    "pregunta_siguiente",
    "listo_para_confirmar",
  ],
}
          },
        });
      } catch (error: any) {
        ultimoError = error;

        const mensaje = error?.message ?? "";
        const esSaturacion =
          mensaje.includes("503") ||
          mensaje.includes("UNAVAILABLE") ||
          mensaje.includes("high demand");

        if (!esSaturacion) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 3000 * intento));
      }
    }
  }

  throw ultimoError;
}
const response = await llamarGeminiConReintentos(prompt);

    const texto = response.text ?? "{}";
    const data = JSON.parse(texto);
    const totalDetectado = Number(data.total || 0);
const pagadoDetectado = Number(data.pagado || 0);
const pendienteDetectado = Number(data.pendiente || 0);

if (totalDetectado > 0 && pagadoDetectado === 0 && pendienteDetectado > 0) {
  data.forma_pago = "";

  data.faltan_opcionales = (data.faltan_opcionales || []).filter(
    (dato: string) =>
      dato !== "forma_pago" &&
      dato !== "forma de pago"
  );
}

    data.faltan_bloqueantes = (data.faltan_bloqueantes || []).filter(
  (dato: string) => dato !== "propiedad_o_sector"
);

if (
  !data.propiedad_o_sector &&
  !(data.faltan_opcionales || []).includes("propiedad_o_sector")
) {
  data.faltan_opcionales = [
    ...(data.faltan_opcionales || []),
    "propiedad_o_sector",
  ];
}
    




   


function normalizarTextoBusqueda(texto: string) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bsra\.?\b/g, "")
    .replace(/\bsr\.?\b/g, "")
    .replace(/\bdra\.?\b/g, "")
    .replace(/\bdr\.?\b/g, "")
    .replace(/\bdoctora\b/g, "")
    .replace(/\bdoctor\b/g, "")
    .replace(/\bdona\b/g, "")
    .replace(/\bdoña\b/g, "")
    .replace(/\bdon\b/g, "")
    .replace(/\bseñora\b/g, "")
    .replace(/\bsenora\b/g, "")
    .replace(/\bseñor\b/g, "")
    .replace(/\bsenor\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

let clientesPosibles: any[] = [];

data.clientes_posibles = [];
data.cliente_id = null;
data.propiedades_posibles = [];
data.propiedad_id = null;

data.faltan_bloqueantes = (data.faltan_bloqueantes || []).filter(
  (dato: string) => dato !== "propiedad_o_sector"
);

if (
  !data.propiedad_o_sector &&
  !(data.faltan_opcionales || []).includes("propiedad_o_sector")
) {
  data.faltan_opcionales = [
    ...(data.faltan_opcionales || []),
    "propiedad_o_sector",
  ];
}

const clienteBuscadoNormalizado = normalizarTextoBusqueda(data.cliente_nombre);

const palabrasBusqueda = clienteBuscadoNormalizado
  .split(" ")
  .map((p: string) => p.trim())
  .filter((p: string) => p.length >= 3);

console.log("CLIENTE IA:", data.cliente_nombre);
console.log("CLIENTE NORMALIZADO:", clienteBuscadoNormalizado);
console.log("PALABRAS BUSQUEDA:", palabrasBusqueda);

const { data: clientesTodos, error: errorClientesTodos } = await supabase
  .from("cliente")
  .select("id:id_cliente, nombre, telefono")
  .eq("estado_cliente", "activo")
  .limit(500);

if (errorClientesTodos) {
  console.error("Error cargando clientes:", errorClientesTodos);
} else {
  clientesPosibles = (clientesTodos || [])
    .map((cliente: any) => {
      const nombreNormalizado = normalizarTextoBusqueda(cliente.nombre);

      let puntaje = 0;

      if (
        clienteBuscadoNormalizado &&
        nombreNormalizado.includes(clienteBuscadoNormalizado)
      ) {
        puntaje += 100;
      }

      for (const palabra of palabrasBusqueda) {
        if (nombreNormalizado.includes(palabra)) {
          puntaje += 20;
        }

        if (nombreNormalizado.startsWith(palabra)) {
          puntaje += 10;
        }
      }

      return {
        ...cliente,
        puntaje,
      };
    })
    .filter((cliente: any) => cliente.puntaje > 0)
    .sort((a: any, b: any) => b.puntaje - a.puntaje)
    .slice(0, 5)
    .map(({ puntaje, ...cliente }: any) => cliente);
}

console.log("CLIENTES ENCONTRADOS:", clientesPosibles);

data.clientes_posibles = clientesPosibles;

if (clientesPosibles.length === 1) {
  const cliente = clientesPosibles[0];

  data.cliente_id = cliente.id;
  data.cliente_nombre = cliente.nombre;

  const { data: propiedades, error: errorPropiedades } = await supabase
    .from("propiedad")
    .select("id:id_propiedad, nombre:nombre_propiedad, direccion, sector, ciudad")
    .eq("id_cliente", cliente.id);

  console.log("PROPIEDADES ENCONTRADAS:", propiedades);
  console.log("ERROR PROPIEDADES:", errorPropiedades);

  if (errorPropiedades) {
    console.error("Error buscando propiedades:", errorPropiedades);
  }

  data.propiedades_posibles = propiedades || [];

  if ((propiedades || []).length === 1) {
    const propiedad = propiedades![0];

    data.propiedad_id = propiedad.id;
    data.propiedad_o_sector =
      propiedad.nombre ||
      propiedad.sector ||
      propiedad.direccion ||
      propiedad.ciudad ||
      "";

    data.faltan_bloqueantes = (data.faltan_bloqueantes || []).filter(
      (dato: string) => dato !== "propiedad_o_sector"
    );

    data.faltan_opcionales = (data.faltan_opcionales || []).filter(
      (dato: string) =>
        dato !== "propiedad_o_sector" &&
        dato !== "propiedad o sector" &&
        dato !== "resolver propiedad con base de datos"
    );
  }

  if ((propiedades || []).length > 1) {
    data.faltan_bloqueantes = [
      ...(data.faltan_bloqueantes || []),
      "seleccionar propiedad",
    ];

    data.listo_para_confirmar = false;
    data.pregunta_siguiente =
      "Encontré varias propiedades para este cliente. Indica cuál fue antes de guardar.";
  }
}

if (clientesPosibles.length > 1) {
  data.faltan_bloqueantes = [
    ...(data.faltan_bloqueantes || []),
    "seleccionar cliente",
  ];

  data.listo_para_confirmar = false;
  data.pregunta_siguiente =
    "Encontré varios clientes parecidos. Indica cuál es antes de guardar.";
}

if (clientesPosibles.length === 0 && data.cliente_nombre) {
  data.faltan_bloqueantes = [
    ...(data.faltan_bloqueantes || []),
    "cliente no encontrado",
  ];

  data.listo_para_confirmar = false;
  data.pregunta_siguiente =
    "No encontré ese cliente. Debes seleccionar un cliente existente o crearlo antes de guardar.";
}
    const propiedadTexto = (data.propiedad_o_sector || "").toLowerCase();//

const pideResolverPropiedad =
  propiedadTexto.includes("única") ||
  propiedadTexto.includes("unica") ||
  propiedadTexto.includes("la de siempre") ||
  propiedadTexto.includes("misma propiedad");

if (pideResolverPropiedad) {
  data.propiedad_o_sector = "";

  data.faltan_opcionales = [
    ...(data.faltan_opcionales || []),
    "resolver propiedad con base de datos",
  ];

  data.observaciones = data.observaciones
    ? `${data.observaciones}. El usuario indicó usar la única propiedad del cliente.`
    : "El usuario indicó usar la única propiedad del cliente.";
}


   data.servicios = (data.servicios || []).map((servicio: any) => ({
  ...servicio,
  categoria: normalizarCategoria(servicio.nombre, servicio.categoria),
}));
data.puede_guardar =
  data.listo_para_confirmar === true &&
  (data.faltan_bloqueantes || []).length === 0 &&
  !!data.cliente_id &&
  !!data.propiedad_id ;


data.faltan_bloqueantes = Array.from(
  new Set(data.faltan_bloqueantes || [])
);

data.faltan_opcionales = Array.from(
  new Set(data.faltan_opcionales || [])
);

// Limpiar faltantes duplicados y quitar propiedad si ya fue resuelta
function normalizarDatoFaltante(dato: string) {
  const d = (dato || "").toLowerCase().trim();

  if (
    d === "propiedad_o_sector" ||
    d === "propiedad o sector" ||
    d === "propiedad" ||
    d === "sector"
  ) {
    return "propiedad_o_sector";
  }

  if (d === "forma de pago") {
    return "forma_pago";
  }

  return d;
}

data.faltan_bloqueantes = (data.faltan_bloqueantes || []).map(
  normalizarDatoFaltante
);

data.faltan_opcionales = (data.faltan_opcionales || []).map(
  normalizarDatoFaltante
);

// Si ya se encontró propiedad real, no debe faltar propiedad
if (data.propiedad_id || data.propiedad_o_sector) {
  data.faltan_bloqueantes = data.faltan_bloqueantes.filter(
    (dato: string) => dato !== "propiedad_o_sector"
  );

  data.faltan_opcionales = data.faltan_opcionales.filter(
    (dato: string) =>
      dato !== "propiedad_o_sector" &&
      dato !== "resolver propiedad con base de datos"
  );
}

for (const producto of data.productos || []) {
  const nombreProductoOriginal = (producto.nombre || "").trim();

  producto.id_producto = null;
  producto.productos_posibles = [];

  if (!nombreProductoOriginal) continue;

  const { data: productosEncontrados, error: errorProductos } = await supabase
    .from("producto")
    .select("id:id_producto, nombre:nombre_producto, categoria, tipo_producto")
    .ilike("nombre_producto", `%${nombreProductoOriginal}%`)
    .eq("estado_producto", "activo")
    .limit(5);

  if (errorProductos) {
    console.error("Error buscando productos:", errorProductos);
    continue;
  }

  if (productosEncontrados && productosEncontrados.length === 1) {
    producto.id_producto = productosEncontrados[0].id;
    producto.nombre = productosEncontrados[0].nombre;
    producto.producto_en_catalogo = true;
    producto.producto_original = nombreProductoOriginal;
    continue;
  }

  if (productosEncontrados && productosEncontrados.length > 1) {
    producto.productos_posibles = productosEncontrados;
    producto.producto_en_catalogo = false;

    data.faltan_bloqueantes = [
      ...(data.faltan_bloqueantes || []),
      "seleccionar producto",
    ];

    data.listo_para_confirmar = false;
    continue;
  }

  // Si no encontró el producto, usar "Otro producto"
  const { data: otroProducto, error: errorOtroProducto } = await supabase
    .from("producto")
    .select("id:id_producto, nombre:nombre_producto, categoria, tipo_producto")
    .ilike("nombre_producto", "%Otro producto%")
    .eq("estado_producto", "activo")
    .limit(1)
    .maybeSingle();

  if (errorOtroProducto) {
    console.error("Error buscando Otro producto:", errorOtroProducto);
  }

  if (otroProducto) {
    producto.id_producto = otroProducto.id;
    producto.nombre = otroProducto.nombre;
    producto.producto_original = nombreProductoOriginal;
    producto.producto_en_catalogo = true;
    producto.usado_como_otro = true;

    data.observaciones = data.observaciones
      ? `${data.observaciones}. Producto especial detectado: ${nombreProductoOriginal}.`
      : `Producto especial detectado: ${nombreProductoOriginal}.`;

    continue;
  }

  // Solo si tampoco existe "Otro producto", ahí sí bloquear
  producto.producto_en_catalogo = false;

  data.faltan_bloqueantes = [
    ...(data.faltan_bloqueantes || []),
    "producto no encontrado",
  ];

  data.listo_para_confirmar = false;
}

// Quitar duplicados
data.faltan_bloqueantes = Array.from(new Set(data.faltan_bloqueantes || []));
data.faltan_opcionales = Array.from(new Set(data.faltan_opcionales || []));

const productosOk = (data.productos || []).every(
  (producto: any) => !producto.nombre || !!producto.id_producto
);

// Recalcular si puede guardar
data.puede_guardar =
  data.listo_para_confirmar === true &&
  data.faltan_bloqueantes.length === 0 &&
  !!data.cliente_id &&
  !!data.propiedad_id &&
  productosOk;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error IA:", error);

    return NextResponse.json(
      { error: "Error al interpretar el trabajo con Gemini." },
      { status: 500 }
    );
  }
}