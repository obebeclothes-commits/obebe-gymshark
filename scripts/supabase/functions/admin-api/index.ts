/**
 * Despliegue (CLI Supabase):
 *   supabase link --project-ref TU_REF
 *   supabase secrets set ADMIN_SECRET=OBebeClotes.1
 *   supabase functions deploy admin-api --no-verify-jwt
 * URL: https://TU_REF.supabase.co/functions/v1/admin-api
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const NUM_COLUMNAS = 29;
const COL_STOCK = 3;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function padCeldas(arr: unknown[]): string[] {
  const out: string[] = [];
  for (let c = 0; c < NUM_COLUMNAS; c++) {
    out.push(c < arr.length ? String(arr[c] ?? "") : "");
  }
  return out;
}

function checkAuth(body: Record<string, unknown>) {
  const secret = Deno.env.get("ADMIN_SECRET") || "OBebeClotes.1";
  if (!body || body.secret !== secret) {
    return { ok: false, error: "No autorizado" };
  }
  return null;
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

async function getVentas() {
  const sb = adminClient();
  const { data, error } = await sb
    .from("ventas_lineas")
    .select("*")
    .order("fecha_iso", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(15000);
  if (error) throw error;
  const ventas = (data || []).map((v) => ({
    fechaIso: v.fecha_iso || "",
    fechaRaw: v.fecha_raw || "",
    nombre: v.nombre || "",
    tipo: v.tipo || "",
    precio: Number(v.precio) || 0,
    talla: v.talla || "",
    color: v.color || "",
    segmento: v.segmento || "",
    cliente: v.cliente || "",
    vendedor: v.vendedor || "",
    cuenta: v.cuenta || "",
    redSocial: v.red_social || "",
    link: v.link || "",
    telefono: v.telefono || "",
    filaSheet: v.id,
  }));
  return { ok: true, ventas };
}

function ventaLineToRow(v: unknown[]) {
  const a = v as string[];
  return {
    fecha_raw: a[0] ?? "",
    fecha_iso: parseFechaIso(a[0] ?? ""),
    nombre: a[1] ?? "",
    tipo: a[2] ?? "",
    precio: parseFloat(String(a[3] ?? "0")) || 0,
    talla: a[4] ?? "",
    color: a[5] ?? "",
    segmento: a[6] ?? "",
    cliente: a[7] ?? "",
    vendedor: a[8] ?? "",
    cuenta: a[9] ?? "",
    red_social: a[10] ?? "",
    link: a[11] ?? "",
    telefono: a[12] ?? "",
  };
}

function parseFechaIso(raw: string): string | null {
  const t = String(raw || "").trim();
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[1], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

async function registrarVentaRetail(body: Record<string, unknown>) {
  const ventas = (body.ventas || []) as unknown[][];
  const stockUpdates = (body.stockUpdates || []) as { row: number; stock: number }[];
  if (!ventas.length) return { ok: false, error: "Sin líneas de venta." };

  const sb = adminClient();
  const rows = ventas.map(ventaLineToRow);
  const { error: eV } = await sb.from("ventas_lineas").insert(rows);
  if (eV) throw eV;

  for (const u of stockUpdates) {
    const id = parseInt(String(u.row), 10);
    const stock = parseInt(String(u.stock), 10);
    if (!id || isNaN(stock) || stock < 0) continue;
    const { data: fila, error: eF } = await sb
      .from("inventario_filas")
      .select("celdas")
      .eq("id", id)
      .maybeSingle();
    if (eF || !fila) continue;
    const celdas = padCeldas((fila.celdas as unknown[]) || []);
    celdas[COL_STOCK - 1] = String(stock);
    await sb
      .from("inventario_filas")
      .update({ celdas, updated_at: new Date().toISOString() })
      .eq("id", id);
  }
  return { ok: true, ventas: ventas.length, stockUpdates: stockUpdates.length };
}

async function actualizarStock(filaSheet: number, stock: number) {
  const id = parseInt(String(filaSheet), 10);
  const n = parseInt(String(stock), 10);
  if (!id || isNaN(n) || n < 0) return { ok: false, error: "Fila o stock inválido." };
  const sb = adminClient();
  const { data: fila, error: eF } = await sb
    .from("inventario_filas")
    .select("celdas")
    .eq("id", id)
    .maybeSingle();
  if (eF || !fila) return { ok: false, error: "Fila no encontrada." };
  const celdas = padCeldas((fila.celdas as unknown[]) || []);
  celdas[COL_STOCK - 1] = String(n);
  const { error } = await sb
    .from("inventario_filas")
    .update({ celdas, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return { ok: true, row: id, stock: n };
}

async function updateCells(updates: { row: number; col: number; value: string }[]) {
  const sb = adminClient();
  let n = 0;
  for (const u of updates) {
    const id = parseInt(String(u.row), 10);
    const col = parseInt(String(u.col), 10);
    if (!id || col < 1 || col > NUM_COLUMNAS) continue;
    const { data: fila, error: eF } = await sb
      .from("inventario_filas")
      .select("celdas")
      .eq("id", id)
      .maybeSingle();
    if (eF || !fila) continue;
    const celdas = padCeldas((fila.celdas as unknown[]) || []);
    celdas[col - 1] = u.value == null ? "" : String(u.value);
    const { error } = await sb
      .from("inventario_filas")
      .update({ celdas, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) n++;
  }
  return { ok: true, updated: n };
}

async function appendRow(celdasIn: unknown[]) {
  const celdas = padCeldas(celdasIn || []);
  const sb = adminClient();
  const { data, error } = await sb
    .from("inventario_filas")
    .insert({ celdas })
    .select("id")
    .single();
  if (error) throw error;
  return { ok: true, fila: data.id };
}

async function deleteRows(filas: number[]) {
  const sb = adminClient();
  const ids = filas.map((r) => parseInt(String(r), 10)).filter((r) => r > 0);
  if (!ids.length) return { ok: true, deleted: 0 };
  const { error } = await sb.from("inventario_filas").delete().in("id", ids);
  if (error) throw error;
  return { ok: true, deleted: ids.length };
}

async function importInventarioReplace(filas: { celdas: unknown[] }[]) {
  const sb = adminClient();
  await sb.from("inventario_filas").delete().neq("id", 0);
  const chunk = 200;
  let inserted = 0;
  for (let i = 0; i < filas.length; i += chunk) {
    const slice = filas.slice(i, i + chunk).map((f, j) => ({
      celdas: padCeldas(f.celdas || []),
      legacy_sheet_row: f.legacy_sheet_row ?? i + j + 3,
    }));
    const { error } = await sb.from("inventario_filas").insert(slice);
    if (error) throw error;
    inserted += slice.length;
  }
  return { ok: true, inserted };
}

async function importVentasReplace(ventas: unknown[][]) {
  const sb = adminClient();
  await sb.from("ventas_lineas").delete().neq("id", 0);
  const rows = ventas.map(ventaLineToRow);
  const chunk = 300;
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await sb.from("ventas_lineas").insert(rows.slice(i, i + chunk));
    if (error) throw error;
  }
  return { ok: true, inserted: rows.length };
}

async function importInventarioAppend(filas: { celdas: unknown[] }[]) {
  const sb = adminClient();
  const chunk = 200;
  let inserted = 0;
  for (let i = 0; i < filas.length; i += chunk) {
    const slice = filas.slice(i, i + chunk).map((f) => ({
      celdas: padCeldas(f.celdas || []),
      legacy_sheet_row: f.legacy_sheet_row ?? null,
    }));
    const { error } = await sb.from("inventario_filas").insert(slice);
    if (error) throw error;
    inserted += slice.length;
  }
  return { ok: true, inserted };
}

async function importVentasAppend(ventas: unknown[][]) {
  const sb = adminClient();
  const rows = ventas.map(ventaLineToRow);
  const chunk = 300;
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await sb.from("ventas_lineas").insert(rows.slice(i, i + chunk));
    if (error) throw error;
  }
  return { ok: true, inserted: rows.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  try {
    const body = await req.json();
    const auth = checkAuth(body);
    if (auth) return json(auth, 401);

    const action = body.action as string;
    if (action === "ping") return json({ ok: true, message: "admin-api Supabase OK" });

    if (action === "getVentas") return json(await getVentas());

    if (action === "registrarVentaRetail") {
      return json(await registrarVentaRetail(body));
    }
    if (action === "actualizarStock") {
      return json(await actualizarStock(body.filaSheet, body.stock));
    }
    if (action === "updateCells") {
      return json(await updateCells(body.updates || []));
    }
    if (action === "appendRow") {
      return json(await appendRow(body.celdas || []));
    }
    if (action === "deleteRows") {
      return json(await deleteRows(body.filas || []));
    }
    if (action === "importInventarioReplace") {
      return json(await importInventarioReplace(body.filas || []));
    }
    if (action === "importVentasReplace") {
      return json(await importVentasReplace(body.ventas || []));
    }
    if (action === "importInventarioAppend") {
      return json(await importInventarioAppend(body.filas || []));
    }
    if (action === "importVentasAppend") {
      return json(await importVentasAppend(body.ventas || []));
    }

    return json({ ok: false, error: "Acción desconocida" }, 400);
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});
