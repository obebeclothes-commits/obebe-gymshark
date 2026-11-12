(function (global) {
    'use strict';

    var KEY = 'obebe_compras_early_access_v1';

    function leer() {
        try {
            var raw = localStorage.getItem(KEY);
            if (!raw) return {};
            var o = JSON.parse(raw);
            return o && typeof o === 'object' ? o : {};
        } catch (e) {
            return {};
        }
    }

    function guardar(map) {
        try {
            localStorage.setItem(KEY, JSON.stringify(map || {}));
            return true;
        } catch (e) {
            return false;
        }
    }

    function refsDesdeFilas(filas) {
        var idx = global.ObebeAdminData && ObebeAdminData.idxInventario
            ? ObebeAdminData.idxInventario()
            : { imagen: 0 };
        var col = idx.imagen != null ? idx.imagen : 0;
        var out = [];
        (filas || []).forEach(function (f) {
            var r = parseInt(f.celdas && f.celdas[col], 10);
            if (!isNaN(r) && r > 0) out.push(r);
        });
        return out;
    }

    function marcarRefs(refs) {
        var map = leer();
        var t = Date.now();
        (refs || []).forEach(function (ref) {
            map[String(ref)] = t;
        });
        guardar(map);
    }

    function quitarRefs(refs) {
        var map = leer();
        var dirty = false;
        (refs || []).forEach(function (ref) {
            var k = String(ref);
            if (map[k]) {
                delete map[k];
                dirty = true;
            }
        });
        if (dirty) guardar(map);
    }

    function tieneRef(ref) {
        if (ref == null || ref === '') return false;
        return !!leer()[String(ref)];
    }

    function esEarlyAccessFila(fila) {
        if (!fila) return false;
        return tieneRef(fila.ref);
    }

    global.ObebeComprasEarlyStore = {
        marcarRefs: marcarRefs,
        quitarRefs: quitarRefs,
        refsDesdeFilas: refsDesdeFilas,
        tieneRef: tieneRef,
        esEarlyAccessFila: esEarlyAccessFila,
        leerTodos: leer
    };
})(window);
