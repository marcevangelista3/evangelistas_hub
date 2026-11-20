/* =========================================================
   BANCOS AUTOMÁTICOS (Enable Banking)
   - Conectas Revolut o BBVA una vez y el servidor trae solo
     los movimientos nuevos a la tabla «movimientos».
   - El permiso del banco dura unos 90 días; después hay que
     volver a conectarlo (la app avisa).
   - El último estado (saldos, caducidad) se guarda en este
     dispositivo en hub:bancos-estado.
   Solo lectura: la app nunca puede mover dinero.
   ========================================================= */
const K = 'hub:bancos-estado';
const leer = () => { try { return JSON.parse(localStorage.getItem(K)) || null; } catch { return null; } };
const escribir = (v) => { try { localStorage.setItem(K, JSON.stringify(v)); } catch {} };

async function llamar(body) {
  const { obtenerCliente, usuarioActual } = await import('./nube.js');
  if (!usuarioActual()) throw new Error('Inicia sesión en Perfil primero.');
  const { data, error } = await (await obtenerCliente()).functions.invoke('bancos', { body });
  if (error) { const d = await error.context?.json?.().catch(() => null); throw new Error(d?.detalle || 'No se ha podido hablar con el banco.'); }
  return data;
}

export const estadoGuardado = () => leer();
export const hayBancos = () => !!leer()?.bancos?.length;
/** Suma de los saldos en euros */
export const saldoTotal = () => (leer()?.bancos || []).flatMap((b) => b.saldos || []).filter((s) => s.moneda === 'EUR').reduce((a, s) => a + (s.importe || 0), 0);
/** Días que le quedan al permiso que caduca antes (null si no hay bancos) */
export function diasPermiso() {
  const l = (leer()?.bancos || []).map((b) => (new Date(b.valido_hasta) - Date.now()) / 86400000);
  return l.length ? Math.floor(Math.min(...l)) : null;
}

export async function estadoBancos() { const d = await llamar({ accion: 'estado' }); escribir(d); return d; }

/** Busca el nombre exacto del banco en Enable Banking */
async function buscar(re) {
  for (const pais of ['ES', 'LT']) {
    const { bancos } = await llamar({ accion: 'bancos', pais });
    const b = bancos.find((x) => re.test(x.nombre));
    if (b) return b;
  }
  return null;
}
export async function conectarBanco(cual) {
  const b = await buscar(cual === 'bbva' ? /^bbva/i : /revolut/i);
  if (!b) throw new Error('Enable Banking no tiene ese banco disponible ahora mismo.');
  const volver = location.origin + location.pathname;
  const { url } = await llamar({ accion: 'url', banco: b.nombre, pais: b.pais, volver });
  location.href = url;
}
export async function desconectarBanco(id) { await llamar({ accion: 'desconectar', id }); return estadoBancos(); }

let enCurso = null;
/** Trae los movimientos nuevos. Devuelve { nuevos, errores }. */
export function sincronizarBancos(forzar = false) {
  if (enCurso) return enCurso;
  enCurso = (async () => {
    const r = await llamar({ accion: 'sincronizar', forzar });
    await estadoBancos().catch(() => {});
    return r;
  })().finally(() => { enCurso = null; });
  return enCurso;
}

/* ---------- Vuelta del banco (?bancos=ok|error|cancelado) ---------- */
function aviso(texto) {
  const a = document.createElement('div');
  a.className = 'aviso-flotante cristal'; a.textContent = texto;
  document.body.append(a); setTimeout(() => a.remove(), 6000);
}
export function iniciarBancos(alCambiarCuenta) {
  const vuelta = new URLSearchParams(location.search).get('bancos');
  if (!vuelta) return;
  history.replaceState(null, '', location.pathname + location.hash);
  if (vuelta !== 'ok') { aviso(vuelta === 'cancelado' ? 'Has cancelado la conexión con el banco.' : 'El banco no ha dado permiso. Prueba otra vez desde Finanzas.'); return; }
  let hecho = false;
  const alEntrar = async (u) => {
    if (!u || hecho) return; hecho = true;
    aviso('Banco conectado. Trayendo tus movimientos…');
    try {
      const r = await sincronizarBancos(true);
      const { bajarMovimientos } = await import('./importar.js');
      await bajarMovimientos();
      const { felicitar } = await import('./celebrar.js');
      felicitar(r.nuevos ? `${r.nuevos} movimientos nuevos del banco` : 'Banco conectado');
      if (/^#\/?finanzas/.test(location.hash) && !document.querySelector('dialog[open]') && !document.documentElement.classList.contains('bloqueado')) dispatchEvent(new Event('hub:recargar'));
    } catch (e) { aviso(e.message); }
  };
  alCambiarCuenta(alEntrar);
  import('./nube.js').then((n) => { const u = n.usuarioActual(); if (u) alEntrar(u); });
}
