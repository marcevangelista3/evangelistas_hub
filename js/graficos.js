/* =========================================================
   GRÁFICOS ANIMADOS (sin librerías)
   Cada función devuelve HTML/SVG. Las animaciones de entrada
   están en css/graficos.css y los números con animarNumeros().
   ========================================================= */

const fmt = (n, dec = 0) => n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });

/** Número que cuenta desde 0 al aparecer */
export const contador = (valor, { dec = 0, pre = '', suf = '' } = {}) =>
  `<span class="contador" data-contar="${valor}" data-dec="${dec}" data-pre="${pre}" data-suf="${suf}">${pre}${fmt(0, dec)}${suf}</span>`;

export function animarNumeros(raiz, retraso = 250) {
  const reducido = document.documentElement.dataset.movimiento === 'reducido' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  raiz.querySelectorAll('[data-contar]').forEach((el, i) => {
    const fin = parseFloat(el.dataset.contar), dec = +el.dataset.dec, pre = el.dataset.pre, suf = el.dataset.suf;
    const pintar = (v) => { el.textContent = pre + fmt(v, dec) + suf; };
    if (reducido) return pintar(fin);
    const dur = 1200, ini = performance.now() + retraso + i * 40;
    const paso = (t) => {
      const p = Math.min(1, Math.max(0, (t - ini) / dur));
      pintar(fin * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  });
}

/** Barras verticales tipo píldora */
export function barras(valores, etiquetas, { destacar = -1, color = 'var(--acento-m)', sufijo = '', colores = null, max: maxFijo = 0, clicable = false, textos = null } = {}) {
  const max = maxFijo || Math.max(...valores) || 1;
  return `<div class="g-barras ${colores ? 'todas' : ''}">${valores.map((v, i) => {
    const fondo = colores ? colores[i] : i === destacar ? color : '';
    return `
    <div class="g-col ${i === destacar ? 'destacada' : ''} ${clicable ? 'clicable' : ''}" style="--i:${i}" data-i="${i}">
      <div class="g-pista"><i style="height:${Math.min(100, (v / max) * 100)}%;${fondo ? `background:${fondo}` : ''}"><b>${textos ? textos[i] : fmt(v) + sufijo}</b></i></div>
      <span>${etiquetas[i]}</span>
    </div>`;
  }).join('')}</div>`;
}

/** Carrusel de vistas dentro de una tarjeta (flechas, puntos y deslizar) */
export function carrusel(vistas) {
  return `<div class="carrusel">
    <div class="car-pista">${vistas.map((v, i) => `<section class="car-vista" data-n="${i}" aria-label="${v.titulo}">${v.html}</section>`).join('')}</div>
    <button type="button" class="car-flecha izq" aria-label="Anterior">‹</button>
    <button type="button" class="car-flecha der" aria-label="Siguiente">›</button>
    <div class="car-pie"><span class="car-titulo">${vistas[0].titulo}</span>
      <span class="car-puntos">${vistas.map((v, i) => `<button type="button" class="${i ? '' : 'activo'}" data-ir="${i}" aria-label="${v.titulo}"></button>`).join('')}</span></div>
  </div>`;
}

export function activarCarruseles(raiz) {
  raiz.querySelectorAll('.carrusel').forEach((car) => {
    const pista = car.querySelector('.car-pista');
    const vistas = [...car.querySelectorAll('.car-vista')];
    const titulos = vistas.map((v) => v.getAttribute('aria-label'));
    let actual = 0;
    const ir = (n) => pista.scrollTo({ left: Math.max(0, Math.min(vistas.length - 1, n)) * pista.clientWidth, behavior: 'smooth' });
    car.querySelector('.izq').onclick = () => ir(actual - 1);
    car.querySelector('.der').onclick = () => ir(actual + 1);
    car.querySelectorAll('[data-ir]').forEach((b) => b.onclick = () => ir(+b.dataset.ir));
    let t;
    pista.addEventListener('scroll', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const n = Math.round(pista.scrollLeft / pista.clientWidth);
        if (n === actual) return;
        actual = n;
        car.querySelectorAll('[data-ir]').forEach((b, i) => b.classList.toggle('activo', i === n));
        car.querySelector('.car-titulo').textContent = titulos[n];
        car.classList.toggle('al-inicio', n === 0);
        car.classList.toggle('al-final', n === vistas.length - 1);
        // Vuelve a lanzar las animaciones de la vista que entra
        const v = vistas[n];
        v.innerHTML = v.innerHTML;
        animarNumeros(v, 0);
      }, 90);
    }, { passive: true });
    car.classList.add('al-inicio');
  });
}

/** Línea con área degradada */
export function linea(valores, etiquetas, { color = 'var(--acento-f)', id = 'l' + Math.random().toString(36).slice(2, 7), dec = 1, sufijo = '' } = {}) {
  const W = 300, H = 110, pad = 8;
  const min = Math.min(...valores), max = Math.max(...valores), r = max - min || 1;
  const pts = valores.map((v, i) => [pad + (i * (W - pad * 2)) / (valores.length - 1), pad + (1 - (v - min) / r) * (H - pad * 2)]);
  const d = pts.map((p, i) => {
    if (!i) return `M${p[0]},${p[1]}`;
    const a = pts[i - 1], cx = (a[0] + p[0]) / 2;
    return `C${cx},${a[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;
  }).join(' ');
  const ult = pts[pts.length - 1];
  return `<div class="g-linea">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <path class="g-area" d="${d} L${ult[0]},${H} L${pts[0][0]},${H} Z" fill="url(#${id})"/>
      <path class="g-trazo" d="${d}" pathLength="1" stroke="${color}" vector-effect="non-scaling-stroke"/>
    </svg>
    <span class="g-punto" style="left:${(ult[0] / W) * 100}%;top:${(ult[1] / H) * 100}%;background:${color}"></span>
    <div class="g-ejes">${etiquetas.map((e) => `<span>${e}</span>`).join('')}</div>
  </div>`;
}

/** Donut con leyenda */
export function donut(segmentos, centro = '', subcentro = '') {
  const total = segmentos.reduce((a, s) => a + s.valor, 0);
  let acum = 0;
  const arcos = segmentos.map((s, i) => {
    const p = (s.valor / total) * 100;
    const arco = `<circle class="g-seg" cx="21" cy="21" r="15.9" pathLength="100" stroke="${s.color}" style="--i:${i};stroke-dasharray:${Math.max(p - 1.2, 0)} ${100 - Math.max(p - 1.2, 0)};stroke-dashoffset:${-acum}"/>`;
    acum += p; return arco;
  }).join('');
  return `<div class="g-donut">
    <div class="g-donut-graf">
      <svg viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="15.9" class="g-fondo-aro"/>${arcos}</svg>
      <div class="g-centro"><strong>${centro}</strong><small>${subcentro}</small></div>
    </div>
    <ul class="g-leyenda">${segmentos.map((s) => `<li><i style="background:${s.color}"></i>${s.nombre}<b>${fmt(s.valor)} €</b></li>`).join('')}</ul>
  </div>`;
}

/** Anillo de progreso */
export function anillo(pct, { color = 'var(--acento-m)', texto = '', sub = '', i = 0 } = {}) {
  const p = Math.min(100, Math.max(0, pct));
  return `<div class="g-anillo" style="--i:${i}">
    <svg viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="17" class="g-fondo-aro"/>
      <circle class="g-seg" cx="21" cy="21" r="17" pathLength="100" stroke="${color}" style="--i:${i};stroke-dasharray:${p} ${100 - p};stroke-dashoffset:0"/></svg>
    <div class="g-centro"><strong>${texto}</strong><small>${sub}</small></div>
  </div>`;
}

/** Barra horizontal con etiqueta y valores */
export const barraProgreso = (nombre, actual, objetivo, { color = 'var(--acento-m)', unidad = '', i = 0 } = {}) => `
  <div class="g-macro">
    <div class="g-macro-cab"><span>${nombre}</span><span><b>${fmt(actual)}</b> / ${fmt(objetivo)} ${unidad}</span></div>
    <div class="progreso"><i style="width:${Math.min(100, (actual / objetivo) * 100)}%;background:${color};--i:${i}"></i></div>
  </div>`;

/** Mes en cuadrícula (lunes primero). clase(dia) devuelve una clase o color por día. */
export function mes(fecha, clase = () => '', estilo = () => '') {
  const a = fecha.getFullYear(), m = fecha.getMonth(), hoy = new Date();
  const dias = new Date(a, m + 1, 0).getDate();
  const hueco = (new Date(a, m, 1).getDay() + 6) % 7;
  let h = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<span class="ds">${d}</span>`).join('');
  h += '<span class="d vacio"></span>'.repeat(hueco);
  for (let d = 1; d <= dias; d++) {
    const esHoy = d === hoy.getDate() && m === hoy.getMonth() && a === hoy.getFullYear();
    h += `<span class="d ${clase(d)} ${esHoy ? 'hoy' : ''}" style="--j:${d};${estilo(d)}">${d}</span>`;
  }
  return `<div class="mes">${h}</div>`;
}
