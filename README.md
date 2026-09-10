# Artemisa — sitio web

Página de la subasta de arte solidaria **Artemisa**.

- **`index.html`** — el sitio completo, autosuficiente (un solo archivo, con las
  imágenes y tipografías incrustadas). Es lo que se publica.
- **`fuente/`** — de dónde sale ese `index.html`:
  - `plantilla.html` — el sitio con marcadores (`__STK_TORO__`, `__LETTER_a_0__`, …)
    en vez de las imágenes. **Acá se edita el texto y el diseño**: es liviano y legible.
  - `construir.py` — vuelve a armar `index.html` metiendo las imágenes en la plantilla.
  - `letras/ stickers/ fuentes/ obras/ fotos/` — los recortes e imágenes reales.
  - `title_manifest.json` — qué letra recortada se usó en cada título.

## Editar el sitio

Ver **[COMO-EDITAR.md](COMO-EDITAR.md)**. Resumen:

1. Editar `fuente/plantilla.html` (texto / precios / datos).
2. Correr `python3 fuente/construir.py` → regenera `index.html`.
3. Guardar los cambios (commit + push).
