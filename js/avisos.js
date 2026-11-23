/* =========================================================
   NOTIFICACIONES (Web Push)
   - Activar en cada dispositivo (Mac, iPhone…): pide permiso,
     crea la suscripción y la manda a la función «avisos».
   - Las preferencias (hub:avisos) se sincronizan y el servidor
     las lee cada 5 minutos para saber qué avisar y cuándo.
   En el iPhone solo funciona con la app añadida a la pantalla
   de inicio (iOS 16.4 o posterior).
   ========================================================= */
const PREFS = 'hub:avisos';
const LOCAL = 'hub-local:push';   // endpoint de este dispositivo (no se sincroniza)
const PREDET = { resumen: true, resumenHora: '08:00', vispera: true, visperaHora: '20:00', eventos: true, notas: true };

const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
export const preferencias = () => ({ ...PREDET, ...leer(PREFS, {}) });
export function guardarPreferencias(cambios) {
  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
  try { localStorage.setItem(PREFS, JSON.stringify({ ...preferencias(), ...cambios, zona })); } catch {}
}

export const esIphone = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** 'ok' | 'instalar' (iPhone sin añadir a inicio) | 'no' (el navegador no puede) */
export function soporte() {
  if (esIphone && !instalada()) return 'instalar';
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'ok' : 'no';
}
export const activadas = () => !!localStorage.getItem(LOCAL) && window.Notification?.permission === 'granted';

async function invocar(cuerpo) {
  const { obtenerCliente, usuarioActual } = await import('./nube.js');
  if (!usuarioActual()) throw new Error('Inicia sesión en Perfil primero.');
  const sb = await obtenerCliente();
  const { data, error } = await sb.functions.invoke('avisos', { body: cuerpo });
  if (error) { const d = await error.context?.json?.().catch(() => null); throw new Error(d?.detalle || 'No se ha podido hablar con el servidor.'); }
  return data;
}
const aBytes = (b64) => { const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };

export async function activar() {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error(esIphone ? 'Has denegado el permiso. Actívalo en Ajustes del iPhone → Notificaciones → HUB.' : 'Has denegado el permiso. Actívalo en Ajustes del sistema → Notificaciones → Safari (o tu navegador).');
  const reg = await navigator.serviceWorker.ready;
  const { clave } = await invocar({ accion: 'clave' });
  let sub = await reg.pushManager.getSubscription();
  if (sub && localStorage.getItem(LOCAL) !== sub.endpoint) { try { await sub.unsubscribe(); } catch {} sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clave) });
  await invocar({ accion: 'suscribir', sub: sub.toJSON(), dispositivo: esIphone ? 'iPhone' : /Mac/.test(navigator.userAgent) ? 'Mac' : 'Navegador' });
  localStorage.setItem(LOCAL, sub.endpoint);
  if (!localStorage.getItem(PREFS)) guardarPreferencias({});
}

export async function desactivar() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  const endpoint = sub?.endpoint || localStorage.getItem(LOCAL);
  try { await sub?.unsubscribe(); } catch {}
  localStorage.removeItem(LOCAL);
  if (endpoint) await invocar({ accion: 'desuscribir', endpoint }).catch(() => {});
}

export const probar = () => invocar({ accion: 'probar' });
