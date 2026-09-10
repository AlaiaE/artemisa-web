# Cómo editar el sitio de Artemisa

## Cambios de texto (precios, fechas, nombres, párrafos)

Estos son la mayoría de los cambios y **no necesitan instalar nada**.

1. En GitHub, entrar a la carpeta `fuente/` y abrir **`plantilla.html`**.
2. Tocar el lápiz (**Edit this file**) arriba a la derecha.
3. Buscar el texto con `Ctrl/Cmd + F` y cambiarlo. Ejemplos:
   - El precio de la entrada: buscar `Entrada` → `<b>$450</b>`.
   - La fecha: buscar `18 de diciembre`.
   - El lugar: buscar `Casa del Tiempo`.
4. Abajo, **Commit changes** con una nota corta de qué cambiaste.

> ⚠️ Después de editar `plantilla.html` **hay que regenerar `index.html`**, que es lo
> que ve el público. Ver la sección siguiente. Si no sabés hacer ese paso, avisá a
> Alaia o pedíselo a Claude Code con este repo abierto: _"corré `fuente/construir.py`
> y subí el `index.html` nuevo"_.

## Regenerar `index.html` (paso técnico)

Hace falta **Python 3** (ya viene en Mac). En una terminal, dentro de la carpeta del repo:

```bash
python3 fuente/construir.py
```

Eso reescribe `index.html`. Después:

```bash
git add index.html
git commit -m "Regenerar index.html"
git push
```

## Cambiar imágenes (obras, fotos, stickers)

1. Reemplazar el archivo dentro de `fuente/obras/`, `fuente/fotos/` o `fuente/stickers/`
   **manteniendo el mismo nombre**.
2. Correr `python3 fuente/construir.py`.
3. Commit + push.

Para recortes finos (quitar fondo, encuadrar una obra) es más fácil pedírselo a
Claude Code con el repo abierto.

## Ver el sitio publicado

Si está activado **GitHub Pages** (Settings → Pages), la dirección es algo como
`https://USUARIO.github.io/artemisa-web/`. Tarda ~1 minuto en actualizarse después
de cada push.
