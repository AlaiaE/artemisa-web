#!/usr/bin/env python3
"""
Reconstruye index.html a partir de fuente/plantilla.html + las imagenes/fuentes.

Uso:
    python3 fuente/construir.py                        # escribe en la raiz (lo que se publica)
    python3 fuente/construir.py --salida .vista-previa # copia local para la vista previa

Toma plantilla.html (texto y CSS editables a mano), incrusta cada imagen y
tipografia como data URI en el marcador correspondiente, y escribe el
resultado en index.html (en la raiz del repo). Ese index.html es lo que
publica el sitio.
"""
import base64
import io
import pathlib
import re
import shutil
import sys

AQUI = pathlib.Path(__file__).resolve().parent      # .../fuente
RAIZ = AQUI.parent                                   # raiz del repo
SALIDA = RAIZ      # donde se escriben index.html, galeria/ y media/ (ver --salida)

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
                lanczos = getattr(getattr(Image, "Resampling", Image), "LANCZOS")
                im = im.resize((round(w * escala), round(h * escala)), lanczos)
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=JPEG_CALIDAD, optimize=True)
            datos = buf.getvalue()
        except ImportError:
            print("  aviso: Pillow no esta instalado, incrusto el JPEG sin reescalar")
    b64 = base64.b64encode(datos).decode("ascii")
    return f"data:{mime};base64,{b64}"

def b64_crudo(ruta: pathlib.Path) -> str:
    return base64.b64encode(ruta.read_bytes()).decode("ascii")

# --- fotos de "La galeria": NO se incrustan como data URI (harian el
# index.html todavia mas pesado). En vez de eso, cada foto que exista en
# fuente/galeria/ se comprime y se copia tal cual a galeria/ en la raiz del
# repo, con el MISMO nombre de archivo. plantilla.html ya trae <img
# src="galeria/01.jpg" ...> apuntando ahi para 6 fotos (01.jpg .. 06.jpg);
# mientras un archivo no exista, ese <img> simplemente falla a cargar y
# desaparece (onerror="this.remove()"), mostrando el marco de color de
# fondo. Por eso esta funcion NUNCA cuenta como "archivo faltante": es
# opcional, a diferencia de FUENTES/IMAGENES arriba.
GALERIA_LADO_MAX = 1400
GALERIA_CALIDAD = 76

def color_de_fondo(im):
    """Color RGB de las 4 esquinas si son (casi) iguales — el fondo liso de un
    logo —, o None si las esquinas son distintas (no hay un fondo liso)."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    esquinas = [rgb.getpixel(p) for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    if max(max(c[i] for c in esquinas) - min(c[i] for c in esquinas) for i in range(3)) > 16:
        return None
    return tuple(round(sum(c[i] for c in esquinas) / 4) for i in range(3))

def recortar_bordes_vacios(im):
    """Quita el margen alrededor de un logo (transparente, blanco o del color
    liso de su fondo), dejando un respiro pequeño (4% del lado mayor).
    Si no encuentra contenido, no toca nada."""
    from PIL import Image, ImageChops
    rgba = im.convert("RGBA")
    if rgba.getextrema()[3][0] < 255:                  # con transparencia
        caja = rgba.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox()
    else:                                               # fondo liso (blanco u otro color)
        fondo = color_de_fondo(rgba) or (255, 255, 255)
        liso = Image.new("RGB", rgba.size, fondo)
        dif = ImageChops.difference(rgba.convert("RGB"), liso).convert("L")
        caja = dif.point(lambda p: 255 if p > 24 else 0).getbbox()
    if not caja:
        return im
    margen = round(max(caja[2] - caja[0], caja[3] - caja[1]) * 0.04)
    w, h = im.size
    return im.crop((max(0, caja[0] - margen), max(0, caja[1] - margen),
                    min(w, caja[2] + margen), min(h, caja[3] + margen)))

def foto_web(ruta: pathlib.Path, recortar: bool = False,
             lado_max: int = GALERIA_LADO_MAX, calidad: int = GALERIA_CALIDAD) -> "tuple[bytes, str]":
    """Para retratos y collages: cualquier foto (JPG/PNG/WEBP) -> JPEG reescalado.
    Si la imagen usa transparencia de verdad, se queda en PNG (reescalado).
    recortar=True (logos) quita primero el margen vacío alrededor.
    Devuelve (bytes, extension). Sin Pillow, copia el archivo tal cual."""
    ext = ".jpg" if ruta.suffix.lower() == ".jpeg" else ruta.suffix.lower()
    try:
        from PIL import Image, ImageOps
    except ImportError:
        print(f"  aviso: Pillow no esta instalado, copio {ruta.name} sin comprimir")
        return ruta.read_bytes(), ext
    im = Image.open(ruta)
    im.load()
    # Un JPEG que ya es de tamaño web se copia tal cual: volver a comprimirlo
    # solo perdería calidad.
    if ext == ".jpg" and not recortar and max(im.size) <= lado_max:
        return ruta.read_bytes(), ".jpg"
    # Aplica la rotación guardada por el teléfono (EXIF) antes de re-guardar,
    # porque al re-guardar se pierde esa etiqueta y la foto saldría girada.
    im = ImageOps.exif_transpose(im)
    if recortar:
        im = recortar_bordes_vacios(im)
    w, h = im.size
    if max(w, h) > lado_max:
        escala = lado_max / max(w, h)
        lanczos = getattr(getattr(Image, "Resampling", Image), "LANCZOS")
        im = im.resize((round(w * escala), round(h * escala)), lanczos)
    buf = io.BytesIO()
    if im.mode in ("RGBA", "LA", "P") and im.convert("RGBA").getextrema()[3][0] < 255:
        im.save(buf, format="PNG", optimize=True)
        return buf.getvalue(), ".png"
    im.convert("RGB").save(buf, format="JPEG", quality=calidad, optimize=True)
    return buf.getvalue(), ".jpg"

def optimizar_galeria() -> int:
    origen = AQUI / "galeria"
    if not origen.is_dir():
        return 0
    destino = SALIDA / "galeria"
    if destino.is_dir():
        shutil.rmtree(destino)      # salida del build: se regenera completa
    procesadas = 0
    for ruta in sorted(origen.iterdir()):
        if not ruta.is_file() or ruta.suffix.lower() not in EXT_FOTO:
            continue
        # plantilla.html pide galeria/01.jpg..06.jpg: cualquier formato que se
        # suba (01.jpeg, 01.png, 01.webp) sale como <nombre>.jpg.
        datos, ext = foto_web(ruta)
        if ext != ".jpg":
            print(f"  aviso: {ruta.name} tiene transparencia y no se puede usar en la galería (súbela como JPG)")
            continue
        destino.mkdir(exist_ok=True)
        (destino / f"{ruta.stem}.jpg").write_bytes(datos)
        procesadas += 1
    if procesadas:
        print(f"  galeria: {procesadas} foto(s) optimizada(s) -> {destino}")
    return procesadas

# --- collages (portafolios): por CARPETA ---
# En plantilla.html cada collage es
#   <div class="fotos-collage..." data-fotos="portafolios/estrella01"> ...placeholders... </div>
# Se buscan fotos en fuente/portafolios/ cuyo nombre (o subcarpeta) empiece
# por "estrella01" (sin clave, p. ej. data-fotos="carpeta", valen todas).
# Cada foto se comprime y se copia a media/<carpeta>/<clave>/01.jpg, 02.jpg...
# (orden alfabetico del nombre original), y el collage se rellena con ellas.
# Sin fotos se quedan los placeholders. Es opcional: nunca rompe el build.
# media/ es SOLO salida del build: se borra y se regenera completa cada vez.
MEDIA = SALIDA / "media"
EXT_FOTO = (".jpg", ".jpeg", ".png", ".webp")
COLLAGE_RE = re.compile(r'<div class="(fotos-collage[^"]*)" data-fotos="([^"]+)">(.*?)</div>', re.S)

def inyectar_collages(html: str) -> str:
    def reemplazar(m: "re.Match[str]") -> str:
        clases, ref, _ = m.groups()
        carpeta, _, clave = ref.partition("/")
        origen = AQUI / carpeta
        if not origen.is_dir():
            return m.group(0)
        fotos = []
        for ruta in sorted(origen.rglob("*"), key=lambda p: str(p).lower()):
            if not ruta.is_file() or ruta.suffix.lower() not in EXT_FOTO:
                continue
            primera = ruta.relative_to(origen).parts[0].lower()
            if clave and not primera.startswith(clave.lower()):
                continue
            fotos.append(ruta)
        if not fotos:
            return m.group(0)
        partes = ["media", carpeta] + ([clave] if clave else [])
        destino = SALIDA.joinpath(*partes)
        destino.mkdir(parents=True, exist_ok=True)
        imgs = []
        for n, ruta in enumerate(fotos, 1):
            datos, ext = foto_web(ruta)
            nombre = f"{n:02d}{ext}"
            (destino / nombre).write_bytes(datos)
            src = "/".join(partes + [nombre])
            imgs.append(f'<img src="{src}" alt="" loading="lazy" decoding="async">')
        print(f"  collage {ref}: {len(fotos)} foto(s)")
        return f'<div class="{clases}" data-fotos="{ref}">' + "".join(imgs) + "</div>"

    return COLLAGE_RE.sub(reemplazar, html)

# --- retratos de maestros y próximas estrellas: por NOMBRE de archivo ---
# En plantilla.html cada foto de tarjeta y cada foto redonda de la ventana
# lleva data-retrato="maestro01" (01 = Alaia, 02, 03) o "estrella01".."estrella15".
# Si existe fuente/retratos/<clave>.jpg (o .jpeg/.png/.webp), se comprime, se
# copia a media/retratos/ y aparece en la tarjeta Y en la ventana.
RETRATO_RE = re.compile(r'<div class="(artist-photo-ph|artist-modal-photo)" data-retrato="([a-z0-9]+)"></div>')

def cargador_por_nombre(carpeta: str, recortar: bool = False, **calidad_foto):
    """Devuelve foto(clave) -> ruta web de fuente/<carpeta>/<clave>.(jpg|png|...)
    ya comprimida en media/<carpeta>/, o None si no existe. Y el dict de copiadas.
    recortar=True quita el margen vacío de cada imagen (para logos)."""
    origen = AQUI / carpeta
    copiados = {}

    def foto(clave: str):
        if clave not in copiados:
            copiados[clave] = None
            for ext in EXT_FOTO:
                ruta = origen / f"{clave}{ext}"
                if ruta.is_file():
                    destino = MEDIA / carpeta
                    destino.mkdir(parents=True, exist_ok=True)
                    datos, salida = foto_web(ruta, recortar, **calidad_foto)
                    (destino / f"{clave}{salida}").write_bytes(datos)
                    copiados[clave] = f"media/{carpeta}/{clave}{salida}"
                    break
        return copiados[clave]
    return foto, copiados

def inyectar_retratos(html: str) -> str:
    # retratos: más resolución y calidad que la galería (se ven grandes en las tarjetas)
    foto, copiados = cargador_por_nombre("retratos", lado_max=1800, calidad=88)

    def reemplazar(m: "re.Match[str]") -> str:
        clase, clave = m.groups()
        src = foto(clave)
        if not src:
            return m.group(0)  # sin foto: se queda el placeholder
        img = f'<img src="{src}" alt="" loading="lazy" decoding="async"'
        if clase == "artist-photo-ph":
            return f'{img} class="artist-photo-img">'
        return f'<div class="artist-modal-photo" data-retrato="{clave}">{img}></div>'

    html = RETRATO_RE.sub(reemplazar, html)
    n = sum(1 for v in copiados.values() if v)
    if n:
        print(f"  retratos: {n} foto(s)")
    return html

# --- logos de la organización y del destinatario: por NOMBRE de archivo ---
# Los círculos llevan data-logo="organizacion" o "destinatario". Si existe
# fuente/logos/<clave>.png (o .jpg/.webp), aparece en el círculo de su
# recuadro (y, el de la organización, también en su ventana).
LOGO_RE = re.compile(r'<div class="(collab-logo|artist-modal-photo)" data-logo="([a-z0-9-]+)"></div>')

def inyectar_logos(html: str) -> str:
    foto, copiados = cargador_por_nombre("logos", recortar=True)

    def fondo_del_logo(clave: str):
        """Si el logo tiene un fondo liso de color (no blanco ni transparente),
        devuelve ese color en #rrggbb para pintar el círculo del mismo color."""
        try:
            from PIL import Image
        except ImportError:
            return None
        for ext in EXT_FOTO:
            ruta = AQUI / "logos" / f"{clave}{ext}"
            if ruta.is_file():
                im = Image.open(ruta)
                if im.convert("RGBA").getextrema()[3][0] < 255:
                    return None                         # transparente: círculo blanco
                c = color_de_fondo(im)
                if c is None or min(c) > 235:
                    return None                         # sin fondo liso, o blanco
                return "#{:02x}{:02x}{:02x}".format(*c)
        return None

    def reemplazar(m: "re.Match[str]") -> str:
        clase, clave = m.groups()
        src = foto(clave)
        if not src:
            return m.group(0)
        fondo = fondo_del_logo(clave)
        estilo = f' style="background:{fondo};border-color:{fondo};"' if fondo else ""
        return (f'<div class="{clase} con-imagen{" con-fondo" if fondo else ""}" data-logo="{clave}"{estilo}>'
                f'<img src="{src}" alt="" loading="lazy" decoding="async"></div>')

    html = LOGO_RE.sub(reemplazar, html)
    n = sum(1 for v in copiados.values() if v)
    if n:
        print(f"  logos: {n}")
    return html

# --- recuadros de imagen de las ventanas (p. ej. las 3 fotos del destinatario) ---
# <div class="org-project-img" data-imagen="destinatario/01"></div> se rellena con
# fuente/destinatario/01.jpg (o .png/.webp) si existe.
IMAGEN_RE = re.compile(r'<div class="org-project-img" data-imagen="([a-z0-9-]+)/([a-z0-9-]+)"></div>')

def inyectar_imagenes(html: str) -> str:
    cargadores = {}

    def reemplazar(m: "re.Match[str]") -> str:
        carpeta, clave = m.groups()
        if carpeta not in cargadores:
            cargadores[carpeta] = cargador_por_nombre(carpeta)
        src = cargadores[carpeta][0](clave)
        if not src:
            return m.group(0)
        return (f'<div class="org-project-img con-foto" data-imagen="{carpeta}/{clave}">'
                f'<img src="{src}" alt="" loading="lazy" decoding="async"></div>')

    html = IMAGEN_RE.sub(reemplazar, html)
    for carpeta, (_, copiados) in cargadores.items():
        n = sum(1 for v in copiados.values() if v)
        if n:
            print(f"  {carpeta}: {n} foto(s)")
    return html

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
    "__PHOTO_ESTUDIANTES__": ("fotos/estudiantes_en_clase.jpg",   "image/jpeg"),
}

# --- fotos de obras: por CONVENCIÓN DE NOMBRE, sin tocar plantilla.html ---
# Cada lote es <div class="lot-art[...clases...]"><span>Lote NN</span></div>
# (sin <img>, dos veces: catálogo general + modal del artista). Si existe
# fuente/obras/loteNN.jpg (o .jpeg/.png/.webp), se generan DOS copias en
# media/obras/: loteNN.jpg (ligera, para la tarjeta) y loteNN-grande.jpg (alta
# resolución, solo se descarga al abrir la obra en grande). Ya no se incrustan
# en index.html, que así pesa mucho menos.
# Para poner una obra: sube el archivo con ese nombre. Para quitarla: bórralo.
LOTE_ART_RE = re.compile(
    r'<div class="lot-art[^"]*"><span>Lote (\d{2})</span></div>'
)
LOTE_LADO_TARJETA, LOTE_LADO_GRANDE = 1000, 2400

def inyectar_fotos_de_lotes(html: str) -> str:
    hechas = {}     # numero -> (src tarjeta, src grande); cada lote aparece 2 veces

    def fotos(numero: str):
        if numero not in hechas:
            hechas[numero] = None
            for ext in EXT_FOTO:
                ruta = AQUI / "obras" / f"lote{numero}{ext}"
                if ruta.is_file():
                    destino = MEDIA / "obras"
                    destino.mkdir(parents=True, exist_ok=True)
                    chica, e1 = foto_web(ruta, lado_max=LOTE_LADO_TARJETA, calidad=84)
                    grande, e2 = foto_web(ruta, lado_max=LOTE_LADO_GRANDE, calidad=90)
                    (destino / f"lote{numero}{e1}").write_bytes(chica)
                    (destino / f"lote{numero}-grande{e2}").write_bytes(grande)
                    hechas[numero] = (f"media/obras/lote{numero}{e1}", f"media/obras/lote{numero}-grande{e2}")
                    break
        return hechas[numero]

    def reemplazar(m: "re.Match[str]") -> str:
        numero = m.group(1)
        par = fotos(numero)
        if not par:
            return m.group(0)  # sin foto: se queda el fondo de textura
        return (
            f'<div class="lot-art"><img src="{par[0]}" data-grande="{par[1]}" alt="" '
            f'loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;">'
            f'<span>Lote {numero}</span></div>'
        )

    html = LOTE_ART_RE.sub(reemplazar, html)
    n = sum(1 for v in hechas.values() if v)
    if n:
        print(f"  obras: {n} foto(s) (tarjeta + grande)")
    return html

# --- icono de la pestaña (favicon): fuente/icono/icono.png ---
# Una imagen cuadrada (mejor 512 px o más, con esquinas transparentes si es
# redonda). Se generan en media/icono/ el favicon.ico de la pestaña y el
# icono que usa un celular al guardar el sitio en la pantalla de inicio, y se
# ponen sus <link> donde está el comentario ICONOS de plantilla.html.
ICONOS_RE = re.compile(r"<!-- ICONOS:[^>]*-->")

def inyectar_iconos(html: str) -> str:
    ruta = AQUI / "icono" / "icono.png"
    if not ruta.is_file():
        return html                   # sin icono: el navegador pone el genérico
    from PIL import Image
    im = Image.open(ruta).convert("RGBA")
    destino = MEDIA / "icono"
    destino.mkdir(parents=True, exist_ok=True)
    im.save(destino / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    im.resize((192, 192), Image.LANCZOS).save(destino / "icono-192.png", optimize=True)
    # el celular no admite transparencia: esquinas del color del centro-arriba del icono
    fondo = im.getpixel((im.width // 2, im.height // 16))
    fondo = fondo[:3] if fondo[3] == 255 else (255, 255, 255)
    celular = Image.new("RGB", im.size, fondo)
    celular.paste(im, (0, 0), im)
    celular.resize((180, 180), Image.LANCZOS).save(destino / "apple-touch-icon.png", optimize=True)
    print("  icono: favicon.ico + apple-touch-icon.png")
    return ICONOS_RE.sub(
        '<link rel="icon" href="media/icono/favicon.ico" sizes="any">\n'
        '<link rel="icon" href="media/icono/icono-192.png" type="image/png">\n'
        '<link rel="apple-touch-icon" href="media/icono/apple-touch-icon.png">', html, count=1)

def main() -> int:
    global SALIDA, MEDIA
    if "--salida" in sys.argv:
        SALIDA = (RAIZ / sys.argv[sys.argv.index("--salida") + 1]).resolve()
        SALIDA.mkdir(parents=True, exist_ok=True)
        MEDIA = SALIDA / "media"
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
    for marcador in sorted(set(re.findall(r"__LETTER_[a-z0-9_]+__", plantilla))):
        clave = marcador[len("__LETTER_"):-2]          # ej. "a_0"
        ruta = AQUI / "letras" / f"{clave}.png"
        if not ruta.exists():
            faltan_archivos.append(str(ruta)); continue
        html = html.replace(marcador, data_uri(ruta, "image/png"))

    if faltan_archivos:
        print("ERROR: faltan archivos:", *faltan_archivos, sep="\n  ")
        return 1

    if MEDIA.is_dir():
        shutil.rmtree(MEDIA)          # media/ es solo salida: se regenera completa
    # fotos de obras por convención de nombre (loteNN.jpg) — va después de
    # rellenar todo lo demás, para operar sobre el HTML ya casi terminado.
    html = inyectar_fotos_de_lotes(html)
    html = inyectar_collages(html)
    html = inyectar_retratos(html)
    html = inyectar_logos(html)
    html = inyectar_imagenes(html)
    html = inyectar_iconos(html)

    sobran = sorted(set(re.findall(r"__[A-Za-z0-9_]+__", html)))
    if sobran:
        print("ERROR: quedaron marcadores sin rellenar:", *sobran, sep="\n  ")
        return 1

    salida = SALIDA / "index.html"
    salida.write_text(html, encoding="utf-8")
    print(f"OK  ->  {salida}  ({len(html):,} caracteres)")

    optimizar_galeria()
    return 0

if __name__ == "__main__":
    sys.exit(main())

# (build automatizado vía .github/workflows/build.yml)
