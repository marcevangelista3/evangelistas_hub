/* =========================================================
   REGISTRO PERSONAL: objetivos y pesos
   Todo en el dispositivo (hub:*) y sincronizado por nube.js.
   ========================================================= */

const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
export const iso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const deIso = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
export const sumarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const lunes = (d = new Date()) => sumarDias(d, -((d.getDay() + 6) % 7));

/* ---------- Objetivos ---------- */
export const OBJ_DEF = { kcal: 2600, prot: 160, carb: 300, gras: 80, entrenosMes: 16, ahorroMes: 400 };
export const objetivos = () => ({ ...OBJ_DEF, ...leer('hub:objetivos', {}) });
export const guardarObjetivos = (o) => escribir('hub:objetivos', { ...objetivos(), ...o });

/* ---------- Peso ---------- */
export const pesos = () => leer('hub:pesos', []).sort((a, b) => a.fecha.localeCompare(b.fecha));
export function apuntarPeso(kg, fecha = iso()) {
  const l = pesos().filter((p) => p.fecha !== fecha);
  l.push({ fecha, kg: Math.round(kg * 10) / 10 });
  escribir('hub:pesos', l.sort((a, b) => a.fecha.localeCompare(b.fecha)));
}
export const borrarPeso = (fecha) => escribir('hub:pesos', pesos().filter((p) => p.fecha !== fecha));
