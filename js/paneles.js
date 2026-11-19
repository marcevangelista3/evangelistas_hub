/* =========================================================
   BUSCADOR, NOTIFICACIONES E IA
   ========================================================= */
import { SECCIONES } from './secciones.js';
import { icono } from './iconos.js';
import { datos } from './datos.js';

/* ---------- Buscador (⌘K / Ctrl+K) ---------- */
function indice(acciones) {
  const items = [];
  SECCIONES.forEach((s) => {
    items.push({ titulo: s.nombre, detalle: 'Sección', ruta: `#${s.id}`, icono: s.icono, color: s.color });
    if (s.subapartados.length > 1) s.subapartados.forEach((x) =>
      items.push({ titulo: `${s.nombre} · ${x.nombre}`, detalle: 'Subapartado', ruta: `#${s.id}-${x.id}`, icono: s.icono, color: s.color }));
  });
  items.push({ titulo: 'Personalizar aspecto', detalle: 'Ajustes', accion: acciones.ajustes, icono: 'ajustes', color: 'lavanda' });
  items.push({ titulo: 'Perfil', detalle: 'Cuenta', accion: acciones.perfil, icono: 'usuario', color: 'rosa' });
  items.push({ titulo: 'Notificaciones', detalle: 'Avisos', accion: acciones.notis, icono: 'campana', color: 'limon' });
  items.push({ titulo: 'Preguntar a Claude', detalle: 'IA', accion: acciones.ia, icono: 'chispa', color: 'cielo' });
  return items;
}

const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function prepararBuscador(acciones) {
  const panel = document.getElementById('panel-buscar');
  const input = document.getElementById('buscar-input');
  const lista = document.getElementById('buscar-resultados');
  const items = indice(acciones);
  let resultados = [], sel = 0;

  function pintar() {
    const q = normalizar(input.value.trim());
    resultados = items.filter((i) => !q || normalizar(i.titulo + ' ' + i.detalle).includes(q));
    sel = Math.min(sel, Math.max(0, resultados.length - 1));
    lista.innerHTML = resultados.length
      ? resultados.map((r, n) => `<li class="${n === sel ? 'activo' : ''}" data-n="${n}"><a href="${r.ruta || '#'}"><span class="tarjeta-icono c-${r.color}">${icono(r.icono)}</span>${r.titulo}<small>${r.detalle}</small></a></li>`).join('')
      : '<li class="vacio">Sin resultados</li>';
  }
  function ejecutar(r) {
    panel.close();
    if (!r) return;
    if (r.accion) r.accion(); else location.hash = r.ruta.slice(1);
  }

  input.addEventListener('input', () => { sel = 0; pintar(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = (sel + 1) % resultados.length; pintar(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { sel = (sel - 1 + resultados.length) % resultados.length; pintar(); e.preventDefault(); }
    if (e.key === 'Enter') { ejecutar(resultados[sel]); e.preventDefault(); }
  });
  lista.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-n]'); if (!li) return;
    e.preventDefault(); ejecutar(resultados[+li.dataset.n]);
  });
  panel.addEventListener('click', (e) => { if (e.target === panel) panel.close(); });

  const abrir = () => { input.value = ''; sel = 0; pintar(); panel.showModal(); input.focus(); };
  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); panel.open ? panel.close() : abrir(); }
  });
  return abrir;
}

/* ---------- Centro de notificaciones ---------- */
export async function pintarNotificaciones() {
  const lista = await datos.listar('notificaciones');
  const pendientes = lista.filter((n) => !n.leida).length;
  document.getElementById('insignia').hidden = pendientes === 0;
  document.getElementById('notis-cuerpo').innerHTML = lista.length
    ? lista.map((n) => `<div class="burbuja">${n.texto}</div>`).join('')
    : `<div class="vacio">${icono('campana')}<p>No tienes notificaciones.</p><p class="nota">Aquí aparecerán los recordatorios del calendario, avisos de gastos y emails importantes.</p></div>`;
}

/* ---------- IA ---------- */
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- Asistente (Gemini gratis a través de Supabase) ---------- */
const conversacion = [];

async function contextoApp() {
  const partes = [`Hoy es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`];
  try {
    const F = await import('./finanzas-datos.js');
    const r = F.resumenMes(F.MESES.length - 1);
    partes.push(`Finanzas de ${F.MESES_LARGOS.at(-1)}${F.esDemo ? ' (datos de ejemplo)' : ''}: ingresos ${r.ingresos.toFixed(2)} €, gastos ${r.gastos.toFixed(2)} €. Por categoría: ${r.categorias.map((c) => `${c.nombre} ${c.valor} €`).join(', ')}.`);
    partes.push('Gastos por mes: ' + F.MESES.map((m, i) => `${m} ${Math.round(F.resumenMes(i).gastos)} €`).join(', ') + '.');
  } catch {}
  try {
    const N = await import('./nutricion.js');
    const t = N.totalesDia();
    partes.push(`Dieta de hoy: ${Math.round(t.kcal)} kcal, proteína ${Math.round(t.p)} g, carbohidratos ${Math.round(t.c)} g, grasas ${Math.round(t.g)} g.`);
  } catch {}
  return partes.join('\n');
}

export async function pintarIA() {
  const { usuarioActual, obtenerCliente } = await import('./nube.js');
  const conectado = !!usuarioActual();
  const el = document.getElementById('ia-cuerpo');
  const burbujas = () => conversacion.map((m) => `<div class="burbuja ${m.rol === 'usuario' ? 'yo' : 'claude'}">${esc(m.texto).replace(/\n/g, '<br>')}</div>`).join('');
  el.innerHTML = `
    <div class="chat">
      <div class="burbuja claude">${conectado ? 'Pregúntame lo que quieras sobre tus gastos, tu dieta o tu día. Uso el plan gratuito de Gemini, de Google.' : 'Inicia sesión en Perfil para usar el asistente. Es gratuito (Gemini, de Google).'}</div>
      ${burbujas()}
    </div>
    <form class="chat-entrada">
      <input placeholder="Pregunta lo que quieras…" ${conectado ? '' : 'disabled'} aria-label="Pregunta" name="q" autocomplete="off">
      <button class="boton primario" ${conectado ? '' : 'disabled'} aria-label="Enviar">${icono('enviar')}</button>
    </form>`;
  const chat = el.querySelector('.chat');
  chat.scrollTop = chat.scrollHeight;
  el.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim(); if (!q) return;
    conversacion.push({ rol: 'usuario', texto: q });
    e.target.q.value = '';
    chat.insertAdjacentHTML('beforeend', `<div class="burbuja yo">${esc(q)}</div><div class="burbuja claude escribiendo">…</div>`);
    chat.scrollTop = chat.scrollHeight;
    let texto;
    try {
      const sb = await obtenerCliente();
      const { data, error } = await sb.functions.invoke('ia', { body: { mensajes: conversacion, contexto: await contextoApp() } });
      if (error) {
        const det = await error.context?.json?.().catch(() => null);
        texto = det?.error === 'falta_clave' ? 'Falta activar la clave gratuita de Gemini en la nube.'
          : det?.error === 'limite' ? 'Se ha alcanzado el límite gratuito por minuto. Prueba otra vez en un momento.'
          : 'No he podido responder ahora mismo.';
      } else texto = data.texto || 'Sin respuesta.';
    } catch { texto = 'No hay conexión.'; }
    conversacion.push({ rol: 'ia', texto });
    pintarIA();
  };
}
