/* =========================================================
   CAPA DE DATOS
   Todas las secciones guardan y leen a través de este módulo,
   nunca directamente. Ahora usa el almacenamiento local; en el
   siguiente paso se conectará a Supabase (cuenta + sincronización
   Mac/iPhone) sin tener que tocar las secciones.
   ========================================================= */

const PREFIJO = 'hub:';

function leer(coleccion) {
  try { return JSON.parse(localStorage.getItem(PREFIJO + coleccion)) ?? []; }
  catch { return []; }
}
function escribir(coleccion, filas) {
  try { localStorage.setItem(PREFIJO + coleccion, JSON.stringify(filas)); } catch {}
}
const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export const datos = {
  async listar(coleccion) { return leer(coleccion); },

  async crear(coleccion, fila) {
    const nueva = { id: nuevoId(), creado: new Date().toISOString(), ...fila };
    escribir(coleccion, [...leer(coleccion), nueva]);
    return nueva;
  },

  async actualizar(coleccion, id, cambios) {
    const filas = leer(coleccion).map((f) => (f.id === id ? { ...f, ...cambios } : f));
    escribir(coleccion, filas);
  },

  async borrar(coleccion, id) {
    escribir(coleccion, leer(coleccion).filter((f) => f.id !== id));
  },
};
