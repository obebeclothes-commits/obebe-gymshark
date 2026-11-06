(function (global) {
    'use strict';

    var KEY = 'obebe_compras_v1';
    var NUM = 29;

    function leerJson() {
        try {
            var raw = localStorage.getItem(KEY);
            if (!raw) return [];
            var arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function guardar(arr) {
        try {
            localStorage.setItem(KEY, JSON.stringify(arr || []));
            localStorage.setItem('obebe_compras_ts_v1', String(Date.now()));
            if (global.ObebeAdminModulosCloud && ObebeAdminModulosCloud.notifyComprasSaved) {
                ObebeAdminModulosCloud.notifyComprasSaved();
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function uid() {
        return 'com-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    function celdasVacias() {
        var out = [];
        var i;
        for (i = 0; i < NUM; i++) out.push('');
        return out;
    }

    function normalizar(row) {
        row = row || {};
        var celdas = celdasVacias();
        var src = Array.isArray(row.celdas) ? row.celdas : [];
        var i;
        for (i = 0; i < NUM; i++) celdas[i] = src[i] == null ? '' : String(src[i]);
        return {
            id: row.id || uid(),
            celdas: celdas,
            actualizadoEn: row.actualizadoEn || Date.now()
        };
    }

    function getAll() {
        return leerJson().map(normalizar);
    }

    function reemplazar(arr) {
        guardar((arr || []).map(normalizar));
        return getAll();
    }

    function absorberDetectadas(lista) {
        lista = lista || (global.OBEBE_COMPRAS_DETECTADAS || []);
        if (!Array.isArray(lista) || !lista.length) return 0;
        var todos = getAll();
        var refs = {};
        todos.forEach(function (r) {
            var ref = String(r.celdas[0] || '').trim();
            if (ref) refs[ref] = true;
        });
        var n = 0;
        lista.forEach(function (row) {
            var norm = normalizar(row);
            var ref = String(norm.celdas[0] || '').trim();
            if (!ref || refs[ref]) return;
            refs[ref] = true;
            norm.actualizadoEn = Date.now();
            todos.push(norm);
            n += 1;
        });
        if (n) guardar(todos);
        return n;
    }

    global.ObebeComprasStore = {
        getAll: getAll,
        reemplazar: reemplazar,
        absorberDetectadas: absorberDetectadas,
        guardar: guardar
    };
})(window);
