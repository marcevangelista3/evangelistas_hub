/* =========================================================
   FONDO ANIMADO
   Dos estilos:
   - «estrellas»: cielo nocturno con estrellas que titilan, se
     desplazan despacio y, de vez en cuando, cae una estrella
     fugaz. Al hacer clic sale una desde ese punto.
   - «manchas»: manchas pastel que flotan, se apartan del cursor
     y hacen una onda al hacer clic.
   ========================================================= */

const cv = document.getElementById('fondo');
const ctx = cv.getContext('2d');
const reducido = matchMedia('(prefers-reduced-motion: reduce)');

let W = 0, H = 0, escala = 0.5;
let colores = ['#d9d1f5', '#fbdcc8', '#cdeedd', '#cfe4f7', '#f6d3e1'];
let base = '#f4f2f8';
let luz = 'rgba(255,255,255,0.6)';
let opciones = { interactivo: true, velocidad: 1, activo: true, estilo: 'manchas' };

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
  // Las estrellas necesitan resolución completa para verse nítidas
  escala = Math.min(window.devicePixelRatio || 1, 2) * (opciones.estilo === 'estrellas' ? 1 : 0.5);
  W = cv.width = Math.round(innerWidth * escala);
  H = cv.height = Math.round(innerHeight * escala);
  if (opciones.estilo === 'estrellas') crearCielo();
  if (!animando) dibujar(performance.now());
}

/* ---------- Cielo estrellado ---------- */
let capaFija = null;          // fondo, nebulosas y estrellas tenues (se pinta una vez)
let brillantes = [];          // estrellas que titilan
const fugaces = [];
let proximaFugaz = 0;
const azar = (a, b) => a + Math.random() * (b - a);

function crearCielo() {
  capaFija = document.createElement('canvas');
  capaFija.width = W; capaFija.height = H;
  const c = capaFija.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#04050b'); g.addColorStop(0.6, '#080a17'); g.addColorStop(1, '#0d1024');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // Nebulosas muy suaves con los tonos del acento
  const D = Math.max(W, H);
  [[0.2, 0.25, 0.55], [0.85, 0.15, 0.45], [0.65, 0.8, 0.6]].forEach(([x, y, r], i) => {
    const n = c.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * D);
    n.addColorStop(0, hexAlfa(colores[i % colores.length], 0.28));
    n.addColorStop(1, hexAlfa(colores[i % colores.length], 0));
    c.fillStyle = n; c.fillRect(0, 0, W, H);
  });
  // Estrellas tenues fijas
  const area = (W * H) / (escala * escala);
  for (let i = 0, n = Math.round(area / 2600); i < n; i++) {
    c.globalAlpha = azar(0.15, 0.55);
    c.fillStyle = Math.random() < 0.15 ? '#cfd8ff' : '#ffffff';
    c.beginPath(); c.arc(Math.random() * W, Math.random() * H, azar(0.3, 0.8) * escala, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  // Estrellas que titilan, en dos capas de profundidad
  brillantes = Array.from({ length: Math.round(area / 9000) }, () => ({
    x: Math.random(), y: Math.random(), r: azar(0.6, 1.7) * escala,
    a: azar(0.5, 1), v: azar(0.6, 2.2), f: Math.random() * 7, prof: Math.random() < 0.3 ? 2 : 1,
    color: ['#ffffff', '#ffffff', '#ffffff', '#dfe6ff', '#fff1d6'][Math.floor(Math.random() * 5)],
  }));
}

function nuevaFugaz(x, y, grande = Math.random() < 0.2) {
  const ang = azar(Math.PI * 0.68, Math.PI * 0.82);   // hacia abajo a la izquierda
  const vel = azar(0.9, 1.4) * Math.max(W, H) * 0.9;  // px por segundo
  fugaces.push({ x: x ?? azar(0.3, 1.1) * W, y: y ?? azar(-0.1, 0.45) * H, dx: Math.cos(ang), dy: Math.sin(ang),
    vel, largo: azar(0.12, 0.22) * Math.max(W, H) * (grande ? 1.4 : 1), vida: azar(0.7, 1.1), t: null, grueso: (grande ? 2.4 : 1.6) * escala });
}

function dibujarCielo(ahora) {
  const t = (ahora / 1000) * Math.max(opciones.velocidad, 0.05);
  puntero.x += (puntero.tx - puntero.x) * 0.04;
  puntero.y += (puntero.ty - puntero.y) * 0.04;
  // Deriva lenta y un poco de paralaje con el cursor
  const px = opciones.interactivo && puntero.dentro ? (puntero.x - 0.5) : 0, py = opciones.interactivo && puntero.dentro ? (puntero.y - 0.5) : 0;
  const deriva = (t * 6 * escala) % W;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(capaFija, 0, 0);

  ctx.globalCompositeOperation = 'lighter';
  for (const s of brillantes) {
    let x = s.x * W - deriva * s.prof * 0.5 - px * 14 * escala * s.prof;
    x = ((x % W) + W) % W;
    const y = s.y * H - py * 10 * escala * s.prof;
    const a = s.a * (0.55 + 0.45 * Math.sin(t * s.v + s.f));
    ctx.globalAlpha = a; ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2); ctx.fill();
    if (s.r > 1.3 * escala) {   // destello en cruz en las más grandes
      ctx.globalAlpha = a * 0.35;
      ctx.fillRect(x - s.r * 4, y - 0.4 * escala, s.r * 8, 0.8 * escala);
      ctx.fillRect(x - 0.4 * escala, y - s.r * 4, 0.8 * escala, s.r * 8);
    }
  }
  ctx.globalAlpha = 1;

  // Estrellas fugaces
  if (ahora > proximaFugaz) { if (proximaFugaz) nuevaFugaz(); proximaFugaz = ahora + azar(2200, 6500) / Math.max(opciones.velocidad, 0.2); }
  for (let i = fugaces.length - 1; i >= 0; i--) {
    const f = fugaces[i];
    if (f.t === null) f.t = ahora;
    const p = (ahora - f.t) / 1000 / f.vida;
    if (p >= 1) { fugaces.splice(i, 1); continue; }
    const recorrido = f.vel * f.vida * p;
    const hx = f.x + f.dx * recorrido, hy = f.y + f.dy * recorrido;
    const largo = f.largo * Math.min(1, p * 3);
    const tx = hx - f.dx * largo, ty = hy - f.dy * largo;
    const alfa = Math.sin(Math.PI * Math.min(1, p * 1.15));
    const g = ctx.createLinearGradient(hx, hy, tx, ty);
    g.addColorStop(0, `rgba(255,255,255,${alfa})`);
    g.addColorStop(0.3, `rgba(200,210,255,${alfa * 0.45})`);
    g.addColorStop(1, 'rgba(160,170,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = f.grueso; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
    const h = ctx.createRadialGradient(hx, hy, 0, hx, hy, f.grueso * 5);
    h.addColorStop(0, `rgba(255,255,255,${alfa})`); h.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = h; ctx.fillRect(hx - f.grueso * 5, hy - f.grueso * 5, f.grueso * 10, f.grueso * 10);
  }
  ctx.globalCompositeOperation = 'source-over';
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
  if (opciones.estilo === 'estrellas') { if (!capaFija) crearCielo(); return dibujarCielo(ahora); }
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
  if (opciones.estilo === 'estrellas') {
    // Solo al tocar el cielo, no al pulsar botones o tarjetas
    if (e.target.closest('button, a, input, select, textarea, label, .tarjeta, dialog, .pieza, .tabbar')) return;
    nuevaFugaz(e.clientX * escala, e.clientY * escala, true); return;
  }
  ondas.push({ x: e.clientX / innerWidth, y: e.clientY / innerHeight, t: performance.now() });
}, { passive: true });

export const fondo = {
  /** Lanza una estrella fugaz (la usa la pantalla de bienvenida) */
  fugaz(x, y) { if (opciones.estilo === 'estrellas') nuevaFugaz(x == null ? undefined : x * escala, y == null ? undefined : y * escala, true); },
  configurar({ colores: c, base: b, luz: l, ...resto }) {
    const antes = opciones.estilo, coloresAntes = String(colores);
    if (c) colores = c;
    if (b) base = b;
    if (l) luz = l;
    Object.assign(opciones, resto);
    if (opciones.estilo !== antes) redimensionar();
    else if (opciones.estilo === 'estrellas' && String(colores) !== coloresAntes) crearCielo();
    arrancar();
    if (!animando) dibujar(performance.now());
  },
};

redimensionar();
arrancar();
