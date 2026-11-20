(function (global) {
    'use strict';

    var KEY = 'obebe_mayoreo_pedidos_v1';
    var KEY_EMPAQUE_OBE = 'obebe_mayoreo_empaque_obebe_v1';
    var PEDIDO_NATY_LEGACY_ID = 'mp-naty-pedido-20261017';
    var FECHA_PEDIDO_NATY_LEGACY = '2026-10-17';
    var PEDIDO_NATY_2_ID = 'mp-naty-pedido-20261029';
    var FECHA_PEDIDO_NATY_2 = '2026-10-29';
    var KEY_LEGACY_NATY_VENTA_MARCADA = 'obebe_mayoreo_naty_1710_venta_marcada_v1';

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

    function norm(s) {
        return String(s || '').trim().toLowerCase();
    }

    function claveCliente(nombre) {
        return norm(nombre) || 'naty';
    }

    function uid(prefix) {
        return (prefix || 'mp-') + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    function tocarPedido(p, origen) {
        if (!p) return p;
        var t = Date.now();
        p.pedidoActualizadoEn = t;
        if (origen === 'cliente') p.clienteEditadoEn = t;
        else if (origen === 'obebe') p.obebeEditadoEn = t;
        return p;
    }

    function migrarPedido(p) {
        if (!p) return p;
        p.items = normalizarItems(p.items);
        if (p.estado === 'confirmado' && !p.revisadoEn && todosItemsMarcados(p)) {
            p.estado = 'revisado';
            p.revisadoEn = p.revisadoEn || Date.now();
        }
        if (!p.pedidoActualizadoEn) {
            p.pedidoActualizadoEn = Math.max(
                Number(p.clienteEditadoEn || 0),
                Number(p.obebeEditadoEn || 0),
                Number(p.revisadoEn || 0),
                Number(p.creadoEn || 0)
            );
        }
        return p;
    }

    function getPedidos() {
        var arr = leerJson(KEY, []);
        if (!Array.isArray(arr)) return [];
        var dirty = false;
        arr = arr.map(function (p) {
            var antes = JSON.stringify(p.items);
            p = migrarPedido(p);
            if (JSON.stringify(p.items) !== antes) dirty = true;
            return p;
        });
        if (dirty) setPedidos(arr);
        if (migrarEmpaqueLegacyAPedidos(arr)) setPedidos(arr);
        return arr;
    }

    function migrarEmpaqueLegacyAPedidos(arr) {
        var m = leerMapaEmpaqueObebe();
        var mapDirty = false;
        var pedidosDirty = false;
        (arr || []).forEach(function (p) {
            (p.items || []).forEach(function (it) {
                var total = cantidadItemParaEmpaque(it);
                var k = claveEmpaqueObebe(p.id, it.itemId);
                var rec = m[k];
                var nItem = it.empaquetadoObebe != null && it.empaquetadoObebe !== ''
                    ? Math.max(0, parseInt(it.empaquetadoObebe, 10) || 0) : null;
                if (rec && rec.n != null) {
                    var nLeg = Math.max(0, parseInt(rec.n, 10) || 0);
                    var nUse = Math.min(total, nItem == null ? nLeg : Math.max(nItem, nLeg));
                    if (nUse > 0) {
                        if (nItem !== nUse) {
                            it.empaquetadoObebe = nUse;
                            pedidosDirty = true;
                        }
                    } else if (it.empaquetadoObebe != null) {
                        delete it.empaquetadoObebe;
                        pedidosDirty = true;
                    }
                    delete m[k];
                    mapDirty = true;
                } else if (nItem != null) {
                    var clamped = Math.min(total, nItem);
                    if (clamped <= 0) {
                        delete it.empaquetadoObebe;
                        pedidosDirty = true;
                    } else if (clamped !== nItem) {
                        it.empaquetadoObebe = clamped;
                        pedidosDirty = true;
                    }
                }
            });
        });
        if (mapDirty) guardarMapaEmpaqueObebe(m);
        return pedidosDirty;
    }

    function setPedidos(arr) {
        guardarJson(KEY, arr || []);
        if (global.ObebeAdminMayoreoCloud && ObebeAdminMayoreoCloud.notifyMayoreoNatySaved) {
            ObebeAdminMayoreoCloud.notifyMayoreoNatySaved();
        }
    }

    function findPedido(pedidoId) {
        var todos = getPedidos();
        var idx = todos.findIndex(function (p) { return p.id === pedidoId; });
        if (idx < 0) return { idx: -1, pedido: null, todos: todos };
        return { idx: idx, pedido: todos[idx], todos: todos };
    }

    function esPedidoVisibleLista(p) {
        return !!(p && p.estado !== 'combinado');
    }

    function pedidoEsCombinable(p) {
        if (!p || p.id === PEDIDO_NATY_LEGACY_ID || p.legacyDesdeInventario) return false;
        if (p.ventaRetailRegistradaEn || p.inventarioAplicado) return false;
        return p.estado === 'pendiente' || p.estado === 'en_revision';
    }

    function tsPedidoMayoreoLocal(p) {
        if (!p) return 0;
        return Math.max(
            Number(p.pedidoActualizadoEn || 0),
            Number(p.clienteEditadoEn || 0),
            Number(p.obebeEditadoEn || 0),
            Number(p.revisadoEn || 0),
            Number(p.creadoEn || 0)
        );
    }

    function elegirMejorPedidoNaty2910(a, b) {
        if (!a) return b;
        if (!b) return a;
        var ta = tsPedidoMayoreoLocal(a);
        var tb = tsPedidoMayoreoLocal(b);
        if (tb > ta) return b;
        if (ta > tb) return a;
        var ua = contarUnidadesPedido(a);
        var ub = contarUnidadesPedido(b);
        if (ub > ua) return b;
        if (ua > ub) return a;
        var ca = (a.items || []).length;
        var cb = (b.items || []).length;
        return cb > ca ? b : a;
    }

    /** Varios pedidos del 29/10 → uno solo (el más completo / reciente) con id canónico. */
    function unificarPedidosNaty2910EnCanon() {
        var todos = leerJson(KEY, []);
        if (!Array.isArray(todos) || !todos.length) return { ok: true, omitido: true };
        var candidatos = todos.filter(function (p) {
            if (claveCliente(p.clienteKey) !== 'naty') return false;
            if (p.estado === 'combinado') return false;
            if (p.id === PEDIDO_NATY_LEGACY_ID) return false;
            if (p.id === PEDIDO_NATY_2_ID) return true;
            return fechaLocalIsoDesdeMs(p.creadoEn) === FECHA_PEDIDO_NATY_2;
        });
        if (candidatos.length < 2 && candidatos.length === 1 && candidatos[0].id === PEDIDO_NATY_2_ID) {
            return { ok: true, omitido: true, unico: true };
        }
        if (!candidatos.length) return { ok: true, omitido: true };
        var mejor = candidatos[0];
        var i;
        for (i = 1; i < candidatos.length; i++) {
            mejor = elegirMejorPedidoNaty2910(mejor, candidatos[i]);
        }
        var prevCanon = todos.find(function (p) { return p.id === PEDIDO_NATY_2_ID; }) || null;
        if (prevCanon && prevCanon.id !== mejor.id) {
            mejor = elegirMejorPedidoNaty2910(prevCanon, mejor);
        }
        var fusion = Object.assign({}, mejor);
        fusion.id = PEDIDO_NATY_2_ID;
        fusion.clienteKey = 'naty';
        fusion.clienteNombre = fusion.clienteNombre || 'NATY';
        if (!fusion.creadoEn) fusion.creadoEn = timestampLocal(2026, 10, 29);
        fusion.items = normalizarItems(fusion.items || []);
        recalcTotalesPedido(fusion);
        var quitar = {};
        candidatos.forEach(function (p) {
            if (p.id !== PEDIDO_NATY_2_ID) quitar[p.id] = true;
        });
        var idx = todos.findIndex(function (p) { return p.id === PEDIDO_NATY_2_ID; });
        if (idx >= 0) todos[idx] = fusion;
        else todos.unshift(fusion);
        todos = todos.filter(function (p) { return !quitar[p.id]; });
        setPedidos(todos);
        return { ok: true, items: (fusion.items || []).length, unidades: fusion.unidades };
    }

    function asegurarPedidosNatySiFaltan() {
        var todos = leerJson(KEY, []);
        var tiene2910 = (todos || []).some(function (p) {
            return p.id === PEDIDO_NATY_2_ID && (p.items || []).length;
        });
        var tiene1710 = (todos || []).some(function (p) {
            return p.id === PEDIDO_NATY_LEGACY_ID && (p.items || []).length;
        });
        if (!tiene1710) asegurarPedidoNatyLegacy20261017();
        if (!tiene2910) asegurarPedidoNatySegundo20261029();
    }

    function pedidosForCliente(clienteKey) {
        var k = claveCliente(clienteKey);
        return getPedidos()
            .filter(function (p) {
                if (claveCliente(p.clienteKey) !== k) return false;
                if (p.estado === 'combinado') return true;
                return esPedidoVisibleLista(p);
            })
            .sort(function (a, b) { return (b.creadoEn || 0) - (a.creadoEn || 0); });
    }

    function listarTodos(filtroClienteKey) {
        var list = getPedidos().filter(esPedidoVisibleLista).slice().sort(function (a, b) {
            return (b.creadoEn || 0) - (a.creadoEn || 0);
        });
        if (filtroClienteKey) {
            var k = claveCliente(filtroClienteKey);
            list = list.filter(function (p) { return claveCliente(p.clienteKey) === k; });
        }
        return list;
    }

    function normalizarItems(items) {
        return (items || []).map(function (it) {
            var copy = Object.assign({}, it);
            if (!copy.itemId) copy.itemId = uid('li-');
            if (copy.disponibilidad == null) copy.disponibilidad = null;
            var cq = Math.max(1, parseInt(copy.cantidad, 10) || 1);
            copy.cantidad = cq;
            if (!copy.cantidadSolicitada) copy.cantidadSolicitada = cq;
            return copy;
        });
    }

    function stockInventarioItem(it, filasInv) {
        filasInv = filasInv || [];
        if (!it || !global.ObebeAdminData || !it.inventarioId) return 0;
        var id = it.inventarioId;
        var i;
        for (i = 0; i < filasInv.length; i++) {
            if (ObebeAdminData.idFilaInventario(filasInv[i]) === id) {
                var s = parseInt(filasInv[i].stock, 10);
                return !isNaN(s) && s >= 0 ? s : 0;
            }
        }
        return 0;
    }

    function actualizarCantidadItemPedido(pedidoId, itemId, cantidad, filasInv) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return { ok: false, error: 'Pedido no encontrado.' };
        var p = hit.pedido;
        if (p.estado === 'revisado' || p.estado === 'cancelado') {
            return { ok: false, error: 'Este pedido ya no admite cambiar cantidades.' };
        }
        var item = (p.items || []).find(function (it) { return it.itemId === itemId; });
        if (!item) return { ok: false, error: 'Artículo no encontrado.' };
        if (item.disponibilidad === 'no') {
            return { ok: false, error: 'No puedes ajustar cantidad en artículos marcados como No hay.' };
        }
        if (item.cantidadSolicitada == null || item.cantidadSolicitada === undefined) {
            item.cantidadSolicitada = Math.max(1, parseInt(item.cantidad, 10) || 1);
        }
        var tope = Math.max(1, parseInt(item.cantidadSolicitada, 10) || 1);
        var stock = stockInventarioItem(item, filasInv);
        if (item.disponibilidad === 'si' && stock > 0) tope = Math.min(tope, stock);
        var n = Math.max(1, parseInt(cantidad, 10) || 1);
        if (n > tope) n = tope;
        item.cantidad = n;
        var empPrev = empaquetadoObebeItem(pedidoId, itemId);
        if (empPrev > n) {
            ajustarEmpaquetadoObebeItem(pedidoId, itemId, n - empPrev);
        }
        recalcularPreciosPedido(p, filasInv);
        tocarPedido(p, 'obebe');
        hit.todos[hit.idx] = p;
        setPedidos(hit.todos);
        return { ok: true, pedido: p, cantidad: n };
    }

    function refsDesdeItemsPedido(items) {
        var refs = [];
        (items || []).forEach(function (it) {
            var r = parseInt(it.ref, 10);
            if (!isNaN(r) && r > 0) refs.push(r);
        });
        return refs;
    }

    function bajarEarlyAccessPorItemsPedido(items) {
        if (!global.ObebeComprasEarlyStore) return { ok: true, refs: 0 };
        var refs = refsDesdeItemsPedido(items).filter(function (r) {
            return ObebeComprasEarlyStore.tieneRef(r);
        });
        if (!refs.length) return { ok: true, refs: 0 };
        ObebeComprasEarlyStore.quitarRefs(refs);
        if (global.ObebeComprasStore) {
            var idx = global.ObebeAdminData && ObebeAdminData.idxInventario
                ? ObebeAdminData.idxInventario() : { imagen: 0 };
            var col = idx.imagen != null ? idx.imagen : 0;
            var refSet = {};
            refs.forEach(function (r) { refSet[r] = true; });
            var filas = ObebeComprasStore.getAll();
            var dirty = false;
            filas.forEach(function (f) {
                var r = parseInt(f.celdas && f.celdas[col], 10);
                if (refSet[r] && f.earlyAccess) {
                    f.earlyAccess = false;
                    f.earlyAccessEn = null;
                    f.earlyAccessSuspendidoPorPedido = true;
                    dirty = true;
                }
            });
            if (dirty) ObebeComprasStore.reemplazar(filas);
        }
        return { ok: true, refs: refs.length };
    }

    /** Al cancelar/borrar pedido: artículos de Compras vuelven a tabla 2 (early access confirmado). */
    function restaurarEarlyAccessPorItemsPedido(items) {
        var refs = refsDesdeItemsPedido(items);
        if (!refs.length || !global.ObebeComprasStore) return { ok: true, refs: 0 };
        var idx = global.ObebeAdminData && ObebeAdminData.idxInventario
            ? ObebeAdminData.idxInventario() : { imagen: 0 };
        var col = idx.imagen != null ? idx.imagen : 0;
        var refSet = {};
        refs.forEach(function (r) { refSet[r] = true; });
        var filasC = ObebeComprasStore.getAll();
        var dirty = false;
        var restauradas = [];
        var t = Date.now();
        filasC.forEach(function (f) {
            if (f.enTienda) return;
            var r = parseInt(f.celdas && f.celdas[col], 10);
            if (isNaN(r) || !refSet[r]) return;
            if (!f.earlyAccessSuspendidoPorPedido) return;
            f.earlyAccess = true;
            f.earlyAccessEn = f.earlyAccessEn || t;
            f.earlyAccessSuspendidoPorPedido = false;
            dirty = true;
            restauradas.push(r);
        });
        if (dirty) ObebeComprasStore.reemplazar(filasC);
        if (global.ObebeComprasEarlyStore && restauradas.length) {
            ObebeComprasEarlyStore.marcarRefs(restauradas);
        }
        if (dirty && typeof document !== 'undefined') {
            try {
                document.dispatchEvent(new CustomEvent('obebe-compras-early-access'));
            } catch (e) { /* ignore */ }
        }
        return { ok: true, refs: restauradas.length };
    }

    /** Pedido 17/10/2026 (94 pzas.): venta ya hecha en Ventas; solo marcar sin volver a registrar. */
    function marcarVentaConfirmadaPedidoLegacyNaty1710() {
        try {
            if (localStorage.getItem(KEY_LEGACY_NATY_VENTA_MARCADA)) {
                return { ok: true, omitido: true };
            }
        } catch (e) { /* ignore */ }
        var hit = findPedido(PEDIDO_NATY_LEGACY_ID);
        if (hit.idx < 0) return { ok: true, omitido: true, sinPedido: true };
        var p = hit.pedido;
        if (p.ventaRetailRegistradaEn) {
            try { localStorage.setItem(KEY_LEGACY_NATY_VENTA_MARCADA, String(Date.now())); } catch (e2) { /* */ }
            return { ok: true, omitido: true, yaMarcado: true };
        }
        var tsVenta = timestampLocal(2026, 10, 17);
        p.ventaRetailRegistradaEn = tsVenta;
        p.ventaRetailSoloMarcada = true;
        p.estado = 'revisado';
        p.revisadoEn = p.revisadoEn || tsVenta;
        p.stockInventarioObebeAplicado = true;
        hit.todos[hit.idx] = p;
        setPedidos(hit.todos);
        try { localStorage.setItem(KEY_LEGACY_NATY_VENTA_MARCADA, String(Date.now())); } catch (e3) { /* */ }
        return { ok: true, pedido: p };
    }

    function registrarPedido(payload) {
        payload = payload || {};
        var items = normalizarItems(payload.items);
        if (!items.length) return { ok: false, error: 'Agrega al menos un artículo.' };
        var unidades = 0;
        var totalRetail = 0;
        var totalCliente = 0;
        items.forEach(function (it) {
            var q = it.cantidad || 1;
            unidades += q;
            totalRetail += (it.precioRetail || 0) * q;
            totalCliente += (it.precioCliente || 0) * q;
        });
        var pedido = {
            id: uid('mp-'),
            clienteKey: claveCliente(payload.clienteKey || 'naty'),
            clienteNombre: payload.clienteNombre || 'Mayoreo',
            creadoEn: Date.now(),
            pedidoActualizadoEn: Date.now(),
            clienteEditadoEn: Date.now(),
            estado: 'pendiente',
            unidades: unidades,
            totalRetail: totalRetail,
            totalCliente: totalCliente,
            items: items,
            revisadoEn: null
        };
        var todos = getPedidos();
        todos.unshift(pedido);
        setPedidos(todos);
        bajarEarlyAccessPorItemsPedido(items);
        return { ok: true, pedido: pedido };
    }

    function todosItemsMarcados(pedido) {
        if (!pedido || !(pedido.items || []).length) return false;
        return pedido.items.every(function (it) {
            return it.disponibilidad === 'si' || it.disponibilidad === 'no';
        });
    }

    function colRefComprasPedidos() {
        var idx = global.ObebeAdminData && ObebeAdminData.idxInventario
            ? ObebeAdminData.idxInventario()
            : { imagen: 0 };
        return idx.imagen != null ? idx.imagen : 0;
    }

    /** Refs en pedidos mayoreo abiertos (sin venta confirmada). */
    function mapaRefsPedidosMayoreoActivos() {
        var map = {};
        getPedidos().forEach(function (p) {
            if (!p || p.estado === 'combinado' || p.estado === 'cancelado') return;
            if (p.ventaRetailRegistradaEn) return;
            (p.items || []).forEach(function (it) {
                var r = parseInt(it.ref, 10);
                if (isNaN(r) || r < 1) return;
                var k = String(r);
                var prev = map[k];
                var etiquetaCli = String(p.clienteNombre || p.clienteKey || 'Mayoreo').trim();
                if (etiquetaCli) etiquetaCli = etiquetaCli.toUpperCase();
                if (!prev) {
                    map[k] = {
                        disponibilidad: it.disponibilidad,
                        enPedido: true,
                        clienteKey: p.clienteKey || '',
                        clienteNombre: etiquetaCli,
                        clientes: etiquetaCli ? [etiquetaCli] : []
                    };
                    return;
                }
                if (it.disponibilidad === 'si') prev.disponibilidad = 'si';
                else if (prev.disponibilidad !== 'si' && it.disponibilidad === 'no') {
                    prev.disponibilidad = 'no';
                }
                if (etiquetaCli && prev.clientes.indexOf(etiquetaCli) < 0) prev.clientes.push(etiquetaCli);
            });
        });
        return map;
    }

    function refBloqueadaPedidoMayoreo(info) {
        if (!info) return false;
        if (info.disponibilidad === 'no') return false;
        return true;
    }

    function refApartadaEnMayoreo(ref) {
        var r = parseInt(ref, 10);
        if (isNaN(r) || r < 1) return false;
        return refBloqueadaPedidoMayoreo(mapaRefsPedidosMayoreoActivos()[String(r)]);
    }

    function etiquetaClienteApartadoRef(ref) {
        var r = parseInt(ref, 10);
        if (isNaN(r) || r < 1) return '';
        var info = mapaRefsPedidosMayoreoActivos()[String(r)];
        if (!refBloqueadaPedidoMayoreo(info)) return '';
        if (info.clientes && info.clientes.length) return info.clientes.join(', ');
        if (info.clienteNombre) return info.clienteNombre;
        if (info.clienteKey) return String(info.clienteKey).trim().toUpperCase();
        return 'Mayoreo';
    }

    function refsApartadasMayoreo() {
        var map = mapaRefsPedidosMayoreoActivos();
        return Object.keys(map).map(function (k) {
            if (!refBloqueadaPedidoMayoreo(map[k])) return null;
            return parseInt(k, 10);
        }).filter(function (n) {
            return !isNaN(n) && n > 0;
        });
    }

    /** Alinea filas Compras con pedidos Naty (tabla 1 / tabla 2 / apartados mayoreo). */
    function sincronizarFilasComprasConPedidos(filas) {
        filas = filas || [];
        if (!filas.length || !global.ObebeComprasStore) return { ok: true, dirty: false };
        var map = mapaRefsPedidosMayoreoActivos();
        var col = colRefComprasPedidos();
        var dirty = false;
        var quitarEarly = [];
        filas.forEach(function (f) {
            if (f.enTienda) return;
            var r = parseInt(f.celdas && f.celdas[col], 10);
            if (isNaN(r) || r < 1) return;
            var info = map[String(r)];
            if (refBloqueadaPedidoMayoreo(info)) {
                quitarEarly.push(r);
                if (
                    f.earlyAccess ||
                    f.mayoreoPublicarPendiente ||
                    !f.earlyAccessSuspendidoPorPedido ||
                    f.enTienda
                ) {
                    f.earlyAccess = false;
                    f.earlyAccessEn = null;
                    f.earlyAccessSuspendidoPorPedido = true;
                    f.mayoreoPublicarPendiente = false;
                    f.mayoreoPublicarPendienteEn = null;
                    f.enTienda = false;
                    dirty = true;
                }
            } else if (global.ObebeComprasEarlyStore && ObebeComprasEarlyStore.tieneRef(r)) {
                if (!f.earlyAccess || f.earlyAccessSuspendidoPorPedido || f.mayoreoPublicarPendiente) {
                    f.earlyAccess = true;
                    f.earlyAccessEn = f.earlyAccessEn || Date.now();
                    f.earlyAccessSuspendidoPorPedido = false;
                    f.mayoreoPublicarPendiente = false;
                    f.mayoreoPublicarPendienteEn = null;
                    dirty = true;
                }
            }
        });
        if (global.ObebeComprasEarlyStore && quitarEarly.length) {
            ObebeComprasEarlyStore.quitarRefs(quitarEarly);
        }
        if (dirty) {
            ObebeComprasStore.reemplazar(filas);
        }
        return { ok: true, dirty: dirty };
    }

    function refDesdeItemPedido(it) {
        var r = parseInt(it && it.ref, 10);
        return !isNaN(r) && r > 0 ? r : 0;
    }

    /** Sí hay en mayoreo: quitar early; inventario Obebe solo al confirmar venta retail. */
    function aplicarSiHayEarlyAccessDesdeItem(it) {
        var ref = refDesdeItemPedido(it);
        if (!ref) return { ok: true, ref: 0 };
        if (global.ObebeComprasEarlyStore) ObebeComprasEarlyStore.quitarRefs([ref]);
        if (!global.ObebeComprasStore) return { ok: true, ref: ref };
        var col = colRefComprasPedidos();
        var filas = ObebeComprasStore.getAll();
        var dirty = false;
        filas.forEach(function (f) {
            if (f.enTienda) return;
            var r = parseInt(f.celdas && f.celdas[col], 10);
            if (r !== ref) return;
            f.earlyAccess = false;
            f.earlyAccessEn = null;
            f.earlyAccessSuspendidoPorPedido = true;
            f.mayoreoPublicarPendiente = false;
            f.mayoreoPublicarPendienteEn = null;
            dirty = true;
        });
        if (dirty) ObebeComprasStore.reemplazar(filas);
        if (dirty && typeof document !== 'undefined') {
            try {
                document.dispatchEvent(new CustomEvent('obebe-compras-early-access'));
            } catch (e) { /* ignore */ }
        }
        return { ok: true, ref: ref };
    }

    /** No hay: puede volver a early access si aún está en Compras (sin publicar). */
    function revertirSiHayEarlyAccessDesdeItem(it) {
        var ref = refDesdeItemPedido(it);
        if (!ref || !global.ObebeComprasStore) return { ok: true, ref: 0 };
        var col = colRefComprasPedidos();
        var filas = ObebeComprasStore.getAll();
        var dirty = false;
        var restauradas = [];
        filas.forEach(function (f) {
            if (f.enTienda) return;
            var r = parseInt(f.celdas && f.celdas[col], 10);
            if (r !== ref) return;
            if (!f.mayoreoPublicarPendiente && !f.earlyAccessSuspendidoPorPedido) return;
            f.mayoreoPublicarPendiente = false;
            f.mayoreoPublicarPendienteEn = null;
            f.earlyAccess = true;
            f.earlyAccessEn = f.earlyAccessEn || Date.now();
            f.earlyAccessSuspendidoPorPedido = false;
            dirty = true;
            restauradas.push(r);
        });
        if (dirty) ObebeComprasStore.reemplazar(filas);
        if (global.ObebeComprasEarlyStore && restauradas.length) {
            ObebeComprasEarlyStore.marcarRefs(restauradas);
        }
        if (dirty && typeof document !== 'undefined') {
            try {
                document.dispatchEvent(new CustomEvent('obebe-compras-early-access'));
            } catch (e2) { /* ignore */ }
        }
        return { ok: true, ref: ref };
    }

    function marcarItemDisponibilidad(pedidoId, itemId, valor) {
        valor = valor === 'no' ? 'no' : (valor === 'si' ? 'si' : null);
        if (!valor) return { ok: false, error: 'Valor inválido.' };
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return { ok: false, error: 'Pedido no encontrado.' };
        var p = hit.pedido;
        var item = (p.items || []).find(function (it) { return it.itemId === itemId; });
        if (!item) return { ok: false, error: 'Artículo no encontrado.' };
        item.disponibilidad = valor;
        item.clienteConfirmoNoHay = false;
        if (valor === 'si') {
            aplicarSiHayEarlyAccessDesdeItem(item);
        } else if (valor === 'no') {
            revertirSiHayEarlyAccessDesdeItem(item);
            borrarEmpaqueItemObebe(pedidoId, itemId);
        }
        if (p.estado === 'pendiente') p.estado = 'en_revision';
        tocarPedido(p, 'obebe');
        hit.todos[hit.idx] = p;
        setPedidos(hit.todos);
        return { ok: true, pedido: p, listoConfirmar: todosItemsMarcados(p) };
    }

    function claveEmpaqueObebe(pedidoId, itemId) {
        return String(pedidoId || '') + '|' + String(itemId || '');
    }

    function leerMapaEmpaqueObebe() {
        var m = leerJson(KEY_EMPAQUE_OBE, {});
        return m && typeof m === 'object' ? m : {};
    }

    function guardarMapaEmpaqueObebe(map) {
        guardarJson(KEY_EMPAQUE_OBE, map || {});
    }

    function cantidadItemParaEmpaque(item) {
        return Math.max(1, parseInt(item && item.cantidad, 10) || 1);
    }

    function etiquetaEmpaqueObebe(guardadas, total) {
        total = Math.max(1, parseInt(total, 10) || 1);
        guardadas = Math.max(0, Math.min(total, parseInt(guardadas, 10) || 0));
        var faltan = total - guardadas;
        if (faltan <= 0) return 'Completo';
        if (faltan === 1) return 'Falta 1';
        return 'Faltan ' + faltan;
    }

    function empaquetadoObebeItem(pedidoId, itemId) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return 0;
        var item = (hit.pedido.items || []).find(function (it) { return it.itemId === itemId; });
        if (!item) return 0;
        if (item.empaquetadoObebe == null || item.empaquetadoObebe === '') return 0;
        var total = cantidadItemParaEmpaque(item);
        return Math.min(total, Math.max(0, parseInt(item.empaquetadoObebe, 10) || 0));
    }

    function limpiarEmpaqueLegacy(pedidoId, itemId) {
        var k = claveEmpaqueObebe(pedidoId, itemId);
        var m = leerMapaEmpaqueObebe();
        if (!m[k]) return;
        delete m[k];
        guardarMapaEmpaqueObebe(m);
    }

    function persistirEmpaquetadoEnItem(hit, item, next) {
        var p = hit.pedido;
        var total = cantidadItemParaEmpaque(item);
        next = Math.max(0, Math.min(total, parseInt(next, 10) || 0));
        if (next <= 0) {
            delete item.empaquetadoObebe;
        } else {
            item.empaquetadoObebe = next;
        }
        limpiarEmpaqueLegacy(p.id, item.itemId);
        tocarPedido(p, 'obebe');
        hit.todos[hit.idx] = p;
        setPedidos(hit.todos);
        return {
            ok: true,
            n: next,
            total: total,
            etiqueta: etiquetaEmpaqueObebe(next, total)
        };
    }

    function borrarEmpaqueItemObebe(pedidoId, itemId) {
        var hit = findPedido(pedidoId);
        if (hit.idx >= 0) {
            var item = (hit.pedido.items || []).find(function (it) { return it.itemId === itemId; });
            if (item && item.empaquetadoObebe != null) {
                delete item.empaquetadoObebe;
            }
        }
        limpiarEmpaqueLegacy(pedidoId, itemId);
    }

    function borrarEmpaquePedidoObebe(pedidoId) {
        var hit = findPedido(pedidoId);
        if (hit.idx >= 0) {
            (hit.pedido.items || []).forEach(function (it) {
                if (it.empaquetadoObebe != null) delete it.empaquetadoObebe;
            });
        }
        var pref = String(pedidoId || '') + '|';
        var m = leerMapaEmpaqueObebe();
        var dirty = false;
        Object.keys(m).forEach(function (k) {
            if (k.indexOf(pref) === 0) {
                delete m[k];
                dirty = true;
            }
        });
        if (dirty) guardarMapaEmpaqueObebe(m);
    }

    function ajustarEmpaquetadoObebeItem(pedidoId, itemId, delta) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return { ok: false, error: 'Pedido no encontrado.' };
        var item = (hit.pedido.items || []).find(function (it) { return it.itemId === itemId; });
        if (!item) return { ok: false, error: 'Artículo no encontrado.' };
        if (item.disponibilidad !== 'si') {
            return { ok: false, error: 'Solo aplica a artículos marcados como Sí hay.' };
        }
        var total = cantidadItemParaEmpaque(item);
        var cur = empaquetadoObebeItem(pedidoId, itemId);
        var next = Math.max(0, Math.min(total, cur + (parseInt(delta, 10) || 0)));
        return persistirEmpaquetadoEnItem(hit, item, next);
    }

    function ciclarEmpaquetadoObebeItem(pedidoId, itemId) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return { ok: false, error: 'Pedido no encontrado.' };
        var item = (hit.pedido.items || []).find(function (it) { return it.itemId === itemId; });
        if (!item) return { ok: false, error: 'Artículo no encontrado.' };
        var total = cantidadItemParaEmpaque(item);
        var cur = empaquetadoObebeItem(pedidoId, itemId);
        var next = cur >= total ? 0 : cur + 1;
        return ajustarEmpaquetadoObebeItem(pedidoId, itemId, next - cur);
    }

    function setEmpaquetadoObebeItem(pedidoId, itemId, n) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return { ok: false, error: 'Pedido no encontrado.' };
        var item = (hit.pedido.items || []).find(function (it) { return it.itemId === itemId; });
        if (!item) return { ok: false, error: 'Artículo no encontrado.' };
        if (item.disponibilidad !== 'si') {
            return { ok: false, error: 'Solo aplica a artículos marcados como Sí hay.' };
        }
        var total = cantidadItemParaEmpaque(item);
        var cur = empaquetadoObebeItem(pedidoId, itemId);
        var next = Math.max(0, Math.min(total, parseInt(n, 10) || 0));
        if (next === cur) {
            return {
                ok: true,
                n: cur,
                total: total,
                etiqueta: etiquetaEmpaqueObebe(cur, total)
            };
        }
        return ajustarEmpaquetadoObebeItem(pedidoId, itemId, next - cur);
    }

    function actualizarComentarioItem(pedidoId, itemId, texto) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return { ok: false, error: 'Pedido no encontrado.' };
        var p = hit.pedido;
        if (p.estado === 'revisado' || p.estado === 'cancelado') {
            return { ok: false, error: 'Este pedido ya no admite comentarios.' };
        }
        var item = (p.items || []).find(function (it) { return it.itemId === itemId; });
        if (!item) return { ok: false, error: 'Artículo no encontrado.' };
        item.comentarioObebe = String(texto || '').trim();
        tocarPedido(p, 'obebe');
        hit.todos[hit.idx] = p;
        setPedidos(hit.todos);
        return { ok: true };
    }

    function reabrirRevisionPedido(pedidoId) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return Promise.resolve({ ok: false, error: 'Pedido no encontrado.' });
        var p = hit.pedido;
        if (p.estado !== 'revisado') {
            return Promise.resolve({ ok: false, error: 'Solo puedes modificar pedidos ya enviados.' });
        }
        if (p.ventaRetailRegistradaEn) {
            return Promise.resolve({
                ok: false,
                error: 'No puedes modificar la respuesta: ya registraste la venta en Ventas.'
            });
        }
        var revStock = Promise.resolve();
        if (global.ObebeAdminData && global.ObebeAdminData.revertirStockPedidoMayoreo) {
            revStock = global.ObebeAdminData.revertirStockPedidoMayoreo(p);
        }
        return revStock.then(function () {
            if (global.ObebeMayoreoStore && global.ObebeMayoreoStore.revertirInventarioDesdePedido) {
                global.ObebeMayoreoStore.revertirInventarioDesdePedido(p);
            }
            p.estado = 'en_revision';
            p.revisadoEn = null;
            p.inventarioAplicado = false;
            tocarPedido(p, 'obebe');
            hit.todos[hit.idx] = p;
            setPedidos(hit.todos);
            return { ok: true, pedido: p };
        });
    }

    function confirmarRevisionPedido(pedidoId) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return Promise.resolve({ ok: false, error: 'Pedido no encontrado.' });
        var p = hit.pedido;
        if (!todosItemsMarcados(p)) {
            return Promise.resolve({ ok: false, error: 'Marca disponibilidad en todos los artículos.' });
        }
        p.estado = 'revisado';
        p.revisadoEn = Date.now();
        tocarPedido(p, 'obebe');
        hit.todos[hit.idx] = p;
        setPedidos(hit.todos);
        var despuesPub = findPedido(pedidoId).pedido || p;
        if (global.ObebeAdminData && global.ObebeAdminData.descontarStockPedidoMayoreo) {
            var optsStock = { silent: true };
            if (despuesPub.stockInventarioObebeAplicado) optsStock.soloItemsNuevos = true;
            return ObebeAdminData.descontarStockPedidoMayoreo(despuesPub, optsStock).then(function (sr) {
                var fin = {
                    ok: true,
                    pedido: findPedido(pedidoId).pedido || despuesPub,
                    stockObebe: sr,
                    inventarioPublicado: 0
                };
                if (!global.ObebeAdminData || !ObebeAdminData.sincronizarInventarioConPedidosMayoreo) {
                    return fin;
                }
                return ObebeAdminData.sincronizarInventarioConPedidosMayoreo({ silent: true }).then(function () {
                    return fin;
                }).catch(function () {
                    return fin;
                });
            });
        }
        return Promise.resolve({
            ok: true,
            pedido: despuesPub,
            inventarioPublicado: 0
        });
    }

    function confirmarVentaRetailPedido(pedidoId) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return Promise.resolve({ ok: false, error: 'Pedido no encontrado.' });
        var p = hit.pedido;
        if (p.estado !== 'revisado') {
            return Promise.resolve({ ok: false, error: 'Primero envía la respuesta al cliente.' });
        }
        if (p.ventaRetailRegistradaEn) {
            return Promise.resolve({ ok: false, error: 'La venta ya fue registrada.' });
        }
        if (!global.ObebeAdminData || !global.ObebeAdminData.registrarVentasDesdePedidoMayoreo) {
            return Promise.resolve({ ok: false, error: 'Registro de ventas no disponible.' });
        }
        /** No publicar Compras en inventario Obebe al confirmar venta (apartados / AA siguen solo en Compras). */
        var ventaP = ObebeAdminData.registrarVentasDesdePedidoMayoreo(findPedido(pedidoId).pedido || p).then(function (res) {
            if (res && res.ok === false && !res.lineas) return res;
            if (!res || !res.ok) return res || { ok: false, error: 'Error al registrar venta.' };
            p.ventaRetailRegistradaEn = Date.now();
            tocarPedido(p, 'obebe');
            hit.todos[hit.idx] = p;
            setPedidos(hit.todos);
            var pedidoAct = findPedido(pedidoId).pedido || p;
            if (global.ObebeMayoreoStore && global.ObebeMayoreoStore.ingresarInventarioDesdePedido) {
                global.ObebeMayoreoStore.ingresarInventarioDesdePedido(pedidoAct);
            }
            return {
                ok: true,
                lineas: res.lineas,
                pedido: findPedido(pedidoId).pedido || pedidoAct,
                soloLocal: !!res.soloLocal
            };
        });
        if (global.ObebeAdminData.descontarStockPedidoMayoreo && !p.stockInventarioObebeAplicado) {
            return global.ObebeAdminData.descontarStockPedidoMayoreo(p, { silent: true }).then(function (sr) {
                if (sr && sr.ok === false && !sr.omitido) return sr;
                return ventaP;
            });
        }
        return ventaP;
    }

    function actualizarEstado(pedidoId, estado) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return { ok: false, error: 'Pedido no encontrado.' };
        hit.pedido.estado = estado;
        hit.todos[hit.idx] = hit.pedido;
        setPedidos(hit.todos);
        return { ok: true };
    }

    function recalcTotalesPedido(p) {
        var unidades = 0;
        var totalRetail = 0;
        var totalCliente = 0;
        (p.items || []).forEach(function (it) {
            var q = it.cantidad || 1;
            unidades += q;
            totalRetail += (it.precioRetail || 0) * q;
            totalCliente += (it.precioCliente || 0) * q;
        });
        p.unidades = unidades;
        p.totalRetail = totalRetail;
        p.totalCliente = totalCliente;
        return p;
    }

    function claveContenidoItemPedido(it) {
        return [
            String(parseInt(it.ref, 10) || 0),
            norm(it.nombre),
            norm(it.talla),
            norm(it.color),
            norm(it.marca)
        ].join('::');
    }

    /** Quita líneas repetidas (misma ref / inventario) en un pedido. */
    function deduplicarItemsPedido(items) {
        var out = [];
        var porClave = Object.create(null);
        (items || []).forEach(function (it) {
            var ck = it.inventarioId ? 'inv:' + it.inventarioId : claveContenidoItemPedido(it);
            if (!ck || ck === '0::::') {
                out.push(Object.assign({}, it));
                return;
            }
            if (porClave[ck]) {
                var prev = porClave[ck];
                prev.cantidad = Math.max(
                    parseInt(prev.cantidad, 10) || 1,
                    parseInt(it.cantidad, 10) || 1
                );
                return;
            }
            var copy = Object.assign({}, it);
            porClave[ck] = copy;
            out.push(copy);
        });
        return out;
    }

    function pedidoTeniaRespuestasObebe(items) {
        return (items || []).some(function (it) {
            return it.disponibilidad === 'si' || it.disponibilidad === 'no';
        });
    }

    /** Conserva Sí hay / No hay (y comentarios) en líneas que ya existían; solo líneas nuevas quedan sin revisar. */
    function fusionarItemsTrasEdicionCliente(prevItems, nextItems) {
        var byId = {};
        var byInv = {};
        var byClave = {};
        (prevItems || []).forEach(function (it) {
            if (it.itemId) byId[it.itemId] = it;
            if (it.inventarioId) byInv[it.inventarioId] = it;
            var ck = claveContenidoItemPedido(it);
            if (ck && ck !== '0::::') byClave[ck] = it;
        });
        return (nextItems || []).map(function (it) {
            var prev = (it.itemId && byId[it.itemId]) ||
                (it.inventarioId && byInv[it.inventarioId]) ||
                byClave[claveContenidoItemPedido(it)] || null;
            if (!prev) {
                it.disponibilidad = null;
                it.comentarioObebe = it.comentarioObebe || '';
                it.clienteConfirmoNoHay = false;
                it.stockObebeAplicado = false;
                return it;
            }
            it.itemId = prev.itemId;
            if (!it.inventarioId && prev.inventarioId) it.inventarioId = prev.inventarioId;
            if (prev.disponibilidad === 'si' || prev.disponibilidad === 'no') {
                it.disponibilidad = prev.disponibilidad;
                it.comentarioObebe = prev.comentarioObebe || '';
                it.clienteConfirmoNoHay = !!prev.clienteConfirmoNoHay;
                it.stockObebeAplicado = !!prev.stockObebeAplicado;
                if (prev.empaquetadoObebe != null && prev.empaquetadoObebe !== '') {
                    it.empaquetadoObebe = prev.empaquetadoObebe;
                }
            } else {
                if (it.disponibilidad !== 'si' && it.disponibilidad !== 'no') it.disponibilidad = null;
                it.comentarioObebe = (it.comentarioObebe || prev.comentarioObebe) || '';
                it.clienteConfirmoNoHay = !!prev.clienteConfirmoNoHay;
                it.stockObebeAplicado = !!prev.stockObebeAplicado;
                if (prev.empaquetadoObebe != null && prev.empaquetadoObebe !== '') {
                    it.empaquetadoObebe = prev.empaquetadoObebe;
                }
            }
            return it;
        });
    }

    function itemsQuitadosAlEditarPedido(prevItems, nextItems) {
        var aun = {};
        (nextItems || []).forEach(function (it) {
            if (it.itemId) aun[it.itemId] = true;
            if (it.inventarioId) aun['inv:' + it.inventarioId] = true;
        });
        return (prevItems || []).filter(function (it) {
            if (it.itemId && aun[it.itemId]) return false;
            if (it.inventarioId && aun['inv:' + it.inventarioId]) return false;
            return true;
        });
    }

    function aplicarActualizacionPedidoCliente(hit, p, prevItems, items, opts) {
        opts = opts || {};
        var conservarMarcas = !!(opts.conservarMarcas);
        if (conservarMarcas) {
            items = fusionarItemsTrasEdicionCliente(prevItems, items);
        } else {
            items.forEach(function (it) {
                it.disponibilidad = null;
                it.comentarioObebe = '';
                it.clienteConfirmoNoHay = false;
                it.stockObebeAplicado = false;
                if (it.empaquetadoObebe != null) delete it.empaquetadoObebe;
            });
        }
        p.items = normalizarItems(items);
        recalcTotalesPedido(p);
        if (todosItemsMarcados(p)) {
            p.estado = 'revisado';
            if (!p.revisadoEn) p.revisadoEn = Date.now();
        } else if (conservarMarcas || p.estado === 'en_revision') {
            p.estado = 'en_revision';
        } else {
            p.estado = 'pendiente';
            p.revisadoEn = null;
        }
        tocarPedido(p, 'cliente');
        hit.todos[hit.idx] = p;
        setPedidos(hit.todos);
        bajarEarlyAccessPorItemsPedido(items);
        return {
            ok: true,
            pedido: p,
            pendienteRevision: !todosItemsMarcados(p)
        };
    }

    function actualizarPedidoCliente(pedidoId, clienteKey, items) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return Promise.resolve({ ok: false, error: 'Pedido no encontrado.' });
        var p = hit.pedido;
        if (claveCliente(p.clienteKey) !== claveCliente(clienteKey)) {
            return Promise.resolve({ ok: false, error: 'No puedes editar este pedido.' });
        }
        if (p.estado === 'cancelado') {
            return Promise.resolve({ ok: false, error: 'Este pedido está cancelado.' });
        }
        if (p.ventaRetailRegistradaEn) {
            return Promise.resolve({ ok: false, error: 'Ya confirmaste la venta; no puedes editar el pedido.' });
        }
        var prevItems = (p.items || []).slice();
        var conservarMarcas = p.estado === 'revisado' || p.estado === 'en_revision' ||
            pedidoTeniaRespuestasObebe(prevItems);
        if (!items || !items.length) return Promise.resolve({ ok: false, error: 'Agrega al menos un artículo.' });

        var quitados = itemsQuitadosAlEditarPedido(prevItems, items);
        var restaurarStock = quitados.filter(function (it) {
            if (it.disponibilidad !== 'si') return false;
            return !!(it.stockObebeAplicado || p.stockInventarioObebeAplicado);
        });

        function finalizar(resStock) {
            var out = aplicarActualizacionPedidoCliente(hit, p, prevItems, items, { conservarMarcas: conservarMarcas });
            if (resStock && resStock.count > 0) {
                out.stockObebeRestaurado = resStock.count;
            }
            return out;
        }

        if (restaurarStock.length && global.ObebeAdminData &&
            ObebeAdminData.revertirStockItemsPedidoMayoreo) {
            return ObebeAdminData.revertirStockItemsPedidoMayoreo(restaurarStock, { silent: true })
                .then(finalizar)
                .catch(function (e) {
                    return { ok: false, error: (e && e.message) || 'No se pudo devolver stock en inventario Obebe.' };
                });
        }
        return Promise.resolve(finalizar({ ok: true, omitido: true }));
    }

    function timestampLocal(y, m, d) {
        return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
    }

    function itemDesdeLineaInventarioNaty(l, itemIdPrevio) {
        return {
            itemId: itemIdPrevio || uid('li-'),
            inventarioId: l.id,
            ref: l.ref || '',
            nombre: l.nombreMostrar || l.nombreSheet || '',
            talla: l.talla || '',
            color: l.color || '',
            marca: l.marca || '',
            tipo: l.tipo || '',
            cantidad: Math.max(1, parseInt(l.cantidad, 10) || 1),
            precioRetail: l.precioRetail || 0,
            precioCliente: l.precioMayoreo || 0,
            imagenUrl: l.imagenUrl || '',
            disponibilidad: 'si'
        };
    }

    function fechaStockLineaNaty(l) {
        var f = String((l && l.fechaStockIso) || '').trim();
        if (!f) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;
        var m = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) {
            return m[3] + '-' + (m[2].length < 2 ? '0' : '') + m[2] +
                '-' + (m[1].length < 2 ? '0' : '') + m[1];
        }
        return f;
    }

    /** Líneas del 2.º lote Naty (29/10/2026); incluye ids de pedido si la fecha se migró mal. */
    function lineasInventarioPedidoNaty2910(STORE) {
        var todas = STORE.getLineasForCliente('naty');
        var porFecha = todas.filter(function (l) {
            return fechaStockLineaNaty(l) === FECHA_PEDIDO_NATY_2;
        });
        if (porFecha.length) return porFecha;
        return todas.filter(function (l) {
            if (fechaStockLineaNaty(l) === FECHA_PEDIDO_NATY_LEGACY) return false;
            var id = String(l.id || '');
            return id.indexOf('::ped::') >= 0;
        });
    }

    function itemDesdeSeedNaty2910(row, itemIdPrevio) {
        return {
            itemId: itemIdPrevio || uid('li-'),
            ref: row.ref || '',
            nombre: row.nombre || '',
            talla: row.talla || '',
            color: row.color || '',
            marca: row.marca || '',
            tipo: row.tipo || '',
            cantidad: Math.max(1, parseInt(row.cantidad, 10) || 1),
            precioRetail: row.precioRetail || 0,
            precioCliente: row.precioCliente || 0,
            imagenUrl: row.imagenUrl || '',
            disponibilidad: 'si'
        };
    }

    /** Restaura el 2.º pedido cuando no hay inventario ni historial (p. ej. tras limpieza 29/10). */
    function aplicarSeedPedidoNaty2(todos, existing, idx) {
        var seedSrc = global.ObebeMayoreoPedidosNatySeed;
        if (!seedSrc || !Array.isArray(seedSrc.ITEMS_PEDIDO_NATY_20261029)) return null;
        var prevByClave = {};
        if (existing && existing.items) {
            existing.items.forEach(function (it) {
                var ck = claveContenidoItemPedido(it);
                if (ck && ck !== '0::::') prevByClave[ck] = it;
            });
        }
        var items = seedSrc.ITEMS_PEDIDO_NATY_20261029.map(function (row) {
            var stub = itemDesdeSeedNaty2910(row);
            var prev = prevByClave[claveContenidoItemPedido(stub)];
            if (prev) {
                stub.itemId = prev.itemId;
                if (prev.disponibilidad === 'si' || prev.disponibilidad === 'no') {
                    stub.disponibilidad = prev.disponibilidad;
                }
                if (prev.comentarioObebe) stub.comentarioObebe = prev.comentarioObebe;
                if (prev.empaquetadoObebe != null && prev.empaquetadoObebe !== '') {
                    stub.empaquetadoObebe = prev.empaquetadoObebe;
                }
            }
            return stub;
        });
        items = normalizarItems(items);
        var unidades = 0;
        var totalRetail = 0;
        var totalCliente = 0;
        items.forEach(function (it) {
            var q = it.cantidad || 1;
            unidades += q;
            totalRetail += (it.precioRetail || 0) * q;
            totalCliente += (it.precioCliente || 0) * q;
        });
        var ts = timestampLocal(2026, 10, 29);
        var pedido = {
            id: PEDIDO_NATY_2_ID,
            clienteKey: 'naty',
            clienteNombre: 'NATY',
            creadoEn: (existing && existing.creadoEn) || ts,
            estado: 'revisado',
            revisadoEn: (existing && existing.revisadoEn) || ts,
            unidades: unidades,
            totalRetail: totalRetail,
            totalCliente: totalCliente,
            items: items,
            inventarioAplicado: !!(existing && existing.inventarioAplicado),
            inventarioAplicadoEn: existing && existing.inventarioAplicadoEn,
            stockInventarioObebeAplicado: !!(existing && existing.stockInventarioObebeAplicado),
            ventaRetailRegistradaEn: existing ? existing.ventaRetailRegistradaEn : null,
            legacyDesdeInventario: true,
            seedNaty2910: true
        };
        if (idx >= 0) todos[idx] = pedido;
        else todos.unshift(pedido);
        setPedidos(todos);
        purgarDuplicadosNatyPedido2910();
        return { ok: true, pedido: pedido, items: items.length, desdeSeed: true };
    }

    function conservarPedidoNaty2DesdeHistorial(todos) {
        var idx = todos.findIndex(function (p) { return p.id === PEDIDO_NATY_2_ID; });
        if (idx >= 0 && (todos[idx].items || []).length) {
            purgarDuplicadosNatyPedido2910();
            var refrescado = findPedido(PEDIDO_NATY_2_ID).pedido;
            return { ok: true, pedido: refrescado || todos[idx], conservado: true };
        }
        var candidatos = pedidosNatyEnFechaCreado(FECHA_PEDIDO_NATY_2).filter(function (p) {
            return p.id !== PEDIDO_NATY_LEGACY_ID && (p.items || []).length >= 1;
        });
        if (!candidatos.length) return null;
        candidatos.sort(function (a, b) {
            return (b.items || []).length - (a.items || []).length;
        });
        var src = candidatos[0];
        var prevByInv = {};
        (src.items || []).forEach(function (it) {
            if (it.inventarioId) prevByInv[it.inventarioId] = it.itemId;
        });
        var items = (src.items || []).map(function (it) {
            var copy = Object.assign({}, it);
            if (it.inventarioId && prevByInv[it.inventarioId]) {
                copy.itemId = prevByInv[it.inventarioId];
            }
            return copy;
        });
        var pedido = Object.assign({}, src, {
            id: PEDIDO_NATY_2_ID,
            clienteKey: 'naty',
            clienteNombre: 'NATY',
            creadoEn: src.creadoEn || timestampLocal(2026, 10, 29),
            items: normalizarItems(items),
            legacyDesdeInventario: true
        });
        if (idx >= 0) todos[idx] = pedido;
        else todos.unshift(pedido);
        if (src.id !== PEDIDO_NATY_2_ID) {
            todos = todos.filter(function (p) { return p.id !== src.id; });
        }
        setPedidos(todos);
        purgarDuplicadosNatyPedido2910();
        return { ok: true, pedido: pedido, restauradoDesde: src.id, items: items.length };
    }

    /** Pedido histórico NATY (17/10/2026) reconstruido desde inventario local con esa fecha. */
    function asegurarPedidoNatyLegacy20261017() {
        var STORE = global.ObebeMayoreoStore;
        if (!STORE || !STORE.getLineasForCliente) {
            return { ok: true, omitido: true, razon: 'sin-store' };
        }
        var lineas = STORE.getLineasForCliente('naty').filter(function (l) {
            return String(l.fechaStockIso || '') === FECHA_PEDIDO_NATY_LEGACY;
        });
        if (!lineas.length) {
            return { ok: true, omitido: true, sinLineas: true };
        }
        var todos = leerJson(KEY, []);
        if (!Array.isArray(todos)) todos = [];
        var idx = todos.findIndex(function (p) { return p.id === PEDIDO_NATY_LEGACY_ID; });
        var existing = idx >= 0 ? todos[idx] : null;
        var prevByInv = {};
        if (existing && existing.items) {
            existing.items.forEach(function (it) {
                if (it.inventarioId) prevByInv[it.inventarioId] = it.itemId;
            });
        }
        var items = lineas.map(function (l) {
            return itemDesdeLineaInventarioNaty(l, prevByInv[l.id]);
        });
        var unidades = 0;
        var totalRetail = 0;
        var totalCliente = 0;
        items.forEach(function (it) {
            var q = it.cantidad || 1;
            unidades += q;
            totalRetail += (it.precioRetail || 0) * q;
            totalCliente += (it.precioCliente || 0) * q;
        });
        var ts = timestampLocal(2026, 10, 17);
        var pedido = {
            id: PEDIDO_NATY_LEGACY_ID,
            clienteKey: 'naty',
            clienteNombre: 'NATY',
            creadoEn: ts,
            estado: 'revisado',
            revisadoEn: ts,
            unidades: unidades,
            totalRetail: totalRetail,
            totalCliente: totalCliente,
            items: normalizarItems(items),
            inventarioAplicado: true,
            inventarioAplicadoEn: (existing && existing.inventarioAplicadoEn) || ts,
            stockInventarioObebeAplicado: !!(existing && existing.stockInventarioObebeAplicado),
            ventaRetailRegistradaEn: existing ? existing.ventaRetailRegistradaEn : null,
            legacyDesdeInventario: true
        };
        if (idx >= 0) todos[idx] = pedido;
        else todos.unshift(pedido);
        setPedidos(todos);
        marcarVentaConfirmadaPedidoLegacyNaty1710();
        return { ok: true, pedido: pedido, items: items.length };
    }

  function pedidoNaty2910TieneEdicionCliente(existing) {
        if (!existing) return false;
        var tsSeed = timestampLocal(2026, 10, 29);
        if (existing.clienteEditadoEn && existing.clienteEditadoEn > tsSeed) return true;
        if (existing.pedidoActualizadoEn && existing.pedidoActualizadoEn > tsSeed + 3600000) return true;
        if (existing.estado === 'pendiente' || existing.estado === 'en_revision') return true;
        return false;
    }

    function debeConservarPedidoNaty2910Existente(existing, lineas) {
        if (!existing || !(existing.items || []).length) return false;
        var nItems = existing.items.length;
        var nLineas = (lineas || []).length;
        if (pedidoNaty2910TieneEdicionCliente(existing)) return true;
        if (nLineas > 0 && nItems >= nLineas) return true;
        return false;
    }

    /** 2.º pedido Naty (29/10/2026, ~18 pzas.) reconstruido desde inventario o historial local. */
    function asegurarPedidoNatySegundo20261029() {
        var STORE = global.ObebeMayoreoStore;
        if (!STORE || !STORE.getLineasForCliente) {
            return { ok: true, omitido: true, razon: 'sin-store' };
        }
        var todos = leerJson(KEY, []);
        if (!Array.isArray(todos)) todos = [];
        var idx = todos.findIndex(function (p) { return p.id === PEDIDO_NATY_2_ID; });
        var existing = idx >= 0 ? todos[idx] : null;
        var nItemsExist = existing && existing.items ? existing.items.length : 0;
        if (existing && nItemsExist > 0) {
            recalcTotalesPedido(existing);
            todos[idx] = existing;
            setPedidos(todos);
            purgarDuplicadosNatyPedido2910();
            return {
                ok: true,
                pedido: existing,
                conservadoPedidoExistente: true,
                items: nItemsExist,
                unidades: existing.unidades
            };
        }
        var lineas = lineasInventarioPedidoNaty2910(STORE);
        if (existing && debeConservarPedidoNaty2910Existente(existing, lineas)) {
            recalcTotalesPedido(existing);
            todos[idx] = existing;
            setPedidos(todos);
            purgarDuplicadosNatyPedido2910();
            return {
                ok: true,
                pedido: existing,
                conservadoEdicion: true,
                items: nItemsExist,
                lineasInventario: lineas.length
            };
        }
        if (!lineas.length) {
            var conservado = conservarPedidoNaty2DesdeHistorial(todos);
            if (conservado) return conservado;
            if (nItemsExist > 0) {
                return { ok: true, pedido: existing, conservadoSinInventario: true };
            }
            var desdeSeed = aplicarSeedPedidoNaty2(todos, existing, idx);
            if (desdeSeed) return desdeSeed;
            return { ok: true, omitido: true, sinLineas: true };
        }
        if (nItemsExist > lineas.length && existing) {
            existing.unidades = (existing.items || []).reduce(function (s, it) {
                return s + (it.cantidad || 1);
            }, 0);
            todos[idx] = existing;
            setPedidos(todos);
            return { ok: true, pedido: existing, conservadoItems: nItemsExist, lineasActuales: lineas.length };
        }
        var prevByInv = {};
        if (existing && existing.items) {
            existing.items.forEach(function (it) {
                if (it.inventarioId) prevByInv[it.inventarioId] = it.itemId;
            });
        }
        var items = lineas.map(function (l) {
            return itemDesdeLineaInventarioNaty(l, prevByInv[l.id]);
        });
        var unidades = 0;
        var totalRetail = 0;
        var totalCliente = 0;
        items.forEach(function (it) {
            var q = it.cantidad || 1;
            unidades += q;
            totalRetail += (it.precioRetail || 0) * q;
            totalCliente += (it.precioCliente || 0) * q;
        });
        var ts = timestampLocal(2026, 10, 29);
        var pedido = {
            id: PEDIDO_NATY_2_ID,
            clienteKey: 'naty',
            clienteNombre: 'NATY',
            creadoEn: ts,
            estado: 'revisado',
            revisadoEn: (existing && existing.revisadoEn) || ts,
            unidades: unidades,
            totalRetail: totalRetail,
            totalCliente: totalCliente,
            items: normalizarItems(items),
            inventarioAplicado: !!(existing && existing.inventarioAplicado),
            inventarioAplicadoEn: existing && existing.inventarioAplicadoEn,
            stockInventarioObebeAplicado: !!(existing && existing.stockInventarioObebeAplicado),
            ventaRetailRegistradaEn: existing ? existing.ventaRetailRegistradaEn : null,
            legacyDesdeInventario: true
        };
        (existing && existing.items || []).forEach(function (itPrev) {
            if (!itPrev.itemId || itPrev.disponibilidad == null) return;
            var hit = pedido.items.find(function (it) {
                return it.inventarioId && it.inventarioId === itPrev.inventarioId;
            });
            if (hit) hit.disponibilidad = itPrev.disponibilidad;
        });
        if (idx >= 0) todos[idx] = pedido;
        else todos.unshift(pedido);
        setPedidos(todos);
        purgarDuplicadosNatyPedido2910();
        return { ok: true, pedido: pedido, items: items.length };
    }

    function filaInvDesdeItem(it, filasInv) {
        filasInv = filasInv || [];
        if (global.ObebeAdminData && it.inventarioId) {
            var id = it.inventarioId;
            for (var i = 0; i < filasInv.length; i++) {
                if (ObebeAdminData.idFilaInventario(filasInv[i]) === id) return filasInv[i];
            }
        }
        return {
            ref: it.ref || 0,
            nombre: it.nombre || '',
            talla: it.talla || '',
            color: it.color || '',
            marca: it.marca || '',
            tipo: it.tipo || '',
            precio: it.precioRetail || 0,
            precioMayoreo: it.precioCliente || 0,
            precioMayoreo50: 0,
            mayoreo: true,
            segmento: 'Hombre'
        };
    }

    function recalcularPreciosPedido(p, filasInv) {
        if (!p || !global.ObebeAdminData) return p;
        var u = 0;
        (p.items || []).forEach(function (it) { u += it.cantidad || 1; });
        (p.items || []).forEach(function (it) {
            var pr = ObebeAdminData.precioPedidoMayoreo(filaInvDesdeItem(it, filasInv), u);
            it.precioCliente = pr.precioCliente;
            it.precioRetail = pr.retail;
            it.notaPrecio = pr.nota;
        });
        return recalcTotalesPedido(p);
    }

    function fusionarItemsPedidos(itemsArr) {
        var map = {};
        var order = [];
        (itemsArr || []).forEach(function (it) {
            var key = it.inventarioId || [
                norm(it.nombre), norm(it.talla), norm(it.color), norm(it.marca)
            ].join('|');
            if (map[key]) {
                map[key].cantidad = (map[key].cantidad || 1) + (it.cantidad || 1);
            } else {
                var copy = Object.assign({}, it);
                copy.itemId = uid('li-');
                copy.disponibilidad = null;
                copy.clienteConfirmoNoHay = false;
                copy.comentarioObebe = '';
                map[key] = copy;
                order.push(key);
            }
        });
        return order.map(function (k) { return map[k]; });
    }

    function previewCombinarPedidos(pedidoIds) {
        pedidoIds = (pedidoIds || []).filter(Boolean);
        if (pedidoIds.length < 2) {
            return { ok: false, error: 'Selecciona al menos 2 pedidos.' };
        }
        var todos = getPedidos();
        var picks = [];
        pedidoIds.forEach(function (id) {
            var p = todos.find(function (x) { return x.id === id; });
            if (p && esPedidoVisibleLista(p)) picks.push(p);
        });
        if (picks.length < 2) {
            return { ok: false, error: 'No se encontraron los pedidos seleccionados.' };
        }
        var ck = claveCliente(picks[0].clienteKey);
        var i;
        for (i = 0; i < picks.length; i++) {
            if (claveCliente(picks[i].clienteKey) !== ck) {
                return { ok: false, error: 'Solo pedidos del mismo cliente.' };
            }
            if (!pedidoEsCombinable(picks[i])) {
                return { ok: false, error: 'Algún pedido no se puede combinar.' };
            }
        }
        var allItems = [];
        picks.forEach(function (p) { allItems = allItems.concat(p.items || []); });
        var mergedItems = fusionarItemsPedidos(allItems);
        var unidades = 0;
        mergedItems.forEach(function (it) { unidades += it.cantidad || 1; });
        var tier = global.ObebeAdminData && ObebeAdminData.etiquetaTierPedido
            ? ObebeAdminData.etiquetaTierPedido(unidades)
            : unidades + ' pzas.';
        return {
            ok: true,
            pedidos: picks.length,
            unidades: unidades,
            tier: tier,
            clienteNombre: picks[0].clienteNombre || picks[0].clienteKey
        };
    }

    function combinarPedidos(pedidoIds, filasInv) {
        pedidoIds = (pedidoIds || []).filter(Boolean);
        if (pedidoIds.length < 2) {
            return { ok: false, error: 'Selecciona al menos 2 pedidos para combinar.' };
        }
        var todos = getPedidos();
        var picks = [];
        pedidoIds.forEach(function (id) {
            var p = todos.find(function (x) { return x.id === id; });
            if (p && esPedidoVisibleLista(p)) picks.push(p);
        });
        if (picks.length < 2) {
            return { ok: false, error: 'No se encontraron los pedidos seleccionados.' };
        }
        var ck = claveCliente(picks[0].clienteKey);
        var i;
        for (i = 0; i < picks.length; i++) {
            if (claveCliente(picks[i].clienteKey) !== ck) {
                return { ok: false, error: 'Solo puedes combinar pedidos del mismo cliente.' };
            }
            if (!pedidoEsCombinable(picks[i])) {
                return { ok: false, error: 'Algún pedido ya está revisado o cerrado y no se puede combinar.' };
            }
        }
        var allItems = [];
        picks.forEach(function (p) { allItems = allItems.concat(p.items || []); });
        var mergedItems = fusionarItemsPedidos(allItems);
        if (!mergedItems.length) {
            return { ok: false, error: 'No hay artículos para combinar.' };
        }
        var creadoMin = picks[0].creadoEn || Date.now();
        picks.forEach(function (p) {
            if ((p.creadoEn || 0) < creadoMin) creadoMin = p.creadoEn;
        });
        var nuevo = {
            id: uid('mp-'),
            clienteKey: ck,
            clienteNombre: picks[0].clienteNombre || 'NATY',
            creadoEn: creadoMin,
            estado: 'pendiente',
            items: normalizarItems(mergedItems),
            revisadoEn: null,
            pedidoCombinado: true,
            pedidosOrigen: picks.map(function (p) { return p.id; }),
            avisoClienteTexto: 'Obebe Clothes combinó ' + picks.length +
                ' pedidos en uno solo. Los precios se recalcularon según el total de piezas (tarifas +20 / +50).',
            clienteNotificadoEn: Date.now(),
            clienteVioAvisoEn: null
        };
        recalcularPreciosPedido(nuevo, filasInv);
        picks.forEach(function (p) {
            var idx = todos.findIndex(function (x) { return x.id === p.id; });
            if (idx >= 0) {
                todos[idx].estado = 'combinado';
                todos[idx].combinadoEn = nuevo.id;
                todos[idx].combinadoEnFecha = Date.now();
            }
        });
        todos.unshift(nuevo);
        setPedidos(todos);
        return { ok: true, pedido: nuevo, combinados: picks.length };
    }

    function confirmarNoHayItemCliente(pedidoId, itemId, clienteKey) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return { ok: false, error: 'Pedido no encontrado.' };
        var p = hit.pedido;
        if (claveCliente(p.clienteKey) !== claveCliente(clienteKey)) {
            return { ok: false, error: 'No puedes modificar este pedido.' };
        }
        if (p.estado !== 'revisado') {
            return { ok: false, error: 'Aún no hay respuesta de Obebe sobre este pedido.' };
        }
        if (p.ventaRetailRegistradaEn) {
            return { ok: false, error: 'La venta ya fue confirmada; no puedes modificar el pedido.' };
        }
        var item = (p.items || []).find(function (it) { return it.itemId === itemId; });
        if (!item) return { ok: false, error: 'Artículo no encontrado.' };
        if (item.disponibilidad !== 'no') {
            return { ok: false, error: 'Solo puedes confirmar artículos marcados como No hay.' };
        }
        item.clienteConfirmoNoHay = true;
        tocarPedido(p, 'cliente');
        hit.todos[hit.idx] = p;
        setPedidos(hit.todos);
        return { ok: true, pedido: p };
    }

    function eliminarItemPedido(pedidoId, itemId, rol, clienteKeyOpcional, filasInv) {
        rol = rol === 'obebe' ? 'obebe' : 'cliente';
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return { ok: false, error: 'Pedido no encontrado.' };
        var p = hit.pedido;
        if (p.id === PEDIDO_NATY_LEGACY_ID) {
            return { ok: false, error: 'No puedes quitar artículos del pedido histórico.' };
        }
        var item = (p.items || []).find(function (it) { return it.itemId === itemId; });
        if (!item) return { ok: false, error: 'Artículo no encontrado.' };
        if (item.disponibilidad !== 'no') {
            return { ok: false, error: 'Solo se pueden quitar artículos marcados como No hay.' };
        }
        if (rol === 'cliente') {
            if (claveCliente(p.clienteKey) !== claveCliente(clienteKeyOpcional)) {
                return { ok: false, error: 'No puedes modificar este pedido.' };
            }
            if (p.ventaRetailRegistradaEn) {
                return { ok: false, error: 'La venta ya fue confirmada; no puedes modificar el pedido.' };
            }
            if (p.estado !== 'revisado') {
                return { ok: false, error: 'Espera la respuesta de Obebe antes de quitar artículos.' };
            }
        } else {
            if (p.estado !== 'revisado' && p.estado !== 'en_revision' && p.estado !== 'pendiente') {
                return { ok: false, error: 'No puedes quitar artículos de este pedido ahora.' };
            }
        }
        p.items = (p.items || []).filter(function (it) { return it.itemId !== itemId; });
        if (!p.items.length) {
            return { ok: false, error: 'El pedido debe tener al menos un artículo. Elimina el pedido completo si aplica.' };
        }
        recalcularPreciosPedido(p, filasInv);
        if (p.estado === 'revisado' && !todosItemsMarcados(p)) {
            p.estado = 'en_revision';
            p.revisadoEn = null;
        }
        tocarPedido(p, rol === 'obebe' ? 'obebe' : 'cliente');
        hit.todos[hit.idx] = p;
        borrarEmpaqueItemObebe(pedidoId, itemId);
        setPedidos(hit.todos);
        return { ok: true, pedido: p };
    }

    function marcarClienteVioAvisoPedido(pedidoId, clienteKey) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return { ok: false };
        if (claveCliente(hit.pedido.clienteKey) !== claveCliente(clienteKey)) {
            return { ok: false, error: 'Pedido no encontrado.' };
        }
        hit.pedido.clienteVioAvisoEn = Date.now();
        hit.todos[hit.idx] = hit.pedido;
        setPedidos(hit.todos);
        return { ok: true };
    }

    var KEY_REVERT_NATY_PED2_2910 = 'obebe_naty_revert_ped2_inv_20261029_v3';
    var KEY_INV_SOLO_VENTA_CONFIRMADA = 'obebe_mayoreo_inv_en_venta_confirmada_v1';

    function fechaLocalIsoDesdeMs(ms) {
        var d = new Date(ms || 0);
        if (isNaN(d.getTime())) return '';
        var y = d.getFullYear();
        var m = d.getMonth() + 1;
        var day = d.getDate();
        return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    }

    function pedidosNatyEnFechaCreado(fechaIso) {
        fechaIso = String(fechaIso || '').trim();
        return getPedidos()
            .filter(function (p) {
                if (claveCliente(p.clienteKey) !== 'naty') return false;
                if (p.estado === 'combinado') return false;
                return fechaLocalIsoDesdeMs(p.creadoEn) === fechaIso;
            })
            .sort(function (a, b) { return (a.creadoEn || 0) - (b.creadoEn || 0); });
    }

    function contarUnidadesPedido(p) {
        if (!p) return 0;
        var u = parseInt(p.unidades, 10);
        if (!isNaN(u) && u > 0) return u;
        return (p.items || []).reduce(function (s, it) {
            return s + (it.cantidad || 1);
        }, 0);
    }

    /** Deja un solo pedido del 29/10 (mp-naty-pedido-20261029); quita copias del mismo lote. */
    function purgarDuplicadosNatyPedido2910() {
        var todos = leerJson(KEY, []);
        if (!Array.isArray(todos) || !todos.length) return { ok: true, omitido: true };
        var idxCanon = todos.findIndex(function (p) { return p.id === PEDIDO_NATY_2_ID; });
        var canon = idxCanon >= 0 ? todos[idxCanon] : null;
        var uCanon = contarUnidadesPedido(canon);
        if (!canon || uCanon < 1) return { ok: true, omitido: true, sinCanon: true };
        var removed = 0;
        var out = todos.filter(function (p) {
            if (p.id === PEDIDO_NATY_2_ID || p.id === PEDIDO_NATY_LEGACY_ID) return true;
            if (p.estado === 'combinado') return true;
            if (claveCliente(p.clienteKey) !== 'naty') return true;
            if (fechaLocalIsoDesdeMs(p.creadoEn) !== FECHA_PEDIDO_NATY_2) return true;
            removed += 1;
            return false;
        });
        if (removed > 0) {
            setPedidos(out);
            return { ok: true, removed: removed };
        }
        return { ok: true, removed: 0 };
    }

    /** Un solo pedido 29/10, sin líneas duplicadas (repara local; no reconstruye desde inventario). */
    function repararPedidosNatyDuplicados() {
        unificarPedidosNaty2910EnCanon();
        purgarDuplicadosNatyPedido2910();
        var hit = findPedido(PEDIDO_NATY_2_ID);
        if (hit.idx < 0) return { ok: true, omitido: true };
        var p = hit.pedido;
        var antes = (p.items || []).length;
        p.items = normalizarItems(deduplicarItemsPedido(p.items));
        recalcTotalesPedido(p);
        hit.todos[hit.idx] = p;
        setPedidos(hit.todos);
        if (global.ObebeComprasStore && ObebeComprasStore.getAll) {
            try {
                sincronizarFilasComprasConPedidos(ObebeComprasStore.getAll());
            } catch (e) { /* ignore */ }
        }
        return {
            ok: true,
            itemsAntes: antes,
            itemsDespues: (p.items || []).length,
            unidades: p.unidades
        };
    }

    /**
     * Pedidos con respuesta enviada pero sin venta retail: quitar líneas del inventario mayoreo Naty
     * (el stock Obebe debe seguir descontado hasta venta confirmada o reabrir revisión).
     */
    function revertirInventarioNatyPedidosSinVentaConfirmada() {
        try {
            if (localStorage.getItem(KEY_INV_SOLO_VENTA_CONFIRMADA)) {
                return Promise.resolve({ ok: true, omitido: true });
            }
        } catch (e) { /* ignore */ }
        var todos = getPedidos();
        var chain = Promise.resolve({ quitados: 0 });
        todos.forEach(function (p) {
            if (p.estado !== 'revisado' || p.ventaRetailRegistradaEn) return;
            chain = chain.then(function (acc) {
                if (!global.ObebeMayoreoStore || !ObebeMayoreoStore.revertirInventarioDesdePedido) {
                    return acc;
                }
                return Promise.resolve(ObebeMayoreoStore.revertirInventarioDesdePedido(p, { forzar: true }))
                    .then(function () {
                        var hit = findPedido(p.id);
                        if (hit.idx >= 0) {
                            hit.pedido.inventarioAplicado = false;
                            hit.pedido.inventarioAplicadoEn = null;
                            hit.todos[hit.idx] = hit.pedido;
                            setPedidos(hit.todos);
                        }
                        return { quitados: acc.quitados + 1 };
                    });
            });
        });
        return chain.then(function (acc) {
            var stockP = Promise.resolve();
            if (global.ObebeAdminData && global.ObebeAdminData.aplicarStockPendientePedidosMayoreo) {
                stockP = ObebeAdminData.aplicarStockPendientePedidosMayoreo();
            }
            return stockP.then(function () {
                try {
                    localStorage.setItem(KEY_INV_SOLO_VENTA_CONFIRMADA, String(Date.now()));
                } catch (e) { /* ignore */ }
                return Object.assign({ ok: true, migracion: true }, acc);
            });
        });
    }

    /** 2.º pedido Naty 29/10/2026: solo inventario mayoreo (no toca stock Obebe). */
    function quitarInventarioNatySegundoPedido2910() {
        try {
            if (localStorage.getItem(KEY_REVERT_NATY_PED2_2910)) {
                return Promise.resolve({ ok: true, omitido: true });
            }
        } catch (e) { /* ignore */ }
        var lista = pedidosNatyEnFechaCreado('2026-10-29');
        if (lista.length < 2) {
            return Promise.resolve({ ok: true, omitido: true, motivo: 'menos de 2 pedidos ese día' });
        }
        var p = lista[1];
        if (p.ventaRetailRegistradaEn) {
            return Promise.resolve({ ok: true, omitido: true, motivo: 'venta ya confirmada' });
        }
        var chain = Promise.resolve();
        if (global.ObebeMayoreoStore && global.ObebeMayoreoStore.revertirInventarioDesdePedido) {
            chain = chain.then(function () {
                return ObebeMayoreoStore.revertirInventarioDesdePedido(p, { forzar: true });
            });
        }
        return chain.then(function () {
            var hit = findPedido(p.id);
            if (hit.idx >= 0) {
                hit.pedido.inventarioAplicado = false;
                hit.pedido.inventarioAplicadoEn = null;
                hit.todos[hit.idx] = hit.pedido;
                setPedidos(hit.todos);
            }
            try {
                localStorage.setItem(KEY_REVERT_NATY_PED2_2910, String(Date.now()));
            } catch (e) { /* ignore */ }
            return {
                ok: true,
                pedidoId: p.id,
                items: (p.items || []).length,
                revertido: true
            };
        });
    }

    function eliminarPedido(pedidoId, clienteKeyOpcional) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return Promise.resolve({ ok: false, error: 'Pedido no encontrado.' });
        if (clienteKeyOpcional != null && clienteKeyOpcional !== '') {
            if (claveCliente(hit.pedido.clienteKey) !== claveCliente(clienteKeyOpcional)) {
                return Promise.resolve({ ok: false, error: 'No puedes eliminar este pedido.' });
            }
            if (hit.pedido.ventaRetailRegistradaEn) {
                return Promise.resolve({
                    ok: false,
                    error: 'La venta ya fue confirmada; no puedes eliminar este pedido.'
                });
            }
        }
        if (hit.pedido.id === PEDIDO_NATY_LEGACY_ID || hit.pedido.id === PEDIDO_NATY_2_ID) {
            return Promise.resolve({
                ok: false,
                error: 'Este pedido histórico se regenera desde el inventario NATY. Quita artículos en Inventario mayoreo si ya no aplican.'
            });
        }
        var p = hit.pedido;
        var chain = Promise.resolve();
        if (p.stockInventarioObebeAplicado && global.ObebeAdminData &&
            global.ObebeAdminData.revertirStockPedidoMayoreo) {
            chain = chain.then(function () {
                return ObebeAdminData.revertirStockPedidoMayoreo(p);
            });
        }
        if (p.inventarioAplicado && global.ObebeMayoreoStore &&
            global.ObebeMayoreoStore.revertirInventarioDesdePedido) {
            chain = chain.then(function () {
                ObebeMayoreoStore.revertirInventarioDesdePedido(p);
            });
        }
        return chain.then(function () {
            restaurarEarlyAccessPorItemsPedido(p.items || []);
            var fresh = findPedido(pedidoId);
            if (fresh.idx >= 0) {
                fresh.todos.splice(fresh.idx, 1);
                setPedidos(fresh.todos);
            }
            borrarEmpaquePedidoObebe(pedidoId);
            return { ok: true };
        });
    }

    global.ObebeMayoreoPedidosStore = {
        pedidosForCliente: pedidosForCliente,
        listarTodos: listarTodos,
        registrarPedido: registrarPedido,
        actualizarPedidoCliente: actualizarPedidoCliente,
        eliminarPedido: eliminarPedido,
        marcarItemDisponibilidad: marcarItemDisponibilidad,
        actualizarComentarioItem: actualizarComentarioItem,
        empaquetadoObebeItem: empaquetadoObebeItem,
        etiquetaEmpaqueObebe: etiquetaEmpaqueObebe,
        ajustarEmpaquetadoObebeItem: ajustarEmpaquetadoObebeItem,
        setEmpaquetadoObebeItem: setEmpaquetadoObebeItem,
        ciclarEmpaquetadoObebeItem: ciclarEmpaquetadoObebeItem,
        reabrirRevisionPedido: reabrirRevisionPedido,
        confirmarRevisionPedido: confirmarRevisionPedido,
        confirmarVentaRetailPedido: confirmarVentaRetailPedido,
        todosItemsMarcados: todosItemsMarcados,
        actualizarEstado: actualizarEstado,
        claveCliente: claveCliente,
        pedidoEsCombinable: pedidoEsCombinable,
        previewCombinarPedidos: previewCombinarPedidos,
        combinarPedidos: combinarPedidos,
        recalcularPreciosPedido: recalcularPreciosPedido,
        confirmarNoHayItemCliente: confirmarNoHayItemCliente,
        actualizarCantidadItemPedido: actualizarCantidadItemPedido,
        eliminarItemPedido: eliminarItemPedido,
        marcarClienteVioAvisoPedido: marcarClienteVioAvisoPedido,
        asegurarPedidoNatyLegacy20261017: asegurarPedidoNatyLegacy20261017,
        asegurarPedidoNatySegundo20261029: asegurarPedidoNatySegundo20261029,
        purgarDuplicadosNatyPedido2910: purgarDuplicadosNatyPedido2910,
        quitarInventarioNatySegundoPedido2910: quitarInventarioNatySegundoPedido2910,
        revertirInventarioNatyPedidosSinVentaConfirmada: revertirInventarioNatyPedidosSinVentaConfirmada,
        pedidosNatyEnFechaCreado: pedidosNatyEnFechaCreado,
        asegurarPedidosNatySiFaltan: asegurarPedidosNatySiFaltan,
        repararPedidosNatyDuplicados: repararPedidosNatyDuplicados,
        deduplicarItemsPedido: deduplicarItemsPedido,
        unificarPedidosNaty2910EnCanon: unificarPedidosNaty2910EnCanon,
        refApartadaEnMayoreo: refApartadaEnMayoreo,
        etiquetaClienteApartadoRef: etiquetaClienteApartadoRef,
        refsApartadasMayoreo: refsApartadasMayoreo,
        sincronizarFilasComprasConPedidos: sincronizarFilasComprasConPedidos,
        PEDIDO_NATY_LEGACY_ID: PEDIDO_NATY_LEGACY_ID
    };
})(window);
