import { tarjeta, rejilla, verMas, esc } from '../ui.js';
import { icono } from '../iconos.js';
import { obtenerPerfil } from '../perfil.js';
import { contador, barraProgreso, anillo } from '../graficos.js';
import { totalesDia } from '../nutricion.js';
import { objetivos, iso, sumarDias } from '../registro.js';
import { prioridades, marcarHecha, crearEvento, eventos as listaEventos } from '../agenda.js';
import { TIPOS } from '../tipos.js';
import { movimientosGuardados } from '../importar.js';
import * as E from '../entrenos.js';
import { aplicarWidgets, modoEdicion } from '../widgets.js';

const TAM = { prioridades: 'xl', eventos: 'm', vistazo: 'm', finanzas: 'm', fitness: 'm', emails: 'full' };
const COLOR_IMP = { alta: 'var(--rosa-f)', media: 'var(--melocoton-f)', baja: 'var(--menta-f)' };
const fDia = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric' });

function saludo() {
  const h = new Date().getHours();
  return h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
}

export function render(sub, el) {
  document.getElementById('titulo-pagina').textContent = `${saludo()}, ${obtenerPerfil().nombre.split(' ')[0]}`;
  el.innerHTML = pagina();

  document.getElementById('acciones-pagina').innerHTML =
    '<button class="boton" id="restablecer-widgets" hidden>Restablecer</button><button class="boton" id="editar-widgets">Editar</button>';
  const rej = el.querySelector('.rejilla');
  aplicarWidgets('inicio', rej, TAM);
  modoEdicion('inicio', rej, TAM, document.getElementById('editar-widgets'));
  conectar(el);
}

function conectar(el) {
  el.querySelectorAll('[data-tarea]').forEach((li) => li.querySelector('.check').addEventListener('click', () => {
    const hecha = !li.classList.contains('hecha');
    li.classList.toggle('hecha', hecha);
    marcarHecha(li.dataset.tarea, hecha);
    const lista = prioridades();
    el.querySelector('#tareas-hechas').textContent = `${lista.filter((p) => p.hecha).length} de ${lista.length} hechas`;
  }));
  const f = el.querySelector('#nueva-prioridad');
  if (f) f.onsubmit = (e) => {
    e.preventDefault();
    const titulo = f.titulo.value.trim(); if (!titulo) return;
    crearEvento({ titulo, tipo: 'recordatorio', fecha: iso() });
    dispatchEvent(new Event('hub:recargar'));
  };
}

/* ---------- Prioridades de hoy (salen del calendario) ---------- */
function htmlPrioridades() {
  const lista = prioridades(), hechas = lista.filter((p) => p.hecha).length;
  const items = lista.length ? `<ul class="lista-d">${lista.map((p, j) => `
      <li data-tarea="${p.id}" class="${p.hecha ? 'hecha' : ''}" style="--j:${j}">
        <span class="prioridad" style="background:${COLOR_IMP[p.importancia] || COLOR_IMP.media}" title="Importancia ${p.importancia || 'media'}"></span>
        <button class="check" aria-label="Marcar como hecha">${icono('tareas')}</button>
        <div class="principal"><strong>${esc(p.titulo)}</strong><small>${p.atrasada ? `Era para el ${fDia.format(new Date(p.fecha + 'T12:00'))}` : p.todoElDia || !p.ini ? 'Hoy' : `${p.ini}${p.fin ? ' – ' + p.fin : ''}`}${p.lugar ? ' · ' + esc(p.lugar) : ''}</small></div>
        <span class="etq ${p.atrasada ? 'atrasada' : `c-${TIPOS[p.tipo]?.color || p.color}`}">${p.atrasada ? 'Atrasada' : TIPOS[p.tipo]?.nombre.split(' ')[0] || 'Importante'}</span>
      </li>`).join('')}</ul>` : '<p class="vacio-inicio">Nada pendiente para hoy. Los recordatorios, entregas y exámenes del calendario aparecen aquí el día que tocan.</p>';
  return `${items}
    <form id="nueva-prioridad" class="ingred-nuevo" style="grid-template-columns:1fr auto">
      <input name="titulo" placeholder="Añadir un recordatorio para hoy…" autocomplete="off">
      <button class="boton" type="submit">Añadir</button>
    </form>
    <div class="tarjeta-pie"><span id="tareas-hechas">${hechas} de ${lista.length} hechas</span>
      <span class="leyenda-cal"><span><i style="background:var(--rosa-f)"></i>Alta</span><span><i style="background:var(--melocoton-f)"></i>Media</span><span><i style="background:var(--menta-f)"></i>Baja</span></span></div>`;
}

/* ---------- Próximos eventos ---------- */
function htmlEventos() {
  const hoy = iso(), manana = iso(sumarDias(new Date(), 1)), ahora = new Date().toTimeString().slice(0, 5);
  const orden = (a, b) => (a.todoElDia ? '' : a.ini || '').localeCompare(b.todoElDia ? '' : b.ini || '');
  const todos = listaEventos();
  const deHoy = todos.filter((e) => e.fecha === hoy && (e.todoElDia || !e.fin || e.fin > ahora)).sort(orden);
  const deManana = todos.filter((e) => e.fecha === manana).sort(orden).slice(0, 3);
  if (!deHoy.length && !deManana.length) {
    const sig = todos.filter((e) => e.fecha > manana).sort((a, b) => (a.fecha + (a.ini || '')).localeCompare(b.fecha + (b.ini || '')))[0];
    return `<p class="vacio-inicio">No tienes nada más hoy ni mañana.${sig ? ` Lo siguiente: <b>${esc(sig.titulo)}</b>, ${fDia.format(new Date(sig.fecha + 'T12:00'))}.` : ''}</p>`;
  }
  const evento = (e, j, cuando = '') => `
    <div class="evento" style="--j:${j}"><span class="barra-color" style="background:var(--${e.color}-f)"></span>
      <div><strong>${esc(e.titulo)}${e.importancia === 'alta' ? ' · importante' : ''}</strong><small>${cuando}${e.todoElDia || !e.ini ? 'Todo el día' : `${e.ini} – ${e.fin}`}${e.lugar ? ' · ' + esc(e.lugar) : ''}</small></div></div>`;
  return `<div class="tiempo">
      ${deHoy.length ? deHoy.map((e, j) => evento(e, j)).join('') : '<p class="vacio-inicio">No te queda nada más hoy.</p>'}
      ${deManana.map((e, j) => evento(e, j + deHoy.length, 'Mañana · ')).join('')}
    </div>`;
}

/* ---------- Finanzas del mes ---------- */
function resumenFinanzas() {
  const hoy = new Date();
  const movs = movimientosGuardados().filter((m) => m.fecha.getFullYear() === hoy.getFullYear() && m.fecha.getMonth() === hoy.getMonth());
  const ingresos = movs.filter((m) => m.importe > 0).reduce((a, m) => a + m.importe, 0);
  const gastos = -movs.filter((m) => m.importe < 0).reduce((a, m) => a + m.importe, 0);
  return { hay: movimientosGuardados().length > 0, ingresos, gastos };
}
function htmlFinanzas(F) {
  if (!F.hay) return '<p class="vacio-inicio">Importa el extracto de Revolut o BBVA y aquí verás lo gastado e ingresado este mes.</p><div class="botones"><a class="boton" href="#finanzas">Ir a Finanzas</a></div>';
  const disponible = F.ingresos - F.gastos;
  return `
    <div><div class="cifra">${contador(disponible, { dec: 2, suf: ' €' })}</div><p class="cifra-sub">disponible este mes</p></div>
    <div class="fila-cifras">
      <div class="mini"><div class="cifra sube">${contador(F.ingresos, { suf: ' €' })}</div><p>Ingresos</p></div>
      <div class="mini"><div class="cifra baja">${contador(F.gastos, { suf: ' €' })}</div><p>Gastos</p></div>
    </div>
    ${barraProgreso('Ahorro del mes', Math.max(0, Math.round(disponible)), objetivos().ahorroMes, { color: 'var(--menta-f)', unidad: '€' })}`;
}

/* ---------- Fitness y dieta ---------- */
function htmlFitness(T, O) {
  const r = (v) => Math.round(v);
  const hoy = E.rutinaDeHoy(), { actual } = E.rachas();
  const hecho = E.historial().find((s) => s.fecha === iso());
  return `
    <div class="macros">
      ${barraProgreso('Calorías', r(T.kcal), O.kcal, { color: 'var(--melocoton-f)', unidad: 'kcal', i: 0 })}
      ${barraProgreso('Proteína', r(T.p), O.prot, { color: 'var(--rosa-f)', unidad: 'g', i: 1 })}
      ${barraProgreso('Carbohidratos', r(T.c), O.carb, { color: 'var(--cielo-f)', unidad: 'g', i: 2 })}
    </div>
    <div class="tarjeta-pie"><span>Racha de <b>${actual} ${actual === 1 ? 'día' : 'días'}</b></span><span>${hecho ? `Hecho: ${esc(hecho.nombre)}` : hoy ? `Hoy toca: ${esc(hoy.nombre)}` : E.rutinas().length ? 'Hoy: descanso' : '<a class="enlace" href="#fitness-ejercicios">Crea tu primer entreno</a>'}</span></div>`;
}

function pagina() {
  const T = totalesDia(), O = objetivos(), F = resumenFinanzas();
  const lista = prioridades(), hechas = lista.filter((p) => p.hecha).length;

  const resumen = `
    <div class="anillos">
      <div class="anillo-item">${anillo(lista.length ? (hechas / lista.length) * 100 : 0, { texto: `${hechas}/${lista.length}`, sub: 'tareas', color: 'var(--lavanda-f)', i: 0 })}Prioridades</div>
      <div class="anillo-item">${anillo((T.kcal / O.kcal) * 100, { texto: `${Math.round((T.kcal / O.kcal) * 100)} %`, sub: 'kcal', color: 'var(--melocoton-f)', i: 1 })}Dieta</div>
      <div class="anillo-item">${anillo(F.ingresos ? (F.gastos / F.ingresos) * 100 : 0, { texto: F.ingresos ? `${Math.round((F.gastos / F.ingresos) * 100)} %` : '–', sub: 'gastado', color: 'var(--cielo-f)', i: 2 })}Presupuesto</div>
    </div>`;

  const emails = '<p class="vacio-inicio">Todavía no está conectado a tu correo. Cuando conectemos Gmail aparecerán aquí los correos que necesitan respuesta.</p>';

  return rejilla(
    tarjeta({ id: 'prioridades', titulo: 'Prioridades de hoy', icono: 'tareas', color: 'lavanda', ancho: '2', contenido: htmlPrioridades(), extra: verMas('#calendario', 'Calendario') }),
    tarjeta({ id: 'eventos', titulo: 'Próximos eventos', icono: 'reloj', color: 'cielo', contenido: htmlEventos(), extra: verMas('#calendario', 'Calendario') }),
    tarjeta({ id: 'vistazo', titulo: 'Tu día de un vistazo', icono: 'progreso', color: 'limon', contenido: resumen }),
    tarjeta({ id: 'finanzas', titulo: 'Finanzas del mes', icono: 'finanzas', color: 'melocoton', contenido: htmlFinanzas(F), extra: F.hay ? verMas('#finanzas') : '' }),
    tarjeta({ id: 'fitness', titulo: 'Fitness y dieta', icono: 'fitness', color: 'menta', contenido: htmlFitness(T, O), extra: verMas('#fitness') }),
    tarjeta({ id: 'emails', titulo: 'Emails importantes', icono: 'correo', color: 'rosa', ancho: '3', contenido: emails }),
  );
}
