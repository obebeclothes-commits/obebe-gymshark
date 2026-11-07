(function (global) {
    'use strict';

    var KEYS = {
        apartados: 'obebe_apartados_v1',
        entregas: 'obebe_entregas_v1',
        sucursales: 'obebe_sucursales_v1',
        compras: 'obebe_compras_v1',
        cotizador: 'obebe_cotizador_config_v1'
    };

    var SUCURSALES_BLOB_ID = 'obebe-sucursales-blob';
    var COMPRAS_BLOB_ID = 'obebe-compras-blob';
    var ENTREGAS_DELETED_BLOB_ID = 'obebe-entregas-deleted-blob';
    var KEY_ENTREGAS_DELETED = 'obebe_entregas_deleted_v1';

    var pushTimers = {};
    var borradasPendientes = {};

    function canSync() {
        return !!(global.ObebeAdminBackend &&
            ObebeAdminBackend.supabaseListoAdmin &&
            ObebeAdminBackend.supabaseListoAdmin());
    }

    function leerLocal(key) {
        try {
            var raw = localStorage.getItem(key);
            if (!raw) return [];
            var arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function guardarLocal(key, arr) {
        try {
            localStorage.setItem(key, JSON.stringify(arr || []));
            return true;
        } catch (e) {
            return false;
        }
    }

    function tsRegistro(item) {
        if (!item) return 0;
        return item.actualizadoEn || item.completadaEn || item.canceladaEn || item.creadoEn || 0;
    }

    function fusionarPorId(localArr, cloudArr) {
        var map = Object.create(null);
        function poner(item) {
            if (!item || !item.id) return;
            var prev = map[item.id];
            if (!prev || tsRegistro(item) >= tsRegistro(prev)) {
                map[item.id] = item;
            }
        }
        (localArr || []).forEach(poner);
        (cloudArr || []).forEach(poner);
        return Object.keys(map).map(function (id) { return map[id]; });
    }

    function asegurarOk(res) {
        if (!res || res.ok === false) {
            throw new Error((res && res.error) || 'No se pudo sincronizar');
        }
        return res;
    }

    function esBlobSucursales(item) {
        return !!(item && item.id === SUCURSALES_BLOB_ID);
    }

    function esBlobCompras(item) {
        return !!(item && item.id === COMPRAS_BLOB_ID);
    }

    function esBlobEntregasDeleted(item) {
        return !!(item && item.id === ENTREGAS_DELETED_BLOB_ID);
    }

    function esBlobMarcador(item) {
        return esBlobSucursales(item) || esBlobCompras(item) || esBlobEntregasDeleted(item);
    }

    function leerBorradasLocal() {
        try {
            var raw = localStorage.getItem(KEY_ENTREGAS_DELETED);
            if (!raw) return {};
            var o = JSON.parse(raw);
            return o && typeof o === 'object' ? o : {};
        } catch (e) {
            return {};
        }
    }

    function guardarBorradasLocal(map) {
        try {
            localStorage.setItem(KEY_ENTREGAS_DELETED, JSON.stringify(map || {}));
        } catch (e) { /* ignore */ }
    }

    function fusionarBorradas() {
        var out = Object.assign({}, leerBorradasLocal(), borradasPendientes);
        var args = Array.prototype.slice.call(arguments);
        args.forEach(function (mapa) {
            if (!mapa || typeof mapa !== 'object') return;
            Object.keys(mapa).forEach(function (id) {
                var ts = Number(mapa[id]) || 0;
                if (!out[id] || ts >= out[id]) out[id] = ts;
            });
        });
        return out;
    }

    function filtrarEntregasBorradas(entregas, borradas) {
        borradas = borradas || {};
        return (entregas || []).filter(function (e) {
            if (!e || !e.id || esBlobMarcador(e)) return false;
            var delAt = Number(borradas[e.id]) || 0;
            if (!delAt) return true;
            return tsRegistro(e) > delAt;
        });
    }

    function partirEntregas(arr) {
        var entregas = [];
        var lineas = [];
        var compras = [];
        var borradas = {};
        var comprasActualizadoEn = 0;
        (arr || []).forEach(function (item) {
            if (esBlobSucursales(item)) {
                if (Array.isArray(item.lineas)) lineas = lineas.concat(item.lineas);
            } else if (esBlobCompras(item)) {
                if (Array.isArray(item.lineas)) compras = compras.concat(item.lineas);
                var ts = Number(item.actualizadoEn) || 0;
                if (ts > comprasActualizadoEn) comprasActualizadoEn = ts;
            } else if (esBlobEntregasDeleted(item)) {
                if (item.deleted && typeof item.deleted === 'object') {
                    Object.keys(item.deleted).forEach(function (id) {
                        var t = Number(item.deleted[id]) || 0;
                        if (!borradas[id] || t >= borradas[id]) borradas[id] = t;
                    });
                }
            } else if (item && item.id) {
                entregas.push(item);
            }
        });
        return {
            entregas: entregas,
            lineas: lineas,
            compras: compras,
            borradas: borradas,
            comprasActualizadoEn: comprasActualizadoEn
        };
    }

    function payloadEntregas(entregas, lineas, compras, borradas) {
        var out = (entregas || []).filter(function (item) { return item && !esBlobMarcador(item); });
        out.push({
            id: SUCURSALES_BLOB_ID,
            _modulo: 'sucursales',
            lineas: lineas || [],
            actualizadoEn: Date.now()
        });
        out.push({
            id: COMPRAS_BLOB_ID,
            _modulo: 'compras',
            lineas: compras || [],
            actualizadoEn: Date.now()
        });
        out.push({
            id: ENTREGAS_DELETED_BLOB_ID,
            _modulo: 'entregas-deleted',
            deleted: borradas || {},
            actualizadoEn: Date.now()
        });
        return out;
    }

    function leerEntregasCloud() {
        return ObebeAdminBackend.callAdminApi('getAdminModuloBlob', { moduleKey: 'entregas' })
            .then(asegurarOk)
            .then(function (res) {
                return partirEntregas(Array.isArray(res.payload) ? res.payload : []);
            });
    }

    function guardarEntregasCloud(entregas, lineas, compras, borradas) {
        return ObebeAdminBackend.callAdminApi('setAdminModuloBlob', {
            moduleKey: 'entregas',
            payload: payloadEntregas(entregas, lineas, compras, borradas)
        }).then(asegurarOk);
    }

    function syncEntregasYSucursales() {
        if (!canSync()) return Promise.resolve(false);
        return leerEntregasCloud().then(function (cloud) {
            var localEntregas = partirEntregas(leerLocal(KEYS.entregas)).entregas;
            var borradas = fusionarBorradas(cloud.borradas);
            var entregas = filtrarEntregasBorradas(
                fusionarPorId(localEntregas, cloud.entregas),
                borradas
            );
            var lineas = fusionarPorId(leerLocal(KEYS.sucursales), cloud.lineas);
            var compras = comprasMasRecientes(cloud);
            guardarBorradasLocal(borradas);
            guardarLocal(KEYS.entregas, entregas);
            guardarLocal(KEYS.sucursales, lineas);
            guardarLocal(KEYS.compras, compras);
            return guardarEntregasCloud(entregas, lineas, compras, borradas);
        }).then(function () { return true; }).catch(function (err) {
            console.warn('[admin-modulos-cloud] sync entregas/sucursales', err);
            return false;
        });
    }

    function syncModulo(moduleKey, localKey) {
        if (!canSync()) return Promise.resolve(false);
        return ObebeAdminBackend.callAdminApi('getAdminModuloBlob', { moduleKey: moduleKey })
            .then(function (res) {
                var cloud = Array.isArray(res.payload) ? res.payload : [];
                var local = leerLocal(localKey);
                var merged = fusionarPorId(local, cloud);
                guardarLocal(localKey, merged);
                return ObebeAdminBackend.callAdminApi('setAdminModuloBlob', {
                    moduleKey: moduleKey,
                    payload: merged
                });
            })
            .then(function () { return true; })
            .catch(function (err) {
                console.warn('[admin-modulos-cloud] sync', moduleKey, err);
                return false;
            });
    }

    function programarPush(moduleKey, localKey) {
        if (!canSync()) return;
        if (pushTimers[moduleKey]) clearTimeout(pushTimers[moduleKey]);
        pushTimers[moduleKey] = setTimeout(function () {
            pushTimers[moduleKey] = null;
            var data = leerLocal(localKey);
            ObebeAdminBackend.callAdminApi('setAdminModuloBlob', {
                moduleKey: moduleKey,
                payload: data
            }).catch(function (err) {
                console.warn('[admin-modulos-cloud] push', moduleKey, err);
            });
        }, 700);
    }

    function programarPushEntregas() {
        if (!canSync()) return;
        if (pushTimers.entregas) clearTimeout(pushTimers.entregas);
        pushTimers.entregas = setTimeout(function () {
            pushTimers.entregas = null;
            var entregas = partirEntregas(leerLocal(KEYS.entregas)).entregas;
            var borradasLocal = fusionarBorradas();
            leerEntregasCloud().then(function (cloud) {
                var borradas = fusionarBorradas(cloud.borradas, borradasLocal);
                entregas = filtrarEntregasBorradas(entregas, borradas);
                var lineas = fusionarPorId(leerLocal(KEYS.sucursales), cloud.lineas);
                var compras = fusionarPorId(leerLocal(KEYS.compras), cloud.compras);
                guardarBorradasLocal(borradas);
                return guardarEntregasCloud(entregas, lineas, compras, borradas);
            }).catch(function (err) {
                console.warn('[admin-modulos-cloud] push entregas', err);
            });
        }, 700);
    }

    function programarPushSucursales() {
        if (!canSync()) return;
        if (pushTimers.sucursales) clearTimeout(pushTimers.sucursales);
        pushTimers.sucursales = setTimeout(function () {
            pushTimers.sucursales = null;
            var lineas = leerLocal(KEYS.sucursales);
            leerEntregasCloud().then(function (cloud) {
                var borradas = fusionarBorradas(cloud.borradas);
                // local manda en entregas para que un borrado no reaparezca
                var entregas = filtrarEntregasBorradas(
                    partirEntregas(leerLocal(KEYS.entregas)).entregas,
                    borradas
                );
                var compras = fusionarPorId(leerLocal(KEYS.compras), cloud.compras);
                return guardarEntregasCloud(entregas, lineas, compras, borradas);
            }).catch(function (err) {
                console.warn('[admin-modulos-cloud] push sucursales', err);
            });
        }, 700);
    }

    function tsComprasLocal() {
        try {
            var n = parseInt(localStorage.getItem('obebe_compras_ts_v1') || '0', 10);
            return isNaN(n) ? 0 : n;
        } catch (e) {
            return 0;
        }
    }

    function guardarTsCompras(n) {
        try { localStorage.setItem('obebe_compras_ts_v1', String(n || 0)); } catch (e) { /* ignore */ }
    }

    function comprasMasRecientes(cloud) {
        var localTs = tsComprasLocal();
        var cloudTs = (cloud && cloud.comprasActualizadoEn) || 0;
        if (cloudTs > localTs) {
            guardarTsCompras(cloudTs);
            return cloud.compras || [];
        }
        return leerLocal(KEYS.compras);
    }

    function programarPushCompras() {
        if (!canSync()) return;
        if (pushTimers.compras) clearTimeout(pushTimers.compras);
        pushTimers.compras = setTimeout(function () {
            pushTimers.compras = null;
            var compras = leerLocal(KEYS.compras);
            leerEntregasCloud().then(function (cloud) {
                var borradas = fusionarBorradas(cloud.borradas);
                var entregas = filtrarEntregasBorradas(
                    partirEntregas(leerLocal(KEYS.entregas)).entregas,
                    borradas
                );
                var lineas = fusionarPorId(leerLocal(KEYS.sucursales), cloud.lineas);
                return guardarEntregasCloud(entregas, lineas, compras, borradas);
            }).catch(function (err) {
                console.warn('[admin-modulos-cloud] push compras', err);
            });
        }, 700);
    }

    function marcarEntregaBorrada(id) {
        if (!id) return;
        borradasPendientes[id] = Date.now();
        var map = fusionarBorradas();
        map[id] = borradasPendientes[id];
        guardarBorradasLocal(map);
    }

    function syncCotizador() {
        if (!canSync()) return Promise.resolve(false);
        var Store = global.ObebeCotizadorStore;
        return ObebeAdminBackend.callAdminApi('getAdminModuloBlob', { moduleKey: 'cotizador' })
            .then(asegurarOk)
            .then(function (res) {
                var cloud = Store ? Store.desdePayloadCloud(res.payload) : null;
                var local = Store ? Store.leer() : null;
                var winner = local;
                if (cloud && (!local || (cloud.actualizadoEn || 0) >= (local.actualizadoEn || 0))) {
                    winner = cloud;
                    try {
                        localStorage.setItem(KEYS.cotizador, JSON.stringify(cloud));
                    } catch (e) { /* ignore */ }
                }
                return ObebeAdminBackend.callAdminApi('setAdminModuloBlob', {
                    moduleKey: 'cotizador',
                    payload: Store ? Store.payloadParaCloud(winner) : (res.payload || [])
                }).then(asegurarOk).then(function () { return true; });
            })
            .catch(function (err) {
                // Sin redeploy de admin-api la clave 'cotizador' aún no existe: se usa solo localStorage
                var msg = (err && err.message) ? String(err.message) : String(err);
                if (msg.indexOf('moduleKey no permitido') === -1) {
                    console.warn('[admin-modulos-cloud] sync cotizador', err);
                }
                return false;
            });
    }

    function notifyCotizadorSaved() {
        if (!canSync()) return;
        if (pushTimers.cotizador) clearTimeout(pushTimers.cotizador);
        pushTimers.cotizador = setTimeout(function () {
            pushTimers.cotizador = null;
            var Store = global.ObebeCotizadorStore;
            ObebeAdminBackend.callAdminApi('setAdminModuloBlob', {
                moduleKey: 'cotizador',
                payload: Store ? Store.payloadParaCloud(Store.leer()) : []
            }).catch(function (err) {
                var msg = (err && err.message) ? String(err.message) : String(err);
                if (msg.indexOf('moduleKey no permitido') === -1) {
                    console.warn('[admin-modulos-cloud] push cotizador', err);
                }
            });
        }, 500);
    }

    global.ObebeAdminModulosCloud = {
        canSync: canSync,
        syncApartados: function () { return syncModulo('apartados', KEYS.apartados); },
        syncEntregas: syncEntregasYSucursales,
        syncSucursales: syncEntregasYSucursales,
        syncCompras: syncEntregasYSucursales,
        syncCotizador: syncCotizador,
        notifyApartadosSaved: function () { programarPush('apartados', KEYS.apartados); },
        notifyEntregasSaved: programarPushEntregas,
        notifySucursalesSaved: programarPushSucursales,
        notifyComprasSaved: programarPushCompras,
        notifyCotizadorSaved: notifyCotizadorSaved,
        marcarEntregaBorrada: marcarEntregaBorrada
    };
})(window);
