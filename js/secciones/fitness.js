import { tarjeta, rejilla, esc } from '../ui.js';
import { icono } from '../iconos.js';
import { modoDemo } from '../ajustes.js';
import { contador, barraProgreso, anillo, linea, barras, mes, carrusel, activarCarruseles, animarNumeros } from '../graficos.js';
import { ALIMENTOS, cargarComidas, guardarComidas, macrosItem, macrosComida, totalesDia } from '../nutricion.js';
import { cargarFisico, guardarFisico, serie } from '../composicion.js';
import * as D from '../demo.js';
import { tarjetaHoyInicio, vistaEjercicios, conectarEntrenos, abrirEditor } from '../entrenos-vista.js';

const X = D.fitness;
const pct = (a, b) => Math.round((a / b) * 100);
const n1 = (v) => v.toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const n0 = (v) => Math.round(v).toLocaleString('es-ES');
const hoyIdx = () => (new Date().getDay() + 6) % 7;
const COL = { kcal: 'var(--melocoton-f)', p: 'var(--rosa-f)', c: 'var(--cielo-f)', g: 'var(--limon-f)' };
const O = X.objetivo;

const VACIO = {
  inicio: () => rejilla(
    tarjeta({ titulo: 'Macros de hoy', icono: 'dieta', color: 'menta', ancho: '2', texto: 'Barras de progreso de calorías, proteína, carbohidratos y grasas.' }),
    tarjeta({ titulo: 'Racha', icono: 'progreso', color: 'limon', texto: 'Días seguidos entrenando.' }),
    tarjeta({ titulo: 'Entreno de hoy', icono: 'fitness', color: 'lavanda', ancho: '2', contenido: tarjetaHoyInicio() }),
  ),
  calendario: () => rejilla(tarjeta({ titulo: 'Calendario de entrenos', icono: 'calendario', color: 'menta', ancho: '3', texto: 'Días entrenados, de descanso y planificados.' })),
  ejercicios: vistaEjercicios,
  dieta: () => rejilla(tarjeta({ titulo: 'Comidas de hoy', icono: 'dieta', color: 'menta', ancho: '3', texto: 'Desayuno, comida, merienda y cena.' })),
};

/* ---------- Piezas de macros (se recalculan desde la dieta) ---------- */
function vistasMacros() {
  const t = totalesDia();
  const semanaK = [2480, 2650, 2210, 2590, 2720, 2900, 2550].slice(0, hoyIdx()).concat([t.kcal]);
  const semanaP = [150, 162, 131, 158, 166, 171, 149].slice(0, hoyIdx()).concat([t.p]);
  const dias = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].slice(0, hoyIdx() + 1);
  return [
    { titulo: 'Anillos', html: `<div class="anillos">
      <div class="anillo-item">${anillo(pct(t.kcal, O.kcal), { texto: contador(t.kcal), sub: `de ${O.kcal}`, color: COL.kcal, i: 0 })}Calorías</div>
      <div class="anillo-item">${anillo(pct(t.p, O.prot), { texto: `${n0(t.p)} g`, sub: `de ${O.prot}`, color: COL.p, i: 1 })}Proteína</div>
      <div class="anillo-item">${anillo(pct(t.c, O.carb), { texto: `${n0(t.c)} g`, sub: `de ${O.carb}`, color: COL.c, i: 2 })}Carbos</div>
      <div class="anillo-item">${anillo(pct(t.g, O.gras), { texto: `${n0(t.g)} g`, sub: `de ${O.gras}`, color: COL.g, i: 3 })}Grasas</div></div>` },
    { titulo: 'Barras · % del objetivo', html: barras([pct(t.kcal, O.kcal), pct(t.p, O.prot), pct(t.c, O.carb), pct(t.g, O.gras)], ['Calorías', 'Proteína', 'Carbos', 'Grasas'],
      { colores: [COL.kcal, COL.p, COL.c, COL.g], max: 100, sufijo: ' %' }) },
    { titulo: 'Progreso', html: `<div class="macros">
      ${barraProgreso('Calorías', t.kcal, O.kcal, { color: COL.kcal, unidad: 'kcal', i: 0 })}
      ${barraProgreso('Proteína', t.p, O.prot, { color: COL.p, unidad: 'g', i: 1 })}
      ${barraProgreso('Carbohidratos', t.c, O.carb, { color: COL.c, unidad: 'g', i: 2 })}
      ${barraProgreso('Grasas', t.g, O.gras, { color: COL.g, unidad: 'g', i: 3 })}</div>` },
    { titulo: 'Calorías · esta semana', html: linea(semanaK, dias, { color: COL.kcal }) },
    { titulo: 'Proteína · esta semana', html: linea(semanaP, dias, { color: COL.p }) },
  ];
}

/* ---------- Racha ---------- */
function historialEntrenos() {
  // 16 semanas hacia atrás: 0 = no entrenó, 1-3 = intensidad
  const dias = [], hoy = new Date();
  const ini = new Date(hoy); ini.setDate(hoy.getDate() - hoyIdx() - 7 * 15);
  for (let i = 0; i < 16 * 7; i++) {
    const d = new Date(ini); d.setDate(ini.getDate() + i);
    const futuro = d > hoy;
    const semilla = (d.getDate() * 7 + d.getMonth() * 13 + i) % 10;
    const dsem = (d.getDay() + 6) % 7;
    let n = 0;
    if (!futuro) {
      const reciente = (hoy - d) / 864e5 < X.racha;
      n = reciente ? 1 + (semilla % 3) : (dsem === 6 || semilla < 3) ? 0 : 1 + (semilla % 3);
    }
    dias.push({ n, futuro, hoy: d.toDateString() === hoy.toDateString() });
  }
  return dias;
}
function vistasRacha() {
  const h = historialEntrenos();
  const total = h.filter((d) => d.n).length;
  const cab = `<div><div class="cifra">${contador(X.racha)}<small>días seguidos</small></div><p class="cifra-sub">Mejor racha: ${X.mejorRacha} días · ${X.entrenosMes} entrenos este mes</p></div>`;
  return [
    { titulo: 'Esta semana', html: cab + barras([70, 85, 0, 75, 0, 0, 0].map((v, i) => (i > hoyIdx() ? 0 : v)), ['L', 'M', 'X', 'J', 'V', 'S', 'D'], { destacar: hoyIdx(), color: 'var(--menta-f)', sufijo: ' min' }) },
    { titulo: 'Últimas 16 semanas', html: `<div><div class="cifra">${contador(X.racha)}<small>días de racha</small></div><p class="cifra-sub">${total} entrenos en 16 semanas</p></div>
      <div class="cuadritos">${h.map((d, j) => `<i class="n${d.n} ${d.futuro ? 'futuro' : ''} ${d.hoy ? 'hoy' : ''}" style="--j:${j}"></i>`).join('')}</div>` },
  ];
}

/* ---------- Peso y composición corporal ---------- */
const CINTURAS = [80.0, 80.3, 80.4, 80.8, 80.6, 81.0, 81.1, 81.0];
function vistasPeso() {
  const f = cargarFisico();
  const s = serie(f, X.peso, modoDemo() ? CINTURAS.map((c) => c + (f.cintura - 81)) : null);
  const u = s.at(-1), p = s[0];
  const dif = (a, b, dec = 1) => { const d = a - b; return `<span class="${d >= 0 ? 'sube' : 'baja'}">${d >= 0 ? '+' : ''}${d.toFixed(dec).replace('.', ',')}</span>`; };
  const base = `Según tu peso, altura ${f.altura} cm, cintura ${f.cintura} cm, cuello ${f.cuello} cm y ${f.edad} años.`;
  const est = '<span class="estimacion">Estimación</span>';
  return [
    { titulo: 'Peso', html: `<div><div class="cifra">${contador(u.peso, { dec: 1, suf: ' kg' })}</div><p class="cifra-sub">${dif(u.peso, p.peso)} kg en 8 semanas</p></div>${linea(s.map((x) => x.peso), X.semanas, { color: 'var(--cielo-f)' })}` },
    { titulo: 'Grasa corporal', html: `<div><div class="cifra">${contador(u.grasa, { dec: 1, suf: ' %' })} ${est}</div><p class="cifra-sub">${dif(u.grasa, p.grasa)} puntos · ${n1(u.peso - u.magra)} kg de grasa</p></div>
      ${linea(s.map((x) => x.grasa), X.semanas, { color: 'var(--melocoton-f)' })}<p class="metodo">Método de la Marina de EE. UU. ${base}</p>` },
    { titulo: 'Masa muscular', html: `<div><div class="cifra">${contador(u.musculo, { dec: 1, suf: ' kg' })} ${est}</div><p class="cifra-sub">${dif(u.musculo, p.musculo)} kg de músculo esquelético · masa magra ${n1(u.magra)} kg</p></div>
      ${linea(s.map((x) => x.musculo), X.semanas, { color: 'var(--rosa-f)' })}<p class="metodo">Ecuación de Lee et al. (2000). ${base}</p>` },
    { titulo: 'Agua corporal', html: `<div><div class="cifra">${contador(u.agua, { dec: 1, suf: ' L' })} ${est}</div><p class="cifra-sub">${n1(u.aguaPct)} % de tu peso · ${dif(u.agua, p.agua)} L</p></div>
      ${linea(s.map((x) => x.agua), X.semanas, { color: 'var(--cielo-f)' })}<p class="metodo">Fórmula de Watson. ${base}</p>` },
  ];
}
const botonFisico = '<button type="button" class="enlace boton-fisico" style="border:0;background:none;cursor:pointer">Mis datos</button>';

const leyenda = (items) => `<div class="leyenda-cal">${items.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('')}</div>`;

/* ---------- Dieta: comidas por gramos ---------- */
function htmlComidas(comidas, abierta = -1) {
  return `<ul class="lista-d">${comidas.map((c, j) => {
    const m = macrosComida(c);
    return `<li class="comida ${j === abierta ? 'abierta' : ''}" data-comida="${j}" style="--j:${j}">
      <div class="comida-cab">
        <span class="avatar-mini c-${['limon', 'melocoton', 'rosa', 'lavanda'][j % 4]}">${c.nombre[0]}</span>
        <div class="principal"><strong>${c.nombre}${c.hora ? ` · ${c.hora}` : ''}</strong><small>${c.items.length ? c.items.map(([n, g]) => `${n} ${g} g`).join(', ') : 'Sin añadir'}</small></div>
        <div class="lado">${c.items.length ? `<b>${n0(m.kcal)} kcal</b>P ${n0(m.p)} · C ${n0(m.c)} · G ${n0(m.g)}` : '<b>+ Añadir</b>'}</div>
        <span class="flecha-c">›</span>
      </div>
      <div class="comida-detalle">
        ${c.items.map((it, k) => { const mi = macrosItem(it); return `<div class="ingred"><span>${esc(it[0])}</span>
          <input type="number" min="0" step="5" value="${it[1]}" data-g="${k}" aria-label="Gramos"> <span class="k">${n0(mi.kcal)} kcal</span>
          <button class="quitar" data-quitar="${k}" aria-label="Quitar">✕</button>
          <small class="macros-i">P ${n1(mi.p)} g · C ${n1(mi.c)} g · G ${n1(mi.g)} g</small></div>`; }).join('')}
        <form class="ingred-nuevo" data-nuevo="${j}">
          <input list="lista-alimentos" placeholder="Añadir alimento…" required>
          <input type="number" min="1" step="5" placeholder="g" required>
          <button class="boton primario" type="submit">Añadir</button>
        </form>
      </div>
    </li>`;
  }).join('')}</ul>
  <datalist id="lista-alimentos">${Object.keys(ALIMENTOS).map((a) => `<option value="${a}">`).join('')}</datalist>
  <p class="metodo" style="margin-top:8px">Pulsa una comida para ver y editar lo que lleva. Valores medios aproximados por 100 g.</p>`;
}

function conectarDieta(el) {
  const caja = el.querySelector('[data-comidas]');
  if (!caja) return;
  let comidas = cargarComidas();
  let abierta = -1;
  const refrescar = (animarTodo = false) => {
    guardarComidas(comidas);
    caja.classList.add('sin-anim');
    caja.innerHTML = htmlComidas(comidas, abierta);
    // Recalcula el resto de tarjetas al momento
    const mac = el.querySelector('[data-macros]');
    if (mac) { mac.innerHTML = carrusel(vistasMacros()); activarCarruseles(mac); animarNumeros(mac, 0); }
    if (animarTodo) animarNumeros(caja, 0);
  };
  caja.addEventListener('click', (e) => {
    const li = e.target.closest('[data-comida]'); if (!li) return;
    const j = +li.dataset.comida;
    if (e.target.closest('[data-quitar]')) { comidas[j].items.splice(+e.target.closest('[data-quitar]').dataset.quitar, 1); refrescar(); return; }
    if (e.target.closest('.comida-detalle')) return;
    abierta = abierta === j ? -1 : j;
    li.classList.toggle('abierta', abierta === j);
    caja.querySelectorAll('[data-comida]').forEach((x) => { if (+x.dataset.comida !== abierta) x.classList.remove('abierta'); });
  });
  caja.addEventListener('change', (e) => {
    const inp = e.target.closest('[data-g]'); if (!inp) return;
    const j = +inp.closest('[data-comida]').dataset.comida;
    comidas[j].items[+inp.dataset.g][1] = Math.max(0, +inp.value || 0);
    refrescar();
  });
  caja.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.closest('[data-nuevo]'); const j = +f.dataset.nuevo;
    const [nombre, g] = [f.elements[0].value.trim(), +f.elements[1].value];
    const clave = Object.keys(ALIMENTOS).find((a) => a.toLowerCase() === nombre.toLowerCase());
    if (!clave) { f.elements[0].setCustomValidity('Elige un alimento de la lista'); f.reportValidity(); f.elements[0].setCustomValidity(''); return; }
    comidas[j].items.push([clave, g]);
    if (!comidas[j].hora) comidas[j].hora = new Date().toTimeString().slice(0, 5);
    refrescar();
  });
}

/* ---------- Vistas ---------- */
const DEMO = {
  inicio: () => rejilla(
    tarjeta({ titulo: 'Macros de hoy', icono: 'dieta', color: 'menta', ancho: '2', contenido: `<div data-macros>${carrusel(vistasMacros())}</div>` }),
    tarjeta({ titulo: 'Racha', icono: 'progreso', color: 'limon', contenido: carrusel(vistasRacha()) }),
    tarjeta({ titulo: 'Peso y composición', icono: 'grafico', color: 'cielo', contenido: carrusel(vistasPeso()), extra: botonFisico }),
    tarjeta({ titulo: 'Entreno de hoy', icono: 'fitness', color: 'lavanda', ancho: '2', contenido: tarjetaHoyInicio() }),
  ),

  calendario: () => {
    const hoy = new Date().getDate();
    const colores = { entreno: 'c-menta', descanso: 'c-lavanda', plan: 'c-cielo', saltado: 'c-rosa' };
    return rejilla(
      tarjeta({ titulo: 'Noviembre', icono: 'calendario', color: 'menta', ancho: '2',
        contenido: mes(new Date(), (d) => colores[D.estadoEntreno(d, hoy)] || '') +
          leyenda([['var(--menta-f)', 'Entrenado'], ['var(--lavanda-f)', 'Descanso'], ['var(--cielo-f)', 'Planificado'], ['var(--rosa-f)', 'Saltado']]) }),
      tarjeta({ titulo: 'Resumen del mes', icono: 'progreso', color: 'limon', contenido: `
        <div class="fila-cifras">
          <div class="mini"><div class="cifra">${contador(X.entrenosMes)}</div><p>Entrenos</p></div>
          <div class="mini"><div class="cifra">${contador(5)}</div><p>Descansos</p></div>
          <div class="mini"><div class="cifra">${contador(1)}</div><p>Saltados</p></div>
          <div class="mini"><div class="cifra">${contador(16, { suf: ' h' })}</div><p>Entrenando</p></div>
        </div>
        ${barraProgreso('Objetivo: 16 entrenos', X.entrenosMes, 16, { color: 'var(--menta-f)' })}` }),
      tarjeta({ titulo: 'Racha', icono: 'progreso', color: 'menta', ancho: '3', contenido: carrusel(vistasRacha().reverse()) }),
    );
  },

  ejercicios: vistaEjercicios,

  dieta: () => {
    const hoy = new Date().getDate();
    const colores = { cumplido: 'c-menta', cerca: 'c-limon', lejos: 'c-rosa' };
    const t = totalesDia();
    return rejilla(
      tarjeta({ titulo: 'Comidas de hoy', icono: 'dieta', color: 'menta', ancho: '2', contenido: `<div data-comidas>${htmlComidas(cargarComidas())}</div>` }),
      tarjeta({ titulo: 'Macros', icono: 'grafico', color: 'melocoton', contenido: `<div data-macros>${carrusel(vistasMacros().slice(0, 3).reverse())}</div>` }),
      tarjeta({ titulo: 'Calendario de dieta', icono: 'calendario', color: 'cielo', ancho: '2',
        contenido: mes(new Date(), (d) => colores[D.estadoDieta(d, hoy)] || '') +
          leyenda([['var(--menta-f)', 'Objetivo cumplido'], ['var(--limon-f)', 'Cerca'], ['var(--rosa-f)', 'Lejos']]) }),
      tarjeta({ titulo: 'Calorías esta semana', icono: 'progreso', color: 'limon',
        contenido: (() => { const h = hoyIdx(); const v = [2480, 2650, 2210, 2590, 2720, 2900, 2550].map((k, i) => (i < h ? k : i === h ? Math.round(t.kcal) : 0)); return barras(v, ['L', 'M', 'X', 'J', 'V', 'S', 'D'], { destacar: h, color: 'var(--melocoton-f)', sufijo: ' kcal' }); })() }),
    );
  },
};

/* ---------- Datos físicos para las estimaciones ---------- */
function abrirFisico(el) {
  const f = cargarFisico();
  let dlg = document.getElementById('panel-fisico');
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.id = 'panel-fisico'; dlg.className = 'hoja cristal'; document.body.append(dlg);
    dlg.addEventListener('click', (x) => { if (x.target === dlg || x.target.closest('[data-cerrar]')) dlg.close(); });
  }
  const campo = (k, t, u) => `<label class="fila"><span class="etiqueta">${t}</span><input class="campo" type="number" step="0.5" name="${k}" value="${f[k]}" required style="flex:1"> ${u}</label>`;
  dlg.innerHTML = `<div class="hoja-cabecera"><h2>Mis datos físicos</h2><button class="cerrar" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button></div>
    <form class="hoja-cuerpo">
      <p class="nota">Se usan para estimar tu grasa, músculo y agua corporal. Mide cintura (a la altura del ombligo) y cuello con una cinta métrica.</p>
      <div class="grupo"><div class="segmentado" data-sexo>${[['hombre', 'Hombre'], ['mujer', 'Mujer']].map(([v, t]) => `<button type="button" data-valor="${v}" class="${f.sexo === v ? 'activo' : ''}">${t}</button>`).join('')}</div></div>
      ${campo('edad', 'Edad', 'años')}${campo('altura', 'Altura', 'cm')}${campo('cuello', 'Cuello', 'cm')}${campo('cintura', 'Cintura', 'cm')}
      <div data-cadera ${f.sexo === 'mujer' ? '' : 'hidden'}>${campo('cadera', 'Cadera', 'cm')}</div>
      <div class="grupo"><button class="boton primario ancho" type="submit">Guardar y recalcular</button></div>
    </form>`;
  const form = dlg.querySelector('form');
  dlg.querySelectorAll('[data-sexo] button').forEach((b) => b.onclick = () => {
    f.sexo = b.dataset.valor; dlg.querySelectorAll('[data-sexo] button').forEach((x) => x.classList.toggle('activo', x === b));
    dlg.querySelector('[data-cadera]').hidden = f.sexo !== 'mujer';
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    ['edad', 'altura', 'cuello', 'cintura', 'cadera'].forEach((k) => { f[k] = +form[k].value; });
    guardarFisico(f); dlg.close(); dispatchEvent(new Event('hub:recargar'));
  };
  dlg.showModal();
}

export function render(sub, el) {
  const vistas = modoDemo() ? DEMO : VACIO;
  el.innerHTML = (vistas[sub] || vistas.inicio)();
  activarCarruseles(el);
  conectarDieta(el);
  conectarEntrenos(el);
  if (sub === 'ejercicios') {
    document.getElementById('acciones-pagina').innerHTML = `<button class="boton primario" id="nuevo-entreno">${icono('fitness')} Nuevo entreno</button>`;
    document.getElementById('nuevo-entreno').onclick = () => abrirEditor(null, () => dispatchEvent(new Event('hub:recargar')));
  }
  el.querySelectorAll('.boton-fisico').forEach((b) => b.onclick = () => abrirFisico(el));
  el.querySelectorAll('.lista-d:not([data-comidas] *) .check').forEach((b) => b.addEventListener('click', () => b.closest('li').classList.toggle('hecha')));
}
