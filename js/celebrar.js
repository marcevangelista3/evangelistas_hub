/* =========================================================
   REACCIONES
   Cuando terminas algo, sale un estallido de estrellitas
   (y confeti si es algo grande) desde donde has pulsado.
   - celebrar(origen, 'pequeno' | 'medio' | 'grande')
     origen: un elemento, un evento o { x, y } en píxeles.
   ========================================================= */

const COLORES = ['#ffffff', '#fff3c4', '#ffd98a', '#d9d1f5', '#cfe4f7', '#f6d3e1', '#cdeedd'];
const CONFETI = ['#b9a8f0', '#9fdcbf', '#f7c3a1', '#a8cdf0', '#f2b3cb', '#efe09a', '#ffffff'];
let cv = null, ctx = null, piezas = [], animando = false, dpr = 1;

const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.movimiento === 'reducido';
const azar = (a, b) => a + Math.random() * (b - a);

function lienzo() {
  if (cv) return;
  cv = document.createElement('canvas');
  cv.className = 'lienzo-celebrar'; cv.setAttribute('aria-hidden', 'true');
  if ('popover' in HTMLElement.prototype) cv.setAttribute('popover', 'manual');
  document.body.append(cv);
  ctx = cv.getContext('2d');
  const medir = () => { dpr = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
  medir(); addEventListener('resize', medir);
}

function punto(origen) {
  if (!origen) return { x: innerWidth / 2, y: innerHeight / 2 };
  if (origen instanceof Element) { const r = origen.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  if ('clientX' in origen) return { x: origen.clientX, y: origen.clientY };
  return origen;
}

function estrella(c, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, d = i % 2 ? r * 0.45 : r;
    c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * d, Math.sin(a) * d);
  }
  c.closePath(); c.fill();
}

function estallido(x, y, n, fuerza) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = azar(0.35, 1) * fuerza;
    piezas.push({ tipo: Math.random() < 0.8 ? 'estrella' : 'chispa', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - fuerza * 0.25,
      r: azar(3, 7), giro: azar(-8, 8), ang: Math.random() * 6, vida: azar(0.7, 1.2), t: 0, color: COLORES[i % COLORES.length], g: 520 });
  }
  piezas.push({ tipo: 'aro', x, y, vida: 0.5, t: 0, r: fuerza * 0.12 });
}

function lluvia(n) {
  for (let i = 0; i < n; i++) {
    piezas.push({ tipo: Math.random() < 0.75 ? 'confeti' : 'estrella', x: Math.random() * innerWidth, y: azar(-innerHeight * 0.4, -10),
      vx: azar(-60, 60), vy: azar(120, 320), r: azar(4, 8), giro: azar(-10, 10), ang: Math.random() * 6,
      vida: azar(2, 3.2), t: 0, color: CONFETI[i % CONFETI.length], g: 160, onda: Math.random() * 6 });
  }
}

let ultimo = 0;
function bucle(ahora) {
  const dt = Math.min(0.05, (ahora - (ultimo || ahora)) / 1000); ultimo = ahora;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = piezas.length - 1; i >= 0; i--) {
    const p = piezas[i];
    p.t += dt;
    const k = p.t / p.vida;
    if (k >= 1) { piezas.splice(i, 1); continue; }
    ctx.save();
    if (p.tipo === 'aro') {
      ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * (1 - k) + 0.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.3 + k * 1.2), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); continue;
    }
    p.vx *= p.tipo === 'confeti' ? 0.99 : 0.96; p.vy = p.vy * (p.tipo === 'confeti' ? 0.99 : 0.96) + p.g * dt;
    p.x += (p.vx + (p.onda !== undefined ? Math.sin(p.t * 4 + p.onda) * 40 : 0)) * dt; p.y += p.vy * dt; p.ang += p.giro * dt;
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.translate(p.x, p.y); ctx.rotate(p.ang); ctx.fillStyle = p.color;
    if (p.tipo === 'estrella') { ctx.shadowColor = p.color; ctx.shadowBlur = 8; estrella(ctx, p.r); }
    else if (p.tipo === 'chispa') { ctx.beginPath(); ctx.arc(0, 0, p.r * 0.35, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.scale(1, Math.cos(p.t * 6 + p.onda)); ctx.fillRect(-p.r / 2, -p.r, p.r, p.r * 2); }
    ctx.restore();
  }
  if (piezas.length) requestAnimationFrame(bucle);
  else { animando = false; ultimo = 0; ctx.clearRect(0, 0, cv.width, cv.height); if (cv.popover) try { cv.hidePopover(); } catch {} }
}

/** Pequeño rebote en el elemento pulsado */
function rebote(el) {
  if (!(el instanceof Element)) return;
  el.classList.remove('pum'); void el.offsetWidth; el.classList.add('pum');
  setTimeout(() => el.classList.remove('pum'), 600);
}

export function celebrar(origen, nivel = 'pequeno') {
  rebote(origen);
  try { navigator.vibrate?.(nivel === 'grande' ? [20, 40, 30] : 15); } catch {}
  if (reducido()) return;
  lienzo();
  // Se vuelve a poner en la capa superior para quedar por encima de cualquier panel abierto
  if (cv.popover) { try { cv.hidePopover(); } catch {} try { cv.showPopover(); } catch {} }
  const { x, y } = punto(origen);
  if (nivel === 'pequeno') estallido(x, y, 14, 260);
  else if (nivel === 'medio') estallido(x, y, 28, 380);
  else { estallido(x, y, 36, 460); lluvia(innerWidth < 700 ? 70 : 130); }
  if (!animando) { animando = true; requestAnimationFrame(bucle); }
}

/** Mensaje corto que aparece arriba (p. ej. «¡Entreno terminado!») */
export function felicitar(texto) {
  const a = document.createElement('div');
  a.className = 'aviso-flotante cristal felicitar'; a.textContent = texto;
  document.body.append(a); setTimeout(() => a.remove(), 3200);
}
