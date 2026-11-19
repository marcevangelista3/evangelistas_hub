/* =========================================================
   NUTRICIÓN
   Base de alimentos (valores medios aproximados por 100 g) y
   cálculo de macros de cada comida a partir de los gramos.
   ========================================================= */
import { modoDemo } from './ajustes.js';

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
  'Arroz blanco cocido': [130, 2.7, 28, 0.3],
  'Pasta cocida': [158, 5.8, 31, 0.9],
  'Patata cocida': [87, 1.9, 20, 0.1],
  'Lentejas cocidas': [116, 9, 20, 0.4],
  'Garbanzos cocidos': [164, 8.9, 27.4, 2.6],
  'Pechuga de pollo a la plancha': [165, 31, 0, 3.6],
  'Pavo en lonchas': [104, 21, 1.5, 1.5],
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

const DEMO = [
  { nombre: 'Desayuno', hora: '08:10', items: [['Avena', 80], ['Plátano', 120], ['Proteína whey', 30]] },
  { nombre: 'Comida', hora: '14:45', items: [['Arroz blanco cocido', 250], ['Pechuga de pollo a la plancha', 180], ['Brócoli', 150], ['Aceite de oliva', 10]] },
  { nombre: 'Merienda', hora: '17:30', items: [['Yogur griego natural', 125], ['Nueces', 20]] },
  { nombre: 'Cena', hora: '', items: [] },
];
const VACIO = DEMO.map((c) => ({ ...c, hora: '', items: [] }));

const CLAVE = () => (modoDemo() ? 'hub:comidas-demo' : 'hub:comidas');
export function cargarComidas() {
  try { const c = JSON.parse(localStorage.getItem(CLAVE())); if (c) return c; } catch {}
  return structuredClone(modoDemo() ? DEMO : VACIO);
}
export function guardarComidas(c) { try { localStorage.setItem(CLAVE(), JSON.stringify(c)); } catch {} }

/** Macros de un alimento según sus gramos */
export function macrosItem([nombre, g]) {
  const v = ALIMENTOS[nombre] || [0, 0, 0, 0];
  const k = g / 100;
  return { kcal: v[0] * k, p: v[1] * k, c: v[2] * k, g: v[3] * k };
}
const sumar = (lista) => lista.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, g: a.g + m.g }), { kcal: 0, p: 0, c: 0, g: 0 });
export const macrosComida = (comida) => sumar(comida.items.map(macrosItem));
export const totalesDia = (comidas = cargarComidas()) => sumar(comidas.map(macrosComida));
