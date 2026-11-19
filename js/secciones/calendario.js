/* =========================================================
   CALENDARIO
   Vistas Día / Semana / Mes, crear y editar eventos (nombre,
   tipo, horas, importancia, avisos, color, ubicación y
   descripción) y resumen por tipo según la vista.
   Preparado para sincronizar con Google Calendar más adelante.
   ========================================================= */
import { tarjeta, rejilla, esc } from '../ui.js';
import { icono } from '../iconos.js';
import { modoDemo } from '../ajustes.js';
import { mes, contador, animarNumeros } from '../graficos.js';
import { datos } from '../datos.js';
import { TIPOS, eventosCalendario } from '../demo.js';

const H_INI = 7, H_FIN = 24, ALTO = 48;
const COLORES = ['cielo', 'lavanda', 'menta', 'melocoton', 'rosa', 'limon'];
const AVISOS = [[0, 'Al empezar'], [10, '10 min'], [30, '30 min'], [60, '1 h'], [1440, '1 día']];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const deIso = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
const aMin = (h) => { const [a, b] = (h || '0:0').split(':').map(Number); return a * 60 + b; };
const sumar = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const lunesDe = (d) => sumar(d, -((d.getDay() + 6) % 7));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (o) => new Intl.DateTimeFormat('es-ES', o);

let estado = { vista: 'semana', fecha: new Date() };
try { estado.vista = localStorage.getItem('hub:cal-vista') || 'semana'; } catch {}
let el, eventos = [];

async function cargarEventos() {
  const propios = await datos.listar('eventos');
  const ocultos = new Set((await datos.listar('eventos-ocultos')).map((o) => o.ref));
  const demo = modoDemo() ? eventosCalendario().filter((e) => !ocultos.has(e.id) && !propios.some((p) => p.ref === e.id)) : [];
  eventos = [...demo, ...propios.map((p) => ({ ...p, id: p.ref || p.id, _propio: p.id }))];
}

export async function render(sub, contenedor) {
  el = contenedor;
  await cargarEventos();
  document.getElementById('acciones-pagina').innerHTML = `<button class="boton primario" id="nuevo-evento">${icono('calendario')} Nuevo evento</button>`;
  document.getElementById('nuevo-evento').onclick = () => abrirEditor({ fecha: iso(estado.fecha), ini: '10:00', fin: '11:00' });
  pintar();
}

/* ---------- Rango de la vista ---------- */
function rango() {
  const f = estado.fecha;
  if (estado.vista === 'dia') return [f, f];
  if (estado.vista === 'semana') { const l = lunesDe(f); return [l, sumar(l, 6)]; }
  return [new Date(f.getFullYear(), f.getMonth(), 1), new Date(f.getFullYear(), f.getMonth() + 1, 0)];
}
const enRango = (e, [a, b]) => e.fecha >= iso(a) && e.fecha <= iso(b);

function tituloRango([a, b]) {
  if (estado.vista === 'dia') return cap(fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(a));
  if (estado.vista === 'mes') return cap(fmt({ month: 'long', year: 'numeric' }).format(a));
  const m = fmt({ month: 'short' });
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${m.format(b)}` : `${a.getDate()} ${m.format(a)} – ${b.getDate()} ${m.format(b)}`;
}

/* ---------- Pintado ---------- */
function pintar() {
  const r = rango();
  const visibles = eventos.filter((e) => enRango(e, r));

  // Resumen por tipo: solo los que tienen al menos uno
  const cuenta = {};
  visibles.forEach((e) => { cuenta[e.tipo] = (cuenta[e.tipo] || 0) + 1; });
  const resumen = Object.entries(TIPOS).filter(([k]) => cuenta[k]).map(([k, t], i) =>
    `<span class="resumen-chip c-${t.color}" style="--j:${i}"><b>${contador(cuenta[k])}</b> ${cuenta[k] === 1 ? t.nombre.toLowerCase() : t.plural}</span>`).join('');
  const texto = { dia: 'Hoy tienes', semana: 'Esta semana', mes: 'Este mes' }[estado.vista];

  const cabecera = `
    <div class="cal-barra">
      <div class="segmentado cal-vistas">${[['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']].map(([v, t]) =>
        `<button type="button" data-vista="${v}" class="${estado.vista === v ? 'activo' : ''}">${t}</button>`).join('')}</div>
      <div class="cal-nav">
        <button type="button" class="boton" data-ir="-1" aria-label="Anterior">‹</button>
        <button type="button" class="boton" data-ir="0">Hoy</button>
        <button type="button" class="boton" data-ir="1" aria-label="Siguiente">›</button>
        <strong>${tituloRango(r)}</strong>
      </div>
    </div>
    ${resumen ? `<div class="resumen-vista"><span class="cifra-sub">${estado.vista === 'dia' && iso(estado.fecha) !== iso(new Date()) ? 'Ese día' : texto}:</span>${resumen}</div>` : ''}`;

  const cuerpo = estado.vista === 'mes' ? vistaMes(r) : vistaHoras(r);
  const proximos = eventos.filter((e) => e.fecha >= iso(new Date())).sort((a, b) => (a.fecha + (a.ini || '')).localeCompare(b.fecha + (b.ini || ''))).slice(0, 5);

  el.innerHTML = rejilla(
    tarjeta({ titulo: tituloRango(r), icono: 'calendario', color: 'cielo', ancho: '2', clase: 'cal-principal', contenido: cabecera + cuerpo }),
    tarjeta({ titulo: cap(fmt({ month: 'long', year: 'numeric' }).format(estado.fecha)), icono: 'calendario', color: 'lavanda', contenido: `
      <div class="mini-mes">${mes(estado.fecha, (d) => {
        const f = iso(new Date(estado.fecha.getFullYear(), estado.fecha.getMonth(), d));
        return (eventos.some((e) => e.fecha === f && e.tipo === 'examen') ? 'c-rosa ' : eventos.some((e) => e.fecha === f && e.tipo !== 'clase' && e.tipo !== 'deporte') ? 'c-cielo ' : '') + (f === iso(estado.fecha) ? 'sel' : '');
      })}</div>
      <p class="cifra-sub" style="margin-top:10px">Próximos</p>
      <ul class="lista-d">${proximos.map((e, j) => `<li style="--j:${j}" data-ev="${e.id}" class="clicable">
        <span class="prioridad" style="background:var(--${e.color}-f)"></span>
        <div class="principal"><strong>${esc(e.titulo)}</strong><small>${cap(fmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(deIso(e.fecha)))}${e.ini && !e.todoElDia ? ' · ' + e.ini : ''}</small></div>
        ${e.importancia === 'alta' ? '<span class="etq c-rosa">Importante</span>' : ''}</li>`).join('')}</ul>` }),
  );
  el.querySelector('.cal-principal h3').textContent = 'Calendario';
  conectar();
  animarNumeros(el, 100);
  const sc = el.querySelector('.cal-cuerpo');
  if (sc) sc.scrollTop = Math.max(0, (Math.max(new Date().getHours(), 9) - H_INI - 2) * ALTO);
}

function vistaHoras([a]) {
  const dias = estado.vista === 'dia' ? [a] : Array.from({ length: 7 }, (_, i) => sumar(a, i));
  const hoy = iso(new Date());
  const cols = dias.length;
  const cab = dias.map((d) => `<div class="${iso(d) === hoy ? 'hoy' : ''}" data-dia="${iso(d)}">${fmt({ weekday: 'short' }).format(d)}<b>${d.getDate()}</b></div>`).join('');
  const todoDia = dias.map((d) => `<div class="cal-todo-dia">${eventos.filter((e) => e.fecha === iso(d) && e.todoElDia).map((e) =>
    `<span class="pildora c-${e.color}" data-ev="${e.id}">${e.importancia === 'alta' ? '● ' : ''}${esc(e.titulo)}</span>`).join('')}</div>`).join('');

  let j = 0;
  const columnas = dias.map((d) => {
    const lista = eventos.filter((e) => e.fecha === iso(d) && !e.todoElDia).sort((x, y) => aMin(x.ini) - aMin(y.ini));
    // Reparto en carriles cuando se solapan
    const carriles = [];
    lista.forEach((e) => {
      let c = carriles.findIndex((fin) => fin <= aMin(e.ini));
      if (c < 0) { c = carriles.length; carriles.push(0); }
      carriles[c] = aMin(e.fin); e._c = c;
    });
    const n = Math.max(1, carriles.length);
    const evs = lista.map((e) => {
      const top = ((aMin(e.ini) - H_INI * 60) / 60) * ALTO, alto = Math.max(22, ((aMin(e.fin) - aMin(e.ini)) / 60) * ALTO - 3);
      return `<div class="ev c-${e.color}" data-ev="${e.id}" style="top:${top}px;height:${alto}px;left:calc(${(e._c / n) * 100}% + 3px);width:calc(${100 / n}% - 6px);--j:${j++}">
        ${e.importancia === 'alta' ? '<span class="imp" title="Importante"></span>' : ''}<strong>${esc(e.titulo)}</strong>${e.ini} – ${e.fin}${e.lugar ? `<br>${esc(e.lugar)}` : ''}</div>`;
    }).join('');
    const ahora = new Date(), min = ahora.getHours() * 60 + ahora.getMinutes();
    const linea = iso(d) === hoy && min >= H_INI * 60 ? `<div class="ahora" style="top:${((min - H_INI * 60) / 60) * ALTO}px"></div>` : '';
    return `<div class="dia-col" data-dia="${iso(d)}" style="height:${(H_FIN - H_INI) * ALTO}px">${evs}${linea}</div>`;
  }).join('');
  const horas = Array.from({ length: H_FIN - H_INI }, (_, k) => `<span>${String(H_INI + k).padStart(2, '0')}:00</span>`).join('');
  const plantilla = `48px repeat(${cols}, minmax(0, 1fr))`;
  return `<div class="cal-scroll ${cols === 1 ? 'un-dia' : ''}">
    <div class="semana" style="grid-template-columns:${plantilla}"><div class="semana-cab"><div></div>${cab}</div></div>
    <div class="semana" style="grid-template-columns:${plantilla}"><div class="horas-todo">Todo el día</div>${todoDia}</div>
    <div class="cal-cuerpo"><div class="semana" style="grid-template-columns:${plantilla}"><div class="horas">${horas}</div>${columnas}</div></div>
  </div>`;
}

function vistaMes([a, b]) {
  const ini = lunesDe(a), hoy = iso(new Date());
  const celdas = [];
  for (let d = ini; d <= b || celdas.length % 7; d = sumar(d, 1)) celdas.push(d);
  return `<div class="cal-mes">
    ${['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((n) => `<div class="cal-mes-ds">${n}</div>`).join('')}
    ${celdas.map((d, k) => {
      const lista = eventos.filter((e) => e.fecha === iso(d)).sort((x, y) => (x.todoElDia ? -1 : 0) - (y.todoElDia ? -1 : 0) || aMin(x.ini) - aMin(y.ini));
      const max = 3;
      return `<div class="cal-mes-d ${d.getMonth() !== a.getMonth() ? 'fuera' : ''} ${iso(d) === hoy ? 'hoy' : ''}" data-dia="${iso(d)}" style="--j:${k}">
        <span class="num">${d.getDate()}</span>
        ${lista.slice(0, max).map((e) => `<span class="pildora c-${e.color}" data-ev="${e.id}">${e.importancia === 'alta' ? '● ' : ''}${e.ini && !e.todoElDia ? e.ini + ' ' : ''}${esc(e.titulo)}</span>`).join('')}
        ${lista.length > max ? `<span class="mas">+${lista.length - max} más</span>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

/* ---------- Interacción ---------- */
function conectar() {
  el.querySelectorAll('[data-vista]').forEach((b) => b.onclick = () => {
    estado.vista = b.dataset.vista; try { localStorage.setItem('hub:cal-vista', estado.vista); } catch {} pintar();
  });
  el.querySelectorAll('[data-ir]').forEach((b) => b.onclick = () => {
    const n = +b.dataset.ir, f = estado.fecha;
    if (!n) estado.fecha = new Date();
    else if (estado.vista === 'dia') estado.fecha = sumar(f, n);
    else if (estado.vista === 'semana') estado.fecha = sumar(f, 7 * n);
    else estado.fecha = new Date(f.getFullYear(), f.getMonth() + n, 1);
    pintar();
  });
  el.querySelectorAll('[data-ev]').forEach((x) => x.onclick = (e) => { e.stopPropagation(); abrirEditor(eventos.find((v) => v.id === x.dataset.ev)); });
  // Clic en una hora libre: nuevo evento a esa hora
  el.querySelectorAll('.dia-col').forEach((c) => c.onclick = (e) => {
    const y = e.clientY - c.getBoundingClientRect().top;
    const min = Math.floor(((y / ALTO) * 60) / 30) * 30 + H_INI * 60;
    const hh = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    abrirEditor({ fecha: c.dataset.dia, ini: hh(min), fin: hh(min + 60) });
  });
  // Clic en un día del mes o de la cabecera: vista día
  el.querySelectorAll('.cal-mes-d, .semana-cab [data-dia]').forEach((c) => c.onclick = () => { estado.fecha = deIso(c.dataset.dia); estado.vista = 'dia'; pintar(); });
  el.querySelectorAll('.mini-mes .d:not(.vacio)').forEach((c) => c.onclick = () => {
    estado.fecha = new Date(estado.fecha.getFullYear(), estado.fecha.getMonth(), +c.textContent); estado.vista = 'dia'; pintar();
  });
}

/* ---------- Editor de eventos ---------- */
function abrirEditor(ev = {}) {
  const nuevo = !ev.id;
  const e = { titulo: '', tipo: 'evento', color: 'melocoton', importancia: 'media', avisos: [30], todoElDia: false, descripcion: '', lugar: '', ...ev };
  let dlg = document.getElementById('panel-evento');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'panel-evento'; dlg.className = 'hoja cristal';
    document.body.append(dlg);
    dlg.addEventListener('click', (x) => { if (x.target === dlg || x.target.closest('[data-cerrar]')) dlg.close(); });
  }
  dlg.innerHTML = `
    <div class="hoja-cabecera"><h2>${nuevo ? 'Nuevo evento' : 'Editar evento'}</h2><button class="cerrar" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button></div>
    <form class="hoja-cuerpo form-evento" id="form-evento">
      <input class="campo titulo-ev" name="titulo" placeholder="Añade un título" required value="${esc(e.titulo)}">
      <div class="grupo"><p class="grupo-titulo">Tipo</p>
        <div class="chips">${Object.entries(TIPOS).map(([k, t]) => `<button type="button" class="chip-opcion ${e.tipo === k ? 'activo' : ''}" data-tipo="${k}">${t.nombre}</button>`).join('')}</div></div>
      <div class="grupo"><p class="grupo-titulo">Cuándo</p>
        <input class="campo" type="date" name="fecha" value="${e.fecha}" required>
        <label class="fila"><input type="checkbox" name="todoElDia" ${e.todoElDia ? 'checked' : ''}> Todo el día</label>
        <div class="fila horas-ev" ${e.todoElDia ? 'hidden' : ''}><input class="campo" type="time" name="ini" value="${e.ini || '10:00'}"> – <input class="campo" type="time" name="fin" value="${e.fin || '11:00'}"></div></div>
      <div class="grupo"><p class="grupo-titulo">Importancia</p>
        <div class="segmentado" data-grupo="importancia">${[['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']].map(([v, t]) => `<button type="button" data-valor="${v}" class="${e.importancia === v ? 'activo' : ''}">${t}</button>`).join('')}</div></div>
      <div class="grupo"><p class="grupo-titulo">Color</p>
        <div class="muestras">${COLORES.map((c) => `<button type="button" class="muestra c-${c} ${e.color === c ? 'activo' : ''}" style="background:var(--${c}-f)" data-color="${c}" aria-label="${c}"></button>`).join('')}</div></div>
      <div class="grupo"><p class="grupo-titulo">Avisos</p>
        <div class="chips">${AVISOS.map(([m, t]) => `<button type="button" class="chip-opcion ${e.avisos?.includes(m) ? 'activo' : ''}" data-aviso="${m}">${t}</button>`).join('')}</div>
        <p class="nota">Los avisos llegarán como notificación cuando conectemos la cuenta.</p></div>
      <div class="grupo"><p class="grupo-titulo">Ubicación</p><input class="campo" name="lugar" value="${esc(e.lugar || '')}" placeholder="Dónde"></div>
      <div class="grupo"><p class="grupo-titulo">Descripción</p><textarea class="campo" name="descripcion" rows="3" placeholder="Notas, enlaces…">${esc(e.descripcion || '')}</textarea></div>
      <div class="botones">
        <button class="boton primario" type="submit">Guardar</button>
        ${nuevo ? '' : '<button class="boton peligro" type="button" id="borrar-ev">Eliminar</button>'}
      </div>
    </form>`;
  const f = dlg.querySelector('form');
  f.todoElDia.onchange = () => { dlg.querySelector('.horas-ev').hidden = f.todoElDia.checked; };
  dlg.querySelectorAll('[data-tipo]').forEach((b) => b.onclick = () => {
    e.tipo = b.dataset.tipo; e.color = TIPOS[e.tipo].color;
    dlg.querySelectorAll('[data-tipo]').forEach((x) => x.classList.toggle('activo', x === b));
    dlg.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('activo', x.dataset.color === e.color));
  });
  dlg.querySelectorAll('[data-grupo] button').forEach((b) => b.onclick = () => {
    e.importancia = b.dataset.valor; b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('activo', x === b));
  });
  dlg.querySelectorAll('[data-color]').forEach((b) => b.onclick = () => {
    e.color = b.dataset.color; dlg.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('activo', x === b));
  });
  dlg.querySelectorAll('[data-aviso]').forEach((b) => b.onclick = () => b.classList.toggle('activo'));

  f.onsubmit = async (x) => {
    x.preventDefault();
    const fila = {
      titulo: f.titulo.value.trim(), fecha: f.fecha.value, todoElDia: f.todoElDia.checked,
      ini: f.todoElDia.checked ? '' : f.ini.value, fin: f.todoElDia.checked ? '' : (f.fin.value > f.ini.value ? f.fin.value : f.ini.value),
      tipo: e.tipo, color: e.color, importancia: e.importancia, lugar: f.lugar.value.trim(), descripcion: f.descripcion.value.trim(),
      avisos: [...dlg.querySelectorAll('[data-aviso].activo')].map((b) => +b.dataset.aviso),
    };
    if (e._propio) await datos.actualizar('eventos', e._propio, fila);
    else await datos.crear('eventos', { ...fila, ref: nuevo ? undefined : e.id });
    dlg.close(); estado.fecha = deIso(fila.fecha); await cargarEventos(); pintar();
  };
  dlg.querySelector('#borrar-ev')?.addEventListener('click', async () => {
    if (e._propio) await datos.borrar('eventos', e._propio);
    if (!e._propio || e.id !== e._propio) await datos.crear('eventos-ocultos', { ref: e.id });
    dlg.close(); await cargarEventos(); pintar();
  });
  dlg.showModal();
  if (nuevo) f.titulo.focus();
}
