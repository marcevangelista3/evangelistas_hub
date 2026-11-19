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
  fondo: 'animado',       // animado | liso | foto
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
  try { const a = { ...PREDETERMINADOS, ...JSON.parse(localStorage.getItem(CLAVE)) }; delete a.demo; return a; }
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
  const modo = ajustes.modo === 'auto' ? (oscuroSistema.matches ? 'oscuro' : 'claro') : ajustes.modo;
  Object.assign(raiz.dataset, { modo, fondo: ajustes.fondo, fuente: ajustes.fuente, movimiento: ajustes.movimiento, texto: ajustes.texto });
  if (ajustes.fondo === 'foto' && !fotoFondo) raiz.dataset.fondo = 'animado';

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
    activo: raiz.dataset.fondo === 'animado' && ajustes.movimiento !== 'reducido',
  });

  const metaColor = document.querySelector('meta[name=theme-color]');
  if (metaColor) metaColor.content = modo === 'oscuro' ? '#16151d' : '#f4f2f8';
}

function cambiar(clave, valor) { ajustes[clave] = valor; guardar(); aplicar(); }

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
      ${seg('fondo', [['animado', 'Animado'], ['liso', 'Liso'], ['foto', 'Foto']])}
      <div data-solo="animado">
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
    cambiar('fondo', 'animado'); pintarPanel();
  });
  el.querySelector('#restablecer').addEventListener('click', () => {
    ajustes = { ...PREDETERMINADOS }; guardar(); aplicar(); pintarPanel();
  });

  mostrarSubgrupos();
  sincronizarColor();
}

function mostrarSubgrupos() {
  document.querySelectorAll('#ajustes-cuerpo [data-solo]').forEach((d) => { d.hidden = d.dataset.solo !== ajustes.fondo; });
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
