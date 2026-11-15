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

    function fusionarPorId(localArr, cloudArr) {
        var map = Object.create(null);
        function poner(item) {
            if (!item || !item.id) return;
            var prev = map[item.id];
            if (!prev || tsItem(item) >= tsItem(prev)) {
                map[item.id] = item;
            }
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

    function packDesdeLocal() {
        return {
            id: PACK_ID,
            clienteKey: 'naty',
            lineas: leerJson(KEY_LINEAS, []),
            ventas: leerJson(KEY_VENTAS, []),
            pedidos: leerJson(KEY_PEDIDOS, []),
            meta: leerJson(KEY_META, {}),
            metaCompradores: leerJson(KEY_META_COMPR, {}),
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
        return {
            id: PACK_ID,
            clienteKey: 'naty',
            lineas: fusionarPorId(local.lineas, cloud.lineas),
            ventas: fusionarPorId(local.ventas, cloud.ventas),
            pedidos: fusionarPorId(local.pedidos, cloud.pedidos),
            meta: fusionarObj(local.meta, cloud.meta),
            metaCompradores: fusionarObj(local.metaCompradores, cloud.metaCompradores),
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
        } finally {
            aplicandoRemoto -= 1;
        }
    }

    function syncMayoreoNaty() {
        if (!canSync()) return Promise.resolve({ ok: false, offline: true });
        var local = packDesdeLocal();
        return global.ObebeAdminBackend.callAdminApi('getAdminModuloBlob', { moduleKey: MODULE_KEY })
            .then(function (res) {
                var cloud = packDesdePayload(res && res.payload);
                var merged = fusionarPacks(local, cloud);
                aplicarPackLocal(merged);
                if (global.ObebeMayoreoPedidosStore) {
                    if (ObebeMayoreoPedidosStore.asegurarPedidoNatyLegacy20261017) {
                        ObebeMayoreoPedidosStore.asegurarPedidoNatyLegacy20261017();
                    }
                    if (ObebeMayoreoPedidosStore.asegurarPedidoNatySegundo20261029) {
                        ObebeMayoreoPedidosStore.asegurarPedidoNatySegundo20261029();
                    }
                }
                return global.ObebeAdminBackend.callAdminApi('setAdminModuloBlob', {
                    moduleKey: MODULE_KEY,
                    payload: payloadParaCloud(merged)
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
        return global.ObebeAdminBackend.callAdminApi('setAdminModuloBlob', {
            moduleKey: MODULE_KEY,
            payload: payloadParaCloud(packDesdeLocal())
        }).then(function () { return { ok: true }; }).catch(function (err) {
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
        notifyMayoreoNatySaved: notifyMayoreoNatySaved
    };
})(window);