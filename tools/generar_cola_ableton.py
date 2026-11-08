"""Genera cola-ableton.js a partir del temario del curso (Word).

Uso:  python tools/generar_cola_ableton.py "<ruta al temario .docx>"
      (la ruta del temario está en CONTEXTO-app-hobbies.md, que no se sube al repo)

El .docx no entra en el repo; solo los títulos y duraciones que hacen falta para la cola.
Reglas de agrupación (criterio propio, ver docs/DISENO.md §3):
  - tope de 15 min de vídeo por sesión (ver y repetir lleva ~2x el vídeo -> 20-30 min);
  - un capítulo no se parte si cabe; se corta al cambiar de capítulo si la sesión ya
    supera el 55 % del tope;
  - los vídeos de más de 18 min van en dos mitades;
  - se saltan los vídeos solo para Mac (se usa en PC).
Los id de cada sesión ('ab-<primer vídeo>') son estables: el registro de la app los usa.
"""
import json
import math
import re
import sys
from pathlib import Path

import docx

TOPE = 15 * 60
PARTIR = 18 * 60
SALTAR = re.compile(r'\bMac\b')


def leer_videos(ruta):
    d = docx.Document(ruta)
    videos, cap = [], None
    for p in d.paragraphs:
        t = p.text.strip()
        if not t:
            continue
        m = re.match(r'^(\d+(?:\.\d+)*)\.?\s+(.*)\((\d+):(\d+)\)\s*$', t)
        if m:
            videos.append({'id': m.group(1), 'titulo': m.group(2).strip(),
                           'seg': int(m.group(3)) * 60 + int(m.group(4)), 'cap': cap})
        elif t.startswith('PARTE') or re.match(r'^\d+\.\s', t):
            cap = t
    return videos


def trozos(videos):
    """Vídeos ya partidos en mitades y sin los de Mac."""
    out = []
    for v in videos:
        if SALTAR.search(v['titulo']):
            continue
        if v['seg'] > PARTIR:
            mitad = v['seg'] // 2
            corte = round(mitad / 60)
            out.append({**v, 'id': v['id'] + 'a', 'ref': v['id'], 'seg': mitad,
                        'nota': f'primera mitad, hasta el minuto {corte}'})
            out.append({**v, 'id': v['id'] + 'b', 'ref': v['id'], 'seg': v['seg'] - mitad,
                        'nota': f'segunda mitad, desde el minuto {corte}'})
        else:
            out.append({**v, 'ref': v['id'], 'nota': None})
    return out


def agrupar(items):
    sesiones, cur, seg = [], [], 0
    for v in items:
        cambio_cap = cur and v['cap'] != cur[-1]['cap']
        if cur and (seg + v['seg'] > TOPE or (cambio_cap and seg >= TOPE * 0.55)):
            sesiones.append(cur)
            cur, seg = [], 0
        cur.append(v)
        seg += v['seg']
    if cur:
        sesiones.append(cur)
    return sesiones


def a_tarea(grupo):
    refs = [g['ref'] for g in grupo]
    if len(refs) == 1:
        ref = f'Vídeo {refs[0]}'
    else:
        ref = 'Vídeos ' + ', '.join(refs[:-1]) + ' y ' + refs[-1]
    titulos = []
    for g in grupo:
        t = g['titulo'] + (f' ({g["nota"]})' if g['nota'] else '')
        titulos.append(t)
    return {'id': 'ab-' + grupo[0]['id'], 'ref': ref, 'titulo': ' · '.join(titulos),
            'min': math.ceil(sum(g['seg'] for g in grupo) / 60)}


def main():
    if len(sys.argv) < 2:
        sys.exit('Uso: python tools/generar_cola_ableton.py "<ruta al temario .docx>"')
    ruta = sys.argv[1]
    videos = leer_videos(ruta)
    cola = [a_tarea(g) for g in agrupar(trozos(videos))]
    ids = [t['id'] for t in cola]
    assert len(ids) == len(set(ids)), 'id repetido en la cola'
    total = sum(v['seg'] for v in videos)
    destino = Path(__file__).resolve().parent.parent / 'cola-ableton.js'
    cabecera = (f'// Generado por tools/generar_cola_ableton.py desde el temario del curso.\n'
                f'// {len(videos)} vídeos, {total // 3600} h {total % 3600 // 60} min -> {len(cola)} sesiones.\n'
                f'// No editar a mano: regenerar.\n')
    destino.write_text(cabecera + 'const COLA_ABLETON = ' +
                       json.dumps(cola, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')
    print(f'{len(videos)} vídeos, {total / 3600:.2f} h -> {len(cola)} sesiones en {destino}')
    for t in cola:
        print(f"{t['id']:>9} {t['min']:3d} min  {t['ref']}: {t['titulo']}")


if __name__ == '__main__':
    main()
