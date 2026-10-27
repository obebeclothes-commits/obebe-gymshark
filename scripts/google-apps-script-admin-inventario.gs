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
var ADMIN_SECRET = 'OBebeClotes.1';
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
