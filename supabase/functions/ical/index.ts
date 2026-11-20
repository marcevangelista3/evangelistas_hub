// Calendario del instituto: lee un enlace iCal (Moodle, aula virtual…) y devuelve sus eventos.
// El navegador no puede descargarlo directamente (CORS), así que pasa por aquí. Solo con sesión.
// POST { url } → { nombre, eventos: [{ uid, titulo, fecha, ini, fin, todoElDia, lugar, descripcion }] }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ZONA = "Europe/Madrid";

/** Hora local de Madrid de un instante UTC */
const local = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
};
/** Interpreta DTSTART/DTEND: fecha sola, UTC (Z) o local con TZID (se asume la hora tal cual si la zona es española) */
function fechaIcs(valor: string, params: string) {
  const v = valor.trim();
  if (/VALUE=DATE(?!-)/.test(params) || /^\d{8}$/.test(v)) return { fecha: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`, hora: "", diaEntero: true };
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  if (m[7] || (/TZID=/.test(params) && !/Madrid|Europe\/Madrid|Romance|Spain|CET|Paris|Brussels/i.test(params))) {
    // UTC (o una zona que no es la nuestra: se trata como UTC, que es lo más habitual en Moodle)
    const l = local(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])));
    return { fecha: l.fecha, hora: l.hora, diaEntero: false };
  }
  return { fecha: `${m[1]}-${m[2]}-${m[3]}`, hora: `${m[4]}:${m[5]}`, diaEntero: false };
}
const texto = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();

function leerIcs(ics: string) {
  const lineas = ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  let nombre = "", actual: Record<string, { v: string; p: string }> | null = null;
  const eventos: any[] = [];
  for (const l of lineas) {
    if (l === "BEGIN:VEVENT") { actual = {}; continue; }
    if (l === "END:VEVENT") {
      if (actual?.DTSTART) {
        const ini = fechaIcs(actual.DTSTART.v, actual.DTSTART.p), fin = actual.DTEND ? fechaIcs(actual.DTEND.v, actual.DTEND.p) : null;
        if (ini && actual.STATUS?.v !== "CANCELLED") eventos.push({
          uid: (actual.UID?.v || `${actual.SUMMARY?.v}-${actual.DTSTART.v}`).slice(0, 200),
          titulo: texto(actual.SUMMARY?.v || "(Sin título)").slice(0, 200), fecha: ini.fecha, todoElDia: ini.diaEntero,
          ini: ini.hora, fin: fin && !fin.diaEntero && fin.fecha === ini.fecha && fin.hora > ini.hora ? fin.hora : "",
          lugar: texto(actual.LOCATION?.v || "").slice(0, 200), descripcion: texto(actual.DESCRIPTION?.v || "").slice(0, 600),
          categoria: texto(actual.CATEGORIES?.v || ""),
        });
      }
      actual = null; continue;
    }
    const i = l.indexOf(":"); if (i < 0) continue;
    const cab = l.slice(0, i), valor = l.slice(i + 1), [clave, ...params] = cab.split(";");
    if (!actual) { if (clave === "X-WR-CALNAME") nombre = texto(valor); continue; }
    if (!actual[clave]) actual[clave] = { v: valor, p: params.join(";") };
  }
  return { nombre, eventos };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return json({ error: "sin_sesion" }, 401);
  const p = await req.json().catch(() => ({}));
  let url: URL;
  try { url = new URL(String(p.url || "").trim().replace(/^webcals?:\/\//i, "https://")); } catch { return json({ error: "url", detalle: "El enlace no es válido." }, 400); }
  if (url.protocol !== "https:" || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/.test(url.hostname)) return json({ error: "url", detalle: "El enlace tiene que empezar por https:// o webcal://" }, 400);
  try {
    const r = await fetch(url, { headers: { Accept: "text/calendar, text/plain, */*" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!r.ok) return json({ error: "descarga", detalle: `El aula virtual ha respondido con un error (${r.status}).` }, 502);
    const ics = (await r.text()).slice(0, 3_000_000);
    if (!ics.includes("BEGIN:VCALENDAR")) return json({ error: "formato", detalle: "Ese enlace no es un calendario iCal." }, 422);
    const { nombre, eventos } = leerIcs(ics);
    const hoy = new Date(), desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString().slice(0, 10), hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 9, 1).toISOString().slice(0, 10);
    return json({ nombre, eventos: eventos.filter((e) => e.fecha >= desde && e.fecha < hasta).slice(0, 2000) });
  } catch (e) {
    return json({ error: "descarga", detalle: "No se ha podido descargar el calendario." }, 502);
  }
});
