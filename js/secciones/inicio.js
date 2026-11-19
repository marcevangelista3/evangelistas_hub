import { tarjeta, rejilla, verMas, esc } from '../ui.js';
import { icono } from '../iconos.js';
import { obtenerPerfil } from '../perfil.js';
import { modoDemo } from '../ajustes.js';
import { contador, barraProgreso, anillo } from '../graficos.js';
import * as D from '../demo.js';
import { totalesDia } from '../nutricion.js';
import { aplicarWidgets, modoEdicion } from '../widgets.js';

const TAM = { prioridades: 'xl', eventos: 'm', vistazo: 'm', finanzas: 'm', fitness: 'm', emails: 'full' };

function saludo() {
  const h = new Date().getHours();
  return h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
}

export function render(sub, el) {
  document.getElementById('titulo-pagina').textContent = `${saludo()}, ${obtenerPerfil().nombre.split(' ')[0]}`;
  el.innerHTML = modoDemo() ? demo() : vacio();

  // Widgets: tamaño y orden personalizables
  document.getElementById('acciones-pagina').innerHTML =
    '<button class="boton" id="restablecer-widgets" hidden>Restablecer</button><button class="boton" id="editar-widgets">Editar</button>';
  const rej = el.querySelector('.rejilla');
  aplicarWidgets('inicio', rej, TAM);
  modoEdicion('inicio', rej, TAM, document.getElementById('editar-widgets'));

  // Marcar tareas como hechas (solo visual en la demo)
  el.querySelectorAll('[data-tarea]').forEach((li) => li.querySelector('.check').addEventListener('click', () => {
    li.classList.toggle('hecha');
    const hechas = el.querySelectorAll('[data-tarea].hecha').length;
    el.querySelector('#tareas-hechas').textContent = `${hechas} de ${D.prioridades.length} hechas`;
  }));
}

function vacio() {
  return rejilla(
    tarjeta({ id: 'prioridades', titulo: 'Prioridades de hoy', icono: 'tareas', color: 'lavanda', ancho: '2', texto: 'Las tareas más importantes del día, ordenadas por prioridad.' }),
    tarjeta({ id: 'eventos', titulo: 'Próximos eventos', icono: 'reloj', color: 'cielo', texto: 'Lo siguiente en tu calendario.' }),
    tarjeta({ id: 'finanzas', titulo: 'Finanzas del mes', icono: 'finanzas', color: 'melocoton', texto: 'Gastado, ingresado y ahorro respecto a tu objetivo.' }),
    tarjeta({ id: 'fitness', titulo: 'Fitness y dieta', icono: 'fitness', color: 'menta', texto: 'Macros de hoy, racha de entrenos y peso.' }),
    tarjeta({ id: 'emails', titulo: 'Emails importantes', icono: 'correo', color: 'rosa', texto: 'Los correos que requieren tu atención.' }),
  );
}

function demo() {
  const hoyIdx = (new Date().getDay() + 6) % 7;
  const ahora = new Date().toTimeString().slice(0, 5);
  const proximos = D.eventos.filter((e) => e.dia === hoyIdx && e.fin > ahora).sort((a, b) => a.ini.localeCompare(b.ini));
  const manana = D.eventos.filter((e) => e.dia === (hoyIdx + 1) % 7).sort((a, b) => a.ini.localeCompare(b.ini)).slice(0, 2);
  const F = D.finanzas, disponible = F.ingresos - F.gastos;
  const T = totalesDia(); const r = (v) => Math.round(v);
  const X = D.fitness, hechas = D.prioridades.filter((p) => p.hecha).length;

  const prioridades = `
    <ul class="lista-d">${D.prioridades.map((p, j) => `
      <li data-tarea class="${p.hecha ? 'hecha' : ''}" style="--j:${j}">
        <span class="prioridad" style="background:${D.COLORES[p.prioridad]}" title="Prioridad ${p.prioridad}"></span>
        <button class="check" aria-label="Marcar como hecha">${icono('tareas')}</button>
        <div class="principal"><strong>${esc(p.texto)}</strong><small>${p.hora}</small></div>
        <span class="etq c-${p.color}">${p.etiqueta}</span>
      </li>`).join('')}
    </ul>
    <div class="tarjeta-pie"><span id="tareas-hechas">${hechas} de ${D.prioridades.length} hechas</span>
      <span class="leyenda-cal"><span><i style="background:var(--rosa-f)"></i>Alta</span><span><i style="background:var(--melocoton-f)"></i>Media</span><span><i style="background:var(--menta-f)"></i>Baja</span></span></div>`;

  const evento = (e, j, cuando = '') => `
    <div class="evento" style="--j:${j}"><span class="barra-color" style="background:var(--${e.color}-f)"></span>
      <div><strong>${e.titulo}${e.importante ? ' · importante' : ''}</strong><small>${cuando}${e.ini} – ${e.fin} · ${e.lugar}</small></div></div>`;
  const eventos = `<div class="tiempo">
      ${proximos.length ? proximos.map((e, j) => evento(e, j)).join('') : '<p>No te queda nada más hoy.</p>'}
      ${manana.map((e, j) => evento(e, j + proximos.length, 'Mañana · ')).join('')}
    </div>`;

  const finanzas = `
    <div><div class="cifra">${contador(disponible, { dec: 2, suf: ' €' })}</div><p class="cifra-sub">disponible este mes</p></div>
    <div class="fila-cifras">
      <div class="mini"><div class="cifra sube">${contador(F.ingresos, { suf: ' €' })}</div><p>Ingresos</p></div>
      <div class="mini"><div class="cifra baja">${contador(F.gastos, { suf: ' €' })}</div><p>Gastos</p></div>
    </div>
    ${barraProgreso('Ahorro del mes', disponible, F.objetivoAhorro, { color: 'var(--menta-f)', unidad: '€' })}`;

  const fitness = `
    <div class="macros">
      ${barraProgreso('Calorías', r(T.kcal), X.objetivo.kcal, { color: 'var(--melocoton-f)', unidad: 'kcal', i: 0 })}
      ${barraProgreso('Proteína', r(T.p), X.objetivo.prot, { color: 'var(--rosa-f)', unidad: 'g', i: 1 })}
      ${barraProgreso('Carbohidratos', r(T.c), X.objetivo.carb, { color: 'var(--cielo-f)', unidad: 'g', i: 2 })}
    </div>
    <div class="tarjeta-pie"><span>Racha de <b>${X.racha} días</b></span><span>Hoy toca: ${X.entrenoHoy.nombre}</span></div>`;

  const emails = `<ul class="lista-d">${D.emails.map((m, j) => `
      <li style="--j:${j}"><span class="avatar-mini c-${m.color}">${m.de[0]}</span>
        <div class="principal"><strong>${esc(m.asunto)}</strong><small>${esc(m.de)} · ${m.hora}</small></div>
        <span class="etq c-${m.color}">${m.cat}</span></li>`).join('')}</ul>`;

  const resumen = `
    <div class="anillos">
      <div class="anillo-item">${anillo((hechas / D.prioridades.length) * 100, { texto: `${hechas}/${D.prioridades.length}`, sub: 'tareas', color: 'var(--lavanda-f)', i: 0 })}Prioridades</div>
      <div class="anillo-item">${anillo((r(T.kcal) / X.objetivo.kcal) * 100, { texto: `${Math.round((r(T.kcal) / X.objetivo.kcal) * 100)} %`, sub: 'kcal', color: 'var(--melocoton-f)', i: 1 })}Dieta</div>
      <div class="anillo-item">${anillo((F.gastos / F.ingresos) * 100, { texto: `${Math.round((F.gastos / F.ingresos) * 100)} %`, sub: 'gastado', color: 'var(--cielo-f)', i: 2 })}Presupuesto</div>
    </div>`;

  return rejilla(
    tarjeta({ id: 'prioridades', titulo: 'Prioridades de hoy', icono: 'tareas', color: 'lavanda', ancho: '2', contenido: prioridades, extra: verMas('#calendario') }),
    tarjeta({ id: 'eventos', titulo: 'Próximos eventos', icono: 'reloj', color: 'cielo', contenido: eventos, extra: verMas('#calendario', 'Calendario') }),
    tarjeta({ id: 'vistazo', titulo: 'Tu día de un vistazo', icono: 'progreso', color: 'limon', contenido: resumen }),
    tarjeta({ id: 'finanzas', titulo: 'Finanzas del mes', icono: 'finanzas', color: 'melocoton', contenido: finanzas, extra: verMas('#finanzas') }),
    tarjeta({ id: 'fitness', titulo: 'Fitness y dieta', icono: 'fitness', color: 'menta', contenido: fitness, extra: verMas('#fitness') }),
    tarjeta({ id: 'emails', titulo: 'Emails importantes', icono: 'correo', color: 'rosa', ancho: '3', contenido: emails }),
  );
}
