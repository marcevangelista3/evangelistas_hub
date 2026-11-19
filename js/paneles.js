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
  items.push({ titulo: 'Hablar con Elena', detalle: 'Asistente', accion: acciones.ia, icono: 'chispa', color: 'cielo' });
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

/* ---------- Elena (Gemini gratis a través de Supabase) ---------- */
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const conversacion = []; // { rol: 'usuario' | 'ia', texto, acciones?, estado? }
const SUGERENCIAS = ['Recuérdame que el viernes entrego la práctica', 'He desayunado avena con plátano', 'Hoy he entrenado pierna una hora', '¿Cuánto llevo gastado este mes?'];
let escuchando = null;

function htmlMensaje(m, i, E) {
  if (m.rol === 'usuario') return `<div class="burbuja yo">${esc(m.texto)}</div>`;
  const acciones = m.acciones?.length ? `<div class="elena-acciones ${m.estado || 'pendiente'}" data-msg="${i}">
      <ul>${m.acciones.map((a) => { const d = E.describir(a); return `<li><span class="tarjeta-icono c-lavanda">${icono(d.icono)}</span><div><strong>${esc(d.texto)}</strong><small>${esc(d.detalle)}</small></div></li>`; }).join('')}</ul>
      ${m.estado === 'aplicado' ? '<p class="aviso-ok">Apuntado.</p>' : m.estado === 'descartado' ? '<p class="nota">Descartado.</p>'
        : '<div class="botones"><button class="boton primario" data-aplicar>Apuntar</button><button class="boton" data-descartar>Descartar</button></div>'}
    </div>` : '';
  return `${m.texto ? `<div class="burbuja claude">${esc(m.texto).replace(/\n/g, '<br>')}</div>` : ''}${acciones}`;
}

export async function pintarIA() {
  const { usuarioActual, obtenerCliente } = await import('./nube.js');
  const E = await import('./elena.js');
  const conectado = !!usuarioActual();
  const el = document.getElementById('ia-cuerpo');
  const voz = window.SpeechRecognition || window.webkitSpeechRecognition;
  el.innerHTML = `
    <div class="chat">
      <div class="burbuja claude">${conectado ? 'Hola, soy Elena. Cuéntame tu día: lo que has comido, si has entrenado, qué tienes que entregar… y lo apunto donde toca. También puedes preguntarme por tus datos.' : 'Hola, soy Elena. Inicia sesión en Perfil para hablar conmigo.'}</div>
      ${conversacion.map((m, i) => htmlMensaje(m, i, E)).join('')}
      ${conectado && !conversacion.length ? `<div class="chips elena-sugerencias">${SUGERENCIAS.map((t) => `<button type="button" class="chip-opcion" data-sugerencia>${esc(t)}</button>`).join('')}</div>` : ''}
    </div>
    <form class="chat-entrada">
      ${voz ? `<button type="button" class="boton boton-icono ${escuchando ? 'escuchando' : ''}" data-voz ${conectado ? '' : 'disabled'} aria-label="Hablar">${icono('micro')}</button>` : ''}
      <input placeholder="Escribe o dicta a Elena…" ${conectado ? '' : 'disabled'} aria-label="Mensaje" name="q" autocomplete="off">
      <button class="boton primario" ${conectado ? '' : 'disabled'} aria-label="Enviar">${icono('enviar')}</button>
    </form>`;
  const chat = el.querySelector('.chat');
  const form = el.querySelector('form');
  chat.scrollTop = chat.scrollHeight;

  el.querySelectorAll('[data-sugerencia]').forEach((b) => b.onclick = () => { form.q.value = b.textContent; form.q.focus(); });

  // Confirmar o descartar lo que propone Elena
  el.querySelectorAll('.elena-acciones').forEach((caja) => {
    const m = conversacion[+caja.dataset.msg];
    caja.querySelector('[data-aplicar]')?.addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      try { for (const a of m.acciones) await E.aplicar(a); m.estado = 'aplicado'; }
      catch (err) { m.estado = 'pendiente'; alertar(caja, err); return; }
      pintarIA(); dispatchEvent(new Event('hub:recargar'));
    });
    caja.querySelector('[data-descartar]')?.addEventListener('click', () => { m.estado = 'descartado'; pintarIA(); });
  });

  // Dictado por voz (el del propio navegador, gratis)
  el.querySelector('[data-voz]')?.addEventListener('click', () => {
    if (escuchando) { escuchando.stop(); return; }
    const rec = new voz(); rec.lang = 'es-ES'; rec.interimResults = true; rec.continuous = false;
    escuchando = rec; el.querySelector('[data-voz]').classList.add('escuchando');
    rec.onresult = (e) => { form.q.value = [...e.results].map((r) => r[0].transcript).join(''); if (e.results[e.results.length - 1].isFinal) { rec.stop(); form.requestSubmit(); } };
    rec.onend = rec.onerror = () => { escuchando = null; el.querySelector('[data-voz]')?.classList.remove('escuchando'); };
    rec.start();
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const q = form.q.value.trim(); if (!q) return;
    conversacion.push({ rol: 'usuario', texto: q });
    form.q.value = '';
    el.querySelector('.elena-sugerencias')?.remove();
    chat.insertAdjacentHTML('beforeend', `<div class="burbuja yo">${esc(q)}</div><div class="burbuja claude escribiendo">…</div>`);
    chat.scrollTop = chat.scrollHeight;
    let resp;
    try {
      const sb = await obtenerCliente();
      const historial = conversacion.map((m) => ({ rol: m.rol, texto: m.texto || (m.acciones || []).map((a) => E.describir(a).texto).join('; ') })).filter((m) => m.texto);
      const { data, error } = await sb.functions.invoke('ia', { body: { mensajes: historial, contexto: await E.contexto() } });
      if (error) {
        const det = await error.context?.json?.().catch(() => null);
        resp = { texto: det?.error === 'falta_clave' ? 'Aún falta activar la clave gratuita de Gemini en Supabase. En cuanto la pongas, ya puedo ayudarte.'
          : det?.error === 'limite' ? 'He llegado al límite gratuito de este minuto. Prueba otra vez en un momento.'
          : 'No he podido responder ahora mismo.' };
      } else resp = { texto: data.texto || '', acciones: data.acciones || [] };
    } catch { resp = { texto: 'No hay conexión.' }; }
    if (!resp.texto && !resp.acciones?.length) resp.texto = 'No te he entendido, ¿me lo repites?';
    conversacion.push({ rol: 'ia', ...resp, estado: resp.acciones?.length ? 'pendiente' : undefined });
    pintarIA();
  };
}
function alertar(caja, err) { caja.insertAdjacentHTML('beforeend', `<p class="nota">No se ha podido guardar: ${esc(err.message || err)}</p>`); }
