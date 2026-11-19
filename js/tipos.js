/* Tipos de evento del calendario */
export const TIPOS = {
  recordatorio: { nombre: 'Recordatorio', plural: 'recordatorios', color: 'lavanda' },
  tarea:   { nombre: 'Tarea / entrega', plural: 'tareas', color: 'limon' },
  examen:  { nombre: 'Examen',  plural: 'exámenes', color: 'rosa' },
  clase:   { nombre: 'Clase',   plural: 'clases',   color: 'cielo' },
  evento:  { nombre: 'Evento',  plural: 'eventos',  color: 'melocoton' },
  cita:    { nombre: 'Cita',    plural: 'citas',    color: 'lavanda' },
  deporte: { nombre: 'Deporte', plural: 'entrenos', color: 'menta' },
  festivo: { nombre: 'Festivo', plural: 'festivos', color: 'rosa' },
};
/** Tipos que cuentan como prioridad el día que tocan */
export const TIPOS_PRIORIDAD = ['recordatorio', 'tarea', 'examen'];
