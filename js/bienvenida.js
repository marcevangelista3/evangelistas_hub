/* =========================================================
   PANTALLA DE BIENVENIDA Y DESBLOQUEO
   - Al abrir la app: la estrella aparece sobre el cielo, pasa
     una estrella fugaz y sale «Bienvenido, Marc».
   - Se desbloquea con Touch ID (Mac) o Face ID (iPhone) usando
     una llave de acceso (WebAuthn) guardada en el dispositivo.
   - Si estás fuera más de 5 minutos, se vuelve a bloquear.
   Es un candado de este dispositivo: no cifra los datos.
   ========================================================= */
import { ajuste } from './ajustes.js';
import { obtenerPerfil } from './perfil.js';
import { fondo } from './fondo.js';
import { celebrar } from './celebrar.js';

const LLAVE = 'hub-local:llave';           // id de la llave de acceso (no se sincroniza)
const VOLVER_GOOGLE = 'hub-local:desbloqueo-google';
const MINUTOS_FUERA = 5;
const $ = (id) => document.getElementById(id);
const raiz = document.documentElement;
const caja = $('bienvenida');

const esIphone = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const METODO = esIphone ? 'Face ID' : 'Touch ID';
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

// Vuelta de «Entrar con Google» pedida desde esta pantalla
let vieneDeGoogle = false;
try { vieneDeGoogle = sessionStorage.getItem(VOLVER_GOOGLE) === '1' && /[?&]code=/.test(location.search); sessionStorage.removeItem(VOLVER_GOOGLE); } catch {}

/* ---------- Llave de acceso ---------- */
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const azar = (n) => crypto.getRandomValues(new Uint8Array(n));

let soporte = null;
async function haySoporte() {
  if (soporte !== null) return soporte;
  try { soporte = !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
  catch { soporte = false; }
  return soporte;
}

async function crearLlave() {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: azar(32),
    rp: { name: "EVANGELISTA'S HUB", id: location.hostname },
    user: { id: azar(16), name: "EVANGELISTA'S HUB", displayName: obtenerPerfil().nombre || 'HUB' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
    attestation: 'none', timeout: 60000,
  } });
  localStorage.setItem(LLAVE, b64(cred.rawId));
}

async function usarLlave() {
  const res = await navigator.credentials.get({ publicKey: {
    challenge: azar(32), rpId: location.hostname, userVerification: 'required', timeout: 60000,
    allowCredentials: [{ type: 'public-key', id: deB64(leer(LLAVE)), transports: ['internal', 'hybrid'] }],
  } });
  // Comprueba que el sistema ha verificado tu huella o tu cara (bit UV)
  const datos = new Uint8Array(res.response.authenticatorData);
  if (!(datos[32] & 0x04)) throw new Error('sin_verificar');
}

/* ---------- Pantalla ---------- */
const ICONOS = {
  'Touch ID': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6.5 5.2A8.5 8.5 0 0 1 20.5 12"/><path d="M3.5 9.5A8.5 8.5 0 0 1 5 6.6"/><path d="M3.6 14.5a8.6 8.6 0 0 1-.1-1.5"/><path d="M6.5 18.5c-.6-1.6-.9-3.4-.9-5.5a6.4 6.4 0 0 1 12.8 0v1"/><path d="M9.5 20.5c-.8-2-1.3-4.6-1.3-7.5a3.8 3.8 0 0 1 7.6 0c0 2.6.6 5 1.6 7"/><path d="M12 13c0 3.2.7 6 2 8"/><path d="M18.4 17.5c.1.9.3 1.7.6 2.5"/></svg>',
  'Face ID': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16"/><path d="M8.5 9v1.5M15.5 9v1.5M12 9v4.5h-1"/><path d="M8.8 16.2a4.6 4.6 0 0 0 6.4 0"/></svg>',
  entrar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

let modo = 'entrar';   // entrar | desbloquear | activar
let ocupado = false;
const boton = $('bv-boton'), error = $('bv-error'), otro = $('bv-otro'), luego = $('bv-luego');

function ponerBoton(m) {
  modo = m;
  const icono = m === 'entrar' ? ICONOS.entrar : ICONOS[METODO];
  const texto = m === 'desbloquear' ? `Desbloquear con ${METODO}` : m === 'activar' ? `Activar ${METODO}` : 'Entrar';
  boton.innerHTML = `<span class="bv-icono">${icono}</span><span>${texto}</span>`;
  luego.hidden = m !== 'activar';
}
function avisar(texto) { error.textContent = texto; error.hidden = !texto; }

function fechaLarga() {
  const t = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function saludo() {
  const h = new Date().getHours();
  return h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
}

let primeraVez = true;
async function mostrar({ corta = false } = {}) {
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  raiz.classList.add('bloqueado'); raiz.classList.remove('entrando');
  caja.hidden = false;
  caja.classList.remove('saliendo', 'corta'); if (corta) caja.classList.add('corta');
  void caja.offsetWidth; caja.classList.add('activa');
  $('bv-hola').textContent = `${saludo()}, ${obtenerPerfil().nombre || 'Marc'}`;
  $('bv-fecha').textContent = `${fechaLarga()} · ${new Date().toTimeString().slice(0, 5)}`;
  avisar(''); otro.hidden = true;
  setTimeout(() => fondo.fugaz(innerWidth * 0.95, innerHeight * 0.02), corta ? 100 : 500);

  const bloqueo = ajuste('bloqueo') !== false, sop = await haySoporte(), llave = leer(LLAVE);
  if (!bloqueo) { ponerBoton('entrar'); setTimeout(() => entrar(), corta ? 600 : 2400); return; }
  if (!sop) { ponerBoton('entrar'); avisar(llave ? `Este navegador no permite usar ${METODO}.` : ''); return; }
  if (!llave) { ponerBoton('activar'); return; }
  ponerBoton('desbloquear');
  if (vieneDeGoogle) return;   // se abrirá sola al confirmar la sesión
  // Intenta abrir Touch ID / Face ID sola; si el sistema pide un toque, queda el botón
  setTimeout(() => { if (!caja.classList.contains('saliendo')) accion(true); }, corta ? 350 : 1500);
}

async function accion(automatica = false) {
  if (ocupado) return;
  ocupado = true; avisar('');
  try {
    if (modo === 'entrar') return entrar();
    if (modo === 'activar') { await crearLlave(); return entrar(true); }
    await usarLlave(); entrar(true);
  } catch (e) {
    if (automatica) return;   // sin toque del usuario el navegador suele negarse: no es un error
    const cancelado = e?.name === 'NotAllowedError' || e?.name === 'AbortError';
    avisar(cancelado ? `No se ha podido comprobar. Pulsa para probar otra vez.` : e?.name === 'InvalidStateError' ? `${METODO} ya estaba activado en este dispositivo.` : 'Algo ha fallado. Prueba otra vez.');
    if (modo === 'desbloquear') otro.hidden = false;
  } finally { ocupado = false; }
}

function entrar(conEstrellas = false) {
  if (caja.classList.contains('saliendo')) return;
  caja.classList.add('saliendo');
  if (conEstrellas) celebrar($('bv-logo'), 'medio');
  raiz.classList.remove('bloqueado'); raiz.classList.add('entrando');
  setTimeout(() => { caja.hidden = true; caja.classList.remove('activa'); raiz.classList.remove('entrando'); }, 900);
  if (primeraVez) { primeraVez = false; dispatchEvent(new Event('hub:recargar')); }
}

boton.addEventListener('click', () => accion());
luego.addEventListener('click', () => entrar());
otro.addEventListener('click', async () => {
  try { sessionStorage.setItem(VOLVER_GOOGLE, '1'); } catch {}
  const { entrarConGoogle } = await import('./nube.js');
  entrarConGoogle().catch((e) => avisar(e.message));
});

/* ---------- Arranque y vuelta a la app ---------- */
export function iniciarBienvenida(alCambiarCuenta) {
  if (!caja) return;
  mostrar();
  if (vieneDeGoogle) alCambiarCuenta((u) => { if (u && raiz.classList.contains('bloqueado')) entrar(true); });
  let fuera = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { fuera = Date.now(); return; }
    if (fuera && Date.now() - fuera > MINUTOS_FUERA * 60000 && ajuste('bloqueo') !== false && leer(LLAVE) && !raiz.classList.contains('bloqueado')) mostrar({ corta: true });
  });
}
