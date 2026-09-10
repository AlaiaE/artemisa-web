#!/usr/bin/env python3
"""
Reconstruye index.html a partir de fuente/plantilla.html + las imagenes/fuentes.

Uso:
    python3 fuente/construir.py

Toma plantilla.html (texto y CSS editables a mano), incrusta cada imagen y
tipografia como data URI en el marcador correspondiente, y escribe el
resultado en index.html (en la raiz del repo). Ese index.html es lo que
publica el sitio.
"""
import base64
import io
import pathlib
import sys

AQUI = pathlib.Path(__file__).resolve().parent      # .../fuente
RAIZ = AQUI.parent                                   # raiz del repo

# Las fotos (.jpg) se reescalan para la web antes de incrustarlas:
# lado mayor <= JPEG_LADO_MAX px, calidad JPEG_CALIDAD. Asi el index.html
# no se dispara de tamano aunque las fotos originales sean de camara.
JPEG_LADO_MAX = 1600
JPEG_CALIDAD = 82

def data_uri(ruta: pathlib.Path, mime: str) -> str:
    datos = ruta.read_bytes()
    if mime == "image/jpeg":
        try:
            from PIL import Image
            im = Image.open(io.BytesIO(datos))
            im = im.convert("RGB")
            w, h = im.size
            if max(w, h) > JPEG_LADO_MAX:
                escala = JPEG_LADO_MAX / max(w, h)
                im = im.resize((round(w * escala), round(h * escala)), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=JPEG_CALIDAD, optimize=True)
            datos = buf.getvalue()
        except ImportError:
            print("  aviso: Pillow no esta instalado, incrusto el JPEG sin reescalar")
    b64 = base64.b64encode(datos).decode("ascii")
    return f"data:{mime};base64,{b64}"

def b64_crudo(ruta: pathlib.Path) -> str:
    return base64.b64encode(ruta.read_bytes()).decode("ascii")

# --- tipografias: el marcador va DENTRO de url(data:font/woff2;base64,XXXX) ---
FUENTES = {
    "__FRAUNCES600__":  "fraunces600.woff2",
    "__FRAUNCES700__":  "fraunces700.woff2",
    "__FRAUNCES500I__": "fraunces500i.woff2",
    "__PUBSANS400__":   "pubsans400.woff2",
    "__PUBSANS500__":   "pubsans500.woff2",
    "__PUBSANS600__":   "pubsans600.woff2",
    "__PLEXMONO500__":  "plexmono500.woff2",
    "__PLEXMONO600__":  "plexmono600.woff2",
    "__CAVEAT600__":    "caveat600.woff2",
    "__CAVEAT700__":    "caveat700.woff2",
    "__TANGERINE700__": "tangerine700.woff2",
}

# --- imagenes: el marcador es el valor completo de src="..." ---
IMAGENES = {
    "__STK_TORO__":     ("stickers/toro.png",              "image/png"),
    "__STK_FAN1__":     ("stickers/fan1.png",              "image/png"),
    "__STK_FAN2__":     ("stickers/fan2.png",              "image/png"),
    "__STK_SOL__":      ("stickers/sol.png",               "image/png"),
    "__STK_CARACOL__":  ("stickers/caracol.png",           "image/png"),
    "__STK_STAR_A__":   ("stickers/star_a.png",            "image/png"),
    "__STK_STAR_B__":   ("stickers/star_b.png",            "image/png"),
    "__STK_STAR_C__":   ("stickers/star_c.png",            "image/png"),
    "__STK_STAR_D__":   ("stickers/star_d.png",            "image/png"),
    "__STK_STAR_E__":   ("stickers/star_e.png",            "image/png"),
    "__STK_NARANJA_GIF__": ("stickers/naranja_anim.gif",   "image/gif"),
    "__FOOTER_GIF__":   ("stickers/granada_anim.gif",      "image/gif"),
    "__OBRA_DEPREDADOR__":  ("obras/lote01_depredador_doble.jpg", "image/jpeg"),
    "__OBRA_QUIMERA__":     ("obras/lote04_quimera_acuatica.jpg", "image/jpeg"),
    "__OBRA_MATRIOSHKA__":  ("obras/lote13_matrioshka.jpg",       "image/jpeg"),
    "__OBRA_ENSENARON__":   ("obras/lote10_nos_ensenaron.jpg",    "image/jpeg"),
    "__PHOTO_ESTUDIANTES__": ("fotos/estudiantes_en_clase.jpg",   "image/jpeg"),
}

def main() -> int:
    plantilla = (AQUI / "plantilla.html").read_text(encoding="utf-8")
    html = plantilla
    faltan_archivos = []

    for marcador, nombre in FUENTES.items():
        ruta = AQUI / "fuentes" / nombre
        if not ruta.exists():
            faltan_archivos.append(str(ruta)); continue
        html = html.replace(marcador, b64_crudo(ruta))

    for marcador, (rel, mime) in IMAGENES.items():
        ruta = AQUI / rel
        if not ruta.exists():
            faltan_archivos.append(str(ruta)); continue
        html = html.replace(marcador, data_uri(ruta, mime))

    # letras recortadas: __LETTER_a_0__ -> fuente/letras/a_0.png
    import re
    for marcador in sorted(set(re.findall(r"__LETTER_[a-z0-9_]+__", plantilla))):
        clave = marcador[len("__LETTER_"):-2]          # ej. "a_0"
        ruta = AQUI / "letras" / f"{clave}.png"
        if not ruta.exists():
            faltan_archivos.append(str(ruta)); continue
        html = html.replace(marcador, data_uri(ruta, "image/png"))

    if faltan_archivos:
        print("ERROR: faltan archivos:", *faltan_archivos, sep="\n  ")
        return 1

    sobran = sorted(set(re.findall(r"__[A-Za-z0-9_]+__", html)))
    if sobran:
        print("ERROR: quedaron marcadores sin rellenar:", *sobran, sep="\n  ")
        return 1

    salida = RAIZ / "index.html"
    salida.write_text(html, encoding="utf-8")
    print(f"OK  ->  {salida}  ({len(html):,} caracteres)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
