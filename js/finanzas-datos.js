/* =========================================================
   FINANZAS: clasificación automática y resumen por meses
   Cada movimiento se clasifica solo por su concepto. Cuando
   importemos extractos de Revolut y BBVA se usarán las mismas
   reglas, y las correcciones del usuario tendrán prioridad.
   ========================================================= */

import { objetivos } from './registro.js';

export const CATEGORIAS = {
  supermercado:  { nombre: 'Supermercado',  color: 'var(--menta-f)' },
  restaurantes:  { nombre: 'Restaurantes y comida a domicilio', color: 'var(--melocoton-f)' },
  transporte:    { nombre: 'Transporte',    color: 'var(--cielo-f)' },
  suscripciones: { nombre: 'Suscripciones', color: 'var(--lavanda-f)' },
  deporte:       { nombre: 'Gimnasio y deporte', color: 'var(--limon-f)' },
  ropa:          { nombre: 'Ropa',          color: 'var(--rosa-f)' },
  ocio:          { nombre: 'Ocio',          color: '#c08bb8' },
  salud:         { nombre: 'Salud',         color: '#7fa8a0' },
  otros:         { nombre: 'Otros',         color: 'var(--tenue)' },
  nomina:        { nombre: 'Nómina',        color: 'var(--menta-f)', ingreso: true },
  bizum:         { nombre: 'Bizum y transferencias', color: 'var(--lavanda-f)', ingreso: true },
};

const REGLAS = [
  [/n[oó]mina|salario/i, 'nomina'],
  [/bizum|transferencia recibida/i, 'bizum'],
  [/mercadona|lidl|carrefour|aldi|alcampo|\bdia\b|supermercado/i, 'supermercado'],
  [/glovo|just eat|uber eats|restaurante|burger|mcdonald|telepizza|kebab|\bbar\b|cafeter/i, 'restaurantes'],
  [/renfe|metro|\bemt\b|cabify|bolt|uber|gasolin|repsol|abono/i, 'transporte'],
  [/spotify|netflix|icloud|hbo|disney|prime video|youtube/i, 'suscripciones'],
  [/gimnasio|basic.?fit|myprotein|decathlon|\bhsn\b|p[aá]del/i, 'deporte'],
  [/zara|pull|bershka|h&m|primark|nike|adidas/i, 'ropa'],
  [/cine|steam|concierto|entradas|playstation|museo|bolera/i, 'ocio'],
  [/farmacia|dentista|cl[ií]nica|[oó]ptica/i, 'salud'],
];

export function clasificar(concepto, importe) {
  for (const [re, cat] of REGLAS) if (re.test(concepto)) return cat;
  return importe > 0 ? 'bizum' : 'otros';
}

/* ---------- Meses visibles (los 6 últimos con datos) ---------- */
const CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export let MESES = [], MESES_LARGOS = [], movimientosPorMes = [], CLAVES_MES = [];

/** Reparte una lista de movimientos {fecha, concepto, importe, cat} en los 6 últimos meses */
export function usarMovimientos(lista) {
  const hoy = new Date();
  const fin = lista.length ? new Date(Math.max(hoy, ...lista.map((x) => +x.fecha))) : hoy;
  const meses = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(fin.getFullYear(), fin.getMonth() - i, 1); meses.push([d.getFullYear(), d.getMonth()]); }
  MESES = meses.map(([, m]) => CORTOS[m]);
  MESES_LARGOS = meses.map(([, m]) => LARGOS[m]);
  CLAVES_MES = meses.map(([a, m]) => `${a}-${m}`);
  movimientosPorMes = meses.map(([a, m]) => lista
    .filter((x) => x.fecha.getFullYear() === a && x.fecha.getMonth() === m)
    .map((x) => ({ ...x, cat: x.cat || clasificar(x.concepto, x.importe) }))
    .sort((p, q) => q.fecha - p.fecha));
}
usarMovimientos([]);

export function resumenMes(m) {
  const L = movimientosPorMes[m];
  const ingresos = L.filter((x) => x.importe > 0).reduce((a, x) => a + x.importe, 0);
  const gastos = -L.filter((x) => x.importe < 0).reduce((a, x) => a + x.importe, 0);
  const porCat = {};
  L.filter((x) => x.importe < 0).forEach((x) => { porCat[x.cat] = (porCat[x.cat] || 0) - x.importe; });
  const categorias = Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ id: k, nombre: CATEGORIAS[k].nombre, valor: Math.round(v * 100) / 100, color: CATEGORIAS[k].color }));
  return { ingresos, gastos, ahorro: ingresos - gastos, categorias, movimientos: L };
}

/** Recomendaciones calculadas con los datos del mes en curso */
export function recomendaciones() {
  const ult = MESES.length - 1, actual = resumenMes(ult);
  const prev = [ult - 1, ult - 2, ult - 3].map(resumenMes).filter((r) => r.gastos > 0);
  const media = (id) => prev.length < 2 ? 0 : prev.reduce((a, r) => a + (r.categorias.find((c) => c.id === id)?.valor || 0), 0) / prev.length;
  const out = [];
  const mayor = actual.categorias.map((c) => ({ ...c, dif: media(c.id) ? (c.valor - media(c.id)) / media(c.id) : 0 })).sort((a, b) => b.dif - a.dif)[0];
  if (mayor && mayor.dif > 0.1) out.push(`En ${mayor.nombre.toLowerCase()} llevas un ${Math.round(mayor.dif * 100)} % más que la media de tus últimos tres meses.`);
  const hoy = new Date(), dias = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const esMesActual = CLAVES_MES[ult] === `${hoy.getFullYear()}-${hoy.getMonth()}`;
  const proyGasto = esMesActual ? (actual.gastos / hoy.getDate()) * dias : actual.gastos;
  const proyAhorro = actual.ingresos - proyGasto;
  if (actual.movimientos.length) out.push(`A este ritmo cerrarás el mes con unos ${Math.round(proyGasto)} € de gasto y ${Math.round(proyAhorro)} € ahorrados (${proyAhorro >= objetivos().ahorroMes ? 'por encima' : 'por debajo'} de tu objetivo de ${objetivos().ahorroMes} €).`);
  const subs = actual.categorias.find((c) => c.id === 'suscripciones');
  if (subs) out.push(`Pagas ${subs.valor.toFixed(2).replace('.', ',')} € al mes en suscripciones (${actual.movimientos.filter((x) => x.cat === 'suscripciones').length}). Revisa si usas todas.`);
  if (!out.length) out.push('Cuando haya más meses importados te diré en qué estás gastando más de lo normal.');
  return out;
}
