/* =========================================================
   ARRANQUE Y NAVEGACIÓN
   Rutas con almohadilla: #seccion-subapartado  (ej. #fitness-dieta)
   ========================================================= */
import { iniciarNube, alCambiarCuenta } from './nube.js';
import { SECCIONES, buscarSeccion } from './secciones.js';
import { icono, pintarIconos } from './iconos.js';
import { aplicar, pintarPanel } from './ajustes.js';
import { animarNumeros } from './graficos.js';
import { pintarAvatares, pintarPanelPerfil, alCambiarPerfil } from './perfil.js';
import { prepararBuscador, pintarNotificaciones, pintarIA } from './paneles.js';

aplicar();
pintarIconos();
pintarAvatares();

const $ = (id) => document.getElementById(id);

// Navegación generada desde el registro de secciones
$('nav-principal').innerHTML = SECCIONES.map((s) =>
  `<a class="pieza nav-enlace cristal" href="#${s.id}" data-seccion="${s.id}" title="${s.nombre}">${icono(s.icono)}<span>${s.nombre}</span></a>`).join('');
$('tabbar').innerHTML = SECCIONES.map((s) =>
  `<a class="tab" href="#${s.id}" data-seccion="${s.id}">${icono(s.icono)}<span>${s.nombre}</span></a>`).join('');

/* ---------- Paneles ---------- */
function abrir(id, preparar) {
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  preparar?.();
  $(id).showModal();
}
const acciones = {
  ajustes: () => abrir('panel-ajustes', pintarPanel),
  perfil: () => abrir('panel-perfil', () => pintarPanelPerfil(acciones.ajustes)),
  notis: () => abrir('panel-notis', pintarNotificaciones),
  ia: () => abrir('panel-ia', pintarIA),
};
const abrirBuscador = prepararBuscador(acciones);

$('abrir-ajustes').addEventListener('click', acciones.ajustes);
$('abrir-perfil').addEventListener('click', acciones.perfil);
$('abrir-notis').addEventListener('click', acciones.notis);
$('abrir-ia').addEventListener('click', acciones.ia);
$('abrir-buscar').addEventListener('click', abrirBuscador);

document.querySelectorAll('dialog').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-cerrar]')) d.close(); });
});
pintarNotificaciones();

/* ---------- Luz que sigue al cursor dentro de cada tarjeta ---------- */
$('vista').addEventListener('pointermove', (e) => {
  const t = e.target.closest('.tarjeta'); if (!t) return;
  const r = t.getBoundingClientRect();
  t.style.setProperty('--mx', `${e.clientX - r.left}px`);
  t.style.setProperty('--my', `${e.clientY - r.top}px`);
});

/* ---------- Rutas ---------- */
function leerRuta() {
  // Admite #fitness-dieta y el formato antiguo #/fitness/dieta
  const [secId, subId] = location.hash.replace(/^#\/?/, '').split(/[/-]/);
  const seccion = buscarSeccion(secId) || SECCIONES[0];
  const sub = seccion.subapartados.find((x) => x.id === subId) || seccion.subapartados[0];
  return { seccion, sub };
}

async function navegar() {
  const { seccion, sub } = leerRuta();
  document.querySelectorAll('[data-seccion]').forEach((a) => a.classList.toggle('activo', a.dataset.seccion === seccion.id));

  const varios = seccion.subapartados.length > 1;
  $('antetitulo').innerHTML = (varios ? seccion.nombre : fechaDeHoy());
  $('titulo-pagina').textContent = varios ? sub.nombre : seccion.nombre;
  $('acciones-pagina').innerHTML = '';
  document.title = `${seccion.nombre} · EVANGELISTA'S HUB`;
  $('subnav').innerHTML = varios
    ? seccion.subapartados.map((x) => `<a class="sub-enlace ${x.id === sub.id ? 'activo' : ''}" href="#${seccion.id}-${x.id}">${x.nombre}</a>`).join('')
    : '';

  const vista = $('vista');
  try {
    const modulo = await import(`./secciones/${seccion.id}.js`);
    await modulo.render(sub.id, vista, seccion);
    vista.querySelectorAll('.tarjeta').forEach((t, i) => t.style.setProperty('--i', i));
    animarNumeros(vista);
  } catch (err) {
    console.error(err);
    vista.innerHTML = '<p>No se ha podido cargar esta sección.</p>';
  }

  // Reinicia las animaciones de entrada
  const cab = $('cabecera-pagina');
  cab.classList.remove('animar'); void cab.offsetWidth; cab.classList.add('animar');
  window.scrollTo({ top: 0 });
}

function fechaDeHoy() {
  const t = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return t.charAt(0).toUpperCase() + t.slice(1);
}

alCambiarPerfil(() => { if (leerRuta().seccion.id === 'inicio') navegar(); });
window.addEventListener('hashchange', navegar);
window.addEventListener('hub:recargar', navegar);
navegar();

// Cuenta y sincronización: si el panel de perfil está abierto, se repinta al cambiar
alCambiarCuenta(() => { if ($('panel-perfil')?.open) pintarPanelPerfil(acciones.ajustes); });
addEventListener('hub:recuperar', () => acciones.perfil());
iniciarNube();
import('./google.js').then((G) => G.iniciarGoogle(alCambiarCuenta));

if ('serviceWorker' in navigator && location.protocol !== 'file:' && document.querySelector('link[rel=manifest]')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
