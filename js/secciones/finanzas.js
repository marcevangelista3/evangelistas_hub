import { tarjeta, rejilla, esc } from '../ui.js';
import { icono } from '../iconos.js';
import { objetivos } from '../registro.js';
import { leerArchivo, detectar, convertir, guardarMovimientos, movimientosGuardados, bajarMovimientos } from '../importar.js';
import { usuarioActual } from '../nube.js';
import { celebrar, felicitar } from '../celebrar.js';
import { estadoGuardado, hayBancos, saldoTotal, diasPermiso, estadoBancos, conectarBanco, desconectarBanco, sincronizarBancos } from '../bancos.js';
import { contador, barras, donut, barraProgreso, animarNumeros } from '../graficos.js';
import { MESES, MESES_LARGOS, CATEGORIAS, resumenMes, recomendaciones, usarMovimientos } from '../finanzas-datos.js';

const eur = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fFecha = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const ULT = MESES.length - 1;
let mesSel = ULT, ampliado = false, catAbierta = null, el;

export function render(sub, contenedor) {
  el = contenedor;
  pintarAcciones();
  mesSel = ULT; ampliado = false; catAbierta = null;
  const pintarReales = (lista, primera) => {
    if (!lista.length) {
      el.innerHTML = rejilla(tarjeta({ titulo: 'Aún no hay movimientos', icono: 'finanzas', color: 'melocoton', ancho: 'full',
        contenido: `<p class="cifra-sub" style="max-width:56ch">Descarga el extracto de Revolut (CSV) o de BBVA (Excel o CSV) e impórtalo. Se clasifica solo y, si has iniciado sesión, aparecerá también en tu otro dispositivo.</p>
          <div class="botones" style="margin-top:14px"><button class="boton primario" data-importar>Importar extracto</button><button class="boton" data-bancos>Conectar bancos</button></div>` }));
      el.querySelector('[data-importar]').onclick = abrirImportar;
      el.querySelector('[data-bancos]').onclick = abrirBancos;
      return;
    }
    usarMovimientos(lista); pintar(primera);
  };
  const locales = movimientosGuardados();
  pintarReales(locales, true);
  if (usuarioActual()) bajarMovimientos().then((l) => { if (l.length !== locales.length && el.isConnected) pintarReales(l, false); }).catch(() => {});
  // Bancos conectados: trae lo nuevo sin bloquear (el servidor lo limita a una vez cada 4 horas)
  if (usuarioActual() && hayBancos()) sincronizarBancos().then(async (r) => {
    if (el.isConnected) pintarAcciones();
    if (r.nuevos) { const l = await bajarMovimientos(); if (el.isConnected && !document.querySelector('dialog[open]')) pintarReales(l, false); }
  }).catch(() => {});
}

function pintarAcciones() {
  const dias = diasPermiso();
  const txt = !hayBancos() ? 'Conectar bancos' : dias !== null && dias <= 7 ? `⚠︎ Bancos · renovar en ${Math.max(0, dias)} d` : `● Bancos · ${eur(saldoTotal())}`;
  document.getElementById('acciones-pagina').innerHTML = `<button class="boton" id="boton-bancos">${txt}</button><button class="boton primario" id="importar-extracto">${icono('finanzas')} Importar extracto</button>`;
  document.getElementById('importar-extracto').onclick = abrirImportar;
  document.getElementById('boton-bancos').onclick = abrirBancos;
}

/* ---------- Bancos conectados ---------- */
const fDia = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });
const fHora = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
async function abrirBancos() {
  let dlg = document.getElementById('panel-bancos');
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.id = 'panel-bancos'; dlg.className = 'hoja cristal'; document.body.append(dlg);
    dlg.addEventListener('click', (x) => { if (x.target === dlg || x.target.closest('[data-cerrar]')) dlg.close(); });
  }
  const pintarPanel = (d, msgTxt = '') => {
    const sesion = !!usuarioActual(), lista = d?.bancos || [];
    const tiene = (b) => lista.some((x) => x.banco === b);
    dlg.innerHTML = `<div class="hoja-cabecera"><h2>Bancos</h2><button class="cerrar" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button></div>
      <div class="hoja-cuerpo">
        ${!sesion ? '<p class="nota" style="margin-top:0"><b>Primero inicia sesión en Perfil.</b></p>'
        : d && !d.configurado ? '<p class="nota" style="margin-top:0">Falta guardar la clave de Enable Banking en Supabase (Edge Functions → Secrets). Cuando esté, aquí podrás conectar Revolut y BBVA.</p>'
        : `<p class="nota" style="margin-top:0">Los movimientos llegan solos al abrir Finanzas (como mucho cada 4 horas) y se clasifican igual que los importados. Es de solo lectura: la app no puede mover dinero. Los bancos piden renovar el permiso cada 90 días.</p>
        ${lista.map((b) => {
          const dias = Math.floor((new Date(b.valido_hasta) - Date.now()) / 86400000);
          return `<section class="grupo banco-fila">
            <p class="grupo-titulo">${esc(b.banco)}</p>
            ${(b.saldos || []).map((s) => `<div class="fila-saldo"><span>${esc(s.nombre || s.iban || 'Cuenta')}</span><b>${s.importe.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${s.moneda === 'EUR' ? '€' : esc(s.moneda)}</b></div>`).join('') || `<p class="nota">${b.cuentas} ${b.cuentas === 1 ? 'cuenta' : 'cuentas'}</p>`}
            <p class="nota">${dias < 0 ? '<b>El permiso ha caducado.</b>' : `Permiso hasta el ${fDia.format(new Date(b.valido_hasta))}${dias <= 7 ? ' · <b>renuévalo pronto</b>' : ''}`}${b.ultima ? ` · actualizado ${fHora.format(new Date(b.ultima))}` : ''}</p>
            <div class="botones">${dias <= 7 ? `<button class="boton primario" data-con="${b.banco === 'BBVA' ? 'bbva' : 'revolut'}">Renovar</button>` : ''}<button class="boton peligro" data-desc="${b.id}">Desconectar</button></div>
          </section>`;
        }).join('')}
        <div class="botones" style="margin-top:12px">
          ${lista.length ? '<button class="boton" data-sinc>Actualizar ahora</button>' : ''}
          ${tiene('Revolut') ? '' : '<button class="boton primario" data-con="revolut">Conectar Revolut</button>'}
          ${tiene('BBVA') ? '' : '<button class="boton primario" data-con="bbva">Conectar BBVA</button>'}
        </div>`}
        <p class="nota" data-msg>${esc(msgTxt)}</p>
      </div>`;
    const msg = dlg.querySelector('[data-msg]');
    const ocupado = (b, t) => { b.disabled = true; b.dataset.txt = b.textContent; b.textContent = t; };
    const libre = (b) => { b.disabled = false; b.textContent = b.dataset.txt; };
    dlg.querySelectorAll('[data-con]').forEach((b) => b.onclick = async () => { ocupado(b, 'Abriendo el banco…'); try { await conectarBanco(b.dataset.con); } catch (e) { msg.textContent = e.message; libre(b); } });
    dlg.querySelectorAll('[data-desc]').forEach((b) => b.onclick = async () => { ocupado(b, 'Desconectando…'); try { pintarPanel(await desconectarBanco(b.dataset.desc)); pintarAcciones(); } catch (e) { msg.textContent = e.message; libre(b); } });
    dlg.querySelector('[data-sinc]')?.addEventListener('click', async (ev) => {
      ocupado(ev.target, 'Actualizando…');
      try {
        const r = await sincronizarBancos(true);
        const l = await bajarMovimientos(); usarMovimientos(l);
        pintarPanel(estadoGuardado(), r.errores?.length ? r.errores.join(' ') : r.nuevos ? '' : 'No hay movimientos nuevos.');
        if (r.nuevos) { felicitar(`${r.nuevos} movimientos nuevos`); render(null, el); }
        else pintarAcciones();
      } catch (e) { msg.textContent = e.message; libre(ev.target); }
    });
  };
  pintarPanel(estadoGuardado());
  dlg.showModal();
  if (usuarioActual()) estadoBancos().then((d) => { if (dlg.open) pintarPanel(d); pintarAcciones(); }).catch((e) => { if (dlg.open) dlg.querySelector('[data-msg]').textContent = e.message; });
}

/* ---------- Importar extracto ---------- */
function abrirImportar() {
  let dlg = document.getElementById('panel-importar');
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.id = 'panel-importar'; dlg.className = 'hoja cristal'; document.body.append(dlg);
    dlg.addEventListener('click', (x) => { if (x.target === dlg || x.target.closest('[data-cerrar]')) dlg.close(); });
  }
  dlg.innerHTML = `<div class="hoja-cabecera"><h2>Importar extracto</h2><button class="cerrar" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button></div>
    <div class="hoja-cuerpo">
      <section class="grupo"><p class="grupo-titulo">Revolut</p><p class="nota" style="margin-top:0">App › Cuenta › ··· › Extracto › Excel (CSV) › elige el periodo.</p></section>
      <section class="grupo"><p class="grupo-titulo">BBVA</p><p class="nota" style="margin-top:0">Web › tu cuenta › Movimientos › filtra fechas › Descargar en Excel.</p></section>
      <section class="grupo"><label class="boton ancho primario" style="cursor:pointer">Elegir archivo<input type="file" accept=".csv,.xlsx,.xls,text/csv" hidden data-archivo></label></section>
      <div data-vista-previa></div>
      <p class="nota">Si importas dos veces el mismo periodo no se duplica nada. ${usuarioActual() ? 'Se guardará en tu cuenta.' : 'Inicia sesión en Perfil para tenerlo también en el otro dispositivo.'}</p>
    </div>`;
  const prev = dlg.querySelector('[data-vista-previa]');
  dlg.querySelector('[data-archivo]').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    prev.innerHTML = '<p class="nota">Leyendo…</p>';
    try {
      const filas = await leerArchivo(f);
      const det = detectar(filas);
      if (!det) throw new Error('No encuentro las columnas de fecha, concepto e importe en este archivo.');
      const movs = convertir(filas, det);
      if (!movs.length) throw new Error('El archivo no tiene movimientos completados.');
      const fechas = movs.map((m) => +m.fecha);
      const ing = movs.filter((m) => m.importe > 0).reduce((a, m) => a + m.importe, 0);
      const gas = -movs.filter((m) => m.importe < 0).reduce((a, m) => a + m.importe, 0);
      prev.innerHTML = `<section class="grupo">
          <p class="grupo-titulo">${det.banco} · ${movs.length} movimientos</p>
          <p class="nota" style="margin-top:0">Del ${fFecha.format(Math.min(...fechas))} al ${fFecha.format(Math.max(...fechas))}. Ingresos ${eur(ing)} · Gastos ${eur(gas)}</p>
          <ul class="lista-d" style="margin-top:8px">${movs.slice(0, 5).map((m) => `<li><div class="principal"><strong>${esc(m.concepto)}</strong><small>${CATEGORIAS[m.cat].nombre} · ${fFecha.format(m.fecha)}</small></div><div class="lado"><b class="${m.importe > 0 ? 'sube' : ''}">${eur(m.importe)}</b></div></li>`).join('')}</ul>
          <button class="boton primario ancho" data-confirmar style="margin-top:10px">Importar ${movs.length} movimientos</button></section>`;
      prev.querySelector('[data-confirmar]').onclick = async (ev) => {
        ev.target.disabled = true; ev.target.textContent = 'Guardando…';
        try {
          const n = await guardarMovimientos(movs);
          if (n) celebrar(prev, 'medio');
          prev.innerHTML = `<p class="nota"><b>${n} movimientos nuevos importados</b>${movs.length - n ? ` (${movs.length - n} ya estaban)` : ''}.</p>`;
          setTimeout(() => { dlg.close(); dispatchEvent(new Event('hub:recargar')); }, 900);
        } catch (err) { prev.innerHTML = `<p class="nota">No se ha podido guardar: ${esc(err.message)}</p>`; }
      };
    } catch (err) { prev.innerHTML = `<p class="nota">${esc(err.message)}</p>`; }
  };
  dlg.showModal();
}

// Transición suave entre estados (si el navegador la soporta)
function transicion(fn) {
  if (document.startViewTransition && document.documentElement.dataset.movimiento !== 'reducido') document.startViewTransition(fn);
  else fn();
}

function pintar(primera = false) {
  const R = resumenMes(mesSel);
  const esActual = mesSel === ULT;
  const nombreMes = MESES_LARGOS[mesSel];
  const media = MESES.slice(0, -1).map((_, i) => resumenMes(i).gastos).reduce((a, b) => a + b, 0) / ULT;

  const balance = `
    <div class="fila-cifras tres">
      <div><div class="cifra">${contador(R.ahorro, { dec: 2, suf: ' €' })}</div><p class="cifra-sub">${esActual ? 'Disponible' : 'Ahorrado'}</p></div>
      <div><div class="cifra sube">${contador(R.ingresos, { dec: 2, suf: ' €' })}</div><p class="cifra-sub">Ingresos</p></div>
      <div><div class="cifra baja">${contador(R.gastos, { dec: 2, suf: ' €' })}</div><p class="cifra-sub">Gastos</p></div>
    </div>
    <p class="cifra-sub" style="margin-top:8px">Gastos por mes · media ${eur(media)} · pulsa un mes para verlo</p>
    ${barras(MESES.map((_, i) => Math.round(resumenMes(i).gastos)), MESES, { destacar: mesSel, color: 'var(--melocoton-f)', sufijo: ' €', clicable: true })}`;

  const tot = R.categorias.reduce((a, c) => a + c.valor, 0);
  const categoriasHTML = ampliado ? `
    <div class="cat-ampliada">
      <div class="cat-donut-grande">${donut(R.categorias, eur(tot), `en ${nombreMes}`).replace('<ul class="g-leyenda">', '<ul class="g-leyenda" hidden>')}</div>
      <ul class="cat-lista">${R.categorias.map((c, j) => {
        const movs = R.movimientos.filter((x) => x.cat === c.id);
        return `<li class="${catAbierta === c.id ? 'abierta' : ''}" style="--j:${j}">
          <button type="button" class="cat-fila" data-cat="${c.id}"><i style="background:${c.color}"></i><span>${c.nombre}</span><small>${movs.length} mov. · ${Math.round((c.valor / tot) * 100)} %</small><b>${eur(c.valor)}</b><span class="flecha-c">›</span></button>
          <div class="cat-movs">${movs.map((x) => `<div><span>${esc(x.concepto)}</span><small>${fFecha.format(x.fecha)}</small><b>${eur(-x.importe)}</b></div>`).join('')}
            <div class="cat-suma"><span>Total</span><b>${eur(c.valor)}</b></div></div>
        </li>`;
      }).join('')}</ul>
    </div>` : donut(R.categorias.slice(0, 6), eur(tot), `en ${nombreMes}`);

  const meta = objetivos().ahorroMes;
  const acumulado = MESES.reduce((a, _, i) => a + (i <= mesSel ? resumenMes(i).ahorro : 0), 0);
  const ahorro = `
    <div><div class="cifra">${contador(acumulado, { dec: 2, suf: ' €' })}</div><p class="cifra-sub">ahorrados en estos meses hasta ${nombreMes}</p></div>
    ${barraProgreso(`Objetivo de ${nombreMes}`, Math.max(0, Math.round(R.ahorro)), meta, { color: 'var(--menta-f)', unidad: '€' })}
    ${barras(MESES.map((_, i) => Math.round(resumenMes(i).ahorro)), MESES, { destacar: mesSel, color: 'var(--menta-f)', sufijo: ' €' })}`;

  const movs = R.movimientos.slice(0, 6);
  const movimientos = `<ul class="lista-d">${movs.map((m, j) => `
    <li style="--j:${j}"><span class="avatar-mini" style="background:color-mix(in srgb, ${CATEGORIAS[m.cat].color} 18%, transparent);color:${CATEGORIAS[m.cat].color}">${m.concepto[0]}</span>
      <div class="principal"><strong>${esc(m.concepto)}</strong><small>${CATEGORIAS[m.cat].nombre} · ${fFecha.format(m.fecha)}</small></div>
      <div class="lado"><b class="${m.importe > 0 ? 'sube' : ''}">${m.importe > 0 ? '+' : ''}${eur(m.importe)}</b></div></li>`).join('')}</ul>
    <div class="tarjeta-pie"><span>${R.movimientos.length} movimientos en ${nombreMes}</span><span>Importados de tus bancos</span></div>`;

  const recos = `<ul class="lista-d">${recomendaciones().map((r, j) => `
    <li style="--j:${j}"><span class="tarjeta-icono c-lavanda" style="width:32px;height:32px">${icono('chispa')}</span>
      <div class="principal"><small style="white-space:normal;color:var(--texto);font-size:.88rem">${r}</small></div></li>`).join('')}</ul>
    ${esActual ? '' : '<p class="metodo">Las recomendaciones son siempre del mes en curso.</p>'}`;

  const volver = esActual ? '' : `<button type="button" class="enlace boton-volver" style="border:0;background:none;cursor:pointer">Volver a ${MESES_LARGOS[ULT]}</button>`;
  const botonCat = `<button type="button" class="boton-ampliar" aria-label="${ampliado ? 'Reducir' : 'Ampliar'}">${ampliado ? 'Reducir' : 'Ampliar'}</button>`;

  el.innerHTML = rejilla(
    tarjeta({ titulo: `Balance de ${nombreMes}`, icono: 'finanzas', color: 'melocoton', ancho: ampliado ? 'mitad' : '2', contenido: balance, extra: volver, clase: 'vt-balance' }),
    tarjeta({ titulo: 'Gastos por categoría', icono: 'grafico', color: 'rosa', ancho: ampliado ? '3' : '', contenido: categoriasHTML, extra: botonCat, clase: `vt-categorias ${ampliado ? 'ampliada' : 'ampliable'}` }),
    tarjeta({ titulo: 'Ahorro', extra: '<button type="button" class="enlace boton-objetivos">Objetivo</button>', icono: 'hucha', color: 'menta', ancho: ampliado ? 'mitad' : '', contenido: ahorro, clase: 'vt-ahorro' }),
    tarjeta({ titulo: 'Últimos movimientos', icono: 'reloj', color: 'cielo', ancho: ampliado ? 'mitad' : '', contenido: movimientos, clase: 'vt-movs' }),
    tarjeta({ titulo: 'Recomendaciones', icono: 'chispa', color: 'lavanda', ancho: ampliado ? 'mitad' : '', contenido: recos, clase: 'vt-recos' }),
  );
  if (!primera) el.querySelector('.rejilla').classList.add('sin-entrada');
  animarNumeros(el, primera ? 250 : 0);
  conectar();
}

function conectar() {
  el.querySelector('.boton-objetivos')?.addEventListener('click', async () => (await import('./fitness.js')).abrirObjetivos());
  el.querySelectorAll('.g-col.clicable').forEach((c) => c.onclick = () => { if (+c.dataset.i !== mesSel) { mesSel = +c.dataset.i; catAbierta = null; transicion(() => pintar()); } });
  el.querySelector('.boton-volver')?.addEventListener('click', () => { mesSel = ULT; transicion(() => pintar()); });
  const cat = el.querySelector('.vt-categorias');
  const alternar = () => { ampliado = !ampliado; catAbierta = null; transicion(() => pintar()); if (ampliado) setTimeout(() => el.querySelector('.vt-categorias')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350); };
  el.querySelector('.boton-ampliar').onclick = (e) => { e.stopPropagation(); alternar(); };
  if (!ampliado) cat.onclick = alternar;
  el.querySelectorAll('[data-cat]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    catAbierta = catAbierta === b.dataset.cat ? null : b.dataset.cat;
    el.querySelectorAll('.cat-lista li').forEach((li) => li.classList.toggle('abierta', li.querySelector('[data-cat]').dataset.cat === catAbierta));
  });
}
