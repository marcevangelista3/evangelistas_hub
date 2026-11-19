/* =========================================================
   WIDGETS PERSONALIZABLES (estilo iOS)
   Cualquier página con tarjetas que tengan data-widget puede
   activarlo: tamaño y orden se guardan por página.
   ========================================================= */

export const TAMANOS = [
  ['s', 'Pequeño'], ['m', 'Mediano'], ['l', 'Grande'], ['xl', 'Muy grande'], ['full', 'Ancho completo'],
];

const clave = (pagina) => `hub:widgets:${pagina}`;
const leer = (p) => { try { return JSON.parse(localStorage.getItem(clave(p))) || {}; } catch { return {}; } };
const guardar = (p, c) => { try { localStorage.setItem(clave(p), JSON.stringify(c)); } catch {} };

/** Aplica el orden y tamaños guardados. predeterminados: { id: 'm', ... } */
export function aplicarWidgets(pagina, rejilla, predeterminados) {
  const conf = leer(pagina);
  const tarjetas = [...rejilla.querySelectorAll('[data-widget]')];
  const orden = conf.orden || tarjetas.map((t) => t.dataset.widget);
  tarjetas.sort((a, b) => idx(orden, a.dataset.widget) - idx(orden, b.dataset.widget)).forEach((t) => rejilla.append(t));
  tarjetas.forEach((t) => ponerTamano(t, conf.tam?.[t.dataset.widget] || predeterminados[t.dataset.widget] || 'm'));
}
const idx = (orden, id) => { const i = orden.indexOf(id); return i < 0 ? 999 : i; };

function ponerTamano(t, tam) {
  TAMANOS.forEach(([k]) => t.classList.remove('w-' + k));
  t.classList.add('w-' + tam);
  t.dataset.tam = tam;
}

/** Modo edición: botones de tamaño, mover y arrastrar */
export function modoEdicion(pagina, rejilla, predeterminados, boton) {
  let editando = false;

  function guardarEstado() {
    const tarjetas = [...rejilla.querySelectorAll('[data-widget]')];
    guardar(pagina, {
      orden: tarjetas.map((t) => t.dataset.widget),
      tam: Object.fromEntries(tarjetas.map((t) => [t.dataset.widget, t.dataset.tam])),
    });
  }

  function barra(t) {
    const div = document.createElement('div');
    div.className = 'w-barra';
    div.innerHTML = `
      <button type="button" data-mover="-1" aria-label="Mover antes">‹</button>
      <div class="w-tamanos">${TAMANOS.map(([k, n]) => `<button type="button" data-tam="${k}" title="${n}" class="${t.dataset.tam === k ? 'activo' : ''}">${k.toUpperCase()}</button>`).join('')}</div>
      <button type="button" data-mover="1" aria-label="Mover después">›</button>`;
    div.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      e.stopPropagation(); e.preventDefault();
      if (b.dataset.tam) {
        ponerTamano(t, b.dataset.tam);
        div.querySelectorAll('[data-tam]').forEach((x) => x.classList.toggle('activo', x === b));
      } else {
        const hermano = +b.dataset.mover < 0 ? t.previousElementSibling : t.nextElementSibling;
        if (hermano) +b.dataset.mover < 0 ? hermano.before(t) : hermano.after(t);
        t.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      guardarEstado();
    });
    return div;
  }

  // Arrastrar y soltar (ratón)
  let arrastrada = null;
  rejilla.addEventListener('dragstart', (e) => { arrastrada = e.target.closest('[data-widget]'); arrastrada?.classList.add('w-arrastrando'); });
  rejilla.addEventListener('dragend', () => { arrastrada?.classList.remove('w-arrastrando'); arrastrada = null; guardarEstado(); });
  rejilla.addEventListener('dragover', (e) => {
    if (!arrastrada) return;
    e.preventDefault();
    const sobre = e.target.closest('[data-widget]');
    if (!sobre || sobre === arrastrada) return;
    const r = sobre.getBoundingClientRect();
    (e.clientX - r.left) / r.width < 0.5 ? sobre.before(arrastrada) : sobre.after(arrastrada);
  });

  boton.addEventListener('click', () => {
    editando = !editando;
    rejilla.classList.toggle('editando', editando);
    boton.textContent = editando ? 'Hecho' : 'Editar';
    boton.classList.toggle('primario', editando);
    rejilla.querySelectorAll('[data-widget]').forEach((t) => {
      t.draggable = editando;
      t.querySelector('.w-barra')?.remove();
      if (editando) t.append(barra(t));
    });
    document.getElementById('restablecer-widgets').hidden = !editando;
  });

  document.getElementById('restablecer-widgets').onclick = () => {
    try { localStorage.removeItem(clave(pagina)); } catch {}
    dispatchEvent(new Event('hub:recargar'));
  };
}
