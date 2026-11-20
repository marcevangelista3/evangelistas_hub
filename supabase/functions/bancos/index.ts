// Bancos automáticos con Enable Banking (solo lectura: saldos y movimientos).
// Secretos: ENABLEBANKING_APP_ID y ENABLEBANKING_KEY (contenido del .pem).
// La sesión de cada banco se guarda en public.bancos_conexion, que solo lee el servidor.
// GET  ?code&state  → vuelta del banco tras dar permiso (redirige a la app)
// POST { accion }   → bancos | url | estado | sincronizar | desconectar (con sesión)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_ID = (Deno.env.get("ENABLEBANKING_APP_ID") || "").trim();
const CLAVE = Deno.env.get("ENABLEBANKING_KEY") || "";
const API = "https://api.enablebanking.com";
const VUELTA = `${URL_BASE}/functions/v1/bancos`;
const ORIGENES = [/^https:\/\/marcevangelista3\.github\.io\//, /^http:\/\/localhost(:\d+)?\//];
const admin = createClient(URL_BASE, SERVICIO, { auth: { persistSession: false } });

/* ---------- base64url ---------- */
const b64 = (u: Uint8Array) => { let s = ""; for (const x of u) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const deB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const txt = (o: unknown) => b64(new TextEncoder().encode(JSON.stringify(o)));

/* ---------- state firmado ---------- */
async function firma(texto: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICIO), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(texto))));
}
async function crearState(d: Record<string, unknown>) { const c = txt({ ...d, exp: Date.now() + 20 * 60 * 1000 }); return `${c}.${await firma(c)}`; }
async function leerState(s: string) {
  const [c, f] = s.split(".");
  if (!c || f !== await firma(c)) return null;
  const d = JSON.parse(new TextDecoder().decode(deB64(c)));
  return d.exp > Date.now() ? d : null;
}

/* ---------- JWT de la aplicación (RS256) ---------- */
function derLen(n: number) { return n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255]; }
function pkcs1aPkcs8(pkcs1: Uint8Array) {
  const alg = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const oct = [0x04, ...derLen(pkcs1.length)];
  const cuerpo = [0x02, 0x01, 0x00, ...alg, ...oct];
  const total = cuerpo.length + pkcs1.length;
  const out = new Uint8Array([0x30, ...derLen(total), ...cuerpo, ...pkcs1].length);
  out.set([0x30, ...derLen(total), ...cuerpo]); out.set(pkcs1, out.length - pkcs1.length);
  return out;
}
let llave: CryptoKey | null = null;
async function claveFirma() {
  if (llave) return llave;
  const rsa = /BEGIN RSA PRIVATE KEY/.test(CLAVE);
  const cuerpo = CLAVE.replace(/-----(BEGIN|END)[^-]*-----/g, "").replace(/\\n/g, "").replace(/[^A-Za-z0-9+/=]/g, "");
  let der = Uint8Array.from(atob(cuerpo), (c) => c.charCodeAt(0));
  if (rsa) der = pkcs1aPkcs8(der);
  llave = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  return llave;
}
async function jwtApp() {
  const ahora = Math.floor(Date.now() / 1000);
  const datos = `${txt({ typ: "JWT", alg: "RS256", kid: APP_ID })}.${txt({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: ahora, exp: ahora + 3600 })}`;
  const f = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await claveFirma(), new TextEncoder().encode(datos)));
  return `${datos}.${b64(f)}`;
}
async function eb(ruta: string, metodo = "GET", cuerpo?: unknown) {
  const r = await fetch(API + ruta, { method: metodo, headers: { Authorization: `Bearer ${await jwtApp()}`, "Content-Type": "application/json", Accept: "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d?.message || d?.detail || `Enable Banking ${r.status}`) as Error & { estado?: number }; e.estado = r.status; throw e; }
  return d;
}

/* ---------- Movimientos ---------- */
const nombreBanco = (n: string) => /revolut/i.test(n) ? "Revolut" : /bbva/i.test(n) ? "BBVA" : n;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const iso = (d: Date) => d.toISOString().slice(0, 10);

function aFila(t: any, banco: string, iban: string, vistos: Record<string, number>) {
  if (t.status && t.status !== "BOOK") return null;
  const cant = parseFloat(t.transaction_amount?.amount);
  if (!isFinite(cant) || !cant) return null;
  const importe = Math.round((t.credit_debit_indicator === "DBIT" ? -Math.abs(cant) : Math.abs(cant)) * 100) / 100;
  const fecha = t.booking_date || t.value_date || t.transaction_date;
  if (!fecha) return null;
  const otro = importe < 0 ? t.creditor?.name : t.debtor?.name;
  const info = (Array.isArray(t.remittance_information) ? t.remittance_information : [t.remittance_information]).filter(Boolean).join(" ");
  const concepto = String(otro || info || t.bank_transaction_code?.description || "Sin concepto").trim().slice(0, 200);
  const ref = t.entry_reference || t.transaction_id;
  let huella: string;
  if (ref) huella = `eb|${iban}|${ref}`;
  else { const base = `eb|${iban}|${fecha}|${importe.toFixed(2)}|${norm(concepto)}`; vistos[base] = (vistos[base] || 0) + 1; huella = `${base}|${vistos[base]}`; }
  return { banco, fecha, concepto, importe, moneda: t.transaction_amount?.currency || "EUR", huella };
}

async function sincronizar(userId: string, forzar: boolean) {
  const { data: conexiones } = await admin.from("bancos_conexion").select("*").eq("user_id", userId);
  let nuevos = 0; const errores: string[] = [];
  for (const c of conexiones || []) {
    if (new Date(c.valido_hasta) < new Date()) { errores.push(`${c.banco}: el permiso ha caducado, vuelve a conectarlo.`); continue; }
    if (!forzar && c.ultima && Date.now() - new Date(c.ultima).getTime() < 4 * 3600 * 1000) continue;
    if (forzar && c.ultima && Date.now() - new Date(c.ultima).getTime() < 10 * 60 * 1000) continue;
    const saldos: any[] = [];
    try {
      for (const cu of c.cuentas || []) {
        // Saldo
        try {
          const b = await eb(`/accounts/${cu.uid}/balances`);
          const pref = ["ITAV", "CLAV", "ITBD", "CLBD", "XPCD", "OTHR"];
          const bal = (b.balances || []).sort((x: any, y: any) => pref.indexOf(x.balance_type) - pref.indexOf(y.balance_type))[0];
          if (bal) saldos.push({ iban: cu.iban, nombre: cu.nombre, importe: parseFloat(bal.balance_amount.amount), moneda: bal.balance_amount.currency });
        } catch { /* sin saldo */ }
        // Desde cuándo: la primera vez, desde el día siguiente al último movimiento importado a mano de ese banco
        let desde = cu.desde as string | undefined;
        if (!desde) {
          const { data: ult } = await admin.from("movimientos").select("fecha").eq("user_id", userId).eq("banco", c.banco).not("huella", "like", "eb|%").order("fecha", { ascending: false }).limit(1).maybeSingle();
          const min = new Date(Date.now() - 89 * 86400000);
          desde = ult ? iso(new Date(Math.max(+new Date(ult.fecha + "T12:00:00Z") + 86400000, +min))) : iso(min);
          cu.desde = desde;
        }
        const ultimaFecha = cu.hasta ? iso(new Date(Math.max(+new Date(cu.hasta + "T12:00:00Z") - 5 * 86400000, +new Date(desde + "T12:00:00Z")))) : desde;
        const filas: any[] = [], vistos: Record<string, number> = {};
        let cont: string | undefined, vueltas = 0;
        do {
          const q = new URLSearchParams({ date_from: ultimaFecha }); if (cont) q.set("continuation_key", cont);
          const d = await eb(`/accounts/${cu.uid}/transactions?${q}`);
          for (const t of d.transactions || []) { const f = aFila(t, c.banco, cu.iban || cu.uid, vistos); if (f && f.fecha >= desde) filas.push(f); }
          cont = d.continuation_key || undefined;
        } while (cont && ++vueltas < 20);
        if (filas.length) {
          const meter = filas.map((f) => ({ ...f, user_id: userId }));
          for (let i = 0; i < meter.length; i += 500) {
            const { data: metidos, error } = await admin.from("movimientos").upsert(meter.slice(i, i + 500), { onConflict: "user_id,huella", ignoreDuplicates: true }).select("huella");
            if (error) throw error;
            nuevos += (metidos || []).length;
          }
        }
        cu.hasta = iso(new Date());
      }
      await admin.from("bancos_conexion").update({ cuentas: c.cuentas, saldos, ultima: new Date().toISOString() }).eq("id", c.id);
    } catch (e) {
      const est = (e as any).estado;
      errores.push(`${c.banco}: ${est === 401 || est === 403 ? "el banco ha retirado el permiso, vuelve a conectarlo." : (e as Error).message}`);
    }
  }
  return { nuevos, errores };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url);

  /* Vuelta del banco */
  if (req.method === "GET") {
    const st = await leerState(u.searchParams.get("state") || "").catch(() => null);
    if (!st) return new Response("El enlace ha caducado. Vuelve a la app y conecta el banco otra vez.", { status: 400 });
    const volver = (estado: string) => Response.redirect(`${st.volver}?bancos=${estado}#finanzas`, 302);
    const code = u.searchParams.get("code");
    if (!code) return volver("cancelado");
    try {
      const s = await eb("/sessions", "POST", { code });
      const cuentas = (s.accounts || []).map((a: any) => ({ uid: a.uid, iban: a.account_id?.iban || a.account_id?.other?.identification || "", nombre: a.name || a.product || "", moneda: a.currency || "EUR" }));
      const banco = nombreBanco(s.aspsp?.name || st.banco);
      await admin.from("bancos_conexion").delete().eq("user_id", st.u).eq("banco", banco);
      await admin.from("bancos_conexion").insert({ user_id: st.u, banco, pais: s.aspsp?.country || "ES", session_id: s.session_id, cuentas, valido_hasta: s.access?.valid_until || new Date(Date.now() + 89 * 86400000).toISOString() });
      return volver("ok");
    } catch { return volver("error"); }
  }

  /* Peticiones de la app (con sesión) */
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return json({ error: "sin_sesion" }, 401);
  const p = await req.json().catch(() => ({}));
  if (p.accion === "estado") {
    const { data } = await admin.from("bancos_conexion").select("id, banco, cuentas, saldos, valido_hasta, ultima").eq("user_id", user.id).order("banco");
    return json({ configurado: !!(APP_ID && CLAVE), bancos: (data || []).map((c: any) => ({ id: c.id, banco: c.banco, cuentas: (c.cuentas || []).length, saldos: c.saldos || [], valido_hasta: c.valido_hasta, ultima: c.ultima })) });
  }
  if (!APP_ID || !CLAVE) return json({ error: "falta_config", detalle: "Falta guardar la clave de Enable Banking en Supabase." }, 503);
  try {
    switch (p.accion) {
      case "bancos": {
        const d = await eb(`/aspsps?country=${encodeURIComponent(p.pais || "ES")}&psu_type=personal`);
        return json({ bancos: (d.aspsps || []).map((a: any) => ({ nombre: a.name, pais: a.country, logo: a.logo })) });
      }
      case "url": {
        const volver = String(p.volver || "");
        if (!ORIGENES.some((re) => re.test(volver))) return json({ error: "origen" }, 400);
        const pais = String(p.pais || "ES");
        let dias = 90;
        try { const d = await eb(`/aspsps?country=${pais}&psu_type=personal`); const a = (d.aspsps || []).find((x: any) => x.name === p.banco); if (a?.maximum_consent_validity) dias = Math.floor(a.maximum_consent_validity / 86400); } catch { /* 90 días */ }
        const hasta = new Date(Date.now() + Math.max(1, Math.min(dias, 180)) * 86400000 - 3600000).toISOString();
        const d = await eb("/auth", "POST", { access: { valid_until: hasta }, aspsp: { name: p.banco, country: pais }, state: await crearState({ u: user.id, volver, banco: p.banco }), redirect_url: VUELTA, psu_type: "personal" });
        return json({ url: d.url });
      }
      case "sincronizar": return json(await sincronizar(user.id, !!p.forzar));
      case "desconectar": {
        const { data: c } = await admin.from("bancos_conexion").select("id, session_id").eq("user_id", user.id).eq("id", p.id).maybeSingle();
        if (c) { try { await eb(`/sessions/${c.session_id}`, "DELETE"); } catch { /* ya no existía */ } await admin.from("bancos_conexion").delete().eq("id", c.id); }
        return json({ ok: true });
      }
      default: return json({ error: "accion" }, 400);
    }
  } catch (e) {
    return json({ error: "banco", detalle: (e as Error).message }, 502);
  }
});
