// Notas de Moodle con el servicio de la app móvil oficial (moodle_mobile_app).
// - La contraseña solo se usa una vez para pedir el token; no se guarda.
// - El token de cada usuario se guarda en public.moodle_conexion, que solo lee el servidor.
// - Las notas quedan en public.moodle_notas (también solo servidor).
// POST { accion } con sesión: estado | conectar | sincronizar | desconectar
// POST con cabecera x-cron (pg_cron cada 15 min): revisa a todos y avisa al móvil de las notas nuevas.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const APP = "https://marcevangelista3.github.io/evangelistas_hub/";
const SITIO_PREDET = "https://campus.digitechfp.com";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

class Fallo extends Error { constructor(public codigo: string, mensaje: string) { super(mensaje); } }

/* ---------- Moodle ---------- */
function limpiarSitio(s: unknown) {
  let u: URL;
  try { u = new URL(String(s || SITIO_PREDET).trim().replace(/\/+$/, "")); } catch { throw new Fallo("sitio", "La dirección del campus no es válida."); }
  if (u.protocol !== "https:" || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/.test(u.hostname)) throw new Fallo("sitio", "La dirección del campus tiene que empezar por https://");
  return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
}
function plano(obj: Record<string, unknown>, pre = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const clave = pre ? `${pre}[${k}]` : k;
    if (v && typeof v === "object") plano(v as Record<string, unknown>, clave, out); else if (v !== undefined) out.append(clave, String(v));
  }
  return out;
}
async function ws(sitio: string, token: string, fn: string, params: Record<string, unknown> = {}) {
  const cuerpo = plano({ wstoken: token, wsfunction: fn, moodlewsrestformat: "json", ...params });
  const r = await fetch(`${sitio}/webservice/rest/server.php?moodlewsrestformat=json&wsfunction=${fn}`, { method: "POST", body: cuerpo, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Fallo("red", `El campus ha respondido con un error (${r.status}).`);
  const d = await r.json();
  if (d && d.exception) {
    if (/invalidtoken|accessexception/.test(d.errorcode || "") && fn === "core_webservice_get_site_info") throw new Fallo("token", "El permiso de Moodle ha caducado. Vuelve a conectar.");
    if (d.errorcode === "invalidtoken") throw new Fallo("token", "El permiso de Moodle ha caducado. Vuelve a conectar.");
    throw new Fallo("moodle", d.message || "Moodle ha devuelto un error.");
  }
  return d;
}
async function pedirToken(sitio: string, usuario: string, contrasena: string) {
  const r = await fetch(`${sitio}/login/token.php`, { method: "POST", body: new URLSearchParams({ username: usuario, password: contrasena, service: "moodle_mobile_app" }), signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Fallo("red", `El campus ha respondido con un error (${r.status}).`);
  const d = await r.json().catch(() => ({}));
  if (d.token) return d.token as string;
  if (d.errorcode === "invalidlogin") throw new Fallo("login", "Usuario o contraseña incorrectos.");
  if (d.errorcode === "enablewsdescription" || d.errorcode === "servicenotavailable") throw new Fallo("servicio", "Tu campus no tiene activada la app de Moodle.");
  throw new Fallo("login", d.error || "No se ha podido entrar en Moodle.");
}

const EXAMEN = /examen|prueba|parcial|control|test|cuestionario|recuperaci[oó]n|final/i;
const redondear = (x: number) => Math.round(x * 100) / 100;

/** Baja las notas de un usuario, las guarda y devuelve las que acaban de salir */
async function sincronizar(con: any) {
  const sitio = con.sitio, token = con.token;
  const info = await ws(sitio, token, "core_webservice_get_site_info");
  const uid = info.userid;
  const cursos = (await ws(sitio, token, "core_enrol_get_users_courses", { userid: uid })) as any[];
  const ahora = Date.now() / 1000;
  const vigentes = cursos.filter((c) => c.visible !== 0 && !(c.enddate && c.enddate < ahora - 60 * 86400));
  const filas: any[] = [];
  for (const c of vigentes) {
    let d: any;
    try { d = await ws(sitio, token, "gradereport_user_get_grade_items", { courseid: c.id, userid: uid }); } catch { continue; }
    const items = d?.usergrades?.[0]?.gradeitems || [];
    let orden = 0;
    for (const it of items) {
      orden++;
      if (it.itemtype === "course" || it.itemtype === "category" || !it.itemname) continue;
      const oculta = it.gradeishidden || it.gradehiddenbydate;
      const min = Number(it.grademin ?? 0), max = Number(it.grademax ?? 10);
      const raw = oculta || it.graderaw === null || it.graderaw === undefined ? null : Number(it.graderaw);
      const nota = raw === null || !(max > min) ? null : redondear(Math.min(10, Math.max(0, ((raw - min) / (max - min)) * 10)));
      filas.push({
        user_id: con.user_id, item_id: String(it.id), curso_id: String(c.id), curso: String(c.fullname || c.shortname || "Curso").slice(0, 200),
        nombre: String(it.itemname).replace(/<[^>]+>/g, "").slice(0, 200), modulo: it.itemmodule || it.itemtype || "",
        tipo: it.itemmodule === "quiz" || EXAMEN.test(it.itemname) ? "examen" : "actividad",
        nota, bruta: raw, maxima: max, texto: oculta ? "" : String(it.gradeformatted || "").slice(0, 40), orden,
      });
    }
  }
  const { data: antes } = await admin.from("moodle_notas").select("item_id, nota, publicada").eq("user_id", con.user_id);
  const previas = new Map((antes || []).map((x) => [x.item_id, x]));
  const nuevas: any[] = [];
  const iso = new Date().toISOString();
  for (const f of filas) {
    const p = previas.get(f.item_id);
    const cambia = f.nota !== null && (!p || p.nota === null || Number(p.nota) !== f.nota);
    f.publicada = cambia ? iso : p?.publicada ?? null;
    if (cambia && con.ultima) nuevas.push(f);   // la primera vez no se avisa de todo lo antiguo
  }
  if (filas.length) {
    const { error } = await admin.from("moodle_notas").upsert(filas, { onConflict: "user_id,item_id" });
    if (error) throw new Fallo("bd", error.message);
  }
  const vivos = new Set(filas.map((f) => f.item_id));
  const sobran = [...previas.keys()].filter((k) => !vivos.has(k));
  if (sobran.length) await admin.from("moodle_notas").delete().eq("user_id", con.user_id).in("item_id", sobran);
  await admin.from("moodle_conexion").update({ ultima: iso, error: null, nombre: info.fullname || con.nombre }).eq("user_id", con.user_id);
  return nuevas;
}

/* ---------- Avisos al móvil ---------- */
let vapidListo = false;
async function enviar(userId: string, titulo: string, cuerpo: string, tag: string) {
  const { data: subs } = await admin.from("push_suscripciones").select("*").eq("user_id", userId);
  if (!subs?.length) return 0;
  const { data: prefs } = await admin.from("almacen").select("valor, borrado").eq("user_id", userId).eq("clave", "hub:avisos").maybeSingle();
  try { if (prefs && !prefs.borrado && JSON.parse(prefs.valor)?.notas === false) return 0; } catch {}
  if (!vapidListo) {
    const { data } = await admin.from("push_config").select("clave, valor").in("clave", ["vapid_publica", "vapid_privada"]);
    const m = Object.fromEntries((data || []).map((x) => [x.clave, x.valor]));
    if (!m.vapid_publica || !m.vapid_privada) return 0;
    webpush.setVapidDetails(APP, m.vapid_publica, m.vapid_privada); vapidListo = true;
  }
  let ok = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ titulo, cuerpo, url: `${APP}#notas`, tag }), { TTL: 6 * 3600, urgency: "high" });
      ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("push_suscripciones").delete().eq("endpoint", s.endpoint);
    }
  }
  return ok;
}
const n1 = (x: number) => x.toLocaleString("es-ES", { maximumFractionDigits: 2 });
async function avisarNuevas(userId: string, nuevas: any[]) {
  if (!nuevas.length) return 0;
  // Los nombres que el usuario haya puesto en la app
  const { data } = await admin.from("almacen").select("valor, borrado").eq("user_id", userId).eq("clave", "hub:notas").maybeSingle();
  let aj: any = {}; try { if (data && !data.borrado) aj = JSON.parse(data.valor) || {}; } catch {}
  const nombreCurso = (f: any) => aj.asig?.["m" + f.curso_id]?.nombre || f.curso;
  const nombreItem = (f: any) => aj.items?.["m" + f.item_id]?.nombre || f.nombre;
  if (nuevas.length > 3) {
    const cursos = [...new Set(nuevas.map(nombreCurso))];
    return await enviar(userId, `${nuevas.length} notas nuevas`, cursos.slice(0, 4).join(" · "), "notas-varias");
  }
  let n = 0;
  for (const f of nuevas) n += await enviar(userId, `Nota nueva: ${n1(f.nota)}`, `${nombreItem(f)} · ${nombreCurso(f)}`, `nota-${f.item_id}`);
  return n;
}

/* ---------- Respuesta para la app ---------- */
async function estado(userId: string) {
  const { data: con } = await admin.from("moodle_conexion").select("sitio, nombre, ultima, error, creado").eq("user_id", userId).maybeSingle();
  if (!con) return { conectado: false, sitio: SITIO_PREDET };
  const { data: notas } = await admin.from("moodle_notas").select("item_id, curso_id, curso, nombre, modulo, tipo, nota, maxima, texto, orden, publicada").eq("user_id", userId).order("curso").order("orden");
  return { conectado: true, sitio: con.sitio, nombre: con.nombre, ultima: con.ultima, error: con.error, notas: notas || [] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const p = await req.json().catch(() => ({}));

  /* Programador (pg_cron) */
  const cron = req.headers.get("x-cron");
  if (cron) {
    const { data: c } = await admin.from("push_config").select("valor").eq("clave", "cron").maybeSingle();
    if (!c?.valor || cron !== c.valor) return json({ error: "cron" }, 401);
    const { data: cons } = await admin.from("moodle_conexion").select("*").or("error.is.null,error.neq.token");
    let revisados = 0, avisos = 0;
    for (const con of cons || []) {
      try { const nuevas = await sincronizar(con); revisados++; avisos += await avisarNuevas(con.user_id, nuevas); }
      catch (e) { if (e instanceof Fallo && e.codigo === "token") await admin.from("moodle_conexion").update({ error: "token" }).eq("user_id", con.user_id); else console.warn("moodle", (e as Error).message); }
    }
    return json({ revisados, avisos });
  }

  /* App (con sesión) */
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return json({ error: "sin_sesion" }, 401);
  try {
    switch (p.accion) {
      case "estado": return json(await estado(user.id));
      case "conectar": {
        const sitio = limpiarSitio(p.sitio);
        const usuario = String(p.usuario || "").trim(), contrasena = String(p.contrasena || "");
        if (!usuario || !contrasena) throw new Fallo("login", "Escribe tu usuario y tu contraseña del campus.");
        const token = await pedirToken(sitio, usuario, contrasena);
        const info = await ws(sitio, token, "core_webservice_get_site_info");
        await admin.from("moodle_conexion").delete().eq("user_id", user.id);
        await admin.from("moodle_notas").delete().eq("user_id", user.id);
        const con = { user_id: user.id, sitio, token, moodle_user: info.userid, nombre: info.fullname || usuario, ultima: null };
        const { error } = await admin.from("moodle_conexion").insert(con);
        if (error) throw new Fallo("bd", error.message);
        await sincronizar(con);
        return json(await estado(user.id));
      }
      case "sincronizar": {
        const { data: con } = await admin.from("moodle_conexion").select("*").eq("user_id", user.id).maybeSingle();
        if (!con) return json({ conectado: false, sitio: SITIO_PREDET });
        const reciente = con.ultima && Date.now() - new Date(con.ultima).getTime() < 2 * 60000;
        if (!reciente || p.forzar) {
          try { await sincronizar(con); }
          catch (e) { if (e instanceof Fallo && e.codigo === "token") await admin.from("moodle_conexion").update({ error: "token" }).eq("user_id", user.id); else throw e; }
        }
        return json(await estado(user.id));
      }
      case "desconectar":
        await admin.from("moodle_notas").delete().eq("user_id", user.id);
        await admin.from("moodle_conexion").delete().eq("user_id", user.id);
        return json({ conectado: false, sitio: SITIO_PREDET });
    }
    return json({ error: "accion" }, 400);
  } catch (e) {
    if (e instanceof Fallo) return json({ error: e.codigo, detalle: e.message }, e.codigo === "login" || e.codigo === "sitio" ? 400 : 502);
    console.error(e);
    return json({ error: "interno", detalle: "No se ha podido hablar con el campus." }, 500);
  }
});
