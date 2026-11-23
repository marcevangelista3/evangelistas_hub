/* =========================================================
   SECCIÓN NOTAS
   - Notas: asignaturas con sus exámenes y actividades, media
     ponderada y lo que hace falta en lo que queda.
   - Porcentajes: cuánto vale cada bloque y cada nota.
   Datos y cálculos en js/notas.js.
   ========================================================= */
import { tarjeta, rejilla, esc } from '../ui.js';
import { icono } from '../iconos.js';
import { usuarioActual } from '../nube.js';
import { felicitar } from '../celebrar.js';
import {
  COLORES, TIPOS_NOTA, asignaturas, calcular, necesito, pesoEnBloque, esNueva, moodle, sincronizarMoodle, conectarMoodle, desconectarMoodle,
  ajusteAsig, ajusteItem, crearAsignatura, borrarAsignatura, guardarNotaManual, borrarNotaManual,
} from '../notas.js';

const n1 = (x) => x.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n0 = (x) => Math.round(x).toLocaleString('es-ES');
const tono = (n) => (n == null ? 'pend' : n < 5 ? 'mal' : n < 7 ? 'med' : 'bien');
const fHora = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function hace(iso) {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'ahora mismo'; if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60); if (h < 24) return `hace ${h} h`;
  return fHora.format(new Date(iso));
}

let el, subActual = 'notas', sel = null, verOcultas = false;

export function render(sub, contenedor) {
  el = contenedor; subActual = sub;
  pintar();
  // Moodle: trae lo último sin bloquear (el servidor ya revisa cada 15 min)
  if (usuarioActual() && moodle()?.conectado) sincronizarMoodle().then((cambio) => {
    if (el.isConnected && !document.querySelector('dialog[open]')) { pintarAcciones(); if (cambio) pintar(); }
  }).catch(() => {});
}
function pintar() {
  pintarAcciones();
  if (subActual === 'porcentajes') porcentajes(); else notas();
}

function pintarAcciones() {
  const m = moodle();
  const txt = !m?.conectado ? 'Conectar Moodle' : m.error === 'token' ? '⚠︎ Moodle · reconectar' : `● Moodle · ${hace(m.ultima)}`;
  document.getElementById('acciones-pagina').innerHTML = `<button class="boton" id="boton-moodle">${txt}</button><button class="boton primario" id="anadir-nota">${icono('notas')} Añadir nota</button>`;
  document.getElementById('boton-moodle').onclick = abrirMoodle;
  document.getElementById('anadir-nota').onclick = () => editarNota(null);
}

/* ---------- Pestaña Notas ---------- */
function notas() {
  const todas = asignaturas({ ocultas: true }), lista = todas.filter((a) => !a.oculta), ocultas = todas.length - lista.length;
  if (!lista.length) {
    el.innerHTML = rejilla(tarjeta({ titulo: 'Aún no hay notas', icono: 'notas', color: 'rosa', ancho: '3',
      contenido: `<p class="cifra-sub" style="max-width:60ch">Conecta tu campus de Moodle y tus notas llegarán solas, cada una en su asignatura. También puedes crear asignaturas y apuntar notas a mano.</p>
        <div class="botones" style="margin-top:14px"><button class="boton primario" data-moodle>Conectar Moodle</button><button class="boton" data-nueva-asig>Añadir asignatura a mano</button></div>
        ${ocultas ? `<p class="nota">Tienes ${ocultas} ${ocultas === 1 ? 'asignatura oculta' : 'asignaturas ocultas'}. <button class="enlace" data-ver-ocultas>Mostrarlas</button></p>` : ''}` }));
    el.querySelector('[data-moodle]').onclick = abrirMoodle;
    el.querySelector('[data-nueva-asig]').onclick = () => editarAsignatura(null);
    el.querySelector('[data-ver-ocultas]')?.addEventListener('click', () => { verOcultas = true; mostrarOcultas(todas); });
    return;
  }
  const calc = lista.map((a) => ({ a, c: calcular(a) }));
  const conMedia = calc.filter((x) => x.c.media != null);
  const general = conMedia.length ? conMedia.reduce((s, x) => s + x.c.media, 0) / conMedia.length : null;
  const justa = [...conMedia].sort((x, y) => x.c.media - y.c.media)[0];
  const ultima = lista.flatMap((a) => a.items.filter((i) => !i.oculto && i.nota != null && i.publicada).map((i) => ({ a, i })))
    .sort((x, y) => new Date(y.i.publicada) - new Date(x.i.publicada))[0];
  const m = moodle();
  const resumen = [
    tarjeta({ titulo: 'Media del curso', icono: 'notas', color: 'rosa', contenido: `<div class="nt-resumen"><span class="nt-media grande">${general == null ? '—' : n1(general)}</span><span class="cifra-sub">${lista.length} ${lista.length === 1 ? 'asignatura' : 'asignaturas'}${m?.conectado ? ` · Moodle ${hace(m.ultima)}` : ''}</span></div>` }),
    tarjeta({ titulo: ultima && esNueva(ultima.i) ? 'Nota nueva' : 'Última nota', icono: 'campana', color: 'cielo', contenido: ultima
      ? `<div class="nt-ult"><span class="nt-nota ${tono(ultima.i.nota)}">${n1(ultima.i.nota)}</span><div><b>${esc(ultima.i.nombre)}</b><br><span class="cifra-sub">${esc(ultima.a.nombre)} · ${ultima.i.origen === 'moodle' ? 'publicada' : 'apuntada'} ${hace(ultima.i.publicada)}</span></div></div>`
      : '<p class="cifra-sub">Cuando salga una nota, aparecerá aquí.</p>' }),
    tarjeta({ titulo: 'La más justa', icono: 'progreso', color: 'melocoton', contenido: justa
      ? `<div class="nt-ult"><span class="nt-nota ${tono(justa.c.media)}">${n1(justa.c.media)}</span><div><b>${esc(justa.a.nombre)}</b><br><span class="cifra-sub">${textoNecesito(justa.a, 5)}</span></div></div>`
      : '<p class="cifra-sub">Aún no hay notas para comparar.</p>' }),
  ];
  el.innerHTML = rejilla(...resumen, ...calc.map(({ a, c }) => asignatura(a, c)))
    + `<div class="nt-pie-seccion">${ocultas ? `<button class="boton-ampliar" data-ver-ocultas>${ocultas} ${ocultas === 1 ? 'asignatura oculta' : 'asignaturas ocultas'}</button>` : ''}<button class="boton-ampliar" data-nueva-asig>+ Asignatura a mano</button></div><div id="nt-ocultas"></div>`;
  el.querySelectorAll('[data-asig]').forEach((b) => b.onclick = () => editarAsignatura(todas.find((a) => a.id === b.dataset.asig)));
  el.querySelectorAll('[data-item]').forEach((b) => b.onclick = () => {
    const [aid, iid] = b.dataset.item.split('|'); const a = todas.find((x) => x.id === aid);
    editarNota(a.items.find((i) => i.id === iid), a);
  });
  el.querySelector('[data-nueva-asig]').onclick = () => editarAsignatura(null);
  el.querySelector('[data-ver-ocultas]')?.addEventListener('click', () => { verOcultas = !verOcultas; mostrarOcultas(todas); });
  if (verOcultas) mostrarOcultas(todas);
}
function mostrarOcultas(todas) {
  const caja = el.querySelector('#nt-ocultas'); if (!caja) return;
  const oc = todas.filter((a) => a.oculta);
  caja.innerHTML = verOcultas && oc.length ? `<div class="nt-chips" style="margin-top:12px">${oc.map((a) => `<button class="chip-opcion" data-mostrar="${a.id}">${esc(a.nombre)} · mostrar</button>`).join('')}</div>` : '';
  caja.querySelectorAll('[data-mostrar]').forEach((b) => b.onclick = () => { ajusteAsig(b.dataset.mostrar, { oculta: false }); pintar(); });
}
function textoNecesito(a, objetivo) {
  const x = necesito(a, objetivo);
  if (x == null) return 'Todo corregido';
  if (x > 10) return `Un ${objetivo} ya no es posible`;
  return `Para un ${objetivo}: <b>${n1(Math.max(0, x))}</b> en lo que falta`;
}
function asignatura(a, c) {
  const grupos = Object.keys(TIPOS_NOTA).map((t) => {
    const del = a.items.filter((i) => i.tipo === t); if (!del.length) return '';
    const cuenta = del.filter((i) => !i.oculto);
    return `<div class="nt-grupo"><p class="nt-grupo-t"><span>${TIPOS_NOTA[t]}</span><span>${n0(cuenta.reduce((s, i) => s + (c.p.get(i) || 0), 0))} %</span></p>
      ${del.map((i) => `<button class="nt-fila${i.oculto ? ' nt-oculta' : ''}" data-item="${a.id}|${i.id}"><span class="nt-nom">${esc(i.nombre)}${esNueva(i) && i.nota != null && !i.oculto ? '<span class="nt-nueva">NUEVA</span>' : ''}</span><span class="nt-peso">${i.oculto ? 'no cuenta' : `${n0(c.p.get(i))} %`}</span><span class="nt-nota ${tono(i.nota)}">${i.nota == null ? 'Pend.' : n1(i.nota)}</span></button>`).join('')}</div>`;
  }).join('') || '<p class="cifra-sub" style="margin-top:12px">Sin notas todavía.</p>';
  return `<article class="tarjeta cristal ancho-mitad nt-asig">
    <button class="nt-asig-cab" data-asig="${a.id}"><h3><span class="nt-dot" style="background:var(--${a.color}-f)"></span>${esc(a.nombre)}</h3><span class="nt-media">${c.media == null ? '—' : n1(c.media)}</span></button>
    ${grupos}
    <div class="nt-barra"><i style="width:${Math.min(100, c.evaluado)}%;background:var(--${a.color}-f)"></i></div>
    <div class="nt-pie"><span>Evaluado <b>${n0(c.evaluado)} %</b></span><span>${textoNecesito(a, 7)}</span></div>
  </article>`;
}

/* ---------- Pestaña Porcentajes ---------- */
function porcentajes() {
  const lista = asignaturas();
  if (!lista.length) { notas(); return; }
  if (!lista.some((a) => a.id === sel)) sel = lista[0].id;
  const a = lista.find((x) => x.id === sel), c = calcular(a);
  const bloques = Object.keys(TIPOS_NOTA).filter((t) => a.items.some((i) => i.tipo === t && !i.oculto));
  const usados = bloques.length ? bloques : Object.keys(TIPOS_NOTA);
  const sumaCat = usados.reduce((s, t) => s + (a.cat[t] || 0), 0);
  const okSuma = (s) => Math.abs(s - 100) < 0.5 ? '<span class="nt-ok">Suma 100 % ✓</span>' : `<span class="nt-ko">Suma ${n0(s)} %</span>`;
  const objetivos = [5, 6, 7, 8, 9].map((o) => { const x = necesito(a, o); return `<span class="chip">${o} → ${x == null ? '—' : x > 10 ? '✕' : n1(Math.max(0, x))}</span>`; }).join('');
  el.innerHTML = `<div class="nt-chips nt-selector">${lista.map((x) => `<button class="chip-opcion ${x.id === sel ? 'activo' : ''}" data-sel="${x.id}">${esc(x.nombre)}</button>`).join('')}</div>` + rejilla(
    tarjeta({ titulo: 'Cuánto cuenta cada bloque', icono: 'ajustes', color: a.color, ancho: '2', extra: okSuma(sumaCat),
      contenido: usados.map((t) => `<div class="nt-rango"><label for="r-${t}">${TIPOS_NOTA[t]}</label><input id="r-${t}" type="range" min="0" max="100" step="5" value="${a.cat[t] || 0}" data-cat="${t}"><output>${a.cat[t] || 0} %</output></div>`).join('')
        + `<p class="cifra-sub" style="margin-top:4px">${usados.length > 1 ? 'Ponlo como diga la programación del módulo. Al mover uno, el otro se ajusta para que sume 100 %.' : `Esta asignatura solo tiene ${TIPOS_NOTA[usados[0]].toLowerCase()}, así que cuentan el 100 %.`}</p>` }),
    tarjeta({ titulo: 'Media con estos porcentajes', icono: 'notas', color: 'rosa',
      contenido: `<div class="nt-resumen"><span class="nt-media grande">${c.media == null ? '—' : n1(c.media)}</span><span class="cifra-sub">${esc(a.nombre)}</span></div>
        <div class="nt-barra"><i style="width:${Math.min(100, c.evaluado)}%;background:var(--${a.color}-f)"></i></div><p class="cifra-sub">Evaluado ${n0(c.evaluado)} %</p>
        <p class="nt-grupo-t" style="margin-top:14px"><span>¿Qué necesito para…?</span></p><div class="nt-obj">${objetivos}</div>` }),
    ...bloques.map((t) => {
      const del = a.items.filter((i) => i.tipo === t && !i.oculto);
      const suma = del.reduce((s, i) => s + pesoEnBloque(a, i), 0);
      const iguales = del.every((i) => i.peso == null);
      return tarjeta({ titulo: `Dentro de ${TIPOS_NOTA[t].toLowerCase()}`, icono: t === 'examen' ? 'tareas' : 'progreso', color: t === 'examen' ? 'rosa' : 'limon', ancho: 'mitad',
        extra: `${iguales ? '<span class="nt-ok">Todos igual</span>' : `${okSuma(suma)} <button class="boton-ampliar" data-igualar="${t}">Igualar</button>`}`,
        contenido: del.map((i) => `<div class="nt-pct"><span>${esc(i.nombre)}<br><small>${n0(c.p.get(i))} % de la nota final</small></span><input type="number" inputmode="decimal" min="0" max="100" step="any" value="${Math.round(pesoEnBloque(a, i) * 10) / 10}" data-peso="${i.id}" aria-label="Porcentaje de ${esc(i.nombre)}"><b>%</b></div>`).join('') });
    }),
  );
  el.querySelectorAll('[data-sel]').forEach((b) => b.onclick = () => { sel = b.dataset.sel; porcentajes(); });
  el.querySelectorAll('[data-cat]').forEach((r) => {
    r.oninput = () => {
      const t = r.dataset.cat, v = +r.value, cat = { ...a.cat, [t]: v };
      const otros = usados.filter((x) => x !== t);
      if (otros.length === 1) cat[otros[0]] = 100 - v;
      r.nextElementSibling.textContent = `${v} %`;
      if (otros.length === 1) { const o = el.querySelector(`[data-cat="${otros[0]}"]`); o.value = cat[otros[0]]; o.nextElementSibling.textContent = `${cat[otros[0]]} %`; }
      ajusteAsig(a.id, { cat });
    };
    r.onchange = () => porcentajes();
  });
  el.querySelectorAll('[data-peso]').forEach((inp) => inp.onchange = () => {
    // Al tocar uno, los demás del bloque quedan fijados con su valor actual
    const it = a.items.find((i) => i.id === inp.dataset.peso);
    a.items.filter((i) => i.tipo === it.tipo && !i.oculto && i.peso == null && i !== it).forEach((i) => ajusteItem(i.id, { peso: Math.round(pesoEnBloque(a, i) * 10) / 10 }));
    ajusteItem(it.id, { peso: Math.max(0, Math.min(100, parseFloat(String(inp.value).replace(',', '.')) || 0)) });
    porcentajes();
  });
  el.querySelectorAll('[data-igualar]').forEach((b) => b.onclick = () => { a.items.filter((i) => i.tipo === b.dataset.igualar).forEach((i) => ajusteItem(i.id, { peso: undefined })); porcentajes(); });
}

/* ---------- Hojas (paneles) ---------- */
function hoja(id, titulo, cuerpo) {
  let dlg = document.getElementById(id);
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.id = id; dlg.className = 'hoja cristal'; document.body.append(dlg);
    dlg.addEventListener('click', (x) => { if (x.target === dlg || x.target.closest('[data-cerrar]')) dlg.close(); });
  }
  dlg.innerHTML = `<div class="hoja-cabecera"><h2>${esc(titulo)}</h2><button class="cerrar" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button></div><div class="hoja-cuerpo">${cuerpo}</div>`;
  if (!dlg.open) dlg.showModal();
  return dlg;
}
const cerrarYPintar = (dlg) => { dlg.close(); if (el?.isConnected) pintar(); };

function abrirMoodle() {
  const m = moodle(), sesion = !!usuarioActual();
  const campus = (m?.sitio || 'https://campus.digitechfp.com').replace(/^https:\/\//, '');
  const cuerpo = !sesion ? '<p class="nota" style="margin-top:0"><b>Primero inicia sesión en Perfil.</b> Así tus notas quedan en tu cuenta y te llegan los avisos.</p>'
    : m?.conectado && m.error !== 'token' ? `
      <section class="grupo"><p class="grupo-titulo">${esc(m.nombre || 'Conectado')}</p>
        <p class="nota" style="margin-top:0">${esc(campus)} · ${(m.notas || []).length} notas · actualizado ${hace(m.ultima)}</p>
        <p class="nota">El servidor mira si hay notas nuevas cada 15 minutos y te avisa al móvil si tienes activadas las notificaciones. Tu contraseña no se guardó: solo se usó para pedir el permiso. Es de solo lectura.</p>
        <div class="botones" style="margin-top:12px"><button class="boton primario" data-sinc>Actualizar ahora</button><button class="boton peligro" data-desc>Desconectar</button></div>
      </section><p class="nota" data-msg></p>`
    : `${m?.error === 'token' ? '<p class="nota" style="margin-top:0"><b>El permiso de Moodle ha caducado</b> (por ejemplo, porque cambiaste la contraseña). Vuelve a conectar.</p>' : ''}
      <form class="form-evento" data-form autocomplete="on">
        <section class="grupo"><p class="grupo-titulo">Campus</p><input class="campo" name="sitio" value="${esc(campus)}" required></section>
        <section class="grupo"><p class="grupo-titulo">Usuario del campus</p><input class="campo" name="usuario" autocomplete="username" autocapitalize="off" spellcheck="false" required></section>
        <section class="grupo"><p class="grupo-titulo">Contraseña</p><input class="campo" name="contrasena" type="password" autocomplete="current-password" required>
          <p class="nota">Se usa una sola vez para pedir a Moodle un permiso de solo lectura, como hace la app oficial. No se guarda.</p></section>
        <div class="botones"><button class="boton primario" type="submit">Conectar</button></div>
        <p class="nota" data-msg></p>
      </form>`;
  const dlg = hoja('panel-moodle', 'Moodle', cuerpo);
  const msg = (t) => { const p = dlg.querySelector('[data-msg]'); if (p) p.textContent = t; };
  const form = dlg.querySelector('[data-form]');
  if (form) form.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(form), boton = form.querySelector('[type=submit]');
    boton.disabled = true; msg('Conectando con el campus…');
    try {
      const d = await conectarMoodle(String(f.get('usuario')), String(f.get('contrasena')), 'https://' + String(f.get('sitio')).trim().replace(/^https?:\/\//, ''));
      form.reset(); felicitar(`Moodle conectado · ${(d.notas || []).filter((n) => n.nota != null).length} notas`);
      cerrarYPintar(dlg);
    } catch (err) { msg(err.message); boton.disabled = false; }
  };
  dlg.querySelector('[data-sinc]')?.addEventListener('click', async (e) => {
    e.target.disabled = true; msg('Actualizando…');
    try { await sincronizarMoodle(true); cerrarYPintar(dlg); } catch (err) { msg(err.message); e.target.disabled = false; }
  });
  dlg.querySelector('[data-desc]')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { await desconectarMoodle(); cerrarYPintar(dlg); } catch (err) { msg(err.message); e.target.disabled = false; }
  });
}

function editarAsignatura(a) {
  const nueva = !a;
  const cuerpo = `<form class="form-evento" data-form>
    <section class="grupo"><p class="grupo-titulo">Nombre ${a?.origen === 'moodle' && a.nombre !== a.original ? `<small>En Moodle: ${esc(a.original)}</small>` : ''}</p><input class="campo" name="nombre" value="${esc(a?.nombre || '')}" placeholder="Por ejemplo, Acceso a Datos" required maxlength="80"></section>
    ${nueva ? '' : `<section class="grupo"><p class="grupo-titulo">Color</p><div class="nt-chips">${COLORES.map((c) => `<label class="nt-color"><input type="radio" name="color" value="${c}" ${a.color === c ? 'checked' : ''}><i style="background:var(--${c}-f)"></i></label>`).join('')}</div></section>`}
    <div class="botones"><button class="boton primario" type="submit">${nueva ? 'Crear' : 'Guardar'}</button>
      ${nueva ? '' : `<button class="boton" type="button" data-ocultar>${a.oculta ? 'Mostrar' : 'Ocultar'}</button>`}
      ${a?.origen === 'manual' ? '<button class="boton peligro" type="button" data-borrar>Borrar</button>' : ''}</div>
    ${a?.origen === 'moodle' ? '<p class="nota">Oculta las que no sean asignaturas (tutoría, secretaría…). Puedes volver a mostrarlas desde abajo del todo.</p>' : ''}
  </form>`;
  const dlg = hoja('panel-nota', nueva ? 'Nueva asignatura' : 'Asignatura', cuerpo);
  const form = dlg.querySelector('[data-form]');
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(form), nombre = String(f.get('nombre')).trim();
    if (nueva) { sel = crearAsignatura(nombre); }
    else ajusteAsig(a.id, { nombre: nombre === a.original ? undefined : nombre, color: f.get('color') || a.color });
    cerrarYPintar(dlg);
  };
  dlg.querySelector('[data-ocultar]')?.addEventListener('click', () => { ajusteAsig(a.id, { oculta: !a.oculta }); cerrarYPintar(dlg); });
  dlg.querySelector('[data-borrar]')?.addEventListener('click', () => { borrarAsignatura(a.id); cerrarYPintar(dlg); });
}

function editarNota(item, asig) {
  const lista = asignaturas();
  const manual = !item || item.origen === 'manual';
  if (!item && !lista.length) { editarAsignatura(null); return; }
  const actual = asig?.id || (lista.some((a) => a.id === sel) ? sel : lista[0].id);
  const tipo = item?.tipo || 'examen';
  const cuerpo = `<form class="form-evento" data-form>
    ${manual ? `<section class="grupo"><p class="grupo-titulo">Asignatura</p><select class="campo" name="asig">${lista.map((a) => `<option value="${a.id}" ${a.id === actual ? 'selected' : ''}>${esc(a.nombre)}</option>`).join('')}</select></section>` : `<p class="nota" style="margin-top:0">${esc(asig.nombre)} · viene de Moodle${item.texto ? ` (${esc(item.texto)})` : ''}</p>`}
    <section class="grupo"><p class="grupo-titulo">Nombre ${!manual && item.nombre !== item.original ? `<small>En Moodle: ${esc(item.original)}</small>` : ''}</p><input class="campo" name="nombre" value="${esc(item?.nombre || '')}" placeholder="Examen 1, Actividad 2…" required maxlength="80"></section>
    <section class="grupo"><p class="grupo-titulo">Cuenta como</p><div class="segmentado" data-tipo>${Object.keys(TIPOS_NOTA).map((t) => `<button type="button" data-valor="${t}" class="${t === tipo ? 'activo' : ''}">${t === 'examen' ? 'Examen' : 'Actividad'}</button>`).join('')}</div></section>
    ${manual ? `<section class="grupo"><p class="grupo-titulo">Nota <small>sobre 10 · vacío si está pendiente</small></p><input class="campo" name="nota" inputmode="decimal" value="${item?.nota != null ? String(item.nota).replace('.', ',') : ''}" placeholder="7,5"></section>` : ''}
    <div class="botones"><button class="boton primario" type="submit">Guardar</button>
      ${!item ? '' : manual ? '<button class="boton peligro" type="button" data-borrar>Borrar</button>' : `<button class="boton" type="button" data-ocultar>${item.oculto ? 'Mostrar' : 'No contar esta nota'}</button>`}</div>
    <p class="nota" data-msg></p>
  </form>`;
  const dlg = hoja('panel-nota', item ? 'Nota' : 'Añadir nota', cuerpo);
  const form = dlg.querySelector('[data-form]');
  let tipoSel = tipo;
  dlg.querySelectorAll('[data-tipo] button').forEach((b) => b.onclick = () => { tipoSel = b.dataset.valor; dlg.querySelectorAll('[data-tipo] button').forEach((x) => x.classList.toggle('activo', x === b)); });
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(form), nombre = String(f.get('nombre')).trim();
    if (manual) {
      const t = String(f.get('nota') || '').trim().replace(',', '.');
      const nota = t === '' ? null : parseFloat(t);
      if (t !== '' && (isNaN(nota) || nota < 0 || nota > 10)) { dlg.querySelector('[data-msg]').textContent = 'La nota tiene que ir de 0 a 10.'; return; }
      guardarNotaManual({ id: item?.id, asig: String(f.get('asig')), tipo: tipoSel, nombre, nota, fecha: item?.publicada });
      if (!item && nota != null) felicitar(nota >= 5 ? `¡Un ${String(nota).replace('.', ',')}!` : 'Apuntada');
    } else ajusteItem(item.id, { nombre: nombre === item.original ? undefined : nombre, tipo: tipoSel });
    cerrarYPintar(dlg);
  };
  dlg.querySelector('[data-borrar]')?.addEventListener('click', () => { borrarNotaManual(item.id); cerrarYPintar(dlg); });
  dlg.querySelector('[data-ocultar]')?.addEventListener('click', () => { ajusteItem(item.id, { oculto: !item.oculto }); cerrarYPintar(dlg); });
}
