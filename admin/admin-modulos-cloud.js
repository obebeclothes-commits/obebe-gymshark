(function (global) {
    'use strict';

    var KEYS = {
        apartados: 'obebe_apartados_v1',
        entregas: 'obebe_entregas_v1'
    };

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

    global.ObebeAdminModulosCloud = {
        canSync: canSync,
        syncApartados: function () { return syncModulo('apartados', KEYS.apartados); },
        syncEntregas: function () { return syncModulo('entregas', KEYS.entregas); },
        notifyApartadosSaved: function () { programarPush('apartados', KEYS.apartados); },
        notifyEntregasSaved: function () { programarPush('entregas', KEYS.entregas); }
    };
})(window);
