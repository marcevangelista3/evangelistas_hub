/* =========================================================
   DATOS DE EJEMPLO (inventados)
   Solo sirven para ver cómo quedará cada sección. Se desactivan
   en Personalizar → Datos de ejemplo.
   ========================================================= */

export const COLORES = {
  alta: 'var(--rosa-f)', media: 'var(--melocoton-f)', baja: 'var(--menta-f)',
};

export const prioridades = [
  { texto: 'Entregar la práctica 4 de Acceso a Datos', etiqueta: 'Clase', color: 'cielo', prioridad: 'alta', hora: 'Hoy, 23:59' },
  { texto: 'Repasar hilos para el examen de Servicios y Procesos', etiqueta: 'Clase', color: 'cielo', prioridad: 'alta', hora: 'Mañana' },
  { texto: 'Pagar la cuota del gimnasio', etiqueta: 'Finanzas', color: 'melocoton', prioridad: 'media', hora: 'Hoy' },
  { texto: 'Comprar avena, pollo y yogur griego', etiqueta: 'Dieta', color: 'menta', prioridad: 'baja', hora: 'Hoy' },
  { texto: 'Pedir cita en el dentista', etiqueta: 'Personal', color: 'lavanda', prioridad: 'media', hora: 'Hecho', hecha: true },
];

// dia: 0 = lunes ... 6 = domingo
export const eventos = [
  ...[0, 1, 2, 3, 4].map((d) => ({ dia: d, ini: '09:00', fin: '11:00', titulo: 'Acceso a Datos', lugar: 'Aula 2.3', color: 'cielo' })),
  ...[0, 1, 2, 3, 4].map((d) => ({ dia: d, ini: '11:30', fin: '14:30', titulo: 'Desarrollo de Interfaces', lugar: 'Aula 2.3', color: 'lavanda' })),
  ...[0, 2, 4].map((d) => ({ dia: d, ini: '18:00', fin: '19:30', titulo: 'Gimnasio', lugar: d === 0 ? 'Empuje' : d === 2 ? 'Tirón' : 'Pierna', color: 'menta' })),
  { dia: 3, ini: '18:00', fin: '19:30', titulo: 'Gimnasio', lugar: 'Pierna', color: 'menta' },
  { dia: 1, ini: '17:00', fin: '17:45', titulo: 'Dentista', lugar: 'Clínica', color: 'rosa', importante: true },
  { dia: 3, ini: '21:00', fin: '23:00', titulo: 'Terminar práctica 4', lugar: 'Entrega 23:59', color: 'rosa', importante: true },
  { dia: 5, ini: '11:00', fin: '13:00', titulo: 'Compra semanal', lugar: 'Supermercado', color: 'limon' },
  { dia: 5, ini: '21:00', fin: '23:00', titulo: 'Cena con amigos', lugar: 'Centro', color: 'melocoton' },
  { dia: 6, ini: '12:00', fin: '14:00', titulo: 'Partido de pádel', lugar: 'Polideportivo', color: 'menta' },
  { dia: 6, ini: '19:00', fin: '20:00', titulo: 'Planificar la semana', lugar: 'Casa', color: 'lavanda' },
];

export const emails = [
  { de: 'Secretaría del instituto', asunto: 'Último día para entregar los papeles de la FCT', cat: 'Urgente', color: 'rosa', hora: '10:24' },
  { de: 'Aula virtual · Acceso a Datos', asunto: 'Nueva tarea: Práctica 4 · Hibernate', cat: 'Clase', color: 'cielo', hora: '09:02' },
  { de: 'Compañía eléctrica', asunto: 'Tu factura de noviembre: 48,20 €', cat: 'Facturas', color: 'melocoton', hora: 'Ayer' },
  { de: 'Tu banco', asunto: 'Has recibido un Bizum de 15,00 €', cat: 'Banco', color: 'lavanda', hora: 'Ayer' },
];

export const finanzas = {
  ingresos: 1180, gastos: 742.35, objetivoAhorro: 400,
  categorias: [
    { nombre: 'Comida', valor: 214.6, color: 'var(--menta-f)' },
    { nombre: 'Otros', valor: 127.4, color: 'var(--tenue)' },
    { nombre: 'Ocio', valor: 126.0, color: 'var(--rosa-f)' },
    { nombre: 'Ropa', valor: 95.0, color: 'var(--lavanda-f)' },
    { nombre: 'Gimnasio y suplementos', valor: 79.4, color: 'var(--limon-f)' },
    { nombre: 'Transporte', valor: 68.0, color: 'var(--cielo-f)' },
    { nombre: 'Suscripciones', valor: 31.95, color: 'var(--melocoton-f)' },
  ],
  meses: ['Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov'],
  gastosMes: [690, 812, 905, 701, 766, 742],
  objetivos: [
    { nombre: 'Fondo de emergencia', actual: 1450, meta: 3000, color: 'var(--menta-f)' },
    { nombre: 'MacBook nuevo', actual: 620, meta: 1600, color: 'var(--cielo-f)' },
    { nombre: 'Viaje de verano', actual: 280, meta: 900, color: 'var(--melocoton-f)' },
  ],
  movimientos: [
    { concepto: 'Supermercado', cat: 'Comida', fecha: 'Hoy', importe: -38.42, color: 'menta' },
    { concepto: 'Bizum de Pablo', cat: 'Ingreso', fecha: 'Ayer', importe: 15, color: 'lavanda' },
    { concepto: 'Tienda de deporte', cat: 'Gimnasio', fecha: 'Ayer', importe: -34.99, color: 'limon' },
    { concepto: 'Cine', cat: 'Ocio', fecha: '16 nov', importe: -9.5, color: 'rosa' },
    { concepto: 'Nómina', cat: 'Ingreso', fecha: '15 nov', importe: 950, color: 'lavanda' },
    { concepto: 'Abono de transporte', cat: 'Transporte', fecha: '14 nov', importe: -20, color: 'cielo' },
  ],
  recomendaciones: [
    'En Ocio llevas un 22 % más que la media de tus últimos tres meses.',
    'A este ritmo ahorrarás unos 437 € este mes, 37 € por encima de tu objetivo.',
    'Tienes 3 suscripciones que suman 31,95 € al mes. Revisa si usas todas.',
  ],
};

export const fitness = {
  objetivo: { kcal: 2600, prot: 160, carb: 300, gras: 80 },
  hoy: { kcal: 1590, prot: 115, carb: 185, gras: 42 },
  racha: 12, mejorRacha: 21, entrenosMes: 13,
  semanas: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'],
  peso: [72.4, 72.9, 73.1, 73.6, 73.4, 74.0, 74.3, 74.6],
  marcas: { nombres: ['Banca', 'Sentadilla', 'P. muerto', 'Militar', 'Dominadas'], kg: [85, 110, 140, 55, 20] },
  entrenoHoy: {
    nombre: 'Pierna', duracion: '75 min',
    ejercicios: [
      { nombre: 'Sentadilla', series: '4 × 8', peso: '90 kg' },
      { nombre: 'Prensa', series: '4 × 12', peso: '180 kg' },
      { nombre: 'Peso muerto rumano', series: '3 × 10', peso: '80 kg' },
      { nombre: 'Extensión de cuádriceps', series: '3 × 15', peso: '45 kg' },
      { nombre: 'Gemelo de pie', series: '4 × 15', peso: '60 kg' },
    ],
  },
  comidas: [
    { nombre: 'Desayuno', plato: 'Avena con plátano y proteína', kcal: 520, p: 38, c: 72, g: 9, hora: '08:10' },
    { nombre: 'Comida', plato: 'Arroz con pollo y verduras', kcal: 760, p: 55, c: 95, g: 16, hora: '14:45' },
    { nombre: 'Merienda', plato: 'Yogur griego con nueces', kcal: 310, p: 22, c: 18, g: 17, hora: '17:30' },
    { nombre: 'Cena', plato: 'Pendiente de añadir', kcal: 0, p: 0, c: 0, g: 0, hora: '' },
  ],
};

/* Estados de cada día del mes (entrenado, descanso, planificado...) */
export function estadoEntreno(dia, hoy) {
  if (dia > hoy) return [1, 3, 5].includes(dia % 7) ? 'plan' : '';
  const patron = ['entreno', 'entreno', 'descanso', 'entreno', 'entreno', 'descanso', 'descanso'];
  if (dia === 6) return 'saltado';
  return patron[(dia + 1) % 7];
}
export function estadoDieta(dia, hoy) {
  if (dia >= hoy) return '';
  return [4, 11, 15].includes(dia) ? 'lejos' : [2, 8, 13, 17].includes(dia) ? 'cerca' : 'cumplido';
}

/* ---------- Calendario: eventos con fecha real ---------- */
export const TIPOS = {
  clase:   { nombre: 'Clase',   plural: 'clases',   color: 'cielo' },
  examen:  { nombre: 'Examen',  plural: 'exámenes', color: 'rosa' },
  tarea:   { nombre: 'Tarea',   plural: 'tareas',   color: 'limon' },
  evento:  { nombre: 'Evento',  plural: 'eventos',  color: 'melocoton' },
  cita:    { nombre: 'Cita',    plural: 'citas',    color: 'lavanda' },
  deporte: { nombre: 'Deporte', plural: 'entrenos', color: 'menta' },
  festivo: { nombre: 'Festivo', plural: 'festivos', color: 'rosa' },
};

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function eventosCalendario() {
  const hoy = new Date();
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const lista = [];
  const año = hoy.getFullYear();
  const festivos = [
    [`${año}-10-12`, 'Fiesta Nacional de España'], [`${año}-11-01`, 'Todos los Santos'],
    [`${año}-12-06`, 'Día de la Constitución'], [`${año}-12-08`, 'Inmaculada Concepción'], [`${año}-12-25`, 'Navidad'],
  ];
  festivos.forEach(([f, t]) => lista.push({ id: 'f' + f, titulo: t, fecha: f, todoElDia: true, tipo: 'festivo', color: 'rosa', importancia: 'baja' }));
  const esFestivo = (f) => festivos.some(([x]) => x === f);

  // Semanas recurrentes (clases y gimnasio) de -6 a +6 semanas
  for (let s = -6; s <= 6; s++) {
    eventos.forEach((e, k) => {
      if (!['Acceso a Datos', 'Desarrollo de Interfaces', 'Gimnasio'].includes(e.titulo)) return;
      const d = new Date(lunes); d.setDate(lunes.getDate() + s * 7 + e.dia);
      const f = iso(d);
      if (esFestivo(f)) return;
      lista.push({ id: `r${s}-${k}`, titulo: e.titulo, fecha: f, ini: e.ini, fin: e.fin, lugar: e.lugar,
        tipo: e.titulo === 'Gimnasio' ? 'deporte' : 'clase', color: e.color, importancia: 'baja', avisos: [] });
    });
  }
  // Eventos sueltos de esta semana
  eventos.forEach((e, k) => {
    if (['Acceso a Datos', 'Desarrollo de Interfaces', 'Gimnasio'].includes(e.titulo)) return;
    const d = new Date(lunes); d.setDate(lunes.getDate() + e.dia);
    const tipo = e.titulo === 'Dentista' ? 'cita' : e.titulo.startsWith('Terminar') ? 'tarea' : e.titulo.includes('pádel') ? 'deporte' : 'evento';
    lista.push({ id: 'u' + k, titulo: e.titulo, fecha: iso(d), ini: e.ini, fin: e.fin, lugar: e.lugar, tipo, color: e.color,
      importancia: e.importante ? 'alta' : 'media', avisos: e.importante ? [60] : [], descripcion: '' });
  });
  // Exámenes y entregas próximas
  const mas = (n) => { const d = new Date(lunes); d.setDate(lunes.getDate() + n); return iso(d); };
  lista.push(
    { id: 'x1', titulo: 'Examen Servicios y Procesos', fecha: mas(8), ini: '09:00', fin: '11:00', tipo: 'examen', color: 'rosa', importancia: 'alta', avisos: [1440, 60], lugar: 'Aula 2.3', descripcion: 'Temas 1 a 4: hilos, procesos y sockets.' },
    { id: 'x2', titulo: 'Examen Acceso a Datos', fecha: mas(10), ini: '09:00', fin: '11:00', tipo: 'examen', color: 'rosa', importancia: 'alta', avisos: [1440], lugar: 'Aula 2.3' },
    { id: 'x3', titulo: 'Examen Desarrollo de Interfaces', fecha: mas(15), ini: '11:30', fin: '13:30', tipo: 'examen', color: 'rosa', importancia: 'alta', avisos: [1440], lugar: 'Aula 2.3' },
    { id: 't1', titulo: 'Entregar práctica 4', fecha: mas(3), todoElDia: true, tipo: 'tarea', color: 'limon', importancia: 'alta', avisos: [120] },
    { id: 't2', titulo: 'Subir memoria FCT', fecha: mas(9), todoElDia: true, tipo: 'tarea', color: 'limon', importancia: 'media', avisos: [] },
    { id: 't3', titulo: 'Pagar cuota gimnasio', fecha: mas(3), todoElDia: true, tipo: 'tarea', color: 'limon', importancia: 'media', avisos: [] },
    { id: 'c2', titulo: 'Revisión médica', fecha: mas(12), ini: '10:00', fin: '10:30', tipo: 'cita', color: 'lavanda', importancia: 'media', avisos: [60] },
    { id: 'e2', titulo: 'Cumpleaños de Laura', fecha: mas(13), ini: '20:00', fin: '23:30', tipo: 'evento', color: 'melocoton', importancia: 'media', avisos: [1440] },
  );
  return lista;
}
