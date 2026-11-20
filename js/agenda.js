/* =========================================================
   AGENDA: lo que sale en «Prioridades de hoy»
   Sale del calendario: recordatorios, tareas/entregas y
   exámenes del día (y cualquier evento de importancia alta).
   Lo que se quedó sin hacer en los últimos 7 días aparece
   como atrasado hasta que lo marques.
   ========================================================= */
import { TIPOS_PRIORIDAD } from './tipos.js';
import { iso, sumarDias } from './registro.js';
import { eventosGoogle, marcarHechaGoogle, subirAGoogle } from './google.js';
import { eventosInstituto, marcarHechaInstituto } from './instituto.js';

const K = 'hub:eventos';
const leer = () => { try { return JSON.parse(localStorage.getItem(K)) || []; } catch { return []; } };
const escribir = (l) => { try { localStorage.setItem(K, JSON.stringify(l)); } catch {} };
const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const PESO = { alta: 0, media: 1, baja: 2 };

export const esPrioridad = (e) => TIPOS_PRIORIDAD.includes(e.tipo) || e.importancia === 'alta';
/** Eventos de la app, de Google Calendar y del calendario del instituto */
export const eventos = () => [...leer(), ...eventosGoogle(), ...eventosInstituto()];

export function prioridades(fecha = iso()) {
  const desde = iso(sumarDias(new Date(), -7));
  const hoy = fecha === iso();
  return eventos().filter((e) => esPrioridad(e) && (e.fecha === fecha || (hoy && e.fecha < fecha && e.fecha >= desde && !e.hecha && e.tipo !== 'examen')))
    .map((e) => ({ ...e, atrasada: e.fecha < fecha }))
    .sort((a, b) => (a.hecha - b.hecha) || (b.atrasada - a.atrasada) || (PESO[a.importancia] ?? 1) - (PESO[b.importancia] ?? 1) || (a.ini || '99').localeCompare(b.ini || '99'));
}

export function marcarHecha(id, hecha) {
  if (String(id).startsWith('g:')) return marcarHechaGoogle(id.slice(2), hecha);
  if (String(id).startsWith('i:')) return marcarHechaInstituto(id.slice(2), hecha);
  escribir(leer().map((e) => (e.id === id ? { ...e, hecha } : e)));
}

/** Crea un evento (lo usa Elena). Devuelve el evento guardado. */
export function crearEvento(d) {
  const todoElDia = d.todoElDia ?? !d.ini;
  const e = {
    id: nuevoId(), creado: new Date().toISOString(),
    titulo: String(d.titulo || 'Sin título').trim(), fecha: d.fecha || iso(), todoElDia,
    ini: todoElDia ? '' : d.ini, fin: todoElDia ? '' : (d.fin && d.fin > d.ini ? d.fin : sumarHora(d.ini)),
    tipo: d.tipo || 'recordatorio', color: d.color || colorDe(d.tipo || 'recordatorio'), importancia: d.importancia || 'media',
    lugar: d.lugar || '', descripcion: d.descripcion || '', avisos: [],
  };
  escribir([...leer(), e]);
  // Si Google Calendar está conectado, también se crea allí
  subirAGoogle(e).then((googleId) => { if (googleId) escribir(leer().map((x) => (x.id === e.id ? { ...x, googleId } : x))); });
  return e;
}
const sumarHora = (h) => { const [a, b] = h.split(':').map(Number); return `${String(Math.min(23, a + 1)).padStart(2, '0')}:${String(b).padStart(2, '0')}`; };
const colorDe = (t) => ({ recordatorio: 'lavanda', tarea: 'limon', examen: 'rosa', clase: 'cielo', cita: 'lavanda', deporte: 'menta', festivo: 'rosa' }[t] || 'melocoton');
