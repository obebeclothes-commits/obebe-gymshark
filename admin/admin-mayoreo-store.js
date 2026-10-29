(function (global) {
    'use strict';

    var KEY_LINEAS = 'obebe_mayoreo_lineas_v1';
    var KEY_VENTAS = 'obebe_mayoreo_ventas_v1';
    var KEY_META = 'obebe_mayoreo_meta_v1';
    /** Stock actual NATY (lote inicial) */
    var FECHA_STOCK_LEGACY = '2026-10-17';

    function norm(s) {
        return String(s || '').trim().toLowerCase();
    }

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
            console.warn('[mayoreo-store]', e);
            return false;
        }
    }

    function idLineaDesdeSheet(r) {
        return [
            norm(r.cliente) || 'naty',
            String(r.filaSheet || ''),
            norm(r.nombre),
            norm(r.talla),
            norm(r.color),
            norm(r.tipo),
            norm(r.marca),
            String(r.precioMayoreo || 0)
        ].join('::');
    }

    function claveCliente(nombre) {
        return norm(nombre) || 'naty';
    }

    function migrarFechasLineas(lineas) {
        var dirty = false;
        (lineas || []).forEach(function (l) {
            if (!l.fechaStockIso) {
                l.fechaStockIso = FECHA_STOCK_LEGACY;
                dirty = true;
            }
        });
        return dirty;
    }

    function getLineas() {
        var arr = leerJson(KEY_LINEAS, []);
        if (!Array.isArray(arr)) arr = [];
        if (migrarFechasLineas(arr)) setLineas(arr);
        return arr;
    }

    function setLineas(arr) {
        guardarJson(KEY_LINEAS, arr || []);
    }

    function getVentas() {
        return leerJson(KEY_VENTAS, []);
    }

    function setVentas(arr) {
        guardarJson(KEY_VENTAS, arr || []);
    }

    function cantidadVendidaLinea(lineaId) {
        var total = 0;
        getVentas().forEach(function (v) {
            (v.lineas || []).forEach(function (l) {
                if (l.lineaId === lineaId) total += l.cantidad || 0;
            });
        });
        return total;
    }

    function recalcDisponible(linea) {
        var vendido = cantidadVendidaLinea(linea.id);
        linea.cantidadVendida = vendido;
        linea.cantidadDisponible = Math.max(0, (linea.cantidad || 0) - vendido);
    }

    function lineaFromSheet(r, imagenUrl) {
        var id = idLineaDesdeSheet(r);
        return {
            id: id,
            clienteKey: claveCliente(r.cliente),
            cliente: r.cliente || 'NATY',
            nombreSheet: r.nombre || '',
            nombreMostrar: r.nombre || '',
            cantidad: r.cantidad || 1,
            talla: r.talla || '',
            color: r.color || '',
            tipo: r.tipo || '',
            marca: r.marca || '',
            precioMayoreo: r.precioMayoreo || 0,
            precioRetail: r.precioRetail || 0,
            precioVentaPlaneado: r.precioVentaPlaneado || r.precioRetail || 0,
            imagenUrl: imagenUrl || r.imagenUrl || '',
            filaSheet: r.filaSheet || 0,
            fechaStockIso: r.fechaStockIso || FECHA_STOCK_LEGACY,
            importadoEn: Date.now()
        };
    }

    function idLineaDesdePedidoItem(it, clienteKey) {
        if (it.inventarioId) return String(it.inventarioId);
        return [
            claveCliente(clienteKey),
            'ped',
            norm(it.nombre),
            norm(it.talla),
            norm(it.color),
            norm(it.marca),
            String(it.precioCliente || 0)
        ].join('::');
    }

    function ingresarInventarioDesdePedido(pedido) {
        if (!pedido || pedido.estado !== 'revisado') {
            return { ok: false, error: 'Pedido no confirmado.' };
        }
        if (pedido.inventarioAplicado) {
            return { ok: true, omitido: true };
        }
        var k = claveCliente(pedido.clienteKey);
        var fecha = fechaLocalIso(new Date(pedido.revisadoEn || Date.now()));
        var lineas = getLineas();
        var nuevas = 0;
        (pedido.items || []).forEach(function (it) {
            if (it.disponibilidad !== 'si') return;
            var id = idLineaDesdePedidoItem(it, k);
            var qty = it.cantidad || 1;
            var hit = lineas.find(function (l) {
                return l.id === id && l.clienteKey === k;
            });
            if (hit) {
                hit.cantidad = (hit.cantidad || 0) + qty;
                hit.fechaStockIso = fecha;
                if (it.imagenUrl) hit.imagenUrl = it.imagenUrl;
                if (it.precioCliente != null) hit.precioMayoreo = it.precioCliente;
                if (it.precioRetail != null) hit.precioRetail = it.precioRetail;
            } else {
                lineas.push({
                    id: id,
                    clienteKey: k,
                    cliente: pedido.clienteNombre || 'NATY',
                    nombreSheet: it.nombre || '',
                    nombreMostrar: it.nombre || '',
                    cantidad: qty,
                    talla: it.talla || '',
                    color: it.color || '',
                    tipo: it.tipo || '',
                    marca: it.marca || '',
                    precioMayoreo: it.precioCliente || 0,
                    precioRetail: it.precioRetail || 0,
                    precioVentaPlaneado: it.precioRetail || it.precioCliente || 0,
                    imagenUrl: it.imagenUrl || '',
                    filaSheet: 0,
                    fechaStockIso: fecha,
                    importadoEn: Date.now()
                });
                nuevas += 1;
            }
        });
        lineas.forEach(function (l) {
            recalcDisponible(l);
        });
        setLineas(lineas);
        registrarMetaImportStock(lineas.filter(function (l) { return l.clienteKey === k; }));

        var todos = leerJson('obebe_mayoreo_pedidos_v1', []);
        if (Array.isArray(todos)) {
            var pi = todos.findIndex(function (p) { return p.id === pedido.id; });
            if (pi >= 0) {
                todos[pi].inventarioAplicado = true;
                todos[pi].inventarioAplicadoEn = Date.now();
                guardarJson('obebe_mayoreo_pedidos_v1', todos);
            }
        }
        return { ok: true, nuevas: nuevas };
    }

    function revertirInventarioDesdePedido(pedido) {
        if (!pedido || !pedido.inventarioAplicado) {
            return { ok: true, omitido: true };
        }
        var k = claveCliente(pedido.clienteKey);
        var lineas = getLineas();
        (pedido.items || []).forEach(function (it) {
            if (it.disponibilidad !== 'si') return;
            var id = idLineaDesdePedidoItem(it, k);
            var qty = it.cantidad || 1;
            var idx = lineas.findIndex(function (l) {
                return l.id === id && l.clienteKey === k;
            });
            if (idx < 0) return;
            lineas[idx].cantidad = Math.max(0, (lineas[idx].cantidad || 0) - qty);
            if (lineas[idx].cantidad <= 0) lineas.splice(idx, 1);
        });
        lineas.forEach(function (l) {
            recalcDisponible(l);
        });
        setLineas(lineas);
        registrarMetaImportStock(lineas.filter(function (l) { return l.clienteKey === k; }));

        var todos = leerJson('obebe_mayoreo_pedidos_v1', []);
        if (Array.isArray(todos)) {
            var pi = todos.findIndex(function (p) { return p.id === pedido.id; });
            if (pi >= 0) {
                todos[pi].inventarioAplicado = false;
                todos[pi].inventarioAplicadoEn = null;
                guardarJson('obebe_mayoreo_pedidos_v1', todos);
            }
        }
        return { ok: true };
    }

    function importFromSheet(lineasSheet, opts) {
        opts = opts || {};
        var existentes = getLineas();
        var map = {};
        existentes.forEach(function (l) { map[l.id] = l; });

        (lineasSheet || []).forEach(function (r) {
            var id = idLineaDesdeSheet(r);
            var prev = map[id];
            if (prev) {
                prev.cantidad = r.cantidad || prev.cantidad;
                prev.precioMayoreo = r.precioMayoreo != null ? r.precioMayoreo : prev.precioMayoreo;
                prev.precioRetail = r.precioRetail != null ? r.precioRetail : prev.precioRetail;
                if (r.imagenUrl) prev.imagenUrl = r.imagenUrl;
                if (!prev.nombreMostrar || prev.nombreMostrar === prev.nombreSheet) {
                    prev.nombreSheet = r.nombre || prev.nombreSheet;
                }
            } else {
                map[id] = lineaFromSheet(r, r.imagenUrl);
            }
        });

        var lista = Object.keys(map).map(function (k) {
            var l = map[k];
            recalcDisponible(l);
            return l;
        });
        setLineas(lista);
        registrarMetaImportStock(lista);
        return lista;
    }

    function getMetaMap() {
        return leerJson(KEY_META, {});
    }

    function setMetaMap(map) {
        guardarJson(KEY_META, map || {});
    }

    function registrarMetaImportStock(lineas) {
        var map = getMetaMap();
        var now = Date.now();
        var vistos = {};
        (lineas || []).forEach(function (l) {
            var k = l.clienteKey || claveCliente(l.cliente);
            if (vistos[k]) return;
            vistos[k] = true;
            if (!map[k]) map[k] = {};
            if (!map[k].fechaStockDesde) map[k].fechaStockDesde = now;
            map[k].ultimaActualizacionStock = now;
            map[k].unidadesStock = getLineasForCliente(k).reduce(function (s, x) {
                return s + (x.cantidad || 0);
            }, 0);
        });
        setMetaMap(map);
    }

    function metaCliente(clienteKey) {
        var k = claveCliente(clienteKey);
        return getMetaMap()[k] || {};
    }

    function hasLineas(clienteKey) {
        var k = claveCliente(clienteKey);
        return getLineas().some(function (l) { return l.clienteKey === k; });
    }

    function getLineasForCliente(clienteKey) {
        var k = claveCliente(clienteKey);
        return getLineas()
            .filter(function (l) { return l.clienteKey === k; })
            .map(function (l) {
                recalcDisponible(l);
                return l;
            });
    }

    function getAllLineasEnriched() {
        return getLineas().map(function (l) {
            recalcDisponible(l);
            return l;
        });
    }

    function updateLinea(id, patch) {
        var lista = getLineas();
        var idx = lista.findIndex(function (l) { return l.id === id; });
        if (idx < 0) return null;
        var l = lista[idx];
        if (patch.nombreMostrar != null) l.nombreMostrar = String(patch.nombreMostrar).trim() || l.nombreSheet;
        if (patch.precioVentaPlaneado != null) {
            var n = parseFloat(String(patch.precioVentaPlaneado).replace(/[^\d.-]/g, ''));
            l.precioVentaPlaneado = isNaN(n) ? 0 : n;
        }
        if (patch.imagenUrl != null) l.imagenUrl = patch.imagenUrl;
        if (patch.fechaStockIso != null) l.fechaStockIso = patch.fechaStockIso;
        recalcDisponible(l);
        lista[idx] = l;
        setLineas(lista);
        return l;
    }

    function lineaToMayoreoRow(l) {
        return {
            id: l.id,
            cliente: l.cliente,
            nombre: l.nombreMostrar || l.nombreSheet,
            nombreSheet: l.nombreSheet,
            cantidad: l.cantidad,
            cantidadDisponible: l.cantidadDisponible,
            cantidadVendida: l.cantidadVendida,
            talla: l.talla,
            color: l.color,
            tipo: l.tipo,
            marca: l.marca,
            precioMayoreo: l.precioMayoreo,
            precioRetail: l.precioRetail,
            precioVentaPlaneado: l.precioVentaPlaneado,
            imagenUrl: l.imagenUrl,
            filaSheet: l.filaSheet,
            fechaStockIso: l.fechaStockIso || FECHA_STOCK_LEGACY
        };
    }

    function resumenGananciaCliente(clienteKey) {
        var k = claveCliente(clienteKey);
        var ventas = ventasForCliente(k);
        var map = {};
        getLineas().forEach(function (l) {
            if (l.clienteKey === k) map[l.id] = l;
        });
        var totalVendido = 0;
        var utilidadTotal = 0;
        var piezasVendidas = 0;
        ventas.forEach(function (v) {
            totalVendido += v.total || 0;
            (v.lineas || []).forEach(function (vl) {
                var q = vl.cantidad || 0;
                piezasVendidas += q;
                var ln = map[vl.lineaId];
                var costo = ln ? (ln.precioMayoreo || 0) : 0;
                var precio = vl.precioUnitario || 0;
                utilidadTotal += (precio - costo) * q;
            });
        });
        return {
            totalVendido: totalVendido,
            utilidadTotal: utilidadTotal,
            piezasVendidas: piezasVendidas
        };
    }

    function filtrarLineasStore(lineas, query) {
        query = norm(query);
        if (!query) return lineas;
        return lineas.filter(function (r) {
            var blob = [
                r.nombre, r.nombreMostrar, r.nombreSheet, r.talla, r.color, r.tipo, r.marca
            ].join(' ').toLowerCase();
            return blob.indexOf(query) >= 0;
        });
    }

    function fechaLocalIso(d) {
        d = d || new Date();
        var y = d.getFullYear();
        var m = d.getMonth() + 1;
        var day = d.getDate();
        return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    }

    function normalizarFechaStockIso(fecha) {
        var s = String(fecha || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) {
            return m[3] + '-' + (m[2].length < 2 ? '0' : '') + m[2] +
                '-' + (m[1].length < 2 ? '0' : '') + m[1];
        }
        return s;
    }

    /** Quita líneas de inventario mayoreo con esa fecha de stock (p. ej. pedido revertido). */
    function eliminarLineasPorFechaStock(clienteKey, fechaIso) {
        var k = claveCliente(clienteKey);
        fechaIso = normalizarFechaStockIso(fechaIso);
        if (!fechaIso) return { ok: false, error: 'Fecha inválida.' };
        var lineas = getLineas();
        var removed = 0;
        var skipped = 0;
        var kept = lineas.filter(function (l) {
            if (l.clienteKey !== k || l.fechaStockIso !== fechaIso) return true;
            recalcDisponible(l);
            if ((l.cantidadVendida || 0) > 0) {
                skipped += 1;
                return true;
            }
            removed += 1;
            return false;
        });
        setLineas(kept);
        registrarMetaImportStock(kept.filter(function (l) { return l.clienteKey === k; }));
        return { ok: true, removed: removed, skipped: skipped, fechaIso: fechaIso, clienteKey: k };
    }

    var KEY_LIMPIEZA_NATY_INV_2910 = 'obebe_naty_quitar_inv_20261029_v1';

    function ejecutarLimpiezaProgramadaMayoreo() {
        try {
            if (localStorage.getItem(KEY_LIMPIEZA_NATY_INV_2910)) {
                return { ok: true, omitido: true };
            }
        } catch (e) { /* ignore */ }
        var res = eliminarLineasPorFechaStock('naty', '2026-10-29');
        try {
            localStorage.setItem(KEY_LIMPIEZA_NATY_INV_2910, String(Date.now()));
        } catch (e) { /* ignore */ }
        return res;
    }

    function registrarVenta(payload) {
        payload = payload || {};
        var clienteKey = claveCliente(payload.clienteKey || 'naty');
        var items = payload.items || [];
        if (!nombreCompradorValido(payload.comprador)) {
            return { ok: false, error: 'Escribe el nombre del cliente.' };
        }
        if (!items.length) return { ok: false, error: 'Agrega al menos un artículo.' };

        var lineas = getLineas();
        var ventaLineas = [];
        var total = 0;

        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var linea = lineas.find(function (l) { return l.id === it.lineaId && l.clienteKey === clienteKey; });
            if (!linea) return { ok: false, error: 'Artículo no encontrado.' };
            recalcDisponible(linea);
            var qty = parseInt(it.cantidad, 10);
            if (isNaN(qty) || qty <= 0) return { ok: false, error: 'Cantidad inválida.' };
            if (qty > linea.cantidadDisponible) {
                return { ok: false, error: 'Stock insuficiente para ' + (linea.nombreMostrar || linea.nombreSheet) + '.' };
            }
            var precio = parseFloat(String(it.precioUnitario).replace(/[^\d.-]/g, ''));
            if (isNaN(precio) || precio < 0) return { ok: false, error: 'Precio inválido.' };
            var sub = precio * qty;
            total += sub;
            ventaLineas.push({
                lineaId: linea.id,
                nombre: linea.nombreMostrar || linea.nombreSheet,
                cantidad: qty,
                precioUnitario: precio,
                subtotal: sub,
                imagenUrl: linea.imagenUrl || ''
            });
        }

        var venta = {
            id: 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            fechaIso: payload.fechaIso || fechaLocalIso(),
            comprador: String(payload.comprador || '').trim(),
            metodoPago: payload.metodoPago || 'efectivo',
            clienteKey: clienteKey,
            total: total,
            lineas: ventaLineas,
            creadoEn: Date.now()
        };

        var ventas = getVentas();
        ventas.unshift(venta);
        setVentas(ventas);
        setLineas(lineas.map(function (l) {
            recalcDisponible(l);
            return l;
        }));

        return { ok: true, venta: venta };
    }

    function ventasForCliente(clienteKey) {
        var k = claveCliente(clienteKey);
        return getVentas().filter(function (v) { return v.clienteKey === k; });
    }

    function nombreCompradorValido(nombre) {
        var t = String(nombre || '').trim();
        if (!t) return false;
        return norm(t) !== 'sin nombre';
    }

    function calcularRankingClientes(clienteKey) {
        var ventas = ventasForCliente(clienteKey);
        var map = {};
        ventas.forEach(function (v) {
            var nombre = String(v.comprador || '').trim();
            if (!nombreCompradorValido(nombre)) return;
            var key = 'nom:' + norm(nombre);
            if (!map[key]) {
                map[key] = {
                    id: key,
                    nombre: nombre,
                    gasto: 0,
                    numVentas: 0,
                    articulos: 0,
                    ultimaCompraIso: '',
                    ultimaCompraTs: 0
                };
            }
            var c = map[key];
            c.gasto += v.total || 0;
            c.numVentas += 1;
            (v.lineas || []).forEach(function (l) {
                c.articulos += l.cantidad || 0;
            });
            var ts = v.creadoEn || 0;
            if (!ts && v.fechaIso) {
                var p = Date.parse(v.fechaIso);
                ts = isNaN(p) ? 0 : p;
            }
            if (ts >= c.ultimaCompraTs) {
                c.ultimaCompraTs = ts;
                c.ultimaCompraIso = v.fechaIso || c.ultimaCompraIso;
            }
            if (nombre.length >= c.nombre.length) c.nombre = nombre;
        });
        var lista = Object.keys(map).map(function (k) { return map[k]; });
        lista.sort(function (a, b) {
            if (b.gasto !== a.gasto) return b.gasto - a.gasto;
            if (b.numVentas !== a.numVentas) return b.numVentas - a.numVentas;
            return b.articulos - a.articulos;
        });
        lista.forEach(function (c, i) { c.ranking = i + 1; });
        return lista;
    }

    function filtrarRankingClientes(lista, query) {
        query = norm(query);
        if (!query) return lista || [];
        return (lista || []).filter(function (c) {
            var blob = [c.nombre, String(c.ranking)].join(' ').toLowerCase();
            return blob.indexOf(query) >= 0;
        });
    }

    function resumenActividadVenta(clienteKey) {
        var ventas = ventasForCliente(clienteKey);
        var articulosVendidos = 0;
        var totalVendido = 0;
        ventas.forEach(function (v) {
            totalVendido += v.total || 0;
            (v.lineas || []).forEach(function (l) {
                articulosVendidos += l.cantidad || 0;
            });
        });
        return {
            numVentas: ventas.length,
            articulosVendidos: articulosVendidos,
            totalVendido: totalVendido
        };
    }

    function resumenVentas(clienteKey) {
        var ventas = ventasForCliente(clienteKey);
        var hoy = fechaLocalIso();
        var ahora = new Date();
        var mes = ahora.getFullYear() + '-' + (ahora.getMonth() + 1 < 10 ? '0' : '') + (ahora.getMonth() + 1);
        var porDia = {};
        var porMes = {};
        var totalHoy = 0;
        var totalMes = 0;
        var countHoy = 0;
        var countMes = 0;

        ventas.forEach(function (v) {
            var d = v.fechaIso || '';
            var m = d.slice(0, 7);
            porDia[d] = (porDia[d] || 0) + (v.total || 0);
            porMes[m] = (porMes[m] || 0) + (v.total || 0);
            if (d === hoy) {
                totalHoy += v.total || 0;
                countHoy++;
            }
            if (m === mes) {
                totalMes += v.total || 0;
                countMes++;
            }
        });

        return {
            totalHoy: totalHoy,
            countHoy: countHoy,
            totalMes: totalMes,
            countMes: countMes,
            porDia: porDia,
            porMes: porMes,
            ventas: ventas
        };
    }

    function exportBackup() {
        return {
            lineas: getLineas(),
            ventas: getVentas(),
            exportadoEn: new Date().toISOString()
        };
    }

    function actualizarVenta(ventaId, clienteKey, patch) {
        patch = patch || {};
        var k = claveCliente(clienteKey);
        var ventas = getVentas();
        var idx = ventas.findIndex(function (v) {
            return v.id === ventaId && claveCliente(v.clienteKey) === k;
        });
        if (idx < 0) return { ok: false, error: 'Venta no encontrada.' };
        var v = ventas[idx];
        if (patch.comprador != null) {
            if (!nombreCompradorValido(patch.comprador)) {
                return { ok: false, error: 'Escribe un nombre de cliente válido.' };
            }
            v.comprador = String(patch.comprador).trim();
        }
        if (patch.fechaIso != null) {
            var f = String(patch.fechaIso).trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) {
                return { ok: false, error: 'Fecha inválida.' };
            }
            v.fechaIso = f;
        }
        if (patch.metodoPago != null) {
            var mp = norm(patch.metodoPago);
            if (mp !== 'efectivo' && mp !== 'tarjeta' && mp !== 'transferencia') {
                return { ok: false, error: 'Forma de pago inválida.' };
            }
            v.metodoPago = mp;
        }
        ventas[idx] = v;
        setVentas(ventas);
        return { ok: true, venta: v };
    }

    function eliminarVenta(ventaId, clienteKey) {
        var k = claveCliente(clienteKey);
        var ventas = getVentas();
        var idx = ventas.findIndex(function (v) {
            return v.id === ventaId && claveCliente(v.clienteKey) === k;
        });
        if (idx < 0) return { ok: false, error: 'Venta no encontrada.' };
        ventas.splice(idx, 1);
        setVentas(ventas);
        setLineas(getLineas().map(function (l) {
            recalcDisponible(l);
            return l;
        }));
        return { ok: true };
    }

    global.ObebeMayoreoStore = {
        importFromSheet: importFromSheet,
        hasLineas: hasLineas,
        getLineasForCliente: getLineasForCliente,
        getAllLineasEnriched: getAllLineasEnriched,
        updateLinea: updateLinea,
        lineaToMayoreoRow: lineaToMayoreoRow,
        filtrarLineasStore: filtrarLineasStore,
        registrarVenta: registrarVenta,
        ventasForCliente: ventasForCliente,
        resumenVentas: resumenVentas,
        actualizarVenta: actualizarVenta,
        eliminarVenta: eliminarVenta,
        resumenActividadVenta: resumenActividadVenta,
        calcularRankingClientes: calcularRankingClientes,
        filtrarRankingClientes: filtrarRankingClientes,
        exportBackup: exportBackup,
        claveCliente: claveCliente,
        metaCliente: metaCliente,
        ingresarInventarioDesdePedido: ingresarInventarioDesdePedido,
        revertirInventarioDesdePedido: revertirInventarioDesdePedido,
        eliminarLineasPorFechaStock: eliminarLineasPorFechaStock,
        ejecutarLimpiezaProgramadaMayoreo: ejecutarLimpiezaProgramadaMayoreo,
        resumenGananciaCliente: resumenGananciaCliente,
        FECHA_STOCK_LEGACY: FECHA_STOCK_LEGACY
    };
})(window);
