"""Genera icon-192.png e icon-512.png: fondo oscuro a sangre (vale como «maskable») y una tira
de cuatro casillas, la cuarta a medias, como la de la app. El dibujo queda dentro del 60 %
central, la zona segura de los iconos adaptables de Android."""
from pathlib import Path

from PIL import Image, ImageDraw

BG = (11, 11, 12)
VERDE = (63, 170, 114)
DORADO = (233, 162, 59)
GRIS = (108, 108, 114)


def icono(lado):
    s = 4  # supermuestreo para bordes suaves
    L = lado * s
    im = Image.new('RGB', (L, L), BG)
    d = ImageDraw.Draw(im)
    zona = L * 0.60
    gap = zona * 0.06
    celda = (zona - 3 * gap) / 4
    x0 = (L - zona) / 2
    y0 = (L - celda) / 2
    r = celda * 0.22
    borde = max(2, int(celda * 0.11))
    for i in range(4):
        x = x0 + i * (celda + gap)
        caja = [x, y0, x + celda, y0 + celda]
        if i < 2:
            d.rounded_rectangle(caja, r, fill=VERDE)
        elif i == 2:
            d.rounded_rectangle(caja, r, outline=VERDE, width=borde)
            d.polygon([(x, y0 + celda), (x, y0), (x + celda, y0)], fill=VERDE)
            d.rounded_rectangle(caja, r, outline=VERDE, width=borde)
        else:
            d.rounded_rectangle(caja, r, outline=DORADO, width=borde)
    # barra dorada debajo, como el botón HECHO
    by = y0 + celda + celda * 0.55
    d.rounded_rectangle([x0, by, x0 + zona, by + celda * 0.28], celda * 0.14, fill=DORADO)
    return im.resize((lado, lado), Image.LANCZOS)


if __name__ == '__main__':
    raiz = Path(__file__).resolve().parent.parent
    for lado in (192, 512):
        icono(lado).save(raiz / f'icon-{lado}.png', optimize=True)
        print('ok', lado)
