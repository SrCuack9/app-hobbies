// logic.js — lógica pura de App Hobbies: fechas, semanas, bloques, qué toca hoy.
// Sin DOM ni IndexedDB, para poder probarla con `node --test tests/`.
// Fechas siempre como 'YYYY-MM-DD' en hora LOCAL; la aritmética de días se hace en UTC sobre
// esas claves, así un cambio de hora (marzo, octubre) no desplaza ningún día.
(function (root) {
  'use strict';

  const DIA_MS = 86400000;
  const pad = n => String(n).padStart(2, '0');
  const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // ---------- Fechas ----------
  function claveLocal(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function esClave(k) {
    if (typeof k !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
    const [y, m, d] = k.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }
  function aUTC(k) {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  function desdeUTC(ms) {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  function sumarDias(k, n) { return desdeUTC(aUTC(k) + n * DIA_MS); }
  // 1 = lunes … 7 = domingo
  function diaSemana(k) { const w = new Date(aUTC(k)).getUTCDay(); return w === 0 ? 7 : w; }
  function lunesDe(k) { return sumarDias(k, 1 - diaSemana(k)); }
  function semanasEntre(a, b) { return Math.round((aUTC(lunesDe(b)) - aUTC(lunesDe(a))) / (7 * DIA_MS)); }

  function fechaCorta(k) {
    const [, m, d] = k.split('-').map(Number);
    return `${d} ${MESES[m - 1]}`;
  }
  function fechaLarga(k) { return `${DIAS[diaSemana(k)]} ${fechaCorta(k)}`; }

  // [1,2,3,4] -> 'lunes a jueves'; [2,6] -> 'martes y sábado'; [3] -> 'miércoles'
  function textoDias(dias) {
    const ds = [...new Set(dias || [])].filter(d => d >= 1 && d <= 7).sort((a, b) => a - b);
    if (ds.length === 0) return 'ningún día fijo';
    if (ds.length === 7) return 'todos los días';
    const contiguo = ds.every((d, i) => i === 0 || d === ds[i - 1] + 1);
    if (contiguo && ds.length >= 3) return `${DIAS[ds[0]]} a ${DIAS[ds[ds.length - 1]]}`;
    const nombres = ds.map(d => DIAS[d]);
    return nombres.length === 1 ? nombres[0] : nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
  }

  // ---------- Bloques ----------
  // Primer bloque: de lunes a jueves empieza esta semana; de viernes a domingo, el lunes siguiente.
  function inicioPrimerBloque(hoy) {
    return diaSemana(hoy) <= 4 ? lunesDe(hoy) : sumarDias(lunesDe(hoy), 7);
  }
  function ultimoLunes(b) { return sumarDias(b.inicio, (b.semanas - 1) * 7); }
  function contiene(b, lunes) { return lunes >= b.inicio && lunes <= ultimoLunes(b); }
  function semanaDelBloque(b, lunes) { return contiene(b, lunes) ? semanasEntre(b.inicio, lunes) + 1 : null; }
  // Si dos bloques se solapan (un cambio a mitad), manda el que empezó más tarde.
  function bloqueDeSemana(bloques, lunes) {
    const c = (bloques || []).filter(b => contiene(b, lunes));
    return c.sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0] || null;
  }
  function ultimoBloque(bloques) {
    return [...(bloques || [])].sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0] || null;
  }
  // El bloque que manda hoy: el de esta semana; si no hay, el último (futuro o ya acabado).
  function bloqueVigente(bloques, hoy) {
    return bloqueDeSemana(bloques, lunesDe(hoy)) || ultimoBloque(bloques);
  }
  function activosDe(bloque, hobbies) {
    if (!bloque) return [];
    return (hobbies || []).filter(h => bloque.activos.includes(h.id))
      .sort((a, b) => (a.orden || 99) - (b.orden || 99));
  }

  // ---------- Registro ----------
  function sesionesSemana(registro, hobbyId, lunes) {
    const fin = sumarDias(lunes, 6);
    return (registro || []).filter(r => r.hobbyId === hobbyId && r.fecha >= lunes && r.fecha <= fin);
  }
  function cuentaSemana(registro, hobbyId, lunes) { return sesionesSemana(registro, hobbyId, lunes).length; }
  function techo(h) { return Math.max(h.ideal || 0, h.minimo || 1); }

  function siguienteDeCola(h, registro) {
    if (!h || h.tipo !== 'cola') return null;
    const cola = h.cola || [];
    const propias = (registro || []).filter(r => r.hobbyId === h.id && r.tareaId);
    const hechas = new Set(propias.filter(r => r.completa !== false).map(r => r.tareaId));
    const idx = cola.findIndex(t => !hechas.has(t.id));
    const nHechas = cola.filter(t => hechas.has(t.id)).length;
    if (idx < 0) return { fin: true, hechas: nHechas, total: cola.length };
    const tarea = cola[idx];
    const aMedias = propias.some(r => r.tareaId === tarea.id && r.completa === false);
    return { fin: false, tarea, numero: nHechas + 1, total: cola.length, aMedias };
  }

  // ---------- La semana ----------
  // Casilla de la tira: 'cumplida' | 'parcial' | 'fallada' | 'comodin' | 'encurso' | 'futura' | 'fuera' | 'vacia'
  function casilla({ bloque, hobbies, registro, lunes, hoy }) {
    if (!bloque || !contiene(bloque, lunes)) return 'fuera';
    if ((bloque.semanasComodin || []).includes(lunes)) return 'comodin';
    const lunHoy = lunesDe(hoy);
    if (lunes > lunHoy) return 'futura';
    const activos = activosDe(bloque, hobbies);
    if (activos.length === 0) return 'vacia';
    const cuentas = activos.map(h => cuentaSemana(registro, h.id, lunes));
    const todos = activos.every((h, i) => cuentas[i] >= h.minimo);
    if (todos) return 'cumplida';
    if (lunes === lunHoy) return 'encurso';
    return cuentas.some(c => c > 0) ? 'parcial' : 'fallada';
  }
  function tira({ bloque, hobbies, registro, hoy }) {
    if (!bloque) return [];
    return Array.from({ length: bloque.semanas }, (_, i) => {
      const lunes = sumarDias(bloque.inicio, 7 * i);
      return { lunes, n: i + 1, estado: casilla({ bloque, hobbies, registro, lunes, hoy }), actual: lunes === lunesDe(hoy) };
    });
  }
  function semanaHobbies({ bloque, hobbies, registro, hoy }) {
    const lunes = lunesDe(hoy);
    return activosDe(bloque, hobbies).map(h => {
      const n = cuentaSemana(registro, h.id, lunes);
      return { id: h.id, nombre: h.nombre, n, minimo: h.minimo, ideal: h.ideal || h.minimo,
        estado: n >= techo(h) ? 'ideal' : n >= h.minimo ? 'minimo' : 'pendiente' };
    });
  }

  // ---------- Qué toca hoy ----------
  // tipo: 'antes' | 'finBloque' | 'sinBloque' | 'comodin' | 'toca' | 'recupera' | 'nada'
  function tarjetaHoy({ hobbies, bloques, registro, hoy }) {
    const lunes = lunesDe(hoy);
    const bloque = bloqueDeSemana(bloques, lunes);
    if (!bloque) {
      const ult = ultimoBloque(bloques);
      if (!ult) return { tipo: 'sinBloque' };
      if (ult.inicio > lunes) return { tipo: 'antes', bloque: ult };
      if (!ult.cerrado) return { tipo: 'finBloque', bloque: ult };
      return { tipo: 'sinBloque', bloque: ult };
    }
    if ((bloque.semanasComodin || []).includes(lunes)) return { tipo: 'comodin', bloque };

    const d = diaSemana(hoy);
    const activos = activosDe(bloque, hobbies);
    const n = h => cuentaSemana(registro, h.id, lunes);
    const hechoHoy = h => (registro || []).some(r => r.hobbyId === h.id && r.fecha === hoy);
    const dias = h => h.dias || [];

    const toca = activos.filter(h => dias(h).includes(d) && n(h) < techo(h) && !hechoHoy(h))
      .sort((a, b) => (n(b) < b.minimo) - (n(a) < a.minimo)); // primero los que no llegan al mínimo
    const recupera = activos.filter(h => n(h) < h.minimo && !hechoHoy(h)
      && !dias(h).includes(d) && !dias(h).some(x => x > d))
      .sort((a, b) => (b.minimo - n(b)) - (a.minimo - n(a)));
    const lista = [...toca, ...recupera.filter(h => !toca.includes(h))];
    const cumplida = activos.length > 0 && activos.every(h => n(h) >= h.minimo);
    if (lista.length === 0) return { tipo: 'nada', bloque, cumplida, hechoHoy: activos.some(hechoHoy) };
    return {
      tipo: toca.length ? 'toca' : 'recupera', bloque, cumplida,
      principal: lista[0].id,
      principalRecupera: !toca.includes(lista[0]),
      secundario: lista[1] ? lista[1].id : null,
      secundarioRecupera: lista[1] ? !toca.includes(lista[1]) : false,
    };
  }

  // ---------- Comodines ----------
  function comodinesLibres(b) { return b ? b.comodines - (b.semanasComodin || []).length : 0; }
  function puedeUsarComodin(bloque, hoy) {
    const lunes = lunesDe(hoy);
    return !!bloque && contiene(bloque, lunes) && !(bloque.semanasComodin || []).includes(lunes)
      && comodinesLibres(bloque) > 0;
  }
  function puedeDevolverComodin(bloque, hoy) {
    return !!bloque && (bloque.semanasComodin || []).includes(lunesDe(hoy));
  }
  function diasMarcables(hoy) {
    const lunes = lunesDe(hoy);
    return Array.from({ length: diaSemana(hoy) }, (_, i) => sumarDias(lunes, i));
  }

  // ---------- Fin de bloque ----------
  function resumenBloque({ bloque, hobbies, registro, hoy }) {
    const semanas = tira({ bloque, hobbies, registro, hoy });
    const comodin = new Set(bloque.semanasComodin || []);
    const fin = sumarDias(ultimoLunes(bloque), 6);
    const enBloque = (registro || []).filter(r => r.fecha >= bloque.inicio && r.fecha <= fin);
    const porHobby = activosDe(bloque, hobbies).map(h => {
      const suyas = enBloque.filter(r => r.hobbyId === h.id);
      // Solo semanas ya cerradas (antes de la actual) y sin comodín.
      const evaluables = semanas.filter(s => !comodin.has(s.lunes) && s.lunes < lunesDe(hoy));
      const conMinimo = evaluables.filter(s => cuentaSemana(registro, h.id, s.lunes) >= h.minimo).length;
      const val = { gusto: 0, normal: 0, rastras: 0 };
      suyas.forEach(r => { if (r.valoracion in val) val[r.valoracion]++; });
      return { id: h.id, nombre: h.nombre, minimo: h.minimo, ideal: h.ideal || h.minimo, dias: h.dias,
        sesiones: suyas.length, cortas: suyas.filter(r => r.corta).length,
        semanasConMinimo: conMinimo, semanasEvaluables: evaluables.length, valoraciones: val,
        cola: siguienteDeCola(h, registro) };
    });
    return { bloque, semanas, porHobby, total: enBloque.length, comodinesUsados: comodin.size, fin };
  }

  const SIMBOLO = { cumplida: '■', parcial: '◧', fallada: '□', comodin: '─', encurso: '·', futura: '·', fuera: ' ', vacia: ' ' };
  const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  function textoResumen(r) {
    const b = r.bloque;
    const lineas = [
      `App Hobbies — resumen del bloque ${b.n} (${fechaCorta(b.inicio)} – ${fechaCorta(r.fin)})`,
      `Semanas: ${r.semanas.map(s => SIMBOLO[s.estado]).join('')}  (■ cumplida · ◧ a medias · □ fallada · ─ comodín)`,
    ];
    r.porHobby.forEach(h => {
      const v = h.valoraciones;
      let l = `${h.nombre} (mínimo ${h.minimo}${h.ideal > h.minimo ? `, ideal ${h.ideal}` : ''}, ${textoDias(h.dias)}): `
        + `${pl(h.sesiones, 'sesión', 'sesiones')}; mínimo cumplido ${h.semanasConMinimo} de ${pl(h.semanasEvaluables, 'semana', 'semanas')}; `
        + `valoración: ${v.gusto} me ha gustado, ${v.normal} normal, ${v.rastras} a rastras; ${pl(h.cortas, 'versión corta', 'versiones cortas')}`;
      if (h.cola) l += h.cola.fin ? '; cola terminada' : `; va por la sesión ${h.cola.numero} de ${h.cola.total}`;
      lineas.push(l + '.');
    });
    lineas.push(`Comodines usados: ${r.comodinesUsados} de ${b.comodines}.`);
    return lineas.join('\n');
  }

  // ---------- Importar tareas / hobbies ----------
  const CAMPOS = ['nombre', 'orden', 'minimo', 'ideal', 'dias', 'disparador', 'tarea', 'fin', 'diaMalo', 'tipo', 'url', 'cola', 'nota'];
  function validarHobby(h, nuevo) {
    const err = m => { throw new Error(`Hobby «${h.id}»: ${m}`); };
    if (typeof h.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(h.id)) throw new Error('Cada hobby necesita un "id" en minúsculas, números o guiones.');
    if (nuevo && !h.nombre) err('falta "nombre".');
    if ('minimo' in h && !(Number.isInteger(h.minimo) && h.minimo >= 1 && h.minimo <= 7)) err('"minimo" debe ser un entero de 1 a 7.');
    if ('ideal' in h && !(Number.isInteger(h.ideal) && h.ideal >= 1 && h.ideal <= 7)) err('"ideal" debe ser un entero de 1 a 7.');
    if ('dias' in h && !(Array.isArray(h.dias) && h.dias.every(d => Number.isInteger(d) && d >= 1 && d <= 7))) err('"dias" es una lista de 1 (lunes) a 7 (domingo).');
    if ('tipo' in h && !['ruta', 'cola'].includes(h.tipo)) err('"tipo" es "ruta" o "cola".');
    if ('url' in h && h.url && !/^https:\/\//.test(h.url)) err('"url" tiene que empezar por https://');
    if ('cola' in h) {
      if (!Array.isArray(h.cola)) err('"cola" tiene que ser una lista.');
      const ids = new Set();
      h.cola.forEach((t, i) => {
        if (!t || typeof t.id !== 'string' || !t.id) err(`la tarea ${i + 1} no tiene "id".`);
        if (ids.has(t.id)) err(`id de tarea repetido: «${t.id}».`);
        ids.add(t.id);
        if (!t.titulo && !t.ref && !t.texto) err(`la tarea «${t.id}» no tiene texto ("titulo" o "ref").`);
        if ('min' in t && !(Number.isFinite(t.min) && t.min > 0)) err(`la tarea «${t.id}» tiene "min" no válido.`);
      });
    }
  }
  // datos: {hobbies:[…]} | […] | {id,…}. Devuelve la lista nueva y qué cambió; no toca la original.
  function aplicarImportacion(hobbies, datos) {
    let lista = datos;
    if (datos && !Array.isArray(datos) && Array.isArray(datos.hobbies)) lista = datos.hobbies;
    else if (datos && !Array.isArray(datos) && datos.id) lista = [datos];
    if (!Array.isArray(lista) || lista.length === 0) throw new Error('No hay ningún hobby en lo pegado.');
    const out = (hobbies || []).map(h => ({ ...h }));
    const cambios = [];
    lista.forEach(entrada => {
      const existente = out.find(h => h.id === entrada.id);
      validarHobby(entrada, !existente);
      const limpio = {};
      CAMPOS.forEach(c => { if (c in entrada) limpio[c] = entrada[c]; });
      if (existente) {
        Object.assign(existente, limpio);
        const final = existente;
        if ((final.ideal || 0) && final.ideal < final.minimo) throw new Error(`Hobby «${final.id}»: "ideal" no puede ser menor que "minimo".`);
        cambios.push(`«${final.nombre}» actualizado (${Object.keys(limpio).join(', ') || 'sin cambios'})`);
      } else {
        const nuevo = { tipo: 'cola', minimo: 1, ideal: 1, dias: [], cola: [], orden: out.length + 1, ...limpio, id: entrada.id };
        if (nuevo.ideal < nuevo.minimo) nuevo.ideal = nuevo.minimo;
        out.push(nuevo);
        cambios.push(`«${nuevo.nombre}» añadido (en pausa)`);
      }
    });
    return { hobbies: out, cambios };
  }

  function validarCopia(c) {
    if (!c || c.app !== 'AppHobbies') throw new Error('Esto no es una copia de App Hobbies.');
    ['hobbies', 'registro', 'bloques', 'ajustes'].forEach(k => {
      if (!Array.isArray(c[k])) throw new Error(`A la copia le falta "${k}".`);
    });
    c.registro.forEach(r => { if (!r.id || !esClave(r.fecha) || !r.hobbyId) throw new Error('Hay una sesión mal formada en la copia.'); });
    c.bloques.forEach(b => { if (!b.id || !esClave(b.inicio) || !Array.isArray(b.activos)) throw new Error('Hay un bloque mal formado en la copia.'); });
    return true;
  }

  const api = {
    DIAS, claveLocal, esClave, sumarDias, diaSemana, lunesDe, semanasEntre, fechaCorta, fechaLarga, textoDias,
    inicioPrimerBloque, ultimoLunes, contiene, semanaDelBloque, bloqueDeSemana, ultimoBloque, bloqueVigente, activosDe,
    sesionesSemana, cuentaSemana, techo, siguienteDeCola, casilla, tira, semanaHobbies, tarjetaHoy,
    comodinesLibres, puedeUsarComodin, puedeDevolverComodin, diasMarcables, resumenBloque, textoResumen,
    aplicarImportacion, validarCopia,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HL = api;
})(typeof self !== 'undefined' ? self : this);
