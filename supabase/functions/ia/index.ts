// Elena, la asistente del HUB, con la API gratuita de Gemini (Google AI Studio).
// Necesita el secreto GEMINI_API_KEY. Solo usuarios con sesión (verify_jwt).
// Devuelve { texto, acciones: [{ nombre, args }] }. Las acciones las aplica la app
// después de que Marc las confirme.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const S = (description: string, extra: Record<string, unknown> = {}) => ({ type: "STRING", description, ...extra });
const N = (description: string) => ({ type: "NUMBER", description });
const FECHA = S("Fecha en formato AAAA-MM-DD. Si no se dice, hoy.");

const HERRAMIENTAS = [{
  functionDeclarations: [
    {
      name: "crear_evento",
      description: "Apunta en el calendario un recordatorio, una entrega, un examen, una cita, una clase o un evento.",
      parameters: { type: "OBJECT", properties: {
        titulo: S("Título corto, por ejemplo «Entregar la práctica de Android»."),
        fecha: FECHA,
        ini: S("Hora de inicio HH:MM. Solo si se dice una hora."),
        fin: S("Hora de fin HH:MM. Solo si se dice."),
        tipo: S("Tipo de evento", { enum: ["recordatorio", "tarea", "examen", "cita", "clase", "evento", "deporte"] }),
        importancia: S("Importancia", { enum: ["baja", "media", "alta"] }),
        lugar: S("Lugar, si se dice."),
      }, required: ["titulo", "fecha", "tipo"] },
    },
    {
      name: "anadir_comida",
      description: "Apunta un alimento que ha comido. Una llamada por alimento. Estima siempre los gramos y los valores por 100 g.",
      parameters: { type: "OBJECT", properties: {
        comida: S("Comida del día", { enum: ["Desayuno", "Comida", "Merienda", "Cena"] }),
        alimento: S("Nombre del alimento. Si coincide con uno de la lista de alimentos conocidos, usa ese nombre exacto."),
        gramos: N("Gramos aproximados."),
        kcal_100g: N("Kilocalorías por 100 g."),
        proteina_100g: N("Proteína en g por 100 g."),
        carbos_100g: N("Carbohidratos en g por 100 g."),
        grasas_100g: N("Grasas en g por 100 g."),
        fecha: FECHA,
      }, required: ["comida", "alimento", "gramos", "kcal_100g", "proteina_100g", "carbos_100g", "grasas_100g"] },
    },
    {
      name: "registrar_entreno",
      description: "Apunta un entreno ya hecho.",
      parameters: { type: "OBJECT", properties: {
        nombre: S("Nombre del entreno. Si coincide con una de sus rutinas, usa ese nombre exacto."),
        minutos: N("Duración en minutos (si no la dice, 60)."),
        fecha: FECHA,
        ejercicios: { type: "ARRAY", description: "Ejercicios, solo si los dice.", items: { type: "OBJECT", properties: {
          nombre: S("Ejercicio"),
          series: { type: "ARRAY", items: { type: "OBJECT", properties: { kg: N("Peso en kg"), reps: N("Repeticiones") } } },
        } } },
      }, required: ["nombre"] },
    },
    {
      name: "registrar_peso",
      description: "Apunta su peso corporal.",
      parameters: { type: "OBJECT", properties: { kg: N("Peso en kg"), fecha: FECHA }, required: ["kg"] },
    },
    {
      name: "apuntar_gasto",
      description: "Apunta un gasto o ingreso en efectivo o que no viene en el extracto del banco.",
      parameters: { type: "OBJECT", properties: {
        concepto: S("Concepto, por ejemplo «Cena con amigos»."),
        importe: N("Importe en euros. Negativo si es gasto, positivo si es ingreso."),
        fecha: FECHA,
      }, required: ["concepto", "importe"] },
    },
  ],
}];

const SISTEMA = `Eres Elena, la asistente de EVANGELISTA'S HUB, la app personal de Marc (estudiante de DAM).
Hablas en castellano de España, de tú, claro y breve, sin lenguaje de anuncio. Si recomiendas algo, das una sola recomendación.

Cuando Marc te cuente algo que se pueda apuntar, usa las herramientas (puedes llamar a varias a la vez):
- Recordatorios, entregas, trabajos, exámenes, citas o planes → crear_evento. Entregas y trabajos son tipo "tarea"; exámenes "examen"; "recuérdame…" sin más es "recordatorio". Calcula la fecha exacta a partir de hoy: "mañana", "el viernes" (el próximo viernes después de hoy), "dentro de dos semanas"... No inventes horas. Entregas y exámenes, importancia alta salvo que diga otra cosa.
- Lo que ha comido → anadir_comida, una llamada por alimento, con gramos y valores por 100 g estimados de forma realista para raciones españolas. Elige la comida según lo que diga o la hora.
- Entrenos hechos → registrar_entreno. Peso → registrar_peso. Gastos en efectivo → apuntar_gasto.
Cuando uses herramientas, escribe además una frase corta diciendo lo que vas a apuntar (Marc lo confirma antes de guardarse).
Si falta un dato imprescindible (por ejemplo, la fecha de una entrega), pregúntalo en vez de inventarlo.
Si solo pregunta algo, responde usando los datos de la app.`;

async function llamar(modelo: string, clave: string, cuerpo: unknown) {
  return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
    body: JSON.stringify(cuerpo),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const clave = Deno.env.get("GEMINI_API_KEY");
  if (!clave) return json({ error: "falta_clave" }, 503);
  let cuerpo: { mensajes?: { rol: string; texto: string }[]; contexto?: string };
  try { cuerpo = await req.json(); } catch { return json({ error: "peticion" }, 400); }
  const mensajes = (cuerpo.mensajes || []).slice(-14).map((m) => ({ role: m.rol === "usuario" ? "user" : "model", parts: [{ text: String(m.texto).slice(0, 4000) }] }));
  if (!mensajes.length) return json({ error: "vacio" }, 400);
  const peticion = {
    systemInstruction: { parts: [{ text: SISTEMA + "\n\nDatos actuales de la app:\n" + String(cuerpo.contexto || "").slice(0, 12000) }] },
    contents: mensajes,
    tools: HERRAMIENTAS,
    toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    generationConfig: { maxOutputTokens: 1200, temperature: 0.3 },
  };
  const modelos = [Deno.env.get("GEMINI_MODEL"), "gemini-flash-latest", "gemini-2.5-flash"].filter(Boolean) as string[];
  let r: Response | null = null, d: any = {};
  for (const m of modelos) {
    r = await llamar(m, clave, peticion);
    d = await r.json().catch(() => ({}));
    if (r.status !== 404 && r.status !== 400) break; // 404/400: modelo no disponible, se prueba el siguiente
  }
  if (!r || !r.ok) return json({ error: r?.status === 429 ? "limite" : "gemini", detalle: d?.error?.message }, r?.status === 429 ? 429 : 502);
  const partes = d?.candidates?.[0]?.content?.parts || [];
  const texto = partes.map((p: { text?: string }) => p.text || "").join("").trim();
  const acciones = partes.filter((p: any) => p.functionCall).map((p: any) => ({ nombre: p.functionCall.name, args: p.functionCall.args || {} }));
  return json({ texto, acciones });
});
