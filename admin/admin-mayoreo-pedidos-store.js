(function (global) {
    'use strict';

    var KEY = 'obebe_mayoreo_pedidos_v1';

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

    function pedidosForCliente(clienteKey) {
        var k = claveCliente(clienteKey);
        return getPedidos()
            .filter(function (p) { return claveCliente(p.clienteKey) === k; })
            .sort(function (a, b) { return (b.creadoEn || 0) - (a.creadoEn || 0); });
    }

    function listarTodos(filtroClienteKey) {
        var list = getPedidos().slice().sort(function (a, b) {
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
        if (hit.idx < 0) return { ok: false, error: 'Pedido no encontrado.' };
        var p = hit.pedido;
        if (p.estado !== 'revisado') {
            return { ok: false, error: 'Solo puedes modificar pedidos ya enviados.' };
        }
        if (global.ObebeMayoreoStore && global.ObebeMayoreoStore.revertirInventarioDesdePedido) {
            global.ObebeMayoreoStore.revertirInventarioDesdePedido(p);
        }
        p.estado = 'en_revision';
        p.revisadoEn = null;
        p.inventarioAplicado = false;
        hit.todos[hit.idx] = p;
        setPedidos(hit.todos);
        return { ok: true, pedido: p };
    }

    function confirmarRevisionPedido(pedidoId) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return { ok: false, error: 'Pedido no encontrado.' };
        var p = hit.pedido;
        if (!todosItemsMarcados(p)) {
            return { ok: false, error: 'Marca disponibilidad en todos los artículos.' };
        }
        p.estado = 'revisado';
        p.revisadoEn = Date.now();
        hit.todos[hit.idx] = p;
        setPedidos(hit.todos);
        if (global.ObebeMayoreoStore && global.ObebeMayoreoStore.ingresarInventarioDesdePedido) {
            global.ObebeMayoreoStore.ingresarInventarioDesdePedido(p);
        }
        return { ok: true, pedido: p };
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

    function eliminarPedido(pedidoId, clienteKeyOpcional) {
        var hit = findPedido(pedidoId);
        if (hit.idx < 0) return { ok: false, error: 'Pedido no encontrado.' };
        if (clienteKeyOpcional != null && clienteKeyOpcional !== '') {
            if (claveCliente(hit.pedido.clienteKey) !== claveCliente(clienteKeyOpcional)) {
                return { ok: false, error: 'No puedes eliminar este pedido.' };
            }
        }
        hit.todos.splice(hit.idx, 1);
        setPedidos(hit.todos);
        return { ok: true };
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
        todosItemsMarcados: todosItemsMarcados,
        actualizarEstado: actualizarEstado,
        claveCliente: claveCliente
    };
})(window);
