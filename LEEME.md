# EVANGELISTA'S HUB

Hub personal adaptable a Mac e iPhone. HTML, CSS y JavaScript con módulos ES, sin compilación.

## Estructura

```
index.html            Esqueleto: barra, contenido, barra inferior, panel de ajustes
css/tema.css          Colores, cristal, tipografía, modo claro/oscuro, acentos
css/estructura.css    Cabecera en piezas (Mac), barra inferior (iPhone), tarjetas
css/paneles.css       Hojas laterales/inferiores, buscador, perfil, IA
css/movimiento.css    Animaciones de entrada, transiciones y paneles
js/app.js             Arranque y navegación (#/seccion/subapartado)
js/secciones.js       REGISTRO DE SECCIONES: aquí se añaden secciones y subapartados
js/secciones/*.js     Una vista por sección (render)
js/ui.js              Piezas reutilizables (tarjeta, rejilla)
js/iconos.js          Iconos SVG
js/ajustes.js         Personalización (modo, color libre HEX/RGB/HSL, fondo, cristal, fuente, movimiento)
js/fondo.js           Fondo animado en canvas que reacciona al cursor
js/perfil.js          Nombre y foto de perfil
js/paneles.js         Buscador (⌘K), notificaciones y panel de IA
js/color.js           Conversión de colores
js/imagenes.js        Reducir fotos antes de guardarlas
js/datos.js           Capa de datos (ahora local; después Supabase)
js/graficos.js        Gráficos animados sin librerías (barras, línea, donut, anillos, carrusel)
js/widgets.js         Widgets de Inicio: tamaño S/M/L/XL/Completo, mover y arrastrar
js/demo.js            Datos de ejemplo (prioridades, eventos, correos, fitness)
js/nutricion.js       Alimentos por 100 g y cálculo de macros por comida
js/composicion.js     Estimación de grasa (Marina EE. UU.), músculo (Lee) y agua (Watson)
js/finanzas-datos.js  Categorías, reglas de clasificación, meses (demo o reales) y recomendaciones
js/entrenos.js        Rutinas, entreno de hoy, sesión en curso, historial y marcas
js/entrenos-vista.js  Pestaña Ejercicios: registro de series, descanso y editor de entrenos
js/notas.js          Notas: Moodle (copia local), porcentajes y notas a mano (hub:notas), media ponderada
js/importar.js        Importar extractos de Revolut (CSV) y BBVA (Excel/CSV) sin duplicados
js/nube.js            Supabase: cuenta (Google o enlace por correo) y sincronización de hub:*
js/vendor/            supabase-js 2.45.4 empaquetado y SheetJS 0.18.5 (sin CDN)
sw.js, manifest.json  Instalación y uso sin conexión
```

## Añadir una sección nueva

1. Añade un objeto en `js/secciones.js` con `id`, `nombre`, `icono`, `color` y `subapartados`.
2. Crea `js/secciones/<id>.js` que exporte `render(sub, contenedor)`.
3. Añade el archivo a la lista de `sw.js` y sube `VERSION`.

La navegación de Mac y de iPhone se genera sola.

## Probar en local

```bash
cd evangelistas-hub
python3 -m http.server 8000
```

Abre `http://localhost:8000`.

## Nube (Supabase, plan gratuito)

- Proyecto `evangelistas-hub` (París). Tablas `almacen` (clave/valor por usuario) y `movimientos`, ambas con RLS.
- Función `ia`: asistente con la API gratuita de Gemini. Necesita el secreto `GEMINI_API_KEY` (opcional `GEMINI_MODEL`).
- Para entrar hace falta poner la URL de la app en Authentication › URL Configuration (Site URL y Redirect URLs).
- Google: Authentication › Providers › Google, con un cliente OAuth gratuito de Google Cloud.

## Notas (Moodle)

- Función `moodle`: usa el servicio de la app móvil de Moodle (`moodle_mobile_app`). La contraseña solo sirve para pedir el token y no se guarda.
- Tablas `moodle_conexion` (token por usuario) y `moodle_notas`, con RLS y sin políticas: solo las lee el servidor.
- pg_cron `hub-moodle` cada 15 minutos: baja las notas de todos y avisa por push de las nuevas (preferencia `notas` en hub:avisos).
- Campus por defecto: https://campus.digitechfp.com (se puede cambiar al conectar).
