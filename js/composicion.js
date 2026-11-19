/* =========================================================
   COMPOSICIÓN CORPORAL ESTIMADA
   No sustituye a una báscula de bioimpedancia ni a un DEXA:
   son fórmulas antropométricas publicadas y validadas.
   - % de grasa: método de la Marina de EE. UU. (Hodgdon y Beckett, 1984)
   - Masa muscular esquelética: ecuación de Lee et al. (2000)
   - Agua corporal total: fórmula de Watson (1980)
   ========================================================= */

const CLAVE = 'hub:fisico';
export const FISICO_DEMO = { sexo: 'hombre', edad: 20, altura: 178, cuello: 38, cintura: 81, cadera: 95 };

export function cargarFisico() {
  try { return { ...FISICO_DEMO, ...JSON.parse(localStorage.getItem(CLAVE)) }; } catch { return { ...FISICO_DEMO }; }
}
export function guardarFisico(f) { try { localStorage.setItem(CLAVE, JSON.stringify(f)); } catch {} }

/** % de grasa corporal (Marina de EE. UU.), medidas en cm */
export function grasa({ sexo, altura, cuello, cintura, cadera }) {
  const log = Math.log10;
  const v = sexo === 'mujer'
    ? 495 / (1.29579 - 0.35004 * log(cintura + cadera - cuello) + 0.221 * log(altura)) - 450
    : 495 / (1.0324 - 0.19077 * log(cintura - cuello) + 0.15456 * log(altura)) - 450;
  return Math.max(3, Math.min(60, v));
}

/** Masa muscular esquelética en kg (Lee et al., 2000) */
export const musculo = ({ sexo, edad, altura }, peso) =>
  0.244 * peso + 7.8 * (altura / 100) - 0.098 * edad + 6.6 * (sexo === 'mujer' ? 0 : 1) - 3.3;

/** Agua corporal total en litros (Watson) */
export const agua = ({ sexo, edad, altura }, peso) => sexo === 'mujer'
  ? -2.097 + 0.1069 * altura + 0.2466 * peso
  : 2.447 - 0.09156 * edad + 0.1074 * altura + 0.3362 * peso;

/** Serie semanal a partir de los pesos y (opcional) las cinturas de cada semana */
export function serie(fisico, pesos, cinturas) {
  return pesos.map((p, i) => {
    const f = { ...fisico, cintura: cinturas?.[i] ?? fisico.cintura };
    const bf = grasa(f);
    return { peso: p, grasa: bf, magra: p * (1 - bf / 100), musculo: musculo(f, p), agua: agua(f, p), aguaPct: (agua(f, p) / p) * 100 };
  });
}
