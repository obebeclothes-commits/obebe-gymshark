/**
 * API para editar INVENTARIO desde el panel admin (localhost).
 * 1. Pega en Extensiones > Apps Script del libro INVENTARIO.
 * 2. Ajusta ADMIN_SECRET si quieres (debe coincidir con admin/admin-config.js).
 * 3. Implementar > Nueva implementación > Aplicación web
 *    - Ejecutar como: yo | Acceso: cualquiera
 * 4. Copia la URL en admin-config.js → appsScriptUrl
 */

var SPREADSHEET_ID = '195xshQr985FH1FI4xzBhQrvrBEayAE5_manTNrfH-ko';
var HOJA_INVENTARIO = 'INVENTARIO';
var HOJA_VENTAS = 'VENTAS';
var ADMIN_SECRET = 'OBebeClotes.1';
var COL_STOCK = 3;
var FILA_DATOS_INICIO = 3;
var NUM_COLUMNAS = 29;

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkAuth(body) {
  if (!body || body.secret !== ADMIN_SECRET) {
    return { ok: false, error: 'No autorizado' };
  }
  return null;
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var auth = checkAuth(body);
    if (auth) return jsonOut(auth);

    if (body.action === 'ping') {
      return jsonOut({ ok: true, message: 'API inventario OK' });
    }
    if (body.action === 'updateCells') {
      return jsonOut(updateCells(body.updates || []));
    }
    if (body.action === 'appendRow') {
      return jsonOut(appendRow(body.celdas || []));
    }
    if (body.action === 'deleteRows') {
      return jsonOut(deleteRows(body.filas || []));
    }
    if (body.action === 'registrarVentaRetail') {
      return jsonOut(registrarVentaRetail(body));
    }
    if (body.action === 'actualizarStock') {
      return jsonOut(actualizarStock(body.filaSheet, body.stock));
    }
    return jsonOut({ ok: false, error: 'Acción desconocida' });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  var secret = e && e.parameter && e.parameter.secret;
  if (secret !== ADMIN_SECRET) {
    return jsonOut({ ok: false, error: 'No autorizado' });
  }
  return jsonOut({ ok: true, hoja: HOJA_INVENTARIO, columnas: NUM_COLUMNAS });
}

function getSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var ws = ss.getSheetByName(HOJA_INVENTARIO);
  if (!ws) throw new Error('No existe la hoja INVENTARIO');
  return ws;
}

function updateCells(updates) {
  var ws = getSheet_();
  var n = 0;
  updates.forEach(function (u) {
    var row = parseInt(u.row, 10);
    var col = parseInt(u.col, 10);
    if (row < FILA_DATOS_INICIO || col < 1 || col > NUM_COLUMNAS) return;
    ws.getRange(row, col).setValue(u.value == null ? '' : u.value);
    n++;
  });
  SpreadsheetApp.flush();
  return { ok: true, updated: n };
}

function appendRow(celdas) {
  var ws = getSheet_();
  var row = [];
  for (var c = 0; c < NUM_COLUMNAS; c++) {
    row.push(c < celdas.length ? celdas[c] : '');
  }
  ws.appendRow(row);
  SpreadsheetApp.flush();
  return { ok: true, fila: ws.getLastRow() };
}

function getSheetVentas_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var ws = ss.getSheetByName(HOJA_VENTAS);
  if (!ws) throw new Error('No existe la hoja VENTAS');
  return ws;
}

/** ventas: filas B–N (array de 13 valores). stockUpdates: { row, stock } */
function registrarVentaRetail(body) {
  body = body || {};
  var ventas = body.ventas || [];
  var stockUpdates = body.stockUpdates || [];
  if (!ventas.length) {
    return { ok: false, error: 'Sin líneas de venta.' };
  }
  var wsV = getSheetVentas_();
  var wsI = getSheet_();
  ventas.forEach(function (v) {
    var row = [''];
    for (var i = 0; i < 13; i++) {
      row.push(v[i] != null ? v[i] : '');
    }
    wsV.appendRow(row);
  });
  stockUpdates.forEach(function (u) {
    var row = parseInt(u.row, 10);
    var stock = parseInt(u.stock, 10);
    if (row < FILA_DATOS_INICIO || isNaN(stock) || stock < 0) return;
    wsI.getRange(row, COL_STOCK).setValue(stock);
  });
  SpreadsheetApp.flush();
  return { ok: true, ventas: ventas.length, stockUpdates: stockUpdates.length };
}

function actualizarStock(filaSheet, stock) {
  var row = parseInt(filaSheet, 10);
  var n = parseInt(stock, 10);
  if (row < FILA_DATOS_INICIO || isNaN(n) || n < 0) {
    return { ok: false, error: 'Fila o stock inválido.' };
  }
  getSheet_().getRange(row, COL_STOCK).setValue(n);
  SpreadsheetApp.flush();
  return { ok: true, row: row, stock: n };
}

function deleteRows(filasSheet) {
  var ws = getSheet_();
  var nums = filasSheet.map(function (r) { return parseInt(r, 10); })
    .filter(function (r) { return r >= FILA_DATOS_INICIO; })
    .sort(function (a, b) { return b - a; });
  nums.forEach(function (r) {
    ws.deleteRow(r);
  });
  SpreadsheetApp.flush();
  return { ok: true, deleted: nums.length };
}
