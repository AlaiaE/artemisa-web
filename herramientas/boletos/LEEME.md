# Boletos con código QR

`boletos.gs` es un pequeño programa de Google que vive dentro de la hoja de
respuestas del formulario **"Reserva tu lugar"**. Hace esto:

1. Cuando marcas la casilla **Pagado** de un invitado (después de ver su
   transferencia en BanBajío), le llega por correo su **boleto con código QR**.
   El correo dice para cuántas personas es (la respuesta "Número de asistentes").
2. En la puerta, el equipo escanea el QR con la **cámara normal del celular**.
   Se abre una página que dice:
   - ✅ **Bienvenidos** · nombre · número de personas (y anota la hora en la hoja);
   - ⚠️ **Este boleto ya entró** · a qué hora (el mismo QR no entra dos veces);
   - ❌ **Pago no confirmado** o **Boleto no válido**.

El QR solo trae un código al azar (`ART-…`), nunca el nombre ni el correo.
Registrar una entrada pide el **PIN de la puerta**, así que si un invitado
escanea su propio QR solo ve "Boleto válido".

---

## Instalación (una sola vez, unos 15 minutos)

Hazlo con la cuenta **artemisa.proyect2026@gmail.com**: los boletos se envían
desde la cuenta que instala el programa.

1. **Abre la hoja de respuestas.** En Google Forms, abre "Reserva tu lugar" →
   pestaña **Respuestas** → **Ver en Hojas de cálculo** (o **Vincular con Hojas
   de cálculo** si todavía no tiene una).
2. En la hoja: menú **Extensiones → Apps Script**. Se abre un editor.
3. Borra todo lo que hay en `Código.gs`, **pega todo el contenido de
   `boletos.gs`** y guarda (icono de disquete). Arriba a la izquierda, cambia
   el nombre del proyecto a **Boletos Artemisa**.
4. Regresa a la hoja y **recárgala**. Aparece un menú nuevo: **Boletos**.
5. **Boletos → 1. Preparar la hoja.** Google pide permiso:
   - **Revisar permisos** → elige la cuenta del proyecto.
   - Sale *"Google no ha verificado esta app"*. Es normal: la app es tuya.
     Pica **Configuración avanzada** → **Ir a Boletos Artemisa (no seguro)** →
     **Permitir**.
   - Vuelve a picar **Boletos → 1. Preparar la hoja**. Aparecen 4 columnas
     nuevas a la derecha: **Pagado**, **Boleto enviado**, **Código** y **Llegada**.
6. **Publica la página de la puerta.** En el editor de Apps Script:
   **Implementar → Nueva implementación** → engrane ⚙ → **Aplicación web**.
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier usuario**
   - **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
7. En la hoja: **Boletos → 2. Guardar el enlace de la app** y pega esa URL.
   Te muestra el **enlace y el PIN de la puerta**. Guárdalos.

## Prueba antes de usarlo

1. Llena el formulario tú misma, con tu correo.
2. Marca **Pagado** en tu fila. En unos segundos "Boleto enviado" muestra la
   fecha y te llega el correo con el QR.
3. Escanea el QR con tu celular: debe decir **Boleto válido**.
4. Abre el **enlace de la puerta** en tu celular y escribe el PIN. Vuelve a
   escanear el QR: debe salir **Bienvenidos** en verde. Escanéalo otra vez:
   **Este boleto ya entró**.
5. Borra tu fila de prueba (o solo la celda "Llegada").

---

## Uso diario

- **Llegó una transferencia:** busca al invitado y marca **Pagado**. Listo.
- **"Boleto enviado" dice "Error: …":** corrige el dato (por ejemplo el
  correo) y desmarca y vuelve a marcar **Pagado**.
- **Un invitado no encuentra su correo:** haz clic en su fila →
  **Boletos → Reenviar el boleto de la fila seleccionada** (es el mismo QR).
- **Cancelar un boleto:** desmarca **Pagado**. En la puerta saldrá
  "Pago no confirmado".
- **¿Cuántos han llegado?** **Boletos → Resumen de llegadas**, o el enlace de
  la puerta sin escanear nada.
- Gmail permite unos **100 correos al día** desde una cuenta gratuita.

## El día del evento

1. Cada persona del equipo de la puerta abre el **enlace de la puerta** en su
   celular (te lo da **Boletos → Ver enlace y PIN de la puerta**) y escribe el
   **PIN**. El celular lo recuerda.
2. Después solo escanean cada QR con la **cámara** y miran el color:
   **verde** = pasa, **naranja** = ese boleto ya entró, **rojo** = no pasa.
3. Por si falla la señal, **imprime la lista** de la hoja esa mañana.

No compartas el PIN fuera del equipo. Si se filtra, cámbialo en el editor de
Apps Script: **Configuración del proyecto ⚙ → Propiedades de la secuencia de
comandos → PIN**.

## Si alguna vez cambias el código

Para que los QR ya enviados sigan funcionando, **no hagas una implementación
nueva**: usa **Implementar → Gestionar implementaciones** → lápiz ✏️ →
*Versión:* **Nueva versión** → **Implementar**. Así el enlace no cambia.
