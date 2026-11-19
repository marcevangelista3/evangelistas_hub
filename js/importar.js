/* =========================================================
   IMPORTAR EXTRACTOS (Revolut y BBVA)
   - Revolut: CSV desde la app (Cuenta > Extracto > Excel/CSV).
   - BBVA: Excel (.xlsx) o CSV desde la web (Posición > Cuenta >
     Movimientos > Descargar).
   Se detectan solas las columnas de fecha, concepto e importe,
   se clasifican con las reglas de finanzas-datos.js y no se
   duplican si importas dos veces el mismo periodo.
   ========================================================= */
import { clasificar } from './finanzas-datos.js';
import { obtenerCliente, usuarioActual } from './nube.js';

const CACHE = 'hub:movimientos';
const XLSX_CDN = 'js/vendor/xlsx.full.min.js'; // SheetJS 0.18.5

/* ---------- Lectura de archivo a filas ---------- */
function leerCSV(texto) {
  texto = texto.replace(/^﻿/, '');
  const primera = texto.split(/\r?\n/)[0];
  const sep = [';', '\t', ','].sort((a, b) => primera.split(b).length - primera.split(a).length)[0];
  const filas = []; let fila = [], campo = '', comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((x) => String(x).trim()));
}

function cargarXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = XLSX_CDN; s.onload = () => ok(window.XLSX); s.onerror = () => mal(new Error('No se ha podido cargar el lector de Excel'));
    document.head.appendChild(s);
  });
}

export async function leerArchivo(archivo) {
  if (/\.xlsx?$/i.test(archivo.name)) {
    const XLSX = await cargarXLSX();
    const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array', cellDates: true });
    return XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { header: 1, raw: true, defval: '' });
  }
  return leerCSV(await archivo.text());
}

/* ---------- Detección de columnas ---------- */
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const ALIAS = {
  fecha: ['completed date', 'fecha de finalizacion', 'fecha de realizacion', 'fecha completada', 'fecha', 'f.valor', 'fecha valor', 'started date', 'fecha de inicio', 'date'],
  concepto: ['description', 'descripcion', 'concepto', 'movimiento'],
  extra: ['movimiento', 'observaciones'],
  importe: ['amount', 'importe', 'cantidad'],
  comision: ['fee', 'comision'],
  moneda: ['currency', 'divisa', 'moneda'],
  estado: ['state', 'estado'],
};
const buscar = (cab, nombres, evitar = -1) => {
  for (const n of nombres) { const i = cab.findIndex((c, j) => j !== evitar && c === n); if (i >= 0) return i; }
  return -1;
};

export function detectar(filas) {
  for (let r = 0; r < Math.min(filas.length, 30); r++) {
    const cab = filas[r].map(norm);
    const col = { fecha: buscar(cab, ALIAS.fecha), concepto: buscar(cab, ALIAS.concepto), importe: buscar(cab, ALIAS.importe) };
    if (col.fecha < 0 || col.concepto < 0 || col.importe < 0) continue;
    col.extra = buscar(cab, ALIAS.extra, col.concepto);
    col.comision = buscar(cab, ALIAS.comision);
    col.moneda = buscar(cab, ALIAS.moneda);
    col.estado = buscar(cab, ALIAS.estado);
    const banco = cab.includes('product') || cab.includes('producto') || col.estado >= 0 ? 'Revolut'
      : cab.some((c) => c === 'f.valor' || c === 'disponible') ? 'BBVA' : 'Otro';
    return { fila: r, col, banco };
  }
  return null;
}

/* ---------- Conversión ---------- */
function numero(v) {
  if (typeof v === 'number') return v;
  let s = String(v).replace(/[€\s]/g, '').replace(/[^\d,.\-+]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  return parseFloat(s);
}
function fecha(v) {
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400000)); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return new Date(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
  return null;
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function convertir(filas, deteccion) {
  const { fila, col, banco } = deteccion;
  const vistos = {};
  const out = [];
  for (const f of filas.slice(fila + 1)) {
    if (col.estado >= 0) { const e = norm(f[col.estado]); if (e && !['completed', 'completado', 'completada'].includes(e)) continue; }
    const d = fecha(f[col.fecha]);
    let importe = numero(f[col.importe]);
    if (!d || !isFinite(importe)) continue;
    if (col.comision >= 0) { const c = numero(f[col.comision]); if (isFinite(c)) importe -= Math.abs(c); }
    importe = Math.round(importe * 100) / 100;
    if (!importe) continue;
    let concepto = String(f[col.concepto] ?? '').trim();
    const extra = col.extra >= 0 ? String(f[col.extra] ?? '').trim() : '';
    if (!concepto) concepto = extra || 'Sin concepto';
    const moneda = col.moneda >= 0 ? String(f[col.moneda] || 'EUR').trim().toUpperCase() : 'EUR';
    const base = `${banco}|${iso(d)}|${importe.toFixed(2)}|${norm(concepto)}`;
    vistos[base] = (vistos[base] || 0) + 1;
    out.push({ banco, fecha: d, concepto, importe, moneda, cat: clasificar(`${concepto} ${extra}`, importe), huella: `${base}|${vistos[base]}` });
  }
  return out;
}

/* ---------- Guardado (dispositivo + nube) ---------- */
const aFila = (m) => ({ banco: m.banco, fecha: iso(m.fecha), concepto: m.concepto, importe: m.importe, moneda: m.moneda, categoria: m.cat, huella: m.huella });
const deFila = (r) => ({ banco: r.banco, fecha: fecha(r.fecha), concepto: r.concepto, importe: +r.importe, moneda: r.moneda, cat: r.categoria, huella: r.huella });

function leerCache() { try { return (JSON.parse(localStorage.getItem(CACHE)) || []).map(deFila); } catch { return []; } }
function guardarCache(lista) { try { localStorage.setItem(CACHE, JSON.stringify(lista.map(aFila))); } catch {} }

export function movimientosGuardados() { return leerCache(); }

/** Añade los movimientos nuevos. Devuelve cuántos eran nuevos. */
export async function guardarMovimientos(nuevos) {
  const actuales = leerCache();
  const huellas = new Set(actuales.map((m) => m.huella));
  const aniadir = nuevos.filter((m) => !huellas.has(m.huella));
  guardarCache([...actuales, ...aniadir]);
  if (usuarioActual()) {
    const sb = await obtenerCliente();
    for (let i = 0; i < nuevos.length; i += 500) {
      const { error } = await sb.from('movimientos').upsert(nuevos.slice(i, i + 500).map(aFila), { onConflict: 'user_id,huella', ignoreDuplicates: true });
      if (error) throw error;
    }
  }
  return aniadir.length;
}

/** Baja de la nube los movimientos (para el otro dispositivo) */
export async function bajarMovimientos() {
  if (!usuarioActual()) return leerCache();
  const sb = await obtenerCliente();
  const todos = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.from('movimientos').select('banco, fecha, concepto, importe, moneda, categoria, huella').order('fecha', { ascending: false }).range(desde, desde + 999);
    if (error) throw error;
    todos.push(...data);
    if (data.length < 1000) break;
  }
  const locales = leerCache();
  const enNube = new Set(todos.map((r) => r.huella));
  const soloLocales = locales.filter((m) => !enNube.has(m.huella));
  if (soloLocales.length) await sb.from('movimientos').upsert(soloLocales.map(aFila), { onConflict: 'user_id,huella', ignoreDuplicates: true });
  const lista = [...todos.map(deFila), ...soloLocales];
  guardarCache(lista);
  return lista;
}
