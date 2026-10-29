(function (global) {
    'use strict';

    var KEY = 'obebe_mayoreo_pedidos_v1';
    var PEDIDO_NATY_LEGACY_ID = 'mp-naty-pedido-20261017';
    var FECHA_PEDIDO_NATY_LEGACY = '2026-10-17';

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

    function migrarPedido(p) {
        if (!p) return p;
        p.items = normalizarItems(p.items);
        if (p.estado === 'confirmado' && !p.revisadoEn && todosItemsMarcados(p)) {
            p.estado = 'revisado';
            p.revisadoEn = p.revisadoEn || Date.now();
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
        return arr;
    }

    function setPedidos(arr) {
        guardarJson(KEY, arr || []);
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

    function pedidosForCliente(clienteKey) {
        asegurarPedidoNatyLegacy20261017();
        var k = claveCliente(clienteKey);
        return getPedidos()
            .filter(function (p) { return claveCliente(p.clienteKey) === k && esPedidoVisibleLista(p); })
            .sort(function (a, b) { return (b.creadoEn || 0) - (a.creadoEn || 0); });
    }

    function listarTodos(filtroClienteKey) {
        asegurarPedidoNatyLegacy20261017();
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
            return copy;
        });
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
        return { ok: true, pedido: pedido };
    }

    function todosItemsMarcados(pedido) {
        if (!pedido || !(pedido.items || []).length) return false;
        return pedido.items.every(function (it) {
            return it.disponibilidad === 'si' || it.disponibilidad === 'no';
        });
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
        if (p.estado === 'pendiente') p.estado = 'en_revision';
        hit.todos[hit.idx] = p;
        setPedidos(hit.todos);
        return { ok: true, pedido: p, listoConfirmar: todosItemsMarcados(p) };
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
        hit.todos[hit.idx] = p;
        setPedidos(hit.todos);
        if (global.ObebeMayoreoStore && global.ObebeMayoreoStore.ingresarInventarioDesdePedido) {
            global.ObebeMayoreoStore.ingresarInventarioDesdePedido(p);
        }
        var fresh = findPedido(pedidoId).pedido || p;
        if (global.ObebeAdminData && global.ObebeAdminData.descontarStockPedidoMayoreo) {
            return global.ObebeAdminData.descontarStockPedidoMayoreo(fresh).then(function (sr) {
                return { ok: true, pedido: findPedido(pedidoId).pedido || fresh, stockObebe: sr };
            });
        }
        return Promise.resolve({ ok: true, pedido: fresh });
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
        return global.ObebeAdminData.registrarVentasDesdePedidoMayoreo(p).then(function (res) {
            if (!res || !res.ok) return res || { ok: false, error: 'Error al registrar venta.' };
            var hit2 = findPedido(pedidoId);
            if (hit2.idx >= 0) {
                hit2.pedido.ventaRetailRegistradaEn = Date.now();
                hit2.todos[hit2.idx] = hit2.pedido;
                setPedidos(hit2.todos);
            }
            return {
                ok: true,
                lineas: res.lineas,
                pedido: hit2.idx >= 0 ? hit2.pedido : p,
                soloLocal: !!res.soloLocal
            };
        });
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

    function actualizarPedidoCliente(pedidoId, clienteKey, items) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return { ok: false, error: 'Pedido no encontrado.' };
        var p = hit.pedido;
        if (claveCliente(p.clienteKey) !== claveCliente(clienteKey)) {
            return { ok: false, error: 'No puedes editar este pedido.' };
        }
        if (p.estado === 'cancelado') {
            return { ok: false, error: 'Este pedido está cancelado.' };
        }
        items = normalizarItems(items || []);
        if (!items.length) return { ok: false, error: 'Agrega al menos un artículo.' };
        items.forEach(function (it) {
            it.disponibilidad = null;
        });
        p.items = items;
        recalcTotalesPedido(p);
        p.estado = 'pendiente';
        p.revisadoEn = null;
        hit.todos[hit.idx] = p;
        setPedidos(hit.todos);
        return { ok: true, pedido: p };
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
        var item = (p.items || []).find(function (it) { return it.itemId === itemId; });
        if (!item) return { ok: false, error: 'Artículo no encontrado.' };
        if (item.disponibilidad !== 'no') {
            return { ok: false, error: 'Solo puedes confirmar artículos marcados como No hay.' };
        }
        item.clienteConfirmoNoHay = true;
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
            if (p.estado !== 'revisado') {
                return { ok: false, error: 'Espera la respuesta de Obebe antes de quitar artículos.' };
            }
        } else {
            if (!item.clienteConfirmoNoHay) {
                return {
                    ok: false,
                    error: 'El cliente debe confirmar primero que no hay stock (Confirmo ausencia).'
                };
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
        hit.todos[hit.idx] = p;
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

    function eliminarPedido(pedidoId, clienteKeyOpcional) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return Promise.resolve({ ok: false, error: 'Pedido no encontrado.' });
        if (clienteKeyOpcional != null && clienteKeyOpcional !== '') {
            if (claveCliente(hit.pedido.clienteKey) !== claveCliente(clienteKeyOpcional)) {
                return Promise.resolve({ ok: false, error: 'No puedes eliminar este pedido.' });
            }
        }
        if (hit.pedido.id === PEDIDO_NATY_LEGACY_ID) {
            return Promise.resolve({
                ok: false,
                error: 'Este pedido histórico (17/10/2026) se regenera desde el inventario NATY. Quita artículos en Inventario mayoreo si ya no aplican.'
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
            var fresh = findPedido(pedidoId);
            if (fresh.idx >= 0) {
                fresh.todos.splice(fresh.idx, 1);
                setPedidos(fresh.todos);
            }
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
        eliminarItemPedido: eliminarItemPedido,
        marcarClienteVioAvisoPedido: marcarClienteVioAvisoPedido,
        asegurarPedidoNatyLegacy20261017: asegurarPedidoNatyLegacy20261017,
        PEDIDO_NATY_LEGACY_ID: PEDIDO_NATY_LEGACY_ID
    };
})(window);
