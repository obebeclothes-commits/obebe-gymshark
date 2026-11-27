/**
 * Despliegue (CLI Supabase):
 *   supabase link --project-ref yueajorzawaanubgekpm
 *   supabase functions deploy admin-api --no-verify-jwt
 *
 * Auth: JWT de Supabase Auth + fila activa en public.admin_profiles.
 * verify_jwt=false en el gateway porque getCotizadorConfig es público;
 * las demás acciones validan el JWT dentro de esta función.
 * NUNCA hardcodear secretos ni contraseñas aquí.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const NUM_COLUMNAS = 29;
const COL_STOCK = 3;
const IDX_INV_NOMBRE = 1;
const IDX_INV_STOCK = 2;
const IDX_INV_TALLA = 3;
const IDX_INV_COLOR = 4;

type AdminRole = "admin" | "mayoreo_cliente";

type AdminProfile = {
  user_id: string;
  email: string;
  display_name: string;
  role: AdminRole;
  cliente_mayoreo: string;
  active: boolean;
};

type AuthOk = {
  userId: string;
  email: string;
  profile: AdminProfile;
};

function norm(s: unknown) {
  return String(s ?? "").trim().toLowerCase();
}

function allowedOrigins(): string[] {
  const fromEnv = String(Deno.env.get("SITE_URL") || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const defaults = ["https://obebe.store", "https://www.obebe.store"];
  return Array.from(new Set([...defaults, ...fromEnv]));
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allow = allowedOrigins();
  const ok = allow.includes(origin) ? origin : allow[0];
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function padCeldas(arr: unknown[]): string[] {
  const out: string[] = [];
  for (let c = 0; c < NUM_COLUMNAS; c++) {
    out.push(c < arr.length ? String(arr[c] ?? "") : "");
  }
  return out;
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

function extractBearer(req: Request): string | null {
  const h = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1].trim() : "";
  if (!token) return null;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (anon && token === anon) return null;
  return token;
}

async function requireAuth(
  req: Request,
  roles: AdminRole[] = ["admin", "mayoreo_cliente"],
): Promise<AuthOk | { ok: false; error: string; status: number }> {
  const jwt = extractBearer(req);
  if (!jwt) {
    return { ok: false, error: "No autorizado: falta sesión", status: 401 };
  }
  const sb = adminClient();
  const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return { ok: false, error: "No autorizado: sesión inválida", status: 401 };
  }
  const user = userData.user;
  const { data: profile, error: profErr } = await sb
    .from("admin_profiles")
    .select("user_id, email, display_name, role, cliente_mayoreo, active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) throw profErr;
  if (!profile || profile.active !== true) {
    return { ok: false, error: "No autorizado: sin perfil administrativo", status: 403 };
  }
  const role = profile.role as AdminRole;
  if (!roles.includes(role)) {
    return { ok: false, error: "No autorizado: rol insuficiente", status: 403 };
  }
  return {
    userId: user.id,
    email: user.email || profile.email,
    profile: profile as AdminProfile,
  };
}

function profileToSessionUser(profile: AdminProfile) {
  return {
    usuario: profile.display_name,
    nombre: profile.display_name,
    rol: profile.role === "admin" ? "Administrador" : "Mayoreo",
    acceso: profile.role === "admin" ? "admin" : "mayoreo_cliente",
    clienteMayoreo: profile.cliente_mayoreo || "",
    email: profile.email,
  };
}

async function getMe(auth: AuthOk) {
  return { ok: true, user: profileToSessionUser(auth.profile) };
}

async function getInventario() {
  const sb = adminClient();
  const { data, error } = await sb
    .from("inventario_filas")
    .select("id, celdas, legacy_sheet_row")
    .order("id", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return { ok: true, rows: data || [] };
}

/** Acciones permitidas para mayoreo_cliente (el resto exige admin). */
const MAYOREO_ACTIONS = new Set([
  "ping",
  "getMe",
  "getInventario",
  "getAdminModuloBlob",
  "setAdminModuloBlob",
]);

function actionAllowedForRole(action: string, role: AdminRole): boolean {
  if (role === "admin") return true;
  return MAYOREO_ACTIONS.has(action);
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

function gastoFieldsToRow(p: Record<string, unknown>) {
  const fechaRaw = String(p.fechaRaw ?? "");
  const cantidad = Math.abs(parseNum(p.cantidad));
  return {
    fecha_raw: fechaRaw,
    fecha_iso: parseFechaIso(fechaRaw),
    concepto: String(p.concepto ?? "").trim(),
    cantidad,
    pagado_por: String(p.pagado_por ?? p.pagadoPor ?? "").trim(),
  };
}

function gastoDbToApi(v: Record<string, unknown>) {
  return {
    fechaIso: (v.fecha_iso as string) || "",
    fechaRaw: (v.fecha_raw as string) || "",
    concepto: (v.concepto as string) || "",
    cantidad: Number(v.cantidad) || 0,
    pagadoPor: (v.pagado_por as string) || "",
    id: v.id,
  };
}

async function getGastos() {
  const sb = adminClient();
  const { data, error } = await sb
    .from("gastos_operativos")
    .select("*")
    .order("fecha_iso", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return { ok: true, gastos: (data || []).map((g) => gastoDbToApi(g)) };
}

async function createGasto(body: Record<string, unknown>) {
  const gasto = (body.gasto || {}) as Record<string, unknown>;
  const sb = adminClient();
  const row = gastoFieldsToRow(gasto);
  if (!row.concepto) return { ok: false, error: "Indica un concepto." };
  if (row.cantidad <= 0) return { ok: false, error: "La cantidad debe ser mayor a 0." };
  const { data, error } = await sb.from("gastos_operativos").insert(row).select("*").single();
  if (error) throw error;
  return { ok: true, gasto: gastoDbToApi(data) };
}

async function updateGasto(body: Record<string, unknown>) {
  const gastoId = parseInt(String(body.gastoId), 10);
  const gasto = (body.gasto || {}) as Record<string, unknown>;
  if (!gastoId) return { ok: false, error: "gastoId inválido." };
  const sb = adminClient();
  const row = gastoFieldsToRow(gasto);
  if (!row.concepto) return { ok: false, error: "Indica un concepto." };
  if (row.cantidad <= 0) return { ok: false, error: "La cantidad debe ser mayor a 0." };
  const { data, error } = await sb
    .from("gastos_operativos")
    .update(row)
    .eq("id", gastoId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, error: "Gasto no encontrado." };
  return { ok: true, gasto: gastoDbToApi(data) };
}

async function deleteGasto(body: Record<string, unknown>) {
  const gastoId = parseInt(String(body.gastoId), 10);
  if (!gastoId) return { ok: false, error: "gastoId inválido." };
  const sb = adminClient();
  const { error } = await sb.from("gastos_operativos").delete().eq("id", gastoId);
  if (error) throw error;
  return { ok: true, deleted: 1 };
}

/** Quita de ventas_lineas las filas con precio negativo (gastos mal registrados) y las copia a gastos_operativos. */
async function limpiarVentasNegativasMigrarGastos() {
  const sb = adminClient();
  const { data: neg, error } = await sb.from("ventas_lineas").select("*").lt("precio", 0);
  if (error) throw error;
  const rows = neg || [];
  if (!rows.length) return { ok: true, migrados: 0, eliminados: 0 };
  for (const v of rows) {
    const concepto = String(v.nombre || v.tipo || "Gasto operativo").trim() || "Gasto operativo";
    const cantidad = Math.abs(Number(v.precio) || 0);
    const pagado = String(v.cuenta || v.vendedor || v.cliente || "").trim();
    const ins = {
      fecha_raw: v.fecha_raw,
      fecha_iso: v.fecha_iso,
      concepto,
      cantidad,
      pagado_por: pagado || "—",
    };
    const { error: eG } = await sb.from("gastos_operativos").insert(ins);
    if (eG) throw eG;
  }
  const ids = rows.map((v) => v.id);
  const { error: eD } = await sb.from("ventas_lineas").delete().in("id", ids);
  if (eD) throw eD;
  return { ok: true, migrados: rows.length, eliminados: rows.length };
}

function parseNum(val: unknown): number {
  let t = String(val ?? "").trim();
  if (!t) return 0;
  t = t.replace(/\$/g, "").replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d{1,2}$/.test(t)) {
    t = t.replace(",", ".");
  } else {
    t = t.replace(/,/g, "");
  }
  t = t.replace(/[^\d.-]/g, "");
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}

function ventaLineToRow(v: unknown[]) {
  const a = v as string[];
  return ventaFieldsToRow({
    fechaRaw: a[0] ?? "",
    nombre: a[1] ?? "",
    tipo: a[2] ?? "",
    precio: a[3],
    talla: a[4] ?? "",
    color: a[5] ?? "",
    segmento: a[6] ?? "",
    cliente: a[7] ?? "",
    vendedor: a[8] ?? "",
    cuenta: a[9] ?? "",
    redSocial: a[10] ?? "",
    link: a[11] ?? "",
    telefono: a[12] ?? "",
  });
}

function ventaFieldsToRow(p: Record<string, unknown>) {
  const fechaRaw = String(p.fechaRaw ?? "");
  return {
    fecha_raw: fechaRaw,
    fecha_iso: parseFechaIso(fechaRaw),
    nombre: String(p.nombre ?? ""),
    tipo: String(p.tipo ?? ""),
    precio: parseNum(p.precio),
    talla: String(p.talla ?? ""),
    color: String(p.color ?? ""),
    segmento: String(p.segmento ?? ""),
    cliente: String(p.cliente ?? ""),
    vendedor: String(p.vendedor ?? ""),
    cuenta: String(p.cuenta ?? ""),
    red_social: String(p.redSocial ?? ""),
    link: String(p.link ?? ""),
    telefono: String(p.telefono ?? ""),
  };
}

function ventaDbToApi(v: Record<string, unknown>) {
  return {
    fechaIso: (v.fecha_iso as string) || "",
    fechaRaw: (v.fecha_raw as string) || "",
    nombre: (v.nombre as string) || "",
    tipo: (v.tipo as string) || "",
    precio: Number(v.precio) || 0,
    talla: (v.talla as string) || "",
    color: (v.color as string) || "",
    segmento: (v.segmento as string) || "",
    cliente: (v.cliente as string) || "",
    vendedor: (v.vendedor as string) || "",
    cuenta: (v.cuenta as string) || "",
    redSocial: (v.red_social as string) || "",
    link: (v.link as string) || "",
    telefono: (v.telefono as string) || "",
    filaSheet: v.id,
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

async function buscarInventarioPorVenta(
  sb: ReturnType<typeof createClient>,
  nombre: string,
  talla: string,
  color: string,
) {
  const nn = norm(nombre);
  if (!nn) return null;
  const { data, error } = await sb.from("inventario_filas").select("id, celdas").limit(5000);
  if (error) throw error;
  const nt = norm(talla);
  const nc = norm(color);
  for (const row of data || []) {
    const c = padCeldas((row.celdas as unknown[]) || []);
    if (norm(c[IDX_INV_NOMBRE]) !== nn) continue;
    if (nt && norm(c[IDX_INV_TALLA]) !== nt) continue;
    if (nc && norm(c[IDX_INV_COLOR]) !== nc) continue;
    return { id: row.id as number, celdas: c };
  }
  return null;
}

type AjusteStockOpts = {
  inventarioFilaId: number;
  delta?: number | null;
  stockAbsoluto?: number | null;
  tipo: string;
  referencia?: string;
  usuario?: string;
  userId?: string | null;
  idempotencyKey?: string | null;
  allowNegative?: boolean;
};

/** Ajuste atómico vía RPC PostgreSQL (FOR UPDATE + bitácora + idempotencia). */
async function rpcAjustarStock(opts: AjusteStockOpts) {
  const sb = adminClient();
  const { data, error } = await sb.rpc("ajustar_inventario_stock", {
    p_inventario_fila_id: opts.inventarioFilaId,
    p_delta: opts.delta == null ? null : opts.delta,
    p_stock_absoluto: opts.stockAbsoluto == null ? null : opts.stockAbsoluto,
    p_tipo_movimiento: opts.tipo,
    p_referencia: opts.referencia || "",
    p_usuario: opts.usuario || "",
    p_user_id: opts.userId || null,
    p_idempotency_key: opts.idempotencyKey || null,
    p_allow_negative: !!opts.allowNegative,
  });
  if (error) throw error;
  const out = (data || {}) as Record<string, unknown>;
  if (out.ok === false) {
    return {
      ok: false as const,
      error: String(out.error || "No se pudo ajustar stock"),
      stock: out.stock,
      stock_anterior: out.stock_anterior,
      disponible: out.disponible,
    };
  }
  return {
    ok: true as const,
    stock: Number(out.stock) || 0,
    stockAntes: Number(out.stock_anterior) || 0,
    delta: Number(out.delta) || 0,
    row: opts.inventarioFilaId,
    inventarioDbId: opts.inventarioFilaId,
    idempotent: !!out.idempotent,
    movimientoId: out.movimiento_id,
  };
}

/** @deprecated Usar rpcAjustarStock. Se mantiene solo como nombre interno claro. */
async function aplicarDeltaStockInventario(
  invId: number,
  delta: number,
  meta: {
    tipo: string;
    referencia?: string;
    usuario?: string;
    userId?: string | null;
    idempotencyKey?: string | null;
  },
) {
  return rpcAjustarStock({
    inventarioFilaId: invId,
    delta,
    tipo: meta.tipo,
    referencia: meta.referencia,
    usuario: meta.usuario,
    userId: meta.userId,
    idempotencyKey: meta.idempotencyKey,
  });
}

function parseStockMetaDesdeLink(link: unknown): { inventarioId: number; delta: number } | null {
  const m = String(link || "").match(/\[\[stock:(\d+):(-?\d+)\]\]/);
  if (!m) return null;
  const inventarioId = parseInt(m[1], 10);
  const delta = parseInt(m[2], 10);
  if (!inventarioId || isNaN(inventarioId) || isNaN(delta) || !delta) return null;
  return { inventarioId, delta };
}

async function ajustarStockPorLineaVenta(
  linea: { nombre?: string; talla?: string; color?: string; link?: string; id?: number },
  sentido: number,
  auth?: AuthOk | null,
) {
  // Solo devolver/descontar si la venta registró meta [[stock:id:delta]].
  const meta = parseStockMetaDesdeLink(linea.link);
  if (!meta) {
    return { ok: false, matched: false, skipped: true, reason: "sin_meta_stock" };
  }
  const invId = meta.inventarioId;
  const aplicar = sentido > 0 ? -meta.delta : meta.delta;
  const tipo = aplicar < 0 ? "venta_showroom" : "devolucion";
  const r = await aplicarDeltaStockInventario(invId, aplicar, {
    tipo,
    referencia: linea.id ? `venta_linea:${linea.id}` : `venta_meta:${invId}:${aplicar}`,
    usuario: auth?.profile.display_name || auth?.email || "",
    userId: auth?.userId || null,
    idempotencyKey: linea.id
      ? `venta_linea:${linea.id}:${sentido > 0 ? "dev" : "out"}`
      : null,
  });
  return {
    ok: r.ok,
    matched: true,
    stock: r.ok ? r.stock : undefined,
    row: invId,
    error: r.ok ? undefined : r.error,
  };
}

async function updateVentaLine(body: Record<string, unknown>) {
  const ventaId = parseInt(String(body.ventaId), 10);
  const venta = (body.venta || {}) as Record<string, unknown>;
  if (!ventaId) return { ok: false, error: "ventaId inválido." };
  const sb = adminClient();
  const row = ventaFieldsToRow(venta);
  const { data, error } = await sb
    .from("ventas_lineas")
    .update(row)
    .eq("id", ventaId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, error: "Venta no encontrada." };
  return { ok: true, venta: ventaDbToApi(data) };
}

async function deleteVentaLine(body: Record<string, unknown>, auth?: AuthOk | null) {
  const ventaId = parseInt(String(body.ventaId), 10);
  if (!ventaId) return { ok: false, error: "ventaId inválido." };
  const ajustarStock = body.ajustarStock !== false;
  const sb = adminClient();
  const { data: prev, error: e0 } = await sb
    .from("ventas_lineas")
    .select("*")
    .eq("id", ventaId)
    .maybeSingle();
  if (e0) throw e0;
  if (!prev) return { ok: false, error: "Venta no encontrada." };
  const { error: e1 } = await sb.from("ventas_lineas").delete().eq("id", ventaId);
  if (e1) throw e1;
  let stockInfo: Record<string, unknown> | null = null;
  if (ajustarStock) {
    stockInfo = await ajustarStockPorLineaVenta(
      { ...prev, id: ventaId },
      1,
      auth,
    );
  }
  return { ok: true, deleted: 1, stock: stockInfo };
}

async function createVentaLine(body: Record<string, unknown>, auth?: AuthOk | null) {
  const venta = (body.venta || {}) as Record<string, unknown>;
  const ajustarStock = body.ajustarStock !== false;
  const sb = adminClient();
  const row = ventaFieldsToRow(venta);
  const { data, error } = await sb.from("ventas_lineas").insert(row).select("*").single();
  if (error) throw error;
  let stockInfo: Record<string, unknown> | null = null;
  if (ajustarStock) {
    stockInfo = await ajustarStockPorLineaVenta(
      { ...row, id: data.id as number },
      -1,
      auth,
    );
  }
  return { ok: true, venta: ventaDbToApi(data), stock: stockInfo };
}

async function resolverInventarioId(
  inventarioDbId?: number,
  rowRef?: number,
): Promise<number | null> {
  const dbHint = parseInt(String(inventarioDbId ?? ""), 10);
  if (dbHint && !isNaN(dbHint)) {
    const sb = adminClient();
    const { data, error } = await sb
      .from("inventario_filas")
      .select("id")
      .eq("id", dbHint)
      .maybeSingle();
    if (error) throw error;
    if (data) return data.id as number;
  }
  const ref = parseInt(String(rowRef ?? ""), 10);
  if (ref && !isNaN(ref)) {
    const fila = await inventarioFilaPorRef(ref);
    if (fila) return fila.id as number;
  }
  return null;
}

async function registrarVentaRetail(body: Record<string, unknown>, auth?: AuthOk | null) {
  const ventas = (body.ventas || []) as unknown[][];
  const stockUpdates = (body.stockUpdates || []) as {
    row?: number;
    stock?: number;
    delta?: number;
    inventarioDbId?: number;
  }[];
  const saleKey = String(body.idempotencyKey || "").trim() ||
    `retail:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  if (!ventas.length) return { ok: false, error: "Sin líneas de venta." };

  const sb = adminClient();
  const aplicados: {
    row: number;
    inventarioDbId: number;
    stock: number;
    stockAntes: number;
    delta: number;
  }[] = [];
  const usuario = auth?.profile.display_name || auth?.email || "";

  // Primero stock atómico por delta (si falla, no se registran ventas).
  for (const u of stockUpdates) {
    const dbId = await resolverInventarioId(u.inventarioDbId, u.row);
    if (!dbId) {
      return {
        ok: false,
        error:
          "No se pudo ubicar el artículo en inventario para bajar stock (falta inventarioDbId).",
      };
    }
    let delta = u.delta != null ? parseInt(String(u.delta), 10) : NaN;
    if (isNaN(delta) && u.stock != null) {
      // Compat: absoluto → el RPC calcula el delta con bloqueo.
      const abs = parseInt(String(u.stock), 10);
      if (isNaN(abs) || abs < 0) {
        return { ok: false, error: "Stock inválido en actualización de inventario." };
      }
      const rAbs = await rpcAjustarStock({
        inventarioFilaId: dbId,
        stockAbsoluto: abs,
        tipo: "venta_showroom",
        referencia: saleKey,
        usuario,
        userId: auth?.userId || null,
        idempotencyKey: `${saleKey}:inv:${dbId}`,
      });
      if (!rAbs.ok) {
        for (const a of aplicados.slice().reverse()) {
          await rpcAjustarStock({
            inventarioFilaId: a.inventarioDbId,
            delta: -a.delta,
            tipo: "ajuste_manual",
            referencia: `${saleKey}:rollback`,
            usuario,
            userId: auth?.userId || null,
            idempotencyKey: `${saleKey}:rollback:${a.inventarioDbId}`,
          });
        }
        return { ok: false, error: rAbs.error || "Stock insuficiente." };
      }
      aplicados.push({
        row: dbId,
        inventarioDbId: dbId,
        stock: rAbs.stock,
        stockAntes: rAbs.stockAntes,
        delta: rAbs.delta,
      });
      continue;
    }
    if (isNaN(delta) || delta === 0) {
      return { ok: false, error: "Delta de stock inválido." };
    }
    const r = await rpcAjustarStock({
      inventarioFilaId: dbId,
      delta,
      tipo: "venta_showroom",
      referencia: saleKey,
      usuario,
      userId: auth?.userId || null,
      idempotencyKey: `${saleKey}:inv:${dbId}`,
    });
    if (!r.ok) {
      for (const a of aplicados.slice().reverse()) {
        await rpcAjustarStock({
          inventarioFilaId: a.inventarioDbId,
          delta: -a.delta,
          tipo: "ajuste_manual",
          referencia: `${saleKey}:rollback`,
          usuario,
          userId: auth?.userId || null,
          idempotencyKey: `${saleKey}:rollback:${a.inventarioDbId}`,
        });
      }
      return { ok: false, error: r.error || "Stock insuficiente." };
    }
    aplicados.push({
      row: dbId,
      inventarioDbId: dbId,
      stock: r.stock,
      stockAntes: r.stockAntes,
      delta: r.delta,
    });
  }

  const rows = ventas.map(ventaLineToRow);
  const { error: eV } = await sb.from("ventas_lineas").insert(rows);
  if (eV) {
    for (const a of aplicados.slice().reverse()) {
      await rpcAjustarStock({
        inventarioFilaId: a.inventarioDbId,
        delta: -a.delta,
        tipo: "ajuste_manual",
        referencia: `${saleKey}:rollback`,
        usuario,
        userId: auth?.userId || null,
        idempotencyKey: `${saleKey}:rollback:${a.inventarioDbId}`,
      });
    }
    throw eV;
  }

  return {
    ok: true,
    ventas: ventas.length,
    stockUpdates: aplicados.length,
    stockAplicados: aplicados,
    apiVersion: 6,
  };
}

async function inventarioFilaPorRef(rowRef: number) {
  const ref = parseInt(String(rowRef), 10);
  if (!ref || isNaN(ref)) return null;
  const sb = adminClient();
  // Preferir legacy_sheet_row: el id numérico de Postgres a menudo coincide
  // con otra fila distinta y actualizaba el artículo equivocado.
  const { data: byLegacy, error: e2 } = await sb
    .from("inventario_filas")
    .select("id, celdas")
    .eq("legacy_sheet_row", ref)
    .maybeSingle();
  if (!e2 && byLegacy) return byLegacy;
  const { data: byId, error: e1 } = await sb
    .from("inventario_filas")
    .select("id, celdas")
    .eq("id", ref)
    .maybeSingle();
  if (e1 || !byId) return null;
  return byId;
}

async function actualizarStock(
  body: Record<string, unknown>,
  auth?: AuthOk | null,
) {
  const ref = parseInt(String(body.filaSheet ?? ""), 10);
  const dbIdHint = parseInt(String(body.inventarioDbId ?? ""), 10);
  const deltaRaw = body.delta;
  const stockRaw = body.stock;
  const hasDelta = deltaRaw != null && String(deltaRaw) !== "";
  const hasStock = stockRaw != null && String(stockRaw) !== "";

  const dbId = await resolverInventarioId(dbIdHint, ref);
  if (!dbId) return { ok: false, error: "Fila no encontrada." };

  const tipo = String(body.tipoMovimiento || "ajuste_manual");
  const referencia = String(body.referencia || "").trim();
  const idem = String(body.idempotencyKey || "").trim() || null;
  const usuario = auth?.profile.display_name || auth?.email || "";

  if (hasDelta) {
    const delta = parseInt(String(deltaRaw), 10);
    if (isNaN(delta) || delta === 0) {
      return { ok: false, error: "Delta de stock inválido." };
    }
    const r = await rpcAjustarStock({
      inventarioFilaId: dbId,
      delta,
      tipo: tipo || "ajuste_manual",
      referencia,
      usuario,
      userId: auth?.userId || null,
      idempotencyKey: idem,
    });
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, row: ref || dbId, stock: r.stock, delta: r.delta, inventarioDbId: dbId };
  }

  if (!hasStock) return { ok: false, error: "Fila o stock inválido." };
  const n = parseInt(String(stockRaw), 10);
  if (isNaN(n) || n < 0) return { ok: false, error: "Fila o stock inválido." };

  // Absoluto: el RPC calcula el delta con bloqueo (seguro ante concurrencia).
  const r = await rpcAjustarStock({
    inventarioFilaId: dbId,
    stockAbsoluto: n,
    tipo: tipo || "ajuste_manual",
    referencia,
    usuario,
    userId: auth?.userId || null,
    idempotencyKey: idem,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, row: ref || dbId, stock: r.stock, delta: r.delta, inventarioDbId: dbId };
}

async function updateCells(
  updates: { row: number; col: number; value: string }[],
  auth?: AuthOk | null,
) {
  const sb = adminClient();
  let n = 0;
  const usuario = auth?.profile.display_name || auth?.email || "";
  for (const u of updates) {
    const rowRef = parseInt(String(u.row), 10);
    const col = parseInt(String(u.col), 10);
    if (!rowRef || col < 1 || col > NUM_COLUMNAS) continue;
    const fila = await inventarioFilaPorRef(rowRef);
    if (!fila) continue;
    const dbId = fila.id as number;

    // Columna C (stock): siempre por RPC atómico.
    if (col === COL_STOCK) {
      const abs = parseInt(String(u.value ?? "0"), 10);
      if (isNaN(abs) || abs < 0) continue;
      const r = await rpcAjustarStock({
        inventarioFilaId: dbId,
        stockAbsoluto: abs,
        tipo: "ajuste_manual",
        referencia: "updateCells",
        usuario,
        userId: auth?.userId || null,
      });
      if (r.ok) n++;
      continue;
    }

    const celdas = padCeldas((fila.celdas as unknown[]) || []);
    celdas[col - 1] = u.value == null ? "" : String(u.value);
    const { error } = await sb
      .from("inventario_filas")
      .update({ celdas, updated_at: new Date().toISOString() })
      .eq("id", dbId);
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
  const refs = filas.map((r) => parseInt(String(r), 10)).filter((r) => r > 0);
  if (!refs.length) return { ok: true, deleted: 0 };

  const dbIds = new Set<number>();
  for (const ref of refs) {
    const { data: byId, error: e1 } = await sb
      .from("inventario_filas")
      .select("id")
      .eq("id", ref)
      .maybeSingle();
    if (e1) throw e1;
    if (byId?.id) {
      dbIds.add(byId.id as number);
      continue;
    }
    const { data: byLegacy, error: e2 } = await sb
      .from("inventario_filas")
      .select("id")
      .eq("legacy_sheet_row", ref)
      .maybeSingle();
    if (e2) throw e2;
    if (byLegacy?.id) dbIds.add(byLegacy.id as number);
  }

  const ids = Array.from(dbIds);
  if (!ids.length) {
    return { ok: false, error: "No se encontraron filas en inventario para borrar." };
  }
  const { error } = await sb.from("inventario_filas").delete().in("id", ids);
  if (error) throw error;
  return { ok: true, deleted: ids.length };
}

async function vaciarTabla(nombre: "inventario_filas" | "ventas_lineas") {
  const sb = adminClient();
  for (let n = 0; n < 80; n++) {
    const { data, error } = await sb.from(nombre).select("id").limit(400);
    if (error) throw error;
    if (!data?.length) break;
    const ids = data.map((r) => r.id);
    const { error: e2 } = await sb.from(nombre).delete().in("id", ids);
    if (e2) throw e2;
  }
}

async function importInventarioReplace(filas: { celdas: unknown[] }[]) {
  const sb = adminClient();
  await vaciarTabla("inventario_filas");
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
  await vaciarTabla("ventas_lineas");
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

const SPREADSHEET_ID = "195xshQr985FH1FI4xzBhQrvrBEayAE5_manTNrfH-ko";
const GID_INVENTARIO = 0;
const GID_VENTAS = 915963655;
const FILA_DATOS_INICIO = 2;
const FILA_ENCABEZADOS_VENTAS = 1;

function resolverIndicesVentas(grid: string[][]) {
  const idx = {
    fecha: 1,
    nombre: 2,
    tipo: 3,
    precio: 4,
    talla: 5,
    color: 6,
    segmento: 7,
    cliente: 8,
    vendedor: 9,
    cuenta: 10,
    redSocial: 11,
    link: 12,
    telefono: 13,
  };
  const hdr = grid[FILA_ENCABEZADOS_VENTAS] || [];
  for (let c = 0; c < hdr.length; c++) {
    const t = String(hdr[c] || "").trim().toUpperCase();
    if (t === "FECHA") idx.fecha = c;
    else if (t === "ARTICULO" || t === "ARTÍCULO" || t === "NOMBRE") idx.nombre = c;
    else if (t === "TIPO") idx.tipo = c;
    else if (t === "PRECIO") idx.precio = c;
    else if (t === "TALLA") idx.talla = c;
    else if (t === "COLOR") idx.color = c;
    else if (t.indexOf("HOMBRE") >= 0 && t.indexOf("MUJER") >= 0) idx.segmento = c;
    else if (t === "CLIENTE" || t.indexOf("CLIENTE") >= 0) idx.cliente = c;
    else if (t.indexOf("VEND") >= 0) idx.vendedor = c;
    else if (t.indexOf("CUENTA") >= 0) idx.cuenta = c;
    else if (t.indexOf("RED") >= 0 && t.indexOf("SOCIAL") >= 0) idx.redSocial = c;
    else if (t === "LINK" || t.indexOf("LINK") >= 0 || t.indexOf("PERFIL") >= 0) idx.link = c;
    else if (
      t.indexOf("TEL") >= 0 || t.indexOf("WHATS") >= 0 || t.indexOf("CEL") >= 0 ||
      t.indexOf("NÚMERO") >= 0 || t.indexOf("NUMERO") >= 0
    ) idx.telefono = c;
  }
  return idx;
}

function celdaVentas(f: string[], col: number) {
  return col < f.length ? f[col] : "";
}

function parseCSV(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    const sig = texto[i + 1];
    if (c === '"') {
      if (enComillas && sig === '"') {
        celda += '"';
        i++;
      } else enComillas = !enComillas;
    } else if ((c === "," || c === "\n" || c === "\r") && !enComillas) {
      if (c === "\r" && sig === "\n") i++;
      fila.push(celda);
      celda = "";
      if (c === "\n" || c === "\r") {
        if (fila.length > 1 || (fila[0] && fila[0].trim())) filas.push(fila);
        fila = [];
      }
    } else celda += c;
  }
  if (celda.length || fila.length) {
    fila.push(celda);
    if (fila.length > 1 || (fila[0] && fila[0].trim())) filas.push(fila);
  }
  return filas;
}

function filaInventarioVacia(celdas: string[]) {
  for (const v of celdas) {
    if (String(v || "").trim()) return false;
  }
  return true;
}

async function fetchCsvHoja(gid: number, etiqueta: string) {
  const url =
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}&_=` +
    Date.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${etiqueta}: HTTP ${res.status} al descargar Sheet`);
  const text = await res.text();
  if (!text || text.length < 30) {
    throw new Error(
      `${etiqueta}: CSV vacío. El libro debe ser visible con enlace (cualquiera con el enlace).`,
    );
  }
  if (text.toLowerCase().includes("<!doctype") || text.toLowerCase().includes("<html")) {
    throw new Error(`${etiqueta}: Google devolvió HTML en lugar de CSV (permisos del Sheet).`);
  }
  return text;
}

async function importInventarioPayloadEnChunks(
  payload: { celdas: unknown[]; legacy_sheet_row?: number }[],
) {
  const CHUNK = 60;
  if (!payload.length) return 0;
  await importInventarioReplace(payload.slice(0, CHUNK));
  let i = CHUNK;
  while (i < payload.length) {
    await importInventarioAppend(payload.slice(i, i + CHUNK));
    i += CHUNK;
  }
  return payload.length;
}

async function importVentasLinesEnChunks(ventasLines: unknown[][]) {
  const CHUNK = 200;
  if (!ventasLines.length) return 0;
  await importVentasReplace(ventasLines.slice(0, CHUNK));
  let i = CHUNK;
  while (i < ventasLines.length) {
    await importVentasAppend(ventasLines.slice(i, i + CHUNK));
    i += CHUNK;
  }
  return ventasLines.length;
}

async function importFromGoogleRetail() {
  const invText = await fetchCsvHoja(GID_INVENTARIO, "INVENTARIO");
  const grid = parseCSV(invText);
  const invPayload: { celdas: unknown[]; legacy_sheet_row: number }[] = [];
  for (let i = FILA_DATOS_INICIO; i < grid.length; i++) {
    const celdas = padCeldas(grid[i] || []);
    const nombre = (celdas[1] || "").trim();
    if (nombre.toUpperCase() === "NOMBRE") continue;
    if (filaInventarioVacia(celdas)) continue;
    if (!nombre && !(celdas[0] || "").trim()) continue;
    invPayload.push({ celdas, legacy_sheet_row: i + 1 });
  }
  if (!invPayload.length) {
    throw new Error("INVENTARIO: no se encontraron filas de datos en el CSV.");
  }

  const ventasLines = await parseVentasDesdeCsvGoogle();

  const nInv = await importInventarioPayloadEnChunks(invPayload);
  const nVent = await importVentasLinesEnChunks(ventasLines);
  return { ok: true, inventario: nInv, ventas: nVent };
}

async function parseVentasDesdeCsvGoogle() {
  const ventText = await fetchCsvHoja(GID_VENTAS, "VENTAS");
  const vGrid = parseCSV(ventText);
  const idx = resolverIndicesVentas(vGrid);
  const ventasLines: unknown[][] = [];
  for (let i = FILA_DATOS_INICIO; i < vGrid.length; i++) {
    const f = vGrid[i] || [];
    const nombre = String(celdaVentas(f, idx.nombre) || "").trim();
    const fechaRaw = String(celdaVentas(f, idx.fecha) || "").trim();
    if (!nombre && !fechaRaw) continue;
    if (nombre.toUpperCase() === "ARTICULO" || nombre.toUpperCase() === "ARTÍCULO") continue;
    const precio = parseNum(celdaVentas(f, idx.precio));
    if (!nombre && precio <= 0) continue;
    ventasLines.push([
      fechaRaw,
      nombre,
      String(celdaVentas(f, idx.tipo) || "").trim(),
      String(precio),
      String(celdaVentas(f, idx.talla) || "").trim(),
      String(celdaVentas(f, idx.color) || "").trim(),
      String(celdaVentas(f, idx.segmento) || "").trim(),
      String(celdaVentas(f, idx.cliente) || "").trim(),
      String(celdaVentas(f, idx.vendedor) || "").trim(),
      String(celdaVentas(f, idx.cuenta) || "").trim(),
      String(celdaVentas(f, idx.redSocial) || "").trim(),
      String(celdaVentas(f, idx.link) || "").trim(),
      String(celdaVentas(f, idx.telefono) || "").trim(),
    ]);
  }
  return ventasLines;
}

/** Solo VENTAS (no toca inventario_filas). */
async function importVentasFromGoogle() {
  const ventasLines = await parseVentasDesdeCsvGoogle();
  const nVent = await importVentasLinesEnChunks(ventasLines);
  return { ok: true, ventas: nVent };
}

async function getDbStats() {
  const sb = adminClient();
  const inv = await sb.from("inventario_filas").select("id", { count: "exact", head: true });
  const ven = await sb.from("ventas_lineas").select("id", { count: "exact", head: true });
  if (inv.error) throw inv.error;
  if (ven.error) throw ven.error;
  return {
    ok: true,
    inventarioFilas: inv.count ?? 0,
    ventasLineas: ven.count ?? 0,
  };
}

const MODULO_BLOB_KEYS = new Set([
  "apartados",
  "entregas",
  "sucursales",
  "cotizador",
  "mayoreo_naty",
]);

const COTIZADOR_DEFAULTS = {
  factorUsd: 1.085,
  valorDolar: 18.9,
  envio: 40,
  margen: 0.3,
};

function cotizadorDesdePayload(payload: unknown) {
  const arr = Array.isArray(payload) ? payload : [];
  const hit = arr.find((x) => x && typeof x === "object" &&
    ((x as { id?: string }).id === "obebe-cotizador-config" ||
      (x as { factorUsd?: unknown }).factorUsd != null)) as Record<string, unknown> | undefined;
  const src = hit || {};
  let factorUsd = Number(src.factorUsd);
  let valorDolar = Number(src.valorDolar);
  let envio = Number(src.envio);
  let margen = Number(src.margen);
  if (!Number.isFinite(factorUsd) || factorUsd <= 0) factorUsd = COTIZADOR_DEFAULTS.factorUsd;
  if (!Number.isFinite(valorDolar) || valorDolar <= 0) valorDolar = COTIZADOR_DEFAULTS.valorDolar;
  if (!Number.isFinite(envio) || envio < 0) envio = COTIZADOR_DEFAULTS.envio;
  if (!Number.isFinite(margen) || margen <= 0) margen = COTIZADOR_DEFAULTS.margen;
  if (margen > 1) margen = 0.3;
  return {
    factorUsd,
    valorDolar,
    envio,
    margen,
    actualizadoEn: Number(src.actualizadoEn) || 0,
  };
}

async function getAdminModuloBlob(body: Record<string, unknown>) {
  const moduleKey = String(body.moduleKey ?? "").trim();
  if (!MODULO_BLOB_KEYS.has(moduleKey)) {
    return { ok: false, error: "moduleKey no permitido." };
  }
  const sb = adminClient();
  const { data, error } = await sb
    .from("admin_modulos_blob")
    .select("payload, updated_at")
    .eq("module_key", moduleKey)
    .maybeSingle();
  if (error) throw error;
  const payload = data?.payload;
  return {
    ok: true,
    payload: Array.isArray(payload) ? payload : [],
    updatedAt: data?.updated_at ?? null,
  };
}

async function setAdminModuloBlob(body: Record<string, unknown>) {
  const moduleKey = String(body.moduleKey ?? "").trim();
  if (!MODULO_BLOB_KEYS.has(moduleKey)) {
    return { ok: false, error: "moduleKey no permitido." };
  }
  const payload = body.payload;
  if (!Array.isArray(payload)) {
    return { ok: false, error: "payload debe ser un arreglo JSON." };
  }
  const sb = adminClient();
  const { error } = await sb.from("admin_modulos_blob").upsert(
    {
      module_key: moduleKey,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "module_key" },
  );
  if (error) throw error;
  return { ok: true };
}

/** Lectura pública del cotizador (sin secret admin). */
async function getCotizadorConfig() {
  const sb = adminClient();
  const { data, error } = await sb
    .from("admin_modulos_blob")
    .select("payload, updated_at")
    .eq("module_key", "cotizador")
    .maybeSingle();
  if (error) throw error;
  const cfg = cotizadorDesdePayload(data?.payload);
  return {
    ok: true,
    config: cfg,
    updatedAt: data?.updated_at ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  try {
    if (req.method !== "POST") {
      return json(req, { ok: false, error: "Método no permitido" }, 405);
    }

    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || "");

    // Público justificado: la tienda necesita la fórmula del cotizador.
    // Solo lectura; no inventarios, ventas ni secretos.
    if (action === "getCotizadorConfig") {
      return json(req, await getCotizadorConfig());
    }

    const auth = await requireAuth(req);
    if ("ok" in auth && auth.ok === false) {
      return json(req, { ok: false, error: auth.error }, auth.status);
    }
    const session = auth as AuthOk;

    if (!actionAllowedForRole(action, session.profile.role)) {
      return json(req, { ok: false, error: "No autorizado: rol insuficiente" }, 403);
    }

    // mayoreo_cliente: solo blob de mayoreo_naty
    if (
      session.profile.role === "mayoreo_cliente" &&
      (action === "getAdminModuloBlob" || action === "setAdminModuloBlob")
    ) {
      const key = String(body.moduleKey || body.module_key || "");
      if (key !== "mayoreo_naty") {
        return json(req, { ok: false, error: "No autorizado para este módulo" }, 403);
      }
    }

    if (action === "ping") {
      return json(req, {
        ok: true,
        message: "admin-api Supabase OK",
        apiVersion: 5,
        role: session.profile.role,
      });
    }
    if (action === "getMe") return json(req, await getMe(session));
    if (action === "getInventario") return json(req, await getInventario());

    if (action === "getVentas") return json(req, await getVentas());
    if (action === "getGastos") return json(req, await getGastos());
    if (action === "createGasto") return json(req, await createGasto(body));
    if (action === "updateGasto") return json(req, await updateGasto(body));
    if (action === "deleteGasto") return json(req, await deleteGasto(body));
    if (action === "limpiarVentasNegativasMigrarGastos") {
      return json(req, await limpiarVentasNegativasMigrarGastos());
    }
    if (action === "getDbStats") return json(req, await getDbStats());
    if (action === "getAdminModuloBlob") {
      return json(req, await getAdminModuloBlob(body));
    }
    if (action === "setAdminModuloBlob") {
      return json(req, await setAdminModuloBlob(body));
    }
    if (action === "importFromGoogleRetail") {
      return json(req, await importFromGoogleRetail());
    }
    if (action === "importVentasFromGoogle") {
      return json(req, await importVentasFromGoogle());
    }

    if (action === "registrarVentaRetail") {
      return json(req, await registrarVentaRetail(body, session));
    }
    if (action === "updateVentaLine") {
      return json(req, await updateVentaLine(body));
    }
    if (action === "deleteVentaLine") {
      return json(req, await deleteVentaLine(body, session));
    }
    if (action === "createVentaLine") {
      return json(req, await createVentaLine(body, session));
    }
    if (action === "actualizarStock") {
      return json(req, await actualizarStock(body, session));
    }
    if (action === "updateCells") {
      return json(req, await updateCells(body.updates || [], session));
    }
    if (action === "appendRow") {
      return json(req, await appendRow(body.celdas || []));
    }
    if (action === "deleteRows") {
      return json(req, await deleteRows(body.filas || []));
    }
    if (action === "importInventarioReplace") {
      return json(req, await importInventarioReplace(body.filas || []));
    }
    if (action === "importVentasReplace") {
      return json(req, await importVentasReplace(body.ventas || []));
    }
    if (action === "importInventarioAppend") {
      return json(req, await importInventarioAppend(body.filas || []));
    }
    if (action === "importVentasAppend") {
      return json(req, await importVentasAppend(body.ventas || []));
    }

    return json(req, { ok: false, error: "Acción desconocida" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin-api]", msg, err);
    return json(req, { ok: false, error: msg }, 500);
  }
});
