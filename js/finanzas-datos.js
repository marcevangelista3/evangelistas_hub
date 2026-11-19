/* =========================================================
   FINANZAS: clasificación automática y datos de ejemplo
   Cada movimiento se clasifica solo por su concepto. Cuando
   importemos extractos de Revolut y BBVA se usarán las mismas
   reglas, y las correcciones del usuario tendrán prioridad.
   ========================================================= */

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
export let esDemo = true;

function azar(semilla) { let s = semilla; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

function generarMes(m) {
  const r = azar(1000 + m * 77);
  const año = new Date().getFullYear(), mes = new Date().getMonth() - 5 + m; // los 6 últimos meses
  const hoy = new Date();
  const ultimoDia = mes === hoy.getMonth() ? hoy.getDate() : new Date(año, mes + 1, 0).getDate();
  const L = [];
  const add = (dia, concepto, importe) => { if (dia <= ultimoDia) L.push({ fecha: new Date(año, mes, dia), concepto, importe: Math.round(importe * 100) / 100 }); };
  add(1, 'Nómina · media jornada', 950);
  add(5, 'Clases particulares (Bizum)', 120 + Math.round(r() * 4) * 20);
  if (r() > 0.4) add(18, 'Bizum de Pablo', 15);
  ['Mercadona', 'Lidl', 'Mercadona', 'Carrefour', 'Mercadona'].forEach((s, i) => add(3 + i * 6, s, -(28 + r() * 22)));
  const comidas = ['Glovo', 'Burger King', 'Restaurante Casa Pepe', 'Telepizza', 'Cafetería del instituto'];
  for (let i = 0; i < 3 + Math.floor(r() * 3); i++) add(2 + Math.floor(r() * 27), comidas[Math.floor(r() * comidas.length)], -(9 + r() * 18));
  add(2, 'Abono transporte Renfe', -20);
  if (r() > 0.5) add(14 + Math.floor(r() * 10), 'Cabify', -(8 + r() * 9));
  add(4, 'Spotify', -10.99); add(9, 'Netflix', -13.99); add(12, 'iCloud', -2.99);
  add(1, 'Cuota gimnasio', -34.9);
  if (r() > 0.45) add(20, 'MyProtein', -(35 + r() * 15));
  if (m === 2 || m === 5 || r() > 0.6) add(11 + Math.floor(r() * 12), r() > 0.5 ? 'Zara' : 'Pull&Bear', -(25 + r() * 45));
  const ocio = ['Cine Yelmo', 'Steam', 'Entradas concierto', 'Bolera'];
  for (let i = 0; i < (m === 2 ? 5 : 2 + Math.floor(r() * 2)); i++) add(6 + Math.floor(r() * 22), ocio[Math.floor(r() * ocio.length)], -(8 + r() * (m === 5 ? 40 : 22)));
  if (r() > 0.6) add(16, 'Farmacia', -(6 + r() * 12));
  if (m === 2) add(8, 'Viaje a Valencia (otros)', -160);
  add(22, 'Regalo cumpleaños', -(15 + r() * 15));
  return L.map((x) => ({ ...x, cat: clasificar(x.concepto, x.importe) })).sort((a, b) => b.fecha - a.fecha);
}

/** Reparte una lista de movimientos {fecha, concepto, importe, cat} en los 6 últimos meses */
export function usarMovimientos(lista, demo = false) {
  esDemo = demo;
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
export function usarDemo() { usarMovimientos([0, 1, 2, 3, 4, 5].flatMap(generarMes), true); }
usarDemo();

export function resumenMes(m) {
  const L = movimientosPorMes[m];
  const ingresos = L.filter((x) => x.importe > 0).reduce((a, x) => a + x.importe, 0);
  const gastos = -L.filter((x) => x.importe < 0).reduce((a, x) => a + x.importe, 0);
  const porCat = {};
  L.filter((x) => x.importe < 0).forEach((x) => { porCat[x.cat] = (porCat[x.cat] || 0) - x.importe; });
  const categorias = Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ id: k, nombre: CATEGORIAS[k].nombre, valor: Math.round(v * 100) / 100, color: CATEGORIAS[k].color }));
  return { ingresos, gastos, ahorro: ingresos - gastos, categorias, movimientos: L };
}

export const OBJETIVOS = [
  { nombre: 'Fondo de emergencia', meta: 3000, reparto: 0.5, base: 600, color: 'var(--menta-f)' },
  { nombre: 'MacBook nuevo', meta: 1600, reparto: 0.3, base: 150, color: 'var(--cielo-f)' },
  { nombre: 'Viaje de verano', meta: 900, reparto: 0.2, base: 40, color: 'var(--melocoton-f)' },
];
/** Ahorro acumulado en cada objetivo hasta el mes m */
export function objetivosHasta(m) {
  let acumulado = 0;
  for (let i = 0; i <= m; i++) acumulado += Math.max(0, resumenMes(i).ahorro);
  return OBJETIVOS.map((o) => ({ ...o, actual: Math.min(o.meta, Math.round((esDemo ? o.base : 0) + acumulado * o.reparto)) }));
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
  if (actual.movimientos.length) out.push(`A este ritmo cerrarás el mes con unos ${Math.round(proyGasto)} € de gasto y ${Math.round(proyAhorro)} € ahorrados (${proyAhorro >= 400 ? 'por encima' : 'por debajo'} de tu objetivo de 400 €).`);
  const subs = actual.categorias.find((c) => c.id === 'suscripciones');
  if (subs) out.push(`Pagas ${subs.valor.toFixed(2).replace('.', ',')} € al mes en suscripciones (${actual.movimientos.filter((x) => x.cat === 'suscripciones').length}). Revisa si usas todas.`);
  if (!out.length) out.push('Cuando haya más meses importados te diré en qué estás gastando más de lo normal.');
  return out;
}
