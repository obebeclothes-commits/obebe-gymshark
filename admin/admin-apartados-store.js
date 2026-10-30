(function (global) {
    'use strict';

    var KEY = 'obebe_apartados_v1';

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
            return true;
        } catch (e) {
            return false;
        }
    }

    function uid() {
        return 'ap-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    function parseMonto(n) {
        var v = parseFloat(String(n == null ? '' : n).replace(/,/g, '.').replace(/[^\d.-]/g, ''));
        return isNaN(v) ? 0 : Math.round(v * 100) / 100;
    }

    function totalPagado(apartado) {
        var sum = 0;
        (apartado && apartado.pagos || []).forEach(function (p) {
            sum += parseMonto(p.monto);
        });
        return Math.round(sum * 100) / 100;
    }

    function saldoPendiente(apartado) {
        var total = parseMonto(apartado && apartado.totalAPagar);
        var pag = totalPagado(apartado);
        return Math.max(0, Math.round((total - pag) * 100) / 100);
    }

    function estadoCalculado(apartado) {
        if (!apartado) return 'activo';
        if (apartado.estado === 'cancelado') return 'cancelado';
        if (apartado.liquidadoManual) return 'completado';
        if (!apartado.sinAutoLiquidado && saldoPendiente(apartado) <= 0 &&
            parseMonto(apartado.totalAPagar) > 0) {
            return 'completado';
        }
        return 'activo';
    }

    function getAll() {
        var arr = leerJson([]);
        return Array.isArray(arr) ? arr : [];
    }

    function getById(id) {
        return getAll().find(function (a) { return a.id === id; }) || null;
    }

    function saveApartado(apartado) {
        if (!apartado || !apartado.id) return null;
        apartado.actualizadoEn = Date.now();
        apartado.estado = estadoCalculado(apartado);
        if (apartado.estado === 'completado' && !apartado.completadoEn) {
            apartado.completadoEn = Date.now();
        }
        var todos = getAll();
        var idx = todos.findIndex(function (a) { return a.id === apartado.id; });
        if (idx >= 0) todos[idx] = apartado;
        else todos.unshift(apartado);
        guardar(todos);
        return apartado;
    }

    function prendaId() {
        return 'pr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    }

    function normalizarPrenda(p) {
        p = p || {};
        return {
            id: p.id || prendaId(),
            nombre: String(p.nombre || '').trim(),
            marca: String(p.marca || '').trim(),
            color: String(p.color || '').trim(),
            talla: String(p.talla || '').trim(),
            inventarioId: String(p.inventarioId || '').trim(),
            filaSheet: parseInt(p.filaSheet, 10) || 0,
            cantidad: parseInt(p.cantidad, 10) > 0 ? parseInt(p.cantidad, 10) : 1,
            precio: parseMonto(p.precio),
            stockRecibido: !!p.stockRecibido,
            stockRecibidoEn: p.stockRecibidoEn || null,
            entregada: !!p.entregada,
            entregadaEn: p.entregadaEn || null
        };
    }

    function crearApartado(datos) {
        datos = datos || {};
        var ent = {
            id: uid(),
            cliente: String(datos.cliente || '').trim(),
            clienteId: String(datos.clienteId || '').trim(),
            totalAPagar: parseMonto(datos.totalAPagar),
            prendas: (datos.prendas || []).map(normalizarPrenda).filter(function (p) { return p.nombre; }),
            pagos: [],
            telefono: String(datos.telefono || '').trim(),
            redSocial: String(datos.redSocial || '').trim(),
            link: String(datos.link || '').trim(),
            notas: String(datos.notas || '').trim(),
            estado: 'activo',
            liquidadoManual: false,
            sinAutoLiquidado: false,
            entregadoEn: null,
            creadoEn: Date.now(),
            actualizadoEn: Date.now()
        };
        return saveApartado(ent);
    }

    function updatePrenda(apartadoId, prendaId, patch) {
        var ap = getById(apartadoId);
        if (!ap || !prendaId) return null;
        ap.prendas = (ap.prendas || []).map(function (p) {
            if (p.id !== prendaId) return p;
            return normalizarPrenda(Object.assign({}, p, patch || {}));
        });
        var todasEnt = ap.prendas.length && ap.prendas.every(function (p) { return p.entregada; });
        if (todasEnt) ap.entregadoEn = ap.entregadoEn || Date.now();
        return saveApartado(ap);
    }

    function getPrenda(apartadoId, prendaId) {
        var ap = getById(apartadoId);
        if (!ap) return null;
        return (ap.prendas || []).find(function (p) { return p.id === prendaId; }) || null;
    }

    function agregarPago(apartadoId, pago) {
        var ap = getById(apartadoId);
        if (!ap) return null;
        pago = pago || {};
        ap.pagos = ap.pagos || [];
        ap.pagos.unshift({
            id: 'pg-' + Date.now().toString(36),
            fechaRaw: String(pago.fechaRaw || '').trim(),
            monto: parseMonto(pago.monto),
            cuenta: String(pago.cuenta || '').trim(),
            vendedor: String(pago.vendedor || '').trim(),
            ventaId: pago.ventaId || 0,
            creadoEn: Date.now()
        });
        return saveApartado(ap);
    }

    function marcarEstado(id, estado) {
        var ap = getById(id);
        if (!ap) return null;
        if (estado === 'completado') {
            ap.liquidadoManual = true;
            ap.sinAutoLiquidado = false;
            ap.completadoEn = Date.now();
        } else if (estado === 'cancelado') {
            ap.canceladoEn = Date.now();
        }
        ap.estado = estado;
        return saveApartado(ap);
    }

    function desliquidar(id) {
        var ap = getById(id);
        if (!ap) return null;
        ap.liquidadoManual = false;
        ap.sinAutoLiquidado = true;
        ap.completadoEn = null;
        ap.estado = 'activo';
        return saveApartado(ap);
    }

    function removeApartado(id) {
        guardar(getAll().filter(function (a) { return a.id !== id; }));
    }

    function listar(filtroEstado) {
        var list = getAll().slice().sort(function (a, b) {
            return (b.creadoEn || 0) - (a.creadoEn || 0);
        });
        if (!filtroEstado || filtroEstado === 'todos') return list;
        return list.filter(function (a) {
            return estadoCalculado(a) === filtroEstado;
        });
    }

    global.ObebeApartadosStore = {
        getAll: getAll,
        getById: getById,
        saveApartado: saveApartado,
        crearApartado: crearApartado,
        agregarPago: agregarPago,
        marcarEstado: marcarEstado,
        desliquidar: desliquidar,
        removeApartado: removeApartado,
        listar: listar,
        totalPagado: totalPagado,
        saldoPendiente: saldoPendiente,
        estadoCalculado: estadoCalculado,
        parseMonto: parseMonto,
        uid: uid,
        normalizarPrenda: normalizarPrenda,
        updatePrenda: updatePrenda,
        getPrenda: getPrenda
    };
})(window);
