// Pruebas de logic.js con datos sintéticos con trampas conocidas.
// Ejecutar con la zona horaria de Madrid:  TZ=Europe/Madrid node --test tests/logica.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const HL = require('../logic.js');

// Lunes 9 nov 2026 … domingo 15 nov 2026
const L = '2026-11-09', M = '2026-11-10', X = '2026-11-11', J = '2026-11-12', V = '2026-11-13', S = '2026-11-14', D = '2026-11-15';

const MEC = { id: 'mecanica', nombre: 'Mecánica', orden: 1, minimo: 3, ideal: 4, dias: [1, 2, 3, 4], tipo: 'ruta' };
const ABL = { id: 'ableton', nombre: 'Ableton', orden: 2, minimo: 1, ideal: 1, dias: [5, 6, 7], tipo: 'cola',
  cola: [{ id: 'a1', ref: 'Vídeo 1', min: 10 }, { id: 'a2', ref: 'Vídeo 2', min: 10 }, { id: 'a3', ref: 'Vídeo 3', min: 10 }] };
const PAUSA = { id: 'lectura', nombre: 'Lectura', orden: 3, minimo: 1, ideal: 1, dias: [], tipo: 'cola', cola: [] };
const HOBBIES = [ABL, MEC, PAUSA]; // desordenados a propósito: manda "orden"
const bloque = (extra = {}) => ({ id: 'b1', n: 1, inicio: L, semanas: 8, activos: ['mecanica', 'ableton'], comodines: 2, semanasComodin: [], cerrado: false, ...extra });
let seq = 0;
const reg = (hobbyId, fecha, extra = {}) => ({ id: 'r' + (++seq), hobbyId, fecha, hora: '18:00', tareaId: null, corta: false, completa: true, valoracion: null, ...extra });
const hoyCon = (hoy, registro, bloques = [bloque()]) => HL.tarjetaHoy({ hobbies: HOBBIES, bloques, registro, hoy });

test('la zona horaria de las pruebas es Europe/Madrid', () => {
  assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'Europe/Madrid',
    'ejecutar con TZ=Europe/Madrid: si no, la trampa de las 00:30 no prueba nada');
});

test('trampa: una sesión a las 00:30 cae en su día local, no en el de UTC', () => {
  const d = new Date(2026, 10, 10, 0, 30); // martes 10 nov, 00:30 en Madrid
  assert.equal(HL.claveLocal(d), M);
  assert.equal(d.toISOString().slice(0, 10), L, 'si esto falla, la trampa ya no existe y la prueba no vale');
});

test('día de la semana y lunes de la semana', () => {
  assert.equal(HL.diaSemana(L), 1);
  assert.equal(HL.diaSemana(D), 7);
  assert.equal(HL.lunesDe(D), L, 'el domingo pertenece a la semana que empezó el lunes anterior');
  assert.equal(HL.lunesDe(L), L);
  assert.equal(HL.lunesDe('2026-11-16'), '2026-11-16');
});

test('trampa: los cambios de hora no desplazan días ni semanas', () => {
  // 28 mar 2027 (domingo): adelanto de hora. 25 oct 2026 (domingo): retraso.
  assert.equal(HL.lunesDe('2027-03-28'), '2027-03-22');
  assert.equal(HL.sumarDias('2027-03-27', 1), '2027-03-28');
  assert.equal(HL.sumarDias('2027-03-28', 1), '2027-03-29');
  assert.equal(HL.sumarDias('2026-10-24', 2), '2026-10-26');
  assert.equal(HL.semanasEntre('2027-03-22', '2027-03-29'), 1);
  assert.equal(HL.semanasEntre('2026-10-19', '2026-10-26'), 1);
  // Un bloque de 8 semanas que cruza el cambio de marzo acaba en lunes.
  assert.equal(HL.diaSemana(HL.ultimoLunes({ inicio: '2027-03-01', semanas: 8 })), 1);
});

test('fechas mal formadas', () => {
  assert.equal(HL.esClave('2026-02-30'), false);
  assert.equal(HL.esClave('2026-2-3'), false);
  assert.equal(HL.esClave('2028-02-29'), true);
});

test('texto de los días', () => {
  assert.equal(HL.textoDias([1, 2, 3, 4]), 'lunes a jueves');
  assert.equal(HL.textoDias([7, 5, 6]), 'viernes a domingo');
  assert.equal(HL.textoDias([2, 6]), 'martes y sábado');
  assert.equal(HL.textoDias([1, 3, 5]), 'lunes, miércoles y viernes');
  assert.equal(HL.textoDias([]), 'ningún día fijo');
});

test('inicio del primer bloque: de lunes a jueves, esta semana; de viernes a domingo, la siguiente', () => {
  assert.equal(HL.inicioPrimerBloque('2026-11-08'), L); // domingo de hoy
  assert.equal(HL.inicioPrimerBloque(J), L);
  assert.equal(HL.inicioPrimerBloque(V), '2026-11-16');
});

test('qué toca: lunes sin nada hecho → mecánica, sin secundario', () => {
  const t = hoyCon(L, []);
  assert.equal(t.tipo, 'toca');
  assert.equal(t.principal, 'mecanica');
  assert.equal(t.secundario, null, 'Ableton no toca el lunes y aún le quedan días');
});

test('qué toca: lunes ya hecho → no vuelve a pedir mecánica el mismo día', () => {
  const t = hoyCon(L, [reg('mecanica', L)]);
  assert.equal(t.tipo, 'nada');
  assert.equal(t.hechoHoy, true);
  assert.equal(t.cumplida, false);
});

test('qué toca: jueves con 3 de mecánica → sigue tocando (ideal 4)', () => {
  const t = hoyCon(J, [reg('mecanica', L), reg('mecanica', M), reg('mecanica', X)]);
  assert.equal(t.principal, 'mecanica');
  assert.equal(t.principalRecupera, false);
});

test('qué toca: viernes con mecánica en 2 → Ableton y, después, recuperar mecánica', () => {
  const t = hoyCon(V, [reg('mecanica', L), reg('mecanica', X)]);
  assert.equal(t.tipo, 'toca');
  assert.equal(t.principal, 'ableton');
  assert.equal(t.secundario, 'mecanica');
  assert.equal(t.secundarioRecupera, true);
});

test('qué toca: viernes con mecánica en 3 → solo Ableton (el ideal no se recupera)', () => {
  const t = hoyCon(V, [reg('mecanica', L), reg('mecanica', M), reg('mecanica', X)]);
  assert.equal(t.principal, 'ableton');
  assert.equal(t.secundario, null);
});

test('qué toca: sábado con todo cumplido → nada, semana cumplida', () => {
  const t = hoyCon(S, [reg('mecanica', L), reg('mecanica', M), reg('mecanica', X), reg('ableton', V)]);
  assert.equal(t.tipo, 'nada');
  assert.equal(t.cumplida, true);
});

test('qué toca: domingo con Ableton hecho hoy y mecánica en 2 → recuperar mecánica', () => {
  const t = hoyCon(D, [reg('mecanica', L), reg('mecanica', M), reg('ableton', D)]);
  assert.equal(t.tipo, 'recupera');
  assert.equal(t.principal, 'mecanica');
});

test('qué toca: miércoles con 0 de mecánica → la pide aunque ya no llegue al mínimo sin doblar', () => {
  assert.equal(hoyCon(X, []).principal, 'mecanica');
});

test('qué toca, con hobbies distintos a los reales (para no ajustar la lógica a un solo caso)', () => {
  const A = { id: 'a', nombre: 'A', orden: 1, minimo: 2, ideal: 3, dias: [2, 6], tipo: 'cola', cola: [] };
  const B = { id: 'b', nombre: 'B', orden: 2, minimo: 1, ideal: 1, dias: [7], tipo: 'cola', cola: [] };
  const b = { id: 'x', n: 1, inicio: L, semanas: 4, activos: ['a', 'b'], comodines: 1, semanasComodin: [] };
  const t = r => HL.tarjetaHoy({ hobbies: [A, B], bloques: [b], registro: r, hoy: r.hoy });
  const lunes = Object.assign([], { hoy: L });
  assert.equal(t(lunes).tipo, 'nada', 'lunes no toca nada');
  const martes = Object.assign([], { hoy: M });
  assert.equal(t(martes).principal, 'a');
  const domingo = Object.assign([reg('a', M)], { hoy: D });
  const td = t(domingo);
  assert.equal(td.principal, 'b', 'el domingo toca B');
  assert.equal(td.secundario, 'a', 'y A, con 1 de 2 y sin días por delante, a recuperar');
});

test('casillas de la tira', () => {
  const b = bloque();
  const c = (lunes, registro, hoy = '2026-11-25', bb = b) => HL.casilla({ bloque: bb, hobbies: HOBBIES, registro, lunes, hoy });
  const llena = [reg('mecanica', L), reg('mecanica', M), reg('mecanica', X), reg('ableton', S)];
  assert.equal(c(L, llena), 'cumplida');
  assert.equal(c(L, [reg('mecanica', L)]), 'parcial');
  assert.equal(c(L, [reg('mecanica', L), reg('mecanica', M), reg('mecanica', X)]), 'parcial', 'falta Ableton');
  assert.equal(c(L, []), 'fallada');
  assert.equal(c(L, [reg('mecanica', L)], X), 'encurso', 'la semana en curso no se juzga');
  assert.equal(c(L, llena, D), 'cumplida', 'la semana en curso ya cumplida sale cumplida');
  assert.equal(c('2026-11-30', [], X), 'futura');
  assert.equal(c(L, [], X, bloque({ semanasComodin: [L] })), 'comodin');
  assert.equal(c('2026-11-02', []), 'fuera', 'antes del bloque');
  assert.equal(c('2027-01-04', []), 'fuera', 'después de las 8 semanas');
  // Una sesión del domingo cuenta en su semana; la del lunes siguiente, en la otra.
  assert.equal(c(L, [reg('mecanica', L), reg('mecanica', M), reg('mecanica', X), reg('ableton', D)]), 'cumplida');
  assert.equal(c(L, [reg('mecanica', L), reg('mecanica', M), reg('mecanica', X), reg('ableton', '2026-11-16')]), 'parcial');
  // Un hobby en pausa no cuenta para nada (D3): su sesión no convierte la semana en «a medias».
  assert.equal(c(L, [reg('lectura', L)]), 'fallada');
});

test('tira de 8 semanas con la actual marcada', () => {
  const t = HL.tira({ bloque: bloque(), hobbies: HOBBIES, registro: [], hoy: '2026-11-18' });
  assert.equal(t.length, 8);
  assert.deepEqual(t.map(s => s.estado).slice(0, 3), ['fallada', 'encurso', 'futura']);
  assert.equal(t[1].actual, true);
  assert.equal(t[7].lunes, '2026-12-28');
});

test('bloques: antes de empezar, fin de bloque, cerrado y solapados', () => {
  assert.equal(hoyCon('2026-11-08', []).tipo, 'antes');
  assert.equal(hoyCon('2027-01-04', []).tipo, 'finBloque', 'la semana 9 pide decidir');
  assert.equal(hoyCon('2027-01-04', [], [bloque({ cerrado: true })]).tipo, 'sinBloque');
  // Cambio a mitad: el bloque 1 se recorta a 2 semanas y el 2 empieza en la tercera.
  const b1 = bloque({ semanas: 2, cerrado: true });
  const b2 = bloque({ id: 'b2', n: 2, inicio: '2026-11-23', activos: ['mecanica'] });
  assert.equal(HL.bloqueDeSemana([b1, b2], '2026-11-23').id, 'b2');
  assert.equal(HL.bloqueDeSemana([b1, b2], '2026-11-16').id, 'b1');
  // Si se solapan, manda el que empezó más tarde.
  const b3 = bloque({ id: 'b3', inicio: '2026-11-16' });
  assert.equal(HL.bloqueDeSemana([bloque(), b3], '2026-11-16').id, 'b3');
  assert.equal(HL.semanaDelBloque(bloque(), '2026-11-23'), 3);
});

test('cola: avanza con lo completado, no con lo que quedó a medias, e ignora ids desconocidos', () => {
  let q = HL.siguienteDeCola(ABL, []);
  assert.equal(q.tarea.id, 'a1'); assert.equal(q.numero, 1); assert.equal(q.total, 3);
  q = HL.siguienteDeCola(ABL, [reg('ableton', V, { tareaId: 'a1', completa: false })]);
  assert.equal(q.tarea.id, 'a1'); assert.equal(q.aMedias, true);
  q = HL.siguienteDeCola(ABL, [reg('ableton', V, { tareaId: 'a1' }), reg('ableton', S, { tareaId: 'zz' })]);
  assert.equal(q.tarea.id, 'a2'); assert.equal(q.numero, 2); assert.equal(q.aMedias, false);
  // Hecha fuera de orden (p. ej. tras importar): sigue por la primera pendiente.
  q = HL.siguienteDeCola(ABL, [reg('ableton', V, { tareaId: 'a2' })]);
  assert.equal(q.tarea.id, 'a1'); assert.equal(q.numero, 2);
  q = HL.siguienteDeCola(ABL, ['a1', 'a2', 'a3'].map(id => reg('ableton', V, { tareaId: id })));
  assert.equal(q.fin, true);
  assert.equal(HL.siguienteDeCola(MEC, []), null, 'una ruta no tiene cola');
});

test('comodines: solo la semana en curso, hasta 2, y devolverlo solo esa semana', () => {
  const b = bloque();
  assert.equal(HL.puedeUsarComodin(b, M), true);
  b.semanasComodin.push(L);
  assert.equal(HL.puedeUsarComodin(b, M), false, 'ya usado esta semana');
  assert.equal(HL.puedeDevolverComodin(b, M), true);
  assert.equal(HL.puedeDevolverComodin(b, '2026-11-17'), false, 'la semana pasada ya está cerrada');
  assert.equal(HL.puedeUsarComodin(b, '2026-11-17'), true);
  b.semanasComodin.push('2026-11-16');
  assert.equal(HL.puedeUsarComodin(b, '2026-11-24'), false, 'sin comodines libres');
  assert.equal(HL.comodinesLibres(b), 0);
  assert.equal(HL.puedeUsarComodin(bloque(), '2027-01-05'), false, 'fuera del bloque');
  assert.equal(hoyCon(M, [], [bloque({ semanasComodin: [L] })]).tipo, 'comodin');
});

test('días que se pueden marcar: de lunes a hoy', () => {
  assert.deepEqual(HL.diasMarcables(X), [L, M, X]);
  assert.deepEqual(HL.diasMarcables(L), [L]);
});

test('resumen del bloque', () => {
  const b = bloque({ semanasComodin: ['2026-11-16'] });
  const registro = [
    reg('mecanica', L, { valoracion: 'gusto' }), reg('mecanica', M, { valoracion: 'rastras', corta: true }), reg('mecanica', X),
    reg('ableton', V, { tareaId: 'a1', valoracion: 'normal' }),
    reg('mecanica', '2026-11-23'),
    reg('mecanica', '2027-01-04'), // fuera del bloque
  ];
  const r = HL.resumenBloque({ bloque: b, hobbies: HOBBIES, registro, hoy: '2027-01-04' });
  const mec = r.porHobby.find(h => h.id === 'mecanica');
  assert.equal(mec.sesiones, 4);
  assert.equal(mec.semanasEvaluables, 7, '8 semanas menos el comodín');
  assert.equal(mec.semanasConMinimo, 1);
  assert.deepEqual(mec.valoraciones, { gusto: 1, normal: 0, rastras: 1 });
  assert.equal(mec.cortas, 1);
  assert.equal(r.total, 5);
  assert.equal(r.comodinesUsados, 1);
  const txt = HL.textoResumen(r);
  assert.match(txt, /bloque 1 \(9 nov – 3 ene\)/);
  assert.match(txt, /Semanas: ■─◧□□□□□/, 'semana 3 con una sola sesión de mecánica: a medias');
  assert.match(txt, /va por la sesión 2 de 3/);
  assert.match(txt, /Ableton \(mínimo 1, viernes a domingo\): 1 sesión;/, 'singular');
  assert.match(txt, /1 versión corta/);
});

test('importar: actualizar la cola de uno, añadir otro, sin tocar la lista original', () => {
  const original = JSON.parse(JSON.stringify(HOBBIES));
  const { hobbies, cambios } = HL.aplicarImportacion(HOBBIES, { hobbies: [
    { id: 'lectura', cola: [{ id: 'l1', titulo: 'Leer 25 min de X', min: 25 }], dias: [6] },
    { id: 'dibujo', nombre: 'Dibujo', minimo: 2, dias: [2, 4] },
  ] });
  assert.deepEqual(HOBBIES, original, 'no muta la lista original');
  assert.equal(hobbies.find(h => h.id === 'lectura').cola.length, 1);
  assert.deepEqual(hobbies.find(h => h.id === 'lectura').dias, [6]);
  const dib = hobbies.find(h => h.id === 'dibujo');
  assert.equal(dib.ideal, 2, 'el ideal sube al mínimo si no se da');
  assert.equal(dib.tipo, 'ruta', 'sin lista de tareas, es de tarea fija');
  assert.equal(cambios.length, 2);
  const conCola = HL.aplicarImportacion(HOBBIES, { id: 'piano', nombre: 'Piano', cola: [{ id: 'p1', ref: 'Pieza 1' }] }).hobbies.find(h => h.id === 'piano');
  assert.equal(conCola.tipo, 'cola', 'con lista de tareas, es de cola');
  // Un solo objeto también vale.
  assert.equal(HL.aplicarImportacion(HOBBIES, { id: 'lectura', nota: 'x' }).hobbies.find(h => h.id === 'lectura').nota, 'x');
});

test('importar: errores que tienen que saltar', () => {
  const mal = d => assert.throws(() => HL.aplicarImportacion(HOBBIES, d));
  mal({});
  mal({ hobbies: [] });
  mal({ hobbies: [{ id: 'Mal Id', nombre: 'x' }] });
  mal({ hobbies: [{ id: 'nuevo' }] }); // nuevo sin nombre
  mal({ hobbies: [{ id: 'lectura', dias: [0, 8] }] });
  mal({ hobbies: [{ id: 'lectura', cola: [{ id: 'a', titulo: 'x' }, { id: 'a', titulo: 'y' }] }] });
  mal({ hobbies: [{ id: 'lectura', cola: [{ id: 'a' }] }] }); // sin texto
  mal({ hobbies: [{ id: 'mecanica', ideal: 2 }] }); // ideal < mínimo 3
  mal({ hobbies: [{ id: 'mecanica', url: 'javascript:alert(1)' }] });
  mal({ hobbies: [{ id: 'mecanica', tipo: 'otro' }] });
});

test('copia de seguridad: valida la forma', () => {
  const buena = { app: 'AppHobbies', hobbies: [], registro: [reg('mecanica', L)], bloques: [bloque()], ajustes: [] };
  assert.equal(HL.validarCopia(buena), true);
  assert.throws(() => HL.validarCopia({ ...buena, app: 'InvincibleGym' }));
  assert.throws(() => HL.validarCopia({ ...buena, registro: [{ id: 'x', fecha: '2026-13-01', hobbyId: 'a' }] }));
  assert.throws(() => HL.validarCopia({ ...buena, bloques: undefined }));
});

test('datos reales: la cola de Ableton y los hobbies de partida son coherentes', () => {
  const ctx = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'cola-ableton.js'), 'utf8') + ';this.COLA_ABLETON = COLA_ABLETON;', ctx);
  const cola = ctx.COLA_ABLETON;
  assert.equal(cola.length, 45);
  assert.equal(cola[0].id, 'ab-1.1', 'empieza por el principio del curso');
  assert.equal(new Set(cola.map(t => t.id)).size, cola.length);
  assert.ok(cola.every(t => t.min > 0 && t.min <= 18), 'ninguna sesión pasa de 18 min de vídeo');
  assert.ok(!cola.some(t => /Mac/.test(t.titulo)), 'sin el vídeo de Mac');
  globalThis.COLA_ABLETON = cola;
  const SEED = require('../seed.js');
  const { hobbies } = HL.aplicarImportacion([], { hobbies: SEED.hobbies }); // pasa la misma validación que una importación
  assert.equal(hobbies.length, 6);
  assert.deepEqual(SEED.activos, ['mecanica', 'ableton']);
  const mec = SEED.hobbies.find(h => h.id === 'mecanica');
  assert.deepEqual([mec.minimo, mec.ideal, mec.dias], [3, 4, [1, 2, 3, 4]]);
  assert.equal(SEED.hobbies.find(h => h.id === 'ableton').cola.length, 45);
});
