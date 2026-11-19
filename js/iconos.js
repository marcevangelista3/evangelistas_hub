// Iconos de línea en SVG (sin dependencias). Para añadir uno, agrega su trazado aquí.
const T = {
  inicio: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  calendario: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  fitness: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  finanzas: '<path d="M6 6V5a2 2 0 0 1 2-2h9"/><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M15 13h3"/>',
  ajustes: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  tareas: '<path d="m4 12 5 5L20 6"/>',
  correo: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
  grafico: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  progreso: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  dieta: '<path d="M12 21c-4.5 0-8-3.5-8-8 0-3 2-6 5-6 1.2 0 2.2.5 3 1 .8-.5 1.8-1 3-1 3 0 5 3 5 6 0 4.5-3.5 8-8 8z"/><path d="M12 8c0-2 1-4 3-5"/>',
  hucha: '<path d="M5 11a7 6 0 0 1 13-2h2v4l-2 1v3h-3v-2H9v2H6v-3a6 6 0 0 1-1-3z"/><circle cx="15" cy="11" r=".8"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  campana: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
  chispa: '<path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z"/><path d="M19 15c.3 1.8 1.2 2.7 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.3 2.7-1.2 3-3z"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
  foto: '<rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="9" cy="11" r="2"/><path d="m21 17-5-5-8 8"/>',
  enviar: '<path d="M4 12 20 4l-6 16-3-7z"/>',
  google: '<path d="M20 12.2c0-.6-.1-1.2-.2-1.7H12v3.3h4.5a3.9 3.9 0 0 1-1.7 2.5v2h2.7c1.6-1.4 2.5-3.6 2.5-6.1z"/><path d="M12 20.5c2.3 0 4.2-.8 5.5-2.1l-2.7-2a5 5 0 0 1-7.5-2.7H4.5v2.1A8.5 8.5 0 0 0 12 20.5z"/><path d="M7.3 13.7a5 5 0 0 1 0-3.4V8.2H4.5a8.5 8.5 0 0 0 0 7.6z"/><path d="M12 6.9c1.3 0 2.5.5 3.4 1.3l2.4-2.4A8.5 8.5 0 0 0 4.5 8.2l2.8 2.1A5 5 0 0 1 12 6.9z"/>',
  apple: '<path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5a4.3 4.3 0 0 0-3.4-1.8c-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8A4.5 4.5 0 0 0 4.7 9.8c-1.6 2.8-.4 6.9 1.2 9.1.8 1.1 1.7 2.3 2.8 2.3s1.6-.7 3-.7 1.8.7 3 .7 2-1.1 2.7-2.2a9.6 9.6 0 0 0 1.3-2.6 3.9 3.9 0 0 1-2.3-3.8z"/><path d="M14.2 5.6A3.9 3.9 0 0 0 15.1 2.8a4 4 0 0 0-2.6 1.3 3.7 3.7 0 0 0-1 2.7 3.3 3.3 0 0 0 2.7-1.2z"/>',
};

export function icono(nombre) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${T[nombre] || ''}</svg>`;
}

// Sustituye <span data-icono="x"> del HTML por su icono
export function pintarIconos(raiz = document) {
  raiz.querySelectorAll('[data-icono]').forEach((el) => { el.outerHTML = icono(el.dataset.icono); });
  raiz.querySelectorAll('.cerrar:empty').forEach((el) => { el.innerHTML = icono('cerrar'); });
}
