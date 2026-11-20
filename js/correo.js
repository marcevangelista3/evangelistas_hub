/* =========================================================
   CORREO (solo lectura): Gmail y Outlook
   - Gmail va por la misma conexión de Google que el calendario.
   - Outlook va por la función «microsoft» de Supabase.
   Se traen los correos de la bandeja principal de los últimos
   10 días y se guardan en este dispositivo (hub:correos y
   hub:correos-outlook). Se usan en Inicio y en Elena.
   ========================================================= */
import { estadoGoogle, conectadoGoogle, conectarGoogle } from './google.js';

const K = { gmail: 'hub:correos', outlook: 'hub:correos-outlook', estadoOutlook: 'hub:outlook' };
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ---------- Estado ---------- */
export const gmailActivo = () => conectadoGoogle() && !!estadoGoogle().gmail;
export const estadoOutlook = () => leer(K.estadoOutlook, { conectado: false });
export const outlookActivo = () => !!estadoOutlook().conectado;
export const algunCorreo = () => gmailActivo() || outlookActivo();

export function correos() {
  const g = gmailActivo() ? leer(K.gmail, []).map((c) => ({ ...c, origen: 'gmail' })) : [];
  const o = outlookActivo() ? leer(K.outlook, []).map((c) => ({ ...c, origen: 'outlook' })) : [];
  return [...g, ...o].sort((a, b) => b.fecha - a.fecha);
}

/** Importantes primero (sin leer, marcados como importantes o destacados) */
export function importantes(n = 6) {
  const peso = (c) => (c.noLeido ? 4 : 0) + (c.importante ? 2 : 0) + (c.destacado ? 3 : 0);
  return correos().filter((c) => c.noLeido || c.destacado || c.importante)
    .sort((a, b) => peso(b) - peso(a) || b.fecha - a.fecha).slice(0, n);
}

export function enlace(c) {
  if (c.enlace) return c.enlace;
  const cuenta = estadoGoogle().correo;
  return `https://mail.google.com/mail/${cuenta ? `?authuser=${encodeURIComponent(cuenta)}` : 'u/0/'}#all/${c.hilo}`;
}

/* ---------- Llamadas ---------- */
async function invocar(funcion, cuerpo) {
  const { obtenerCliente, usuarioActual } = await import('./nube.js');
  if (!usuarioActual()) throw new Error('Inicia sesión en Perfil primero.');
  const sb = await obtenerCliente();
  const { data, error } = await sb.functions.invoke(funcion, { body: cuerpo });
  if (error) {
    const det = await error.context?.json?.().catch(() => null);
    const e = new Error(det?.error === 'falta_config' ? 'Faltan los códigos de Microsoft en Supabase.' : det?.detalle || 'No se ha podido conectar.');
    e.codigo = det?.error; throw e;
  }
  return data;
}

async function traerGmail() {
  if (!gmailActivo()) return false;
  try {
    const { correos: lista } = await invocar('google', { accion: 'correos' });
    const ahora = JSON.stringify(lista || []);
    if (localStorage.getItem(K.gmail) === ahora) return false;
    localStorage.setItem(K.gmail, ahora); return true;
  } catch (e) {
    if (e.codigo === 'sin_gmail') { escribir('hub:google', { ...estadoGoogle(), gmail: false }); return true; }
    throw e;
  }
}
async function traerOutlook() {
  if (!outlookActivo()) return false;
  try {
    const { correos: lista } = await invocar('microsoft', { accion: 'correos' });
    const ahora = JSON.stringify(lista || []);
    if (localStorage.getItem(K.outlook) === ahora) return false;
    localStorage.setItem(K.outlook, ahora); return true;
  } catch (e) {
    if (e.codigo === 'no_conectado') { escribir(K.estadoOutlook, { conectado: false }); return true; }
    throw e;
  }
}

let enCurso = null;
/** Baja los correos de las dos cuentas. Devuelve true si ha cambiado algo. */
export function sincronizarCorreos() {
  if (!algunCorreo()) return Promise.resolve(false);
  if (enCurso) return enCurso;
  enCurso = Promise.allSettled([traerGmail(), traerOutlook()])
    .then((r) => { r.filter((x) => x.status === 'rejected').forEach((x) => console.warn('Correo:', x.reason?.message)); return r.some((x) => x.value); })
    .finally(() => { enCurso = null; });
  return enCurso;
}

/* ---------- Conectar y desconectar ---------- */
export const conectarGmail = () => conectarGoogle('inicio');

export async function conectarOutlook() {
  const { url } = await invocar('microsoft', { accion: 'url', volver: location.origin + location.pathname });
  location.href = url;
}
export async function desconectarOutlook() {
  await invocar('microsoft', { accion: 'desconectar' });
  escribir(K.estadoOutlook, { conectado: false });
  try { localStorage.removeItem(K.outlook); } catch {}
}

/* ---------- Arranque: vuelta de Microsoft y sincronización ---------- */
function aviso(texto) {
  const a = document.createElement('div');
  a.className = 'aviso-flotante cristal'; a.textContent = texto;
  document.body.append(a); setTimeout(() => a.remove(), 5000);
}
const repintar = () => {
  const ruta = location.hash.replace(/^#\/?/, '').split(/[/-]/)[0] || 'inicio';
  if (ruta === 'inicio' && !document.querySelector('dialog[open]') && !document.documentElement.classList.contains('bloqueado')) dispatchEvent(new Event('hub:recargar'));
};
export function iniciarCorreo(alCambiarCuenta) {
  const vuelta = new URLSearchParams(location.search).get('outlook');
  if (vuelta) history.replaceState(null, '', location.pathname + location.hash);
  let primera = true;
  const alEntrar = async (u) => {
    if (!u || !primera) return;
    primera = false;
    if (vuelta === 'ok') {
      try { escribir(K.estadoOutlook, await invocar('microsoft', { accion: 'estado' })); aviso('Outlook conectado. Trayendo tus correos…'); } catch (e) { aviso(e.message); }
    } else if (vuelta === 'error') aviso('Microsoft no ha dado permiso. Prueba otra vez desde Inicio.');
    // Gmail ya lo sincroniza google.js; aquí solo hace falta si no hay Google
    if (outlookActivo()) { try { if (await sincronizarCorreos()) repintar(); } catch {} }
  };
  alCambiarCuenta(alEntrar);
  import('./nube.js').then((n) => { const u = n.usuarioActual(); if (u) alEntrar(u); });
  addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && outlookActivo() && !conectadoGoogle()) { try { if (await sincronizarCorreos()) repintar(); } catch {} }
  });
}
