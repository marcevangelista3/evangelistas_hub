// Conexión con Google Calendar y Gmail (solo lectura) (OAuth propio, sin tocar el inicio de sesión de la app).
// Secretos: GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET. El refresh token se guarda en
// public.google_conexion, que solo lee el servidor.
// GET  ?code&state  → vuelta de Google tras autorizar (redirige a la app)
// POST { accion }   → url | estado | eventos | crear | actualizar | borrar | correos | desconectar (con sesión)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const SECRETO = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const VUELTA = `${URL_BASE}/functions/v1/google`;
const GMAIL = "https://www.googleapis.com/auth/gmail.readonly";
const ALCANCE = `https://www.googleapis.com/auth/calendar.events ${GMAIL} openid email`;
const ORIGENES = [/^https:\/\/marcevangelista3\.github\.io\//, /^http:\/\/localhost(:\d+)?\//];
const admin = createClient(URL_BASE, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

/* ---------- state firmado (usuario + vuelta + caducidad) ---------- */
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function firma(texto: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRETO), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(texto))));
}
async function crearState(datos: Record<string, unknown>) {
  const cuerpo = b64(new TextEncoder().encode(JSON.stringify({ ...datos, exp: Date.now() + 10 * 60 * 1000 })));
  return `${cuerpo}.${await firma(cuerpo)}`;
}
async function leerState(s: string) {
  const [cuerpo, f] = s.split(".");
  if (!cuerpo || f !== await firma(cuerpo)) return null;
  const d = JSON.parse(new TextDecoder().decode(deB64(cuerpo)));
  return d.exp > Date.now() ? d : null;
}

/* ---------- Google ---------- */
async function tokenDe(userId: string) {
  const { data } = await admin.from("google_conexion").select("refresh_token").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: ID, client_secret: SECRETO, refresh_token: data.refresh_token, grant_type: "refresh_token" }),
  });
  const t = await r.json();
  if (!r.ok) { if (t.error === "invalid_grant") await admin.from("google_conexion").delete().eq("user_id", userId); return null; }
  if (t.scope) await admin.from("google_conexion").update({ alcance: t.scope }).eq("user_id", userId);
  return t.access_token as string;
}
const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
async function google(token: string, url: string, metodo = "GET", cuerpo?: unknown) {
  const r = await fetch(url, { method: metodo, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  if (r.status === 204 || r.status === 410) return {};
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `Google ${r.status}`);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!ID || !SECRETO) return json({ error: "falta_config" }, 503);
  const u = new URL(req.url);

  /* Vuelta de Google */
  if (req.method === "GET") {
    const st = await leerState(u.searchParams.get("state") || "").catch(() => null);
    if (!st) return new Response("El enlace ha caducado. Vuelve a la app y pulsa otra vez «Conectar Google Calendar».", { status: 400 });
    const ir = st.ir === "inicio" ? "inicio" : "calendario";
    const volver = (estado: string) => Response.redirect(`${st.volver}?google=${estado}#${ir}`, 302);
    const code = u.searchParams.get("code");
    if (!code) return volver("cancelado");
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: ID, client_secret: SECRETO, redirect_uri: VUELTA, grant_type: "authorization_code" }),
    });
    const t = await r.json();
    if (!r.ok || !t.refresh_token) return volver("error");
    let correo = null;
    try { correo = JSON.parse(new TextDecoder().decode(deB64(t.id_token.split(".")[1]))).email; } catch { /* sin correo */ }
    await admin.from("google_conexion").upsert({ user_id: st.u, refresh_token: t.refresh_token, correo, alcance: t.scope || null, conectado: new Date().toISOString() });
    return volver("ok");
  }

  /* Peticiones de la app (con sesión) */
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return json({ error: "sin_sesion" }, 401);
  const p = await req.json().catch(() => ({}));
  try {
    switch (p.accion) {
      case "url": {
        const volver = String(p.volver || "");
        if (!ORIGENES.some((re) => re.test(volver))) return json({ error: "origen" }, 400);
        const q = new URLSearchParams({ client_id: ID, redirect_uri: VUELTA, response_type: "code", scope: ALCANCE, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state: await crearState({ u: user.id, volver, ir: p.ir }) });
        return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${q}` });
      }
      case "estado": {
        const { data } = await admin.from("google_conexion").select("correo, conectado, alcance").eq("user_id", user.id).maybeSingle();
        return json({ conectado: !!data, correo: data?.correo || null, gmail: !!data?.alcance?.includes(GMAIL) });
      }
      case "desconectar": {
        const { data } = await admin.from("google_conexion").select("refresh_token").eq("user_id", user.id).maybeSingle();
        if (data) await fetch(`https://oauth2.googleapis.com/revoke?token=${data.refresh_token}`, { method: "POST" }).catch(() => {});
        await admin.from("google_conexion").delete().eq("user_id", user.id);
        return json({ ok: true });
      }
    }
    const token = await tokenDe(user.id);
    if (!token) return json({ error: "no_conectado" }, 409);
    switch (p.accion) {
      case "eventos": {
        const items: unknown[] = [];
        let pagina = "";
        do {
          const q = new URLSearchParams({ timeMin: p.desde, timeMax: p.hasta, singleEvents: "true", orderBy: "startTime", maxResults: "2500", ...(pagina ? { pageToken: pagina } : {}) });
          const d = await google(token, `${CAL}?${q}`);
          items.push(...(d.items || []).filter((e: any) => e.status !== "cancelled").map((e: any) => ({
            id: e.id, titulo: e.summary || "(Sin título)", inicio: e.start, fin: e.end, lugar: e.location || "", descripcion: e.description || "",
            hub: e.extendedProperties?.private || {},
          })));
          pagina = d.nextPageToken || "";
        } while (pagina && items.length < 5000);
        return json({ eventos: items });
      }
      case "crear": return json({ id: (await google(token, CAL, "POST", p.evento)).id });
      case "actualizar": await google(token, `${CAL}/${encodeURIComponent(p.id)}`, "PATCH", p.evento); return json({ ok: true });
      case "borrar": await google(token, `${CAL}/${encodeURIComponent(p.id)}`, "DELETE"); return json({ ok: true });
      case "correos": {
        // Bandeja principal de los últimos días (sin promociones, redes ni notificaciones)
        const GM = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
        const q = new URLSearchParams({ q: "in:inbox newer_than:10d -category:promotions -category:social -category:updates -category:forums", maxResults: "30" });
        let lista;
        try { lista = await google(token, `${GM}?${q}`); }
        catch (e) { if (/insufficient|scope|permission/i.test((e as Error).message)) return json({ error: "sin_gmail" }, 403); throw e; }
        const cab = (m: any, n: string) => m.payload?.headers?.find((h: any) => h.name.toLowerCase() === n)?.value || "";
        const correos = await Promise.all((lista.messages || []).map(async ({ id }: { id: string }) => {
          const m = await google(token, `${GM}/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`);
          const de = cab(m, "from"), nombre = de.replace(/<.*>/, "").replace(/"/g, "").trim();
          return { id: m.id, hilo: m.threadId, de: nombre || de, correoDe: (de.match(/<(.+)>/)?.[1] || de).toLowerCase(), asunto: cab(m, "subject") || "(Sin asunto)",
            fragmento: (m.snippet || "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&"), fecha: +m.internalDate,
            noLeido: m.labelIds?.includes("UNREAD") || false, importante: m.labelIds?.includes("IMPORTANT") || false, destacado: m.labelIds?.includes("STARRED") || false };
        }));
        return json({ correos });
      }
    }
    return json({ error: "accion" }, 400);
  } catch (e) {
    return json({ error: "google", detalle: (e as Error).message }, 502);
  }
});
