/* =========================================================
   NOTAS
   - Moodle: el servidor (función «moodle») guarda el permiso y
     baja las notas cada 15 minutos. Aquí solo se guarda una copia
     en este dispositivo (hub:notas-moodle, no se sincroniza).
   - Lo tuyo se sincroniza en hub:notas: porcentajes, nombres,
     tipo de cada nota, colores, lo oculto y las notas a mano.
   ========================================================= */
const K = { aj: 'hub:notas', cache: 'hub:notas-moodle' };
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export const COLORES = ['cielo', 'lavanda', 'menta', 'melocoton', 'limon', 'rosa'];
export const TIPOS_NOTA = { examen: 'Exámenes', actividad: 'Actividades' };
export const CAT_PREDET = { examen: 60, actividad: 40 };

/* ---------- Ajustes (se sincronizan) ---------- */
export function ajustesNotas() {
  const a = leer(K.aj, {}) || {};
  return { asig: a.asig || {}, items: a.items || {}, manual: { asignaturas: a.manual?.asignaturas || [], notas: a.manual?.notas || [] } };
}
export function cambiarNotas(f) { const a = ajustesNotas(); f(a); escribir(K.aj, a); }
export const ajusteAsig = (id, cambios) => cambiarNotas((a) => { a.asig[id] = { ...(a.asig[id] || {}), ...cambios }; });
export const ajusteItem = (id, cambios) => cambiarNotas((a) => { a.items[id] = { ...(a.items[id] || {}), ...cambios }; });

export function crearAsignatura(nombre) {
  const id = 'a' + nuevoId();
  cambiarNotas((a) => a.manual.asignaturas.push({ id, nombre: nombre.trim().slice(0, 80) }));
  return id;
}
export function borrarAsignatura(id) {
  cambiarNotas((a) => {
    a.manual.asignaturas = a.manual.asignaturas.filter((x) => x.id !== id);
    a.manual.notas = a.manual.notas.filter((x) => x.asig !== id);
    delete a.asig[id];
  });
}
export function guardarNotaManual(n) {
  cambiarNotas((a) => {
    const i = a.manual.notas.findIndex((x) => x.id === n.id);
    const fila = { id: n.id || 'n' + nuevoId(), asig: n.asig, tipo: n.tipo, nombre: n.nombre.trim().slice(0, 80), nota: n.nota, fecha: n.fecha || new Date().toISOString() };
    if (i >= 0) a.manual.notas[i] = { ...a.manual.notas[i], ...fila }; else a.manual.notas.push(fila);
  });
}
export const borrarNotaManual = (id) => cambiarNotas((a) => { a.manual.notas = a.manual.notas.filter((x) => x.id !== id); delete a.items[id]; });

/* ---------- Moodle (servidor) ---------- */
export const moodle = () => leer(K.cache, null);
async function invocar(cuerpo) {
  const { obtenerCliente, usuarioActual } = await import('./nube.js');
  if (!usuarioActual()) throw new Error('Inicia sesión en Perfil primero.');
  const { data, error } = await (await obtenerCliente()).functions.invoke('moodle', { body: cuerpo });
  if (error) { const d = await error.context?.json?.().catch(() => null); throw new Error(d?.detalle || 'No se ha podido hablar con el campus.'); }
  escribir(K.cache, data);
  return data;
}
export const conectarMoodle = (usuario, contrasena, sitio) => invocar({ accion: 'conectar', usuario, contrasena, sitio });
export const desconectarMoodle = () => invocar({ accion: 'desconectar' });
let enCurso = null;
/** Trae lo último del servidor. Devuelve true si ha cambiado algo. */
export function sincronizarMoodle(forzar = false) {
  if (enCurso) return enCurso;
  const antes = localStorage.getItem(K.cache);
  enCurso = invocar({ accion: 'sincronizar', forzar }).then(() => localStorage.getItem(K.cache) !== antes).finally(() => { enCurso = null; });
  return enCurso;
}

/* ---------- Modelo unido: asignaturas con sus notas ---------- */
/** «2DAM - Acceso a Datos (25/26)» → «Acceso a Datos» */
const limpiarCurso = (t) => t.replace(/^\s*[^\s-–]{1,10}\s*[-–:]\s+/, '').replace(/\s*[([]?\s*(20)?\d{2}\s*[/-]\s*(20)?\d{2}\s*[)\]]?\s*$/, '').trim() || t;
export function asignaturas({ ocultas = false } = {}) {
  const aj = ajustesNotas(), m = moodle();
  const lista = [], porId = new Map();
  const asig = (id, nombre, origen) => {
    if (porId.has(id)) return porId.get(id);
    const c = aj.asig[id] || {};
    const a = { id, original: nombre, nombre: c.nombre || nombre, origen, color: c.color || COLORES[lista.length % COLORES.length], cat: { ...CAT_PREDET, ...(c.cat || {}) }, oculta: !!c.oculta, items: [] };
    porId.set(id, a); lista.push(a); return a;
  };
  const item = (id, base) => {
    const c = aj.items[id] || {};
    return { ...base, id, original: base.nombre, nombre: c.nombre || base.nombre, tipo: c.tipo || base.tipo || 'actividad', peso: c.peso, oculto: !!c.oculto };
  };
  if (m?.conectado) for (const n of m.notas || []) {
    const a = asig('m' + n.curso_id, limpiarCurso(n.curso), 'moodle');
    a.items.push(item('m' + n.item_id, { nombre: n.nombre, tipo: n.tipo, nota: n.nota == null ? null : Number(n.nota), texto: n.texto, publicada: n.publicada, origen: 'moodle' }));
  }
  for (const x of aj.manual.asignaturas) asig(x.id, x.nombre, 'manual');
  for (const n of aj.manual.notas) {
    const a = porId.get(n.asig); if (!a) continue;
    a.items.push(item(n.id, { nombre: n.nombre, tipo: n.tipo, nota: n.nota == null ? null : Number(n.nota), publicada: n.fecha, origen: 'manual' }));
  }
  return lista.filter((a) => ocultas || !a.oculta);
}

/* ---------- Cálculo con ponderaciones ---------- */
const visibles = (a) => a.items.filter((i) => !i.oculto);
/** Peso guardado de cada nota dentro de su bloque (si no hay, todas igual) */
export function pesoEnBloque(a, i) {
  const del = visibles(a).filter((x) => x.tipo === i.tipo);
  return i.peso ?? 100 / (del.length || 1);
}
/** Porcentaje real (sobre 100) que vale cada nota en la nota final */
export function pesos(a) {
  const out = new Map(), items = visibles(a);
  const bloques = Object.keys(TIPOS_NOTA).filter((t) => items.some((i) => i.tipo === t));
  const totalCat = bloques.reduce((s, t) => s + (a.cat[t] || 0), 0) || 1;
  for (const t of bloques) {
    const del = items.filter((i) => i.tipo === t);
    const suma = del.reduce((s, i) => s + pesoEnBloque(a, i), 0) || 1;
    del.forEach((i) => out.set(i, ((a.cat[t] || 0) / totalCat) * 100 * pesoEnBloque(a, i) / suma));
  }
  return out;
}
export function calcular(a) {
  const p = pesos(a); let evaluado = 0, puntos = 0;
  visibles(a).forEach((i) => { if (i.nota != null) { evaluado += p.get(i); puntos += p.get(i) * i.nota; } });
  return { media: evaluado ? puntos / evaluado : null, evaluado, puntos, p };
}
/** Nota media que hace falta en lo que queda para llegar al objetivo (null si ya está todo) */
export function necesito(a, objetivo) {
  const c = calcular(a), resta = 100 - c.evaluado;
  return resta > 0.5 ? (objetivo * 100 - c.puntos) / resta : null;
}
export const esNueva = (i) => i.publicada && Date.now() - new Date(i.publicada).getTime() < 3 * 86400000;
