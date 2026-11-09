(function (global) {
    'use strict';

    var KEY = 'obebe_entregas_v1';
    var KEY_DELETED = 'obebe_entregas_deleted_v1';

    function leerJson(fallback) {
        try {
            var raw = localStorage.getItem(KEY);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    }

    function leerBorradas() {
        try {
            var raw = localStorage.getItem(KEY_DELETED);
            if (!raw) return {};
            var o = JSON.parse(raw);
            return o && typeof o === 'object' ? o : {};
        } catch (e) {
            return {};
        }
    }

    function marcarBorrada(id) {
        if (!id) return;
        var map = leerBorradas();
        map[id] = Date.now();
        try {
            localStorage.setItem(KEY_DELETED, JSON.stringify(map));
        } catch (e) { /* ignore */ }
        if (global.ObebeAdminModulosCloud && ObebeAdminModulosCloud.marcarEntregaBorrada) {
            ObebeAdminModulosCloud.marcarEntregaBorrada(id);
        }
    }

    function guardar(arr) {
        try {
            localStorage.setItem(KEY, JSON.stringify(arr || []));
            if (global.ObebeAdminModulosCloud && ObebeAdminModulosCloud.notifyEntregasSaved) {
                ObebeAdminModulosCloud.notifyEntregasSaved();
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function uid() {
        return 'ent-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    // Entrega zombie que la nube seguía devolviendo
    (function sembrarBorradaFija() {
        var idZombie = 'ent-mw3obctu-dxpgvf';
        var map = leerBorradas();
        if (map[idZombie]) return;
        map[idZombie] = Date.now();
        try { localStorage.setItem(KEY_DELETED, JSON.stringify(map)); } catch (e) { /* ignore */ }
    })();

    function getAll() {
        var arr = leerJson([]);
        if (!Array.isArray(arr)) return [];
        var borradas = leerBorradas();
        return arr.filter(function (e) {
            if (!e || !e.id) return false;
            if (e.id === 'obebe-sucursales-blob' || e.id === 'obebe-compras-blob') return false;
            if (e.id === 'obebe-entregas-deleted-blob') return false;
            if (borradas[e.id]) return false;
            return true;
        });
    }

    function getById(id) {
        return getAll().find(function (e) { return e.id === id; }) || null;
    }

    function saveEntrega(ent) {
        var todos = getAll();
        var idx = todos.findIndex(function (e) { return e.id === ent.id; });
        if (idx >= 0) todos[idx] = ent;
        else todos.unshift(ent);
        guardar(todos);
        return ent;
    }

    function removeEntrega(id) {
        marcarBorrada(id);
        guardar(getAll().filter(function (e) { return e.id !== id; }));
    }

    function listar(estadoFiltro) {
        var list = getAll().slice().sort(function (a, b) {
            return (b.creadoEn || 0) - (a.creadoEn || 0);
        });
        if (estadoFiltro) {
            list = list.filter(function (e) { return e.estado === estadoFiltro; });
        }
        return list;
    }

    function cantidadReservadaPorFila(filaSheet, exceptoEntregaId) {
        var sum = 0;
        getAll().forEach(function (e) {
            if (e.estado !== 'pendiente') return;
            if (exceptoEntregaId && e.id === exceptoEntregaId) return;
            (e.items || []).forEach(function (it) {
                if (it.filaSheet === filaSheet) sum += it.cantidad || 1;
            });
        });
        return sum;
    }

    global.ObebeEntregasStore = {
        getAll: getAll,
        getById: getById,
        saveEntrega: saveEntrega,
        removeEntrega: removeEntrega,
        listar: listar,
        cantidadReservadaPorFila: cantidadReservadaPorFila,
        uid: uid,
        leerBorradas: leerBorradas
    };
})(window);
