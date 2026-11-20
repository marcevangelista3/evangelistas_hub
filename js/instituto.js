/* =========================================================
   CALENDARIO DEL INSTITUTO (enlace iCal del aula virtual)
   - El enlace se guarda en hub:ical (se sincroniza).
   - Los eventos se guardan en este dispositivo (hub:ical-eventos)
     y se ven en Calendario, Próximos eventos y Prioridades.
   - Lo que marcas como hecho va en hub:ical-hechas (se sincroniza).
   Son de solo lectura: se cambian en el aula virtual.
   ========================================================= */
import { TIPOS } from './tipos.js';

const K = { conf: 'hub:ical', cache: 'hub:ical-eventos', hechas: 'hub:ical-hechas' };
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export const confInstituto = () => leer(K.conf, null);
export const conectadoInstituto = () => !!confInstituto()?.url;

function detectarTipo(t, cat = '') {
  const s = `${t} ${cat}`;
  if (/examen|cuestionario|prueba|parcial|recuperaci[oó]n|quiz/i.test(s)) return 'examen';
  if (/vence|entrega|tarea|pr[aá]ctica|trabajo|actividad|due/i.test(s)) return 'tarea';
  if (/clase|tutor[ií]a|sesi[oó]n/i.test(s)) return 'clase';
  if (/festivo|vacaciones|puente|no lectivo/i.test(s)) return 'festivo';
  return 'evento';
}
const limpiar = (t) => t.replace(/^La tarea\s+/i, '').replace(/\s+(vence|se cierra|está en fecha de entrega)$/i, '').trim();

export function eventosInstituto() {
  if (!conectadoInstituto()) return [];
  const hechas = leer(K.hechas, {});
  return leer(K.cache, []).map((e) => {
    const tipo = detectarTipo(e.titulo, e.categoria);
    // Las entregas de Moodle solo tienen hora límite: van arriba, en «Todo el día», con la hora en el título
    const limite = !e.todoElDia && e.ini && !e.fin;
    const titulo = limpiar(e.titulo) + (limite && e.ini !== '00:00' ? ` · ${e.ini}` : '');
    return {
      id: 'i:' + e.uid, _instituto: true, titulo, fecha: e.fecha, todoElDia: e.todoElDia || limite,
      ini: limite ? '' : e.ini, fin: limite ? '' : e.fin, limite: limite ? e.ini : '', tipo, color: TIPOS[tipo]?.color || 'cielo',
      importancia: ['examen', 'tarea'].includes(tipo) ? 'alta' : 'media',
      lugar: e.lugar, descripcion: [e.categoria, e.descripcion].filter(Boolean).join('\n'), avisos: [], hecha: !!hechas[e.uid],
    };
  });
}
export function marcarHechaInstituto(uid, hecha) {
  const h = leer(K.hechas, {}); if (hecha) h[uid] = true; else delete h[uid];
  escribir(K.hechas, h);
}

async function descargar(url) {
  const { obtenerCliente, usuarioActual } = await import('./nube.js');
  if (!usuarioActual()) throw new Error('Inicia sesión en Perfil primero.');
  const { data, error } = await (await obtenerCliente()).functions.invoke('ical', { body: { url } });
  if (error) { const d = await error.context?.json?.().catch(() => null); throw new Error(d?.detalle || 'No se ha podido leer el calendario.'); }
  return data;
}

/** Guarda el enlace y trae los eventos. Devuelve cuántos ha encontrado. */
export async function conectarInstituto(url) {
  const d = await descargar(url);
  escribir(K.conf, { url: url.trim(), nombre: d.nombre || 'Instituto' });
  escribir(K.cache, d.eventos || []);
  return (d.eventos || []).length;
}
export function desconectarInstituto() {
  try { localStorage.removeItem(K.conf); localStorage.removeItem(K.cache); } catch {}
}

let enCurso = null;
/** Vuelve a bajar el calendario. Devuelve true si ha cambiado algo. */
export function sincronizarInstituto() {
  if (!conectadoInstituto()) return Promise.resolve(false);
  if (enCurso) return enCurso;
  enCurso = descargar(confInstituto().url).then((d) => {
    const ahora = JSON.stringify(d.eventos || []);
    if (localStorage.getItem(K.cache) === ahora) return false;
    try { localStorage.setItem(K.cache, ahora); } catch {}
    return true;
  }).finally(() => { enCurso = null; });
  return enCurso;
}
