(function (global) {
    'use strict';

    var KEY = 'obebe_entregas_v1';

    function leerJson(fallback) {
        try {
            var raw = localStorage.getItem(KEY);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
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

    function getAll() {
        var arr = leerJson([]);
        return Array.isArray(arr) ? arr : [];
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
        uid: uid
    };
})(window);
