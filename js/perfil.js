/* =========================================================
   PERFIL
   Nombre y foto (guardados en el dispositivo por ahora;
   se sincronizarán con la cuenta cuando conectemos Supabase).
   ========================================================= */
import { icono } from './iconos.js';
import { reducirImagen, elegirImagen } from './imagenes.js';
import { usuarioActual, entrarConClave, crearCuenta, salir, sincronizar, ultimaSync } from './nube.js';

const CLAVE = 'hub:perfil';
let perfil = cargar();
const oyentes = [];

function cargar() {
  try { return { nombre: 'Marc', foto: null, ...JSON.parse(localStorage.getItem(CLAVE)) }; }
  catch { return { nombre: 'Marc', foto: null }; }
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(perfil)); } catch { alert('No se ha podido guardar el perfil.'); }
  pintarAvatares();
  oyentes.forEach((f) => f(perfil));
}

export const obtenerPerfil = () => perfil;
export const alCambiarPerfil = (f) => oyentes.push(f);

const iniciales = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const contenidoAvatar = () => (perfil.foto ? `<img src="${perfil.foto}" alt="">` : esc(iniciales(perfil.nombre)));

export function pintarAvatares() {
  document.getElementById('avatar-cabecera').innerHTML = contenidoAvatar();
  document.getElementById('nombre-cabecera').textContent = perfil.nombre;
}

export function pintarPanelPerfil(abrirAjustes) {
  const el = document.getElementById('perfil-cuerpo');
  el.innerHTML = `
    <div class="perfil-cabecera">
      <span class="avatar avatar-grande" id="avatar-grande">${contenidoAvatar()}</span>
      <div class="botones">
        <button type="button" class="boton" id="cambiar-foto">${icono('foto')} Cambiar foto</button>
        ${perfil.foto ? '<button type="button" class="boton" id="quitar-foto-perfil">Quitar</button>' : ''}
      </div>
    </div>
    <section class="grupo">
      <p class="grupo-titulo">Nombre</p>
      <input class="campo" id="perfil-nombre" value="${esc(perfil.nombre)}" maxlength="40">
    </section>
    ${seccionCuenta()}
    <section class="grupo">
      <button type="button" class="boton ancho primario" id="ir-ajustes">${icono('ajustes')} Personalizar el aspecto</button>
    </section>`;

  el.querySelector('#perfil-nombre').addEventListener('change', (e) => {
    perfil.nombre = e.target.value.trim() || 'Marc'; guardar();
  });
  el.querySelector('#cambiar-foto').addEventListener('click', async () => {
    const f = await elegirImagen(); if (!f) return;
    perfil.foto = await reducirImagen(f, { lado: 320, cuadrada: true, calidad: 0.88 });
    guardar(); pintarPanelPerfil(abrirAjustes);
  });
  el.querySelector('#quitar-foto-perfil')?.addEventListener('click', () => {
    perfil.foto = null; guardar(); pintarPanelPerfil(abrirAjustes);
  });
  el.querySelector('#ir-ajustes').addEventListener('click', abrirAjustes);
  conectarCuenta(el, () => pintarPanelPerfil(abrirAjustes));
}

const hora = (d) => d ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';

function seccionCuenta() {
  const u = usuarioActual();
  if (u) return `
    <section class="grupo">
      <p class="grupo-titulo">Cuenta <small>Sincronizada</small></p>
      <p class="nota" style="margin-top:0">Conectado como <b>${esc(u.email || 'tu cuenta')}</b>. Tus datos se comparten entre el Mac y el iPhone.${ultimaSync ? ` Última sincronización: ${hora(ultimaSync)}.` : ''}</p>
      <div class="botones">
        <button type="button" class="boton" id="sync-ahora">Sincronizar ahora</button>
        <button type="button" class="boton" id="cerrar-sesion">Cerrar sesión</button>
      </div>
    </section>`;
  return `
    <section class="grupo">
      <p class="grupo-titulo">Cuenta</p>
      <form class="form-cuenta" id="form-cuenta">
        <input class="campo" type="email" name="correo" placeholder="Correo" required autocomplete="email">
        <input class="campo" type="password" name="clave" placeholder="Contraseña (mínimo 6 caracteres)" required minlength="6" autocomplete="current-password">
        <div class="botones"><button type="submit" class="boton primario" value="entrar">Entrar</button><button type="submit" class="boton" value="crear">Crear cuenta</button></div>
      </form>
      <p class="nota" id="nota-cuenta">Usa el mismo correo y contraseña en el Mac y en el iPhone para tener los mismos datos. Gratis.</p>
    </section>`;
}

function conectarCuenta(el, repintar) {
  const nota = el.querySelector('#nota-cuenta');
  const fallo = (e) => { if (nota) nota.textContent = 'No se ha podido: ' + (e.message || e); };
  el.querySelector('#form-cuenta')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const correo = e.target.correo.value.trim(), clave = e.target.clave.value;
    const crear = e.submitter?.value === 'crear';
    try {
      if (crear) {
        const conSesion = await crearCuenta(correo, clave);
        if (!conSesion) { nota.textContent = `Cuenta creada. Abre el correo que te ha llegado a ${correo} para confirmarla (da igual en qué navegador) y luego pulsa Entrar aquí.`; return; }
      } else await entrarConClave(correo, clave);
      repintar();
    } catch (err) {
      fallo(/invalid login/i.test(err.message) ? new Error('correo o contraseña incorrectos.') : /not confirmed/i.test(err.message) ? new Error('falta confirmar la cuenta desde el correo que te llegó.') : err);
    }
  });
  el.querySelector('#sync-ahora')?.addEventListener('click', async () => { await sincronizar(); repintar(); });
  el.querySelector('#cerrar-sesion')?.addEventListener('click', async () => { await salir(); repintar(); });
}
