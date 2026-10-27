/**
 * INVENTARIO — columna J (vista previa)
 * Columna A = número de foto | Columna T = HOMBRE / MUJER
 * Pega este archivo en Extensiones > Apps Script del Google Sheet.
 */

var SPREADSHEET_ID = '195xshQr985FH1FI4xzBhQrvrBEayAE5_manTNrfH-ko';
var HOJA_INVENTARIO = 'INVENTARIO';

/** Misma base que la tienda (cambia si usas otro dominio). */
var BASE_URL_IMAGENES = 'https://obebeclothes-commits.github.io/obebe-gymshark';
// var BASE_URL_IMAGENES = 'https://obebe.store';

var COLUMNA_J_PROGRESO = 'columnaJIndicePendiente';
var MAX_RUN_MS = 5 * 60 * 1000 + 20 * 1000;

var FILA_INICIO = 3;
var COL_NUMERO_FOTO = 1;   // A
var COL_NOMBRE = 2;        // B
var COL_SEGMENTO = 20;     // T (HOMBRE / MUJER)
var COL_UBICACION = 28;    // AB (respaldo si T vacía)
var COL_J = 10;            // J

function urlCompatibleSheets(url) {
  if (!url) return '';
  if (/\.(png|jpe?g|gif)(\?|$)/i.test(url)) return url;
  var hostPath = url.replace(/^https?:\/\//i, '');
  return 'https://images.weserv.nl/?url=' + encodeURIComponent(hostPath) + '&w=150&output=jpg';
}

function urlToCellImage(url) {
  if (!url) return '';
  var sheetUrl = urlCompatibleSheets(url);
  try {
    var resp = UrlFetchApp.fetch(sheetUrl, { muteHttpExceptions: true, followRedirects: true });
    if (resp.getResponseCode() !== 200) {
      Logger.log('HTTP ' + resp.getResponseCode() + ' -> ' + sheetUrl);
      return '';
    }
    var b64 = Utilities.base64Encode(resp.getBlob().getBytes());
    return SpreadsheetApp.newCellImage()
      .setSourceUrl('data:image/jpeg;base64,' + b64)
      .setAltTextTitle('Producto')
      .build();
  } catch (e) {
    Logger.log('Error imagen ' + url + ': ' + e);
    return '';
  }
}

function normalizarSegmento(valor) {
  var s = String(valor || '').trim().toUpperCase();
  if (s === 'MUJER' || s === 'WOMAN' || s === 'WOMEN' || s === 'F') return 'mujer';
  return 'hombre';
}

function carpetaImagenDesdeFila(segmentoT, ubicacionAB) {
  if (String(segmentoT || '').trim()) {
    return normalizarSegmento(segmentoT);
  }
  var u = String(ubicacionAB || '').toLowerCase();
  if (u.indexOf('mujer') >= 0 || u.indexOf('dama') >= 0) return 'mujer';
  if (u.indexOf('hombre') >= 0 || u.indexOf('caballero') >= 0) return 'hombre';
  return 'hombre';
}

/** URL pública hombre/{n}.webp o mujer/{n}.webp según la fila. */
function urlImagenFila(numeroFoto, carpeta) {
  var n = parseInt(String(numeroFoto).trim(), 10);
  if (!n || n <= 0) return '';
  var base = BASE_URL_IMAGENES.replace(/\/$/, '');
  return base + '/' + carpeta + '/' + n + '.webp';
}

/**
 * Una URL por fila de datos (no lista fija mezclando hombre/mujer).
 */
function getDatosInventario() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var ws = ss.getSheetByName(HOJA_INVENTARIO);
  if (!ws) throw new Error('No existe la hoja INVENTARIO');

  var lastRow = ws.getLastRow();
  if (lastRow < FILA_INICIO) {
    return { ws: ws, urls: [], filaInicio: FILA_INICIO, col: COL_J };
  }

  var numFilas = lastRow - FILA_INICIO + 1;
  var colA = ws.getRange(FILA_INICIO, COL_NUMERO_FOTO, numFilas, 1).getValues();
  var colB = ws.getRange(FILA_INICIO, COL_NOMBRE, numFilas, 1).getValues();
  var colT = ws.getRange(FILA_INICIO, COL_SEGMENTO, numFilas, 1).getValues();
  var colAB = ws.getRange(FILA_INICIO, COL_UBICACION, numFilas, 1).getValues();

  var urls = [];
  for (var i = 0; i < numFilas; i++) {
    var nombre = colB[i][0];
    if (!nombre || String(nombre).trim().toUpperCase() === 'NOMBRE') {
      urls.push('');
      continue;
    }
    var carpeta = carpetaImagenDesdeFila(colT[i][0], colAB[i][0]);
    urls.push(urlImagenFila(colA[i][0], carpeta));
  }

  return {
    ws: ws,
    urls: urls,
    filaInicio: FILA_INICIO,
    col: COL_J
  };
}

function primerIndicePendiente(ws, filaInicio, col, urls) {
  var actuales = ws.getRange(filaInicio, col, urls.length, 1).getValues();
  for (var i = 0; i < actuales.length; i++) {
    if (urls[i] && !actuales[i][0]) return i;
  }
  return urls.length;
}

function procesarColumnaJ(soloFaltantes) {
  var datos = getDatosInventario();
  var ws = datos.ws;
  var urls = datos.urls;
  var filaInicio = datos.filaInicio;
  var col = datos.col;
  var props = PropertiesService.getScriptProperties();
  var inicio = 0;

  if (soloFaltantes) {
    inicio = primerIndicePendiente(ws, filaInicio, col, urls);
    Logger.log('Continuando desde fila ' + (filaInicio + inicio) + ' (indice ' + inicio + ')');
  } else {
    var guardado = props.getProperty(COLUMNA_J_PROGRESO);
    inicio = guardado ? parseInt(guardado, 10) : 0;
  }

  if (inicio >= urls.length) {
    props.deleteProperty(COLUMNA_J_PROGRESO);
    Logger.log('Nada pendiente. Columna J ya esta completa.');
    return;
  }

  var t0 = Date.now();
  var chunkSize = 30;

  for (var i = inicio; i < urls.length; i += chunkSize) {
    if (Date.now() - t0 > MAX_RUN_MS) {
      props.setProperty(COLUMNA_J_PROGRESO, String(i));
      Logger.log('Tiempo agotado. Quedan desde fila ' + (filaInicio + i) + '. Ejecuta continuarColumnaJVistaImagenes().');
      return;
    }

    var slice = urls.slice(i, i + chunkSize);
    var valores = slice.map(function (url) {
      if (!url) return [''];
      var img = urlToCellImage(url);
      return [img || ''];
    });
    ws.getRange(filaInicio + i, col, valores.length, 1).setValues(valores);
    SpreadsheetApp.flush();
    props.setProperty(COLUMNA_J_PROGRESO, String(Math.min(i + chunkSize, urls.length)));
  }

  props.deleteProperty(COLUMNA_J_PROGRESO);
  ws.setColumnWidth(col, 120);
  Logger.log('Listo. Columna J actualizada en INVENTARIO: ' + urls.length + ' filas.');
}

/** Empieza de cero (borra progreso guardado). */
function actualizarColumnaJVistaImagenes() {
  PropertiesService.getScriptProperties().deleteProperty(COLUMNA_J_PROGRESO);
  procesarColumnaJ(false);
}

/** Solo celdas vacías (si se cortó por tiempo). */
function continuarColumnaJVistaImagenes() {
  procesarColumnaJ(true);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Obebe inventario')
    .addItem('Actualizar columna J (fotos)', 'actualizarColumnaJVistaImagenes')
    .addItem('Continuar columna J (faltantes)', 'continuarColumnaJVistaImagenes')
    .addToUi();
}
