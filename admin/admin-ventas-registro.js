(function (global) {
    'use strict';

    var mountEl = null;
    var opts = {};
    var modalOpen = false;
    var seleccionVentas = {};
    var modoSeleccion = false;
    var repintarTabla = null;

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
            field('vrRef', 'Ref', 'text', 'No. de imagen') +
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
        ['vrNombre', 'vrTalla', 'vrColor'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', sincronizarRefDesdeArticulo);
        });
        var refInput = document.getElementById('vrRef');
        if (refInput) refInput.addEventListener('change', aplicarArticuloDesdeRef);
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
        setVal('vrRef', venta ? (ObebeAdminData.refParaArticulo(venta) || '') : '');
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


    function sincronizarRefDesdeArticulo() {
        if (document.activeElement && document.activeElement.id === 'vrRef') return;
        var ref = ObebeAdminData.refParaArticulo({
            nombre: getVal('vrNombre'),
            talla: getVal('vrTalla'),
            color: getVal('vrColor')
        });
        setVal('vrRef', ref || '');
    }

    function aplicarArticuloDesdeRef() {
        var filas = ObebeAdminData.filasPorRef(getVal('vrRef'));
        if (!filas.length) return;
        var nombres = {};
        filas.forEach(function (f) { if (f.nombre) nombres[f.nombre] = true; });
        var keys = Object.keys(nombres);
        if (keys.length === 1) setVal('vrNombre', keys[0]);
        if (filas.length !== 1) return;
        var f = filas[0];
        setVal('vrNombre', f.nombre || '');
        setVal('vrTalla', f.talla || '');
        setVal('vrColor', f.color || '');
        setVal('vrTipo', f.tipo || '');
        setVal('vrPrecio', f.precio != null ? f.precio : '');
        setVal('vrSegmento', f.segmento || '');
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

    function idsSeleccionados() {
        return Object.keys(seleccionVentas).filter(function (k) {
            return seleccionVentas[k];
        }).map(function (k) { return parseInt(k, 10); }).filter(function (n) { return n > 0; });
    }

    function puedeSeleccionar() {
        return !!(opts.seleccionAlEditar && modoSeleccion);
    }

    function barraSeleccion(editable) {
        if (!editable || !opts.seleccionAlEditar) return '';
        if (!modoSeleccion) {
            return '<div class="admin-vr-bulk">' +
                '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact" id="adminVrModoEditar">Editar</button></div>';
        }
        var n = idsSeleccionados().length;
        return '<div class="admin-vr-bulk">' +
            '<button type="button" class="admin-btn admin-btn-danger admin-btn-compact" id="adminVrBorrarSel"' +
            (n ? '' : ' disabled') + '>Borrar seleccionadas (' + n + ')</button>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact" id="adminVrModoListo">Listo</button></div>';
    }

    function tablaHtml(ventas, limite, editable) {
        limite = limite || 500;
        var slice = ventas.slice(0, limite);
        var seleccionActiva = editable && puedeSeleccionar();
        var selHead = seleccionActiva
            ? '<th class="admin-vr-sel-col"><input type="checkbox" id="adminVrSelAll" aria-label="Seleccionar visibles"></th>'
            : '';
        var accHead = editable ? '<th>Opciones</th>' : '';
        var rows = slice.map(function (v) {
            var id = ventaId(v);
            var acc = '';
            var sel = '';
            if (editable && id) {
                if (seleccionActiva) {
                    sel = '<td class="admin-vr-sel-col"><input type="checkbox" class="admin-vr-sel" data-id="' + id + '"' +
                        (seleccionVentas[id] ? ' checked' : '') + ' aria-label="Seleccionar"></td>';
                }
                acc = '<td class="admin-vr-acciones">' +
                    '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-vr-edit="' + id + '">Editar</button> ' +
                    '<button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-vr-del="' + id + '">Borrar</button>' +
                    '</td>';
            } else if (editable) {
                if (seleccionActiva) sel = '<td></td>';
                acc = '<td>—</td>';
            }
            var marcada = seleccionActiva && id && seleccionVentas[id] ? ' class="admin-vr-row-sel"' : '';
            var refV = ObebeAdminData.refParaArticulo(v);
            return '<tr data-venta-id="' + id + '"' + marcada + '>' + sel +
                '<td>' + esc(ObebeAdminData.formatoFecha(v.fechaIso, v.fechaRaw)) + '</td>' +
                '<td>' + (refV ? esc(String(refV)) : '—') + '</td>' +
                '<td class="admin-venta-col-articulo">' + esc(v.nombre) + '</td><td>' + esc(v.tipo) + '</td>' +
                htmlPrecioVentaCelda(v) +
                '<td>' + esc(v.talla) + '</td><td>' + esc(v.color) + '</td>' +
                '<td>' + esc(v.segmento) + '</td><td>' + esc(v.cliente) + '</td>' +
                '<td>' + esc(v.vendedor) + '</td><td>' + esc(ObebeAdminData.etiquetaCuentaVentas(v.cuenta)) + '</td>' +
                '<td>' + esc(v.redSocial) + '</td><td>' + linkCortoVentas(v.linkVisible != null ? v.linkVisible : v.link) + '</td>' +
                '<td>' + esc(v.telefono) + '</td>' + acc + '</tr>';
        }).join('');
        var extra = ventas.length > limite
            ? '<p class="admin-vr-hint">Mostrando ' + limite + ' de ' + ventas.length + '.</p>'
            : '';
        var colSpan = editable ? (seleccionActiva ? 16 : 15) : 14;
        return barraSeleccion(editable) + extra +
            '<div class="admin-table-wrap admin-table-wrap--ventas-reg"><table class="admin-table admin-table-ventas"><thead><tr>' +
            selHead +
            '<th>Fecha</th><th>Ref</th><th>Artículo</th><th>Tipo</th><th>Precio</th><th>Talla</th><th>Color</th>' +
            '<th>Cat.</th><th>Cliente</th><th>Vendedor</th><th>Quien tiene el dinero</th>' +
            '<th>Red</th><th>Link</th><th>Tel.</th>' + accHead +
            '</tr></thead><tbody>' +
            (rows || '<tr><td colspan="' + colSpan + '">Sin ventas</td></tr>') + '</tbody></table></div>';
    }

    function htmlPrecioVentaCelda(v) {
        var cobrado = ObebeAdminData.formatoMoney(v.precio);
        var orig = Number(v.precioOriginal) || 0;
        var dif = orig > 0 && Math.abs(orig - Number(v.precio || 0)) >= 0.5;
        if (!dif) return '<td>' + cobrado + '</td>';
        return '<td><button type="button" class="admin-venta-precio-btn" data-precio="' + esc(String(v.precio)) +
            '" data-orig="' + esc(String(orig)) + '" title="Ver precio original">' + cobrado + '</button></td>';
    }

    function findVenta(id) {
        var list = opts.getVentas ? opts.getVentas() : [];
        id = parseInt(id, 10);
        return list.find(function (v) { return ventaId(v) === id; });
    }

    function onTableClick(ev) {
        var precioBtn = ev.target.closest('.admin-venta-precio-btn');
        if (precioBtn) {
            var origN = parseFloat(precioBtn.getAttribute('data-orig'));
            var cobN = parseFloat(precioBtn.getAttribute('data-precio'));
            ObebeAdminDialog.alert({
                title: 'Precio de la venta',
                message: 'Precio original: ' + ObebeAdminData.formatoMoney(origN) +
                    '\nPrecio registrado: ' + ObebeAdminData.formatoMoney(cobN),
                confirmText: 'Entendido'
            });
            return;
        }
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
            var devolverStock = /\[\[stock:\d+:-?\d+\]\]/.test(String(v2.link || ''));
            ObebeAdminDialog.confirm({
                title: '¿Borrar venta?',
                message: msg + (devolverStock
                    ? ' Se devolverá 1 unidad al inventario porque esta venta sí bajó stock.'
                    : ' No se devolverá stock (esta venta no tiene baja de inventario registrada; así evitamos piezas fantasma).'),
                confirmText: 'Borrar',
                cancelText: 'Cancelar'
            }).then(function (ok) {
                if (!ok) return;
                return ObebeAdminData.eliminarVentaLinea(ventaId(v2), { ajustarStock: devolverStock });
            }).then(function (res) {
                if (!res) return;
                if (res.ok === false) {
                    return ObebeAdminDialog.alert({ message: res.error || 'No se pudo borrar.' });
                }
                if (opts.onChanged) return opts.onChanged(res);
            }).catch(function (e) {
                ObebeAdminDialog.alert({ message: e.message || String(e) });
            });
            return;
        }
        var entrar = ev.target.closest('#adminVrModoEditar');
        if (entrar) {
            modoSeleccion = true;
            seleccionVentas = {};
            if (repintarTabla) repintarTabla();
            return;
        }
        var listo = ev.target.closest('#adminVrModoListo');
        if (listo) {
            modoSeleccion = false;
            seleccionVentas = {};
            if (repintarTabla) repintarTabla();
            return;
        }
        var bulk = ev.target.closest('#adminVrBorrarSel');
        if (bulk) {
            var ids = idsSeleccionados();
            if (!ids.length || bulk.disabled) return;
            ObebeAdminDialog.confirm({
                title: '¿Estás seguro?',
                message: 'Se borrarán ' + ids.length + ' venta(s). Solo se devolverá stock en líneas con baja de inventario registrada.',
                confirmText: 'Sí, borrar',
                cancelText: 'Cancelar',
                variant: 'danger'
            }).then(function (ok) {
                if (!ok) return;
                var chain = Promise.resolve();
                var fallo = null;
                ids.forEach(function (id) {
                    chain = chain.then(function () {
                        if (fallo) return;
                        var vDel = findVenta(id);
                        var devolver = vDel && /\[\[stock:\d+:-?\d+\]\]/.test(String(vDel.link || ''));
                        return ObebeAdminData.eliminarVentaLinea(id, { ajustarStock: !!devolver }).then(function (res) {
                            if (!res || res.ok === false) {
                                fallo = (res && res.error) || 'No se pudo borrar una venta.';
                                return;
                            }
                            delete seleccionVentas[id];
                        });
                    });
                });
                return chain.then(function () {
                    if (fallo) {
                        return ObebeAdminDialog.alert({ message: fallo });
                    }
                    if (opts.onChanged) return opts.onChanged({ ok: true, borradas: ids.length });
                });
            }).catch(function (e) {
                ObebeAdminDialog.alert({ message: e.message || String(e) });
            });
        }
    }

    function onTableChange(ev) {
        var root = ev.currentTarget;
        var all = ev.target.id === 'adminVrSelAll' ? ev.target : null;
        if (all && root) {
            root.querySelectorAll('.admin-vr-sel').forEach(function (cb) {
                var id = parseInt(cb.getAttribute('data-id'), 10);
                if (!id) return;
                seleccionVentas[id] = !!all.checked;
                cb.checked = !!all.checked;
                var tr = cb.closest('tr');
                if (tr) tr.classList.toggle('admin-vr-row-sel', !!all.checked);
            });
            var btnAll = root.querySelector('#adminVrBorrarSel');
            var nAll = idsSeleccionados().length;
            if (btnAll) {
                btnAll.disabled = !nAll;
                btnAll.textContent = 'Borrar seleccionadas (' + nAll + ')';
            }
            return;
        }
        var cb = ev.target.classList && ev.target.classList.contains('admin-vr-sel') ? ev.target : null;
        if (!cb) return;
        var id = parseInt(cb.getAttribute('data-id'), 10);
        if (!id) return;
        seleccionVentas[id] = !!cb.checked;
        var tr = cb.closest('tr');
        if (tr) tr.classList.toggle('admin-vr-row-sel', !!cb.checked);
        var btn = root && root.querySelector('#adminVrBorrarSel');
        var n = idsSeleccionados().length;
        if (btn) {
            btn.disabled = !n;
            btn.textContent = 'Borrar seleccionadas (' + n + ')';
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

        repintarTabla = function () {
            var frescas = opts.getVentas ? opts.getVentas() : list;
            pintar(frescas);
        };

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
            el.addEventListener('change', onTableChange);
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
