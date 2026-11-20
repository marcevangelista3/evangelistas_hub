/* =========================================================
   PERSONALIZACIÓN
   Preferencias visuales guardadas en este dispositivo.
   ========================================================= */
import { hexAHsl, hslAHex, hexARgb, rgbAHex, rgbAHsl, limitar } from './color.js';
import { fondo } from './fondo.js';
import { reducirImagen, elegirImagen } from './imagenes.js';

const CLAVE = 'hub:ajustes';
const CLAVE_FOTO = 'hub:fondo-foto';
const PREDETERMINADOS = {
  modo: 'auto',
  acento: '#b9a8f0',
  fondo: 'estrellas',     // estrellas | animado | liso | foto
  bloqueo: true,          // pedir Touch ID / Face ID al entrar
  interactivo: true,
  velocidad: 1,
  fotoOpacidad: 100,
  fotoDesenfoque: 0,
  cristalOpacidad: 55,
  cristalDesenfoque: 24,
  fuente: 'predeterminada',
  movimiento: 'completo',
  texto: 'normal',
};

export const PRESETS = [
  ['Lavanda', '#b9a8f0'], ['Menta', '#9fdcbf'], ['Melocotón', '#f7c3a1'],
  ['Cielo', '#a8cdf0'], ['Rosa', '#f2b3cb'], ['Limón', '#efe09a'], ['Salvia', '#b7c9a8'],
];

let ajustes = cargar();
let fotoFondo = null;
try { fotoFondo = localStorage.getItem(CLAVE_FOTO); } catch {}

function cargar() {
  try {
    const a = { ...PREDETERMINADOS, ...JSON.parse(localStorage.getItem(CLAVE)) }; delete a.demo;
    // Una sola vez: el cielo estrellado pasa a ser el fondo de todos
    if (!a.cielo) { a.cielo = 1; a.fondo = 'estrellas'; }
    return a;
  }
  catch { return { ...PREDETERMINADOS }; }
}
function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(ajustes)); } catch {} }

const oscuroSistema = matchMedia('(prefers-color-scheme: dark)');
oscuroSistema.addEventListener('change', () => aplicar());

// Los datos de ejemplo se han quitado: la app solo muestra tus datos
export const modoDemo = () => false;
export function ponerDemo() {}
export const esOscuro = () => document.documentElement.dataset.modo === 'oscuro';

/* Calcula los tonos de acento y fondo a partir del color elegido.
   Los rellenos se mantienen pastel (sin colores chillones). */
function paleta(hex, oscuro) {
  const { h, s, l } = hexAHsl(hex) || { h: 256, s: 70, l: 80 };
  const sF = limitar(s, 20, 75);
  if (oscuro) {
    return {
      acento: `hsl(${h} ${limitar(s, 15, 35)}% 27%)`,
      acentoF: `hsl(${h} ${limitar(s, 30, 75)}% 84%)`,
      acentoM: `hsl(${h} ${limitar(s, 25, 45)}% 58%)`,
      manchas: [0, 50, -50, 160, 100].map((o) => hslAHex({ h: (h + o + 360) % 360, s: 38, l: 26 })),
      base: '#16151d', luz: 'rgba(255,255,255,0.10)',
    };
  }
  return {
    acento: `hsl(${h} ${sF}% ${limitar(l, 86, 93)}%)`,
    acentoF: `hsl(${h} ${limitar(s, 30, 55)}% 33%)`,
    acentoM: `hsl(${h} ${limitar(s, 30, 65)}% 70%)`,
    manchas: [0, 50, -50, 160, 100].map((o) => hslAHex({ h: (h + o + 360) % 360, s: Math.round(sF * 0.85), l: 86 })),
    base: '#f4f2f8', luz: 'rgba(255,255,255,0.75)',
  };
}

export function aplicar() {
  const raiz = document.documentElement;
  // El cielo estrellado es de noche: siempre con el modo oscuro
  const fondoEf = ajustes.fondo === 'foto' && !fotoFondo ? 'estrellas' : ajustes.fondo;
  const modo = fondoEf === 'estrellas' ? 'oscuro' : ajustes.modo === 'auto' ? (oscuroSistema.matches ? 'oscuro' : 'claro') : ajustes.modo;
  Object.assign(raiz.dataset, { modo, fondo: fondoEf, fuente: ajustes.fuente, movimiento: ajustes.movimiento, texto: ajustes.texto });

  const p = paleta(ajustes.acento, modo === 'oscuro');
  raiz.style.setProperty('--acento', p.acento);
  raiz.style.setProperty('--acento-f', p.acentoF);
  raiz.style.setProperty('--acento-m', p.acentoM);
  raiz.style.setProperty('--cristal-alfa', ajustes.cristalOpacidad / 100);
  raiz.style.setProperty('--desenfoque', ajustes.cristalDesenfoque + 'px');

  const foto = document.getElementById('fondo-foto');
  foto.style.backgroundImage = fotoFondo ? `url("${fotoFondo}")` : '';
  foto.style.opacity = ajustes.fotoOpacidad / 100;
  foto.style.filter = ajustes.fotoDesenfoque ? `blur(${ajustes.fotoDesenfoque}px)` : '';
  foto.style.inset = ajustes.fotoDesenfoque ? `-${ajustes.fotoDesenfoque * 2}px` : '0';

  fondo.configurar({
    colores: p.manchas, base: p.base, luz: p.luz,
    interactivo: ajustes.interactivo,
    velocidad: ajustes.movimiento === 'reducido' ? 0 : ajustes.velocidad,
    estilo: raiz.dataset.fondo === 'estrellas' ? 'estrellas' : 'manchas',
    activo: ['animado', 'estrellas'].includes(raiz.dataset.fondo) && ajustes.movimiento !== 'reducido',
  });

  const metaColor = document.querySelector('meta[name=theme-color]');
  if (metaColor) metaColor.content = fondoEf === 'estrellas' ? '#04050b' : modo === 'oscuro' ? '#16151d' : '#f4f2f8';
}

function cambiar(clave, valor) { ajustes[clave] = valor; guardar(); aplicar(); }
export const ajuste = (clave) => ajustes[clave];
export const cambiarAjuste = cambiar;

/* ---------- Panel ---------- */
const seg = (clave, opciones) => `<div class="segmentado" data-seg="${clave}">${opciones
  .map(([v, t]) => `<button type="button" data-valor="${v}" class="${String(ajustes[clave]) === v ? 'activo' : ''}">${t}</button>`).join('')}</div>`;

const rango = (clave, etiqueta, min, max, paso = 1, clase = '') =>
  `<div class="fila"><label for="r-${clave}">${etiqueta}</label><input id="r-${clave}" class="${clase}" type="range" min="${min}" max="${max}" step="${paso}" value="${ajustes[clave]}" data-rango="${clave}"></div>`;

export function pintarPanel() {
  const el = document.getElementById('ajustes-cuerpo');
  el.innerHTML = `
    <section class="grupo">
      <p class="grupo-titulo">Apariencia</p>
      ${seg('modo', [['claro', 'Claro'], ['oscuro', 'Oscuro'], ['auto', 'Automático']])}
      <p class="nota" data-solo="estrellas">Con el cielo estrellado la app usa siempre el modo oscuro.</p>
    </section>

    <section class="grupo">
      <p class="grupo-titulo">Color de acento <small id="acento-hex"></small></p>
      <div class="muestras">${PRESETS.map(([n, c]) =>
        `<button type="button" class="muestra" style="background:${c}" data-preset="${c}" aria-label="${n}" title="${n}"></button>`).join('')}</div>
      <label class="lienzo-color" id="lienzo-color"><input type="color" id="color-libre"><span>Elegir cualquier color</span></label>
      <div class="fila"><label for="h-tono">Tono</label><input id="h-tono" class="r-tono" type="range" min="0" max="360"></div>
      <div class="fila"><label for="h-sat">Saturación</label><input id="h-sat" type="range" min="0" max="100"></div>
      <div class="fila"><label for="h-luz">Luminosidad</label><input id="h-luz" type="range" min="0" max="100"></div>
      <div class="campos">
        <label>HEX<input id="c-hex" maxlength="7" spellcheck="false"></label>
        <label>R<input id="c-r" type="number" min="0" max="255"></label>
        <label>G<input id="c-g" type="number" min="0" max="255"></label>
        <label>B<input id="c-b" type="number" min="0" max="255"></label>
      </div>
      <p class="nota">La app suaviza el color para que los rellenos queden en tono pastel.</p>
    </section>

    <section class="grupo">
      <p class="grupo-titulo">Fondo</p>
      ${seg('fondo', [['estrellas', 'Estrellas'], ['animado', 'Manchas'], ['liso', 'Liso'], ['foto', 'Foto']])}
      <div data-solo="estrellas animado">
        <div class="fila"><span class="etiqueta">Reacciona al cursor</span>${seg('interactivo', [['true', 'Sí'], ['false', 'No']])}</div>
        ${rango('velocidad', 'Velocidad', 0.2, 3, 0.1)}
      </div>
      <div data-solo="foto">
        <div class="botones" style="margin-top:12px">
          <button type="button" class="boton" id="elegir-foto">Elegir foto</button>
          <button type="button" class="boton" id="quitar-foto">Quitar foto</button>
        </div>
        ${rango('fotoOpacidad', 'Opacidad', 10, 100)}
        ${rango('fotoDesenfoque', 'Desenfoque', 0, 30)}
      </div>
    </section>

    <section class="grupo" id="grupo-avisos">
      <p class="grupo-titulo">Notificaciones</p>
      <div data-avisos-cuerpo><p class="nota">Cargando…</p></div>
    </section>

    <section class="grupo" id="grupo-atajos">
      <p class="grupo-titulo">Siri y Salud (Atajos)</p>
      <div data-atajos-cuerpo><p class="nota">Cargando…</p></div>
    </section>

    <section class="grupo">
      <p class="grupo-titulo">Entrada a la app</p>
      <div class="fila"><span class="etiqueta">Pedir ${/iPhone|iPad/.test(navigator.userAgent) ? 'Face ID' : 'Touch ID'}</span>${seg('bloqueo', [['true', 'Sí'], ['false', 'No']])}</div>
      <p class="nota">Al abrir la app, o al volver tras 5 minutos fuera, se desbloquea con tu huella o tu cara. Es un candado de este dispositivo: tus datos siguen en tu cuenta.</p>
    </section>

    <section class="grupo">
      <p class="grupo-titulo">Tarjetas de cristal</p>
      ${rango('cristalOpacidad', 'Opacidad', 15, 90)}
      ${rango('cristalDesenfoque', 'Desenfoque', 0, 40)}
    </section>

    <section class="grupo">
      <p class="grupo-titulo">Tipografía</p>
      ${seg('fuente', [['predeterminada', 'Jakarta'], ['apple', 'Apple'], ['redondeada', 'Redondeada']])}
    </section>

    <section class="grupo">
      <p class="grupo-titulo">Movimiento</p>
      ${seg('movimiento', [['completo', 'Completo'], ['reducido', 'Reducido']])}
    </section>

    <section class="grupo">
      <p class="grupo-titulo">Tamaño del texto</p>
      ${seg('texto', [['normal', 'Normal'], ['grande', 'Grande']])}
    </section>

    <section class="grupo">
      <button type="button" class="boton ancho" id="restablecer">Restablecer el aspecto predeterminado</button>
    </section>`;

  // Botones segmentados
  el.querySelectorAll('[data-seg]').forEach((g) => g.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    g.querySelectorAll('button').forEach((x) => x.classList.toggle('activo', x === b));
    let v = b.dataset.valor;
    if (v === 'true' || v === 'false') v = v === 'true';
    cambiar(g.dataset.seg, v);
    if (g.dataset.seg === 'fondo') { mostrarSubgrupos(); if (v === 'foto' && !fotoFondo) pedirFoto(); }
  }));

  // Deslizadores
  el.querySelectorAll('[data-rango]').forEach((r) => r.addEventListener('input', () => cambiar(r.dataset.rango, Number(r.value))));

  // Color
  el.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => ponerColor(b.dataset.preset)));
  el.querySelector('#color-libre').addEventListener('input', (e) => ponerColor(e.target.value));
  ['h-tono', 'h-sat', 'h-luz'].forEach((id) => el.querySelector('#' + id).addEventListener('input', () => {
    ponerColor(hslAHex({ h: +el.querySelector('#h-tono').value, s: +el.querySelector('#h-sat').value, l: +el.querySelector('#h-luz').value }), 'hsl');
  }));
  el.querySelector('#c-hex').addEventListener('change', (e) => {
    const v = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value;
    if (hexARgb(v)) ponerColor(v.toLowerCase(), 'hex'); else sincronizarColor();
  });
  ['c-r', 'c-g', 'c-b'].forEach((id) => el.querySelector('#' + id).addEventListener('change', () => {
    const v = (k) => limitar(Number(el.querySelector('#c-' + k).value) || 0, 0, 255);
    ponerColor(rgbAHex({ r: v('r'), g: v('g'), b: v('b') }), 'rgb');
  }));

  el.querySelector('#elegir-foto').addEventListener('click', pedirFoto);
  el.querySelector('#quitar-foto').addEventListener('click', () => {
    fotoFondo = null; try { localStorage.removeItem(CLAVE_FOTO); } catch {}
    cambiar('fondo', 'estrellas'); pintarPanel();
  });
  el.querySelector('#restablecer').addEventListener('click', () => {
    ajustes = { ...PREDETERMINADOS, cielo: 1 }; guardar(); aplicar(); pintarPanel();
  });

  mostrarSubgrupos();
  sincronizarColor();
  pintarAvisos(el.querySelector('[data-avisos-cuerpo]'));
  pintarAtajos(el.querySelector('[data-atajos-cuerpo]'));
}

/* ---------- Atajos de Apple ---------- */
const URL_ATAJO = 'https://ypffurbjhsypgdpvtwlw.supabase.co/functions/v1/atajo';
async function invocarAtajo(cuerpo) {
  const { obtenerCliente, usuarioActual } = await import('./nube.js');
  if (!usuarioActual()) throw new Error('Inicia sesión en Perfil primero.');
  const { data, error } = await (await obtenerCliente()).functions.invoke('atajo', { body: cuerpo });
  if (error) throw new Error('No se ha podido hablar con el servidor.');
  return data;
}
async function pintarAtajos(caja, tokenNuevo = null) {
  let est = { tiene: false };
  try { est = await invocarAtajo({ accion: 'estado' }); } catch (e) { caja.innerHTML = `<p class="nota">${e.message}</p>`; return; }
  const copiar = (txt) => `<button type="button" class="boton" data-copiar="${txt}">Copiar</button>`;
  caja.innerHTML = `
    <p class="nota" style="margin-top:0">Con un Atajo de Apple puedes decir «Oye Siri, Elena» y dictarle lo que quieras apuntar, y pasar a Fitness tu peso, tus pasos y tus entrenos de Salud.</p>
    ${tokenNuevo ? `<div class="atajo-codigo"><p class="nota"><b>Tu código</b> (solo se enseña ahora; guárdalo en el Atajo):</p><code>${tokenNuevo}</code>${copiar(tokenNuevo)}</div>`
      : `<p class="nota">${est.tiene ? `Ya tienes un código creado${est.usado ? ' y en uso' : ''}. Si lo has perdido, crea otro (el anterior deja de funcionar).` : 'Primero crea tu código personal.'}</p>`}
    <div class="botones"><button type="button" class="boton ${est.tiene ? '' : 'primario'}" data-crear-token>${est.tiene ? 'Crear un código nuevo' : 'Crear mi código'}</button>${est.tiene ? '<button type="button" class="boton peligro" data-borrar-token>Desactivar</button>' : ''}</div>
    <details class="atajo-guia"><summary>Cómo crear el Atajo «Elena»</summary><ol>
      <li>Abre la app <b>Atajos</b>, pulsa <b>+</b> y llámalo <b>Elena</b> (así funciona «Oye Siri, Elena»).</li>
      <li>Añade <b>Dictar texto</b> (idioma: Español (España)).</li>
      <li>Añade <b>Obtener contenido de URL</b> con esta URL: <code>${URL_ATAJO}</code> ${copiar(URL_ATAJO)}<br>
        Método <b>POST</b>. En Cabeceras: <code>x-hub-token</code> = tu código. En Cuerpo de la solicitud elige <b>JSON</b> y añade: <code>accion</code> = <code>elena</code> y <code>texto</code> = la variable «Texto dictado».</li>
      <li>Añade <b>Obtener valor del diccionario</b>: clave <code>respuesta</code>.</li>
      <li>Añade <b>Leer texto</b> (o «Mostrar resultado») con ese valor.</li>
    </ol></details>
    <details class="atajo-guia"><summary>Cómo pasar tus datos de Salud cada noche</summary><ol>
      <li>En Atajos, ve a <b>Automatización → Nueva → Hora del día</b>, por ejemplo a las 23:00, y marca <b>Ejecutar inmediatamente</b>.</li>
      <li>Añade <b>Buscar muestras de salud</b>: Pasos, de hoy, agrupar por día. Luego <b>Calcular estadísticas</b>: suma.</li>
      <li>Añade <b>Buscar muestras de salud</b>: Peso, ordenar por fecha (más reciente primero), límite 1.</li>
      <li>Añade <b>Obtener contenido de URL</b> con la misma URL y cabecera, cuerpo JSON: <code>accion</code> = <code>salud</code>, <code>pasos</code> = la suma, <code>peso</code> = el peso.</li>
      <li>Si quieres, también los entrenos del reloj: <code>entreno</code> como diccionario con <code>nombre</code> y <code>minutos</code>.</li>
    </ol></details>
    <p class="nota" data-atajo-msg></p>`;
  caja.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copiar); b.textContent = 'Copiado'; setTimeout(() => { b.textContent = 'Copiar'; }, 1500); } catch {}
  }));
  caja.querySelector('[data-crear-token]').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { const { token } = await invocarAtajo({ accion: 'crear_token' }); pintarAtajos(caja, token); }
    catch (err) { e.target.disabled = false; caja.querySelector('[data-atajo-msg]').textContent = err.message; }
  });
  caja.querySelector('[data-borrar-token]')?.addEventListener('click', async (e) => { e.target.disabled = true; await invocarAtajo({ accion: 'borrar_token' }).catch(() => {}); pintarAtajos(caja); });
}

/* ---------- Notificaciones ---------- */
async function pintarAvisos(caja) {
  const A = await import('./avisos.js');
  const sop = A.soporte(), on = A.activadas(), P = A.preferencias();
  const interruptor = (clave, texto) => `<div class="fila"><span class="etiqueta">${texto}</span><div class="segmentado" data-aviso-pref="${clave}"><button type="button" data-v="true" class="${P[clave] ? 'activo' : ''}">Sí</button><button type="button" data-v="false" class="${P[clave] ? '' : 'activo'}">No</button></div></div>`;
  const hora = (clave, texto) => `<div class="fila"><label class="etiqueta" for="h-${clave}">${texto}</label><input class="campo" id="h-${clave}" type="time" value="${P[clave]}" data-aviso-hora="${clave}" style="max-width:130px"></div>`;
  caja.innerHTML = sop === 'instalar'
    ? '<p class="nota">En el iPhone las notificaciones solo funcionan con la app en la pantalla de inicio: en Safari pulsa Compartir → «Añadir a pantalla de inicio», abre la app desde ahí y vuelve aquí.</p>'
    : sop === 'no' ? '<p class="nota">Este navegador no admite notificaciones.</p>'
    : `<p class="nota" style="margin-top:0">${on ? 'Activadas en este dispositivo.' : 'Recibe avisos de exámenes, entregas y recordatorios aunque la app esté cerrada. Hay que activarlas en cada dispositivo.'}</p>
      <div class="botones">${on ? '<button type="button" class="boton" data-probar-aviso>Enviar una de prueba</button><button type="button" class="boton" data-desactivar-aviso>Desactivar aquí</button>' : '<button type="button" class="boton primario" data-activar-aviso>Activar en este dispositivo</button>'}</div>
      <div ${on ? '' : 'hidden'}>
        ${interruptor('resumen', 'Resumen del día')}${hora('resumenHora', 'Hora del resumen')}
        ${interruptor('vispera', 'Exámenes y entregas la víspera')}${hora('visperaHora', 'Hora del aviso de víspera')}
        ${interruptor('eventos', 'Avisos de cada evento')}
        <p class="nota">Los avisos de cada evento salen con la antelación que elijas al crearlo en Calendario.</p>
      </div>
      <p class="nota" data-aviso-msg></p>`;
  const msg = (t) => { const m = caja.querySelector('[data-aviso-msg]'); if (m) m.textContent = t; };
  const ocupado = (b, t) => { b.disabled = true; b.textContent = t; };
  caja.querySelector('[data-activar-aviso]')?.addEventListener('click', async (e) => {
    ocupado(e.target, 'Activando…');
    try { await A.activar(); pintarAvisos(caja); } catch (err) { e.target.disabled = false; e.target.textContent = 'Activar en este dispositivo'; msg(err.message); }
  });
  caja.querySelector('[data-desactivar-aviso]')?.addEventListener('click', async (e) => { ocupado(e.target, 'Desactivando…'); await A.desactivar().catch(() => {}); pintarAvisos(caja); });
  caja.querySelector('[data-probar-aviso]')?.addEventListener('click', async (e) => {
    ocupado(e.target, 'Enviando…');
    try { const r = await A.probar(); msg(r.enviados ? 'Enviada. Debería llegarte en unos segundos.' : 'No hay ningún dispositivo activado.'); }
    catch (err) { msg(err.message); }
    e.target.disabled = false; e.target.textContent = 'Enviar una de prueba';
  });
  caja.querySelectorAll('[data-aviso-pref]').forEach((g) => g.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    g.querySelectorAll('button').forEach((x) => x.classList.toggle('activo', x === b));
    A.guardarPreferencias({ [g.dataset.avisoPref]: b.dataset.v === 'true' });
  }));
  caja.querySelectorAll('[data-aviso-hora]').forEach((i) => i.addEventListener('change', () => { if (i.value) A.guardarPreferencias({ [i.dataset.avisoHora]: i.value }); }));
}

function mostrarSubgrupos() {
  document.querySelectorAll('#ajustes-cuerpo [data-solo]').forEach((d) => { d.hidden = !d.dataset.solo.split(' ').includes(ajustes.fondo); });
}

// origen: qué control ha cambiado (para no pisar lo que el usuario está moviendo)
function ponerColor(hex, origen) {
  cambiar('acento', hex);
  sincronizarColor(origen);
}

function sincronizarColor(origen) {
  const el = document.getElementById('ajustes-cuerpo');
  if (!el) return;
  const hex = ajustes.acento;
  const rgb = hexARgb(hex); const hsl = rgbAHsl(rgb);
  el.querySelector('#acento-hex').textContent = hex.toUpperCase();
  el.querySelector('#color-libre').value = hex;
  el.querySelector('#lienzo-color').style.background =
    `linear-gradient(90deg, ${hex}, ${hslAHex({ ...hsl, l: Math.min(95, hsl.l + 12) })})`;
  el.querySelector('#lienzo-color span').style.color = hsl.l > 60 ? '#232131' : '#ffffff';
  if (origen !== 'hsl') {
    el.querySelector('#h-tono').value = hsl.h; el.querySelector('#h-sat').value = hsl.s; el.querySelector('#h-luz').value = hsl.l;
  }
  el.querySelector('#h-sat').style.background = `linear-gradient(90deg, hsl(${hsl.h} 0% ${hsl.l}%), hsl(${hsl.h} 100% ${hsl.l}%))`;
  el.querySelector('#h-luz').style.background = `linear-gradient(90deg, #000, hsl(${hsl.h} ${hsl.s}% 50%), #fff)`;
  if (origen !== 'hex') el.querySelector('#c-hex').value = hex.toUpperCase();
  if (origen !== 'rgb') { el.querySelector('#c-r').value = rgb.r; el.querySelector('#c-g').value = rgb.g; el.querySelector('#c-b').value = rgb.b; }
  el.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('activo', b.dataset.preset === hex));
}

async function pedirFoto() {
  const archivo = await elegirImagen();
  if (!archivo) return;
  try {
    fotoFondo = await reducirImagen(archivo, { lado: 1920 });
    localStorage.setItem(CLAVE_FOTO, fotoFondo);
  } catch {
    alert('No se ha podido guardar esa foto. Prueba con otra más pequeña.');
    return;
  }
  cambiar('fondo', 'foto');
  pintarPanel();
}
