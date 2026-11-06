(function (global) {
    'use strict';

    var sucursalActiva = 'mercadolibre';
    var optsMount = null;
    var editandoLineaId = null;

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function fmt(n) {
        return ObebeAdminData.formatoMoney(n || 0);
    }

    function getFilas() {
        return optsMount && optsMount.getFilas ? optsMount.getFilas() : [];
    }

    function sucursales() {
        return ObebeAdminData.listarSucursalesInventario
            ? ObebeAdminData.listarSucursalesInventario()
            : [];
    }

    function nombreSucursal(id) {
        var d = ObebeAdminData.definicionSucursalInventario
            ? ObebeAdminData.definicionSucursalInventario(id)
            : null;
        return d ? d.nombre : id;
    }

    function totalPiezasSucursal(id) {
        if (!global.ObebeSucursalesStore) return 0;
        return ObebeSucursalesStore.listarPorSucursal(id).reduce(function (s, l) {
            return s + (l.cantidad || 0);
        }, 0);
    }

    function htmlTabs() {
        return sucursales().map(function (s) {
            var act = s.id === sucursalActiva ? ' active' : '';
            var n = totalPiezasSucursal(s.id);
            return '<button type="button" class="admin-btn admin-btn-ghost admin-suc-tab' + act + '" data-suc="' +
                esc(s.id) + '">' + esc(s.nombre) + ' <span class="admin-tag admin-tag-muted">' + n + '</span></button>';
        }).join('');
    }

    function imagenLineaSucursal(l) {
        if (l && l.imagenUrl) return l.imagenUrl;
        var filas = getFilas();
        var f = filas.find(function (x) {
            return x.filaSheet === l.filaSheet || x.inventarioDbId === l.filaSheet;
        });
        return (f && ObebeAdminData.urlImagenFilaInventario)
            ? ObebeAdminData.urlImagenFilaInventario(f)
            : '';
    }

    function htmlLista() {
        if (!global.ObebeSucursalesStore) {
            return '<p class="admin-muted-text">Store de sucursales no cargado.</p>';
        }
        var list = ObebeSucursalesStore.listarPorSucursal(sucursalActiva);
        if (!list.length) {
            return '<p class="admin-muted-text admin-suc-empty">Sin stock en «' + esc(nombreSucursal(sucursalActiva)) +
                '». Usa «Agregar desde inventario» para trasladar piezas del inventario principal.</p>';
        }
        var rows = list.map(function (l) {
            var edit = editandoLineaId === l.id;
            var sub = (l.precioUnitario || 0) * (l.cantidad || 0);
            var img = imagenLineaSucursal(l);
            var thumb = img
                ? '<img src="' + esc(img) + '" alt="" class="admin-suc-row-thumb" loading="lazy" ' +
                'onerror="typeof adminMayoreoImgFallback===\'function\'&&adminMayoreoImgFallback(this)">'
                : '<span class="admin-suc-row-thumb admin-suc-row-thumb--empty"></span>';
            var pzas = edit
                ? '<input type="number" min="0" class="admin-suc-edit-qty" data-id="' + esc(l.id) +
                '" value="' + (l.cantidad || 0) + '">'
                : String(l.cantidad || 0);
            var acciones = edit
                ? '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact admin-suc-edit-save" data-id="' +
                esc(l.id) + '">Guardar</button> ' +
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-suc-edit-cancel">Cancelar</button> ' +
                '<button type="button" class="admin-btn admin-btn-danger admin-btn-compact admin-suc-quitar" data-id="' +
                esc(l.id) + '">Quitar</button>'
                : '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-suc-editar" data-id="' +
                esc(l.id) + '">Editar</button> ' +
                '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact admin-suc-vender" data-id="' +
                esc(l.id) + '" data-max="' + (l.cantidad || 0) + '">Registrar venta</button>';
            return '<tr data-linea-id="' + esc(l.id) + '">' +
                '<td><div class="admin-suc-row-art">' + thumb +
                '<div>' + ObebeAdminData.htmlRef(l.ref) + '<strong>' + esc(l.nombre) + '</strong>' +
                '<div class="admin-muted-text">' + esc(l.talla) + ' · ' + esc(l.color) +
                (l.tipo ? ' · ' + esc(l.tipo) : '') + '</div></div></div></td>' +
                '<td>' + pzas + '</td>' +
                '<td>' + fmt(l.precioUnitario) + '</td>' +
                '<td>' + (edit ? '—' : fmt(sub)) + '</td>' +
                '<td class="admin-suc-actions">' + acciones + '</td></tr>';
        }).join('');
        return '<div class="admin-table-wrap"><table class="admin-table admin-table-compact admin-suc-table">' +
            '<thead><tr><th>Artículo</th><th>Pzas.</th><th>Precio u.</th><th>Valor</th><th></th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div>';
    }

    function pintar(root) {
        if (!root) return;
        var tabsEl = root.querySelector('#adminSucursalesTabs');
        var listEl = root.querySelector('#adminSucursalesLista');
        if (tabsEl) tabsEl.innerHTML = htmlTabs();
        if (listEl) listEl.innerHTML = htmlLista();
    }

    function ensureModalRoot() {
        var root = document.getElementById('adminSucursalesModalRoot');
        if (root) return root;
        root = document.createElement('div');
        root.id = 'adminSucursalesModalRoot';
        root.className = 'admin-suc-modal-root admin-hidden';
        root.setAttribute('aria-hidden', 'true');
        document.body.appendChild(root);
        return root;
    }

    function cerrarModal(root) {
        root.classList.add('admin-hidden');
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = '';
        document.body.classList.remove('admin-suc-modal-open');
    }

    function imagenFila(f) {
        return ObebeAdminData.urlImagenFilaInventario
            ? ObebeAdminData.urlImagenFilaInventario(f)
            : '';
    }

    function filaCoincideBusqueda(f, query) {
        if (!query) return true;
        var q = query.trim().toLowerCase();
        if (!q) return true;
        var blob = [
            f.nombre, f.talla, f.color, f.tipo, f.marca, String(f.ref || '')
        ].join(' ').toLowerCase();
        var parts = q.split(/\s+/).filter(Boolean);
        for (var i = 0; i < parts.length; i++) {
            if (blob.indexOf(parts[i]) < 0) return false;
        }
        return true;
    }

    function htmlListaPickSucursal(filas, query, seleccionados) {
        seleccionados = seleccionados || {};
        var list = filas.filter(function (f) { return filaCoincideBusqueda(f, query); });
        if (!list.length) {
            return '<p class="admin-muted-text admin-suc-pick-empty">Sin artículos con ese criterio.</p>';
        }
        return list.slice(0, 250).map(function (f) {
            var k = String(f.filaSheet);
            var sel = seleccionados[k] ? ' admin-suc-pick-item--active' : '';
            var img = imagenFila(f);
            var thumb = img
                ? '<img src="' + esc(img) + '" alt="" class="admin-suc-pick-thumb" loading="lazy" ' +
                'onerror="typeof adminMayoreoImgFallback===\'function\'&&adminMayoreoImgFallback(this)">'
                : '<span class="admin-suc-pick-thumb admin-suc-pick-thumb--empty" aria-hidden="true"></span>';
            var precio = ObebeAdminData.precioVentaRetailFila
                ? ObebeAdminData.precioVentaRetailFila(f)
                : f.precio;
            var check = seleccionados[k]
                ? '<span class="admin-suc-pick-check" aria-hidden="true">✓</span>'
                : '<span class="admin-suc-pick-check admin-suc-pick-check--off" aria-hidden="true"></span>';
            return '<button type="button" class="admin-suc-pick-item' + sel + '" data-sheet="' + f.filaSheet +
                '" data-max="' + (f.stock || 0) + '">' + check + thumb +
                '<span class="admin-suc-pick-body">' +
                ObebeAdminData.htmlRef(f.ref) +
                '<strong class="admin-suc-pick-name">' + esc(f.nombre) + '</strong>' +
                '<span class="admin-suc-pick-meta">' +
                '<span class="admin-suc-pick-talla">Talla <strong>' + esc(f.talla || '—') + '</strong></span>' +
                '<span class="admin-suc-pick-stock">Disp. <strong>' + (f.stock || 0) + '</strong></span>' +
                '</span>' +
                (f.color ? '<span class="admin-muted-text admin-suc-pick-color">' + esc(f.color) + '</span>' : '') +
                '<span class="admin-suc-pick-precio">' + fmt(precio) + '</span></span></button>';
        }).join('');
    }

    function htmlResumenSeleccion(seleccionados) {
        var keys = Object.keys(seleccionados || {});
        if (!keys.length) {
            return '<p class="admin-muted-text admin-suc-sel-empty">Toca artículos arriba para seleccionarlos.</p>';
        }
        var piezas = 0;
        keys.forEach(function (k) { piezas += seleccionados[k].qty || 0; });
        var items = keys.map(function (k) {
            var s = seleccionados[k];
            var f = s.fila;
            var img = imagenFila(f);
            var thumb = img
                ? '<img src="' + esc(img) + '" alt="" class="admin-suc-sel-thumb" loading="lazy" ' +
                'onerror="typeof adminMayoreoImgFallback===\'function\'&&adminMayoreoImgFallback(this)">'
                : '<span class="admin-suc-sel-thumb admin-suc-sel-thumb--empty"></span>';
            return '<li class="admin-suc-sel-item" data-sheet="' + esc(k) + '">' + thumb +
                '<span class="admin-suc-sel-item-info">' + ObebeAdminData.htmlRef(f.ref) +
                '<strong>' + esc(f.nombre) + '</strong>' +
                '<span class="admin-muted-text">' + esc(f.talla) + ' · disp. ' + (s.max || 0) + '</span></span>' +
                '<label class="admin-suc-sel-qty"><span class="admin-sr-only">Cantidad</span>' +
                '<input type="number" class="admin-suc-sel-qty-input" data-sheet="' + esc(k) + '" min="1" max="' +
                (s.max || 1) + '" value="' + (s.qty || 1) + '"></label>' +
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-suc-sel-quitar" data-sheet="' +
                esc(k) + '" aria-label="Quitar">×</button></li>';
        }).join('');
        return '<div class="admin-suc-sel-head">' +
            '<span class="admin-tag admin-tag-ok">' + keys.length + ' artículo(s)</span>' +
            '<span class="admin-muted-text">' + piezas + ' pza(s) en total</span></div>' +
            '<ul class="admin-suc-sel-list">' + items + '</ul>';
    }

    function abrirModalAgregar(onDone) {
        function abrirConFilas() {
        function stockReal(f) {
            if (f && f.celdas && ObebeAdminData.idxInventario) {
                var idx = ObebeAdminData.idxInventario();
                var col = idx.stock != null ? idx.stock : 2;
                var n = parseInt(f.celdas[col], 10);
                if (!isNaN(n)) {
                    f.stock = n;
                    return n;
                }
            }
            return (f && f.stock) || 0;
        }
        var filas = getFilas().filter(function (f) { return stockReal(f) > 0 && f.filaSheet; });
        filas.sort(function (a, b) {
            return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
        });
        var root = ensureModalRoot();
        var seleccionados = Object.create(null);

        function filaPorSheet(sheet) {
            sheet = parseInt(sheet, 10);
            return filas.find(function (f) { return f.filaSheet === sheet; }) || null;
        }

        function actualizarBtnTrasladar() {
            var btn = document.getElementById('adminSucModalGuardar');
            var n = Object.keys(seleccionados).length;
            if (!btn) return;
            btn.disabled = n === 0;
            btn.textContent = n ? ('Trasladar (' + n + ')') : 'Trasladar';
        }

        function pintarPickList() {
            var buscar = document.getElementById('adminSucModalBuscar');
            var box = document.getElementById('adminSucModalPickList');
            if (!box) return;
            var q = buscar ? buscar.value : '';
            box.innerHTML = htmlListaPickSucursal(filas, q, seleccionados);
        }

        function pintarSeleccionados() {
            var box = document.getElementById('adminSucSelResumen');
            if (box) box.innerHTML = htmlResumenSeleccion(seleccionados);
            actualizarBtnTrasladar();
        }

        function togglePick(btn) {
            if (!btn) return;
            var sheet = String(parseInt(btn.getAttribute('data-sheet'), 10));
            var max = parseInt(btn.getAttribute('data-max'), 10) || 1;
            var f = filaPorSheet(sheet);
            if (!f) return;
            if (seleccionados[sheet]) {
                delete seleccionados[sheet];
            } else {
                seleccionados[sheet] = { fila: f, qty: 1, max: max };
            }
            pintarPickList();
            pintarSeleccionados();
        }

        root.innerHTML =
            '<div class="admin-suc-modal-backdrop" data-suc-dismiss="1"></div>' +
            '<div class="admin-suc-modal admin-suc-modal--pick" role="dialog" aria-labelledby="adminSucModalTitle">' +
            '<div class="admin-suc-modal-inner">' +
            '<header class="admin-suc-modal-header">' +
            '<h3 id="adminSucModalTitle">Agregar a «' + esc(nombreSucursal(sucursalActiva)) + '»</h3>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-suc-modal-close" data-suc-dismiss="1" aria-label="Cerrar">×</button></header>' +
            '<p class="admin-muted-text admin-suc-modal-lead">Selecciona uno o más artículos. Se restará del inventario principal (no es venta).</p>' +
            '<div class="admin-suc-modal-layout">' +
            '<div class="admin-suc-modal-col admin-suc-modal-col--browse">' +
            '<div class="admin-field admin-suc-modal-search">' +
            '<label for="adminSucModalBuscar">Buscar</label>' +
            '<input type="search" id="adminSucModalBuscar" placeholder="Nombre, talla, color…" autocomplete="off"></div>' +
            '<div id="adminSucModalPickList" class="admin-suc-pick-scroll">' +
            htmlListaPickSucursal(filas, '', seleccionados) + '</div></div>' +
            '<div class="admin-suc-modal-col admin-suc-modal-col--sel">' +
            '<h4 class="admin-suc-sel-title">Seleccionados</h4>' +
            '<div id="adminSucSelResumen" class="admin-suc-sel-panel">' +
            htmlResumenSeleccion(seleccionados) + '</div></div></div>' +
            '<p id="adminSucModalError" class="admin-login-error" role="alert"></p>' +
            '<footer class="admin-suc-modal-actions admin-suc-modal-actions--footer">' +
            '<button type="button" class="admin-btn admin-btn-danger" data-suc-dismiss="1">Cancelar</button>' +
            '<button type="button" class="admin-btn admin-btn-primary" id="adminSucModalGuardar" disabled>Trasladar</button>' +
            '</footer></div></div>';

        root.querySelectorAll('[data-suc-dismiss]').forEach(function (el) {
            el.addEventListener('click', function () { cerrarModal(root); });
        });
        var buscarEl = document.getElementById('adminSucModalBuscar');
        if (buscarEl) buscarEl.addEventListener('input', pintarPickList);

        root.addEventListener('click', function (ev) {
            var pick = ev.target.closest('.admin-suc-pick-item');
            if (pick) {
                ev.preventDefault();
                togglePick(pick);
                return;
            }
            var quitar = ev.target.closest('.admin-suc-sel-quitar');
            if (quitar) {
                var ks = quitar.getAttribute('data-sheet');
                delete seleccionados[ks];
                pintarPickList();
                pintarSeleccionados();
            }
        });

        root.addEventListener('input', function (ev) {
            if (!ev.target.classList.contains('admin-suc-sel-qty-input')) return;
            var ks = ev.target.getAttribute('data-sheet');
            if (!seleccionados[ks]) return;
            var v = parseInt(ev.target.value, 10);
            var max = seleccionados[ks].max || 1;
            if (!v || v < 1) v = 1;
            if (v > max) v = max;
            seleccionados[ks].qty = v;
            ev.target.value = String(v);
            pintarSeleccionados();
        });

        document.getElementById('adminSucModalGuardar').addEventListener('click', function () {
            var err = document.getElementById('adminSucModalError');
            var btn = document.getElementById('adminSucModalGuardar');
            if (err) err.textContent = '';
            var keys = Object.keys(seleccionados);
            if (!keys.length) {
                if (err) err.textContent = 'Selecciona al menos un artículo.';
                return;
            }
            var items = [];
            var totalPiezas = 0;
            var i;
            for (i = 0; i < keys.length; i++) {
                var s = seleccionados[keys[i]];
                var qty = parseInt(s.qty, 10) || 0;
                if (qty < 1) {
                    if (err) err.textContent = 'Revisa las cantidades de «' + (s.fila.nombre || '') + '».';
                    return;
                }
                if (qty > s.max) {
                    if (err) err.textContent = 'Máximo ' + s.max + ' para «' + (s.fila.nombre || '') + '».';
                    return;
                }
                items.push({ filaSheet: s.fila.filaSheet, cantidad: qty, fila: s.fila });
                totalPiezas += qty;
            }
            var msgConfirm = 'Vas a mover ' + totalPiezas + ' pieza(s) a «' +
                nombreSucursal(sucursalActiva) + '».';

            ObebeAdminDialog.confirm({
                title: '¿Confirmar traslado?',
                message: msgConfirm,
                confirmText: 'Sí, trasladar',
                cancelText: 'Cancelar',
                cancelDanger: true,
                variant: 'warn'
            }).then(function (ok) {
                if (!ok) return;
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = 'Trasladando…';
                }
                var prom = ObebeAdminData.trasladarLoteInventarioASucursal
                    ? ObebeAdminData.trasladarLoteInventarioASucursal(sucursalActiva, items)
                    : ObebeAdminData.trasladarInventarioASucursal(
                        sucursalActiva, items[0].filaSheet, items[0].cantidad, items[0].fila
                    );
                prom.then(function (res) {
                    if (!res || !res.ok) {
                        if (err) err.textContent = (res && res.error) || 'No se pudo trasladar.';
                        actualizarBtnTrasladar();
                        return;
                    }
                    if (res.parcial && err) {
                        err.textContent = 'Traslado parcial: ' + (res.error || '');
                    }
                    cerrarModal(root);
                    if (onDone) onDone(res);
                }).catch(function (e) {
                    if (err) err.textContent = e.message || String(e);
                    actualizarBtnTrasladar();
                });
            });
        });

        root.classList.remove('admin-hidden');
        root.setAttribute('aria-hidden', 'false');
        document.body.classList.add('admin-suc-modal-open');
        if (buscarEl) buscarEl.focus();
        }

        var precarga = (ObebeAdminData.cargarInventario && ObebeAdminData.cargarInventario(true))
            ? ObebeAdminData.cargarInventario(true)
            : Promise.resolve();
        precarga.then(function () { abrirConFilas(); }).catch(function () { abrirConFilas(); });
    }

    var EQUIPO_SUC = ['Ugo', 'Daniel', 'Fer'];
    var CUENTAS_SUC = ['Ugo', 'Daniel', 'Fer', 'Tarjeta crédito', 'Mercado Libre', 'Cubos Peñaflor'];

    function opcionesSelect(list, selected) {
        return list.map(function (n) {
            return '<option value="' + esc(n) + '"' + (n === selected ? ' selected' : '') + '>' + esc(n) + '</option>';
        }).join('');
    }

    function clientesSucursal() {
        if (optsMount && optsMount.getClientes) return optsMount.getClientes() || [];
        return [];
    }

    function abrirModalVenta(lineaId, maxQty, onDone) {
        var line = global.ObebeSucursalesStore.getById(lineaId);
        if (!line) return;
        var def = ObebeAdminData.definicionSucursalInventario(line.sucursalId);
        var cuentaDef = def ? def.cuenta : '';
        var clientes = clientesSucursal();
        var tipo = 'existente';
        var root = ensureModalRoot();
        var optsCli = '<option value="">— Selecciona —</option>' + clientes.map(function (c) {
            return '<option value="' + esc(c.id || c.nombre) + '">' + esc(c.nombre) + '</option>';
        }).join('');

        function htmlForm() {
            var panelEx = tipo === 'existente' ? '' : ' admin-hidden';
            var panelNu = tipo === 'nuevo' ? '' : ' admin-hidden';
            return '<div class="admin-suc-modal-backdrop" data-suc-dismiss="1"></div>' +
                '<div class="admin-suc-modal admin-suc-modal--venta" role="dialog">' +
                '<div class="admin-suc-modal-inner admin-suc-venta-inner">' +
                '<header class="admin-suc-modal-header">' +
                '<h3>Registrar venta</h3>' +
                '<button type="button" class="admin-btn admin-btn-ghost admin-suc-modal-close" data-suc-dismiss="1" aria-label="Cerrar">×</button></header>' +
                '<p class="admin-muted-text">' + ObebeAdminData.htmlRef(line.ref) +
                '<strong>' + esc(line.nombre) + '</strong> · ' + esc(line.talla) +
                ' · ' + esc(line.color) + ' · en sucursal: ' + (line.cantidad || 0) + '</p>' +
                '<p class="admin-ped-filtros-sub">Tipo de cliente</p>' +
                '<div class="admin-ped-genero-btns admin-suc-tipo-btns">' +
                '<button type="button" class="admin-ped-genero-btn admin-suc-tipo' + (tipo === 'existente' ? ' active' : '') + '" data-tipo="existente">Cliente existente</button>' +
                '<button type="button" class="admin-ped-genero-btn admin-suc-tipo' + (tipo === 'nuevo' ? ' active' : '') + '" data-tipo="nuevo">Cliente nuevo</button>' +
                '</div>' +
                '<div id="adminSucPanelEx" class="' + panelEx.trim() + '">' +
                '<div class="admin-field"><label>Cliente</label>' +
                '<select id="adminSucVentaClienteSel" class="admin-venta-pago-select">' + optsCli + '</select></div></div>' +
                '<div id="adminSucPanelNuevo" class="' + panelNu.trim() + '">' +
                '<div class="admin-field"><label>Nombre</label><input type="text" id="adminSucVentaNombre" placeholder="Nombre completo"></div>' +
                '<div class="admin-field-row">' +
                '<div class="admin-field"><label>Teléfono</label><input type="text" id="adminSucVentaTel"></div>' +
                '<div class="admin-field"><label>Red social</label><input type="text" id="adminSucVentaRed" placeholder="Instagram…"></div></div>' +
                '<div class="admin-field"><label>Link</label><input type="text" id="adminSucVentaLink" placeholder="https://…"></div></div>' +
                '<div class="admin-field-row">' +
                '<div class="admin-field"><label>Quien tiene el dinero</label>' +
                '<select id="adminSucVentaCuenta" class="admin-venta-pago-select">' +
                '<option value="">— Elegir —</option>' + opcionesSelect(CUENTAS_SUC, cuentaDef) + '</select></div>' +
                '<div class="admin-field"><label>Vendedor</label>' +
                '<select id="adminSucVentaVendedor" class="admin-venta-pago-select">' +
                '<option value="">— Elegir —</option>' + opcionesSelect(EQUIPO_SUC, '') + '</select></div></div>' +
                '<div class="admin-field-row">' +
                '<div class="admin-field"><label>Piezas</label>' +
                '<input type="number" id="adminSucVentaQty" min="1" max="' + maxQty + '" value="1"></div>' +
                '<div class="admin-field"><label>Precio unitario</label>' +
                '<input type="number" id="adminSucVentaPrecio" min="0" step="1" value="' + (line.precioUnitario || 0) + '"></div></div>' +
                '<p class="admin-muted-text admin-suc-venta-hint">El stock del inventario principal ya se movió a la sucursal.</p>' +
                '<p id="adminSucVentaError" class="admin-login-error" role="alert"></p>' +
                '<footer class="admin-suc-modal-actions admin-suc-venta-actions">' +
                '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact" id="adminSucVentaGuardar">Registrar en Ventas</button>' +
                '<button type="button" class="admin-btn admin-btn-danger" data-suc-dismiss="1">Cancelar</button>' +
                '</footer></div></div>';
        }

        function bind() {
            root.querySelectorAll('[data-suc-dismiss]').forEach(function (el) {
                el.addEventListener('click', function () { cerrarModal(root); });
            });
            root.querySelectorAll('.admin-suc-tipo').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    tipo = btn.getAttribute('data-tipo') || 'existente';
                    var ex = document.getElementById('adminSucPanelEx');
                    var nu = document.getElementById('adminSucPanelNuevo');
                    if (ex) ex.classList.toggle('admin-hidden', tipo !== 'existente');
                    if (nu) nu.classList.toggle('admin-hidden', tipo !== 'nuevo');
                    root.querySelectorAll('.admin-suc-tipo').forEach(function (b) {
                        b.classList.toggle('active', b === btn);
                    });
                });
            });
            document.getElementById('adminSucVentaGuardar').addEventListener('click', guardarVenta);
        }

        function leerCliente() {
            if (tipo === 'nuevo') {
                return {
                    cliente: ((document.getElementById('adminSucVentaNombre') || {}).value || '').trim(),
                    telefono: ((document.getElementById('adminSucVentaTel') || {}).value || '').trim(),
                    redSocial: ((document.getElementById('adminSucVentaRed') || {}).value || '').trim(),
                    link: ((document.getElementById('adminSucVentaLink') || {}).value || '').trim()
                };
            }
            var sel = document.getElementById('adminSucVentaClienteSel');
            var id = sel ? sel.value : '';
            var c = clientes.find(function (x) { return (x.id || x.nombre) === id; });
            return {
                cliente: c ? c.nombre : '',
                telefono: c ? (c.telefono || '') : '',
                redSocial: c ? (c.redPrincipal || c.redSocial || '') : '',
                link: c ? (c.link || '') : ''
            };
        }

        function guardarVenta() {
            var err = document.getElementById('adminSucVentaError');
            if (err) err.textContent = '';
            var cli = leerCliente();
            var qty = parseInt((document.getElementById('adminSucVentaQty') || {}).value, 10);
            var cuenta = ((document.getElementById('adminSucVentaCuenta') || {}).value || '').trim();
            var vendedor = ((document.getElementById('adminSucVentaVendedor') || {}).value || '').trim();
            var precio = parseFloat(String((document.getElementById('adminSucVentaPrecio') || {}).value || '').replace(',', '.'));
            if (!cli.cliente) {
                if (err) err.textContent = tipo === 'nuevo' ? 'Escribe el nombre del cliente.' : 'Selecciona un cliente.';
                return;
            }
            if (!cuenta) {
                if (err) err.textContent = 'Elige quién tiene el dinero.';
                return;
            }
            if (EQUIPO_SUC.indexOf(vendedor) < 0) {
                if (err) err.textContent = 'Elige el vendedor.';
                return;
            }
            if (!qty || qty < 1 || qty > maxQty) {
                if (err) err.textContent = 'Piezas entre 1 y ' + maxQty + '.';
                return;
            }
            if (isNaN(precio) || precio < 0) {
                if (err) err.textContent = 'Precio unitario inválido.';
                return;
            }
            ObebeAdminDialog.confirm({
                title: '¿Confirmar venta?',
                message: 'Se registrarán ' + qty + ' pieza(s) en Ventas.',
                confirmText: 'Sí, registrar',
                cancelText: 'Cancelar',
                cancelDanger: true,
                variant: 'warn'
            }).then(function (ok) {
                if (!ok) return;
                ObebeAdminData.registrarVentasDesdeSucursal(lineaId, qty, {
                    cliente: cli.cliente,
                    telefono: cli.telefono,
                    redSocial: line.sucursalId === 'mercadolibre' ? 'Mercado libre' : (cli.redSocial || ''),
                    link: cli.link,
                    cuenta: cuenta,
                    vendedor: vendedor,
                    precioUnitario: precio,
                    precioOriginal: line.precioUnitario || 0
                }).then(function (res) {
                    if (!res.ok) {
                        if (err) err.textContent = res.error || 'Error';
                        return;
                    }
                    cerrarModal(root);
                    if (onDone) onDone(res);
                });
            });
        }

        root.innerHTML = htmlForm();
        bind();
        root.classList.remove('admin-hidden');
        root.setAttribute('aria-hidden', 'false');
        document.body.classList.add('admin-suc-modal-open');
    }

    function mount(container, opts) {
        opts = opts || {};
        optsMount = opts;
        container.innerHTML =
            '<div class="admin-panel admin-sucursales-panel">' +
            '<div class="admin-panel-head"><h3>Sucursales</h3></div>' +
            '<div id="adminSucursalesTabs" class="admin-suc-tabs"></div>' +
            '<div class="admin-suc-toolbar">' +
            '<button type="button" class="admin-btn admin-btn-primary" id="adminSucAgregar">Agregar desde inventario</button></div>' +
            '<div id="adminSucursalesLista"></div></div>';

        var root = container;

        function refrescarTodo(res) {
            var p = opts.onInventarioChanged ? opts.onInventarioChanged(res) : Promise.resolve();
            Promise.resolve(p).finally(function () { pintar(root); });
        }

        var syncP = (global.ObebeAdminModulosCloud && ObebeAdminModulosCloud.syncSucursales)
            ? ObebeAdminModulosCloud.syncSucursales()
            : Promise.resolve();
        syncP.finally(function () {
            if (global.ObebeSucursalesStore && ObebeSucursalesStore.sincronizarConInventario) {
                ObebeSucursalesStore.sincronizarConInventario(getFilas());
            }
            descontarMercadoLibreDelInventario().finally(function () {
                var aviso = opts.onInventarioChanged ? opts.onInventarioChanged() : null;
                Promise.resolve(aviso).finally(function () { pintar(root); });
            });
        });

        function filaDeLinea(line) {
            var filas = getFilas();
            var db = line && line.inventarioDbId;
            var sheet = parseInt(line && line.filaSheet, 10);
            var i;
            for (i = 0; i < filas.length; i++) {
                var f = filas[i];
                if (db && f.inventarioDbId === db) return f;
                if (sheet && (f.filaSheet === sheet || f.inventarioDbId === sheet)) return f;
            }
            return null;
        }

        function stockActualFila(f) {
            if (f && f.celdas && ObebeAdminData.idxInventario) {
                var idx = ObebeAdminData.idxInventario();
                var col = idx.stock != null ? idx.stock : 2;
                var n = parseInt(f.celdas[col], 10);
                if (!isNaN(n)) return n;
            }
            return (f && f.stock) || 0;
        }

        function descontarMercadoLibreDelInventario() {
            if (!global.ObebeSucursalesStore || !ObebeAdminData.actualizarStockFila) {
                return Promise.resolve();
            }
            var lineas = ObebeSucursalesStore.listarPorSucursal('mercadolibre').filter(function (l) {
                return !l.stockDescontado && (l.cantidad || 0) > 0;
            });
            if (!lineas.length) return Promise.resolve();
            var grupos = {};
            lineas.forEach(function (l) {
                var f = filaDeLinea(l);
                var key = f ? ('f-' + (f.inventarioDbId || f.filaSheet)) : ('x-' + l.id);
                if (!grupos[key]) grupos[key] = { fila: f, lineas: [], total: 0 };
                grupos[key].lineas.push(l);
                grupos[key].total += l.cantidad || 0;
            });
            var chain = Promise.resolve();
            var fallos = [];
            Object.keys(grupos).forEach(function (k) {
                chain = chain.then(function () {
                    var g = grupos[k];
                    if (!g.fila) {
                        fallos.push((g.lineas[0] && g.lineas[0].nombre) || 'Artículo');
                        return;
                    }
                    var actual = stockActualFila(g.fila);
                    var nuevo = Math.max(0, actual - g.total);
                    return ObebeAdminData.actualizarStockFila(g.fila.filaSheet, nuevo, { fila: g.fila }).then(function (res) {
                        if (!res || res.ok === false) {
                            fallos.push(g.fila.nombre || 'Artículo');
                            return;
                        }
                        g.fila.stock = nuevo;
                        if (g.fila.celdas && ObebeAdminData.idxInventario) {
                            var idx = ObebeAdminData.idxInventario();
                            var col = idx.stock != null ? idx.stock : 2;
                            g.fila.celdas[col] = String(nuevo);
                        }
                        g.lineas.forEach(function (l) {
                            ObebeSucursalesStore.marcarStockDescontado(l.id);
                        });
                    }).catch(function () {
                        fallos.push(g.fila.nombre || 'Artículo');
                    });
                });
            });
            return chain.then(function () {
                if (!fallos.length) return;
                ObebeAdminDialog.alert({
                    title: 'Stock',
                    message: 'No se pudo descontar del inventario: ' + fallos.join(', '),
                    confirmText: 'Ok'
                });
            });
        }

        function aplicarCantidadLinea(line, nueva) {
            function cerrar() {
                ObebeSucursalesStore.fijarCantidad(line.id, nueva);
                editandoLineaId = null;
                if (nueva <= 0) refrescarTodo();
                else pintar(root);
            }
            if (nueva > 0 || !line.stockDescontado) {
                cerrar();
                return;
            }
            var f = filaDeLinea(line);
            var cant = line.cantidad || 0;
            if (!f || !cant || !ObebeAdminData.actualizarStockFila) {
                cerrar();
                return;
            }
            ObebeAdminData.actualizarStockFila(f.filaSheet, (f.stock || 0) + cant, { fila: f }).then(function (res) {
                if (!res || res.ok === false) {
                    ObebeAdminDialog.alert({
                        title: 'No se pudo',
                        message: (res && res.error) || 'No se devolvió el stock al inventario.',
                        confirmText: 'Ok'
                    });
                    return;
                }
                f.stock = (f.stock || 0) + cant;
                cerrar();
            }).catch(function (e) {
                ObebeAdminDialog.alert({
                    title: 'No se pudo',
                    message: e.message || String(e),
                    confirmText: 'Ok'
                });
            });
        }

        container.onclick = function (ev) {
            var tab = ev.target.closest('.admin-suc-tab');
            if (tab) {
                sucursalActiva = tab.getAttribute('data-suc') || sucursalActiva;
                editandoLineaId = null;
                pintar(root);
                return;
            }
            if (ev.target.id === 'adminSucAgregar' || ev.target.closest('#adminSucAgregar')) {
                abrirModalAgregar(function () { refrescarTodo(); });
                return;
            }
            var editar = ev.target.closest('.admin-suc-editar');
            if (editar) {
                editandoLineaId = editar.getAttribute('data-id');
                pintar(root);
                var inp = root.querySelector('.admin-suc-edit-qty');
                if (inp) inp.focus();
                return;
            }
            if (ev.target.closest('.admin-suc-edit-cancel')) {
                editandoLineaId = null;
                pintar(root);
                return;
            }
            var guardar = ev.target.closest('.admin-suc-edit-save');
            if (guardar) {
                var gid = guardar.getAttribute('data-id');
                var lineG = ObebeSucursalesStore.getById(gid);
                var input = root.querySelector('.admin-suc-edit-qty[data-id="' + gid + '"]');
                var nueva = parseInt(input && input.value, 10);
                if (!lineG || isNaN(nueva) || nueva < 0) return;
                if (nueva === (lineG.cantidad || 0)) {
                    editandoLineaId = null;
                    pintar(root);
                    return;
                }
                var msgGuardar = nueva <= 0
                    ? 'Se quita «' + (lineG.nombre || '') + '» de ' + nombreSucursal(lineG.sucursalId) + '.'
                    : 'Se guarda la cantidad de «' + (lineG.nombre || '') + '» en ' + nueva + ' piezas.';
                ObebeAdminDialog.confirm({
                    title: nueva <= 0 ? '¿Quitar artículo?' : '¿Guardar cambios?',
                    message: msgGuardar,
                    confirmText: nueva <= 0 ? 'Quitar' : 'Guardar',
                    cancelText: 'Cancelar',
                    variant: nueva <= 0 ? 'danger' : 'primary'
                }).then(function (ok) {
                    if (!ok) return;
                    aplicarCantidadLinea(lineG, nueva);
                });
                return;
            }
            var quitar = ev.target.closest('.admin-suc-quitar');
            if (quitar) {
                var qid = quitar.getAttribute('data-id');
                var lineQ = ObebeSucursalesStore.getById(qid);
                if (!lineQ) return;
                ObebeAdminDialog.confirm({
                    title: '¿Quitar artículo?',
                    message: 'Se quita «' + (lineQ.nombre || '') + '» de ' + nombreSucursal(lineQ.sucursalId) +
                        '. Las piezas que correspondan vuelven al inventario principal.',
                    confirmText: 'Quitar',
                    cancelText: 'Cancelar',
                    variant: 'danger'
                }).then(function (ok) {
                    if (!ok) return;
                    aplicarCantidadLinea(lineQ, 0);
                });
                return;
            }
            var vend = ev.target.closest('.admin-suc-vender');
            if (vend) {
                var lid = vend.getAttribute('data-id');
                var maxQ = parseInt(vend.getAttribute('data-max'), 10) || 1;
                abrirModalVenta(lid, maxQ, function () { refrescarTodo(); });
            }
        };
    }

    global.ObebeAdminSucursales = { mount: mount };
})(window);
