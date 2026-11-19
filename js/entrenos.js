/* =========================================================
   ENTRENOS: rutinas, entreno de hoy, sesión en curso e historial
   Todo se guarda en el dispositivo (hub:*) y se sincroniza solo
   con la cuenta a través de nube.js.
   ========================================================= */

const K = { rutinas: 'hub:rutinas', hoy: 'hub:entreno-hoy', sesion: 'hub:sesion', historial: 'hub:sesiones' };
const leer = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch { return def; } };
const escribir = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
export const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
export const hoyISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const EJERCICIOS = [
  'Press de banca plano', 'Press de banca inclinado', 'Press con mancuernas', 'Aperturas en polea', 'Fondos',
  'Press militar', 'Elevaciones laterales', 'Pájaros', 'Face pull',
  'Dominadas', 'Jalón al pecho', 'Remo con barra', 'Remo en polea baja', 'Remo con mancuerna', 'Pullover',
  'Curl con barra', 'Curl martillo', 'Curl en banco Scott', 'Extensión de tríceps en polea', 'Press francés',
  'Sentadilla', 'Prensa', 'Peso muerto', 'Peso muerto rumano', 'Zancadas', 'Hip thrust',
  'Extensión de cuádriceps', 'Curl femoral', 'Gemelo de pie', 'Abdominales en polea', 'Plancha',
];

const s = (kg, reps, n) => Array.from({ length: n }, () => ({ kg, reps }));
const ej = (nombre, series, descanso = 90) => ({ id: nuevoId(), nombre, descanso, series });
const EJEMPLO = () => [
  { id: nuevoId(), nombre: 'Empuje', color: 'var(--rosa-f)', ejercicios: [
    ej('Press de banca plano', s(62.5, 12, 3), 120), ej('Press con mancuernas', s(24, 10, 3)), ej('Press militar', s(40, 10, 3)),
    ej('Elevaciones laterales', s(10, 15, 3), 60), ej('Extensión de tríceps en polea', s(25, 12, 3), 60)] },
  { id: nuevoId(), nombre: 'Tirón', color: 'var(--cielo-f)', ejercicios: [
    ej('Dominadas', s(0, 8, 4), 120), ej('Remo con barra', s(60, 10, 3)), ej('Jalón al pecho', s(55, 12, 3)),
    ej('Face pull', s(20, 15, 3), 60), ej('Curl con barra', s(30, 10, 3), 60)] },
  { id: nuevoId(), nombre: 'Pierna', color: 'var(--menta-f)', ejercicios: [
    ej('Sentadilla', s(90, 8, 4), 150), ej('Prensa', s(180, 12, 4)), ej('Peso muerto rumano', s(80, 10, 3)),
    ej('Extensión de cuádriceps', s(45, 15, 3), 60), ej('Gemelo de pie', s(60, 15, 4), 60)] },
];

/* ---------- Rutinas ---------- */
export function rutinas() {
  let r = leer(K.rutinas, null);
  if (!r) { r = EJEMPLO(); escribir(K.rutinas, r); }
  return r;
}
export const rutina = (id) => rutinas().find((r) => r.id === id);
export function guardarRutina(r) {
  const lista = rutinas();
  const i = lista.findIndex((x) => x.id === r.id);
  if (i >= 0) lista[i] = r; else lista.push(r);
  escribir(K.rutinas, lista);
}
export function borrarRutina(id) {
  escribir(K.rutinas, rutinas().filter((r) => r.id !== id));
  if (leer(K.hoy, {}).rutinaId === id) escribir(K.hoy, null);
}

/* ---------- Entreno de hoy ---------- */
export function rutinaDeHoy() {
  const h = leer(K.hoy, null);
  if (h?.fecha === hoyISO() && rutina(h.rutinaId)) return rutina(h.rutinaId);
  if (h?.fecha === hoyISO() && h.rutinaId === null) return null; // descanso elegido
  // Sugerencia: la rutina que toca después de la última hecha
  const lista = rutinas(); if (!lista.length) return null;
  const ult = historial()[0];
  const i = ult ? lista.findIndex((r) => r.id === ult.rutinaId) : -1;
  return lista[(i + 1) % lista.length];
}
export const elegirHoy = (rutinaId) => escribir(K.hoy, { fecha: hoyISO(), rutinaId });
export const hoyElegido = () => leer(K.hoy, null)?.fecha === hoyISO();

/* ---------- Historial ---------- */
export const historial = () => leer(K.historial, []);
/** Series de la última vez que se hizo ese ejercicio */
export function previa(nombre) {
  for (const ses of historial()) {
    const e = ses.ejercicios.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase());
    if (e?.series.length) return e.series;
  }
  return null;
}
/** Mejor peso por ejercicio (con al menos 1 repetición) */
export function marcas() {
  const m = {};
  for (const ses of historial()) for (const e of ses.ejercicios) for (const x of e.series) {
    if (x.kg > 0 && x.reps > 0 && (!m[e.nombre] || x.kg > m[e.nombre].kg)) m[e.nombre] = { kg: x.kg, reps: x.reps, fecha: ses.fecha };
  }
  return m;
}

/* ---------- Sesión en curso ---------- */
export const sesion = () => leer(K.sesion, null);
export const guardarSesion = (ses) => escribir(K.sesion, ses);
export function empezar(r) {
  const ses = {
    rutinaId: r.id, nombre: r.nombre, inicio: Date.now(), actual: 0,
    ejercicios: r.ejercicios.map((e) => {
      const p = previa(e.nombre);
      return { nombre: e.nombre, descanso: e.descanso || 90, series: e.series.map((x, i) => ({ kg: p?.[i]?.kg ?? x.kg, reps: p?.[i]?.reps ?? x.reps, hecha: false })) };
    }),
  };
  elegirHoy(r.id); guardarSesion(ses);
  return ses;
}
export function terminar() {
  const ses = sesion(); if (!ses) return null;
  const ejercicios = ses.ejercicios.map((e) => ({ nombre: e.nombre, series: e.series.filter((x) => x.hecha).map(({ kg, reps }) => ({ kg, reps })) })).filter((e) => e.series.length);
  guardarSesion(null);
  if (!ejercicios.length) return null;
  const reg = { id: nuevoId(), fecha: hoyISO(), rutinaId: ses.rutinaId, nombre: ses.nombre, minutos: Math.max(1, Math.round((Date.now() - ses.inicio) / 60000)), ejercicios };
  escribir(K.historial, [reg, ...historial()].slice(0, 500));
  return reg;
}
export const descartar = () => guardarSesion(null);
export const volumen = (ses) => ses.ejercicios.reduce((a, e) => a + e.series.reduce((b, x) => b + (x.kg || 0) * (x.reps || 0), 0), 0);
