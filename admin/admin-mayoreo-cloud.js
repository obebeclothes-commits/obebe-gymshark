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

    function elegirPedidoMayoreo(prev, next) {
        if (!prev) return next;
        if (!next) return prev;
        var nPrev = cuentaItemsPedido(prev);
        var nNext = cuentaItemsPedido(next);
        if (nNext > nPrev) return next;
        if (nPrev > nNext) return prev;
        return tsItem(next) >= tsItem(prev) ? next : prev;
    }

    function fusionarPorId(localArr, cloudArr) {
        var map = Object.create(null);
        function poner(item) {
            if (!item || !item.id) return;
            var prev = map[item.id];
            map[item.id] = elegirPedidoMayoreo(prev, item);
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

    function comprasEarlyDesdeStore() {
        var Store = global.ObebeComprasStore;
        if (!Store || !Store.getAll) return [];
        return Store.getAll().filter(function (c) {
            return c && c.earlyAccess && !c.enTienda;
        });
    }

    function elegirComprasEarly(localE, cloudE, cloudEn, localEn) {
        localE = Array.isArray(localE) ? localE : [];
        cloudE = Array.isArray(cloudE) ? cloudE : [];
        if (cloudE.length > localE.length) return { list: cloudE, en: cloudEn || Date.now() };
        if (localE.length > cloudE.length) return { list: localE, en: localEn || 0 };
        if ((cloudEn || 0) >= (localEn || 0)) return { list: cloudE, en: cloudEn || 0 };
        return { list: localE, en: localEn || 0 };
    }

    function packDesdeLocal() {
        var early = comprasEarlyDesdeStore();
        return {
            id: PACK_ID,
            clienteKey: 'naty',
            lineas: leerJson(KEY_LINEAS, []),
            ventas: leerJson(KEY_VENTAS, []),
            pedidos: leerJson(KEY_PEDIDOS, []),
            meta: leerJson(KEY_META, {}),
            metaCompradores: leerJson(KEY_META_COMPR, {}),
            comprasEarly: early,
            comprasEarlyEn: early.length ? Date.now() : 0,
            actualizadoEn: Date.now()
        };
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
        return {
            id: PACK_ID,
            clienteKey: 'naty',
            lineas: fusionarPorId(local.lineas, cloud.lineas),
            ventas: fusionarPorId(local.ventas, cloud.ventas),
            pedidos: pedidosSinDuplicadoNaty2910(fusionarPorId(local.pedidos, cloud.pedidos)),
            meta: fusionarObj(local.meta, cloud.meta),
            metaCompradores: fusionarObj(local.metaCompradores, cloud.metaCompradores),
            comprasEarly: pickEarly.list,
            comprasEarlyEn: pickEarly.en,
            actualizadoEn: Math.max(local.actualizadoEn || 0, cloud.actualizadoEn || 0, Date.now())
        };
    }

    function aplicarPackLocal(pack) {
        if (!pack) return;
        aplicandoRemoto += 1;
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
        } finally {
            aplicandoRemoto -= 1;
        }
    }

    function packParaSubirSinBorrarEarly(cloudPack) {
        var local = packDesdeLocal();
        if (cloudPack && Array.isArray(cloudPack.comprasEarly) && cloudPack.comprasEarly.length) {
            var pick = elegirComprasEarly(
                local.comprasEarly,
                cloudPack.comprasEarly,
                cloudPack.comprasEarlyEn,
                local.comprasEarlyEn
            );
            if (pick.list.length >= (local.comprasEarly || []).length) {
                local.comprasEarly = pick.list;
                local.comprasEarlyEn = pick.en;
            }
        } else if (!local.comprasEarly || !local.comprasEarly.length) {
            delete local.comprasEarly;
            local.comprasEarlyEn = 0;
        }
        return local;
    }

    function publicarComprasEarlyParaNaty() {
        if (!canSync()) return Promise.resolve({ ok: false, offline: true });
        var early = comprasEarlyDesdeStore();
        if (!early.length) return Promise.resolve({ ok: true, early: 0, omitido: true });
        return global.ObebeAdminBackend.callAdminApi('getAdminModuloBlob', { moduleKey: MODULE_KEY })
            .then(function (res) {
                var cloud = packDesdePayload(res && res.payload);
                var local = packDesdeLocal();
                var merged = cloud ? fusionarPacks(local, cloud) : local;
                merged.comprasEarly = early;
                merged.comprasEarlyEn = Date.now();
                return global.ObebeAdminBackend.callAdminApi('setAdminModuloBlob', {
                    moduleKey: MODULE_KEY,
                    payload: payloadParaCloud(merged)
                });
            })
            .then(function () { return { ok: true, early: early.length }; })
            .catch(function (err) {
                console.warn('[admin-mayoreo-cloud] publicar early', err);
                return { ok: false, error: (err && err.message) || String(err) };
            });
    }

    function syncMayoreoNaty() {
        if (!canSync()) return Promise.resolve({ ok: false, offline: true });
        var local = packDesdeLocal();
        var cloudPackRef = null;
        return global.ObebeAdminBackend.callAdminApi('getAdminModuloBlob', { moduleKey: MODULE_KEY })
            .then(function (res) {
                cloudPackRef = packDesdePayload(res && res.payload);
                var merged = fusionarPacks(local, cloudPackRef);
                aplicarPackLocal(merged);
                if (global.ObebeMayoreoPedidosStore) {
                    if (ObebeMayoreoPedidosStore.asegurarPedidoNatyLegacy20261017) {
                        ObebeMayoreoPedidosStore.asegurarPedidoNatyLegacy20261017();
                    }
                    if (ObebeMayoreoPedidosStore.asegurarPedidoNatySegundo20261029) {
                        ObebeMayoreoPedidosStore.asegurarPedidoNatySegundo20261029();
                    }
                    if (ObebeMayoreoPedidosStore.purgarDuplicadosNatyPedido2910) {
                        ObebeMayoreoPedidosStore.purgarDuplicadosNatyPedido2910();
                    }
                }
                return global.ObebeAdminBackend.callAdminApi('setAdminModuloBlob', {
                    moduleKey: MODULE_KEY,
                    payload: payloadParaCloud(packParaSubirSinBorrarEarly(cloudPackRef))
                });
            })
            .then(function () { return { ok: true }; })
            .catch(function (err) {
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

    function pushMayoreoNatyNow() {
        if (!canSync()) return Promise.resolve({ ok: false, offline: true });
        return global.ObebeAdminBackend.callAdminApi('getAdminModuloBlob', { moduleKey: MODULE_KEY })
            .then(function (res) {
                var cloud = packDesdePayload(res && res.payload);
                return global.ObebeAdminBackend.callAdminApi('setAdminModuloBlob', {
                    moduleKey: MODULE_KEY,
                    payload: payloadParaCloud(packParaSubirSinBorrarEarly(cloud))
                });
            })
            .then(function () { return { ok: true }; }).catch(function (err) {
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
        pushMayoreoNatyNow: pushMayoreoNatyNow,
        notifyMayoreoNatySaved: notifyMayoreoNatySaved,
        publicarComprasEarlyParaNaty: publicarComprasEarlyParaNaty
    };
})(window);