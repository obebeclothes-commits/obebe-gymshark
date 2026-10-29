(function (global) {
    'use strict';

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function kpi(label, value, hint) {
        return '<div class="admin-kpi"><div class="label">' + esc(label) + '</div>' +
            '<div class="value">' + esc(String(value)) + '</div>' +
            (hint ? '<div class="hint">' + esc(hint) + '</div>' : '') + '</div>';
    }

    global.adminMayoreoImgFallback = function (img) {
        if (!img || !img.dataset) return;
        var fb1 = img.dataset.fb1;
        var fb2 = img.dataset.fb2;
        if (img.src.indexOf('.webp') >= 0 && !img.dataset.fbAvif) {
            img.dataset.fbAvif = '1';
            img.src = img.src.replace(/\.webp(\?|$)/i, '.avif$1');
            return;
        }
        if (fb1 && img.src.indexOf(fb1) < 0) {
            img.src = fb1;
            img.dataset.fb1 = '';
            return;
        }
        if (fb2 && img.src.indexOf(fb2) < 0) {
            img.src = fb2;
            img.dataset.fb2 = '';
            return;
        }
        img.style.visibility = 'hidden';
    };

    function fallbacksImagen(url) {
        if (!url) return { fb1: '', fb2: '' };
        var base = url.split('?')[0];
        return {
            fb1: base.replace(/\.webp$/i, '.jpeg') + '?v=20261021b',
            fb2: base.replace(/\.webp$/i, '.jpg') + '?v=20261021b'
        };
    }

    function celdaImagenMayoreo(url, alt) {
        if (!url) {
            return '<td class="admin-mayoreo-thumb"><span class="admin-mayoreo-thumb-empty" aria-hidden="true"></span></td>';
        }
        var fb = fallbacksImagen(url);
        return '<td class="admin-mayoreo-thumb"><img src="' + esc(url) + '" alt="' + esc(alt || 'Artículo') +
            '" loading="lazy" decoding="async" width="56" height="56" onerror="adminMayoreoImgFallback(this)"' +
            ' data-fb1="' + esc(fb.fb1) + '" data-fb2="' + esc(fb.fb2) + '"></td>';
    }

    function celdaPrecioVenta(r) {
        var val = r.precioVentaPlaneado || 0;
        return '<td class="admin-precio-venta-cell">' +
            '<span class="admin-precio-venta-display">' + ObebeAdminData.formatoMoney(val) + '</span>' +
            '<input type="number" class="admin-inline-input admin-mayoreo-precio-venta admin-hidden" min="0" step="1" ' +
            'value="' + val + '" data-linea-id="' + esc(r.id) + '" disabled>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-mayoreo-editar-precio" ' +
            'data-linea-id="' + esc(r.id) + '">Editar</button></td>';
    }

    function lineasStoreEnriquecidas(clienteKey, filasInv) {
        return ObebeMayoreoStore.getLineasForCliente(clienteKey).map(function (l) {
            var row = ObebeMayoreoStore.lineaToMayoreoRow(l);
            if (!row.imagenUrl && ObebeAdminData.imagenParaLineaMayoreo) {
                row.imagenUrl = ObebeAdminData.imagenParaLineaMayoreo({
                    nombre: l.nombreSheet,
                    talla: l.talla,
                    color: l.color,
                    tipo: l.tipo,
                    marca: l.marca
                }, filasInv || []);
            }
            return row;
        });
    }

    function tablaClientesMayoreo(clientes, clickable) {
        if (!clientes.length) {
            return '<p class="admin-muted-text" style="padding:1rem">Sin clientes en mayoreo.</p>';
        }
        var rows = clientes.map(function (c, i) {
            var nombreCell = clickable
                ? '<button type="button" class="admin-link-btn admin-mayoreo-cliente-link" data-cliente-key="' +
                esc(c.id || '') + '" data-cliente-nombre="' + esc(c.nombre) + '">' + esc(c.nombre) + '</button>'
                : esc(c.nombre);
            return '<tr><td><strong>#' + (i + 1) + '</strong></td>' +
                '<td>' + nombreCell + '</td>' +
                '<td>' + c.articulos + '</td>' +
                '<td>' + ObebeAdminData.formatoMoney(c.totalCobrado) + '</td>' +
                '<td>' + ObebeAdminData.formatoMoney(c.utilidad) + '</td></tr>';
        }).join('');
        return '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
            '<th>#</th><th>Cliente</th><th>Unidades</th>' +
            '<th>Total cobrado</th><th>Utilidad</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    function tablaDesgloseCliente(lineas) {
        var tMayoreo = 0;
        var tRetail = 0;
        var tEllos = 0;
        var rows = (lineas || []).map(function (r) {
            tMayoreo += r.precioMayoreo || 0;
            tRetail += r.precioRetail || 0;
            tEllos += r.precioVentaPlaneado || 0;
            var disp = r.cantidadDisponible != null ? r.cantidadDisponible : r.cantidad;
            return '<tr><td>' + esc(r.nombre) + '</td>' +
                '<td>' + r.cantidad + (disp < r.cantidad ? ' <span class="admin-tag admin-tag-warn">disp. ' + disp + '</span>' : '') + '</td>' +
                '<td>' + esc(r.talla) + '</td><td>' + esc(r.color) + '</td>' +
                '<td>' + esc(r.tipo) + '</td><td>' + esc(r.marca) + '</td>' +
                '<td>' + ObebeAdminData.formatoMoney(r.precioMayoreo) + '</td>' +
                '<td>' + ObebeAdminData.formatoMoney(r.precioRetail) + '</td>' +
                '<td>' + ObebeAdminData.formatoMoney(r.precioVentaPlaneado) + '</td>' +
                celdaImagenMayoreo(r.imagenUrl, r.nombre) + '</tr>';
        }).join('');
        var foot = '<tr class="admin-row-total"><td colspan="6"><strong>Totales</strong></td>' +
            '<td><strong>' + ObebeAdminData.formatoMoney(tMayoreo) + '</strong></td>' +
            '<td><strong>' + ObebeAdminData.formatoMoney(tRetail) + '</strong></td>' +
            '<td><strong>' + ObebeAdminData.formatoMoney(tEllos) + '</strong></td>' +
            '<td></td></tr>';
        return '<div class="admin-table-wrap"><table class="admin-table admin-table-compact"><thead><tr>' +
            '<th>Artículo</th><th>Cant.</th><th>Talla</th><th>Color</th><th>Tipo</th><th>Marca</th>' +
            '<th>Precio mayoreo</th><th>Precio venta OBEBE</th><th>Precio venta cliente</th><th></th>' +
            '</tr></thead><tbody>' +
            (rows || '<tr><td colspan="10">Sin líneas en inventario local</td></tr>') +
            foot + '</tbody></table></div>';
    }

    function fmtFechaPedidoMs(ms) {
        if (!ms) return '—';
        var d = new Date(ms);
        if (isNaN(d.getTime())) return '—';
        return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
    }

    function etiquetaEstadoPedidoSimple(estado) {
        var m = {
            pendiente: 'Pendiente',
            en_revision: 'En revisión',
            revisado: 'Revisado',
            cancelado: 'Cancelado'
        };
        return m[estado] || String(estado || '');
    }

    function mapLineasPorId(lineas) {
        var map = {};
        (lineas || []).forEach(function (l) { map[l.id] = l; });
        return map;
    }

    function filaDesdeItemPedido(it, mapLineas) {
        var ln = it.inventarioId ? mapLineas[it.inventarioId] : null;
        return {
            nombre: it.nombre || (ln && ln.nombre) || '',
            cantidad: it.cantidad || 1,
            talla: it.talla || (ln && ln.talla) || '',
            color: it.color || (ln && ln.color) || '',
            tipo: it.tipo || (ln && ln.tipo) || '',
            marca: it.marca || (ln && ln.marca) || '',
            precioMayoreo: it.precioCliente != null ? it.precioCliente : (ln && ln.precioMayoreo) || 0,
            precioRetail: it.precioRetail != null ? it.precioRetail : (ln && ln.precioRetail) || 0,
            precioVentaPlaneado: ln ? (ln.precioVentaPlaneado || 0) : (it.precioRetail || 0),
            imagenUrl: it.imagenUrl || (ln && ln.imagenUrl) || '',
            cantidadDisponible: ln && ln.cantidadDisponible != null ? ln.cantidadDisponible : (it.cantidad || 1)
        };
    }

    function bloquePedidoDesglose(p, mapLineas, expanded) {
        var filas = (p.items || []).map(function (it) {
            return filaDesdeItemPedido(it, mapLineas);
        });
        if (!filas.length) return '';
        var fecha = fmtFechaPedidoMs(p.creadoEn || p.revisadoEn);
        var tituloFecha = p.tituloFecha || fecha;
        var meta = (p.pedidoCombinado ? 'Combinado · ' : '') +
            etiquetaEstadoPedidoSimple(p.estado) + ' · ' +
            (p.unidades || filas.length) + ' pzas. · ' +
            ObebeAdminData.formatoMoney(p.totalCliente || 0);
        return '<div class="admin-mayoreo-ped-block" data-pedido-id="' + esc(p.id) + '">' +
            '<button type="button" class="admin-mayoreo-ped-toggle" data-pedido-id="' + esc(p.id) + '">' +
            '<span class="admin-mayoreo-ped-toggle-fecha">' + esc(tituloFecha) + '</span>' +
            '<span class="admin-mayoreo-ped-toggle-meta">' + esc(meta) + '</span>' +
            '<span class="admin-ped-card-chevron" aria-hidden="true">' + (expanded ? '▾' : '▸') + '</span></button>' +
            '<div class="admin-mayoreo-ped-body' + (expanded ? '' : ' admin-hidden') + '">' +
            tablaDesgloseCliente(filas) + '</div></div>';
    }

    function panelDesgloseCliente(clienteKey, nombre, filasInv, expandedPedidos) {
        expandedPedidos = expandedPedidos || {};
        var lineas = lineasStoreEnriquecidas(clienteKey, filasInv);
        var mapLineas = mapLineasPorId(lineas);
        var pedidos = global.ObebeMayoreoPedidosStore
            ? ObebeMayoreoPedidosStore.pedidosForCliente(clienteKey)
            : [];
        pedidos = pedidos.slice().sort(function (a, b) {
            return (b.creadoEn || 0) - (a.creadoEn || 0);
        });

        var idsEnPedidos = {};
        pedidos.forEach(function (p) {
            (p.items || []).forEach(function (it) {
                if (it.inventarioId) idsEnPedidos[it.inventarioId] = true;
            });
        });

        var bloques = pedidos.map(function (p) {
            return bloquePedidoDesglose(p, mapLineas, !!expandedPedidos[p.id]);
        }).filter(Boolean).join('');

        var sueltas = lineas.filter(function (l) { return !idsEnPedidos[l.id]; });
        if (sueltas.length) {
            bloques += bloquePedidoDesglose({
                id: '__inventario_extra__',
                tituloFecha: 'Inventario · otras entradas',
                estado: 'revisado',
                creadoEn: 0,
                unidades: sueltas.reduce(function (s, l) { return s + (l.cantidad || 0); }, 0),
                totalCliente: sueltas.reduce(function (s, l) {
                    return s + (l.precioMayoreo || 0) * (l.cantidad || 1);
                }, 0),
                items: sueltas.map(function (l) {
                    return {
                        inventarioId: l.id,
                        nombre: l.nombre,
                        cantidad: l.cantidad,
                        talla: l.talla,
                        color: l.color,
                        tipo: l.tipo,
                        marca: l.marca,
                        precioCliente: l.precioMayoreo,
                        precioRetail: l.precioRetail,
                        imagenUrl: l.imagenUrl
                    };
                })
            }, mapLineas, !!expandedPedidos.__inventario_extra__);
        }

        if (!bloques) {
            bloques = bloquePedidoDesglose({
                id: '__inventario_todo__',
                tituloFecha: 'Inventario',
                estado: 'revisado',
                creadoEn: Date.now(),
                unidades: lineas.reduce(function (s, l) { return s + (l.cantidad || 0); }, 0),
                totalCliente: 0,
                items: lineas.map(function (l) {
                    return {
                        inventarioId: l.id,
                        nombre: l.nombre,
                        cantidad: l.cantidad,
                        talla: l.talla,
                        color: l.color,
                        tipo: l.tipo,
                        marca: l.marca,
                        precioCliente: l.precioMayoreo,
                        precioRetail: l.precioRetail,
                        imagenUrl: l.imagenUrl
                    };
                })
            }, mapLineas, true);
        }

        return '<div class="admin-panel admin-panel-desglose" data-cliente-key="' + esc(clienteKey) + '" data-cliente-nombre="' + esc(nombre) + '">' +
            '<div class="admin-panel-head admin-panel-head--mayoreo-desglose">' +
            '<div class="admin-mayoreo-desglose-title">' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-mayoreo-cerrar-desglose admin-mayoreo-volver-clientes">← Clientes</button>' +
            '<h3>' + esc(nombre) + '</h3></div></div>' +
            '<div class="admin-mayoreo-ped-list">' + bloques + '</div></div>';
    }

    function tablaDetalle(lineas, limite, opts) {
        opts = opts || {};
        limite = limite || 400;
        var slice = lineas.slice(0, limite);
        var soloCliente = !!opts.vistaCliente;
        var rows = slice.map(function (r) {
            if (soloCliente) {
                var disp = r.cantidadDisponible != null ? r.cantidadDisponible : r.cantidad;
                var fStock = r.fechaStockIso
                    ? ObebeAdminData.formatoFecha(r.fechaStockIso, '')
                    : ObebeAdminData.formatoFecha(ObebeMayoreoStore.FECHA_STOCK_LEGACY, '');
                return '<tr data-linea-id="' + esc(r.id) + '">' +
                    '<td>' + esc(r.nombre) + '</td>' +
                    '<td>' + r.cantidad + (disp < r.cantidad ? ' <span class="admin-tag admin-tag-warn">disp. ' + disp + '</span>' : '') + '</td>' +
                    '<td>' + esc(fStock) + '</td>' +
                    '<td>' + esc(r.talla) + '</td><td>' + esc(r.color) + '</td>' +
                    '<td>' + esc(r.tipo) + '</td><td>' + esc(r.marca) + '</td>' +
                    '<td>' + ObebeAdminData.formatoMoney(r.precioMayoreo) + '</td>' +
                    celdaPrecioVenta(r) +
                    celdaImagenMayoreo(r.imagenUrl, r.nombre) + '</tr>';
            }
            return '<tr><td>' + esc(r.cliente) + '</td><td>' + esc(r.nombre) + '</td>' +
                '<td>' + r.cantidad + '</td><td>' + esc(r.talla) + '</td><td>' + esc(r.color) + '</td>' +
                '<td>' + esc(r.tipo) + '</td><td>' + esc(r.marca) + '</td>' +
                '<td>' + ObebeAdminData.formatoMoney(r.precioRetail) + '</td>' +
                '<td>' + ObebeAdminData.formatoMoney(r.precioMayoreo) + '</td>' +
                '<td>' + ObebeAdminData.formatoMoney(r.utilidadLinea) + '</td></tr>';
        }).join('');
        var extra = lineas.length > limite
            ? '<p class="admin-muted-text" style="padding:0.5rem 1rem">Mostrando ' + limite + ' de ' + lineas.length + '.</p>' : '';
        var head;
        var emptyColspan;
        if (soloCliente) {
            head = '<th>Artículo</th><th>Cant.</th><th>Fecha stock</th><th>Talla</th><th>Color</th><th>Tipo</th><th>Marca</th>' +
                '<th>Precio mayoreo</th><th>Precio de venta</th><th></th>';
            emptyColspan = 10;
        } else {
            head = '<th>Cliente</th><th>Artículo</th><th>Cant.</th><th>Talla</th><th>Color</th><th>Tipo</th><th>Marca</th>' +
                '<th>Retail</th><th>Mayoreo</th><th>Utilidad</th>';
            emptyColspan = 10;
        }
        return extra + '<div class="admin-table-wrap"><table class="admin-table admin-table-compact"><thead><tr>' +
            head + '</tr></thead><tbody>' +
            (rows || '<tr><td colspan="' + emptyColspan + '">Sin líneas</td></tr>') + '</tbody></table></div>';
    }

    function bindEdicionPrecio(container) {
        container.querySelectorAll('.admin-mayoreo-editar-precio').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var cell = btn.closest('.admin-precio-venta-cell');
                if (!cell) return;
                var input = cell.querySelector('.admin-mayoreo-precio-venta');
                var display = cell.querySelector('.admin-precio-venta-display');
                var editando = btn.getAttribute('data-mode') === 'edit';

                if (!editando) {
                    btn.setAttribute('data-mode', 'edit');
                    btn.textContent = 'Guardar';
                    display.classList.add('admin-hidden');
                    input.classList.remove('admin-hidden');
                    input.disabled = false;
                    input.focus();
                    return;
                }

                var id = btn.getAttribute('data-linea-id');
                ObebeMayoreoStore.updateLinea(id, { precioVentaPlaneado: input.value });
                var n = parseFloat(String(input.value).replace(/[^\d.-]/g, ''));
                display.textContent = ObebeAdminData.formatoMoney(isNaN(n) ? 0 : n);
                btn.removeAttribute('data-mode');
                btn.textContent = 'Editar';
                input.classList.add('admin-hidden');
                input.disabled = true;
                display.classList.remove('admin-hidden');
            });
        });
    }

    function mount(container, datos) {
        datos = datos || {};
        var rm = datos.resumenMayoreo || {};
        var clientes = datos.clientesMayoreo || [];
        var lineas = datos.lineasMayoreo || [];
        var filasInv = datos.filasInv || [];
        var vistaCliente = !!datos.vistaCliente;
        var aviso = datos.errorMayoreo
            ? '<div class="admin-banner" style="border-color:var(--admin-warn)">' + esc(datos.errorMayoreo) + '</div>' : '';
        var kpis;
        if (vistaCliente) {
            var ck = datos.clienteKey || 'naty';
            var gan = ObebeMayoreoStore.resumenGananciaCliente(ck);
            var pzas = gan.piezasVendidas || 0;
            kpis = '<div class="admin-kpi-grid">' +
                kpi('Unidades', rm.articulos || 0) +
                kpi('Total invertido', ObebeAdminData.formatoMoney(rm.totalCobrado || 0)) +
                kpi('Lo vendido', ObebeAdminData.formatoMoney(gan.totalVendido || 0), pzas + ' pzas.') +
                kpi('Utilidad total', ObebeAdminData.formatoMoney(gan.utilidadTotal || 0), pzas + ' pzas.') +
                '</div>';
        } else {
            kpis = '<div class="admin-kpi-grid">' +
                kpi('Clientes mayoreo', rm.clientes || 0) +
                kpi('Unidades', rm.articulos || 0) +
                kpi('Total cobrado', ObebeAdminData.formatoMoney(rm.totalCobrado || 0)) +
                kpi('Utilidad', ObebeAdminData.formatoMoney(rm.utilidad || 0)) +
                '</div>';
        }

        var panelClientes = vistaCliente ? '' :
            '<div class="admin-panel" id="adminMayoreoPanelClientes"><div class="admin-panel-head"><h3>Clientes de mayoreo</h3></div>' +
            '<div id="adminMayoreoTablaClientes">' + tablaClientesMayoreo(clientes, true) + '</div></div>' +
            '<div id="adminMayoreoDesglose" class="admin-hidden"></div>';

        var tituloDetalle = vistaCliente ? 'Inventario' : 'Detalle de pedidos';

        container.innerHTML = aviso +
            '<div id="adminMayoreoKpis">' + kpis + '</div>' +
            panelClientes +
            '<div class="admin-panel" id="adminMayoreoPanelDetalle"><div class="admin-panel-head"><h3>' + esc(tituloDetalle) + '</h3>' +
            '<input type="search" class="admin-search" id="adminSearchMayoreo" placeholder="Buscar artículo, talla, marca…"></div>' +
            '<div id="adminMayoreoDetalle"></div></div>';

        var filtrarFn = vistaCliente
            ? ObebeMayoreoStore.filtrarLineasStore
            : ObebeAdminData.filtrarLineasMayoreo;

        function pintar(q) {
            var det = document.getElementById('adminMayoreoDetalle');
            var filtradas = filtrarFn(lineas, q);
            det.innerHTML = tablaDetalle(filtradas, 400, { vistaCliente: vistaCliente });
            if (vistaCliente) bindEdicionPrecio(det);
        }
        pintar('');
        var input = document.getElementById('adminSearchMayoreo');
        if (input) input.addEventListener('input', function () { pintar(input.value); });

        if (!vistaCliente) {
            var desgloseExpanded = {};
            var desgloseClienteActivo = { key: '', nombre: '' };

            function pintarDesgloseCliente() {
                var box = document.getElementById('adminMayoreoDesglose');
                if (!box || !desgloseClienteActivo.key) return;
                box.innerHTML = panelDesgloseCliente(
                    desgloseClienteActivo.key,
                    desgloseClienteActivo.nombre,
                    filasInv,
                    desgloseExpanded
                );
            }

            container.addEventListener('click', function (ev) {
                var togglePed = ev.target.closest('.admin-mayoreo-ped-toggle');
                if (togglePed) {
                    var pid = togglePed.getAttribute('data-pedido-id');
                    desgloseExpanded[pid] = !desgloseExpanded[pid];
                    pintarDesgloseCliente();
                    return;
                }
                var link = ev.target.closest('.admin-mayoreo-cliente-link');
                if (link) {
                    var key = link.getAttribute('data-cliente-key');
                    var nombre = link.getAttribute('data-cliente-nombre') || link.textContent;
                    desgloseClienteActivo = { key: key, nombre: nombre };
                    desgloseExpanded = {};
                    var box = document.getElementById('adminMayoreoDesglose');
                    var panelCli = document.getElementById('adminMayoreoPanelClientes');
                    var panelDet = document.getElementById('adminMayoreoPanelDetalle');
                    var kpisEl = document.getElementById('adminMayoreoKpis');
                    if (box) {
                        pintarDesgloseCliente();
                        box.classList.remove('admin-hidden');
                    }
                    if (panelCli) panelCli.classList.add('admin-hidden');
                    if (panelDet) panelDet.classList.add('admin-hidden');
                    if (kpisEl) kpisEl.classList.add('admin-hidden');
                    if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                if (ev.target.closest('.admin-mayoreo-cerrar-desglose')) {
                    var box2 = document.getElementById('adminMayoreoDesglose');
                    if (box2) {
                        box2.classList.add('admin-hidden');
                        box2.innerHTML = '';
                    }
                    desgloseClienteActivo = { key: '', nombre: '' };
                    desgloseExpanded = {};
                    document.getElementById('adminMayoreoPanelClientes').classList.remove('admin-hidden');
                    document.getElementById('adminMayoreoPanelDetalle').classList.remove('admin-hidden');
                    var kpisEl2 = document.getElementById('adminMayoreoKpis');
                    if (kpisEl2) kpisEl2.classList.remove('admin-hidden');
                }
            });
        }
    }

    global.ObebeAdminMayoreo = { mount: mount };
})(window);
