// Service worker: guarda la app para que abra sin conexión.
// Sube VERSION cada vez que cambies archivos.
const VERSION = 'hub-v11';
const ARCHIVOS = [
  './', './index.html', './manifest.json',
  './css/tema.css', './css/estructura.css', './css/paneles.css', './css/movimiento.css', './css/graficos.css',
  './js/app.js', './js/secciones.js', './js/iconos.js', './js/ui.js', './js/ajustes.js', './js/datos.js', './js/color.js', './js/fondo.js', './js/imagenes.js', './js/perfil.js', './js/paneles.js', './js/graficos.js', './js/demo.js', './js/widgets.js', './js/nutricion.js', './js/composicion.js', './js/finanzas-datos.js', './js/nube.js', './js/importar.js', './js/entrenos.js', './js/entrenos-vista.js', './js/vendor/supabase.min.js',
  './js/secciones/inicio.js', './js/secciones/calendario.js', './js/secciones/fitness.js', './js/secciones/finanzas.js',
  './icons/icon-192.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Red primero; si no hay conexión, lo guardado.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const c = r.clone(); caches.open(VERSION).then((ca) => ca.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
