/**
 * BOLETOS CON QR — Artemisa
 * ------------------------------------------------------------------
 * Este código vive dentro de la hoja de cálculo de respuestas del
 * formulario "Reserva tu lugar". Hace dos cosas:
 *
 *  1. Cuando marcas la casilla "Pagado" de un invitado, le manda por
 *     correo su boleto con un código QR (desde la cuenta de Google que
 *     instaló este código).
 *  2. En la puerta, el equipo escanea el QR con la cámara del celular:
 *     se abre una página que dice si el boleto es válido, cuántas
 *     personas entran, y anota la hora de llegada en la hoja. Un mismo
 *     boleto no puede entrar dos veces.
 *
 * Cómo instalarlo: ver herramientas/boletos/LEEME.md en el repositorio.
 *
 * El QR solo contiene un código al azar (ej. ART-3F9A0C...), nunca el
 * nombre ni el correo del invitado. Para registrar una entrada hace falta
 * el PIN de la puerta, así que un invitado que escanee su propio QR solo
 * ve "boleto válido".
 */

// ===== DATOS DEL EVENTO (puedes cambiarlos; salen en el correo) =====
const EVENTO = {
  nombre: 'Artemisa',
  descripcion: 'Subasta de arte solidaria',
  fecha: 'Sábado 19 de diciembre',
  lugar: 'Centro Cultural San Ángel · Av. Revolución s/n, San Ángel, CDMX',
  sitio: 'https://www.proyectartemisa.com',
};
const ZONA = 'America/Mexico_City';

// Columnas que agrega "Preparar la hoja" (a la derecha de las respuestas)
const COLUMNAS_NUEVAS = ['Pagado', 'Boleto enviado', 'Código', 'Llegada'];


// =====================================================================
//  MENÚ "Boletos" (aparece en la hoja al abrirla)
// =====================================================================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Boletos')
    .addItem('1. Preparar la hoja', 'instalar')
    .addItem('2. Guardar el enlace de la app', 'guardarEnlace')
    .addSeparator()
    .addItem('Reenviar el boleto de la fila seleccionada', 'reenviarSeleccion')
    .addItem('Ver enlace y PIN de la puerta', 'verPuerta')
    .addItem('Resumen de llegadas', 'verResumen')
    .addToUi();
}

/** Paso 1: agrega las columnas, las casillas, los activadores y el PIN. */
function instalar() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheets().find(s => s.getFormUrl()) || ss.getActiveSheet();
  const props = PropertiesService.getScriptProperties();
  props.setProperty('LIBRO', ss.getId());
  props.setProperty('HOJA', h.getName());

  let c = columnas_(h);
  if (!c.nombre || !c.correo) {
    ui.alert('No encontré las columnas "Nombre" y "Correo electrónico" en la hoja "' + h.getName() +
      '". Abre la hoja donde llegan las respuestas del formulario y vuelve a intentarlo.');
    return;
  }

  // Columnas nuevas al final (solo las que falten)
  COLUMNAS_NUEVAS.forEach(titulo => {
    if (columnas_(h)[clave_(titulo)]) return;
    const col = h.getLastColumn() + 1;
    if (col > h.getMaxColumns()) h.insertColumnAfter(h.getMaxColumns());
    h.getRange(1, col).setValue(titulo).setFontWeight('bold');
  });
  c = columnas_(h);

  const filas = h.getMaxRows() - 1;
  // Casillas sin borrar las que ya estén marcadas
  h.getRange(2, c.pagado, filas, 1).setDataValidation(reglaCasilla_());
  h.getRange(2, c.codigo, filas, 1).setNumberFormat('@');
  h.getRange(2, c.enviado, filas, 1).setNumberFormat('d/m/yyyy h:mm am/pm');
  h.getRange(2, c.llegada, filas, 1).setNumberFormat('d/m/yyyy h:mm am/pm');

  // Activadores (se borran los anteriores para no duplicarlos)
  ScriptApp.getProjectTriggers()
    .filter(t => ['alEditar', 'alResponder'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('alEditar').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('alResponder').forSpreadsheet(ss).onFormSubmit().create();

  if (!props.getProperty('PIN')) {
    props.setProperty('PIN', String(Math.floor(100000 + Math.random() * 900000)));
  }

  ui.alert('Listo ✅',
    'La hoja "' + h.getName() + '" ya tiene las columnas Pagado, Boleto enviado, Código y Llegada.\n\n' +
    'Siguiente paso: publica la app (Implementar → Nueva implementación → Aplicación web) ' +
    'y luego usa el menú Boletos → 2. Guardar el enlace de la app.',
    ui.ButtonSet.OK);
}

/** Paso 2: guarda el enlace de la aplicación web (termina en /exec). */
function guardarEnlace() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Enlace de la app',
    'Pega aquí la "URL de la aplicación web" que te dio Google al implementar (termina en /exec):',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const url = r.getResponseText().trim();
  if (!/^https:\/\/script\.google\.com\/\S+\/exec$/.test(url)) {
    ui.alert('Ese enlace no parece el correcto: debe empezar con https://script.google.com/ y terminar en /exec.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('URL_APP', url);
  ui.alert('Guardado ✅', 'Ya puedes marcar "Pagado" y el boleto se enviará solo.\n\n' + textoPuerta_(),
    ui.ButtonSet.OK);
}

function reenviarSeleccion() {
  const ui = SpreadsheetApp.getUi();
  const h = hoja_();
  const sel = h.getActiveRange();
  if (!sel || sel.getSheet().getSheetId() !== h.getSheetId() || sel.getRow() < 2) {
    ui.alert('Primero haz clic en una celda de la fila del invitado (en la hoja de respuestas).');
    return;
  }
  const c = columnas_(h);
  const fila = sel.getRow();
  if (h.getRange(fila, c.pagado).getValue() !== true) {
    ui.alert('Esa fila no tiene marcada la casilla "Pagado".');
    return;
  }
  enviarBoleto_(h, c, fila);
  ui.alert('Resultado: ' + h.getRange(fila, c.enviado).getDisplayValue());
}

function verPuerta() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Puerta', textoPuerta_(), ui.ButtonSet.OK);
}

function verResumen() {
  const ui = SpreadsheetApp.getUi();
  const r = resumen_();
  ui.alert('Resumen',
    'Boletos pagados: ' + r.boletos + ' (' + r.personas + ' personas)\n' +
    'Ya llegaron: ' + r.boletosLlegaron + ' boletos (' + r.personasLlegaron + ' personas)',
    ui.ButtonSet.OK);
}

function textoPuerta_() {
  const p = PropertiesService.getScriptProperties();
  return 'Enlace de la puerta: ' + (p.getProperty('URL_APP') || '(todavía no guardado)') + '\n' +
    'PIN de la puerta: ' + p.getProperty('PIN') + '\n\n' +
    'Cada persona del equipo abre el enlace en su celular una vez y escribe el PIN. ' +
    'Después solo escanea los QR con la cámara.';
}


// =====================================================================
//  ACTIVADORES
// =====================================================================

/** Al marcar "Pagado", envía el boleto (si no se ha enviado ya). */
function alEditar(e) {
  if (!e || !e.range || typeof e.range.getSheet !== 'function') return;
  const r = e.range;
  const h = r.getSheet();
  if (h.getSheetId() !== hoja_().getSheetId()) return;
  const c = columnas_(h);
  if (!c.pagado || c.pagado < r.getColumn() || c.pagado > r.getLastColumn()) return;

  const valores = h.getRange(r.getRow(), c.pagado, r.getNumRows(), 1).getValues();
  valores.forEach((v, i) => {
    const fila = r.getRow() + i;
    if (fila < 2 || v[0] !== true) return;
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const enviado = String(h.getRange(fila, c.enviado).getValue());
      if (enviado === '' || enviado.startsWith('Error')) enviarBoleto_(h, c, fila);
    } finally {
      lock.releaseLock();
    }
  });
}

/** Cada respuesta nueva del formulario recibe su casilla "Pagado". */
function alResponder(e) {
  if (!e || !e.range || typeof e.range.getSheet !== 'function') return;
  const h = e.range.getSheet();
  const c = columnas_(h);
  if (c.pagado) h.getRange(e.range.getRow(), c.pagado).setDataValidation(reglaCasilla_());
}


// =====================================================================
//  ENVÍO DEL BOLETO
// =====================================================================

function enviarBoleto_(h, c, fila) {
  const celda = h.getRange(fila, c.enviado);
  try {
    const url = PropertiesService.getScriptProperties().getProperty('URL_APP');
    if (!url) throw new Error('falta guardar el enlace de la app (menú Boletos → 2)');

    const datos = h.getRange(fila, 1, 1, h.getLastColumn()).getValues()[0];
    const nombre = String(datos[c.nombre - 1]).trim();
    const correo = String(datos[c.correo - 1]).trim();
    const personas = personas_(c.asistentes ? datos[c.asistentes - 1] : 1);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) throw new Error('correo inválido');

    let codigo = String(datos[c.codigo - 1] || '').trim();
    if (!codigo) {
      codigo = 'ART-' + Utilities.getUuid().replace(/-/g, '').slice(0, 16).toUpperCase();
      h.getRange(fila, c.codigo).setValue(codigo);
    }

    const png = qrPng(url + '?c=' + codigo, 8);
    const imagen = Utilities.newBlob(png.map(b => (b > 127 ? b - 256 : b)), 'image/png', 'boleto-artemisa.png');

    MailApp.sendEmail({
      to: correo,
      name: EVENTO.nombre,
      subject: 'Tu boleto para ' + EVENTO.nombre + ' · ' + EVENTO.fecha,
      body: correoTexto_(nombre, personas, codigo),
      htmlBody: correoHtml_(nombre, personas, codigo),
      inlineImages: { qr: imagen },
    });
    celda.setValue(new Date());
  } catch (err) {
    celda.setValue('Error: ' + err.message);
  }
}

function correoTexto_(nombre, personas, codigo) {
  return '¡Hola, ' + nombre + '!\n\n' +
    'Recibimos tu pago. Este correo es tu boleto para ' + EVENTO.nombre + ', ' +
    EVENTO.descripcion.toLowerCase() + '.\n\n' +
    'Válido para ' + personas + (personas === 1 ? ' persona' : ' personas') + '. Código: ' + codigo + '\n' +
    EVENTO.fecha + '\n' + EVENTO.lugar + '\n\n' +
    'Muestra el código QR de este correo en la entrada. Cada boleto se registra una sola vez.\n\n' +
    EVENTO.sitio;
}

function correoHtml_(nombre, personas, codigo) {
  const n = esc_(nombre);
  const p = personas + (personas === 1 ? ' persona' : ' personas');
  return '' +
    '<div style="background:#EEEAE0;padding:24px 12px;">' +
    '<div style="max-width:460px;margin:0 auto;background:#F6F3EA;border:1px solid #D9D1BE;padding:28px 24px;' +
    'font-family:Georgia,\'Times New Roman\',serif;color:#232220;">' +
    '<p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#B14F2A;">Tu boleto</p>' +
    '<h1 style="margin:0 0 16px;font-size:30px;font-weight:normal;">' + esc_(EVENTO.nombre) + '</h1>' +
    '<p style="margin:0 0 20px;font-size:16px;line-height:1.5;">¡Hola, ' + n + '! Recibimos tu pago. ' +
    'Este correo es tu boleto para la ' + esc_(EVENTO.descripcion.toLowerCase()) + '.</p>' +
    '<div style="background:#ffffff;border:1px solid #D9D1BE;padding:18px;text-align:center;">' +
    '<img src="cid:qr" width="240" height="240" alt="Código QR de tu boleto" style="display:block;margin:0 auto;">' +
    '<p style="margin:12px 0 2px;font-size:18px;">Válido para <strong>' + p + '</strong></p>' +
    '<p style="margin:0;font-family:\'Courier New\',monospace;font-size:13px;color:#5B584F;">' + esc_(codigo) + '</p>' +
    '</div>' +
    '<p style="margin:20px 0 4px;font-size:16px;"><strong>' + esc_(EVENTO.fecha) + '</strong></p>' +
    '<p style="margin:0 0 20px;font-size:15px;color:#5B584F;">' + esc_(EVENTO.lugar) + '</p>' +
    '<p style="margin:0 0 20px;font-size:15px;line-height:1.5;">Muestra este código QR en la entrada, desde tu celular o impreso. ' +
    'Cada boleto se registra una sola vez, así que no lo compartas.</p>' +
    '<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;"><a href="' + EVENTO.sitio + '" style="color:#B14F2A;">' +
    esc_(EVENTO.sitio.replace(/^https?:\/\//, '')) + '</a></p>' +
    '</div></div>';
}


// =====================================================================
//  PÁGINA DE LA PUERTA (aplicación web)
// =====================================================================

function doGet(e) {
  const codigo = String((e && e.parameter && e.parameter.c) || '').trim().slice(0, 40);
  return HtmlService.createHtmlOutput(paginaPuerta_(codigo))
    .setTitle('Entrada · ' + EVENTO.nombre)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Lo que ve cualquiera que escanee el QR (sin PIN): solo si es válido. */
function consultarBoleto(codigo) {
  const b = buscar_(codigo);
  if (!b) return { estado: 'noexiste' };
  if (!b.pagado) return { estado: 'sinpago' };
  return { estado: b.llegada ? 'usado' : 'valido', personas: b.personas };
}

/** Lo que usa el equipo de la puerta (con PIN): registra la llegada. */
function registrarEntrada(codigo, pin) {
  const pinOk = revisarPin_(pin);
  if (pinOk !== true) return { error: pinOk };
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const b = buscar_(codigo);
    if (!b) return { estado: 'noexiste' };
    const base = { nombre: b.nombre, personas: b.personas };
    if (!b.pagado) return Object.assign({ estado: 'sinpago' }, base);
    if (b.llegada) return Object.assign({ estado: 'usado', hora: hora_(b.llegada) }, base);
    const ahora = new Date();
    b.hoja.getRange(b.fila, b.c.llegada).setValue(ahora);
    return Object.assign({ estado: 'ok', hora: hora_(ahora) }, base);
  } finally {
    lock.releaseLock();
  }
}

/** Para guardar el PIN en un celular del equipo y ver cuántos han llegado. */
function resumenPuerta(pin) {
  const pinOk = revisarPin_(pin);
  if (pinOk !== true) return { error: pinOk };
  return resumen_();
}

function revisarPin_(pin) {
  const cache = CacheService.getScriptCache();
  const fallos = Number(cache.get('fallos') || 0);
  if (fallos >= 20) return 'bloqueado';
  if (String(pin || '').trim() === PropertiesService.getScriptProperties().getProperty('PIN')) return true;
  cache.put('fallos', String(fallos + 1), 900);
  return 'pin';
}

function paginaPuerta_(codigo) {
  const datos = JSON.stringify({ codigo: codigo, evento: EVENTO.nombre }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<style>
  :root{--paper:#EEEAE0;--raised:#F6F3EA;--ink:#232220;--graphite:#5B584F;--line:#D9D1BE;--sienna:#B14F2A;}
  *{box-sizing:border-box;}
  body{margin:0;min-height:100vh;background:var(--paper);color:var(--ink);font-family:Georgia,'Times New Roman',serif;
    display:flex;align-items:center;justify-content:center;padding:20px 16px;text-align:center;}
  .caja{width:100%;max-width:420px;}
  .eti{font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--sienna);margin:0 0 8px;}
  h1{font-size:30px;font-weight:normal;margin:0 0 12px;line-height:1.2;}
  p{font-size:17px;line-height:1.5;margin:0 0 14px;}
  .gris{color:var(--graphite);font-size:15px;}
  .icono{font-size:64px;line-height:1;margin:0 0 12px;}
  .estado{border-radius:14px;padding:30px 20px;margin:0 0 18px;color:#fff;}
  .estado h1{color:#fff;}
  .estado p{color:#fff;}
  .ok{background:#2E7D32;} .usado{background:#C77700;} .mal{background:#B3261E;}
  .nombre{font-size:26px;margin:4px 0 6px;}
  input{width:100%;font-size:24px;letter-spacing:6px;text-align:center;padding:12px;border:1px solid var(--line);
    border-radius:10px;background:#fff;margin:0 0 12px;font-family:'Courier New',monospace;}
  button{font:inherit;font-size:17px;padding:12px 20px;border-radius:10px;border:1px solid var(--ink);
    background:var(--ink);color:var(--paper);cursor:pointer;width:100%;}
  button.sec{background:transparent;color:var(--ink);margin-top:10px;}
  .enlace{background:none;border:none;color:var(--sienna);text-decoration:underline;width:auto;padding:6px;font-size:15px;}
  .oculto{display:none;}
</style></head>
<body><div class="caja" id="app"><p class="gris">Cargando…</p></div>
<script>
  const D = ${datos};
  const app = document.getElementById('app');
  const guardar = (pin) => { try { pin ? localStorage.setItem('pinPuerta', pin) : localStorage.removeItem('pinPuerta'); } catch (e) {} memoria = pin; };
  let memoria = null;
  try { memoria = localStorage.getItem('pinPuerta'); } catch (e) {}
  const pinGuardado = () => memoria;

  function el(tag, attrs, hijos) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => k === 'text' ? n.textContent = v : n.setAttribute(k, v));
    (hijos || []).forEach(h => n.appendChild(h));
    return n;
  }
  function pintar(nodos) { app.replaceChildren(...nodos); }
  const personas = (n) => n + (n === 1 ? ' persona' : ' personas');
  const llamar = (fn, ...args) => new Promise((ok, mal) =>
    google.script.run.withSuccessHandler(ok).withFailureHandler(mal)[fn](...args));
  const errorRed = () => pintar([el('div', {class: 'estado mal'}, [
    el('div', {class: 'icono', text: '⚠'}), el('h1', {text: 'Sin conexión'}),
    el('p', {text: 'No se pudo revisar el boleto. Revisa la señal y vuelve a escanear.'})])]);

  function formularioPin(mensaje, alListo) {
    const input = el('input', {type: 'tel', inputmode: 'numeric', maxlength: '6', placeholder: 'PIN', autocomplete: 'off'});
    const nota = el('p', {class: 'gris', text: mensaje || 'Escribe el PIN de la puerta. Este celular lo recordará.'});
    const boton = el('button', {type: 'button', text: 'Guardar PIN'});
    boton.onclick = () => { const pin = input.value.trim(); if (pin) { guardar(pin); alListo(); } };
    input.onkeydown = (e) => { if (e.key === 'Enter') boton.click(); };
    return [el('p', {class: 'eti', text: 'Equipo de la puerta'}), nota, input, boton];
  }

  function pantallaPin(mensaje) {
    pintar([el('h1', {text: D.evento}), ...formularioPin(mensaje, inicio)]);
  }

  async function registrar() {
    pintar([el('p', {class: 'gris', text: 'Revisando boleto…'})]);
    let r;
    try { r = await llamar('registrarEntrada', D.codigo, pinGuardado()); } catch (e) { return errorRed(); }
    if (r.error === 'pin') { guardar(null); return pantallaPin('PIN incorrecto. Escríbelo de nuevo.'); }
    if (r.error === 'bloqueado') return pintar([el('h1', {text: 'Demasiados intentos'}), el('p', {text: 'Espera 15 minutos e inténtalo de nuevo.'})]);
    const vistas = {
      ok:       ['ok',    '✓', 'Bienvenidos', 'Entrada registrada · ' + r.hora],
      usado:    ['usado', '!', 'Este boleto ya entró', 'Registrado a las ' + r.hora],
      sinpago:  ['mal',   '✕', 'Pago no confirmado', 'Revisa la hoja: la casilla "Pagado" no está marcada.'],
      noexiste: ['mal',   '✕', 'Boleto no válido', 'Este código no está en la lista de invitados.'],
    };
    const [clase, icono, titulo, detalle] = vistas[r.estado];
    const hijos = [el('div', {class: 'icono', text: icono}), el('h1', {text: titulo})];
    if (r.nombre) hijos.push(el('p', {class: 'nombre', text: r.nombre}), el('p', {text: personas(r.personas)}));
    hijos.push(el('p', {text: detalle}));
    pintar([el('div', {class: 'estado ' + clase}, hijos), el('p', {class: 'gris', text: 'Escanea el siguiente código con la cámara.'})]);
  }

  async function vistaInvitado() {
    let r;
    try { r = await llamar('consultarBoleto', D.codigo); } catch (e) { return errorRed(); }
    const textos = {
      valido:   ['✓', 'Boleto válido', 'Para ' + personas(r.personas) + '. Muestra este código en la entrada.'],
      usado:    ['✓', 'Boleto ya usado', 'Este boleto ya se registró en la entrada.'],
      sinpago:  ['✕', 'Pago pendiente', 'Todavía no confirmamos el pago de este boleto.'],
      noexiste: ['✕', 'Boleto no válido', 'Este código no está en la lista de invitados.'],
    };
    const [icono, titulo, detalle] = textos[r.estado];
    const equipo = el('div', {class: 'oculto'}, formularioPin('', registrar));
    const abrir = el('button', {type: 'button', class: 'enlace', text: '¿Eres del equipo de la puerta?'});
    abrir.onclick = () => { equipo.classList.remove('oculto'); abrir.remove(); };
    pintar([el('p', {class: 'eti', text: D.evento}), el('div', {class: 'icono', text: icono}),
      el('h1', {text: titulo}), el('p', {text: detalle}), abrir, equipo]);
  }

  async function panel() {
    pintar([el('p', {class: 'gris', text: 'Cargando…'})]);
    let r;
    try { r = await llamar('resumenPuerta', pinGuardado()); } catch (e) { return errorRed(); }
    if (r.error === 'pin') { guardar(null); return pantallaPin('PIN incorrecto. Escríbelo de nuevo.'); }
    if (r.error === 'bloqueado') return pintar([el('h1', {text: 'Demasiados intentos'}), el('p', {text: 'Espera 15 minutos e inténtalo de nuevo.'})]);
    const olvidar = el('button', {type: 'button', class: 'sec', text: 'Olvidar el PIN en este celular'});
    olvidar.onclick = () => { guardar(null); inicio(); };
    const actualizar = el('button', {type: 'button', text: 'Actualizar'});
    actualizar.onclick = panel;
    pintar([el('p', {class: 'eti', text: 'Equipo de la puerta'}), el('h1', {text: D.evento}),
      el('p', {text: 'Este celular ya puede registrar entradas: escanea cada QR con la cámara.'}),
      el('p', {class: 'nombre', text: r.personasLlegaron + ' de ' + r.personas}),
      el('p', {class: 'gris', text: 'personas han llegado (' + r.boletosLlegaron + ' de ' + r.boletos + ' boletos)'}),
      actualizar, olvidar]);
  }

  function inicio() {
    if (D.codigo) return pinGuardado() ? registrar() : vistaInvitado();
    return pinGuardado() ? panel() : pantallaPin();
  }
  inicio();
</script></body></html>`;
}


// =====================================================================
//  AYUDANTES DE LA HOJA
// =====================================================================

function hoja_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('LIBRO');
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(p.getProperty('HOJA') || '') ||
    ss.getSheets().find(s => s.getFormUrl()) || ss.getSheets()[0];
}

function sinAcentos_(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function clave_(titulo) {
  return { 'Pagado': 'pagado', 'Boleto enviado': 'enviado', 'Código': 'codigo', 'Llegada': 'llegada' }[titulo];
}

/** Número de columna (empezando en 1) de cada dato; 0 si no existe. */
function columnas_(h) {
  const enc = h.getRange(1, 1, 1, Math.max(1, h.getLastColumn())).getValues()[0].map(sinAcentos_);
  const col = (prueba) => enc.findIndex(prueba) + 1;
  return {
    nombre: col(t => t.startsWith('nombre')),
    asistentes: col(t => t.includes('asistentes')),
    correo: col(t => t === 'correo electronico') || col(t => t.includes('correo')),
    pagado: col(t => t === 'pagado'),
    enviado: col(t => t === 'boleto enviado'),
    codigo: col(t => t === 'codigo'),
    llegada: col(t => t === 'llegada'),
  };
}

function reglaCasilla_() {
  return SpreadsheetApp.newDataValidation().requireCheckbox().build();
}

function personas_(v) {
  return Math.max(1, parseInt(v, 10) || 1);
}

function buscar_(codigo) {
  codigo = String(codigo || '').trim().toUpperCase();
  if (!/^ART-[0-9A-F]{16}$/.test(codigo)) return null;
  const h = hoja_();
  const c = columnas_(h);
  if (!c.codigo || h.getLastRow() < 2) return null;
  const filas = h.getRange(2, 1, h.getLastRow() - 1, h.getLastColumn()).getValues();
  const i = filas.findIndex(f => String(f[c.codigo - 1]).trim().toUpperCase() === codigo);
  if (i < 0) return null;
  const f = filas[i];
  return {
    hoja: h, c: c, fila: i + 2,
    nombre: String(f[c.nombre - 1]).trim(),
    personas: personas_(c.asistentes ? f[c.asistentes - 1] : 1),
    pagado: f[c.pagado - 1] === true,
    llegada: f[c.llegada - 1] || null,
  };
}

function resumen_() {
  const h = hoja_();
  const c = columnas_(h);
  const r = { boletos: 0, personas: 0, boletosLlegaron: 0, personasLlegaron: 0 };
  if (h.getLastRow() < 2 || !c.pagado) return r;
  h.getRange(2, 1, h.getLastRow() - 1, h.getLastColumn()).getValues().forEach(f => {
    if (f[c.pagado - 1] !== true) return;
    const n = personas_(c.asistentes ? f[c.asistentes - 1] : 1);
    r.boletos++; r.personas += n;
    if (c.llegada && f[c.llegada - 1]) { r.boletosLlegaron++; r.personasLlegaron += n; }
  });
  return r;
}

function hora_(fecha) {
  return Utilities.formatDate(new Date(fecha), ZONA, 'h:mm a').toLowerCase();
}

function esc_(s) {
  return String(s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}


// =====================================================================
//  CÓDIGO QR → PNG (sin servicios externos)
//  Codificador QR (modo byte, corrección de errores nivel M) y un PNG
//  en blanco y negro sin comprimir. No hace falta tocar nada de aquí.
// =====================================================================
// --- QR-INICIO ---
const QR_ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
  26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const QR_BLOQUES_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
  17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];

function qrModulosCrudos_(v) {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const n = Math.floor(v / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (v >= 7) r -= 36;
  }
  return r;
}

function qrDatosCodewords_(v) {
  return Math.floor(qrModulosCrudos_(v) / 8) - QR_ECC_M[v] * QR_BLOQUES_M[v];
}

function qrMul_(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function qrDivisor_(grado) {
  const r = new Array(grado).fill(0);
  r[grado - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grado; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = qrMul_(r[j], raiz);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    raiz = qrMul_(raiz, 0x02);
  }
  return r;
}

function qrResto_(datos, divisor) {
  const r = new Array(divisor.length).fill(0);
  for (const b of datos) {
    const f = b ^ r.shift();
    r.push(0);
    divisor.forEach((coef, i) => { r[i] ^= qrMul_(coef, f); });
  }
  return r;
}

/** Devuelve una matriz de booleanos (true = negro) para el texto dado. */
function qrMatriz(texto) {
  const bytes = Array.from(unescape(encodeURIComponent(texto)), ch => ch.charCodeAt(0));

  // Versión mínima que alcanza
  let v = 1;
  for (; v <= 40; v++) {
    const bitsCuenta = v <= 9 ? 8 : 16;
    if (4 + bitsCuenta + 8 * bytes.length <= qrDatosCodewords_(v) * 8) break;
  }
  if (v > 40) throw new Error('Texto demasiado largo para un QR');
  const tam = v * 4 + 17;

  // Bits de datos
  const bits = [];
  const poner = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  poner(0b0100, 4);
  poner(bytes.length, v <= 9 ? 8 : 16);
  bytes.forEach(b => poner(b, 8));
  const capacidad = qrDatosCodewords_(v) * 8;
  poner(0, Math.min(4, capacidad - bits.length));
  poner(0, (8 - bits.length % 8) % 8);
  for (let relleno = 0xec; bits.length < capacidad; relleno ^= 0xec ^ 0x11) poner(relleno, 8);
  const datos = [];
  for (let i = 0; i < bits.length; i += 8) datos.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  // Corrección de errores y entrelazado
  const nBloques = QR_BLOQUES_M[v];
  const eccLen = QR_ECC_M[v];
  const crudos = Math.floor(qrModulosCrudos_(v) / 8);
  const nCortos = nBloques - crudos % nBloques;
  const largoCorto = Math.floor(crudos / nBloques);
  const divisor = qrDivisor_(eccLen);
  const bloques = [];
  for (let i = 0, k = 0; i < nBloques; i++) {
    const dat = datos.slice(k, k + largoCorto - eccLen + (i < nCortos ? 0 : 1));
    k += dat.length;
    const ecc = qrResto_(dat, divisor);
    if (i < nCortos) dat.push(0);
    bloques.push(dat.concat(ecc));
  }
  const final = [];
  for (let i = 0; i < bloques[0].length; i++) {
    bloques.forEach((b, j) => { if (i !== largoCorto - eccLen || j >= nCortos) final.push(b[i]); });
  }

  // Matriz y patrones fijos
  const m = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const fijo = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const fijar = (x, y, negro) => { m[y][x] = negro; fijo[y][x] = true; };

  for (let i = 0; i < tam; i++) { fijar(6, i, i % 2 === 0); fijar(i, 6, i % 2 === 0); }
  [[3, 3], [tam - 4, 3], [3, tam - 4]].forEach(([cx, cy]) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && x < tam && y >= 0 && y < tam) fijar(x, y, d !== 2 && d !== 4);
    }
  });
  if (v > 1) {
    const n = Math.floor(v / 7) + 2;
    const paso = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
    const pos = [6];
    for (let p = tam - 7; pos.length < n; p -= paso) pos.splice(1, 0, p);
    pos.forEach((px, i) => pos.forEach((py, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        fijar(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }));
  }
  const formato = (mascara) => {
    const d = (0 << 3) | mascara; // nivel M = 00
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412;
    const bit = (i) => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) fijar(8, i, bit(i));
    fijar(8, 7, bit(6)); fijar(8, 8, bit(7)); fijar(7, 8, bit(8));
    for (let i = 9; i < 15; i++) fijar(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) fijar(tam - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) fijar(8, tam - 15 + i, bit(i));
    fijar(8, tam - 8, true);
  };
  formato(0);
  if (v >= 7) {
    let r = v;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (v << 12) | r;
    for (let i = 0; i < 18; i++) {
      const negro = ((b >>> i) & 1) === 1;
      const a = tam - 11 + (i % 3), c = Math.floor(i / 3);
      fijar(a, c, negro); fijar(c, a, negro);
    }
  }

  // Datos en zigzag
  let i = 0;
  for (let der = tam - 1; der >= 1; der -= 2) {
    if (der === 6) der = 5;
    for (let vert = 0; vert < tam; vert++) for (let j = 0; j < 2; j++) {
      const x = der - j;
      const sube = ((der + 1) & 2) === 0;
      const y = sube ? tam - 1 - vert : vert;
      if (!fijo[y][x] && i < final.length * 8) {
        m[y][x] = ((final[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        i++;
      }
    }
  }

  // Elegir la máscara con menor penalización
  const invierte = (mk, x, y) => {
    switch (mk) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return (x * y) % 2 + (x * y) % 3 === 0;
      case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
      default: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    }
  };
  const aplicar = (mk) => {
    for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
      if (!fijo[y][x] && invierte(mk, x, y)) m[y][x] = !m[y][x];
    }
  };
  const penalizacion = () => {
    let p = 0;
    const lineas = [];
    for (let k = 0; k < tam; k++) {
      lineas.push(m[k].slice());
      lineas.push(m.map(fila => fila[k]));
    }
    const patA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], patB = patA.slice().reverse();
    lineas.forEach(l => {
      let corrida = 1;
      for (let k = 1; k <= tam; k++) {
        if (k < tam && l[k] === l[k - 1]) { corrida++; continue; }
        if (corrida >= 5) p += 3 + (corrida - 5);
        corrida = 1;
      }
      for (let k = 0; k + 11 <= tam; k++) {
        const okA = patA.every((b, t) => l[k + t] === (b === 1));
        const okB = patB.every((b, t) => l[k + t] === (b === 1));
        if (okA) p += 40;
        if (okB) p += 40;
      }
    });
    let negros = 0;
    for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
      if (m[y][x]) negros++;
      if (x < tam - 1 && y < tam - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    }
    const total = tam * tam;
    p += (Math.ceil(Math.abs(negros * 20 - total * 10) / total) - 1) * 10;
    return p;
  };
  let mejor = 0, menor = Infinity;
  for (let mk = 0; mk < 8; mk++) {
    aplicar(mk); formato(mk);
    const p = penalizacion();
    if (p < menor) { menor = p; mejor = mk; }
    aplicar(mk); // deshacer
  }
  aplicar(mejor); formato(mejor);
  return m;
}

/** PNG en blanco y negro (arreglo de bytes 0–255) del QR del texto. */
function qrPng(texto, escala) {
  const m = qrMatriz(texto);
  const borde = 4;
  const lado = (m.length + borde * 2) * escala;
  const bytesFila = Math.ceil(lado / 8);
  const crudo = [];
  for (let py = 0; py < lado; py++) {
    crudo.push(0); // filtro "ninguno"
    const my = Math.floor(py / escala) - borde;
    for (let bx = 0; bx < bytesFila; bx++) {
      let byte = 0;
      for (let k = 0; k < 8; k++) {
        const px = bx * 8 + k;
        const mx = Math.floor(px / escala) - borde;
        const negro = px < lado && my >= 0 && my < m.length && mx >= 0 && mx < m.length && m[my][mx];
        byte = (byte << 1) | (negro ? 0 : 1); // 1 = blanco
      }
      crudo.push(byte);
    }
  }
  // zlib con bloques "stored" (sin comprimir)
  const z = [0x78, 0x01];
  for (let i = 0; i < crudo.length || i === 0; i += 65535) {
    const trozo = crudo.slice(i, i + 65535);
    const ultimo = i + 65535 >= crudo.length;
    z.push(ultimo ? 1 : 0, trozo.length & 255, trozo.length >>> 8, ~trozo.length & 255, (~trozo.length >>> 8) & 255);
    for (const b of trozo) z.push(b);
  }
  let a = 1, b = 0;
  for (const x of crudo) { a = (a + x) % 65521; b = (b + a) % 65521; }
  z.push(b >>> 8, b & 255, a >>> 8, a & 255);

  const tablaCrc = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tablaCrc.push(c >>> 0);
  }
  const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const trozoPng = (tipo, datos) => {
    const t = Array.from(tipo, ch => ch.charCodeAt(0)).concat(datos);
    let c = 0xffffffff;
    for (const x of t) c = tablaCrc[(c ^ x) & 255] ^ (c >>> 8);
    return u32(datos.length).concat(t, u32((c ^ 0xffffffff) >>> 0));
  };
  return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    .concat(trozoPng('IHDR', u32(lado).concat(u32(lado), [1, 0, 0, 0, 0])))
    .concat(trozoPng('IDAT', z))
    .concat(trozoPng('IEND', []));
}
// --- QR-FIN ---
