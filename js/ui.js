// Piezas de interfaz reutilizables por todas las secciones.
import { icono } from './iconos.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Tarjeta de cristal.
 * ancho: '' (1/3), 'mitad', '2' (2/3) o '3' (completa)
 * contenido: HTML del cuerpo. Si no hay, muestra un esqueleto "Próximamente".
 * extra: HTML a la derecha del título (enlace, selector...).
 */
export function tarjeta({ titulo, texto = '', icono: ic, color = 'lavanda', ancho = '', contenido = '', extra = '', id = '', clase: claseExtra = '' }) {
  const clase = ancho ? ` ancho-${ancho}` : '';
  const cuerpo = contenido || `<p>${esc(texto)}</p><div class="esqueleto"><span></span><span></span><span></span></div>`;
  const derecha = extra || (contenido ? '' : '<span class="chip">Próximamente</span>');
  return `
    <article class="tarjeta cristal${clase} ${claseExtra}"${id ? ` data-widget="${id}"` : ''}>
      <div class="tarjeta-cabecera">
        ${ic ? `<span class="tarjeta-icono c-${color}">${icono(ic)}</span>` : ''}
        <h3>${esc(titulo)}</h3>
        ${derecha}
      </div>
      ${cuerpo}
    </article>`;
}

export const rejilla = (...tarjetas) => `<div class="rejilla">${tarjetas.join('')}</div>`;
export const verMas = (ruta, texto = 'Ver todo') => `<a class="enlace" href="${ruta}">${texto}</a>`;
