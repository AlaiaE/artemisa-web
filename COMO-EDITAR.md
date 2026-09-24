# Cómo editar el sitio de Artemisa

Todo se hace desde la página de GitHub, en el navegador. **No hay que instalar
nada ni usar la Terminal.** Cuando guardas un cambio, el sitio se actualiza solo
en 1–2 minutos.

Sitio publicado: **https://alaiae.github.io/artemisa-web/**

---

## Primera vez (solo una vez)

1. Crear una cuenta gratis en **github.com** (botón *Sign up*).
2. Pasarle tu **nombre de usuario** de GitHub a Alaia.
3. Alaia te agrega al proyecto. Te llega un correo:
   *"AlaiaE invited you to collaborate"* → abre el correo y pica **Accept invitation**.

Listo, ya puedes editar.

---

## Cambiar un texto (precio, fecha, nombres, párrafos…)

1. Entra a **github.com/AlaiaE/artemisa-web**
2. Pica la carpeta **`fuente`** y luego el archivo **`plantilla.html`**.
3. Arriba a la derecha del archivo, pica el **lápiz ✏️** (*Edit this file*).
4. Busca el texto con **Cmd + F** y cámbialo. Ejemplos:
   - Precio de entrada → busca `Entrada` y cambia `$450`
   - Fecha → busca `18 de diciembre`
   - Lugar → busca `Casa del Tiempo`
   - Nombre de una artista → busca `[Nombre Artista 2]`
   - Bio de una artista → busca `[Breve descripción de Artista 2`
5. Baja hasta abajo, pica **Commit changes**, escribe una nota corta
   (ej. *"precio actualizado"*) y confirma con **Commit changes**.
6. Espera 1–2 minutos y recarga **https://alaiae.github.io/artemisa-web/**.
   El cambio ya está.

> Para ver que el sitio se está reconstruyendo: en el repo, pestaña **Actions**.
> Un punto amarillo = trabajando, palomita verde ✅ = listo.

---

## ⚠️ Qué NO tocar

- El archivo **`index.html`** (se genera solo — si lo editas se sobreescribe).
- Las carpetas **`fuente/letras`**, **`fuente/stickers`**, **`fuente/fuentes`**.
- El archivo **`fuente/construir.py`** y la carpeta **`.github`**.
- Dentro de `plantilla.html`: cualquier cosa que parezca código o letras
  aleatorias largas. Solo cambia el **texto que se lee** (títulos, párrafos,
  precios, fechas, nombres).

Si algo se ve raro después de un cambio, avísale a Alaia — siempre se puede volver
a la versión anterior.

---

## Poner, cambiar o quitar la foto de una obra (Lote 01–30)

Cada lote de la sección "Las obras" muestra su foto (o un fondo de textura si
todavía no tiene una) según el **nombre del archivo** en `fuente/obras/`. No
hace falta tocar nada más.

- **Nombre exacto:** `loteNN.jpg` — `NN` es el número de lote con **dos
  dígitos** (Lote 1 → `lote01.jpg`, Lote 7 → `lote07.jpg`, Lote 30 →
  `lote30.jpg`). También sirve `.jpeg` o `.png`.

**Para poner o cambiar una foto:**
1. Entra a **github.com/AlaiaE/artemisa-web** → carpeta `fuente/obras/`.
2. Si ese lote ya tiene una foto, bórrala primero (ábrela → **⋯** → **Delete file** → commit).
3. **Add file → Upload files** → sube la nueva imagen y **renómbrala** al
   nombre exacto de arriba antes de confirmar (ej. `lote12.jpg`) → **Commit changes**.
4. Espera 1–2 min y recarga el sitio — ya se ve.

**Para quitar una foto** (y que vuelva a mostrar solo la textura):
1. Entra a `fuente/obras/`, abre `loteNN.jpg` de ese lote.
2. **⋯** → **Delete file** → **Commit changes**.

Para recortes finos (quitar fondo, encuadrar bien), es mejor pedírselo a Alaia.

## Cambiar otras fotos (la de estudiantes en clase, stickers, etc.)

Esas sí van por nombre fijo — hay que reemplazar el archivo **con el mismo
nombre** que ya tiene, dentro de `fuente/fotos/` o `fuente/stickers/`
(borrar + subir, igual que arriba).
