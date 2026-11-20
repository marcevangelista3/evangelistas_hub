/* =========================================================
   ELENA: la asistente de la app (Gemini gratis vía Supabase)
   - Le cuentas tu día y propone lo que hay que apuntar.
   - Tú confirmas y se guarda en calendario, dieta, entrenos,
     peso o gastos.
   ========================================================= */
import { iso, deIso, sumarDias, objetivos, pesos, apuntarPeso } from './registro.js';
import { crearEvento, eventos } from './agenda.js';
import { TIPOS } from './tipos.js';
import { alimentos, buscarAlimento, anadirAlimento, anadirAComida, totalesDia } from './nutricion.js';
import * as E from './entrenos.js';

const fLarga = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fCorta = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const r0 = (v) => Math.round(v);

/** Lo que Elena sabe de la app en cada mensaje */
export async function contexto() {
  const hoy = new Date();
  const p = [`Hoy es ${fLarga.format(hoy)} (${iso(hoy)}), son las ${hoy.toTimeString().slice(0, 5)}.`];
  const prox = eventos().filter((e) => e.fecha >= iso(hoy) && e.fecha <= iso(sumarDias(hoy, 21)))
    .sort((a, b) => (a.fecha + (a.ini || '')).localeCompare(b.fecha + (b.ini || ''))).slice(0, 30);
  p.push(prox.length ? 'Calendario de las próximas 3 semanas:\n' + prox.map((e) => `- ${e.fecha}${e.ini ? ' ' + e.ini : ''}: ${e.titulo} (${TIPOS[e.tipo]?.nombre || e.tipo}${e.hecha ? ', hecho' : ''})`).join('\n') : 'Calendario: nada en las próximas 3 semanas.');
  const t = totalesDia(), O = objetivos();
  p.push(`Dieta de hoy: ${r0(t.kcal)} de ${O.kcal} kcal, proteína ${r0(t.p)}/${O.prot} g, carbohidratos ${r0(t.c)}/${O.carb} g, grasas ${r0(t.g)}/${O.gras} g.`);
  p.push('Alimentos conocidos: ' + Object.keys(alimentos()).join(', ') + '.');
  const rut = E.rutinas();
  p.push(rut.length ? `Sus rutinas: ${rut.map((x) => x.nombre).join(', ')}.` : 'Aún no tiene rutinas creadas.');
  const h = E.historial().slice(0, 5);
  if (h.length) p.push('Últimos entrenos: ' + h.map((s) => `${s.fecha} ${s.nombre} (${s.minutos} min)`).join('; ') + '.');
  const pe = pesos().slice(-3);
  if (pe.length) p.push('Últimos pesos: ' + pe.map((x) => `${x.fecha} ${x.kg} kg`).join('; ') + '.');
  try {
    const { correos } = await import('./correo.js');
    const cs = correos().slice(0, 15);
    if (cs.length) p.push('Correos recientes de su Gmail (bandeja principal):\n' + cs.map((c) => `- ${new Date(c.fecha).toISOString().slice(0, 10)} · de ${c.de}${c.noLeido ? ' · sin leer' : ''}${c.importante ? ' · importante' : ''}: «${c.asunto}» ${c.fragmento.slice(0, 160)}`).join('\n'));
  } catch {}
  try {
    const F = await import('./finanzas-datos.js');
    const { movimientosGuardados } = await import('./importar.js');
    if (movimientosGuardados().length) {
      F.usarMovimientos(movimientosGuardados());
      const r = F.resumenMes(F.MESES.length - 1);
      p.push(`Finanzas de ${F.MESES_LARGOS.at(-1)}: ingresos ${r.ingresos.toFixed(2)} €, gastos ${r.gastos.toFixed(2)} €. Por categoría: ${r.categorias.map((c) => `${c.nombre} ${c.valor} €`).join(', ')}. Objetivo de ahorro: ${O.ahorroMes} €/mes.`);
    }
  } catch {}
  return p.join('\n');
}

/** Texto corto de cada acción para la tarjeta de confirmación */
export function describir({ nombre, args: a }) {
  const cuando = (f) => (!f || f === iso() ? 'hoy' : f === iso(sumarDias(new Date(), 1)) ? 'mañana' : fCorta.format(deIso(f)));
  switch (nombre) {
    case 'crear_evento': return { icono: 'calendario', texto: `${TIPOS[a.tipo]?.nombre || 'Evento'}: ${a.titulo}`, detalle: `${cuando(a.fecha)}${a.ini ? ' a las ' + a.ini : ''}${a.importancia === 'alta' ? ' · importante' : ''}` };
    case 'anadir_comida': return { icono: 'dieta', texto: `${a.alimento} · ${r0(a.gramos)} g`, detalle: `${a.comida}${a.fecha && a.fecha !== iso() ? ' de ' + cuando(a.fecha) : ''} · ${r0((a.kcal_100g * a.gramos) / 100)} kcal` };
    case 'registrar_entreno': return { icono: 'fitness', texto: `Entreno: ${a.nombre}`, detalle: `${cuando(a.fecha)} · ${r0(a.minutos || 60)} min${a.ejercicios?.length ? ` · ${a.ejercicios.length} ejercicios` : ''}` };
    case 'registrar_peso': return { icono: 'grafico', texto: `Peso: ${String(a.kg).replace('.', ',')} kg`, detalle: cuando(a.fecha) };
    case 'apuntar_gasto': return { icono: 'finanzas', texto: `${a.importe < 0 ? 'Gasto' : 'Ingreso'}: ${a.concepto}`, detalle: `${Math.abs(a.importe).toFixed(2).replace('.', ',')} € · ${cuando(a.fecha)}` };
    default: return { icono: 'chispa', texto: nombre, detalle: '' };
  }
}

/** Guarda una acción confirmada */
export async function aplicar({ nombre, args: a }) {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(a.fecha || '') ? a.fecha : iso();
  switch (nombre) {
    case 'crear_evento': crearEvento({ ...a, fecha, importancia: a.importancia || (['tarea', 'examen'].includes(a.tipo) ? 'alta' : 'media') }); break;
    case 'anadir_comida': {
      const clave = buscarAlimento(a.alimento) || anadirAlimento(cap(a.alimento), [a.kcal_100g, a.proteina_100g, a.carbos_100g, a.grasas_100g]);
      anadirAComida(a.comida || 'Comida', clave, +a.gramos || 100, fecha); break;
    }
    case 'registrar_entreno': E.registrarEntreno({ ...a, fecha, minutos: +a.minutos || 60 }); break;
    case 'registrar_peso': apuntarPeso(+a.kg, fecha); break;
    case 'apuntar_gasto': {
      const { guardarMovimientos } = await import('./importar.js');
      const { clasificar } = await import('./finanzas-datos.js');
      const importe = Math.round(+a.importe * 100) / 100;
      await guardarMovimientos([{ banco: 'Efectivo', fecha: deIso(fecha), concepto: a.concepto, importe, moneda: 'EUR', cat: clasificar(a.concepto, importe), huella: `Efectivo|${fecha}|${importe.toFixed(2)}|${Date.now()}` }]);
      break;
    }
  }
}
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
