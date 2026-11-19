import { tarjeta, rejilla, esc } from '../ui.js';
import { icono } from '../iconos.js';
import { contador, barraProgreso, anillo, linea, barras, mes, carrusel, activarCarruseles, animarNumeros } from '../graficos.js';
import { alimentos, buscarAlimento, anadirAlimento, cargarComidas, guardarComidas, macrosItem, macrosComida, totalesDia, totalesPorDia } from '../nutricion.js';
import { cargarFisico, guardarFisico, tieneFisico, serie } from '../composicion.js';
import { objetivos, guardarObjetivos, pesos, apuntarPeso, iso, deIso, sumarDias, lunes } from '../registro.js';
import * as E from '../entrenos.js';
import { tarjetaHoyInicio, vistaEjercicios, conectarEntrenos, abrirEditor } from '../entrenos-vista.js';

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const n1 = (v) => v.toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const n0 = (v) => Math.round(v).toLocaleString('es-ES');
const hoyIdx = () => (new Date().getDay() + 6) % 7;
const DS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const COL = { kcal: 'var(--melocoton-f)', p: 'var(--rosa-f)', c: 'var(--cielo-f)', g: 'var(--limon-f)' };
const fCorta = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const vacioTxt = (t) => `<p class="cifra-sub" style="max-width:52ch">${t}</p>`;
let diaDieta = iso();

/* ---------- Macros ---------- */
/** Valores de esta semana (lunes a hoy) a partir de lo apuntado */
function semana(fn) {
  const tot = totalesPorDia(), l = lunes();
  return Array.from({ length: hoyIdx() + 1 }, (_, i) => fn(tot[iso(sumarDias(l, i))]));
}
export function vistasMacros(t = totalesDia()) {
  const O = objetivos();
  const dias = DS.slice(0, hoyIdx() + 1);
  return [
    { titulo: 'Anillos', html: `<div class="anillos">
      <div class="anillo-item">${anillo(pct(t.kcal, O.kcal), { texto: contador(Math.round(t.kcal)), sub: `de ${O.kcal}`, color: COL.kcal, i: 0 })}Calorías</div>
      <div class="anillo-item">${anillo(pct(t.p, O.prot), { texto: `${n0(t.p)} g`, sub: `de ${O.prot}`, color: COL.p, i: 1 })}Proteína</div>
      <div class="anillo-item">${anillo(pct(t.c, O.carb), { texto: `${n0(t.c)} g`, sub: `de ${O.carb}`, color: COL.c, i: 2 })}Carbos</div>
      <div class="anillo-item">${anillo(pct(t.g, O.gras), { texto: `${n0(t.g)} g`, sub: `de ${O.gras}`, color: COL.g, i: 3 })}Grasas</div></div>` },
    { titulo: 'Progreso', html: `<div class="macros">
      ${barraProgreso('Calorías', Math.round(t.kcal), O.kcal, { color: COL.kcal, unidad: 'kcal', i: 0 })}
      ${barraProgreso('Proteína', Math.round(t.p), O.prot, { color: COL.p, unidad: 'g', i: 1 })}
      ${barraProgreso('Carbohidratos', Math.round(t.c), O.carb, { color: COL.c, unidad: 'g', i: 2 })}
      ${barraProgreso('Grasas', Math.round(t.g), O.gras, { color: COL.g, unidad: 'g', i: 3 })}</div>` },
    { titulo: 'Calorías · esta semana', html: linea(semana((x) => Math.round(x?.kcal || 0)), dias, { color: COL.kcal, dec: 0 }) },
    { titulo: 'Proteína · esta semana', html: linea(semana((x) => Math.round(x?.p || 0)), dias, { color: COL.p, dec: 0 }) },
  ];
}

/* ---------- Racha ---------- */
function vistasRacha() {
  const min = E.minutosPorDia(), { actual, mejor } = E.rachas(), hoy = new Date();
  const ini = sumarDias(lunes(), -7 * 15);
  const h = Array.from({ length: 16 * 7 }, (_, i) => {
    const d = sumarDias(ini, i), m = min[iso(d)] || 0;
    return { n: m ? (m < 45 ? 1 : m < 75 ? 2 : 3) : 0, futuro: d > hoy, hoy: iso(d) === iso(hoy) };
  });
  const total = h.filter((d) => d.n).length;
  const delMes = E.historial().filter((s) => s.fecha.startsWith(iso(hoy).slice(0, 7))).length;
  const sem = DS.map((_, i) => min[iso(sumarDias(lunes(), i))] || 0);
  const cab = `<div><div class="cifra">${contador(actual)}<small>${actual === 1 ? 'día seguido' : 'días seguidos'}</small></div><p class="cifra-sub">Mejor racha: ${mejor} días · ${delMes} entrenos este mes</p></div>`;
  return [
    { titulo: 'Esta semana', html: cab + barras(sem, DS, { destacar: hoyIdx(), color: 'var(--menta-f)', sufijo: ' min' }) },
    { titulo: 'Últimas 16 semanas', html: `<div><div class="cifra">${contador(total)}<small>entrenos</small></div><p class="cifra-sub">en las últimas 16 semanas</p></div>
      <div class="cuadritos">${h.map((d, j) => `<i class="n${d.n} ${d.futuro ? 'futuro' : ''} ${d.hoy ? 'hoy' : ''}" style="--j:${j}"></i>`).join('')}</div>` },
  ];
}

/* ---------- Peso y composición corporal ---------- */
function vistasPeso() {
  const l = pesos().slice(-12);
  if (!l.length) return [{ titulo: 'Peso', html: vacioTxt('Apunta tu peso para ver cómo evoluciona. Si además rellenas «Mis datos», calculo grasa, músculo y agua estimados.') }];
  const f = cargarFisico(), etiquetas = l.map((p) => fCorta.format(deIso(p.fecha)).replace('.', ''));
  const s = serie(f, l.map((p) => p.kg));
  const u = s.at(-1), p = s[0];
  const dif = (a, b) => { const d = a - b; return `<span class="${d >= 0 ? 'sube' : 'baja'}">${d >= 0 ? '+' : ''}${d.toFixed(1).replace('.', ',')}</span>`; };
  const desde = l.length > 1 ? `${dif(u.peso, p.peso)} kg desde el ${fCorta.format(deIso(l[0].fecha))}` : `Apuntado el ${fCorta.format(deIso(l[0].fecha))}`;
  const vistas = [{ titulo: 'Peso', html: `<div><div class="cifra">${contador(u.peso, { dec: 1, suf: ' kg' })}</div><p class="cifra-sub">${desde}</p></div>${l.length > 1 ? linea(s.map((x) => x.peso), etiquetas, { color: 'var(--cielo-f)' }) : ''}` }];
  if (!tieneFisico()) return [...vistas, { titulo: 'Composición', html: vacioTxt('Rellena «Mis datos» (altura, cintura, cuello y edad) para estimar grasa, músculo y agua corporal.') }];
  const base = `Según tu peso, altura ${f.altura} cm, cintura ${f.cintura} cm, cuello ${f.cuello} cm y ${f.edad} años.`;
  const est = '<span class="estimacion">Estimación</span>';
  const graf = (k, c) => (l.length > 1 ? linea(s.map((x) => x[k]), etiquetas, { color: c }) : '');
  return [...vistas,
    { titulo: 'Grasa corporal', html: `<div><div class="cifra">${contador(u.grasa, { dec: 1, suf: ' %' })} ${est}</div><p class="cifra-sub">${n1(u.peso - u.magra)} kg de grasa</p></div>${graf('grasa', 'var(--melocoton-f)')}<p class="metodo">Método de la Marina de EE. UU. ${base}</p>` },
    { titulo: 'Masa muscular', html: `<div><div class="cifra">${contador(u.musculo, { dec: 1, suf: ' kg' })} ${est}</div><p class="cifra-sub">Masa magra ${n1(u.magra)} kg</p></div>${graf('musculo', 'var(--rosa-f)')}<p class="metodo">Ecuación de Lee et al. (2000). ${base}</p>` },
    { titulo: 'Agua corporal', html: `<div><div class="cifra">${contador(u.agua, { dec: 1, suf: ' L' })} ${est}</div><p class="cifra-sub">${n1(u.aguaPct)} % de tu peso</p></div>${graf('agua', 'var(--cielo-f)')}<p class="metodo">Fórmula de Watson. ${base}</p>` },
  ];
}
const botonesPeso = '<span class="botones-tarjeta"><button type="button" class="enlace boton-peso">Apuntar peso</button><button type="button" class="enlace boton-fisico">Mis datos</button></span>';
const botonObjetivos = '<button type="button" class="enlace boton-objetivos">Objetivos</button>';
const leyenda = (items) => `<div class="leyenda-cal">${items.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('')}</div>`;

/* ---------- Dieta: comidas por gramos ---------- */
function htmlComidas(comidas, abierta = -1) {
  return `<ul class="lista-d">${comidas.map((c, j) => {
    const m = macrosComida(c);
    return `<li class="comida ${j === abierta ? 'abierta' : ''}" data-comida="${j}" style="--j:${j}">
      <div class="comida-cab">
        <span class="avatar-mini c-${['limon', 'melocoton', 'rosa', 'lavanda'][j % 4]}">${c.nombre[0]}</span>
        <div class="principal"><strong>${c.nombre}${c.hora ? ` · ${c.hora}` : ''}</strong><small>${c.items.length ? c.items.map(([n, g]) => `${esc(n)} ${g} g`).join(', ') : 'Sin añadir'}</small></div>
        <div class="lado">${c.items.length ? `<b>${n0(m.kcal)} kcal</b>P ${n0(m.p)} · C ${n0(m.c)} · G ${n0(m.g)}` : '<b>+ Añadir</b>'}</div>
        <span class="flecha-c">›</span>
      </div>
      <div class="comida-detalle">
        ${c.items.map((it, k) => { const mi = macrosItem(it); return `<div class="ingred"><span>${esc(it[0])}</span>
          <input type="number" min="0" step="any" value="${it[1]}" data-g="${k}" aria-label="Gramos"> <span class="k">${n0(mi.kcal)} kcal</span>
          <button class="quitar" data-quitar="${k}" aria-label="Quitar">✕</button>
          <small class="macros-i">P ${n1(mi.p)} g · C ${n1(mi.c)} g · G ${n1(mi.g)} g</small></div>`; }).join('')}
        <form class="ingred-nuevo" data-nuevo="${j}">
          <input name="nombre" list="lista-alimentos" placeholder="Añadir alimento…" required>
          <input name="g" type="number" min="1" step="any" placeholder="g" required>
          <button class="boton primario" type="submit">Añadir</button>
          <div class="alimento-nuevo" hidden>
            <p class="nota">No lo tengo en la lista. Pon sus valores por 100 g (vienen en la etiqueta) y lo guardo para la próxima vez.</p>
            <input name="kcal" type="number" min="0" step="any" placeholder="kcal">
            <input name="p" type="number" min="0" step="any" placeholder="Proteína g">
            <input name="c" type="number" min="0" step="any" placeholder="Carbos g">
            <input name="gr" type="number" min="0" step="any" placeholder="Grasas g">
          </div>
        </form>
      </div>
    </li>`;
  }).join('')}</ul>
  <datalist id="lista-alimentos">${Object.keys(alimentos()).map((a) => `<option value="${esc(a)}">`).join('')}</datalist>
  <p class="metodo" style="margin-top:8px">Pulsa una comida para ver y editar lo que lleva. Valores medios aproximados por 100 g.</p>`;
}

function navDia() {
  const hoy = diaDieta === iso();
  const txt = hoy ? 'Hoy' : diaDieta === iso(sumarDias(new Date(), -1)) ? 'Ayer' : cap(new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(deIso(diaDieta)));
  return `<span class="nav-dia"><button type="button" class="boton" data-dia="-1" aria-label="Día anterior">‹</button><b>${txt}</b><button type="button" class="boton" data-dia="1" aria-label="Día siguiente" ${hoy ? 'disabled' : ''}>›</button></span>`;
}

function conectarDieta(el) {
  const caja = el.querySelector('[data-comidas]');
  if (!caja) return;
  let comidas = cargarComidas(diaDieta);
  let abierta = -1;
  const refrescar = () => {
    guardarComidas(comidas, diaDieta);
    caja.classList.add('sin-anim');
    caja.innerHTML = htmlComidas(comidas, abierta);
    const mac = el.querySelector('[data-macros]');
    if (mac) { mac.innerHTML = carrusel(vistasMacros(totalesDia(comidas)).slice(0, 2)); activarCarruseles(mac); animarNumeros(mac, 0); }
  };
  el.querySelectorAll('[data-dia]').forEach((b) => b.onclick = () => {
    diaDieta = iso(sumarDias(deIso(diaDieta), +b.dataset.dia));
    if (diaDieta > iso()) diaDieta = iso();
    dispatchEvent(new Event('hub:recargar'));
  });
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
    const nombre = f.nombre.value.trim(), g = +f.g.value;
    let clave = buscarAlimento(nombre);
    const extra = f.querySelector('.alimento-nuevo');
    if (!clave) {
      if (extra.hidden) { extra.hidden = false; extra.querySelectorAll('input').forEach((x) => { x.required = true; }); f.kcal.focus(); return; }
      clave = anadirAlimento(nombre, [f.kcal.value, f.p.value, f.c.value, f.gr.value]);
    }
    comidas[j].items.push([clave, g]);
    if (!comidas[j].hora && diaDieta === iso()) comidas[j].hora = new Date().toTimeString().slice(0, 5);
    refrescar();
  });
}

/* ---------- Calendarios ---------- */
function calendarioEntrenos() {
  const hoy = new Date(), min = E.minutosPorDia(), O = objetivos();
  const delMes = Object.entries(min).filter(([f]) => f.startsWith(iso(hoy).slice(0, 7)));
  const horas = delMes.reduce((a, [, m]) => a + m, 0) / 60;
  const dia = (d) => iso(new Date(hoy.getFullYear(), hoy.getMonth(), d));
  return rejilla(
    tarjeta({ titulo: cap(new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(hoy)), icono: 'calendario', color: 'menta', ancho: '2',
      contenido: mes(hoy, (d) => (min[dia(d)] ? 'c-menta' : '')) + leyenda([['var(--menta-f)', 'Entrenado']]) }),
    tarjeta({ titulo: 'Resumen del mes', icono: 'progreso', color: 'limon', extra: botonObjetivos, contenido: `
      <div class="fila-cifras">
        <div class="mini"><div class="cifra">${contador(delMes.length)}</div><p>Días entrenados</p></div>
        <div class="mini"><div class="cifra">${contador(horas, { dec: 1, suf: ' h' })}</div><p>Entrenando</p></div>
      </div>
      ${barraProgreso(`Objetivo: ${O.entrenosMes} entrenos`, delMes.length, O.entrenosMes, { color: 'var(--menta-f)' })}` }),
    tarjeta({ titulo: 'Racha', icono: 'progreso', color: 'menta', ancho: '3', contenido: carrusel(vistasRacha().reverse()) }),
  );
}

function calendarioDieta() {
  const hoy = new Date(), tot = totalesPorDia(), O = objetivos();
  const clase = (d) => {
    const t = tot[iso(new Date(hoy.getFullYear(), hoy.getMonth(), d))]; if (!t) return '';
    const dif = Math.abs(t.kcal - O.kcal) / O.kcal;
    return dif <= 0.1 ? 'c-menta' : dif <= 0.2 ? 'c-limon' : 'c-rosa';
  };
  return mes(hoy, clase) + leyenda([['var(--menta-f)', 'Objetivo cumplido (±10 %)'], ['var(--limon-f)', 'Cerca (±20 %)'], ['var(--rosa-f)', 'Lejos']]);
}

/* ---------- Vistas ---------- */
const VISTAS = {
  inicio: () => rejilla(
    tarjeta({ titulo: 'Macros de hoy', icono: 'dieta', color: 'menta', ancho: '2', extra: botonObjetivos, contenido: `<div data-macros>${carrusel(vistasMacros())}</div>` }),
    tarjeta({ titulo: 'Racha', icono: 'progreso', color: 'limon', contenido: carrusel(vistasRacha()) }),
    tarjeta({ titulo: 'Peso y composición', icono: 'grafico', color: 'cielo', contenido: carrusel(vistasPeso()), extra: botonesPeso }),
    tarjeta({ titulo: 'Entreno de hoy', icono: 'fitness', color: 'lavanda', ancho: '2', contenido: tarjetaHoyInicio() }),
  ),
  calendario: calendarioEntrenos,
  ejercicios: vistaEjercicios,
  dieta: () => {
    const comidas = cargarComidas(diaDieta), h = hoyIdx(), tot = totalesPorDia();
    const sem = DS.map((_, i) => (i > h ? 0 : Math.round(tot[iso(sumarDias(lunes(), i))]?.kcal || 0)));
    return rejilla(
      tarjeta({ titulo: 'Comidas', icono: 'dieta', color: 'menta', ancho: '2', extra: navDia(), contenido: `<div data-comidas>${htmlComidas(comidas)}</div>` }),
      tarjeta({ titulo: 'Macros', icono: 'grafico', color: 'melocoton', extra: botonObjetivos, contenido: `<div data-macros>${carrusel(vistasMacros(totalesDia(comidas)).slice(0, 2))}</div>` }),
      tarjeta({ titulo: 'Calendario de dieta', icono: 'calendario', color: 'cielo', ancho: '2', contenido: calendarioDieta() }),
      tarjeta({ titulo: 'Calorías esta semana', icono: 'progreso', color: 'limon', contenido: barras(sem, DS, { destacar: h, color: 'var(--melocoton-f)', sufijo: ' kcal' }) }),
    );
  },
};

/* ---------- Hojas: datos físicos, peso y objetivos ---------- */
function hoja(id, titulo, cuerpo) {
  let dlg = document.getElementById(id);
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.id = id; dlg.className = 'hoja cristal'; document.body.append(dlg);
    dlg.addEventListener('click', (x) => { if (x.target === dlg || x.target.closest('[data-cerrar]')) dlg.close(); });
  }
  dlg.innerHTML = `<div class="hoja-cabecera"><h2>${titulo}</h2><button class="cerrar" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button></div><form class="hoja-cuerpo">${cuerpo}</form>`;
  dlg.showModal();
  return dlg;
}
const campo = (k, t, u, v, paso = '0.5') => `<label class="fila"><span class="etiqueta">${t}</span><input class="campo" type="number" step="${paso}" min="0" name="${k}" value="${v ?? ''}" required style="flex:1"> ${u}</label>`;
const recargar = () => dispatchEvent(new Event('hub:recargar'));

function abrirFisico() {
  const f = cargarFisico(), hay = tieneFisico();
  const v = (k) => (hay ? f[k] : '');
  const dlg = hoja('panel-fisico', 'Mis datos físicos', `
    <p class="nota">Se usan para estimar tu grasa, músculo y agua corporal. Mide cintura (a la altura del ombligo) y cuello con una cinta métrica.</p>
    <div class="grupo"><div class="segmentado" data-sexo>${[['hombre', 'Hombre'], ['mujer', 'Mujer']].map(([x, t]) => `<button type="button" data-valor="${x}" class="${f.sexo === x ? 'activo' : ''}">${t}</button>`).join('')}</div></div>
    ${campo('edad', 'Edad', 'años', v('edad'), '1')}${campo('altura', 'Altura', 'cm', v('altura'))}${campo('cuello', 'Cuello', 'cm', v('cuello'))}${campo('cintura', 'Cintura', 'cm', v('cintura'))}
    <div data-cadera ${f.sexo === 'mujer' ? '' : 'hidden'}>${campo('cadera', 'Cadera', 'cm', v('cadera'))}</div>
    <div class="grupo"><button class="boton primario ancho" type="submit">Guardar y recalcular</button></div>`);
  const form = dlg.querySelector('form');
  form.cadera.required = f.sexo === 'mujer';
  dlg.querySelectorAll('[data-sexo] button').forEach((b) => b.onclick = () => {
    f.sexo = b.dataset.valor; dlg.querySelectorAll('[data-sexo] button').forEach((x) => x.classList.toggle('activo', x === b));
    dlg.querySelector('[data-cadera]').hidden = f.sexo !== 'mujer'; form.cadera.required = f.sexo === 'mujer';
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    ['edad', 'altura', 'cuello', 'cintura', 'cadera'].forEach((k) => { if (form[k].value) f[k] = +form[k].value; });
    guardarFisico(f); dlg.close(); recargar();
  };
}

function abrirPeso() {
  const ult = pesos().at(-1);
  const dlg = hoja('panel-peso', 'Apuntar peso', `
    ${campo('kg', 'Peso', 'kg', ult?.kg, '0.1')}
    <label class="fila"><span class="etiqueta">Fecha</span><input class="campo" type="date" name="fecha" value="${iso()}" max="${iso()}" required style="flex:1"></label>
    <p class="nota">Mejor siempre a la misma hora, por ejemplo al levantarte. Si ya hay un peso ese día, se sustituye.</p>
    <div class="grupo"><button class="boton primario ancho" type="submit">Guardar</button></div>`);
  const form = dlg.querySelector('form');
  form.onsubmit = (e) => { e.preventDefault(); apuntarPeso(+form.kg.value, form.fecha.value); dlg.close(); recargar(); };
}

export function abrirObjetivos() {
  const O = objetivos();
  const dlg = hoja('panel-objetivos', 'Mis objetivos', `
    <p class="grupo-titulo">Dieta diaria</p>
    ${campo('kcal', 'Calorías', 'kcal', O.kcal, '10')}${campo('prot', 'Proteína', 'g', O.prot, '1')}${campo('carb', 'Carbohidratos', 'g', O.carb, '1')}${campo('gras', 'Grasas', 'g', O.gras, '1')}
    <p class="grupo-titulo">Entreno y ahorro</p>
    ${campo('entrenosMes', 'Entrenos al mes', '', O.entrenosMes, '1')}${campo('ahorroMes', 'Ahorro al mes', '€', O.ahorroMes, '10')}
    <div class="grupo"><button class="boton primario ancho" type="submit">Guardar</button></div>`);
  const form = dlg.querySelector('form');
  form.onsubmit = (e) => {
    e.preventDefault();
    guardarObjetivos(Object.fromEntries(['kcal', 'prot', 'carb', 'gras', 'entrenosMes', 'ahorroMes'].map((k) => [k, +form[k].value])));
    dlg.close(); recargar();
  };
}

export function render(sub, el) {
  if (sub !== 'dieta') diaDieta = iso();
  el.innerHTML = (VISTAS[sub] || VISTAS.inicio)();
  activarCarruseles(el);
  conectarDieta(el);
  conectarEntrenos(el);
  if (sub === 'ejercicios') {
    document.getElementById('acciones-pagina').innerHTML = `<button class="boton primario" id="nuevo-entreno">${icono('fitness')} Nuevo entreno</button>`;
    document.getElementById('nuevo-entreno').onclick = () => abrirEditor(null, recargar);
  }
  el.querySelectorAll('.boton-fisico').forEach((b) => b.onclick = abrirFisico);
  el.querySelectorAll('.boton-peso').forEach((b) => b.onclick = abrirPeso);
  el.querySelectorAll('.boton-objetivos').forEach((b) => b.onclick = abrirObjetivos);
}
