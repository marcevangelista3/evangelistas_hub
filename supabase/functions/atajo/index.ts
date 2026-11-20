// Atajos de Apple («Oye Siri, Elena» y Salud) para el HUB.
// - Con sesión de la app: crear_token | estado | borrar_token
// - Desde un Atajo, con la cabecera x-hub-token (token personal):
//     elena { texto }                      → Gemini decide qué apuntar y se guarda al momento
//     salud { peso?, pasos?, entreno?: { nombre, minutos }, fecha? }
//   Devuelve { respuesta } para que el Atajo la lea en voz alta.
// Escribe directamente en public.almacen (las claves hub:* que usa la app).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ZONA = "Europe/Madrid";

/* ---------- Token personal ---------- */
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const huella = async (t: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)));

/* ---------- Datos de la app (almacen) ---------- */
async function leer(userId: string, clave: string, def: any) {
  const { data } = await admin.from("almacen").select("valor, borrado").eq("user_id", userId).eq("clave", clave).maybeSingle();
  if (!data || data.borrado || data.valor == null) return def;
  try { return JSON.parse(data.valor) ?? def; } catch { return def; }
}
async function escribir(userId: string, clave: string, valor: unknown) {
  const { error } = await admin.from("almacen").upsert({ user_id: userId, clave, valor: JSON.stringify(valor), borrado: false, actualizado: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/* ---------- Fechas ---------- */
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const horaAhora = () => new Intl.DateTimeFormat("es-ES", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
const fechaValida = (f: unknown) => (typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : hoy());
const sumarDias = (f: string, n: number) => { const [a, m, d] = f.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
const fLarga = (f: string) => { const [a, m, d] = f.split("-").map(Number); return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, d))); };
const cuando = (f: string) => (f === hoy() ? "hoy" : f === sumarDias(hoy(), 1) ? "mañana" : `el ${fLarga(f)}`);
const num = (v: unknown) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : NaN; };

/* ---------- Google Calendar (si está conectado) ---------- */
async function subirAGoogle(userId: string, e: any) {
  const ID = Deno.env.get("GOOGLE_CLIENT_ID"), SEC = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const { data } = await admin.from("google_conexion").select("refresh_token").eq("user_id", userId).maybeSingle();
  if (!ID || !SEC || !data) return null;
  try {
    const t = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: ID, client_secret: SEC, refresh_token: data.refresh_token, grant_type: "refresh_token" }) })).json();
    if (!t.access_token) return null;
    const ev = {
      summary: e.titulo, location: e.lugar || "", description: "",
      start: e.todoElDia ? { date: e.fecha } : { dateTime: `${e.fecha}T${e.ini}:00`, timeZone: ZONA },
      end: e.todoElDia ? { date: sumarDias(e.fecha, 1) } : { dateTime: `${e.fecha}T${e.fin}:00`, timeZone: ZONA },
      extendedProperties: { private: { hubTipo: e.tipo, hubImportancia: e.importancia, hubColor: e.color } },
    };
    const r = await (await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", { method: "POST", headers: { Authorization: `Bearer ${t.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify(ev) })).json();
    return r.id || null;
  } catch { return null; }
}

/* ---------- Acciones (mismo formato que la app) ---------- */
const COLOR: Record<string, string> = { recordatorio: "lavanda", tarea: "limon", examen: "rosa", clase: "cielo", evento: "melocoton", cita: "lavanda", deporte: "menta" };
const NOMBRE: Record<string, string> = { recordatorio: "Recordatorio", tarea: "Entrega", examen: "Examen", clase: "Clase", evento: "Evento", cita: "Cita", deporte: "Deporte" };
const masUnaHora = (h: string) => { const [a, b] = h.split(":").map(Number); return `${String(Math.min(23, a + 1)).padStart(2, "0")}:${String(b).padStart(2, "0")}`; };

async function aplicar(userId: string, nombre: string, a: any): Promise<string> {
  const fecha = fechaValida(a.fecha);
  switch (nombre) {
    case "crear_evento": {
      const tipo = COLOR[a.tipo] ? a.tipo : "recordatorio";
      const ini = /^\d{2}:\d{2}$/.test(a.ini || "") ? a.ini : "";
      const e: any = {
        id: crypto.randomUUID(), creado: new Date().toISOString(), titulo: String(a.titulo || "Sin título").trim(), fecha, todoElDia: !ini,
        ini, fin: ini ? (/^\d{2}:\d{2}$/.test(a.fin || "") && a.fin > ini ? a.fin : masUnaHora(ini)) : "",
        tipo, color: COLOR[tipo], importancia: a.importancia || (["tarea", "examen"].includes(tipo) ? "alta" : "media"),
        lugar: a.lugar || "", descripcion: "", avisos: ini ? [30] : ["recordatorio", "tarea", "examen"].includes(tipo) ? [0] : [],
      };
      const googleId = await subirAGoogle(userId, e);
      if (googleId) e.googleId = googleId;
      await escribir(userId, "hub:eventos", [...await leer(userId, "hub:eventos", []), e]);
      return `${NOMBRE[tipo]} «${e.titulo}» ${cuando(fecha)}${ini ? ` a las ${ini}` : ""}`;
    }
    case "anadir_comida": {
      const alimentos = await leer(userId, "hub:alimentos", {});
      const nombreAl = Object.keys(alimentos).find((k) => k.toLowerCase() === String(a.alimento).toLowerCase())
        || String(a.alimento).charAt(0).toUpperCase() + String(a.alimento).slice(1);
      if (!alimentos[nombreAl]) {
        alimentos[nombreAl] = [a.kcal_100g, a.proteina_100g, a.carbos_100g, a.grasas_100g].map((v) => Math.round((num(v) || 0) * 10) / 10);
        await escribir(userId, "hub:alimentos", alimentos);
      }
      const dieta = await leer(userId, "hub:dieta", {});
      const dia = dieta[fecha] || ["Desayuno", "Comida", "Merienda", "Cena"].map((n) => ({ nombre: n, hora: "", items: [] }));
      const i = Math.max(0, dia.findIndex((c: any) => c.nombre.toLowerCase() === String(a.comida || "Comida").toLowerCase()));
      dia[i].items.push([nombreAl, Math.round(num(a.gramos) || 100)]);
      if (!dia[i].hora && fecha === hoy()) dia[i].hora = horaAhora();
      dieta[fecha] = dia;
      await escribir(userId, "hub:dieta", dieta);
      return `${nombreAl} (${Math.round(num(a.gramos) || 100)} g) en ${dia[i].nombre.toLowerCase()}`;
    }
    case "registrar_entreno": {
      const rutinas = await leer(userId, "hub:rutinas", []);
      const r = rutinas.find((x: any) => x.nombre?.toLowerCase() === String(a.nombre).toLowerCase());
      const reg = { id: crypto.randomUUID(), fecha, rutinaId: r?.id || null, nombre: r?.nombre || a.nombre || "Entreno", minutos: Math.max(1, Math.round(num(a.minutos) || 60)),
        ejercicios: (a.ejercicios || []).map((e: any) => ({ nombre: e.nombre, series: (e.series || []).map((x: any) => ({ kg: num(x.kg) || 0, reps: num(x.reps) || 0 })) })) };
      const hist = [reg, ...await leer(userId, "hub:sesiones", [])].sort((x: any, y: any) => y.fecha.localeCompare(x.fecha)).slice(0, 500);
      await escribir(userId, "hub:sesiones", hist);
      return `entreno «${reg.nombre}» de ${reg.minutos} min ${cuando(fecha)}`;
    }
    case "registrar_peso": {
      const kg = Math.round(num(a.kg) * 10) / 10;
      if (!(kg > 20 && kg < 400)) return "";
      const l = (await leer(userId, "hub:pesos", [])).filter((p: any) => p.fecha !== fecha);
      l.push({ fecha, kg });
      await escribir(userId, "hub:pesos", l.sort((x: any, y: any) => x.fecha.localeCompare(y.fecha)));
      return `peso de ${String(kg).replace(".", ",")} kg`;
    }
    case "apuntar_gasto": return "";   // los gastos se apuntan desde la app
  }
  return "";
}

/* ---------- Elena (Gemini) ---------- */
const S = (description: string, extra: Record<string, unknown> = {}) => ({ type: "STRING", description, ...extra });
const N = (description: string) => ({ type: "NUMBER", description });
const FECHA = S("Fecha AAAA-MM-DD. Si no se dice, hoy.");
const HERRAMIENTAS = [{ functionDeclarations: [
  { name: "crear_evento", description: "Apunta en el calendario un recordatorio, entrega, examen, cita, clase o evento.", parameters: { type: "OBJECT", properties: {
    titulo: S("Título corto."), fecha: FECHA, ini: S("Hora de inicio HH:MM, solo si se dice."), fin: S("Hora de fin HH:MM, solo si se dice."),
    tipo: S("Tipo", { enum: ["recordatorio", "tarea", "examen", "cita", "clase", "evento", "deporte"] }), importancia: S("Importancia", { enum: ["baja", "media", "alta"] }), lugar: S("Lugar, si se dice."),
  }, required: ["titulo", "fecha", "tipo"] } },
  { name: "anadir_comida", description: "Apunta un alimento que ha comido. Una llamada por alimento, con gramos y valores por 100 g estimados.", parameters: { type: "OBJECT", properties: {
    comida: S("Comida", { enum: ["Desayuno", "Comida", "Merienda", "Cena"] }), alimento: S("Alimento"), gramos: N("Gramos"), kcal_100g: N("kcal/100 g"),
    proteina_100g: N("Proteína/100 g"), carbos_100g: N("Carbohidratos/100 g"), grasas_100g: N("Grasas/100 g"), fecha: FECHA,
  }, required: ["comida", "alimento", "gramos", "kcal_100g", "proteina_100g", "carbos_100g", "grasas_100g"] } },
  { name: "registrar_entreno", description: "Apunta un entreno ya hecho.", parameters: { type: "OBJECT", properties: { nombre: S("Nombre; si coincide con una rutina, ese nombre exacto."), minutos: N("Minutos (60 si no lo dice)"), fecha: FECHA }, required: ["nombre"] } },
  { name: "registrar_peso", description: "Apunta su peso corporal.", parameters: { type: "OBJECT", properties: { kg: N("Peso en kg"), fecha: FECHA }, required: ["kg"] } },
] }];
const SISTEMA = `Eres Elena, la asistente de EVANGELISTA'S HUB, la app personal de Marc. Te habla por Siri, así que tu respuesta se leerá en voz alta:
contesta en castellano de España, de tú, en una o dos frases cortas, sin listas, sin emojis y sin markdown.
Si lo que dice se puede apuntar, usa las herramientas (puedes llamar a varias): recordatorios, entregas (tipo "tarea"), exámenes, citas o planes → crear_evento, calculando la fecha exacta desde hoy y sin inventar horas; comidas → anadir_comida (una por alimento); entrenos → registrar_entreno; peso → registrar_peso.
Si falta un dato imprescindible, pregúntalo. Si solo pregunta algo, responde con los datos de la app.`;

async function elena(userId: string, texto: string) {
  const clave = Deno.env.get("GEMINI_API_KEY");
  if (!clave) return "Aún falta la clave de Gemini en Supabase.";
  const h = hoy();
  const eventos = (await leer(userId, "hub:eventos", [])).filter((e: any) => e.fecha >= h && e.fecha <= sumarDias(h, 21))
    .sort((a: any, b: any) => (a.fecha + (a.ini || "")).localeCompare(b.fecha + (b.ini || ""))).slice(0, 25);
  const rutinas = (await leer(userId, "hub:rutinas", [])).map((r: any) => r.nombre);
  const contexto = [`Hoy es ${fLarga(h)} (${h}), son las ${horaAhora()}.`,
    eventos.length ? "Calendario próximo:\n" + eventos.map((e: any) => `- ${e.fecha}${e.ini ? " " + e.ini : ""}: ${e.titulo} (${e.tipo}${e.hecha ? ", hecho" : ""})`).join("\n") : "Calendario: nada en 3 semanas.",
    rutinas.length ? `Rutinas: ${rutinas.join(", ")}.` : ""].join("\n");
  const peticion = {
    systemInstruction: { parts: [{ text: SISTEMA + "\n\nDatos de la app:\n" + contexto }] },
    contents: [{ role: "user", parts: [{ text: texto.slice(0, 2000) }] }],
    tools: HERRAMIENTAS, toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    generationConfig: { maxOutputTokens: 600, temperature: 0.3 },
  };
  let r: Response | null = null, d: any = {};
  for (const m of [Deno.env.get("GEMINI_MODEL"), "gemini-flash-latest", "gemini-2.5-flash"].filter(Boolean) as string[]) {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": clave }, body: JSON.stringify(peticion) });
    d = await r.json().catch(() => ({}));
    if (r.status !== 404 && r.status !== 400) break;
  }
  if (!r?.ok) return r?.status === 429 ? "He llegado al límite gratuito de este minuto. Prueba en un momento." : "Ahora mismo no puedo responder.";
  const partes = d?.candidates?.[0]?.content?.parts || [];
  const txt = partes.map((p: any) => p.text || "").join("").trim();
  const hechos: string[] = [];
  for (const p of partes.filter((x: any) => x.functionCall)) {
    try { const h2 = await aplicar(userId, p.functionCall.name, p.functionCall.args || {}); if (h2) hechos.push(h2); } catch (e) { console.warn("aplicar", (e as Error).message); }
  }
  if (hechos.length) return `Apuntado: ${hechos.join("; ")}.`;
  return txt || "No te he entendido, ¿me lo repites?";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const p = await req.json().catch(() => ({}));

  /* Desde un Atajo */
  const token = req.headers.get("x-hub-token") || p.token;
  if (token) {
    const { data } = await admin.from("atajo_tokens").select("user_id").eq("token_hash", await huella(String(token))).maybeSingle();
    if (!data) return json({ respuesta: "El código del Atajo no es válido. Crea uno nuevo en Ajustes de la app." }, 401);
    const u = data.user_id;
    await admin.from("atajo_tokens").update({ usado: new Date().toISOString() }).eq("user_id", u);
    try {
      if (p.accion === "elena") {
        const texto = String(p.texto || "").trim();
        return json({ respuesta: texto ? await elena(u, texto) : "No te he oído, ¿me lo repites?" });
      }
      if (p.accion === "salud") {
        const fecha = fechaValida(p.fecha), hecho: string[] = [];
        if (isFinite(num(p.peso))) { const t = await aplicar(u, "registrar_peso", { kg: p.peso, fecha }); if (t) hecho.push(t); }
        const pasos = Math.round(num(p.pasos));
        if (pasos >= 0) { const l = await leer(u, "hub:pasos", {}); l[fecha] = pasos; await escribir(u, "hub:pasos", l); hecho.push(`${pasos.toLocaleString("es-ES")} pasos`); }
        if (p.entreno?.nombre || isFinite(num(p.entreno?.minutos))) hecho.push(await aplicar(u, "registrar_entreno", { nombre: p.entreno.nombre || "Entreno", minutos: p.entreno.minutos, fecha }));
        return json({ respuesta: hecho.length ? `Guardado: ${hecho.join(", ")}.` : "No había nada que guardar." });
      }
      return json({ respuesta: "No sé qué hacer con eso." }, 400);
    } catch (e) {
      return json({ respuesta: "Algo ha fallado al guardar.", detalle: (e as Error).message }, 500);
    }
  }

  /* Desde la app (con sesión) */
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return json({ error: "sin_sesion" }, 401);
  switch (p.accion) {
    case "crear_token": {
      const nuevo = "hub_" + hex(crypto.getRandomValues(new Uint8Array(24)).buffer);
      await admin.from("atajo_tokens").upsert({ user_id: user.id, token_hash: await huella(nuevo), creado: new Date().toISOString(), usado: null });
      return json({ token: nuevo });
    }
    case "estado": {
      const { data } = await admin.from("atajo_tokens").select("creado, usado").eq("user_id", user.id).maybeSingle();
      return json({ tiene: !!data, creado: data?.creado || null, usado: data?.usado || null });
    }
    case "borrar_token":
      await admin.from("atajo_tokens").delete().eq("user_id", user.id);
      return json({ ok: true });
  }
  return json({ error: "accion" }, 400);
});
