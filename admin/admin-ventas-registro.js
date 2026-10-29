(function (global) {
    'use strict';

    var mountEl = null;
    var opts = {};
    var modalOpen = false;

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function linkCortoVentas(url) {
        var u = String(url || '').trim();
        if (!u) return '—';
        var href = u.indexOf('http') === 0 ? u : 'https://' + u.replace(/^\/+/, '');
        var txt = u.length > 28 ? u.slice(0, 26) + '…' : u;
        return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(txt) + '</a>';
    }

    function ventaId(v) {
        return v && v.filaSheet ? parseInt(v.filaSheet, 10) : 0;
    }

    function ensureModalRoot() {
        var root = document.getElementById('adminVentaRegistroModal');
        if (root) return root;
        root = document.createElement('div');
        root.id = 'adminVentaRegistroModal';
        root.className = 'admin-vr-modal-root admin-hidden';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML =
            '<div class="admin-vr-modal-backdrop" data-vr-dismiss="1"></div>' +
            '<div class="admin-vr-modal" role="dialog" aria-modal="true">' +
            '<div class="admin-vr-modal-head">' +
            '<h3 id="adminVrModalTitle">Editar venta</h3>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-vr-modal-close" data-vr-dismiss="1" aria-label="Cerrar">×</button>' +
            '</div>' +
            '<form id="adminVrModalForm" class="admin-vr-modal-body">' +
            '<div class="admin-field-row">' +
            field('vrFecha', 'Fecha', 'text', 'dd/mm/aaaa') +
            field('vrNombre', 'Artículo', 'text') +
            field('vrTipo', 'Tipo', 'text') +
            field('vrPrecio', 'Precio', 'text') +
            '</div>' +
            '<div class="admin-field-row">' +
            field('vrTalla', 'Talla', 'text') +
            field('vrColor', 'Color', 'text') +
            field('vrSegmento', 'Cat.', 'text') +
            field('vrCliente', 'Cliente', 'text') +
            '</div>' +
            '<div class="admin-field-row">' +
            field('vrVendedor', 'Vendedor', 'text') +
            field('vrCuenta', 'Quien tiene el dinero', 'text') +
            field('vrRed', 'Red social', 'text') +
            field('vrTel', 'Teléfono', 'text') +
            '</div>' +
            field('vrLink', 'Link', 'text') +
            '<label class="admin-vr-check" id="adminVrStockWrap">' +
            '<input type="checkbox" id="adminVrAjustarStock" checked> ' +
            '<span id="adminVrStockLabel">Ajustar inventario (descontar o devolver 1 unidad si coincide artículo/talla/color)</span>' +
            '</label>' +
            '<p id="adminVrModalError" class="admin-vr-modal-error" role="alert"></p>' +
            '<div class="admin-vr-modal-actions">' +
            '<button type="button" class="admin-btn admin-btn-danger" data-vr-dismiss="1">Cancelar</button>' +
            '<button type="submit" class="admin-btn admin-btn-primary admin-vr-modal-save" id="adminVrModalSave">Guardar</button>' +
            '</div></form></div>';
        document.body.appendChild(root);

        root.querySelectorAll('[data-vr-dismiss]').forEach(function (el) {
            el.addEventListener('click', function (ev) {
                ev.preventDefault();
                intentarCerrarModal();
            });
        });
        document.getElementById('adminVrModalForm').addEventListener('submit', onSubmitModal);
        document.addEventListener('keydown', function (ev) {
            if (ev.key === 'Escape' && modalOpen) {
                ev.preventDefault();
                intentarCerrarModal();
            }
        });
        return root;
    }

    function field(id, label, type, placeholder) {
        return '<div class="admin-field"><label for="' + id + '">' + esc(label) + '</label>' +
            '<input id="' + id + '" type="' + type + '" autocomplete="off"' +
            (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + '></div>';
    }

    var modalMode = 'edit';
    var modalVentaId = 0;
    var modalSnapshot = '';

    function openModal(mode, venta) {
        ensureModalRoot();
        modalMode = mode;
        modalVentaId = venta ? ventaId(venta) : 0;
        modalOpen = true;
        var root = document.getElementById('adminVentaRegistroModal');
        var title = document.getElementById('adminVrModalTitle');
        var stockWrap = document.getElementById('adminVrStockWrap');
        var err = document.getElementById('adminVrModalError');
        if (err) err.textContent = '';
        title.textContent = mode === 'create' ? 'Agregar línea de venta' : 'Editar venta';
        if (stockWrap) {
            stockWrap.classList.toggle('admin-hidden', mode === 'edit');
        }
        var c = venta ? ObebeAdminData.ventaCamposDesdeObj(venta) : {
            fechaRaw: '', nombre: '', tipo: '', precio: 0, talla: '', color: '', segmento: '',
            cliente: '', vendedor: '', cuenta: '', redSocial: '', link: '', telefono: ''
        };
        if (mode === 'create' && !c.fechaRaw) {
            var d0 = new Date();
            c.fechaRaw = ('0' + d0.getDate()).slice(-2) + '/' + ('0' + (d0.getMonth() + 1)).slice(-2) + '/' + d0.getFullYear();
        }
        setVal('vrFecha', c.fechaRaw);
        setVal('vrNombre', c.nombre);
        setVal('vrTipo', c.tipo);
        setVal('vrPrecio', c.precio);
        setVal('vrTalla', c.talla);
        setVal('vrColor', c.color);
        setVal('vrSegmento', c.segmento);
        setVal('vrCliente', c.cliente);
        setVal('vrVendedor', c.vendedor);
        setVal('vrCuenta', c.cuenta);
        setVal('vrRed', c.redSocial);
        setVal('vrLink', c.link);
        setVal('vrTel', c.telefono);
        var chk = document.getElementById('adminVrAjustarStock');
        if (chk) chk.checked = mode === 'create';
        root.classList.remove('admin-hidden');
        root.setAttribute('aria-hidden', 'false');
        document.body.classList.add('admin-vr-modal-open');
        modalSnapshot = snapshotModalCampos();
        document.getElementById('vrNombre').focus();
    }

    function snapshotModalCampos() {
        var snap = leerCamposModal();
        if (modalMode === 'create') {
            var chk = document.getElementById('adminVrAjustarStock');
            snap._ajustarStock = chk ? !!chk.checked : false;
        }
        return JSON.stringify(snap);
    }

    function modalTieneCambios() {
        if (!modalOpen) return false;
        return modalSnapshot !== snapshotModalCampos();
    }

    function cerrarModalForzado() {
        modalOpen = false;
        modalSnapshot = '';
        var root = document.getElementById('adminVentaRegistroModal');
        if (!root) return;
        root.classList.add('admin-hidden');
        root.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('admin-vr-modal-open');
    }

    function intentarCerrarModal() {
        if (!modalOpen) return;
        if (!modalTieneCambios()) {
            cerrarModalForzado();
            return;
        }
        ObebeAdminDialog.confirm({
            title: '¿Guardar cambios?',
            message: 'Modificaste datos de la venta. ¿Quieres guardarlos antes de salir?',
            confirmText: 'Guardar',
            cancelText: 'Salir sin guardar',
            variant: 'warn'
        }).then(function (guardar) {
            if (guardar) {
                document.getElementById('adminVrModalForm').requestSubmit();
            } else {
                cerrarModalForzado();
            }
        });
    }

    function setVal(id, v) {
        var el = document.getElementById(id);
        if (el) el.value = v == null ? '' : String(v);
    }

    function getVal(id) {
        var el = document.getElementById(id);
        return el ? el.value : '';
    }


    function leerCamposModal() {
        return {
            fechaRaw: getVal('vrFecha').trim(),
            nombre: getVal('vrNombre').trim(),
            tipo: getVal('vrTipo').trim(),
            precio: getVal('vrPrecio').trim(),
            talla: getVal('vrTalla').trim(),
            color: getVal('vrColor').trim(),
            segmento: getVal('vrSegmento').trim(),
            cliente: getVal('vrCliente').trim(),
            vendedor: getVal('vrVendedor').trim(),
            cuenta: getVal('vrCuenta').trim(),
            redSocial: getVal('vrRed').trim(),
            link: getVal('vrLink').trim(),
            telefono: getVal('vrTel').trim()
        };
    }

    function onSubmitModal(ev) {
        ev.preventDefault();
        var err = document.getElementById('adminVrModalError');
        var btn = document.getElementById('adminVrModalSave');
        var campos = leerCamposModal();
        if (!campos.nombre && !campos.fechaRaw) {
            if (err) err.textContent = 'Indica al menos fecha o artículo.';
            return;
        }
        if (parseFloat(String(campos.precio).replace(',', '.')) < 0) {
            if (err) err.textContent = 'El precio no puede ser negativo. Registra gastos en el módulo Gastos.';
            return;
        }
        if (err) err.textContent = '';
        if (btn) btn.disabled = true;
        var ajustar = !!(document.getElementById('adminVrAjustarStock') || {}).checked;
        var prom;
        if (modalMode === 'create') {
            prom = ObebeAdminData.crearVentaLineaManual(campos, { ajustarStock: ajustar });
        } else {
            prom = ObebeAdminData.actualizarVentaLinea(modalVentaId, campos);
        }
        prom.then(function (res) {
            if (!res || res.ok === false) {
                throw new Error((res && res.error) || 'No se pudo guardar.');
            }
            cerrarModalForzado();
            if (opts.onChanged) return opts.onChanged(res);
        }).catch(function (e) {
            if (err) err.textContent = e.message || String(e);
        }).finally(function () {
            if (btn) btn.disabled = false;
        });
    }

    function tablaHtml(ventas, limite, editable) {
        limite = limite || 500;
        var slice = ventas.slice(0, limite);
        var accHead = editable ? '<th>Opciones</th>' : '';
        var rows = slice.map(function (v) {
            var id = ventaId(v);
            var acc = '';
            if (editable && id) {
                acc = '<td class="admin-vr-acciones">' +
                    '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-vr-edit="' + id + '">Editar</button> ' +
                    '<button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-vr-del="' + id + '">Borrar</button>' +
                    '</td>';
            } else if (editable) {
                acc = '<td>—</td>';
            }
            return '<tr data-venta-id="' + id + '"><td>' + esc(ObebeAdminData.formatoFecha(v.fechaIso, v.fechaRaw)) + '</td>' +
                '<td>' + esc(v.nombre) + '</td><td>' + esc(v.tipo) + '</td>' +
                '<td>' + ObebeAdminData.formatoMoney(v.precio) + '</td>' +
                '<td>' + esc(v.talla) + '</td><td>' + esc(v.color) + '</td>' +
                '<td>' + esc(v.segmento) + '</td><td>' + esc(v.cliente) + '</td>' +
                '<td>' + esc(v.vendedor) + '</td><td>' + esc(ObebeAdminData.etiquetaCuentaVentas(v.cuenta)) + '</td>' +
                '<td>' + esc(v.redSocial) + '</td><td>' + linkCortoVentas(v.link) + '</td>' +
                '<td>' + esc(v.telefono) + '</td>' + acc + '</tr>';
        }).join('');
        var extra = ventas.length > limite
            ? '<p class="admin-vr-hint">Mostrando ' + limite + ' de ' + ventas.length + '.</p>'
            : '';
        var colSpan = editable ? 14 : 13;
        return extra + '<div class="admin-table-wrap"><table class="admin-table admin-table-ventas"><thead><tr>' +
            '<th>Fecha</th><th>Artículo</th><th>Tipo</th><th>Precio</th><th>Talla</th><th>Color</th>' +
            '<th>Cat.</th><th>Cliente</th><th>Vendedor</th><th>Quien tiene el dinero</th>' +
            '<th>Red</th><th>Link</th><th>Tel.</th>' + accHead +
            '</tr></thead><tbody>' +
            (rows || '<tr><td colspan="' + colSpan + '">Sin ventas</td></tr>') + '</tbody></table></div>';
    }

    function findVenta(id) {
        var list = opts.getVentas ? opts.getVentas() : [];
        id = parseInt(id, 10);
        return list.find(function (v) { return ventaId(v) === id; });
    }

    function onTableClick(ev) {
        if (!ObebeAdminData.edicionVentasHabilitada()) return;
        var edit = ev.target.closest('[data-vr-edit]');
        if (edit) {
            var v = findVenta(edit.getAttribute('data-vr-edit'));
            if (v) openModal('edit', v);
            return;
        }
        var del = ev.target.closest('[data-vr-del]');
        if (del) {
            var v2 = findVenta(del.getAttribute('data-vr-del'));
            if (!v2) return;
            var msg = 'Se eliminará la línea: ' + (v2.nombre || 'venta') + '.';
            ObebeAdminDialog.confirm({
                title: '¿Borrar venta?',
                message: msg + ' Puedes devolver 1 unidad al inventario si coincide artículo, talla y color.',
                confirmText: 'Borrar',
                cancelText: 'Cancelar'
            }).then(function (ok) {
                if (!ok) return;
                return ObebeAdminData.eliminarVentaLinea(ventaId(v2), { ajustarStock: true });
            }).then(function (res) {
                if (!res) return;
                if (res.ok === false) {
                    return ObebeAdminDialog.alert({ message: res.error || 'No se pudo borrar.' });
                }
                if (opts.onChanged) return opts.onChanged(res);
            }).catch(function (e) {
                ObebeAdminDialog.alert({ message: e.message || String(e) });
            });
        }
    }

    function renderInto(el, ventas, options) {
        if (!el) return;
        mountEl = el;
        opts = options || {};
        var editable = !!opts.editable && ObebeAdminData.edicionVentasHabilitada();
        var list = ventas || [];

        function pintar(lista) {
            el.innerHTML = tablaHtml(lista, opts.limite || 500, editable);
        }

        pintar(list);

        if (editable && ObebeAdminData.ventasNecesitanSincronizarIds &&
            ObebeAdminData.ventasNecesitanSincronizarIds(list)) {
            ObebeAdminData.sincronizarVentasParaEdicion().then(function () {
                var fresh = opts.getVentas ? opts.getVentas() : (ObebeAdminData.getEstado().ventas || list);
                pintar(fresh);
                if (opts.onChanged) opts.onChanged({ ok: true, resync: true });
            }).catch(function () { /* tabla ya visible */ });
        }

        if (!el._vrBound) {
            el._vrBound = true;
            el.addEventListener('click', onTableClick);
        }
    }

    function bindAgregar(btn) {
        if (!btn || btn._vrAddBound) return;
        btn._vrAddBound = true;
        btn.addEventListener('click', function () {
            if (!ObebeAdminData.edicionVentasHabilitada()) {
                ObebeAdminDialog.alert({
                    message: 'Para editar ventas necesitas Supabase configurado o modo local del admin.'
                });
                return;
            }
            openModal('create', null);
        });
    }

    global.ObebeAdminVentasRegistro = {
        renderInto: renderInto,
        bindAgregar: bindAgregar
    };
})(window);
