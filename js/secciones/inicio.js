import { tarjeta, rejilla, verMas, esc } from '../ui.js';
import { icono } from '../iconos.js';
import { obtenerPerfil } from '../perfil.js';
import { contador, barraProgreso, anillo } from '../graficos.js';
import { totalesDia } from '../nutricion.js';
import { objetivos, iso, sumarDias } from '../registro.js';
import { celebrar, felicitar } from '../celebrar.js';
import { prioridades, marcarHecha, crearEvento, eventos as listaEventos } from '../agenda.js';
import { TIPOS } from '../tipos.js';
import { movimientosGuardados } from '../importar.js';
import * as E from '../entrenos.js';
import { aplicarWidgets, modoEdicion } from '../widgets.js';
import { conectadoGoogle } from '../google.js';
import { gmailActivo, outlookActivo, algunCorreo, importantes, correos, enlace, conectarGmail, conectarOutlook, desconectarOutlook, estadoOutlook } from '../correo.js';
import { estadoGoogle } from '../google.js';

// Outlook queda oculto: la cuenta de Marc es del centro y no permite registrar la app
const OUTLOOK = false;
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
    if (hecha) {
      const todas = lista.length && lista.every((p) => p.hecha);
      celebrar(li.querySelector('.check'), todas ? 'grande' : 'pequeno');
      if (todas) felicitar('¡Todo hecho por hoy!');
    }
    el.querySelector('#tareas-hechas').textContent = `${lista.filter((p) => p.hecha).length} de ${lista.length} hechas`;
  }));
  conectarBotonesCorreo(el.querySelector('[data-widget=emails]') || el);
  el.querySelector('#cuentas-correo')?.addEventListener('click', abrirCuentasCorreo);
  el.querySelector('#correos-elena')?.addEventListener('click', () => {
    document.getElementById('abrir-ia').click();
    let n = 0; const t = setInterval(() => {
      const form = document.querySelector('#ia-cuerpo form');
      if (form?.q || ++n > 30) { clearInterval(t); if (form?.q) { form.q.value = '¿Qué correos importantes tengo que contestar o tienen alguna fecha?'; form.requestSubmit(); } }
    }, 100);
  });
  const f = el.querySelector('#nueva-prioridad');
  if (f) f.onsubmit = (e) => {
    e.preventDefault();
    const titulo = f.titulo.value.trim(); if (!titulo) return;
    crearEvento({ titulo, tipo: 'recordatorio', fecha: iso() });
    celebrar(e.submitter || f, 'pequeno');
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
    <div class="tarjeta-pie"><span>Racha de <b>${actual} ${actual === 1 ? 'día' : 'días'}</b>${pasosHoy() != null ? ` · <b>${pasosHoy().toLocaleString('es-ES')}</b> pasos` : ''}</span><span>${hecho ? `Hecho: ${esc(hecho.nombre)}` : hoy ? `Hoy toca: ${esc(hoy.nombre)}` : E.rutinas().length ? 'Hoy: descanso' : '<a class="enlace" href="#fitness-ejercicios">Crea tu primer entreno</a>'}</span></div>`;
}

function pasosHoy() {
  try { const v = JSON.parse(localStorage.getItem('hub:pasos'))?.[iso()]; return Number.isFinite(v) ? v : null; } catch { return null; }
}
function haceCuanto(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  const h = Math.round(min / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24); return d === 1 ? 'ayer' : `hace ${d} días`;
}
function htmlCorreos() {
  if (!algunCorreo()) {
    return `<p class="vacio-inicio">${conectadoGoogle() ? 'Google ya está conectado, pero falta el permiso para leer tu Gmail.' : 'Conecta tu correo y aquí verás los mensajes importantes sin leer.'} La app solo los lee: nunca envía ni borra nada.</p>
      <div class="botones"><button class="boton primario" data-conectar="gmail">${conectadoGoogle() ? 'Dar permiso a Gmail' : 'Conectar Gmail'}</button>${OUTLOOK ? '<button class="boton" data-conectar="outlook">Conectar Outlook</button>' : ''}</div>
      <p class="nota" id="msg-correo">Te saldrá un aviso de app no verificada: es tu propia app, puedes continuar.</p>`;
  }
  const lista = importantes(6), sinLeer = correos().filter((c) => c.noLeido).length, dos = gmailActivo() && outlookActivo();
  const cuerpo = lista.length ? `<ul class="lista-correos">${lista.map((c, j) => `
      <li style="--j:${j}"><a href="${enlace(c)}" target="_blank" rel="noopener" class="${c.noLeido ? 'no-leido' : ''}">
        <span class="correo-avatar ${c.origen}">${esc((c.de || '?').trim().charAt(0).toUpperCase())}</span>
        <span class="correo-texto"><span class="correo-linea"><b>${esc(c.de)}</b><small>${dos ? (c.origen === 'outlook' ? 'Outlook · ' : 'Gmail · ') : ''}${haceCuanto(c.fecha)}</small></span>
          <span class="correo-asunto">${c.destacado ? '★ ' : ''}${esc(c.asunto)}</span>
          <span class="correo-frag">${esc(c.fragmento)}</span></span>
      </a></li>`).join('')}</ul>` : '<p class="vacio-inicio">Nada importante sin leer en tu bandeja principal. 🎉</p>';
  return `${cuerpo}
    <div class="tarjeta-pie"><span>${sinLeer} sin leer · <button class="enlace" id="cuentas-correo">Cuentas</button></span>${lista.length ? '<button class="enlace" id="correos-elena">Pregúntale a Elena qué contestar</button>' : ''}</div>`;
}

function abrirCuentasCorreo() {
  let dlg = document.getElementById('panel-correo');
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.id = 'panel-correo'; dlg.className = 'hoja cristal'; document.body.append(dlg);
    dlg.addEventListener('click', (x) => { if (x.target === dlg || x.target.closest('[data-cerrar]')) dlg.close(); });
  }
  const fila = (nombre, activo, cuenta, accion) => `<div class="fila"><span class="etiqueta">${nombre}${activo && cuenta ? `<br><small class="nota">${esc(cuenta)}</small>` : ''}</span>${accion}</div>`;
  dlg.innerHTML = `<div class="hoja-cabecera"><h2>Cuentas de correo</h2><button class="cerrar" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button></div>
    <div class="hoja-cuerpo">
      <p class="nota" style="margin-top:0">La app solo lee la bandeja principal de los últimos 10 días. Nunca envía, mueve ni borra correos.</p>
      ${fila('Gmail', gmailActivo(), estadoGoogle().correo, gmailActivo() ? '<span class="chip">Conectado</span>' : '<button class="boton" data-conectar="gmail">Conectar</button>')}
      ${!OUTLOOK && !outlookActivo() ? '' : fila('Outlook', outlookActivo(), estadoOutlook().correo, outlookActivo() ? '<button class="boton peligro" data-desc-outlook>Desconectar</button>' : '<button class="boton" data-conectar="outlook">Conectar</button>')}
      <p class="nota">Gmail se desconecta junto con Google Calendar, desde Calendario.</p>
      <p class="nota" id="msg-correo"></p>
    </div>`;
  conectarBotonesCorreo(dlg);
  dlg.querySelector('[data-desc-outlook]')?.addEventListener('click', async (ev) => {
    ev.target.disabled = true; try { await desconectarOutlook(); } catch {} dlg.close(); dispatchEvent(new Event('hub:recargar'));
  });
  dlg.showModal();
}
function conectarBotonesCorreo(raiz) {
  raiz.querySelectorAll('[data-conectar]').forEach((b) => b.addEventListener('click', async () => {
    const t = b.textContent; b.disabled = true; b.textContent = 'Abriendo…';
    try { await (b.dataset.conectar === 'outlook' ? conectarOutlook() : conectarGmail()); }
    catch (err) { b.disabled = false; b.textContent = t; const m = raiz.querySelector('#msg-correo'); if (m) m.textContent = err.message; }
  }));
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

  const emails = htmlCorreos();

  return rejilla(
    tarjeta({ id: 'prioridades', titulo: 'Prioridades de hoy', icono: 'tareas', color: 'lavanda', ancho: '2', contenido: htmlPrioridades(), extra: verMas('#calendario', 'Calendario') }),
    tarjeta({ id: 'eventos', titulo: 'Próximos eventos', icono: 'reloj', color: 'cielo', contenido: htmlEventos(), extra: verMas('#calendario', 'Calendario') }),
    tarjeta({ id: 'vistazo', titulo: 'Tu día de un vistazo', icono: 'progreso', color: 'limon', contenido: resumen }),
    tarjeta({ id: 'finanzas', titulo: 'Finanzas del mes', icono: 'finanzas', color: 'melocoton', contenido: htmlFinanzas(F), extra: F.hay ? verMas('#finanzas') : '' }),
    tarjeta({ id: 'fitness', titulo: 'Fitness y dieta', icono: 'fitness', color: 'menta', contenido: htmlFitness(T, O), extra: verMas('#fitness') }),
    tarjeta({ id: 'emails', titulo: 'Emails importantes', icono: 'correo', color: 'rosa', ancho: '3', contenido: emails }),
  );
}
