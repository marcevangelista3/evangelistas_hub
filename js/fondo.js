/* =========================================================
   FONDO ANIMADO
   Manchas de color pastel que flotan despacio. Se apartan del
   cursor, una luz suave lo sigue y al hacer clic sale una onda.
   ========================================================= */

const cv = document.getElementById('fondo');
const ctx = cv.getContext('2d');
const reducido = matchMedia('(prefers-reduced-motion: reduce)');

let W = 0, H = 0, escala = 0.5;
let colores = ['#d9d1f5', '#fbdcc8', '#cdeedd', '#cfe4f7', '#f6d3e1'];
let base = '#f4f2f8';
let luz = 'rgba(255,255,255,0.6)';
let opciones = { interactivo: true, velocidad: 1, activo: true };

// Posición base, tamaño y ritmo de cada mancha (proporciones de pantalla)
const manchas = [
  { x: 0.15, y: 0.18, r: 0.55, f: 0.0, v: 0.11 },
  { x: 0.85, y: 0.12, r: 0.50, f: 1.7, v: 0.09 },
  { x: 0.30, y: 0.90, r: 0.60, f: 3.1, v: 0.10 },
  { x: 0.90, y: 0.85, r: 0.55, f: 4.4, v: 0.08 },
  { x: 0.55, y: 0.45, r: 0.40, f: 5.2, v: 0.12 },
].map((m) => ({ ...m, dx: 0, dy: 0 }));

const puntero = { x: 0.5, y: 0.4, tx: 0.5, ty: 0.4, dentro: false };
const ondas = [];

function redimensionar() {
  escala = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
  W = cv.width = Math.round(innerWidth * escala);
  H = cv.height = Math.round(innerHeight * escala);
  if (!animando) dibujar(performance.now());
}

function mancha(x, y, r, color, alfa = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexAlfa(color, alfa));
  g.addColorStop(1, hexAlfa(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function hexAlfa(c, a) {
  if (c.startsWith('rgba')) return c.replace(/[\d.]+\)$/, a + ')');
  if (c.startsWith('hsl')) return c.replace(')', ` / ${a})`).replace(/,/g, ' ');
  const n = parseInt(c.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function dibujar(ahora) {
  const t = (ahora / 1000) * opciones.velocidad;
  const D = Math.max(W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Suavizado del puntero
  puntero.x += (puntero.tx - puntero.x) * 0.06;
  puntero.y += (puntero.ty - puntero.y) * 0.06;

  manchas.forEach((m, i) => {
    let x = m.x + Math.sin(t * m.v * 2 + m.f) * 0.09;
    let y = m.y + Math.cos(t * m.v * 1.6 + m.f) * 0.09;

    // Se apartan del cursor
    let ox = 0, oy = 0;
    if (opciones.interactivo && puntero.dentro) {
      const ddx = x - puntero.x, ddy = y - puntero.y;
      const d = Math.hypot(ddx, ddy) || 1;
      const fuerza = Math.max(0, 1 - d / 0.45) * 0.12;
      ox = (ddx / d) * fuerza; oy = (ddy / d) * fuerza;
    }
    m.dx += (ox - m.dx) * 0.05;
    m.dy += (oy - m.dy) * 0.05;

    mancha((x + m.dx) * W, (y + m.dy) * H, m.r * D, colores[i % colores.length], 0.95);
  });

  // Luz que sigue al cursor
  if (opciones.interactivo && puntero.dentro) {
    mancha(puntero.x * W, puntero.y * H, D * 0.22, luz, 1);
  }

  // Ondas al hacer clic
  for (let i = ondas.length - 1; i >= 0; i--) {
    const o = ondas[i];
    const p = Math.max(0, (ahora - o.t) / 1400);
    if (p >= 1) { ondas.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(o.x * W, o.y * H, p * D * 0.35, 0, Math.PI * 2);
    ctx.strokeStyle = hexAlfa(luz, (1 - p) * 0.9);
    ctx.lineWidth = 18 * escala * (1 - p) + 2;
    ctx.stroke();
  }
}

let animando = false;
function bucle(ahora) {
  if (!animando) return;
  dibujar(ahora);
  requestAnimationFrame(bucle);
}
function arrancar() {
  const debe = opciones.activo && !reducido.matches && !document.hidden;
  if (debe && !animando) { animando = true; requestAnimationFrame(bucle); }
  if (!debe) { animando = false; dibujar(performance.now()); }
}

addEventListener('resize', redimensionar);
document.addEventListener('visibilitychange', arrancar);
reducido.addEventListener('change', arrancar);

addEventListener('pointermove', (e) => {
  puntero.tx = e.clientX / innerWidth;
  puntero.ty = e.clientY / innerHeight;
  if (!puntero.dentro) { puntero.x = puntero.tx; puntero.y = puntero.ty; }
  puntero.dentro = true;
}, { passive: true });
document.addEventListener('pointerleave', () => { puntero.dentro = false; });
addEventListener('pointerdown', (e) => {
  if (!opciones.interactivo || !animando) return;
  ondas.push({ x: e.clientX / innerWidth, y: e.clientY / innerHeight, t: performance.now() });
}, { passive: true });

export const fondo = {
  configurar({ colores: c, base: b, luz: l, ...resto }) {
    if (c) colores = c;
    if (b) base = b;
    if (l) luz = l;
    Object.assign(opciones, resto);
    arrancar();
    if (!animando) dibujar(performance.now());
  },
};

redimensionar();
arrancar();
