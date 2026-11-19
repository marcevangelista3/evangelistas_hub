/* =========================================================
   VISTAS DE ENTRENOS (Fitness › Inicio y Fitness › Ejercicios)
   ========================================================= */
import { tarjeta, rejilla, esc } from './ui.js';
import { icono } from './iconos.js';
import { barras } from './graficos.js';
import * as E from './entrenos.js';

const kg = (v) => (Math.round(v * 10) / 10).toLocaleString('es-ES');
const fDia = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const inicial = (n) => n.trim()[0]?.toUpperCase() || '?';
const resumenSeries = (series) => {
  if (!series.length) return 'Sin series';
  const igual = series.every((x) => x.kg === series[0].kg && x.reps === series[0].reps);
  return igual ? `${series.length} × ${series[0].reps}${series[0].kg ? ` · ${kg(series[0].kg)} kg` : ''}` : series.map((x) => `${kg(x.kg)}×${x.reps}`).join(' · ');
};
const chipsRutinas = (actual) => `<div class="chips chips-rutinas">${E.rutinas().map((r) => `<button type="button" class="chip-opcion ${actual?.id === r.id ? 'activo' : ''}" data-elegir="${r.id}"><i style="background:${r.color}"></i>${esc(r.nombre)}</button>`).join('')}
  <button type="button" class="chip-opcion ${actual === null && E.hoyElegido() ? 'activo' : ''}" data-elegir="">Descanso</button></div>`;

/* ---------- Resumen del entreno elegido ---------- */
function resumenHoy(r, { compacto = false } = {}) {
  if (!E.rutinas().length) return `<p class="cifra-sub">Aún no tienes entrenos. Crea el primero.</p><div class="botones" style="margin-top:12px"><button class="boton primario" data-nueva-rutina>+ Nuevo entreno</button></div>`;
  const ses = E.sesion();
  if (!r) return `${chipsRutinas(r)}<p class="cifra-sub" style="margin-top:14px">Hoy toca descanso.</p>`;
  const lista = compacto ? r.ejercicios.slice(0, 5) : r.ejercicios;
  return `${chipsRutinas(r)}
    <ul class="lista-d" style="margin-top:12px">${lista.map((e, j) => `
      <li style="--j:${j}"><span class="avatar-mini" style="background:color-mix(in srgb, ${r.color} 22%, transparent);color:${r.color}">${inicial(e.nombre)}</span>
        <div class="principal"><strong>${esc(e.nombre)}</strong><small>${resumenSeries(e.series)}</small></div></li>`).join('')}</ul>
    ${compacto && r.ejercicios.length > 5 ? `<p class="cifra-sub">y ${r.ejercicios.length - 5} más</p>` : ''}
    <div class="botones fila-botones-entreno">
      <button class="boton primario" data-empezar="${r.id}">${ses ? 'Continuar entreno' : 'Empezar entreno'}</button>
      ${compacto ? '<a class="boton" href="#fitness-ejercicios">Editar entrenos</a>' : `<button class="boton" data-editar="${r.id}">Editar</button>`}
    </div>`;
}

export const tarjetaHoyInicio = () => resumenHoy(E.rutinaDeHoy(), { compacto: true });

/* ---------- Sesión en curso (registro de series) ---------- */
let descanso = null; // { fin, total, timer }

function htmlSesion(ses) {
  const e = ses.ejercicios[ses.actual] || ses.ejercicios[0];
  const hechas = (x) => x.series.filter((s) => s.hecha).length;
  const prev = E.previa(e.nombre);
  const mins = Math.round((Date.now() - ses.inicio) / 60000);
  return `
    <div class="ses-cab">
      <div><p class="cifra-sub">${esc(ses.nombre)} · ${mins} min · ${kg(E.volumen({ ejercicios: ses.ejercicios.map((x) => ({ series: x.series.filter((s) => s.hecha) })) }))} kg movidos</p></div>
      <div class="botones"><button class="boton" data-descartar>Descartar</button><button class="boton primario" data-terminar>Terminar</button></div>
    </div>
    <div class="ses-ejercicios">${ses.ejercicios.map((x, i) => {
      const p = x.series.length ? hechas(x) / x.series.length : 0;
      return `<button type="button" class="ses-ej ${i === ses.actual ? 'activo' : ''} ${p === 1 ? 'completo' : ''}" data-ir-ej="${i}" style="--p:${p * 100}" title="${esc(x.nombre)}">
        <span>${inicial(x.nombre)}</span>${p === 1 ? `<i>${icono('tareas')}</i>` : ''}</button>`;
    }).join('')}<button type="button" class="ses-ej mas" data-anadir-ej aria-label="Añadir ejercicio">+</button></div>
    <div class="ses-titulo">
      <h3>${esc(e.nombre)}</h3>
      <button type="button" class="boton-icono" data-descanso title="Descanso de ${e.descanso} s" aria-label="Temporizador de descanso">${icono('reloj')}</button>
      <button type="button" class="boton-icono" data-quitar-ej title="Quitar ejercicio" aria-label="Quitar ejercicio">${icono('cerrar')}</button>
    </div>
    <div class="ses-descanso" ${descanso ? '' : 'hidden'}><span>Descanso</span><b data-crono>0:00</b>
      <button type="button" data-mas-desc="-15">−15</button><button type="button" data-mas-desc="15">+15</button><button type="button" data-saltar-desc>Saltar</button></div>
    <div class="ses-tabla" role="table">
      <div class="ses-fila cab" role="row"><span>Serie</span><span>Previa</span><span>Kg</span><span>Repes</span><span></span></div>
      ${e.series.map((s, i) => `
      <div class="ses-fila ${s.hecha ? 'hecha' : ''}" role="row" data-serie="${i}">
        <span class="num">${i + 1}</span>
        <span class="previa">${prev?.[i] ? `${kg(prev[i].kg)} kg × ${prev[i].reps}` : '—'}</span>
        <input type="text" inputmode="decimal" value="${kg(s.kg)}" data-campo="kg" aria-label="Kilos serie ${i + 1}">
        <input type="text" inputmode="numeric" value="${s.reps}" data-campo="reps" aria-label="Repeticiones serie ${i + 1}">
        <button type="button" class="ses-ok" data-ok aria-label="Serie hecha">${icono('tareas')}</button>
      </div>`).join('')}
    </div>
    <div class="ses-pie"><button type="button" class="boton ancho" data-anadir-serie>+ Añadir serie</button>
      ${e.series.length > 1 ? '<button type="button" class="boton" data-quitar-serie>− Quitar última</button>' : ''}</div>`;
}

function pintarDescanso(raiz) {
  const caja = raiz.querySelector('.ses-descanso'); if (!caja) return;
  if (!descanso) { caja.hidden = true; return; }
  const resto = Math.max(0, Math.round((descanso.fin - Date.now()) / 1000));
  caja.hidden = false;
  caja.querySelector('[data-crono]').textContent = `${Math.floor(resto / 60)}:${String(resto % 60).padStart(2, '0')}`;
  caja.style.setProperty('--p', `${(resto / descanso.total) * 100}%`);
  if (!resto) { clearInterval(descanso.timer); descanso = null; navigator.vibrate?.([200, 100, 200]); caja.classList.add('fin'); setTimeout(() => { caja.hidden = true; caja.classList.remove('fin'); }, 2500); }
}
function empezarDescanso(raiz, seg) {
  if (descanso) clearInterval(descanso.timer);
  descanso = { fin: Date.now() + seg * 1000, total: seg };
  descanso.timer = setInterval(() => { const r = document.querySelector('[data-sesion]'); if (r) pintarDescanso(r); else { clearInterval(descanso.timer); descanso = null; } }, 500);
  pintarDescanso(raiz);
}

function conectarSesion(raiz, alTerminar) {
  const ses = E.sesion(); if (!ses) return;
  raiz.innerHTML = htmlSesion(ses);
  pintarDescanso(raiz);
  const e = ses.ejercicios[ses.actual];
  const guardar = (repintar = true) => { E.guardarSesion(ses); if (repintar) conectarSesion(raiz, alTerminar); };
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };

  raiz.querySelectorAll('[data-ir-ej]').forEach((b) => b.onclick = () => { ses.actual = +b.dataset.irEj; guardar(); });
  raiz.querySelectorAll('[data-serie]').forEach((f) => {
    const i = +f.dataset.serie;
    f.querySelectorAll('input').forEach((inp) => {
      inp.onfocus = () => inp.select();
      inp.onchange = () => { e.series[i][inp.dataset.campo] = num(inp.value); guardar(false); };
    });
    f.querySelector('[data-ok]').onclick = () => {
      f.querySelectorAll('input').forEach((inp) => { e.series[i][inp.dataset.campo] = num(inp.value); });
      e.series[i].hecha = !e.series[i].hecha;
      guardar();
      if (e.series[i].hecha) {
        if (e.series.every((s) => s.hecha) && ses.actual < ses.ejercicios.length - 1) setTimeout(() => { ses.actual++; guardar(); }, 600);
        empezarDescanso(raiz, e.descanso || 90);
      }
    };
  });
  raiz.querySelector('[data-anadir-serie]').onclick = () => { const u = e.series.at(-1) || { kg: 0, reps: 10 }; e.series.push({ kg: u.kg, reps: u.reps, hecha: false }); guardar(); };
  raiz.querySelector('[data-quitar-serie]')?.addEventListener('click', () => { e.series.pop(); guardar(); });
  raiz.querySelector('[data-descanso]').onclick = () => (descanso ? (clearInterval(descanso.timer), descanso = null, pintarDescanso(raiz)) : empezarDescanso(raiz, e.descanso || 90));
  raiz.querySelectorAll('[data-mas-desc]').forEach((b) => b.onclick = () => { if (descanso) { descanso.fin += +b.dataset.masDesc * 1000; descanso.total = Math.max(descanso.total, Math.round((descanso.fin - Date.now()) / 1000)); pintarDescanso(raiz); } });
  raiz.querySelector('[data-saltar-desc]').onclick = () => { if (descanso) { clearInterval(descanso.timer); descanso = null; pintarDescanso(raiz); } };
  raiz.querySelector('[data-quitar-ej]').onclick = () => {
    if (ses.ejercicios.length < 2) return;
    ses.ejercicios.splice(ses.actual, 1); ses.actual = Math.min(ses.actual, ses.ejercicios.length - 1); guardar();
  };
  raiz.querySelector('[data-anadir-ej]').onclick = () => {
    const caja = document.createElement('form'); caja.className = 'ses-nuevo';
    caja.innerHTML = `<input class="campo" list="lista-ejercicios" placeholder="Nombre del ejercicio" required><button class="boton primario">Añadir</button>${datalist()}`;
    raiz.querySelector('.ses-ejercicios').after(caja); caja.querySelector('input').focus();
    caja.onsubmit = (ev) => { ev.preventDefault(); const n = caja.querySelector('input').value.trim(); if (!n) return;
      const p = E.previa(n); ses.ejercicios.push({ nombre: n, descanso: 90, series: (p || [{ kg: 0, reps: 10 }, { kg: 0, reps: 10 }, { kg: 0, reps: 10 }]).map((x) => ({ kg: x.kg, reps: x.reps, hecha: false })) });
      ses.actual = ses.ejercicios.length - 1; guardar(); };
  };
  raiz.querySelector('[data-descartar]').onclick = () => { if (confirmar(raiz.querySelector('[data-descartar]'))) { E.descartar(); alTerminar(); } };
  raiz.querySelector('[data-terminar]').onclick = () => { const reg = E.terminar(); if (descanso) { clearInterval(descanso.timer); descanso = null; } alTerminar(reg); };
}

// Confirmación en dos toques (sin diálogos del navegador)
function confirmar(b) {
  if (b.dataset.seguro) return true;
  b.dataset.seguro = '1'; const t = b.textContent; b.textContent = '¿Seguro?';
  setTimeout(() => { delete b.dataset.seguro; b.textContent = t; }, 2500);
  return false;
}

const datalist = () => document.getElementById('lista-ejercicios') ? '' : `<datalist id="lista-ejercicios">${E.EJERCICIOS.map((n) => `<option value="${n}">`).join('')}</datalist>`;

/* ---------- Editor de rutinas ---------- */
const COLORES = ['var(--rosa-f)', 'var(--cielo-f)', 'var(--menta-f)', 'var(--lavanda-f)', 'var(--melocoton-f)', 'var(--limon-f)'];

export function abrirEditor(id, alGuardar) {
  const r = id ? structuredClone(E.rutina(id)) : { id: E.nuevoId(), nombre: '', color: COLORES[E.rutinas().length % COLORES.length], ejercicios: [{ id: E.nuevoId(), nombre: '', descanso: 90, series: [{ kg: 0, reps: 10 }, { kg: 0, reps: 10 }, { kg: 0, reps: 10 }] }] };
  let dlg = document.getElementById('panel-rutina');
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.id = 'panel-rutina'; dlg.className = 'hoja cristal'; document.body.append(dlg);
    dlg.addEventListener('click', (x) => { if (x.target === dlg || x.target.closest('[data-cerrar]')) dlg.close(); });
  }
  const leerFormulario = () => {
    r.nombre = dlg.querySelector('[name=nombre]').value.trim();
    dlg.querySelectorAll('[data-ej]').forEach((b) => {
      const e = r.ejercicios[+b.dataset.ej];
      e.nombre = b.querySelector('[data-nombre]').value.trim();
      e.descanso = +b.querySelector('[data-desc]').value;
      b.querySelectorAll('[data-s]').forEach((f) => { const s = e.series[+f.dataset.s]; s.kg = parseFloat(f.querySelector('[data-kg]').value.replace(',', '.')) || 0; s.reps = parseInt(f.querySelector('[data-reps]').value) || 0; });
    });
  };
  const pintar = () => {
    dlg.innerHTML = `<div class="hoja-cabecera"><h2>${id ? 'Editar entreno' : 'Nuevo entreno'}</h2><button class="cerrar" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button></div>
    <form class="hoja-cuerpo form-rutina">
      <section class="grupo"><p class="grupo-titulo">Nombre</p><input class="campo" name="nombre" value="${esc(r.nombre)}" placeholder="Ej.: Empuje, Pierna, Full body" required maxlength="40"></section>
      <section class="grupo"><p class="grupo-titulo">Color</p><div class="chips">${COLORES.map((c) => `<button type="button" class="muestra ${r.color === c ? 'activo' : ''}" data-color="${c}" style="background:${c}" aria-label="Color"></button>`).join('')}</div></section>
      <section class="grupo"><p class="grupo-titulo">Ejercicios</p>
        ${r.ejercicios.map((e, i) => `
        <div class="ed-ej" data-ej="${i}">
          <div class="ed-ej-cab">
            <input class="campo" data-nombre list="lista-ejercicios" value="${esc(e.nombre)}" placeholder="Ejercicio" required>
            <button type="button" class="boton-icono" data-mover="-1" aria-label="Subir" ${i ? '' : 'disabled'}>↑</button>
            <button type="button" class="boton-icono" data-mover="1" aria-label="Bajar" ${i < r.ejercicios.length - 1 ? '' : 'disabled'}>↓</button>
            <button type="button" class="boton-icono" data-quitar aria-label="Quitar ejercicio">${icono('cerrar')}</button>
          </div>
          <div class="ed-series">
            <div class="ed-fila cab"><span>Serie</span><span>Kg</span><span>Repes</span><span></span></div>
            ${e.series.map((s, j) => `<div class="ed-fila" data-s="${j}"><span>${j + 1}</span><input class="campo" inputmode="decimal" data-kg value="${kg(s.kg)}" aria-label="Kilos"><input class="campo" inputmode="numeric" data-reps value="${s.reps}" aria-label="Repeticiones"><button type="button" class="boton-icono" data-quitar-s aria-label="Quitar serie" ${e.series.length > 1 ? '' : 'disabled'}>−</button></div>`).join('')}
          </div>
          <div class="ed-ej-pie"><button type="button" class="boton" data-mas-s>+ Serie</button>
            <label class="ed-desc">Descanso <select class="campo" data-desc>${[45, 60, 90, 120, 150, 180, 240].map((v) => `<option value="${v}" ${e.descanso === v ? 'selected' : ''}>${v < 60 ? v + ' s' : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')} min`}</option>`).join('')}</select></label></div>
        </div>`).join('')}
        <button type="button" class="boton ancho" data-mas-ej>+ Añadir ejercicio</button>
      </section>
      <div class="grupo botones"><button class="boton primario ancho" type="submit">Guardar</button>${id ? '<button type="button" class="boton" data-borrar>Eliminar entreno</button>' : ''}</div>
      ${datalist()}
    </form>`;
    const f = dlg.querySelector('form');
    f.querySelectorAll('[data-color]').forEach((b) => b.onclick = () => { leerFormulario(); r.color = b.dataset.color; pintar(); });
    f.querySelector('[data-mas-ej]').onclick = () => { leerFormulario(); r.ejercicios.push({ id: E.nuevoId(), nombre: '', descanso: 90, series: [{ kg: 0, reps: 10 }, { kg: 0, reps: 10 }, { kg: 0, reps: 10 }] }); pintar(); dlg.querySelector('.ed-ej:last-of-type [data-nombre]')?.focus(); };
    f.querySelectorAll('[data-ej]').forEach((b) => {
      const i = +b.dataset.ej;
      b.querySelector('[data-mas-s]').onclick = () => { leerFormulario(); const u = r.ejercicios[i].series.at(-1) || { kg: 0, reps: 10 }; r.ejercicios[i].series.push({ ...u }); pintar(); };
      b.querySelectorAll('[data-quitar-s]').forEach((q) => q.onclick = () => { leerFormulario(); r.ejercicios[i].series.splice(+q.closest('[data-s]').dataset.s, 1); pintar(); });
      b.querySelector('[data-quitar]').onclick = () => { leerFormulario(); r.ejercicios.splice(i, 1); pintar(); };
      b.querySelectorAll('[data-mover]').forEach((m) => m.onclick = () => { leerFormulario(); const j = i + +m.dataset.mover; [r.ejercicios[i], r.ejercicios[j]] = [r.ejercicios[j], r.ejercicios[i]]; pintar(); });
    });
    f.querySelector('[data-borrar]')?.addEventListener('click', (ev) => { if (!confirmar(ev.target)) return; E.borrarRutina(r.id); dlg.close(); alGuardar(); });
    f.onsubmit = (ev) => {
      ev.preventDefault(); leerFormulario();
      r.ejercicios = r.ejercicios.filter((e) => e.nombre);
      if (!r.ejercicios.length) return;
      E.guardarRutina(r); dlg.close(); alGuardar();
    };
  };
  pintar();
  dlg.showModal();
}

/* ---------- Pestaña Ejercicios ---------- */
function htmlMarcas() {
  const m = Object.entries(E.marcas()).sort((a, b) => b[1].kg - a[1].kg).slice(0, 6);
  if (!m.length) return '<p class="cifra-sub">Aparecerán cuando termines tu primer entreno.</p>';
  const max = Math.max(...m.map(([, v]) => v.kg));
  return barras(m.map(([, v]) => v.kg), m.map(([n]) => n.length > 12 ? n.slice(0, 11) + '…' : n), { destacar: m.findIndex(([, v]) => v.kg === max), color: 'var(--lavanda-f)', sufijo: ' kg' });
}
function htmlHistorial() {
  const h = E.historial().slice(0, 6);
  if (!h.length) return '<p class="cifra-sub">Cuando pulses «Terminar» en un entreno se guardará aquí.</p>';
  return `<ul class="lista-d">${h.map((s, j) => {
    const r = E.rutina(s.rutinaId);
    const [a, m, d] = s.fecha.split('-').map(Number);
    return `<li style="--j:${j}"><span class="avatar-mini" style="background:color-mix(in srgb, ${r?.color || 'var(--lavanda-f)'} 22%, transparent);color:${r?.color || 'var(--lavanda-f)'}">${inicial(s.nombre)}</span>
      <div class="principal"><strong>${esc(s.nombre)}</strong><small>${fDia.format(new Date(a, m - 1, d))} · ${s.minutos} min · ${s.ejercicios.length} ejercicios</small></div>
      <div class="lado"><b>${kg(E.volumen(s))} kg</b>volumen</div></li>`;
  }).join('')}</ul>`;
}
function htmlRutinas() {
  const l = E.rutinas();
  return `<ul class="lista-d">${l.map((r, j) => `
    <li style="--j:${j}"><span class="avatar-mini" style="background:color-mix(in srgb, ${r.color} 22%, transparent);color:${r.color}">${inicial(r.nombre)}</span>
      <div class="principal"><strong>${esc(r.nombre)}</strong><small>${r.ejercicios.length} ejercicios · ${r.ejercicios.reduce((a, e) => a + e.series.length, 0)} series</small></div>
      <div class="lado acciones-fila"><button class="boton" data-editar="${r.id}">Editar</button></div></li>`).join('')}</ul>
    <div class="botones" style="margin-top:12px"><button class="boton ancho" data-nueva-rutina>+ Nuevo entreno</button></div>`;
}

export function vistaEjercicios() {
  const ses = E.sesion();
  return rejilla(
    tarjeta({ titulo: ses ? 'Entreno en curso' : 'Entreno de hoy', icono: 'fitness', color: 'lavanda', ancho: ses ? '3' : '2', contenido: ses ? '<div data-sesion></div>' : `<div data-hoy>${resumenHoy(E.rutinaDeHoy())}</div>` }),
    tarjeta({ titulo: 'Mis entrenos', icono: 'tareas', color: 'menta', contenido: htmlRutinas() }),
    tarjeta({ titulo: 'Historial', icono: 'reloj', color: 'cielo', ancho: ses ? '' : '', contenido: htmlHistorial() }),
    tarjeta({ titulo: 'Marcas personales', icono: 'progreso', color: 'limon', ancho: '2', contenido: htmlMarcas() }),
  );
}

/** Conecta botones de entrenos en cualquier vista de Fitness */
export function conectarEntrenos(el) {
  const recargar = () => dispatchEvent(new Event('hub:recargar'));
  el.querySelectorAll('[data-elegir]').forEach((b) => b.onclick = () => { E.elegirHoy(b.dataset.elegir || null); recargar(); });
  el.querySelectorAll('[data-editar]').forEach((b) => b.onclick = () => abrirEditor(b.dataset.editar, recargar));
  el.querySelectorAll('[data-nueva-rutina]').forEach((b) => b.onclick = () => abrirEditor(null, recargar));
  el.querySelectorAll('[data-empezar]').forEach((b) => b.onclick = () => {
    if (!E.sesion()) E.empezar(E.rutina(b.dataset.empezar));
    if (location.hash === '#fitness-ejercicios') recargar(); else location.hash = '#fitness-ejercicios';
  });
  const raiz = el.querySelector('[data-sesion]');
  if (raiz) conectarSesion(raiz, (reg) => {
    recargar();
    if (reg) setTimeout(() => {
      const t = document.querySelector('[data-hoy]');
      t?.insertAdjacentHTML('afterbegin', `<p class="aviso-ok">Entreno guardado: ${reg.ejercicios.length} ejercicios, ${kg(E.volumen(reg))} kg en ${reg.minutos} min.</p>`);
    }, 400);
  });
}
