// seed.js — datos de partida. Solo se cargan en la primera apertura de la app (o en una
// migración); después mandan los datos del móvil. Cambiar algo aquí NO cambia una instalación
// ya sembrada: para eso hay que añadir una migración en index.html (como en Invincible Gym).
(function (root) {
  'use strict';
  const cola = typeof COLA_ABLETON !== 'undefined' ? COLA_ABLETON : (root.COLA_ABLETON || []);
  const DISPARADOR = 'Al sentarte al escritorio por la tarde, antes de abrir nada más';

  const SEED = {
    version: 1,
    activos: ['mecanica', 'ableton'], // bloque 1
    hobbies: [
      {
        id: 'mecanica', nombre: 'Ruta Mecánica', orden: 1,
        minimo: 3, ideal: 4, dias: [1, 2, 3, 4], disparador: DISPARADOR,
        tipo: 'ruta', url: 'https://claude.ai/artifact/SuFuV4qy19BT3tfnjuNZqk', textoBoton: 'Abrir la ruta',
        tarea: 'Siguiente tarea de la ruta, o sigue con la que dejaste a medias.',
        fin: 'Una tarea. Si a los 30 min no has acabado, apunta dónde la dejas: cuenta igual.',
        diaMalo: '10 min, avanzando lo que puedas y apuntando dónde lo dejas.',
      },
      {
        id: 'ableton', nombre: 'Curso de Ableton', orden: 2,
        minimo: 1, ideal: 1, dias: [5, 6, 7], disparador: DISPARADOR,
        tipo: 'cola',
        tarea: 'Míralo con Ableton abierto y repite cada paso.',
        fin: 'Acaba cuando hayas repetido el último paso del vídeo.',
        diaMalo: 'solo el vídeo, sin practicar.',
        cola,
      },
      { id: 'lectura', nombre: 'Lectura', orden: 3, minimo: 1, ideal: 1, dias: [], tipo: 'cola', cola: [],
        nota: 'Los libros y cómics sin abrir. Su lista se prepara al activarlo.' },
      { id: 'escritura', nombre: 'Escritura', orden: 4, minimo: 1, ideal: 1, dias: [], tipo: 'cola', cola: [],
        nota: 'A mano, lejos de la pantalla. Los ejercicios se preparan al activarlo.' },
      { id: 'musica', nombre: 'Piano y batería', orden: 5, minimo: 1, ideal: 1, dias: [], tipo: 'cola', cola: [],
        nota: 'Las piezas se preparan al activarlo.' },
      { id: 'control', nombre: 'Control Óptimo', orden: 6, minimo: 1, ideal: 1, dias: [], tipo: 'ruta',
        nota: 'Se estudia en horario de trabajo: fuera de esta app por ahora.' },
    ],
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SEED;
  else root.SEED = SEED;
})(typeof self !== 'undefined' ? self : this);
