/**
 * Rellena PRECIO RETAIL (col 7) y COSTO NETO (col 12) en Compras (blob nube).
 * Toma el USD de compras-detectadas / col 11 y cotiza retail con la fórmula del cotizador.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SUPABASE_URL = 'https://yueajorzawaanubgekpm.supabase.co';
const ANON = 'sb_publishable_eML6LBPIdOyq0XRX2r6uEw_HCAsGAbp';
const ADMIN_API = SUPABASE_URL + '/functions/v1/admin-api';
const SECRET = process.env.OBEBE_ADMIN_SECRET || 'OBebeClotes.1';
const REF_MIN = 539;
const REF_MAX = 650;

const SUCURSALES_BLOB_ID = 'obebe-sucursales-blob';
const COMPRAS_BLOB_ID = 'obebe-compras-blob';
const ENTREGAS_DELETED_BLOB_ID = 'obebe-entregas-deleted-blob';

const CFG = {
  factorUsd: 1.085,
  valorDolar: 18.9,
  envio: 40,
  margen: 0.3,
};

function numCelda(v) {
  const t = String(v ?? '')
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '');
  const n = parseFloat(t);
  return Number.isNaN(n) ? 0 : n;
}

function cotizarUsd(usd) {
  const u = Number(usd) || 0;
  if (u <= 0) return 0;
  const mxn = u * CFG.factorUsd * CFG.valorDolar + CFG.envio;
  const div = 1 - CFG.margen;
  const raw = mxn / div;
  return Math.ceil(raw / 10) * 10;
}

function recalcular(celdas) {
  const qty = numCelda(celdas[2]);
  const retail = numCelda(celdas[7]);
  const neto = numCelda(celdas[12]);
  celdas[8] = retail > 0 ? String(Math.round(qty * retail)) : '';
  celdas[13] = neto > 0 ? String(Math.round(qty * neto)) : '';
  celdas[14] =
    retail > 0 && neto > 0
      ? String(Math.round(((retail - neto) / retail) * 100)) + '%'
      : '';
}

function parseRef(celdas) {
  const n = parseInt(String((celdas || [])[0] || '').trim(), 10);
  return Number.isNaN(n) ? 0 : n;
}

async function adminApi(action, payload = {}) {
  const res = await fetch(ADMIN_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + ANON,
    },
    body: JSON.stringify({ action, secret: SECRET, ...payload }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('API no JSON: ' + text.slice(0, 300));
  }
  if (data.ok === false) throw new Error(data.error || 'Error API');
  return data;
}

function partirEntregas(arr) {
  const entregas = [];
  let lineas = [];
  let compras = [];
  let borradas = {};
  (arr || []).forEach((item) => {
    if (!item || !item.id) return;
    if (item.id === SUCURSALES_BLOB_ID) {
      if (Array.isArray(item.lineas)) lineas = lineas.concat(item.lineas);
    } else if (item.id === COMPRAS_BLOB_ID) {
      if (Array.isArray(item.lineas)) compras = compras.concat(item.lineas);
    } else if (item.id === ENTREGAS_DELETED_BLOB_ID) {
      if (item.deleted && typeof item.deleted === 'object') borradas = { ...borradas, ...item.deleted };
    } else {
      entregas.push(item);
    }
  });
  return { entregas, lineas, compras, borradas };
}

function payloadEntregas(entregas, lineas, compras, borradas) {
  const out = (entregas || []).filter(
    (item) =>
      item &&
      item.id !== SUCURSALES_BLOB_ID &&
      item.id !== COMPRAS_BLOB_ID &&
      item.id !== ENTREGAS_DELETED_BLOB_ID,
  );
  const ts = Date.now();
  out.push({ id: SUCURSALES_BLOB_ID, _modulo: 'sucursales', lineas: lineas || [], actualizadoEn: ts });
  out.push({ id: COMPRAS_BLOB_ID, _modulo: 'compras', lineas: compras || [], actualizadoEn: ts });
  out.push({
    id: ENTREGAS_DELETED_BLOB_ID,
    _modulo: 'entregas-deleted',
    deleted: borradas || {},
    actualizadoEn: ts,
  });
  return out;
}

function loadDetectadasUsd() {
  const p = path.join(ROOT, 'admin', 'compras-detectadas.js');
  const t = fs.readFileSync(p, 'utf8');
  const arr = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1));
  const map = new Map();
  for (const row of arr) {
    const ref = parseRef(row.celdas);
    if (ref < REF_MIN || ref > REF_MAX) continue;
    const usd = numCelda(row.celdas[11]) || numCelda(row.celdas[12]);
    if (usd > 0) map.set(ref, usd);
  }
  return map;
}

function padCeldas(c) {
  const out = [];
  for (let i = 0; i < 29; i++) out.push(i < c.length ? String(c[i] ?? '') : '');
  return out;
}

async function main() {
  const usdPorRef = loadDetectadasUsd();
  const blobRes = await adminApi('getAdminModuloBlob', { moduleKey: 'entregas' });
  const partido = partirEntregas(blobRes.payload || []);
  let touched = 0;
  const compras = (partido.compras || []).map((row) => {
    const celdas = padCeldas(row.celdas);
    const ref = parseRef(celdas);
    if (ref < REF_MIN || ref > REF_MAX) return row;
    const usd =
      usdPorRef.get(ref) || numCelda(celdas[11]) || numCelda(celdas[12]);
    if (!(usd > 0)) return row;
    if (!String(celdas[12] || '').trim()) {
      celdas[12] = String(usd);
    }
    if (!String(celdas[11] || '').trim() && usdPorRef.get(ref)) {
      celdas[11] = String(usdPorRef.get(ref));
    }
    const retail = cotizarUsd(usd);
    celdas[7] = String(retail);
    recalcular(celdas);
    touched++;
    return { ...row, celdas, actualizadoEn: Date.now() };
  });
  console.log('Filas actualizadas (refs', REF_MIN + '–' + REF_MAX + '):', touched);
  if (!touched) {
    console.log('Nada que actualizar.');
    return;
  }
  const payload = payloadEntregas(partido.entregas, partido.lineas, compras, partido.borradas);
  await adminApi('setAdminModuloBlob', { moduleKey: 'entregas', payload });
  const ej = compras.find((r) => parseRef(r.celdas) === 539);
  if (ej) {
    console.log('Ejemplo 539 → retail', ej.celdas[7], 'neto', ej.celdas[12], 'total', ej.celdas[8]);
  }
  console.log('Listo. Recarga Compras en el admin (F5).');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
