/* =========================================================
   GMAIL (solo lectura)
   Trae los correos de la bandeja principal de los últimos
   10 días (sin promociones ni notificaciones) y los guarda en
   este dispositivo (hub:correos). Se usan en Inicio y Elena.
   Va por la misma conexión de Google que el calendario.
   ========================================================= */
import { estadoGoogle, conectadoGoogle, conectarGoogle } from './google.js';

const CACHE = 'hub:correos';
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };

/** true si la conexión de Google ya incluye el permiso de Gmail */
export const gmailActivo = () => conectadoGoogle() && !!estadoGoogle().gmail;

export function correos() { return gmailActivo() ? leer(CACHE, []) : []; }

/** Importantes primero (sin leer, marcados por Gmail como importantes o destacados) */
export function importantes(n = 6) {
  const peso = (c) => (c.noLeido ? 4 : 0) + (c.importante ? 2 : 0) + (c.destacado ? 3 : 0);
  return correos().filter((c) => c.noLeido || c.destacado || c.importante)
    .sort((a, b) => peso(b) - peso(a) || b.fecha - a.fecha).slice(0, n);
}

export const enlaceGmail = (c) => `https://mail.google.com/mail/${estadoGoogle().correo ? `?authuser=${encodeURIComponent(estadoGoogle().correo)}` : 'u/0/'}#all/${c.hilo}`;

let enCurso = null;
/** Baja los correos. Devuelve true si ha cambiado algo. */
export function sincronizarCorreos() {
  if (!gmailActivo()) return Promise.resolve(false);
  if (enCurso) return enCurso;
  enCurso = (async () => {
    const { obtenerCliente, usuarioActual } = await import('./nube.js');
    if (!usuarioActual()) return false;
    const sb = await obtenerCliente();
    const { data, error } = await sb.functions.invoke('google', { body: { accion: 'correos' } });
    if (error) {
      const det = await error.context?.json?.().catch(() => null);
      if (det?.error === 'sin_gmail') { localStorage.setItem('hub:google', JSON.stringify({ ...estadoGoogle(), gmail: false })); return true; }
      throw new Error(det?.detalle || 'No se han podido traer los correos.');
    }
    const ahora = JSON.stringify(data.correos || []);
    if (localStorage.getItem(CACHE) === ahora) return false;
    try { localStorage.setItem(CACHE, ahora); } catch {}
    return true;
  })().finally(() => { enCurso = null; });
  return enCurso;
}

/** Pide a Google el permiso de Gmail (vuelve a Inicio) */
export const conectarGmail = () => conectarGoogle('inicio');
