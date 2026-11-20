/* =========================================================
   NUBE (Supabase, plan gratuito)
   - Cuenta: Google o enlace mágico por correo.
   - Sincronización Mac/iPhone: todo lo que la app guarda en el
     dispositivo con el prefijo "hub:" se refleja en la tabla
     "almacen". Gana el cambio más reciente.
   - Movimientos bancarios: tabla "movimientos" (ver importar.js).
   La clave publicable es pública por diseño: la seguridad está en
   las políticas RLS (cada usuario solo ve sus filas).
   ========================================================= */

export const SUPABASE_URL = 'https://ypffurbjhsypgdpvtwlw.supabase.co';
export const SUPABASE_CLAVE = 'sb_publishable_7kTN6JzxhFy2DWa9E8jcAQ_W7WYAXH7';
const CDN = './vendor/supabase.min.js'; // supabase-js 2.45.4 empaquetado

// Claves que no se sincronizan (propias de cada dispositivo o de la demo)
const LOCALES = ['hub:cal-vista', 'hub:fondo-foto', 'hub:meta-sync', 'hub:movimientos', 'hub:google-eventos', 'hub:correos', 'hub:correos-outlook'];
const sincronizable = (k) => typeof k === 'string' && k.startsWith('hub:') && !LOCALES.includes(k) && !k.endsWith('-demo');

/* ---------- Marcas de tiempo locales ---------- */
const setOriginal = Storage.prototype.setItem;
const removeOriginal = Storage.prototype.removeItem;
function leerMeta() { try { return JSON.parse(localStorage.getItem('hub:meta-sync')) || {}; } catch { return {}; } }
function guardarMeta(m) { try { setOriginal.call(localStorage, 'hub:meta-sync', JSON.stringify(m)); } catch {} }
const pendientes = new Set();
let temporizador;

function marcar(clave) {
  const m = leerMeta(); m[clave] = new Date().toISOString(); guardarMeta(m);
  pendientes.add(clave);
  clearTimeout(temporizador); temporizador = setTimeout(subirPendientes, 1500);
}

// Cualquier escritura de la app pasa por aquí sin tocar las secciones
Storage.prototype.setItem = function (k, v) {
  setOriginal.call(this, k, v);
  if (this === localStorage && sincronizable(k)) marcar(k);
};
Storage.prototype.removeItem = function (k) {
  removeOriginal.call(this, k);
  if (this === localStorage && sincronizable(k)) marcar(k);
};

/* ---------- Cliente ---------- */
let cliente = null, usuario = null;
export let modoRecuperacion = false;
const oyentes = [];
export const usuarioActual = () => usuario;
export const alCambiarCuenta = (f) => oyentes.push(f);
const avisar = () => oyentes.forEach((f) => f(usuario));

export async function obtenerCliente() {
  if (cliente) return cliente;
  const { createClient } = await import(CDN);
  cliente = createClient(SUPABASE_URL, SUPABASE_CLAVE, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } });
  return cliente;
}

export async function iniciarNube() {
  try {
    const sb = await obtenerCliente();
    const { data } = await sb.auth.getSession();
    usuario = data.session?.user ?? null;
    avisar();
    if (usuario) sincronizar();
    sb.auth.onAuthStateChange((evento, sesion) => {
      const antes = usuario?.id;
      usuario = sesion?.user ?? null;
      if (evento === 'PASSWORD_RECOVERY') { modoRecuperacion = true; dispatchEvent(new Event('hub:recuperar')); }
      avisar();
      if (usuario && usuario.id !== antes) sincronizar();
    });
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && usuario) sincronizar(); });
    addEventListener('online', () => usuario && sincronizar());
  } catch (e) {
    console.warn('Sin conexión con la nube:', e.message);
  }
}

const volver = () => location.origin + location.pathname;

export async function entrarConGoogle() {
  const sb = await obtenerCliente();
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: volver() } });
  if (error) throw error;
}

export async function entrarConCorreo(correo) {
  const sb = await obtenerCliente();
  const { error } = await sb.auth.signInWithOtp({ email: correo, options: { emailRedirectTo: volver() } });
  if (error) throw error;
}

/** Entrar con el código de 6 dígitos del correo (útil en la app instalada del iPhone) */
export async function verificarCodigo(correo, codigo) {
  const sb = await obtenerCliente();
  const { error } = await sb.auth.verifyOtp({ email: correo, token: codigo, type: 'email' });
  if (error) throw error;
}

/** Correo y contraseña: funciona igual en la app instalada del iPhone */
export async function entrarConClave(correo, clave) {
  const sb = await obtenerCliente();
  const { error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
  if (error) throw error;
}
/** Devuelve true si ya hay sesión (sin confirmación por correo) */
export async function crearCuenta(correo, clave) {
  const sb = await obtenerCliente();
  const { data, error } = await sb.auth.signUp({ email: correo, password: clave, options: { emailRedirectTo: volver() } });
  if (error) throw error;
  // Supabase no avisa si el correo ya existe: devuelve un usuario sin identidades
  if (data.user && !data.user.identities?.length) throw new Error('ya existe una cuenta con este correo. Pulsa Entrar con tu contraseña.');
  return !!data.session;
}

/** Envía un correo para poner una contraseña nueva */
export async function recuperarClave(correo) {
  const sb = await obtenerCliente();
  const { error } = await sb.auth.resetPasswordForEmail(correo, { redirectTo: volver() });
  if (error) throw error;
}
export async function cambiarClave(nueva) {
  const sb = await obtenerCliente();
  const { error } = await sb.auth.updateUser({ password: nueva });
  if (error) throw error;
  modoRecuperacion = false;
}

export async function salir() {
  const sb = await obtenerCliente();
  await sb.auth.signOut();
}

/* ---------- Sincronización ---------- */
let sincronizando = false;
export let ultimaSync = null;

async function subirPendientes() {
  if (!usuario || !pendientes.size) return;
  const sb = await obtenerCliente();
  const meta = leerMeta();
  const filas = [...pendientes].map((clave) => {
    const valor = localStorage.getItem(clave);
    return { user_id: usuario.id, clave, valor, borrado: valor === null, actualizado: meta[clave] || new Date().toISOString() };
  });
  pendientes.clear();
  const { error } = await sb.from('almacen').upsert(filas);
  if (error) { filas.forEach((f) => pendientes.add(f.clave)); console.warn('Error al subir', error.message); }
  else { ultimaSync = new Date(); dispatchEvent(new CustomEvent('hub:sync')); }
}

export async function sincronizar() {
  if (sincronizando || !usuario) return;
  sincronizando = true;
  try {
    const sb = await obtenerCliente();
    const { data, error } = await sb.from('almacen').select('clave, valor, borrado, actualizado');
    if (error) throw error;
    const meta = leerMeta();
    const remotas = new Map(data.map((f) => [f.clave, f]));
    let cambios = false;

    // Lo remoto más nuevo se baja
    for (const f of data) {
      const local = meta[f.clave];
      if (!local || new Date(f.actualizado) > new Date(local)) {
        if (f.borrado) removeOriginal.call(localStorage, f.clave);
        else setOriginal.call(localStorage, f.clave, f.valor);
        meta[f.clave] = f.actualizado; cambios = true;
      }
    }
    guardarMeta(meta);

    // Lo local más nuevo (o que no existe en la nube) se sube
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!sincronizable(k)) continue;
      const r = remotas.get(k);
      if (!r || (meta[k] && new Date(meta[k]) > new Date(r.actualizado))) {
        if (!meta[k]) { meta[k] = new Date().toISOString(); guardarMeta(meta); }
        pendientes.add(k);
      }
    }
    await subirPendientes();
    ultimaSync = new Date();
    dispatchEvent(new CustomEvent('hub:sync'));
    // Si han llegado datos de otro dispositivo, se recarga una vez para aplicarlos (ajustes, perfil, vistas)
    if (cambios) location.reload();
  } catch (e) {
    console.warn('Error de sincronización:', e.message);
  } finally {
    sincronizando = false;
  }
}
