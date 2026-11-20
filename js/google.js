/* =========================================================
   GOOGLE CALENDAR (en los dos sentidos)
   - Los eventos de tu Google Calendar se guardan en este
     dispositivo (hub:google-eventos) y se ven en el calendario,
     en Próximos eventos y en Prioridades de hoy.
   - Lo que creas o cambias en la app (o Elena) se manda a Google.
   La conexión la hace la función «google» de Supabase.
   ========================================================= */
import { TIPOS } from './tipos.js';

const K = { cache: 'hub:google-eventos', estado: 'hub:google', hechas: 'hub:google-hechas', locales: 'hub:eventos' };
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hora = (d) => d.toTimeString().slice(0, 5);
const ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';

export const estadoGoogle = () => leer(K.estado, { conectado: false });
export const conectadoGoogle = () => !!estadoGoogle().conectado;

async function llamar(accion, extra = {}) {
  const { obtenerCliente, usuarioActual } = await import('./nube.js');
  if (!usuarioActual()) throw new Error('Inicia sesión en Perfil primero.');
  const sb = await obtenerCliente();
  const { data, error } = await sb.functions.invoke('google', { body: { accion, ...extra } });
  if (error) {
    const det = await error.context?.json?.().catch(() => null);
    const e = new Error(det?.error === 'falta_config' ? 'Faltan los códigos de Google en Supabase.' : det?.error === 'no_conectado' ? 'Google Calendar no está conectado.' : det?.detalle || 'No se ha podido hablar con Google.');
    e.codigo = det?.error;
    if (det?.error === 'no_conectado') escribir(K.estado, { conectado: false });
    throw e;
  }
  return data;
}

/* ---------- Conversión ---------- */
function detectarTipo(t) {
  if (/examen|parcial|recuperaci[oó]n/i.test(t)) return 'examen';
  if (/entreg|pr[aá]ctica|trabajo|tarea|deberes/i.test(t)) return 'tarea';
  if (/recordatorio|recordar|recu[eé]rdame/i.test(t)) return 'recordatorio';
  if (/gimnasio|gym|entreno|partido|p[aá]del/i.test(t)) return 'deporte';
  if (/clase|tutor[ií]a/i.test(t)) return 'clase';
  if (/m[eé]dico|dentista|cita|reuni[oó]n/i.test(t)) return 'cita';
  return 'evento';
}
function deGoogle(g, hechas) {
  const todoElDia = !!g.inicio?.date;
  const ini = todoElDia ? null : new Date(g.inicio.dateTime), fin = todoElDia ? null : new Date(g.fin?.dateTime || g.inicio.dateTime);
  const tipo = TIPOS[g.hub?.hubTipo] ? g.hub.hubTipo : detectarTipo(g.titulo);
  return {
    id: 'g:' + g.id, googleId: g.id, _google: true,
    titulo: g.titulo, fecha: todoElDia ? g.inicio.date : iso(ini), todoElDia,
    ini: todoElDia ? '' : hora(ini), fin: todoElDia ? '' : (iso(fin) === iso(ini) ? hora(fin) : '23:59'),
    tipo, color: g.hub?.hubColor || TIPOS[tipo].color,
    importancia: g.hub?.hubImportancia || (['tarea', 'examen'].includes(tipo) ? 'alta' : 'media'),
    lugar: g.lugar, descripcion: g.descripcion, avisos: [], hecha: !!hechas[g.id],
  };
}
function aGoogle(e) {
  const sig = (f) => { const [a, m, d] = f.split('-').map(Number); return iso(new Date(a, m - 1, d + 1)); };
  return {
    summary: e.titulo, location: e.lugar || '', description: e.descripcion || '',
    start: e.todoElDia || !e.ini ? { date: e.fecha } : { dateTime: `${e.fecha}T${e.ini}:00`, timeZone: ZONA },
    end: e.todoElDia || !e.ini ? { date: sig(e.fecha) } : { dateTime: `${e.fecha}T${(e.fin && e.fin > e.ini ? e.fin : e.ini)}:00`, timeZone: ZONA },
    extendedProperties: { private: { hubTipo: e.tipo || 'evento', hubImportancia: e.importancia || 'media', hubColor: e.color || '' } },
  };
}

/** Eventos de Google que no son copia de uno creado en la app */
export function eventosGoogle() {
  if (!conectadoGoogle()) return [];
  const propios = new Set(leer(K.locales, []).map((e) => e.googleId).filter(Boolean));
  const hechas = leer(K.hechas, {});
  return leer(K.cache, []).filter((g) => !propios.has(g.id)).map((g) => deGoogle(g, hechas));
}
export function marcarHechaGoogle(id, hecha) {
  const h = leer(K.hechas, {}); if (hecha) h[id] = true; else delete h[id];
  escribir(K.hechas, h);
}

/* ---------- Acciones ---------- */
export async function conectarGoogle(ir = 'calendario') {
  const { url } = await llamar('url', { volver: location.origin + location.pathname, ir });
  location.href = url;
}
export async function desconectarGoogle() {
  await llamar('desconectar');
  escribir(K.estado, { conectado: false });
  try { localStorage.removeItem(K.cache); localStorage.removeItem('hub:correos'); } catch {}
}
export async function comprobarGoogle() {
  const d = await llamar('estado');
  escribir(K.estado, d);
  return d;
}

let enCurso = null;
/** Baja tus eventos (del mes pasado a 6 meses vista). Devuelve true si ha cambiado algo. */
export function sincronizarGoogle() {
  if (!conectadoGoogle()) return Promise.resolve(false);
  if (enCurso) return enCurso;
  const hoy = new Date();
  enCurso = llamar('eventos', { desde: new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString(), hasta: new Date(hoy.getFullYear(), hoy.getMonth() + 7, 1).toISOString() })
    .then(({ eventos }) => {
      const antes = localStorage.getItem(K.cache), ahora = JSON.stringify(eventos);
      if (antes === ahora) return false;
      try { localStorage.setItem(K.cache, ahora); } catch {}
      return true;
    })
    .finally(() => { enCurso = null; });
  return enCurso;
}

/** Crea en Google y devuelve su id (o null si no está conectado o falla) */
export async function subirAGoogle(e) {
  if (!conectadoGoogle()) return null;
  try { return (await llamar('crear', { evento: aGoogle(e) })).id; } catch (err) { console.warn('Google:', err.message); return null; }
}
export async function actualizarEnGoogle(googleId, e) {
  await llamar('actualizar', { id: googleId, evento: aGoogle(e) });
  // Se actualiza también la copia local para verlo al momento
  const l = leer(K.cache, []).map((g) => (g.id === googleId ? { ...g, titulo: e.titulo, lugar: e.lugar, descripcion: e.descripcion, inicio: aGoogle(e).start, fin: aGoogle(e).end, hub: aGoogle(e).extendedProperties.private } : g));
  escribir(K.cache, l);
}
export async function borrarEnGoogle(googleId) {
  await llamar('borrar', { id: googleId });
  escribir(K.cache, leer(K.cache, []).filter((g) => g.id !== googleId));
}

/* ---------- Arranque: vuelta de Google y sincronización automática ---------- */
function aviso(texto) {
  const a = document.createElement('div');
  a.className = 'aviso-flotante cristal'; a.textContent = texto;
  document.body.append(a); setTimeout(() => a.remove(), 5000);
}
export function iniciarGoogle(alCambiarCuenta) {
  const q = new URLSearchParams(location.search);
  const vuelta = q.get('google');
  if (vuelta) history.replaceState(null, '', location.pathname + location.hash);
  const refrescar = async () => {
    const ruta = () => location.hash.replace(/^#\/?/, '').split(/[/-]/)[0] || 'inicio';
    const repintar = (secciones) => { if (secciones.includes(ruta()) && !document.querySelector('dialog[open]') && !document.documentElement.classList.contains('bloqueado')) dispatchEvent(new Event('hub:recargar')); };
    try { if (await sincronizarGoogle()) repintar(['calendario', 'inicio']); } catch (e) { console.warn('Google:', e.message); }
    try { const { sincronizarCorreos } = await import('./correo.js'); if (await sincronizarCorreos()) repintar(['inicio']); } catch (e) { console.warn('Gmail:', e.message); }
  };
  let primera = true;
  const alEntrar = async (u) => {
    if (!u || !primera) return;
    primera = false;
    if (vuelta === 'ok') {
      try { const d = await comprobarGoogle(); aviso(d.gmail ? 'Google conectado: trayendo tus eventos y tus correos…' : 'Google Calendar conectado. Trayendo tus eventos…'); } catch (e) { aviso(e.message); }
    } else if (vuelta === 'error') aviso('Google no ha dado permiso. Prueba otra vez desde Calendario.');
    if (vuelta && vuelta !== 'ok') return;
    refrescar();
  };
  alCambiarCuenta(alEntrar);
  // Por si la sesión ya estaba lista antes de cargar este módulo
  import('./nube.js').then((n) => { const u = n.usuarioActual(); if (u) alEntrar(u); });
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refrescar(); });
}
