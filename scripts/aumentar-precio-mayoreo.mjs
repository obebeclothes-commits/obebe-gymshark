/**
 * Sube Mayoreo +20 (col P, idx 15) y Mayoreo +50 (col V, idx 21) un % vía updateCells.
 * Uso: set OBEBE_ADMIN_SECRET=... && node scripts/aumentar-precio-mayoreo.mjs 10
 */
const PCT = parseFloat(process.argv[2] || '10');
const SUPABASE_URL = 'https://yueajorzawaanubgekpm.supabase.co';
const ANON = 'sb_publishable_eML6LBPIdOyq0XRX2r6uEw_HCAsGAbp';
const ADMIN_API = SUPABASE_URL + '/functions/v1/admin-api';
const SECRET = process.env.OBEBE_ADMIN_SECRET || '';
const IDX_MAYOREO_20 = 15;
const IDX_MAYOREO_50 = 21;
const NUM_COLS = 29;

function parseNum(val) {
  let t = String(val ?? '').trim();
  if (!t) return 0;
  t = t.replace(/\$/g, '').replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
  else t = t.replace(/,/g, '');
  t = t.replace(/[^\d.-]/g, '');
  const n = parseFloat(t);
  return Number.isNaN(n) ? 0 : n;
}

function formatPrecio(original, n) {
  const rounded = Math.round(n);
  if (rounded <= 0) return String(original || '').trim();
  const hadDollar = String(original || '').includes('$');
  const s = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return hadDollar ? '$' + s : s;
}

function pad(c) {
  const out = [];
  for (let i = 0; i < NUM_COLS; i++) out.push(i < c.length ? String(c[i] ?? '') : '');
  return out;
}

async function fetchRows() {
  const url = SUPABASE_URL + '/rest/v1/inventario_filas?select=id,celdas&order=id.asc&limit=5000';
  const res = await fetch(url, {
    headers: { apikey: ANON, Authorization: 'Bearer ' + ANON },
  });
  if (!res.ok) throw new Error('Inventario HTTP ' + res.status);
  return res.json();
}

async function updateCells(updates) {
  const res = await fetch(ADMIN_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + ANON,
    },
    body: JSON.stringify({ action: 'updateCells', secret: SECRET, updates }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('API no JSON: ' + text.slice(0, 200));
  }
  if (!res.ok && data.ok !== true) throw new Error(data.error || text);
  return data;
}

async function main() {
  if (!SECRET) {
    console.error('Define OBEBE_ADMIN_SECRET (inventarioSecret en admin-config.js).');
    process.exit(1);
  }
  if (Number.isNaN(PCT) || PCT <= -100) {
    console.error('Porcentaje inválido');
    process.exit(1);
  }
  const factor = 1 + PCT / 100;
  const rows = await fetchRows();
  const updates = [];
  let filas20 = 0;
  let filas50 = 0;
  for (const r of rows) {
    const id = parseInt(r.id, 10);
    if (!id) continue;
    const celdas = pad(Array.isArray(r.celdas) ? r.celdas : []);
    const raw20 = celdas[IDX_MAYOREO_20];
    const p20 = parseNum(raw20);
    if (p20 > 0) {
      filas20++;
      const n20 = Math.round(p20 * factor * 100) / 100;
      updates.push({ row: id, col: IDX_MAYOREO_20 + 1, value: formatPrecio(raw20, n20) });
    }
    const raw50 = celdas[IDX_MAYOREO_50];
    const p50 = parseNum(raw50);
    if (p50 > 0) {
      filas50++;
      const n50 = Math.round(p50 * factor * 100) / 100;
      updates.push({ row: id, col: IDX_MAYOREO_50 + 1, value: formatPrecio(raw50, n50) });
    }
  }
  console.log('Mayoreo +20:', filas20, '| Mayoreo +50:', filas50, '| celdas:', updates.length, '| +' + PCT + '%');
  const CHUNK = 60;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = updates.slice(i, i + CHUNK);
    const res = await updateCells(batch);
    console.log('Lote', Math.floor(i / CHUNK) + 1, '→ updated', res.updated ?? batch.length);
  }
  console.log('Listo.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
