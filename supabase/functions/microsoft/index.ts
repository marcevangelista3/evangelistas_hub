// Conexión con Outlook (Microsoft Graph, solo lectura del correo). OAuth propio.
// Secretos: MICROSOFT_CLIENT_ID y MICROSOFT_CLIENT_SECRET. El refresh token se guarda en
// public.microsoft_conexion, que solo lee el servidor. Microsoft lo renueva en cada uso.
// GET  ?code&state  → vuelta de Microsoft tras autorizar (redirige a la app)
// POST { accion }   → url | estado | correos | desconectar (con sesión)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const ID = Deno.env.get("MICROSOFT_CLIENT_ID") || "";
const SECRETO = Deno.env.get("MICROSOFT_CLIENT_SECRET") || "";
const VUELTA = `${URL_BASE}/functions/v1/microsoft`;
const AUT = "https://login.microsoftonline.com/common/oauth2/v2.0";
const ALCANCE = "openid email offline_access User.Read Mail.Read";
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

/* ---------- Microsoft ---------- */
const pedirToken = (datos: Record<string, string>) => fetch(`${AUT}/token`, {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: ID, client_secret: SECRETO, scope: ALCANCE, ...datos }),
});
async function tokenDe(userId: string) {
  const { data } = await admin.from("microsoft_conexion").select("refresh_token").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  const r = await pedirToken({ refresh_token: data.refresh_token, grant_type: "refresh_token" });
  const t = await r.json();
  if (!r.ok) { if (t.error === "invalid_grant") await admin.from("microsoft_conexion").delete().eq("user_id", userId); return null; }
  if (t.refresh_token && t.refresh_token !== data.refresh_token) await admin.from("microsoft_conexion").update({ refresh_token: t.refresh_token }).eq("user_id", userId);
  return t.access_token as string;
}
async function graph(token: string, ruta: string) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${ruta}`, { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `Microsoft ${r.status}`);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!ID || !SECRETO) return json({ error: "falta_config" }, 503);
  const u = new URL(req.url);

  /* Vuelta de Microsoft */
  if (req.method === "GET") {
    const st = await leerState(u.searchParams.get("state") || "").catch(() => null);
    if (!st) return new Response("El enlace ha caducado. Vuelve a la app y pulsa otra vez «Conectar Outlook».", { status: 400 });
    const volver = (estado: string) => Response.redirect(`${st.volver}?outlook=${estado}#inicio`, 302);
    const code = u.searchParams.get("code");
    if (!code) return volver(u.searchParams.get("error") === "access_denied" ? "cancelado" : "error");
    const r = await pedirToken({ code, redirect_uri: VUELTA, grant_type: "authorization_code" });
    const t = await r.json();
    if (!r.ok || !t.refresh_token) return volver("error");
    let correo = null;
    try {
      const yo = await graph(t.access_token, "/me?$select=mail,userPrincipalName");
      correo = yo.mail || yo.userPrincipalName || null;
    } catch { /* sin correo */ }
    await admin.from("microsoft_conexion").upsert({ user_id: st.u, refresh_token: t.refresh_token, correo, conectado: new Date().toISOString() });
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
        const q = new URLSearchParams({ client_id: ID, redirect_uri: VUELTA, response_type: "code", response_mode: "query", scope: ALCANCE, prompt: "select_account", state: await crearState({ u: user.id, volver }) });
        return json({ url: `${AUT}/authorize?${q}` });
      }
      case "estado": {
        const { data } = await admin.from("microsoft_conexion").select("correo").eq("user_id", user.id).maybeSingle();
        return json({ conectado: !!data, correo: data?.correo || null });
      }
      case "desconectar":
        await admin.from("microsoft_conexion").delete().eq("user_id", user.id);
        return json({ ok: true });
      case "correos": {
        const token = await tokenDe(user.id);
        if (!token) return json({ error: "no_conectado" }, 409);
        const desde = new Date(Date.now() - 10 * 86400000).toISOString();
        const q = new URLSearchParams({
          $filter: `receivedDateTime ge ${desde}`, $orderby: "receivedDateTime desc", $top: "40",
          $select: "id,conversationId,subject,from,bodyPreview,receivedDateTime,isRead,importance,flag,inferenceClassification,webLink",
        });
        const d = await graph(token, `/me/mailFolders/inbox/messages?${q}`);
        // Solo la bandeja «Prioritarios» (lo que Outlook considera importante para ti)
        const correos = (d.value || []).filter((m: any) => m.inferenceClassification !== "other").slice(0, 30).map((m: any) => ({
          id: m.id, hilo: m.conversationId, de: m.from?.emailAddress?.name || m.from?.emailAddress?.address || "",
          correoDe: (m.from?.emailAddress?.address || "").toLowerCase(), asunto: m.subject || "(Sin asunto)",
          fragmento: (m.bodyPreview || "").replace(/\s+/g, " ").slice(0, 200), fecha: Date.parse(m.receivedDateTime),
          noLeido: !m.isRead, importante: m.importance === "high", destacado: m.flag?.flagStatus === "flagged", enlace: m.webLink,
        }));
        return json({ correos });
      }
    }
    return json({ error: "accion" }, 400);
  } catch (e) {
    return json({ error: "microsoft", detalle: (e as Error).message }, 502);
  }
});
