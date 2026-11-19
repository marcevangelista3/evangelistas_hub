/* =========================================================
   NUTRICIÓN
   Base de alimentos (valores medios aproximados por 100 g),
   alimentos propios y comidas guardadas por día.
   ========================================================= */
import { iso } from './registro.js';

// kcal, proteína, carbohidratos, grasas por 100 g
export const ALIMENTOS = {
  'Avena': [389, 16.9, 66.3, 6.9],
  'Plátano': [89, 1.1, 22.8, 0.3],
  'Manzana': [52, 0.3, 13.8, 0.2],
  'Proteína whey': [400, 80, 8, 6],
  'Leche semidesnatada': [46, 3.3, 4.8, 1.6],
  'Yogur griego natural': [130, 5.5, 4.5, 10],
  'Yogur proteico natural': [62, 10, 4, 0.2],
  'Queso fresco batido 0 %': [46, 8, 3.5, 0.2],
  'Huevo': [155, 13, 1.1, 11],
  'Claras de huevo': [52, 10.9, 0.7, 0.2],
  'Pan integral': [247, 13, 41, 3.4],
  'Pan blanco': [265, 9, 49, 3.2],
  'Arroz blanco cocido': [130, 2.7, 28, 0.3],
  'Pasta cocida': [158, 5.8, 31, 0.9],
  'Patata cocida': [87, 1.9, 20, 0.1],
  'Lentejas cocidas': [116, 9, 20, 0.4],
  'Garbanzos cocidos': [164, 8.9, 27.4, 2.6],
  'Pechuga de pollo a la plancha': [165, 31, 0, 3.6],
  'Pavo en lonchas': [104, 21, 1.5, 1.5],
  'Jamón serrano': [241, 31, 0, 13],
  'Ternera magra': [217, 26, 0, 12],
  'Salmón': [208, 20, 0, 13],
  'Atún al natural': [116, 26, 0, 1],
  'Merluza': [90, 18, 0, 1.3],
  'Brócoli': [34, 2.8, 7, 0.4],
  'Tomate': [18, 0.9, 3.9, 0.2],
  'Ensalada mixta': [20, 1.2, 3.5, 0.2],
  'Aguacate': [160, 2, 8.5, 14.7],
  'Aceite de oliva': [884, 0, 0, 100],
  'Nueces': [654, 15.2, 13.7, 65.2],
  'Almendras': [579, 21, 22, 50],
  'Crema de cacahuete': [588, 25, 20, 50],
  'Miel': [304, 0.3, 82, 0],
  'Chocolate negro 85 %': [600, 10, 20, 50],
};

/* ---------- Alimentos propios (los que añades tú o Elena) ---------- */
const K_PROPIOS = 'hub:alimentos';
let crudo = null, propiosCache = {};
function propios() {
  let raw = null; try { raw = localStorage.getItem(K_PROPIOS); } catch {}
  if (raw !== crudo) { crudo = raw; try { propiosCache = JSON.parse(raw) || {}; } catch { propiosCache = {}; } }
  return propiosCache;
}
export const alimentos = () => ({ ...ALIMENTOS, ...propios() });
export function buscarAlimento(nombre) {
  const n = nombre.trim().toLowerCase();
  return Object.keys(alimentos()).find((a) => a.toLowerCase() === n) || null;
}
export function anadirAlimento(nombre, porCien) {
  const l = { ...propios(), [nombre.trim()]: porCien.map((v) => Math.round((+v || 0) * 10) / 10) };
  try { localStorage.setItem(K_PROPIOS, JSON.stringify(l)); } catch {}
  return nombre.trim();
}

/* ---------- Comidas por día: { 'AAAA-MM-DD': [comidas] } ---------- */
const CLAVE = 'hub:dieta';
const vacio = () => ['Desayuno', 'Comida', 'Merienda', 'Cena'].map((nombre) => ({ nombre, hora: '', items: [] }));
function todo() {
  try { const d = JSON.parse(localStorage.getItem(CLAVE)); if (d) return d; } catch {}
  // Formato antiguo (un solo día sin fecha): se pasa a hoy
  const d = {};
  try { const v = JSON.parse(localStorage.getItem('hub:comidas')); if (v?.some((c) => c.items?.length)) d[iso()] = v; } catch {}
  return d;
}
export const cargarComidas = (fecha = iso()) => structuredClone(todo()[fecha] || vacio());
export function guardarComidas(c, fecha = iso()) {
  const d = todo();
  if (c.some((x) => x.items.length)) d[fecha] = c; else delete d[fecha];
  try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch {}
}
/** Añade un alimento a una comida (por nombre: Desayuno, Comida, Merienda, Cena) */
export function anadirAComida(comida, nombre, gramos, fecha = iso()) {
  const c = cargarComidas(fecha);
  const i = Math.max(0, c.findIndex((x) => x.nombre.toLowerCase() === String(comida).toLowerCase()));
  c[i].items.push([nombre, Math.round(gramos)]);
  if (!c[i].hora && fecha === iso()) c[i].hora = new Date().toTimeString().slice(0, 5);
  guardarComidas(c, fecha);
}

/** Macros de un alimento según sus gramos */
export function macrosItem([nombre, g]) {
  const v = alimentos()[nombre] || [0, 0, 0, 0];
  const k = g / 100;
  return { kcal: v[0] * k, p: v[1] * k, c: v[2] * k, g: v[3] * k };
}
const sumar = (lista) => lista.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, g: a.g + m.g }), { kcal: 0, p: 0, c: 0, g: 0 });
export const macrosComida = (comida) => sumar(comida.items.map(macrosItem));
export const totalesDia = (comidas = cargarComidas()) => sumar(comidas.map(macrosComida));
/** Totales de cada día con algo apuntado */
export const totalesPorDia = () => Object.fromEntries(Object.entries(todo()).map(([f, c]) => [f, totalesDia(c)]));
