/**
 * Revierte subida accidental a inventario (refs 539–650): quita filas del inventario
 * y las restaura en Compras (blob entregas / obebe-compras-blob).
 * Uso: node scripts/revertir-compras-539-650.mjs
 */
const SUPABASE_URL = 'https://yueajorzawaanubgekpm.supabase.co';
const ANON = 'sb_publishable_eML6LBPIdOyq0XRX2r6uEw_HCAsGAbp';
const ADMIN_API = SUPABASE_URL + '/functions/v1/admin-api';
const SECRET = process.env.OBEBE_ADMIN_SECRET || 'OBebeClotes.1';
const REF_MIN = 539;
const REF_MAX = 650;
const NUM_COLS = 29;

const SUCURSALES_BLOB_ID = 'obebe-sucursales-blob';
const COMPRAS_BLOB_ID = 'obebe-compras-blob';
const ENTREGAS_DELETED_BLOB_ID = 'obebe-entregas-deleted-blob';

function pad(c) {
  const out = [];
  for (let i = 0; i < NUM_COLS; i++) out.push(i < c.length ? String(c[i] ?? '') : '');
  return out;
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
  if (!res.ok && data.ok !== true) throw new Error(data.error || text);
  if (data.ok === false) throw new Error(data.error || 'Error API');
  return data;
}

async function fetchInventario() {
  const url = SUPABASE_URL + '/rest/v1/inventario_filas?select=id,celdas&order=id.asc&limit=5000';
  const res = await fetch(url, {
    headers: { apikey: ANON, Authorization: 'Bearer ' + ANON },
  });
  if (!res.ok) throw new Error('Inventario HTTP ' + res.status);
  return res.json();
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
  const out = (entregas || []).filter((item) => item && item.id !== SUCURSALES_BLOB_ID && item.id !== COMPRAS_BLOB_ID && item.id !== ENTREGAS_DELETED_BLOB_ID);
  const ts = Date.now();
  out.push({
    id: SUCURSALES_BLOB_ID,
    _modulo: 'sucursales',
    lineas: lineas || [],
    actualizadoEn: ts,
  });
  out.push({
    id: COMPRAS_BLOB_ID,
    _modulo: 'compras',
    lineas: compras || [],
    actualizadoEn: ts,
  });
  out.push({
    id: ENTREGAS_DELETED_BLOB_ID,
    _modulo: 'entregas-deleted',
    deleted: borradas || {},
    actualizadoEn: ts,
  });
  return out;
}

function celdasParaCompras(celdas, ref) {
  const c = pad(celdas);
  if (!String(c[9] || '').trim() && ref) c[9] = 'hombre/' + ref + '.webp';
  return c;
}

function filaComprasDesdeInventario(row) {
  const ref = parseRef(row.celdas);
  const celdas = celdasParaCompras(row.celdas, ref);
  return {
    id: 'com-rev-' + ref + '-' + row.id,
    celdas,
    actualizadoEn: Date.now(),
  };
}

async function main() {
  const rows = await fetchInventario();
  const targets = rows.filter((r) => {
    const ref = parseRef(r.celdas);
    return ref >= REF_MIN && ref <= REF_MAX;
  });
  console.log('Filas inventario refs', REF_MIN + '–' + REF_MAX + ':', targets.length);
  if (targets.length !== 112) {
    console.warn('Se esperaban 112; continúo con', targets.length);
  }
  if (!targets.length) {
    console.log('Nada que revertir.');
    return;
  }

  const ids = targets.map((r) => parseInt(r.id, 10)).filter(Boolean);
  const comprasNuevas = targets
    .slice()
    .sort((a, b) => parseRef(a.celdas) - parseRef(b.celdas))
    .map(filaComprasDesdeInventario);

  const blobRes = await adminApi('getAdminModuloBlob', { moduleKey: 'entregas' });
  const partido = partirEntregas(blobRes.payload || []);
  const refsExistentes = new Set(
    (partido.compras || []).map((r) => String((r.celdas || [])[0] || '').trim()).filter(Boolean),
  );
  const aAgregar = comprasNuevas.filter((r) => !refsExistentes.has(String(r.celdas[0]).trim()));
  const comprasFinal = (partido.compras || []).concat(aAgregar);
  console.log('Compras en nube antes:', partido.compras.length, '| a agregar:', aAgregar.length, '| después:', comprasFinal.length);

  const CHUNK = 80;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = ids.slice(i, i + CHUNK);
    const del = await adminApi('deleteRows', { filas: batch });
    console.log('deleteRows lote', Math.floor(i / CHUNK) + 1, '→', del.deleted ?? batch.length);
  }

  const payload = payloadEntregas(partido.entregas, partido.lineas, comprasFinal, partido.borradas);
  await adminApi('setAdminModuloBlob', { moduleKey: 'entregas', payload });
  console.log('Compras restauradas en nube. Abre admin → Compras y sincroniza (o recarga).');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
