(function (global) {
    'use strict';

    var KEY = 'obebe_sucursales_v1';

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
            if (global.ObebeAdminModulosCloud && ObebeAdminModulosCloud.notifySucursalesSaved) {
                ObebeAdminModulosCloud.notifySucursalesSaved();
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function uid() {
        return 'suc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    function getAll() {
        var arr = leerJson([]);
        return Array.isArray(arr) ? arr : [];
    }

    function getById(id) {
        return getAll().find(function (e) { return e.id === id; }) || null;
    }

    function listarPorSucursal(sucursalId) {
        return getAll().filter(function (e) {
            return e.sucursalId === sucursalId && (e.cantidad || 0) > 0;
        }).sort(function (a, b) {
            return (b.actualizadoEn || b.creadoEn || 0) - (a.actualizadoEn || a.creadoEn || 0);
        });
    }

    function agregarOIncrementar(payload) {
        payload = payload || {};
        var todos = getAll();
        var sid = payload.sucursalId;
        var filaSheet = parseInt(payload.filaSheet, 10);
        var add = parseInt(payload.cantidad, 10) || 0;
        if (!sid || !filaSheet || add <= 0) return null;
        var dbId = parseInt(payload.inventarioDbId, 10) || 0;
        var idx = todos.findIndex(function (e) {
            if (e.sucursalId !== sid) return false;
            if (dbId && (e.inventarioDbId === dbId || e.filaSheet === dbId)) return true;
            return e.filaSheet === filaSheet;
        });
        var now = Date.now();
        if (idx >= 0) {
            todos[idx].cantidad = (todos[idx].cantidad || 0) + add;
            todos[idx].actualizadoEn = now;
            if (dbId) todos[idx].inventarioDbId = dbId;
            if (payload.precioUnitario != null) todos[idx].precioUnitario = payload.precioUnitario;
            if (payload.imagenUrl) todos[idx].imagenUrl = payload.imagenUrl;
            guardar(todos);
            return todos[idx];
        }
        var ent = {
            id: uid(),
            sucursalId: sid,
            filaSheet: filaSheet,
            inventarioDbId: dbId,
            ref: payload.ref || 0,
            nombre: String(payload.nombre || '').trim(),
            talla: String(payload.talla || '').trim(),
            color: String(payload.color || '').trim(),
            tipo: String(payload.tipo || '').trim(),
            marca: String(payload.marca || '').trim(),
            segmento: String(payload.segmento || '').trim(),
            precioUnitario: payload.precioUnitario != null ? payload.precioUnitario : 0,
            imagenUrl: String(payload.imagenUrl || '').trim(),
            cantidad: add,
            stockDescontado: true,
            creadoEn: now,
            actualizadoEn: now
        };
        todos.unshift(ent);
        guardar(todos);
        return ent;
    }

    function normTxt(s) {
        return String(s || '').trim().toLowerCase();
    }

    function filaParaLinea(line, filas) {
        var sheet = parseInt(line.filaSheet, 10);
        var db = line.inventarioDbId;
        var i;
        for (i = 0; i < filas.length; i++) {
            var f = filas[i];
            if (db && f.inventarioDbId === db) return f;
            if (sheet && (f.filaSheet === sheet || f.inventarioDbId === sheet)) return f;
        }
        var nombre = normTxt(line.nombre);
        var talla = normTxt(line.talla);
        var color = normTxt(line.color);
        if (!nombre) return null;
        var hits = [];
        for (i = 0; i < filas.length; i++) {
            var f2 = filas[i];
            if (normTxt(f2.nombre) !== nombre) continue;
            if (talla && normTxt(f2.talla) !== talla) continue;
            if (color && normTxt(f2.color) !== color) continue;
            hits.push(f2);
        }
        return hits.length === 1 ? hits[0] : null;
    }

    function sincronizarConInventario(filas) {
        filas = filas || [];
        if (!filas.length) return getAll();
        var todos = getAll();
        var changed = false;
        var now = Date.now();
        todos.forEach(function (line) {
            var f = filaParaLinea(line, filas);
            if (!f) return;
            var lineChanged = false;
            if (f.inventarioDbId && line.inventarioDbId !== f.inventarioDbId) {
                line.inventarioDbId = f.inventarioDbId;
                lineChanged = true;
            }
            if (f.filaSheet && line.filaSheet !== f.filaSheet) {
                line.filaSheet = f.filaSheet;
                lineChanged = true;
            }
            ['nombre', 'talla', 'color', 'tipo', 'marca'].forEach(function (k) {
                if (f[k] && line[k] !== f[k]) {
                    line[k] = f[k];
                    lineChanged = true;
                }
            });
            if (lineChanged) {
                line.actualizadoEn = now;
                changed = true;
            }
        });
        if (changed) guardar(todos);
        return todos;
    }

    function fijarCantidad(id, qty) {
        qty = parseInt(qty, 10);
        if (isNaN(qty) || qty < 0) return { ok: false, error: 'Cantidad inválida.' };
        var todos = getAll();
        var idx = todos.findIndex(function (e) { return e.id === id; });
        if (idx < 0) return { ok: false, error: 'Línea no encontrada.' };
        if (qty <= 0) {
            todos.splice(idx, 1);
            guardar(todos);
            return { ok: true, linea: null };
        }
        todos[idx].cantidad = qty;
        todos[idx].actualizadoEn = Date.now();
        guardar(todos);
        return { ok: true, linea: todos[idx] };
    }

    function marcarStockDescontado(id) {
        var todos = getAll();
        var idx = todos.findIndex(function (e) { return e.id === id; });
        if (idx < 0) return null;
        if (todos[idx].stockDescontado) return todos[idx];
        todos[idx].stockDescontado = true;
        todos[idx].actualizadoEn = Date.now();
        guardar(todos);
        return todos[idx];
    }

    function lineaCoincideFilaInventario(line, fila) {
        if (!line || !fila) return false;
        var db = parseInt(fila.inventarioDbId, 10);
        var sheet = parseInt(fila.filaSheet, 10);
        var ldb = parseInt(line.inventarioDbId, 10);
        var lsh = parseInt(line.filaSheet, 10);
        if (ldb && (fila.inventarioDbId === ldb || fila.filaSheet === ldb)) return true;
        if (lsh && (fila.filaSheet === lsh || fila.inventarioDbId === lsh)) return true;
        return false;
    }

    /** Piezas en sucursal que aún no se descontaron del inventario principal (evita doble conteo). */
    function reservadoSucursalSinDescontar(fila) {
        var total = 0;
        getAll().forEach(function (line) {
            if ((line.cantidad || 0) <= 0) return;
            if (line.stockDescontado) return;
            if (lineaCoincideFilaInventario(line, fila)) total += line.cantidad;
        });
        return total;
    }

    function stockDisponibleInventarioPrincipal(fila) {
        var stock = (fila && fila.stock) || 0;
        return Math.max(0, stock - reservadoSucursalSinDescontar(fila));
    }

    function reducirCantidad(id, qty) {
        qty = parseInt(qty, 10) || 0;
        if (qty <= 0) return { ok: false, error: 'Cantidad inválida.' };
        var todos = getAll();
        var idx = todos.findIndex(function (e) { return e.id === id; });
        if (idx < 0) return { ok: false, error: 'Línea no encontrada.' };
        var line = todos[idx];
        if ((line.cantidad || 0) < qty) {
            return { ok: false, error: 'No hay suficientes piezas en la sucursal.' };
        }
        line.cantidad -= qty;
        line.actualizadoEn = Date.now();
        if (line.cantidad <= 0) todos.splice(idx, 1);
        else todos[idx] = line;
        guardar(todos);
        return { ok: true, linea: line.cantidad > 0 ? line : null, vendidas: qty };
    }

    global.ObebeSucursalesStore = {
        getAll: getAll,
        getById: getById,
        listarPorSucursal: listarPorSucursal,
        agregarOIncrementar: agregarOIncrementar,
        reducirCantidad: reducirCantidad,
        fijarCantidad: fijarCantidad,
        marcarStockDescontado: marcarStockDescontado,
        sincronizarConInventario: sincronizarConInventario,
        stockDisponibleInventarioPrincipal: stockDisponibleInventarioPrincipal,
        reservadoSucursalSinDescontar: reservadoSucursalSinDescontar
    };
})(window);
