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

    function fmtMoney(n) {
        return ObebeAdminData.formatoMoney(n || 0);
    }

    function norm(s) {
        return String(s || '').trim().toLowerCase();
    }

    function etiquetaMetodoPago(m) {
        var k = norm(m);
        if (k === 'efectivo') return 'Efectivo';
        if (k === 'tarjeta') return 'Tarjeta';
        if (k === 'transferencia') return 'Transferencia';
        var t = String(m || '').trim();
        return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
    }

    function imagenUrlLineaVenta(l, clienteKey, filasInv) {
        if (l.imagenUrl) return l.imagenUrl;
        if (!l.lineaId) return '';
        var store = ObebeMayoreoStore.getLineasForCliente(clienteKey);
        var hit = store.find(function (x) { return x.id === l.lineaId; });
        if (hit && hit.imagenUrl) return hit.imagenUrl;
        if (hit && ObebeAdminData.imagenParaLineaMayoreo) {
            return ObebeAdminData.imagenParaLineaMayoreo({
                nombre: hit.nombreSheet,
                talla: hit.talla,
                color: hit.color,
                tipo: hit.tipo,
                marca: hit.marca
            }, filasInv || []);
        }
        return '';
    }

    function stripFotosHistorial(venta, clienteKey, filasInv) {
        var items = venta.lineas || [];
        if (!items.length) return '';
        var thumbs = items.map(function (l) {
            var url = imagenUrlLineaVenta(l, clienteKey, filasInv);
            if (!url) {
                return '<span class="admin-venta-hist-thumb admin-mayoreo-thumb-empty" title="' + esc(l.nombre) + '"></span>';
            }
            return '<img src="' + esc(url) + '" alt="' + esc(l.nombre) + '" class="admin-venta-hist-thumb" ' +
                'loading="lazy" onerror="adminMayoreoImgFallback(this)">';
        }).join('');
        var clase = items.length > 4 ? ' admin-venta-hist-scroll--many' : '';
        return '<div class="admin-venta-hist-scroll' + clase + '" tabindex="0" aria-label="Fotos de la venta">' +
            thumbs + '</div>';
    }

    function thumbHtml(url, alt) {
        if (!url) return '<span class="admin-mayoreo-thumb-empty"></span>';
        var cls = 'admin-venta-search-thumb';
        return '<img src="' + esc(url) + '" alt="' + esc(alt || '') + '" class="' + cls + '" ' +
            'loading="lazy" onerror="adminMayoreoImgFallback(this)">';
    }

    function catalogoDisponible(clienteKey, filasInv) {
        filasInv = filasInv || [];
        return ObebeMayoreoStore.getLineasForCliente(clienteKey)
            .filter(function (l) { return l.cantidadDisponible > 0; })
            .map(function (l) {
                var row = ObebeMayoreoStore.lineaToMayoreoRow(l);
                if (!row.imagenUrl && ObebeAdminData.imagenParaLineaMayoreo) {
                    row.imagenUrl = ObebeAdminData.imagenParaLineaMayoreo({
                        nombre: l.nombreSheet,
                        talla: l.talla,
                        color: l.color,
                        tipo: l.tipo,
                        marca: l.marca
                    }, filasInv);
                }
                return row;
            });
    }

    function mount(container, opts) {
        opts = opts || {};
        var clienteKey = opts.clienteKey || 'naty';
        var res = ObebeMayoreoStore.resumenVentas(clienteKey);
        var catalogo = catalogoDisponible(clienteKey, opts.filasInv);
        var carrito = [];

        function dispRestante(lineaId) {
            var linea = catalogo.find(function (l) { return l.id === lineaId; });
            if (!linea) {
                var todas = ObebeMayoreoStore.getLineasForCliente(clienteKey);
                linea = ObebeMayoreoStore.lineaToMayoreoRow(
                    todas.find(function (x) { return x.id === lineaId; }) || {}
                );
            }
            var base = linea.cantidadDisponible != null ? linea.cantidadDisponible : 0;
            var enCarrito = 0;
            carrito.forEach(function (c) {
                if (c.lineaId === lineaId) enCarrito += c.cantidad;
            });
            return Math.max(0, base - enCarrito);
        }

        function pintarTodo() {
            catalogo = catalogoDisponible(clienteKey, opts.filasInv);
            container.innerHTML = buildShell(res);
            var buscar = document.getElementById('adminVentaBuscar');
            if (buscar) {
                buscar.addEventListener('input', function () { pintarBusqueda(buscar.value); });
            }
            pintarBusqueda('');
            pintarCarrito();
        }

        function buildShell(resumen) {
            var ranking = ObebeMayoreoStore.calcularRankingClientes(clienteKey);
            var datalistOpts = ranking.map(function (c) {
                return '<option value="' + esc(c.nombre) + '"></option>';
            }).join('');
            return '<div class="admin-kpi-grid">' +
                kpi('Hoy', fmtMoney(resumen.totalHoy), resumen.countHoy + ' venta(s)') +
                kpi('Mes actual', fmtMoney(resumen.totalMes), resumen.countMes + ' venta(s)') +
                '</div>' +
                '<div class="admin-panel"><div class="admin-panel-head"><h3>Registrar venta</h3></div>' +
                '<div class="admin-mayoreo-venta-form" id="adminVentaMayoreoForm">' +
                '<div class="admin-field"><label>Comprador (nombre)</label>' +
                '<input type="text" id="adminVentaComprador" list="adminVentaCompradorList" ' +
                'placeholder="Nombre del cliente" required autocomplete="name">' +
                '<datalist id="adminVentaCompradorList">' + datalistOpts + '</datalist></div>' +
                '<div class="admin-field"><label>Forma de pago</label>' +
                '<div class="admin-venta-select-wrap">' +
                '<select id="adminVentaPago" class="admin-venta-pago-select">' +
                '<option value="efectivo">Efectivo</option>' +
                '<option value="tarjeta">Tarjeta</option>' +
                '<option value="transferencia">Transferencia</option></select></div></div>' +
                '<div class="admin-field"><label>Buscar artículo</label>' +
                '<input type="search" id="adminVentaBuscar" placeholder="Nombre, talla, color, marca…" autocomplete="off"></div>' +
                '<div id="adminVentaResultados" class="admin-venta-resultados"></div>' +
                '<div class="admin-panel-head" style="margin-top:0.75rem"><h3 style="font-size:0.95rem">Carrito</h3></div>' +
                '<div id="adminVentaCarrito"></div>' +
                '<p id="adminVentaError" class="admin-login-error" role="alert"></p>' +
                '<button type="button" class="admin-btn admin-btn-primary" id="adminVentaGuardar">Guardar venta</button>' +
                '</div></div>' +
                panelReporte(resumen) +
                panelHistorial(resumen.ventas, clienteKey, opts.filasInv);
        }

        function pintarBusqueda(q) {
            var box = document.getElementById('adminVentaResultados');
            if (!box) return;
            q = norm(q);
            var list = catalogo.filter(function (l) {
                if (!q) return true;
                var blob = [l.nombre, l.talla, l.color, l.tipo, l.marca].join(' ').toLowerCase();
                return blob.indexOf(q) >= 0;
            }).slice(0, 24);

            if (!list.length) {
                box.innerHTML = '<p class="admin-muted-text">Sin resultados con stock.</p>';
                return;
            }

            box.innerHTML = list.map(function (l) {
                var rest = dispRestante(l.id);
                var precio = l.precioVentaPlaneado || l.precioRetail || 0;
                var disabled = rest <= 0 ? ' disabled' : '';
                return '<button type="button" class="admin-venta-result-item"' + disabled +
                    ' data-linea-id="' + esc(l.id) + '">' +
                    thumbHtml(l.imagenUrl, l.nombre) +
                    '<span class="admin-venta-result-info">' +
                    '<strong>' + esc(l.nombre) + '</strong>' +
                    '<span>' + esc(l.talla) + ' · ' + esc(l.color) + '</span>' +
                    '<span>' + fmtMoney(precio) + ' · disp. ' + rest + '</span></span></button>';
            }).join('');
        }

        function pintarCarrito() {
            var box = document.getElementById('adminVentaCarrito');
            if (!box) return;
            if (!carrito.length) {
                box.innerHTML = '<p class="admin-muted-text">Agrega artículos desde el buscador.</p>';
                return;
            }
            var total = 0;
            var rows = carrito.map(function (c, idx) {
                var sub = c.precioUnitario * c.cantidad;
                total += sub;
                var max = dispRestante(c.lineaId) + c.cantidad;
                return '<tr><td>' + thumbHtml(c.imagenUrl, c.nombre) + '</td>' +
                    '<td>' + esc(c.nombre) + '<br><span class="admin-muted-text">' + esc(c.talla) + ' · ' + esc(c.color) + '</span></td>' +
                    '<td><input type="number" class="admin-venta-num admin-venta-cart-cant" min="1" max="' + max + '" value="' + c.cantidad + '" data-idx="' + idx + '"></td>' +
                    '<td><input type="number" class="admin-venta-num admin-venta-cart-precio" min="0" step="1" value="' + c.precioUnitario + '" data-idx="' + idx + '"></td>' +
                    '<td>' + fmtMoney(sub) + '</td>' +
                    '<td><button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-venta-quitar" data-idx="' + idx + '">Quitar</button></td></tr>';
            }).join('');
            box.innerHTML = '<div class="admin-table-wrap"><table class="admin-table admin-table-compact"><thead><tr>' +
                '<th></th><th>Artículo</th><th>Cant.</th><th>Precio</th><th>Subtotal</th><th></th></tr></thead><tbody>' +
                rows + '</tbody></table></div><p style="text-align:right;font-weight:600;padding:0.5rem 0">Total: ' + fmtMoney(total) + '</p>';
        }

        function agregarAlCarrito(lineaId) {
            var err = document.getElementById('adminVentaError');
            if (err) err.textContent = '';
            if (dispRestante(lineaId) <= 0) {
                if (err) err.textContent = 'No hay stock disponible para este artículo.';
                return;
            }
            var existente = carrito.find(function (c) { return c.lineaId === lineaId; });
            if (existente) {
                if (dispRestante(lineaId) <= 0) {
                    if (err) err.textContent = 'Ya agregaste todo el stock de este artículo.';
                    return;
                }
                existente.cantidad += 1;
            } else {
                var l = catalogo.find(function (x) { return x.id === lineaId; });
                if (!l) return;
                carrito.push({
                    lineaId: l.id,
                    nombre: l.nombre,
                    talla: l.talla,
                    color: l.color,
                    imagenUrl: l.imagenUrl,
                    cantidad: 1,
                    precioUnitario: l.precioVentaPlaneado || l.precioRetail || 0
                });
            }
            pintarBusqueda(document.getElementById('adminVentaBuscar').value);
            pintarCarrito();
        }

        container.addEventListener('click', function (ev) {
            var btnRes = ev.target.closest('.admin-venta-result-item');
            if (btnRes && !btnRes.disabled) {
                agregarAlCarrito(btnRes.getAttribute('data-linea-id'));
                return;
            }
            var q = ev.target.closest('.admin-venta-quitar');
            if (q) {
                carrito.splice(parseInt(q.getAttribute('data-idx'), 10), 1);
                pintarBusqueda((document.getElementById('adminVentaBuscar') || {}).value || '');
                pintarCarrito();
                return;
            }
            if (ev.target.id === 'adminVentaGuardar' || ev.target.closest('#adminVentaGuardar')) {
                var err = document.getElementById('adminVentaError');
                if (err) err.textContent = '';
                if (!carrito.length) {
                    if (err) err.textContent = 'Agrega al menos un artículo al carrito.';
                    return;
                }
                var items = carrito.map(function (c) {
                    return {
                        lineaId: c.lineaId,
                        cantidad: c.cantidad,
                        precioUnitario: c.precioUnitario
                    };
                });
                var compradorEl = document.getElementById('adminVentaComprador');
                var pagoEl = document.getElementById('adminVentaPago');
                var r = ObebeMayoreoStore.registrarVenta({
                    clienteKey: clienteKey,
                    comprador: compradorEl ? compradorEl.value : '',
                    metodoPago: pagoEl ? pagoEl.value : 'efectivo',
                    items: items
                });
                if (!r.ok) {
                    if (err) err.textContent = r.error;
                    return;
                }
                carrito = [];
                if (opts.onVentaGuardada) opts.onVentaGuardada();
                res = ObebeMayoreoStore.resumenVentas(clienteKey);
                pintarTodo();
                return;
            }
            var lapiz = ev.target.closest('.admin-venta-hist-lapiz');
            if (lapiz) {
                abrirEdicionHistorialCampo(lapiz.getAttribute('data-venta-id'), lapiz.getAttribute('data-field'));
                return;
            }
            var cancelar = ev.target.closest('.admin-venta-hist-cancel-field');
            if (cancelar) {
                var rowCancel = document.querySelector('tr.admin-venta-hist-row[data-venta-id="' + cancelar.getAttribute('data-venta-id') + '"]');
                restaurarFilaHistorial(rowCancel);
                return;
            }
            var guardar = ev.target.closest('.admin-venta-hist-save-field');
            if (guardar) {
                var vid = guardar.getAttribute('data-venta-id');
                var datos = leerFilaHistorial(vid);
                if (!datos) return;
                var upd = ObebeMayoreoStore.actualizarVenta(vid, clienteKey, datos);
                if (!upd.ok) {
                    ObebeAdminDialog.alert({ title: 'No se pudo guardar', message: upd.error });
                    return;
                }
                if (opts.onVentaGuardada) opts.onVentaGuardada();
                res = ObebeMayoreoStore.resumenVentas(clienteKey);
                pintarTodo();
                return;
            }
            var del = ev.target.closest('.admin-venta-borrar');
            if (del) {
                var ventaIdDel = del.getAttribute('data-venta-id');
                ObebeAdminDialog.confirm({
                    title: 'Eliminar venta',
                    message: 'Esta acción no se puede deshacer. Los artículos volverán al stock disponible.',
                    confirmText: 'Eliminar',
                    cancelText: 'Cancelar',
                    variant: 'danger'
                }).then(function (ok) {
                    if (!ok) return;
                    var delRes = ObebeMayoreoStore.eliminarVenta(ventaIdDel, clienteKey);
                    if (!delRes.ok) {
                        ObebeAdminDialog.alert({ title: 'No se pudo eliminar', message: delRes.error });
                        return;
                    }
                    if (opts.onVentaGuardada) opts.onVentaGuardada();
                    res = ObebeMayoreoStore.resumenVentas(clienteKey);
                    pintarTodo();
                });
            }
        });

        container.addEventListener('change', function (ev) {
            var t = ev.target;
            var idx = parseInt(t.getAttribute('data-idx'), 10);
            if (isNaN(idx) || !carrito[idx]) return;
            if (t.classList.contains('admin-venta-cart-cant')) {
                var qty = parseInt(t.value, 10);
                var max = dispRestante(carrito[idx].lineaId) + carrito[idx].cantidad;
                if (isNaN(qty) || qty < 1) qty = 1;
                if (qty > max) qty = max;
                carrito[idx].cantidad = qty;
                pintarCarrito();
            }
            if (t.classList.contains('admin-venta-cart-precio')) {
                var p = parseFloat(t.value);
                carrito[idx].precioUnitario = isNaN(p) ? 0 : p;
                pintarCarrito();
            }
        });

        pintarTodo();
    }

    function panelReporte(res) {
        var dias = Object.keys(res.porDia || {}).sort().reverse().slice(0, 14);
        var rowsD = dias.map(function (d) {
            var p = d.split('-');
            var label = p[2] + '/' + p[1] + '/' + p[0];
            return '<tr><td>' + esc(label) + '</td><td>' + fmtMoney(res.porDia[d]) + '</td></tr>';
        }).join('');
        var meses = Object.keys(res.porMes || {}).sort().reverse().slice(0, 6);
        var rowsM = meses.map(function (m) {
            return '<tr><td>' + esc(m) + '</td><td>' + fmtMoney(res.porMes[m]) + '</td></tr>';
        }).join('');
        return '<div class="admin-two-col" style="margin-top:1rem">' +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Por día</h3></div>' +
            '<div class="admin-table-wrap"><table class="admin-table admin-table-compact"><thead><tr><th>Fecha</th><th>Total</th></tr></thead><tbody>' +
            (rowsD || '<tr><td colspan="2">Sin ventas</td></tr>') + '</tbody></table></div></div>' +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Por mes</h3></div>' +
            '<div class="admin-table-wrap"><table class="admin-table admin-table-compact"><thead><tr><th>Mes</th><th>Total</th></tr></thead><tbody>' +
            (rowsM || '<tr><td colspan="2">Sin ventas</td></tr>') + '</tbody></table></div></div></div>';
    }

    function selectPagoHistorial(val, ventaId, disabled) {
        var v = norm(val);
        function opt(k) {
            return '<option value="' + k + '"' + (v === k ? ' selected' : '') + '>' + etiquetaMetodoPago(k) + '</option>';
        }
        var dis = disabled !== false ? ' disabled' : '';
        return '<div class="admin-venta-select-wrap admin-venta-select-wrap--compact">' +
            '<select class="admin-venta-pago-select admin-venta-hist-pago" data-venta-id="' + esc(ventaId) + '"' + dis + '>' +
            opt('efectivo') + opt('tarjeta') + opt('transferencia') +
            '</select></div>';
    }

    function fechaHistorialDisplay(iso) {
        if (!iso) return '—';
        var p = String(iso).split('-');
        if (p.length !== 3) return esc(iso);
        return esc(p[2] + '/' + p[1] + '/' + p[0]);
    }

    function celdaHistorialEditable(ventaId, field, viewHtml, editHtml) {
        return '<td class="admin-venta-hist-editable" data-field="' + field + '">' +
            '<div class="admin-venta-hist-view-wrap">' +
            '<span class="admin-venta-hist-view">' + viewHtml + '</span>' +
            '<button type="button" class="admin-venta-hist-lapiz" data-venta-id="' + esc(ventaId) + '" data-field="' + field + '" ' +
            'title="Editar" aria-label="Editar ' + field + '">&#9998;</button></div>' +
            '<div class="admin-venta-hist-edit-wrap admin-hidden">' + editHtml +
            '<div class="admin-venta-hist-edit-actions">' +
            '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact admin-venta-hist-save-field" data-venta-id="' + esc(ventaId) + '">Guardar</button>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-venta-hist-cancel-field" data-venta-id="' + esc(ventaId) + '" data-field="' + field + '">Cancelar</button>' +
            '</div></div></td>';
    }

    function panelHistorial(ventas, clienteKey, filasInv) {
        var rows = (ventas || []).slice(0, 50).map(function (v) {
            var arts = (v.lineas || []).map(function (l) {
                return esc(l.nombre) + ' ×' + l.cantidad + ' (' + fmtMoney(l.subtotal) + ')';
            }).join('<br>');
            var fotos = stripFotosHistorial(v, clienteKey, filasInv);
            var fechaVal = esc(v.fechaIso || '');
            var compradorVal = esc(v.comprador || '');
            var pagoView = esc(etiquetaMetodoPago(v.metodoPago));
            return '<tr data-venta-id="' + esc(v.id) + '" class="admin-venta-hist-row" ' +
                'data-fecha-orig="' + fechaVal + '" data-comprador-orig="' + compradorVal + '" data-pago-orig="' + esc(norm(v.metodoPago) || 'efectivo') + '">' +
                celdaHistorialEditable(v.id, 'fecha', fechaHistorialDisplay(v.fechaIso),
                    '<input type="date" class="admin-venta-hist-input admin-venta-hist-fecha" value="' + fechaVal + '" disabled>') +
                celdaHistorialEditable(v.id, 'comprador', esc(v.comprador || '—'),
                    '<input type="text" class="admin-venta-hist-input admin-venta-hist-comprador" value="' + compradorVal + '" disabled>') +
                celdaHistorialEditable(v.id, 'pago', pagoView, selectPagoHistorial(v.metodoPago, v.id, true)) +
                '<td>' + fmtMoney(v.total) + '</td>' +
                '<td class="admin-venta-hist-detalle">' + arts + '</td>' +
                '<td class="admin-venta-hist-fotos-cell">' + fotos + '</td>' +
                '<td class="admin-venta-hist-actions">' +
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-venta-borrar" data-venta-id="' + esc(v.id) + '">Eliminar</button></td></tr>';
        }).join('');
        return '<div class="admin-panel" style="margin-top:1rem"><div class="admin-panel-head"><h3>Historial</h3></div>' +
            '<p class="admin-muted-text" style="padding:0 1rem 0.5rem;margin:0;font-size:0.8rem">' +
            'Pulsa el lápiz en <strong>fecha</strong>, <strong>comprador</strong> o <strong>pago</strong> para editar; luego <strong>Guardar</strong> o <strong>Cancelar</strong>.</p>' +
            '<div class="admin-table-wrap"><table class="admin-table admin-table-compact admin-venta-hist-table"><thead><tr>' +
            '<th>Fecha</th><th>Comprador</th><th>Pago</th><th>Total</th><th>Detalle</th><th>Fotos</th><th></th></tr></thead><tbody>' +
            (rows || '<tr><td colspan="7">Sin registros</td></tr>') + '</tbody></table></div></div>';
    }

    function restaurarFilaHistorial(row) {
        if (!row) return;
        var fecha = row.getAttribute('data-fecha-orig') || '';
        var comprador = row.getAttribute('data-comprador-orig') || '';
        var pago = row.getAttribute('data-pago-orig') || 'efectivo';
        var fechaIn = row.querySelector('.admin-venta-hist-fecha');
        var compIn = row.querySelector('.admin-venta-hist-comprador');
        var pagoIn = row.querySelector('.admin-venta-hist-pago');
        if (fechaIn) fechaIn.value = fecha;
        if (compIn) compIn.value = comprador;
        if (pagoIn) pagoIn.value = pago;
        row.querySelectorAll('.admin-venta-hist-editable').forEach(function (cell) {
            cell.querySelector('.admin-venta-hist-view-wrap').classList.remove('admin-hidden');
            cell.querySelector('.admin-venta-hist-edit-wrap').classList.add('admin-hidden');
            var ctrl = cell.querySelector('input, select');
            if (ctrl) ctrl.disabled = true;
        });
        row.classList.remove('admin-venta-hist-editing');
    }

    function cerrarEdicionHistorial(exceptRow) {
        document.querySelectorAll('tr.admin-venta-hist-editing').forEach(function (tr) {
            if (exceptRow && tr === exceptRow) return;
            restaurarFilaHistorial(tr);
        });
    }

    function abrirEdicionHistorialCampo(ventaId, field) {
        var row = document.querySelector('tr.admin-venta-hist-row[data-venta-id="' + ventaId + '"]');
        if (!row) return;
        cerrarEdicionHistorial(row);
        var cell = row.querySelector('.admin-venta-hist-editable[data-field="' + field + '"]');
        if (!cell) return;
        cell.querySelector('.admin-venta-hist-view-wrap').classList.add('admin-hidden');
        cell.querySelector('.admin-venta-hist-edit-wrap').classList.remove('admin-hidden');
        var ctrl = cell.querySelector('input, select');
        if (ctrl) {
            ctrl.disabled = false;
            ctrl.focus();
        }
        row.classList.add('admin-venta-hist-editing');
    }

    function leerFilaHistorial(ventaId) {
        var row = document.querySelector('tr.admin-venta-hist-row[data-venta-id="' + ventaId + '"]');
        if (!row) return null;
        var fecha = row.querySelector('.admin-venta-hist-fecha');
        var comprador = row.querySelector('.admin-venta-hist-comprador');
        var pago = row.querySelector('.admin-venta-hist-pago');
        return {
            fechaIso: fecha ? fecha.value : '',
            comprador: comprador ? comprador.value : '',
            metodoPago: pago ? pago.value : 'efectivo'
        };
    }

    global.ObebeAdminMayoreoVentas = { mount: mount };
})(window);
