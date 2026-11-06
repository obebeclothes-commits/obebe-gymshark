(function (global) {
    'use strict';

    var KEYS = {
        apartados: 'obebe_apartados_v1',
        entregas: 'obebe_entregas_v1',
        sucursales: 'obebe_sucursales_v1'
    };

    var SUCURSALES_BLOB_ID = 'obebe-sucursales-blob';

    var pushTimers = {};

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

    function partirEntregas(arr) {
        var entregas = [];
        var lineas = [];
        (arr || []).forEach(function (item) {
            if (esBlobSucursales(item)) {
                if (Array.isArray(item.lineas)) lineas = lineas.concat(item.lineas);
            } else if (item && item.id) {
                entregas.push(item);
            }
        });
        return { entregas: entregas, lineas: lineas };
    }

    function payloadEntregas(entregas, lineas) {
        var out = (entregas || []).filter(function (item) { return item && !esBlobSucursales(item); });
        out.push({
            id: SUCURSALES_BLOB_ID,
            _modulo: 'sucursales',
            lineas: lineas || [],
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

    function guardarEntregasCloud(entregas, lineas) {
        return ObebeAdminBackend.callAdminApi('setAdminModuloBlob', {
            moduleKey: 'entregas',
            payload: payloadEntregas(entregas, lineas)
        }).then(asegurarOk);
    }

    function syncEntregasYSucursales() {
        if (!canSync()) return Promise.resolve(false);
        return leerEntregasCloud().then(function (cloud) {
            var localEntregas = partirEntregas(leerLocal(KEYS.entregas)).entregas;
            var entregas = fusionarPorId(localEntregas, cloud.entregas);
            var lineas = fusionarPorId(leerLocal(KEYS.sucursales), cloud.lineas);
            guardarLocal(KEYS.entregas, entregas);
            guardarLocal(KEYS.sucursales, lineas);
            return guardarEntregasCloud(entregas, lineas);
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
            leerEntregasCloud().then(function (cloud) {
                var lineas = fusionarPorId(leerLocal(KEYS.sucursales), cloud.lineas);
                return guardarEntregasCloud(entregas, lineas);
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
                var entregas = fusionarPorId(
                    partirEntregas(leerLocal(KEYS.entregas)).entregas,
                    cloud.entregas
                );
                return guardarEntregasCloud(entregas, lineas);
            }).catch(function (err) {
                console.warn('[admin-modulos-cloud] push sucursales', err);
            });
        }, 700);
    }

    global.ObebeAdminModulosCloud = {
        canSync: canSync,
        syncApartados: function () { return syncModulo('apartados', KEYS.apartados); },
        syncEntregas: syncEntregasYSucursales,
        syncSucursales: syncEntregasYSucursales,
        notifyApartadosSaved: function () { programarPush('apartados', KEYS.apartados); },
        notifyEntregasSaved: programarPushEntregas,
        notifySucursalesSaved: programarPushSucursales
    };
})(window);
