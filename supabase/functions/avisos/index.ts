// Notificaciones push (Web Push) del HUB.
// - Con sesión: clave | suscribir | desuscribir | probar
// - Desde pg_cron cada 5 minutos (cabecera x-cron): tick → manda los avisos que tocan:
//     · avisos de cada evento (X minutos antes, según el evento)
//     · resumen del día (por defecto a las 08:00)
//     · víspera de exámenes y entregas (por defecto a las 20:00)
// Las claves VAPID se crean solas la primera vez y se guardan en public.push_config.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const APP = "https://marcevangelista3.github.io/evangelistas_hub/";
const admin = createClient(URL_BASE, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

/* ---------- Configuración ---------- */
async function config(clave: string) {
  const { data } = await admin.from("push_config").select("valor").eq("clave", clave).maybeSingle();
  return data?.valor as string | undefined;
}
let vapid: { publicKey: string; privateKey: string } | null = null;
async function claves() {
  if (vapid) return vapid;
  let pub = await config("vapid_publica"), priv = await config("vapid_privada");
  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys();
    await admin.from("push_config").upsert([{ clave: "vapid_publica", valor: k.publicKey }, { clave: "vapid_privada", valor: k.privateKey }], { onConflict: "clave", ignoreDuplicates: true });
    pub = await config("vapid_publica"); priv = await config("vapid_privada");
  }
  vapid = { publicKey: pub!, privateKey: priv! };
  webpush.setVapidDetails(APP, vapid.publicKey, vapid.privateKey);
  return vapid;
}

/* ---------- Envío ---------- */
type Aviso = { titulo: string; cuerpo: string; url?: string; tag?: string };
async function enviar(userId: string, aviso: Aviso) {
  await claves();
  const { data: subs } = await admin.from("push_suscripciones").select("*").eq("user_id", userId);
  let ok = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ titulo: aviso.titulo, cuerpo: aviso.cuerpo, url: aviso.url || APP, tag: aviso.tag }), { TTL: 3600, urgency: "high" });
      ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("push_suscripciones").delete().eq("endpoint", s.endpoint);
      else console.warn("push", code, (e as Error).message);
    }
  }
  return ok;
}
/** Envía solo si no se ha enviado ya ese aviso */
async function enviarUnaVez(userId: string, clave: string, aviso: Aviso) {
  const { error } = await admin.from("push_enviados").insert({ user_id: userId, clave });
  if (error) return 0;   // ya enviado (clave repetida)
  return await enviar(userId, aviso);
}

/* ---------- Fechas en la zona de Marc ---------- */
function ahoraLocal(zona: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  const fecha = `${p.year}-${p.month}-${p.day}`;
  return { fecha, hora: `${p.hour}:${p.minute}`, ms: Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) };
}
const msDe = (fecha: string, hora = "00:00") => { const [a, m, d] = fecha.split("-").map(Number); const [h, mi] = hora.split(":").map(Number); return Date.UTC(a, m - 1, d, h || 0, mi || 0); };
const sumarDia = (fecha: string, n: number) => new Date(msDe(fecha) + n * 86400000).toISOString().slice(0, 10);
const VENTANA = 15 * 60000;   // el cron va cada 5 min; se da margen por si alguno falla
const toca = (debido: number, ahora: number) => debido <= ahora && debido > ahora - VENTANA;

/* ---------- Datos de cada usuario ---------- */
async function leerClave(userId: string, clave: string, def: unknown) {
  const { data } = await admin.from("almacen").select("valor, borrado").eq("user_id", userId).eq("clave", clave).maybeSingle();
  if (!data || data.borrado) return def;
  try { return JSON.parse(data.valor) ?? def; } catch { return def; }
}
async function eventosGoogle(userId: string, desde: string, hasta: string) {
  const ID = Deno.env.get("GOOGLE_CLIENT_ID"), SEC = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!ID || !SEC) return [];
  const { data } = await admin.from("google_conexion").select("refresh_token").eq("user_id", userId).maybeSingle();
  if (!data) return [];
  try {
    const t = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: ID, client_secret: SEC, refresh_token: data.refresh_token, grant_type: "refresh_token" }) })).json();
    if (!t.access_token) return [];
    const q = new URLSearchParams({ timeMin: `${desde}T00:00:00Z`, timeMax: `${hasta}T23:59:59Z`, singleEvents: "true", orderBy: "startTime", maxResults: "100" });
    const d = await (await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, { headers: { Authorization: `Bearer ${t.access_token}` } })).json();
    return (d.items || []).filter((e: any) => e.status !== "cancelled" && !e.extendedProperties?.private?.hubTipo).map((e: any) => ({
      id: "g:" + e.id, titulo: e.summary || "(Sin título)", fecha: e.start?.date || String(e.start?.dateTime || "").slice(0, 10),
      ini: e.start?.dateTime ? new Date(e.start.dateTime).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }) : "",
      tipo: /examen|parcial/i.test(e.summary || "") ? "examen" : /entreg|pr[aá]ctica|tarea/i.test(e.summary || "") ? "tarea" : "evento",
    }));
  } catch { return []; }
}

const NOMBRE: Record<string, string> = { examen: "Examen", tarea: "Entrega", recordatorio: "Recordatorio", cita: "Cita", clase: "Clase", deporte: "Deporte", evento: "Evento" };
const lista = (evs: any[]) => evs.map((e) => `${e.ini ? e.ini + " " : ""}${e.titulo}`).join(" · ");

async function revisarUsuario(userId: string) {
  const prefs = { resumen: true, resumenHora: "08:00", vispera: true, visperaHora: "20:00", eventos: true, zona: "Europe/Madrid", ...(await leerClave(userId, "hub:avisos", {}) as object) } as any;
  const ahora = ahoraLocal(prefs.zona || "Europe/Madrid");
  const manana = sumarDia(ahora.fecha, 1);
  const propios = (await leerClave(userId, "hub:eventos", []) as any[]).filter((e) => e && e.fecha >= sumarDia(ahora.fecha, -1) && e.fecha <= sumarDia(ahora.fecha, 2));
  let enviados = 0;

  // 1. Avisos de cada evento
  if (prefs.eventos) {
    for (const e of propios) {
      if (e.hecha || !Array.isArray(e.avisos) || !e.avisos.length) continue;
      const diaEntero = e.todoElDia || !e.ini;
      const inicio = msDe(e.fecha, diaEntero ? "09:00" : e.ini);
      // Los de todo el día avisan una sola vez, a las 9:00 de ese día
      for (const m of diaEntero ? [0] : e.avisos) {
        if (!toca(inicio - m * 60000, ahora.ms)) continue;
        const cuando = diaEntero ? "Hoy" : m === 0 ? "Ahora" : m < 60 ? `En ${m} min` : m < 1440 ? `En ${Math.round(m / 60)} h` : "Mañana";
        enviados += await enviarUnaVez(userId, `ev:${e.id}:${e.fecha}:${e.ini || ""}:${m}`, {
          titulo: `${NOMBRE[e.tipo] || "Evento"}: ${e.titulo}`, cuerpo: `${cuando}${e.ini ? ` · ${e.ini}` : ""}${e.lugar ? ` · ${e.lugar}` : ""}`, url: `${APP}#calendario`, tag: `ev-${e.id}`,
        });
      }
    }
  }

  const necesitaHoy = prefs.resumen && toca(msDe(ahora.fecha, prefs.resumenHora), ahora.ms);
  const necesitaManana = prefs.vispera && toca(msDe(ahora.fecha, prefs.visperaHora), ahora.ms);
  if (!necesitaHoy && !necesitaManana) return enviados;
  const google = await eventosGoogle(userId, ahora.fecha, manana);
  const todos = [...propios, ...google].sort((a, b) => (a.ini || "").localeCompare(b.ini || ""));

  // 2. Resumen del día
  if (necesitaHoy) {
    const hoy = todos.filter((e) => e.fecha === ahora.fecha && !e.hecha);
    const clave = hoy.filter((e) => ["examen", "tarea", "recordatorio"].includes(e.tipo));
    if (hoy.length) {
      enviados += await enviarUnaVez(userId, `resumen:${ahora.fecha}`, {
        titulo: clave.length ? `Hoy: ${clave.length} ${clave.length === 1 ? "cosa importante" : "cosas importantes"}` : `Hoy tienes ${hoy.length} ${hoy.length === 1 ? "evento" : "eventos"}`,
        cuerpo: lista(hoy).slice(0, 180), url: `${APP}#inicio`, tag: "resumen",
      });
    }
  }
  // 3. Víspera de exámenes y entregas
  if (necesitaManana) {
    const m = todos.filter((e) => e.fecha === manana && !e.hecha && ["examen", "tarea"].includes(e.tipo));
    if (m.length) {
      enviados += await enviarUnaVez(userId, `vispera:${manana}`, {
        titulo: m.length === 1 ? `Mañana: ${NOMBRE[m[0].tipo]} de ${m[0].titulo}` : `Mañana tienes ${m.length} exámenes o entregas`,
        cuerpo: m.length === 1 ? (m[0].ini ? `A las ${m[0].ini}. ¡Tú puedes!` : "¡Tú puedes!") : lista(m).slice(0, 180), url: `${APP}#calendario`, tag: "vispera",
      });
    }
  }
  return enviados;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const p = await req.json().catch(() => ({}));

  /* Llamada del programador (pg_cron) */
  const cron = req.headers.get("x-cron");
  if (cron) {
    if (cron !== await config("cron")) return json({ error: "cron" }, 401);
    const { data } = await admin.from("push_suscripciones").select("user_id");
    const usuarios = [...new Set((data || []).map((x) => x.user_id))];
    let total = 0;
    for (const u of usuarios) { try { total += await revisarUsuario(u); } catch (e) { console.warn("usuario", (e as Error).message); } }
    // Limpieza de avisos antiguos
    await admin.from("push_enviados").delete().lt("enviado", new Date(Date.now() - 30 * 86400000).toISOString());
    return json({ usuarios: usuarios.length, enviados: total });
  }

  /* Peticiones de la app (con sesión) */
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return json({ error: "sin_sesion" }, 401);
  try {
    switch (p.accion) {
      case "clave": return json({ clave: (await claves()).publicKey });
      case "suscribir": {
        const s = p.sub;
        if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth || !/^https:\/\//.test(s.endpoint)) return json({ error: "suscripcion" }, 400);
        await admin.from("push_suscripciones").upsert({ endpoint: s.endpoint, user_id: user.id, p256dh: s.keys.p256dh, auth: s.keys.auth, dispositivo: String(p.dispositivo || "").slice(0, 40) });
        return json({ ok: true });
      }
      case "desuscribir":
        await admin.from("push_suscripciones").delete().eq("endpoint", String(p.endpoint || "")).eq("user_id", user.id);
        return json({ ok: true });
      case "probar": {
        const n = await enviar(user.id, { titulo: "¡Funciona! ✨", cuerpo: "Así te llegarán los avisos de exámenes, entregas y recordatorios.", url: `${APP}#inicio`, tag: "prueba" });
        return json({ enviados: n });
      }
    }
    return json({ error: "accion" }, 400);
  } catch (e) {
    return json({ error: "avisos", detalle: (e as Error).message }, 502);
  }
});
