(function (global) {
    'use strict';

    var PACK_ID = 'obebe-mayoreo-pack-naty';
    var MODULE_KEY = 'mayoreo_naty';
    var KEY_LINEAS = 'obebe_mayoreo_lineas_v1';
    var KEY_VENTAS = 'obebe_mayoreo_ventas_v1';
    var KEY_PEDIDOS = 'obebe_mayoreo_pedidos_v1';
    var KEY_META = 'obebe_mayoreo_meta_v1';
    var KEY_META_COMPR = 'obebe_mayoreo_meta_compradores_naty';

    var pushTimer = null;
    var aplicandoRemoto = 0;
    var colaNubeMayoreo = Promise.resolve();

    function enColaNubeMayoreo(fn) {
        var ejecutar = colaNubeMayoreo.then(function () { return fn(); });
        colaNubeMayoreo = ejecutar.catch(function () { return null; });
        return ejecutar;
    }

    function canSync() {
        return !!(global.ObebeAdminModulosCloud && ObebeAdminModulosCloud.canSync &&
            ObebeAdminModulosCloud.canSync());
    }

    function leerJson(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    }

    function guardarJson(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            return false;
        }
    }

    function tsItem(item) {
        if (!item) return 0;
        return item.actualizadoEn || item.revisadoEn || item.creadoEn ||
            item.importadoEn || item.ventaRetailRegistradaEn || 0;
    }

    function cuentaItemsPedido(p) {
        return (p && p.items && p.items.length) ? p.items.length : 0;
    }

    var PEDIDO_NATY_2_ID = 'mp-naty-pedido-20261029';
    var PEDIDO_NATY_LEGACY_ID = 'mp-naty-pedido-20261017';
    var FECHA_PEDIDO_NATY_2 = '2026-10-29';

    function normClienteKey(s) {
        return String(s || '').trim().toLowerCase() || 'naty';
    }

    function unidadesPedidoPack(p) {
        if (!p) return 0;
        var u = parseInt(p.unidades, 10);
        if (!isNaN(u) && u > 0) return u;
        return (p.items || []).reduce(function (s, it) {
            return s + (it.cantidad || 1);
        }, 0);
    }

    function fechaPedidoIsoMs(ms) {
        var d = new Date(ms || 0);
        if (isNaN(d.getTime())) return '';
        var y = d.getFullYear();
        var m = d.getMonth() + 1;
        var day = d.getDate();
        return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    }

    /** Misma regla que en pedidos-store: un solo lote 29/10 en el pack de sync. */
    function pedidosSinDuplicadoNaty2910(pedidos) {
        pedidos = Array.isArray(pedidos) ? pedidos.slice() : [];
        var idxCanon = pedidos.findIndex(function (p) { return p.id === PEDIDO_NATY_2_ID; });
        var canon = idxCanon >= 0 ? pedidos[idxCanon] : null;
        var uCanon = unidadesPedidoPack(canon);
        if (!canon || uCanon < 1) return pedidos;
        return pedidos.filter(function (p) {
            if (p.id === PEDIDO_NATY_2_ID || p.id === PEDIDO_NATY_LEGACY_ID) return true;
            if (p.estado === 'combinado') return true;
            if (normClienteKey(p.clienteKey) !== 'naty') return true;
            if (fechaPedidoIsoMs(p.creadoEn) !== FECHA_PEDIDO_NATY_2) return true;
            var u = unidadesPedidoPack(p);
            return !(u >= 12 && u <= 25 && Math.abs(u - uCanon) <= 3);
        });
    }

    function tsPedidoMayoreo(p) {
        if (!p) return 0;
        var t = Math.max(
            Number(p.pedidoActualizadoEn || 0),
            Number(p.clienteEditadoEn || 0),
            Number(p.obebeEditadoEn || 0)
        );
        if (t > 0) return t;
        var leg = Math.max(Number(p.revisadoEn || 0), Number(p.creadoEn || 0));
        if (p.ventaRetailRegistradaEn) {
            leg = Math.max(leg, Number(p.ventaRetailRegistradaEn));
        }
        (p.items || []).forEach(function (it) {
            leg = Math.max(leg, Number(it.actualizadoEn || 0));
        });
        return leg;
    }

    function elegirPedidoMayoreo(prev, next) {
        if (!prev) return next;
        if (!next) return prev;
        /* Venta retail confirmada gana siempre sobre un borrador local más reciente. */
        if (next.ventaRetailRegistradaEn && !prev.ventaRetailRegistradaEn) return next;
        if (prev.ventaRetailRegistradaEn && !next.ventaRetailRegistradaEn) return prev;
        var tPrev = tsPedidoMayoreo(prev);
        var tNext = tsPedidoMayoreo(next);
        if (tNext > tPrev) return next;
        if (tPrev > tNext) return prev;
        var uNext = unidadesPedidoPack(next);
        var uPrev = unidadesPedidoPack(prev);
        if (uNext !== uPrev) return uNext > uPrev ? next : prev;
        return cuentaItemsPedido(next) >= cuentaItemsPedido(prev) ? next : prev;
    }

    function fusionarItemsPedidoMayoreo(aItems, bItems) {
        var map = Object.create(null);
        function poner(it) {
            if (!it) return;
            var id = it.itemId || [
                String(it.inventarioId || ''),
                String(it.ref || ''),
                String(it.nombre || ''),
                String(it.talla || ''),
                String(it.color || '')
            ].join('::');
            var prev = map[id];
            if (!prev) {
                map[id] = it;
                return;
            }
            var out = Object.assign({}, prev, it);
            if (prev.disponibilidad === 'si' || it.disponibilidad === 'si') {
                out.disponibilidad = 'si';
            } else if (prev.disponibilidad === 'no' || it.disponibilidad === 'no') {
                out.disponibilidad = 'no';
            }
            if (prev.stockObebeAplicado || it.stockObebeAplicado) out.stockObebeAplicado = true;
            map[id] = out;
        }
        (aItems || []).forEach(poner);
        (bItems || []).forEach(poner);
        return Object.keys(map).map(function (k) { return map[k]; });
    }

    /** Une dos versiones del mismo pedido sin perder venta/inventario confirmados. */
    function fusionarDosPedidosMayoreo(prev, next) {
        if (!prev) return next;
        if (!next) return prev;
        var base = elegirPedidoMayoreo(prev, next);
        var other = base === prev ? next : prev;
        var out = Object.assign({}, base);
        if (other.ventaRetailRegistradaEn) {
            if (!out.ventaRetailRegistradaEn) {
                out.ventaRetailRegistradaEn = other.ventaRetailRegistradaEn;
            } else {
                out.ventaRetailRegistradaEn = Math.min(
                    Number(out.ventaRetailRegistradaEn),
                    Number(other.ventaRetailRegistradaEn)
                );
            }
        }
        if (other.inventarioAplicado) {
            out.inventarioAplicado = true;
            out.inventarioAplicadoEn = Math.max(
                Number(out.inventarioAplicadoEn || 0),
                Number(other.inventarioAplicadoEn || 0)
            ) || other.inventarioAplicadoEn || Date.now();
        }
        if (other.inventarioUnidadesAplicadas != null) {
            out.inventarioUnidadesAplicadas = Math.max(
                Number(out.inventarioUnidadesAplicadas || 0),
                Number(other.inventarioUnidadesAplicadas || 0)
            );
        }
        if (other.stockInventarioObebeAplicado) out.stockInventarioObebeAplicado = true;
        if (other.estado === 'revisado' && out.estado !== 'cancelado') {
            out.estado = 'revisado';
            out.revisadoEn = Math.max(Number(out.revisadoEn || 0), Number(other.revisadoEn || 0)) ||
                out.revisadoEn || other.revisadoEn;
        }
        out.items = fusionarItemsPedidoMayoreo(base.items, other.items);
        out.pedidoActualizadoEn = Math.max(
            Number(out.pedidoActualizadoEn || 0),
            Number(other.pedidoActualizadoEn || 0),
            Number(out.ventaRetailRegistradaEn || 0),
            Number(other.ventaRetailRegistradaEn || 0)
        );
        return out;
    }

    function fusionarPorId(localArr, cloudArr) {
        var map = Object.create(null);
        function poner(item) {
            if (!item || !item.id) return;
            var prev = map[item.id];
            map[item.id] = fusionarDosPedidosMayoreo(prev, item);
        }
        (localArr || []).forEach(poner);
        (cloudArr || []).forEach(poner);
        return Object.keys(map).map(function (id) { return map[id]; });
    }

    /** Timestamp de línea de inventario mayoreo (no usar lógica de pedidos). */
    function tsLineaMayoreo(l) {
        if (!l) return 0;
        return Math.max(
            Number(l.actualizadoEn || 0),
            Number(l.importadoEn || 0)
        );
    }

    function elegirLineaMayoreo(prev, next) {
        if (!prev) return next;
        if (!next) return prev;
        var tPrev = tsLineaMayoreo(prev);
        var tNext = tsLineaMayoreo(next);
        if (tNext > tPrev) return next;
        if (tPrev > tNext) return prev;
        var cPrev = Number(prev.cantidad || 0);
        var cNext = Number(next.cantidad || 0);
        if (cNext !== cPrev) return cNext > cPrev ? next : prev;
        /* Empate: conservar la que ya estaba (local se fusiona primero → no pisar stock nuevo). */
        return prev;
    }

    function fusionarLineasMayoreo(localArr, cloudArr) {
        var map = Object.create(null);
        function poner(item) {
            if (!item || !item.id) return;
            var prev = map[item.id];
            map[item.id] = elegirLineaMayoreo(prev, item);
        }
        (localArr || []).forEach(poner);
        (cloudArr || []).forEach(poner);
        return Object.keys(map).map(function (id) { return map[id]; });
    }

    function fusionarObj(localO, cloudO) {
        var out = Object.assign({}, cloudO || {});
        Object.keys(localO || {}).forEach(function (k) {
            var loc = localO[k];
            var rem = out[k];
            if (k === 'ventasEliminadas' || k === 'ventasEliminadasHuellas') return;
            if (!rem || typeof loc !== 'object' || typeof rem !== 'object') {
                out[k] = loc;
                return;
            }
            var tLoc = Number(loc.ultimaActualizacionStock || loc.actualizadoEn || 0);
            var tRem = Number(rem.ultimaActualizacionStock || rem.actualizadoEn || 0);
            out[k] = tLoc >= tRem ? loc : rem;
        });
        return out;
    }

    function fusionarVentasEliminadas(localMap, cloudMap) {
        var out = Object.assign({}, cloudMap || {});
        Object.keys(localMap || {}).forEach(function (id) {
            var tL = Number(localMap[id]) || 0;
            var tC = Number(out[id]) || 0;
            out[id] = Math.max(tL, tC);
        });
        return out;
    }

    function huellaVentaPack(v) {
        if (!v) return '';
        var l0 = (v.lineas && v.lineas[0]) || {};
        function norm(s) { return String(s || '').trim().toLowerCase(); }
        return [
            norm(v.clienteKey || 'naty'),
            String(v.fechaIso || ''),
            norm(v.comprador),
            norm(l0.nombre),
            norm(l0.talla),
            String(l0.cantidad || 1)
        ].join('::');
    }

    function ventaBorradaEnMeta(v, ventasEliminadas, huellasElim) {
        if (!v) return true;
        var tDel = Number((ventasEliminadas || {})[v.id]) || 0;
        if (tDel && tsVentaMayoreo(v) <= tDel) return true;
        var hu = huellaVentaPack(v);
        if (hu && huellasElim && huellasElim[hu]) {
            var tH = Number(huellasElim[hu]) || 0;
            if (tH && tsVentaMayoreo(v) <= tH) return true;
        }
        return false;
    }

    function tsVentaMayoreo(v) {
        if (!v) return 0;
        return Number(v.actualizadoEn || v.editadoEn || v.creadoEn || 0);
    }

    function fusionarVentasMayoreo(localVentas, cloudVentas, ventasEliminadas, huellasElim) {
        ventasEliminadas = ventasEliminadas || {};
        huellasElim = huellasElim || {};
        var map = Object.create(null);
        function poner(v) {
            if (!v || !v.id) return;
            if (ventaBorradaEnMeta(v, ventasEliminadas, huellasElim)) return;
            var prev = map[v.id];
            if (!prev) {
                map[v.id] = v;
                return;
            }
            map[v.id] = tsVentaMayoreo(v) >= tsVentaMayoreo(prev) ? v : prev;
        }
        (localVentas || []).forEach(poner);
        (cloudVentas || []).forEach(poner);
        return Object.keys(map).map(function (id) { return map[id]; });
    }

    function comprasEarlyDesdeStore() {
        var Store = global.ObebeComprasStore;
        if (!Store || !Store.getAll) return [];
        return Store.getAll().filter(function (c) {
            return c && c.earlyAccess && !c.enTienda;
        });
    }

    function tsEarlyClearLocal() {
        try {
            var n = parseInt(localStorage.getItem('obebe_compras_early_clear_ts') || '0', 10);
            return isNaN(n) ? 0 : n;
        } catch (e) {
            return 0;
        }
    }

    function marcarEarlyClearLocal(ts) {
        try {
            localStorage.setItem('obebe_compras_early_clear_ts', String(ts || Date.now()));
        } catch (e) { /* ignore */ }
    }

    function elegirComprasEarly(localE, cloudE, cloudEn, localEn) {
        localE = Array.isArray(localE) ? localE : [];
        cloudE = Array.isArray(cloudE) ? cloudE : [];
        /* Un vaciado reciente (lista vacía + ts más nuevo) gana sobre early viejo en la nube. */
        if (!localE.length && (localEn || 0) > (cloudEn || 0)) {
            return { list: [], en: localEn || 0 };
        }
        if (!cloudE.length && (cloudEn || 0) > (localEn || 0)) {
            return { list: [], en: cloudEn || 0 };
        }
        if (cloudE.length > localE.length) return { list: cloudE, en: cloudEn || Date.now() };
        if (localE.length > cloudE.length) return { list: localE, en: localEn || 0 };
        if ((cloudEn || 0) >= (localEn || 0)) return { list: cloudE, en: cloudEn || 0 };
        return { list: localE, en: localEn || 0 };
    }

    function packDesdeLocal() {
        var pack = {
            id: PACK_ID,
            clienteKey: 'naty',
            lineas: leerJson(KEY_LINEAS, []),
            ventas: leerJson(KEY_VENTAS, []),
            pedidos: leerJson(KEY_PEDIDOS, []),
            meta: leerJson(KEY_META, {}),
            metaCompradores: leerJson(KEY_META_COMPR, {}),
            actualizadoEn: Date.now()
        };
        var early = comprasEarlyDesdeStore();
        pack.comprasEarly = early;
        if (early.length) {
            pack.comprasEarlyEn = Date.now();
        } else {
            var clearTs = tsEarlyClearLocal();
            if (clearTs) pack.comprasEarlyEn = clearTs;
        }
        return pack;
    }

    function packDesdePayload(arr) {
        if (!Array.isArray(arr)) return null;
        var hit = arr.find(function (x) {
            return x && (x.id === PACK_ID || x._modulo === 'mayoreo_naty');
        });
        if (!hit) return null;
        return {
            id: PACK_ID,
            clienteKey: hit.clienteKey || 'naty',
            lineas: Array.isArray(hit.lineas) ? hit.lineas : [],
            ventas: Array.isArray(hit.ventas) ? hit.ventas : [],
            pedidos: Array.isArray(hit.pedidos) ? hit.pedidos : [],
            meta: hit.meta && typeof hit.meta === 'object' ? hit.meta : {},
            metaCompradores: hit.metaCompradores && typeof hit.metaCompradores === 'object'
                ? hit.metaCompradores : {},
            comprasEarly: Array.isArray(hit.comprasEarly) ? hit.comprasEarly : [],
            comprasEarlyEn: Number(hit.comprasEarlyEn) || 0,
            actualizadoEn: Number(hit.actualizadoEn) || 0
        };
    }

    function payloadParaCloud(pack) {
        pack = pack || packDesdeLocal();
        pack.actualizadoEn = Date.now();
        return [pack];
    }

    function fusionarPacks(local, cloud) {
        if (!cloud) return local;
        if (!local) return cloud;
        var pickEarly = elegirComprasEarly(
            local.comprasEarly,
            cloud.comprasEarly,
            cloud.comprasEarlyEn,
            local.comprasEarlyEn
        );
        var metaFus = fusionarObj(local.meta, cloud.meta);
        var ventasElim = fusionarVentasEliminadas(
            (local.meta && local.meta.ventasEliminadas) || null,
            (cloud.meta && cloud.meta.ventasEliminadas) || null
        );
        var huellasElim = fusionarVentasEliminadas(
            (local.meta && local.meta.ventasEliminadasHuellas) || null,
            (cloud.meta && cloud.meta.ventasEliminadasHuellas) || null
        );
        metaFus.ventasEliminadas = ventasElim;
        metaFus.ventasEliminadasHuellas = huellasElim;
        return {
            id: PACK_ID,
            clienteKey: 'naty',
            lineas: fusionarLineasMayoreo(local.lineas, cloud.lineas),
            ventas: fusionarVentasMayoreo(local.ventas, cloud.ventas, ventasElim, huellasElim),
            pedidos: pedidosSinDuplicadoNaty2910(fusionarPorId(local.pedidos, cloud.pedidos)),
            meta: metaFus,
            metaCompradores: fusionarObj(local.metaCompradores, cloud.metaCompradores),
            comprasEarly: pickEarly.list,
            comprasEarlyEn: pickEarly.en,
            actualizadoEn: Math.max(local.actualizadoEn || 0, cloud.actualizadoEn || 0, Date.now())
        };
    }

    function aplicarPackLocal(pack) {
        if (!pack) return;
        aplicandoRemoto += 1;
        var pedidosAntes = '';
        try {
            pedidosAntes = localStorage.getItem(KEY_PEDIDOS) || '';
        } catch (e) { /* ignore */ }
        try {
            guardarJson(KEY_LINEAS, pack.lineas || []);
            guardarJson(KEY_VENTAS, pack.ventas || []);
            guardarJson(KEY_PEDIDOS, pack.pedidos || []);
            guardarJson(KEY_META, pack.meta || {});
            guardarJson(KEY_META_COMPR, pack.metaCompradores || {});
            if (global.ObebeAdminModulosCloud &&
                ObebeAdminModulosCloud.aplicarComprasEarlyEnLocal &&
                pack.comprasEarly && pack.comprasEarly.length) {
                ObebeAdminModulosCloud.aplicarComprasEarlyEnLocal(pack.comprasEarly);
            }
            var pedidosDespues = '';
            try {
                pedidosDespues = localStorage.getItem(KEY_PEDIDOS) || '';
            } catch (e2) { /* ignore */ }
            if (typeof document !== 'undefined' && pedidosAntes !== pedidosDespues) {
                try {
                    document.dispatchEvent(new CustomEvent('obebe-mayoreo-pedidos-sync'));
                } catch (e3) { /* ignore */ }
            }
        } finally {
            aplicandoRemoto -= 1;
        }
    }

    function repararInventarioTrasPack() {
        if (!global.ObebeMayoreoStore ||
            typeof ObebeMayoreoStore.asegurarInventarioDesdePedidosConfirmados !== 'function') {
            return { ok: true, reparados: 0 };
        }
        try {
            return ObebeMayoreoStore.asegurarInventarioDesdePedidosConfirmados() || { ok: true, reparados: 0 };
        } catch (e) {
            return { ok: false, reparados: 0 };
        }
    }

  function preservarEarlyEnPackSubida(merged, cloudSnap) {
        merged = Object.assign({}, merged || {});
        var pick = elegirComprasEarly(
            merged.comprasEarly,
            cloudSnap && cloudSnap.comprasEarly,
            cloudSnap && cloudSnap.comprasEarlyEn,
            merged.comprasEarlyEn
        );
        var earlyOb = comprasEarlyDesdeStore();
        var clearTs = tsEarlyClearLocal();
        if (earlyOb.length) {
            merged.comprasEarly = earlyOb;
            merged.comprasEarlyEn = Date.now();
        } else if (clearTs && clearTs >= (pick.en || 0)) {
            merged.comprasEarly = [];
            merged.comprasEarlyEn = clearTs;
        } else if (pick.list.length) {
            merged.comprasEarly = pick.list;
            merged.comprasEarlyEn = pick.en;
        } else {
            merged.comprasEarly = [];
            merged.comprasEarlyEn = Math.max(clearTs, pick.en || 0, Date.now());
        }
        return merged;
    }

    function leerPackNubeMayoreo() {
        return global.ObebeAdminBackend.callAdminApi('getAdminModuloBlob', { moduleKey: MODULE_KEY })
            .then(function (res) { return packDesdePayload(res && res.payload); });
    }

    function subirPackMayoreoNaty(pack) {
        return global.ObebeAdminBackend.callAdminApi('setAdminModuloBlob', {
            moduleKey: MODULE_KEY,
            payload: payloadParaCloud(pack)
        });
    }

    function publicarComprasEarlyParaNaty(opts) {
        opts = opts || {};
        if (!canSync()) return Promise.resolve({ ok: false, offline: true });
        var early = comprasEarlyDesdeStore();
        if (!early.length && !opts.forzarVacio) {
            return Promise.resolve({ ok: true, early: 0, omitido: true });
        }
        var ts = Date.now();
        if (!early.length) marcarEarlyClearLocal(ts);
        return enColaNubeMayoreo(function () {
            return leerPackNubeMayoreo().then(function (cloud) {
                var local = packDesdeLocal();
                var merged = cloud ? fusionarPacks(local, cloud) : local;
                merged.comprasEarly = early;
                merged.comprasEarlyEn = ts;
                return subirPackMayoreoNaty(merged).then(function () {
                    return { ok: true, early: early.length, vaciado: !early.length };
                });
            });
        }).catch(function (err) {
            console.warn('[admin-mayoreo-cloud] publicar early', err);
            return { ok: false, error: (err && err.message) || String(err) };
        });
    }

    function syncMayoreoNaty() {
        if (!canSync()) return Promise.resolve({ ok: false, offline: true });
        return enColaNubeMayoreo(function () {
            var local = packDesdeLocal();
            var cloudPackRef = null;
            var merged = null;
            return leerPackNubeMayoreo()
                .then(function (cloud) {
                    cloudPackRef = cloud;
                    merged = fusionarPacks(local, cloudPackRef);
                    aplicarPackLocal(merged);
                    merged = fusionarPacks(packDesdeLocal(), cloudPackRef);
                    return leerPackNubeMayoreo();
                })
                .then(function (cloudOtraVez) {
                    repararInventarioTrasPack();
                    merged = fusionarPacks(packDesdeLocal(), cloudOtraVez || cloudPackRef);
                    var aSubir = preservarEarlyEnPackSubida(merged, cloudOtraVez || cloudPackRef);
                    return subirPackMayoreoNaty(aSubir);
                })
                .then(function () { return { ok: true }; });
        }).catch(function (err) {
            var msg = (err && err.message) ? String(err.message) : String(err);
            if (msg.indexOf('moduleKey no permitido') !== -1) {
                msg = 'La API de Supabase no acepta mayoreo_naty. Ejecuta deploy-admin-api.ps1 (ver DESPLIEGAR-ADMIN-API.md).';
            }
            if (msg.indexOf('moduleKey no permitido') === -1) {
                console.warn('[admin-mayoreo-cloud] sync', err);
            }
            return { ok: false, error: msg };
        });
    }

    /** Solo descarga mayoreo_naty (early, pedidos) sin subir — no bloquea la UI ni pisa la nube. */
    function pullMayoreoNatyDesdeNube() {
        if (!canSync()) return Promise.resolve({ ok: false, offline: true });
        var local = packDesdeLocal();
        return leerPackNubeMayoreo()
            .then(function (cloud) {
                if (!cloud) {
                    var r0 = repararInventarioTrasPack();
                    if (r0 && r0.reparados > 0) {
                        return pushMayoreoNatyNow().then(function () { return { ok: true, reparado: true }; });
                    }
                    return { ok: true, vacio: true };
                }
                var merged = fusionarPacks(local, cloud);
                aplicarPackLocal(merged);
                var r = repararInventarioTrasPack();
                if (r && r.reparados > 0) {
                    return pushMayoreoNatyNow().then(function () { return { ok: true, reparado: true }; });
                }
                return { ok: true };
            })
            .catch(function (err) {
                console.warn('[admin-mayoreo-cloud] pull', err);
                return { ok: false, error: (err && err.message) || String(err) };
            });
    }

    function pushMayoreoNatyNow() {
        if (!canSync()) return Promise.resolve({ ok: false, offline: true });
        return enColaNubeMayoreo(function () {
            var local = packDesdeLocal();
            return leerPackNubeMayoreo().then(function (cloud) {
                var merged = fusionarPacks(local, cloud);
                var aSubir = preservarEarlyEnPackSubida(merged, cloud);
                return subirPackMayoreoNaty(aSubir).then(function () { return { ok: true }; });
            });
        }).catch(function (err) {
            console.warn('[admin-mayoreo-cloud] push', err);
            return { ok: false, error: (err && err.message) || String(err) };
        });
    }

    function notifyMayoreoNatySaved() {
        if (aplicandoRemoto > 0) return;
        if (!canSync()) return;
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(function () {
            pushTimer = null;
            pushMayoreoNatyNow();
        }, 800);
    }

    global.ObebeAdminMayoreoCloud = {
        MODULE_KEY: MODULE_KEY,
        canSync: canSync,
        syncMayoreoNaty: syncMayoreoNaty,
        pullMayoreoNatyDesdeNube: pullMayoreoNatyDesdeNube,
        pushMayoreoNatyNow: pushMayoreoNatyNow,
        notifyMayoreoNatySaved: notifyMayoreoNatySaved,
        publicarComprasEarlyParaNaty: publicarComprasEarlyParaNaty,
        marcarEarlyClearLocal: marcarEarlyClearLocal,
        tsEarlyClearLocal: tsEarlyClearLocal
    };
})(window);