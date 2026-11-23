/* =========================================================
   REGISTRO DE SECCIONES
   Para añadir una sección nueva:
     1. Añade un objeto a esta lista (id, nombre, icono, color, subapartados).
     2. Crea js/secciones/<id>.js con una función render(sub, contenedor).
   La navegación de Mac e iPhone se genera sola a partir de esta lista.
   ========================================================= */

export const SECCIONES = [
  {
    id: 'inicio',
    nombre: 'Inicio',
    icono: 'inicio',
    color: 'lavanda',
    subapartados: [{ id: 'resumen', nombre: 'Resumen' }],
  },
  {
    id: 'calendario',
    nombre: 'Calendario',
    icono: 'calendario',
    color: 'cielo',
    subapartados: [{ id: 'general', nombre: 'General' }],
  },
  {
    id: 'fitness',
    nombre: 'Fitness',
    icono: 'fitness',
    color: 'menta',
    subapartados: [
      { id: 'inicio', nombre: 'Inicio' },
      { id: 'calendario', nombre: 'Calendario' },
      { id: 'ejercicios', nombre: 'Ejercicios' },
      { id: 'dieta', nombre: 'Dieta' },
    ],
  },
  {
    id: 'notas',
    nombre: 'Notas',
    icono: 'notas',
    color: 'rosa',
    subapartados: [{ id: 'notas', nombre: 'Notas' }, { id: 'porcentajes', nombre: 'Porcentajes' }],
  },
  {
    id: 'finanzas',
    nombre: 'Finanzas',
    icono: 'finanzas',
    color: 'melocoton',
    subapartados: [{ id: 'inicio', nombre: 'Inicio' }],
  },
];

export const buscarSeccion = (id) => SECCIONES.find((s) => s.id === id);
