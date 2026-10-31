(function (global) {
    'use strict';

    var EQUIPO = ['Ugo', 'Daniel', 'Fer'];
    var filtroEstado = 'activo';
    var abonoApartadoId = null;
    var tipoCliente = 'existente';
    var clienteSeleccionadoId = '';
    var clientesLista = [];
    var getFilasInv = function () { return []; };
    var inventarioPickRowEl = null;
    var inventarioPickSelected = null;

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function fmt(n) {
        return ObebeAdminData.formatoMoney(n || 0);
    }

    function hoyRaw() {
        var d = new Date();
        return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
    }

    function hoyIsoDate() {
        var d = new Date();
        return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }

    function rawFechaToIso(raw) {
        var p = String(raw || '').trim().split(/[\/\-]/);
        if (p.length !== 3) return '';
        var d = parseInt(p[0], 10);
        var m = parseInt(p[1], 10);
        var y = parseInt(p[2], 10);
        if (y < 100) y += 2000;
        if (isNaN(d) || isNaN(m) || isNaN(y)) return '';
        return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2);
    }

    function isoFechaToRaw(iso) {
        var p = String(iso || '').trim().split('-');
        if (p.length !== 3) return '';
        return ('0' + parseInt(p[2], 10)).slice(-2) + '/' +
            ('0' + parseInt(p[1], 10)).slice(-2) + '/' + p[0];
    }

    function totalPrendasForm(container) {
        var sum = 0;
        (container.querySelectorAll('.admin-apartado-prenda-row') || []).forEach(function (row) {
            var nombre = ((row.querySelector('.admin-ap-prenda-nombre') || {}).value || '').trim();
            if (!nombre) return;
            var precio = ObebeApartadosStore.parseMonto((row.querySelector('.admin-ap-prenda-precio') || {}).value);
            var qty = parseInt((row.querySelector('.admin-ap-prenda-cant') || {}).value, 10);
            if (isNaN(qty) || qty < 1) qty = 1;
            sum += precio * qty;
        });
        return Math.round(sum * 100) / 100;
    }

    function pintarTotalApartadoForm() {
        var box = document.getElementById('adminApartadoTotalDisplay');
        if (!box) return;
        var rows = document.getElementById('adminApartadoPrendasRows');
        box.textContent = fmt(totalPrendasForm(rows));
    }

    function selectEquipo(id, label, valor) {
        var opts = '<option value="">— Elegir —</option>' +
            EQUIPO.map(function (n) {
                return '<option value="' + esc(n) + '"' + (valor === n ? ' selected' : '') + '>' + esc(n) + '</option>';
            }).join('');
        return '<div class="admin-field"><label for="' + id + '">' + esc(label) + '</label>' +
            '<select id="' + id + '" class="admin-venta-pago-select">' + opts + '</select></div>';
    }

    function htmlPrendaRow(p, idx) {
        p = p || {};
        var Ui = global.ObebeAdminCamposUi;
        var invHint = p.inventarioId
            ? '<span class="admin-ap-inv-hint">Vinculado inventario</span>'
            : '<span class="admin-ap-inv-hint admin-muted-text">Sin vínculo</span>';
        return '<div class="admin-apartado-prenda-row" data-prenda-idx="' + idx + '">' +
            '<input type="hidden" class="admin-ap-prenda-invid" value="' + esc(p.inventarioId || '') + '">' +
            '<input type="hidden" class="admin-ap-prenda-filasheet" value="' + esc(p.filaSheet || '') + '">' +
            '<div class="admin-field admin-field-grow admin-ap-field-nombre"><label>Nombre</label>' +
            '<input type="text" class="admin-ap-prenda-nombre" value="' + esc(p.nombre) + '" placeholder="Prenda…"></div>' +
            '<div class="admin-field admin-field-select-otro"><label>Marca</label>' +
            (Ui ? Ui.htmlSelectConOtro({
                lista: Ui.MARCAS_APARTADO,
                valor: p.marca,
                selectClass: 'admin-ap-prenda-marca-select',
                otroClass: 'admin-ap-prenda-marca-otro',
                otroPlaceholder: 'Otra marca…'
            }) : '') + '</div>' +
            '<div class="admin-field admin-field-select-otro"><label>Color</label>' +
            (Ui ? Ui.htmlSelectConOtro({
                lista: Ui.COLORES_APARTADO,
                valor: p.color,
                selectClass: 'admin-ap-prenda-color-select',
                otroClass: 'admin-ap-prenda-color-otro',
                otroPlaceholder: 'Otro color…'
            }) : '') + '</div>' +
            '<div class="admin-field admin-field-talla admin-field-select-otro"><label>Talla</label>' +
            (Ui ? Ui.htmlSelectConOtro({
                lista: Ui.TALLAS_APARTADO,
                valor: p.talla,
                selectClass: 'admin-ap-prenda-talla-select',
                otroClass: 'admin-ap-prenda-talla-otro',
                otroPlaceholder: 'Otra talla…'
            }) : '') + '</div>' +
            '<div class="admin-field admin-field-narrow"><label>Precio</label>' +
            '<input type="text" class="admin-ap-prenda-precio" inputmode="decimal" value="' +
            (p.precio != null && p.precio !== '' ? esc(String(p.precio)) : '') + '" placeholder="0"></div>' +
            '<div class="admin-field admin-field-narrow"><label>Cant.</label>' +
            '<input type="number" min="1" class="admin-ap-prenda-cant" value="' +
            (p.cantidad != null ? esc(String(p.cantidad)) : '1') + '"></div>' +
            '<div class="admin-ap-prenda-inv-col">' + invHint +
            '<button type="button" class="admin-btn admin-btn-ghost admin-ap-prenda-inv" title="Vincular inventario">Inv.</button></div>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm admin-ap-prenda-quitar" title="Quitar prenda">×</button></div>';
    }

    function leerPrendasDelForm(container) {
        var rows = container.querySelectorAll('.admin-apartado-prenda-row');
        var out = [];
        rows.forEach(function (row) {
            var nombre = (row.querySelector('.admin-ap-prenda-nombre') || {}).value || '';
            nombre = nombre.trim();
            if (!nombre) return;
            out.push({
                nombre: nombre,
                marca: global.ObebeAdminCamposUi ? global.ObebeAdminCamposUi.leerSelectOtro(
                    row.querySelector('.admin-ap-prenda-marca-select'),
                    row.querySelector('.admin-ap-prenda-marca-otro')
                ) : '',
                color: global.ObebeAdminCamposUi ? global.ObebeAdminCamposUi.leerSelectOtro(
                    row.querySelector('.admin-ap-prenda-color-select'),
                    row.querySelector('.admin-ap-prenda-color-otro')
                ) : '',
                talla: global.ObebeAdminCamposUi ? global.ObebeAdminCamposUi.leerSelectOtro(
                    row.querySelector('.admin-ap-prenda-talla-select'),
                    row.querySelector('.admin-ap-prenda-talla-otro')
                ) : '',
                inventarioId: ((row.querySelector('.admin-ap-prenda-invid') || {}).value || '').trim(),
                filaSheet: parseInt((row.querySelector('.admin-ap-prenda-filasheet') || {}).value, 10) || 0,
                precio: ObebeApartadosStore.parseMonto((row.querySelector('.admin-ap-prenda-precio') || {}).value),
                cantidad: parseInt((row.querySelector('.admin-ap-prenda-cant') || {}).value, 10) || 1
            });
        });
        return out;
    }

    function opcionesClientesExistentes() {
        return '<option value="">— Selecciona cliente —</option>' +
            clientesLista.map(function (c) {
                return '<option value="' + esc(c.id || c.nombre) + '">' + esc(c.nombre) + '</option>';
            }).join('');
    }

    function clienteExistenteHit() {
        if (!clienteSeleccionadoId) return null;
        return clientesLista.find(function (c) {
            return (c.id || c.nombre) === clienteSeleccionadoId;
        }) || null;
    }

    function actualizarPanelClienteApartado(container) {
        var nuevo = document.getElementById('adminApartadoPanelNuevo');
        var exist = document.getElementById('adminApartadoPanelExistente');
        if (nuevo) nuevo.classList.toggle('admin-hidden', tipoCliente !== 'nuevo');
        if (exist) exist.classList.toggle('admin-hidden', tipoCliente !== 'existente');
        container.querySelectorAll('.admin-ap-tipo-btn').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-tipo') === tipoCliente);
        });
    }

    function pintarResumenClienteApartado() {
        var box = document.getElementById('adminApartadoClienteResumen');
        if (!box) return;
        var c = clienteExistenteHit();
        if (!c) {
            box.innerHTML = '<p class="admin-muted-text">Elige un cliente de la base (módulo Clientes).</p>';
            return;
        }
        box.innerHTML = '<p class="admin-muted-text"><strong>Contacto:</strong> ' +
            esc(c.telefono || '—') + ' · ' + esc(c.redPrincipal || '—') +
            (c.link ? ' · ' + esc(c.link) : '') + '</p>';
    }

    function leerClienteFormulario() {
        if (tipoCliente === 'nuevo') {
            var Ui = global.ObebeAdminCamposUi;
            return {
                cliente: ((document.getElementById('adminApartadoNombreNuevo') || {}).value || '').trim(),
                clienteId: '',
                telefono: (document.getElementById('adminApartadoTelNuevo') || {}).value || '',
                redSocial: Ui ? Ui.leerRedSocial(
                    document.getElementById('adminApartadoRedNuevoSelect'),
                    document.getElementById('adminApartadoRedNuevoOtro')
                ) : '',
                link: (document.getElementById('adminApartadoLinkNuevo') || {}).value || ''
            };
        }
        var c = clienteExistenteHit();
        return {
            cliente: c ? c.nombre : '',
            clienteId: c ? (c.id || c.nombre) : '',
            telefono: c ? (c.telefono || '') : '',
            redSocial: c ? (c.redPrincipal || '') : '',
            link: c ? (c.link || '') : ''
        };
    }

    function prendaPuedeEntregarse(p) {
        if (!p || p.entregada) return false;
        if (p.inventarioId || p.filaSheet) return true;
        return !!(global.ObebeAdminData && ObebeAdminData.buscarFilaInventarioApartado(p));
    }

    function etiquetaEstadoPrenda(p) {
        if (p.entregada) return '<span class="admin-tag admin-tag-ok">Entregada</span>';
        if (prendaPuedeEntregarse(p)) return '<span class="admin-tag admin-tag-warn">Pendiente entrega</span>';
        return '<span class="admin-tag admin-tag-muted">Sin vínculo inv.</span>';
    }

    function thumbInvHtml(r) {
        var url = ObebeAdminData.urlImagenFilaInventario(r);
        if (!url) {
            return '<span class="admin-ap-inv-pick-thumb admin-ap-inv-pick-thumb--empty" aria-hidden="true"></span>';
        }
        return '<img class="admin-ap-inv-pick-thumb" src="' + esc(url) + '" alt="" loading="lazy" onerror="adminMayoreoImgFallback(this)">';
    }

    function pctPagado(ap) {
        var total = ObebeApartadosStore.parseMonto(ap.totalAPagar);
        if (total <= 0) return 0;
        return Math.min(100, Math.round((ObebeApartadosStore.totalPagado(ap) / total) * 100));
    }

    function htmlPrendasTabla(ap) {
        var prendas = (ap && ap.prendas) || [];
        var cancelado = ap && ObebeApartadosStore.estadoCalculado(ap) === 'cancelado';
        if (!prendas.length) {
            return '<p class="admin-muted-text">Sin prendas registradas.</p>';
        }
        var rows = prendas.map(function (p) {
            var acc = '';
            if (!cancelado && prendaPuedeEntregarse(p)) {
                acc = '<button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-ap-entregar="' +
                    esc(ap.id) + '" data-ap-prenda="' + esc(p.id) + '">Marcar entregada</button>';
            }
            var qty = p.cantidad > 0 ? p.cantidad : 1;
            var precioLbl = p.precio > 0 ? fmt(p.precio) + (qty > 1 ? ' ×' + qty : '') : '—';
            return '<tr><td>' + esc(p.nombre) + '</td><td>' + esc(p.marca) + '</td>' +
                '<td>' + esc(p.color) + '</td><td>' + esc(p.talla) + '</td>' +
                '<td>' + precioLbl + '</td>' +
                '<td>' + etiquetaEstadoPrenda(p) + '</td>' +
                '<td class="admin-vr-acciones">' + (acc || '—') + '</td></tr>';
        }).join('');
        return '<div class="admin-table-wrap admin-apartado-prendas-wrap"><table class="admin-table admin-table-compact">' +
            '<thead><tr><th>Prenda</th><th>Marca</th><th>Color</th><th>Talla</th><th>Precio</th><th>Estado</th><th></th></tr></thead><tbody>' +
            rows + '</tbody></table></div>';
    }

    function htmlPagosLista(ap) {
        var pagos = (ap.pagos || []).slice();
        if (!pagos.length) {
            return '<p class="admin-muted-text">Aún no hay abonos.</p>';
        }
        var rows = pagos.map(function (p) {
            return '<tr><td>' + esc(ObebeAdminData.formatoFecha('', p.fechaRaw)) + '</td>' +
                '<td>' + fmt(p.monto) + '</td>' +
                '<td>' + esc(ObebeAdminData.etiquetaCuentaVentas(p.cuenta)) + '</td>' +
                '<td>' + esc(p.vendedor || '—') + '</td></tr>';
        }).join('');
        return '<div class="admin-table-wrap"><table class="admin-table admin-table-compact">' +
            '<thead><tr><th>Fecha</th><th>Monto</th><th>Cuenta</th><th>Vendedor</th></tr></thead><tbody>' +
            rows + '</tbody></table></div>';
    }

    function tagEstado(ap) {
        var st = ObebeApartadosStore.estadoCalculado(ap);
        if (st === 'completado') return '<span class="admin-tag admin-tag-ok">Liquidado</span>';
        if (st === 'cancelado') return '<span class="admin-tag admin-tag-danger">Cancelado</span>';
        return '<span class="admin-tag admin-tag-warn">Activo</span>';
    }

    function htmlTarjetaApartado(ap) {
        var pagado = ObebeApartadosStore.totalPagado(ap);
        var pendiente = ObebeApartadosStore.saldoPendiente(ap);
        var pct = pctPagado(ap);
        var st = ObebeApartadosStore.estadoCalculado(ap);
        var acciones = '';
        if (st === 'activo') {
            acciones = '<button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-ap-abono="' + esc(ap.id) + '">Registrar abono</button> ';
            var pendEnt = (ap.prendas || []).some(function (p) { return prendaPuedeEntregarse(p); });
            if (pendEnt) {
                acciones += '<button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-ap-entregar-todo="' +
                    esc(ap.id) + '">Entregar prendas (bajar stock)</button> ';
            }
            acciones += '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-ap-completar="' + esc(ap.id) + '">Marcar liquidado</button> ';
        } else if (st === 'completado') {
            acciones = '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-ap-desliquidar="' + esc(ap.id) + '">Desliquidar</button>';
        }
        if (ap.entregadoEn) {
            acciones = '<span class="admin-muted-text">Entregado · </span>' + acciones;
        }
        acciones += ' <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-ap-borrar="' + esc(ap.id) + '">Eliminar</button>';
        return '<article class="admin-apartado-card" data-ap-id="' + esc(ap.id) + '">' +
            '<details class="admin-apartado-details">' +
            '<summary class="admin-apartado-summary">' +
            '<div class="admin-apartado-summary-main">' +
            '<div><strong class="admin-apartado-cliente">' + esc(ap.cliente) + '</strong> ' + tagEstado(ap) +
            '<p class="admin-muted-text admin-apartado-meta">' + (ap.prendas || []).length + ' prenda(s) · Creado ' +
            ObebeAdminData.formatoFechaLarga(ap.creadoEn) + '</p></div>' +
            '<div class="admin-apartado-montos">' +
            '<span>Total <strong>' + fmt(ap.totalAPagar) + '</strong></span>' +
            '<span>Abonado <strong>' + fmt(pagado) + '</strong></span>' +
            '<span>Pendiente <strong>' + fmt(pendiente) + '</strong></span></div></div>' +
            '<span class="admin-apartado-chevron" aria-hidden="true">▾</span></summary>' +
            '<div class="admin-apartado-details-body">' +
            '<div class="admin-apartado-progress" aria-hidden="true"><div class="admin-apartado-progress-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="admin-apartado-card-body">' +
            '<div class="admin-apartado-col"><h4>Prendas</h4>' + htmlPrendasTabla(ap) + '</div>' +
            '<div class="admin-apartado-col"><h4>Abonos (van a Ventas)</h4>' + htmlPagosLista(ap) + '</div></div>' +
            (ap.notas ? '<p class="admin-apartado-notas"><span class="admin-muted-text">Notas:</span> ' + esc(ap.notas) + '</p>' : '') +
            '<div class="admin-apartado-card-actions">' + acciones + '</div></div></details></article>';
    }

    function ensureInventarioModal() {
        var root = document.getElementById('adminApartadoInvModal');
        if (root) return root;
        root = document.createElement('div');
        root.id = 'adminApartadoInvModal';
        root.className = 'admin-apartado-modal-root admin-hidden';
        root.innerHTML =
            '<div class="admin-apartado-modal-backdrop" data-ap-inv-dismiss="1"></div>' +
            '<div class="admin-apartado-modal admin-apartado-modal--wide" role="dialog">' +
            '<div class="admin-apartado-modal-head"><h3>Vincular inventario</h3>' +
            '<button type="button" class="admin-btn admin-btn-ghost" data-ap-inv-dismiss="1">×</button></div>' +
            '<div class="admin-apartado-modal-body">' +
            '<input type="search" class="admin-search" id="adminApartadoInvBuscar" placeholder="Buscar nombre, marca, talla…">' +
            '<p id="adminApartadoInvContador" class="admin-muted-text admin-ap-inv-contador"></p>' +
            '<div id="adminApartadoInvLista" class="admin-ap-inv-lista"></div>' +
            '<div class="admin-apartado-modal-actions admin-ap-inv-modal-actions">' +
            '<button type="button" class="admin-btn admin-btn-ghost" data-ap-inv-dismiss="1">Cancelar</button>' +
            '<button type="button" class="admin-btn admin-btn-primary" id="adminApartadoInvConfirm" disabled>Confirmar vínculo</button>' +
            '</div></div></div>';
        document.body.appendChild(root);
        root.querySelectorAll('[data-ap-inv-dismiss]').forEach(function (el) {
            el.addEventListener('click', function () { cerrarInventarioModal(); });
        });
        document.getElementById('adminApartadoInvBuscar').addEventListener('input', function () {
            inventarioPickSelected = null;
            pintarListaInventarioPicker();
        });
        document.getElementById('adminApartadoInvConfirm').addEventListener('click', confirmarInventarioPicker);
        return root;
    }

    function cerrarInventarioModal() {
        inventarioPickRowEl = null;
        inventarioPickSelected = null;
        var root = document.getElementById('adminApartadoInvModal');
        if (root) root.classList.add('admin-hidden');
        document.body.classList.remove('admin-apartado-modal-open');
    }

    function confirmarInventarioPicker() {
        if (!inventarioPickRowEl || !inventarioPickSelected) return;
        var fila = filaInvPorPickId(inventarioPickSelected.invId, inventarioPickSelected.filaSheet);
        if (fila) aplicarInventarioAPrendaRow(inventarioPickRowEl, fila);
        cerrarInventarioModal();
    }

    function pintarListaInventarioPicker() {
        var box = document.getElementById('adminApartadoInvLista');
        if (!box) return;
        var q = String((document.getElementById('adminApartadoInvBuscar') || {}).value || '').trim().toLowerCase();
        var list = getFilasInv().slice();
        if (q) {
            list = list.filter(function (r) {
                var blob = [r.nombre, r.marca, r.color, r.talla, r.tipo].join(' ').toLowerCase();
                return blob.indexOf(q) >= 0;
            });
        }
        list.sort(function (a, b) {
            return String(a.nombre).localeCompare(String(b.nombre), 'es');
        });
        var cnt = document.getElementById('adminApartadoInvContador');
        if (cnt) {
            var total = getFilasInv().length;
            cnt.textContent = list.length + ' artículo(s)' + (list.length < total ? ' (filtrados de ' + total + ')' : ' en inventario');
        }
        if (!list.length) {
            box.innerHTML = '<p class="admin-muted-text">Sin resultados.</p>';
            return;
        }
        box.innerHTML = list.map(function (r) {
            var id = ObebeAdminData.idFilaInventario(r);
            var sel = inventarioPickSelected && inventarioPickSelected.invId === id ? ' is-selected' : '';
            return '<button type="button" class="admin-ap-inv-pick' + sel + '" data-inv-id="' + esc(id) + '" data-fila="' +
                esc(r.filaSheet) + '">' + thumbInvHtml(r) +
                '<span class="admin-ap-inv-pick-text"><strong>' + esc(r.nombre) + '</strong> · ' + esc(r.marca) +
                ' · ' + esc(r.talla) + ' · ' + esc(r.color) + ' · Stock ' + (r.stock || 0) + '</span></button>';
        }).join('');
        var btnOk = document.getElementById('adminApartadoInvConfirm');
        if (btnOk) btnOk.disabled = !inventarioPickSelected;
    }

    function abrirInventarioPicker(rowEl) {
        inventarioPickRowEl = rowEl;
        inventarioPickSelected = null;
        ensureInventarioModal();
        document.getElementById('adminApartadoInvBuscar').value = '';
        pintarListaInventarioPicker();
        var root = document.getElementById('adminApartadoInvModal');
        root.classList.remove('admin-hidden');
        document.body.classList.add('admin-apartado-modal-open');
    }

    function aplicarInventarioAPrendaRow(rowEl, filaInv) {
        if (!rowEl || !filaInv) return;
        (rowEl.querySelector('.admin-ap-prenda-nombre') || {}).value = filaInv.nombre || '';
        var Ui = global.ObebeAdminCamposUi;
        if (Ui) {
            Ui.setSelectConOtro(
                rowEl.querySelector('.admin-ap-prenda-marca-select'),
                rowEl.querySelector('.admin-ap-prenda-marca-otro'),
                filaInv.marca,
                Ui.MARCAS_APARTADO
            );
            Ui.setSelectConOtro(
                rowEl.querySelector('.admin-ap-prenda-color-select'),
                rowEl.querySelector('.admin-ap-prenda-color-otro'),
                filaInv.color,
                Ui.COLORES_APARTADO
            );
            Ui.setSelectConOtro(
                rowEl.querySelector('.admin-ap-prenda-talla-select'),
                rowEl.querySelector('.admin-ap-prenda-talla-otro'),
                filaInv.talla,
                Ui.TALLAS_APARTADO
            );
        }
        (rowEl.querySelector('.admin-ap-prenda-invid') || {}).value = ObebeAdminData.idFilaInventario(filaInv);
        (rowEl.querySelector('.admin-ap-prenda-filasheet') || {}).value = filaInv.filaSheet || '';
        var hint = rowEl.querySelector('.admin-ap-inv-hint');
        if (hint) {
            hint.textContent = 'Vinculado inventario';
            hint.classList.remove('admin-muted-text');
        }
    }

    function filaInvPorPickId(invId, filaSheet) {
        var list = getFilasInv();
        var hit = list.find(function (r) { return ObebeAdminData.idFilaInventario(r) === invId; });
        if (hit) return hit;
        if (filaSheet) {
            return list.find(function (r) { return r.filaSheet === parseInt(filaSheet, 10); }) || null;
        }
        return null;
    }

    function ejecutarEntregarPrenda(apartadoId, prendaId) {
        var p = ObebeApartadosStore.getPrenda(apartadoId, prendaId);
        if (!p) return;
        ObebeAdminDialog.confirm({
            title: '¿Entregar prenda?',
            message: 'Baja 1 del inventario. No se agrega venta (ya pagaron con abonos).',
            confirmText: 'Entregar',
            cancelText: 'Cancelar',
            variant: 'warn'
        }).then(function (ok) {
            if (!ok) return;
            ObebeAdminData.entregarPrendaApartadoInventario(p).then(function (res) {
                if (!res.ok) {
                    ObebeAdminDialog.alert({ title: 'Error', message: res.error || 'Error', confirmText: 'Ok' });
                    return;
                }
                ObebeApartadosStore.updatePrenda(apartadoId, prendaId, {
                    entregada: true,
                    entregadaEn: Date.now()
                });
                if (typeof mount._repintar === 'function') mount._repintar();
                if (typeof mount._onInventarioActualizado === 'function') mount._onInventarioActualizado();
            });
        });
    }

    function ejecutarEntregarTodas(apartadoId) {
        var ap = ObebeApartadosStore.getById(apartadoId);
        if (!ap) return;
        var pend = (ap.prendas || []).filter(function (p) { return prendaPuedeEntregarse(p); });
        if (!pend.length) return;
        ObebeAdminDialog.confirm({
            title: '¿Entregar ' + pend.length + ' prenda(s)?',
            message: 'Se bajará stock por cada pieza. No se crearán líneas en Ventas.',
            confirmText: 'Entregar todas',
            cancelText: 'Cancelar',
            variant: 'warn'
        }).then(function (ok) {
            if (!ok) return;
            var chain = Promise.resolve();
            pend.forEach(function (p) {
                chain = chain.then(function () {
                    return ObebeAdminData.entregarPrendaApartadoInventario(p).then(function (res) {
                        if (!res.ok) throw new Error(res.error || 'Error en ' + p.nombre);
                        ObebeApartadosStore.updatePrenda(apartadoId, p.id, {
                            entregada: true,
                            entregadaEn: Date.now()
                        });
                    });
                });
            });
            chain.then(function () {
                if (typeof mount._repintar === 'function') mount._repintar();
                if (typeof mount._onInventarioActualizado === 'function') mount._onInventarioActualizado();
                ObebeAdminDialog.alert({
                    title: 'Entrega registrada',
                    message: 'Stock actualizado sin duplicar ventas.',
                    confirmText: 'Listo'
                });
            }).catch(function (e) {
                if (typeof mount._repintar === 'function') mount._repintar();
                ObebeAdminDialog.alert({
                    title: 'Entrega parcial',
                    message: e.message || String(e),
                    confirmText: 'Ok'
                });
            });
        });
    }

    function ensureAbonoModal() {
        var root = document.getElementById('adminApartadoAbonoModal');
        if (root) return root;
        root = document.createElement('div');
        root.id = 'adminApartadoAbonoModal';
        root.className = 'admin-apartado-modal-root admin-hidden';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML =
            '<div class="admin-apartado-modal-backdrop" data-ap-modal-dismiss="1"></div>' +
            '<div class="admin-apartado-modal" role="dialog" aria-modal="true">' +
            '<div class="admin-apartado-modal-head">' +
            '<h3 id="adminApartadoAbonoTitulo">Registrar abono</h3>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-apartado-modal-close" data-ap-modal-dismiss="1">×</button></div>' +
            '<form id="adminApartadoAbonoForm" class="admin-apartado-modal-body">' +
            '<p id="adminApartadoAbonoResumen" class="admin-apartado-abono-resumen"></p>' +
            '<div class="admin-field-row">' +
            '<div class="admin-field"><label for="adminApartadoAbonoFecha">Fecha</label>' +
            '<input id="adminApartadoAbonoFechaPick" type="date" class="admin-ap-fecha-cal">' +
            '<input id="adminApartadoAbonoFecha" type="text" placeholder="dd/mm/aaaa" autocomplete="off" class="admin-ap-fecha-text"></div>' +
            '<div class="admin-field"><label for="adminApartadoAbonoMonto">Monto del abono</label>' +
            '<input id="adminApartadoAbonoMonto" type="text" inputmode="decimal" placeholder="0" required></div></div>' +
            '<div class="admin-field-row">' +
            selectEquipo('adminApartadoAbonoCuenta', 'Quién tiene el dinero') +
            selectEquipo('adminApartadoAbonoVendedor', 'Vendedor') +
            '</div>' +
            '<p id="adminApartadoAbonoError" class="admin-login-error" role="alert"></p>' +
            '<div class="admin-apartado-modal-actions">' +
            '<button type="button" class="admin-btn admin-btn-danger" data-ap-modal-dismiss="1">Cerrar</button>' +
            '<button type="submit" class="admin-btn admin-btn-primary">Registrar en ventas</button></div></form></div>';
        document.body.appendChild(root);
        root.querySelectorAll('[data-ap-modal-dismiss]').forEach(function (el) {
            el.addEventListener('click', function (ev) {
                ev.preventDefault();
                cerrarAbonoModal();
            });
        });
        document.getElementById('adminApartadoAbonoForm').addEventListener('submit', onSubmitAbono);
        var pickF = document.getElementById('adminApartadoAbonoFechaPick');
        var txtF = document.getElementById('adminApartadoAbonoFecha');
        if (pickF && txtF) {
            pickF.addEventListener('change', function () {
                if (pickF.value) txtF.value = isoFechaToRaw(pickF.value);
            });
            txtF.addEventListener('input', function () {
                var iso = rawFechaToIso(txtF.value);
                if (iso) pickF.value = iso;
            });
        }
        return root;
    }

    function cerrarAbonoModal() {
        abonoApartadoId = null;
        var root = document.getElementById('adminApartadoAbonoModal');
        if (!root) return;
        root.classList.add('admin-hidden');
        root.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('admin-apartado-modal-open');
    }

    function abrirAbonoModal(apartadoId, opts) {
        opts = opts || {};
        var ap = ObebeApartadosStore.getById(apartadoId);
        if (!ap) return;
        ensureAbonoModal();
        abonoApartadoId = apartadoId;
        var root = document.getElementById('adminApartadoAbonoModal');
        var pend = ObebeApartadosStore.saldoPendiente(ap);
        document.getElementById('adminApartadoAbonoTitulo').textContent = 'Abono · ' + ap.cliente;
        document.getElementById('adminApartadoAbonoResumen').innerHTML =
            'Pendiente: <strong>' + fmt(pend) + '</strong> de ' + fmt(ap.totalAPagar);
        var rawHoy = hoyRaw();
        document.getElementById('adminApartadoAbonoFecha').value = rawHoy;
        var pickHoy = document.getElementById('adminApartadoAbonoFechaPick');
        if (pickHoy) pickHoy.value = hoyIsoDate();
        document.getElementById('adminApartadoAbonoMonto').value = '';
        document.getElementById('adminApartadoAbonoError').textContent = '';
        var vendDef = opts.vendedorDefault || '';
        if (EQUIPO.indexOf(vendDef) < 0) vendDef = '';
        var selC = document.getElementById('adminApartadoAbonoCuenta');
        var selV = document.getElementById('adminApartadoAbonoVendedor');
        if (selC) selC.value = '';
        if (selV) selV.value = vendDef;
        root.classList.remove('admin-hidden');
        root.setAttribute('aria-hidden', 'false');
        document.body.classList.add('admin-apartado-modal-open');
        document.getElementById('adminApartadoAbonoMonto').focus();
    }

    function onSubmitAbono(ev) {
        ev.preventDefault();
        if (!abonoApartadoId) return;
        var ap = ObebeApartadosStore.getById(abonoApartadoId);
        if (!ap) return;
        var err = document.getElementById('adminApartadoAbonoError');
        var monto = ObebeApartadosStore.parseMonto((document.getElementById('adminApartadoAbonoMonto') || {}).value);
        var cuenta = (document.getElementById('adminApartadoAbonoCuenta') || {}).value || '';
        var vendedor = (document.getElementById('adminApartadoAbonoVendedor') || {}).value || '';
        var fechaRaw = ((document.getElementById('adminApartadoAbonoFecha') || {}).value || '').trim() || hoyRaw();
        if (monto <= 0) {
            if (err) err.textContent = 'Indica cuánto te pagaron.';
            return;
        }
        if (EQUIPO.indexOf(cuenta) < 0) {
            if (err) err.textContent = 'Elige quién tiene el dinero (Ugo, Daniel o Fer).';
            return;
        }
        if (EQUIPO.indexOf(vendedor) < 0) {
            if (err) err.textContent = 'Elige vendedor (Ugo, Daniel o Fer).';
            return;
        }
        var pend = ObebeApartadosStore.saldoPendiente(ap);
        function confirmarYRegistrar() {
            ObebeAdminDialog.confirm({
                title: '¿Estás seguro?',
                message: 'Se registrará un abono de ' + fmt(monto) + ' en Ventas (tipo Apartado).',
                confirmText: 'Registrar en ventas',
                cancelText: 'Cancelar',
                variant: 'warn',
                cancelDanger: true
            }).then(function (ok) {
                if (!ok) return;
                ejecutarAbono(ap, { monto: monto, cuenta: cuenta, vendedor: vendedor, fechaRaw: fechaRaw }, err);
            });
        }
        if (monto > pend + 0.01) {
            ObebeAdminDialog.confirm({
                title: '¿Estás seguro?',
                message: 'El abono (' + fmt(monto) + ') supera lo pendiente (' + fmt(pend) + '). ¿Registrar igual en Ventas?',
                confirmText: 'Sí, registrar',
                cancelText: 'Cancelar',
                variant: 'warn',
                cancelDanger: true
            }).then(function (ok) {
                if (ok) confirmarYRegistrar();
            });
            return;
        }
        confirmarYRegistrar();
    }

    function ejecutarAbono(ap, pago, errEl) {
        ObebeAdminData.registrarAbonoApartado(ap, pago).then(function (res) {
            if (!res.ok) {
                if (errEl) errEl.textContent = res.error || 'Error al registrar venta.';
                return;
            }
            ObebeApartadosStore.agregarPago(ap.id, {
                fechaRaw: pago.fechaRaw,
                monto: pago.monto,
                cuenta: pago.cuenta,
                vendedor: pago.vendedor,
                ventaId: res.ventaId || 0
            });
            cerrarAbonoModal();
            if (typeof mount._repintar === 'function') mount._repintar();
            if (typeof mount._onVentasActualizada === 'function') {
                mount._onVentasActualizada(res);
            }
            var extra = res.soloLocal
                ? ' Guardado localmente; configura Supabase o Apps Script para sincronizar ventas.'
                : ' El abono ya suma en Ventas (tipo Apartado).';
            ObebeAdminDialog.alert({
                title: 'Abono registrado',
                message: fmt(pago.monto) + ' de ' + ap.cliente + '.' + extra,
                confirmText: 'Listo'
            });
        }).catch(function (e) {
            if (errEl) errEl.textContent = e.message || String(e);
        });
    }

    function mount(container, opts) {
        opts = opts || {};
        mount._onVentasActualizada = opts.onVentasActualizada;
        mount._onInventarioActualizado = opts.onInventarioActualizado;
        var vendedorDefault = opts.vendedor || '';
        clientesLista = (opts.clientes || []).slice().sort(function (a, b) {
            return String(a.nombre).localeCompare(String(b.nombre), 'es');
        });
        getFilasInv = function () {
            var raw = opts.getFilas ? opts.getFilas() : (opts.filas || []);
            return Array.isArray(raw) ? raw : [];
        };
        tipoCliente = clientesLista.length ? 'existente' : 'nuevo';
        clienteSeleccionadoId = '';

        function pintarLista() {
            var list = ObebeApartadosStore.listar(filtroEstado);
            var el = document.getElementById('adminApartadosLista');
            if (!el) return;
            if (!list.length) {
                el.innerHTML = '<p class="admin-muted-text" style="padding:1rem">No hay apartados en esta vista.</p>';
                return;
            }
            el.innerHTML = list.map(htmlTarjetaApartado).join('');
        }

        function pintarFiltros() {
            container.querySelectorAll('[data-ap-filtro]').forEach(function (btn) {
                btn.classList.toggle('active', btn.getAttribute('data-ap-filtro') === filtroEstado);
            });
        }

        mount._repintar = function () {
            pintarLista();
        };

        container.innerHTML =
            '<div class="admin-apartados-layout">' +
            '<div class="admin-panel admin-apartados-panel-nuevo">' +
            '<div class="admin-panel-head"><h3>Nuevo apartado</h3></div>' +
            '<form id="adminApartadoNuevoForm" class="admin-apartados-form">' +
            '<div class="admin-venta-retail-cliente">' +
            '<p class="admin-ped-filtros-sub">Cliente</p>' +
            '<div class="admin-ped-genero-btns">' +
            '<button type="button" class="admin-ped-genero-btn admin-ap-tipo-btn" data-tipo="existente">Cliente existente</button>' +
            '<button type="button" class="admin-ped-genero-btn admin-ap-tipo-btn" data-tipo="nuevo">Cliente nuevo</button></div>' +
            '<div id="adminApartadoPanelExistente" class="admin-venta-retail-panel">' +
            '<div class="admin-field"><label>Cliente</label>' +
            '<select id="adminApartadoClienteSelect" class="admin-venta-pago-select">' + opcionesClientesExistentes() + '</select></div>' +
            '<div id="adminApartadoClienteResumen"></div></div>' +
            '<div id="adminApartadoPanelNuevo" class="admin-venta-retail-panel admin-hidden">' +
            '<div class="admin-field"><label for="adminApartadoNombreNuevo">Nombre</label>' +
            '<input id="adminApartadoNombreNuevo" type="text" placeholder="Nombre completo"></div>' +
            '<div class="admin-field-row">' +
            '<div class="admin-field"><label for="adminApartadoTelNuevo">Teléfono <span class="admin-label-opt">(opc.)</span></label>' +
            '<input id="adminApartadoTelNuevo" type="text"></div>' +
            '<div class="admin-field admin-field-select-otro"><label>Red <span class="admin-label-opt">(opc.)</span></label>' +
            (global.ObebeAdminCamposUi ? global.ObebeAdminCamposUi.htmlRedSocialField(
                'adminApartadoRedNuevoSelect', 'adminApartadoRedNuevoOtro', ''
            ) : '') + '</div>' +
            '<div class="admin-field admin-field-grow"><label for="adminApartadoLinkNuevo">Link <span class="admin-label-opt">(opc.)</span></label>' +
            '<input id="adminApartadoLinkNuevo" type="text"></div></div></div></div>' +
            '<div class="admin-apartado-total-row">' +
            '<span class="admin-muted-text">Total a pagar (suma de prendas)</span>' +
            '<strong id="adminApartadoTotalDisplay" class="admin-apartado-total-val">' + fmt(0) + '</strong></div>' +
            '<div class="admin-apartado-prendas-block">' +
            '<div class="admin-apartado-prendas-head"><h4>Prendas del apartado</h4>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" id="adminApartadoAddPrenda">+ Prenda</button></div>' +
            '<div id="adminApartadoPrendasRows">' + htmlPrendaRow({}, 0) + '</div></div>' +
            '<div class="admin-field"><label for="adminApartadoNotas">Notas <span class="admin-label-opt">(opc.)</span></label>' +
            '<input id="adminApartadoNotas" type="text" placeholder="Entrega estimada, ubicación de piezas…"></div>' +
            '<p id="adminApartadoFormError" class="admin-login-error" role="alert"></p>' +
            '<button type="submit" class="admin-btn admin-btn-primary">Guardar apartado</button></form></div>' +
            '<div class="admin-panel admin-apartados-panel-lista">' +
            '<div class="admin-panel-head admin-panel-head--ventas-reg">' +
            '<h3>Apartados</h3>' +
            '<div class="admin-panel-head-actions admin-apartado-filtros">' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm active" data-ap-filtro="activo">Activos</button>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-ap-filtro="completado">Liquidados</button>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-ap-filtro="cancelado">Cancelados</button>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-ap-filtro="todos">Todos</button></div></div>' +
            '<p class="admin-muted-text admin-apartados-hint">Se sincronizan entre dispositivos cuando Supabase está activo.</p>' +
            '<div id="adminApartadosLista" class="admin-apartados-lista"></div></div></div>';

        var syncApartadosP = (global.ObebeAdminModulosCloud && ObebeAdminModulosCloud.syncApartados)
            ? ObebeAdminModulosCloud.syncApartados()
            : Promise.resolve();
        syncApartadosP.finally(function () { pintarLista(); });
        pintarFiltros();
        actualizarPanelClienteApartado(container);
        pintarResumenClienteApartado();
        if (global.ObebeAdminCamposUi) global.ObebeAdminCamposUi.bindSelectOtros(container);
        pintarTotalApartadoForm();

        container.addEventListener('click', function (ev) {
            var tipoBtn = ev.target.closest('.admin-ap-tipo-btn');
            if (tipoBtn) {
                tipoCliente = tipoBtn.getAttribute('data-tipo') || 'existente';
                actualizarPanelClienteApartado(container);
                return;
            }
        });
        var selCli = document.getElementById('adminApartadoClienteSelect');
        if (selCli) {
            selCli.addEventListener('change', function () {
                clienteSeleccionadoId = selCli.value || '';
                pintarResumenClienteApartado();
            });
        }

        document.getElementById('adminApartadoAddPrenda').addEventListener('click', function () {
            var box = document.getElementById('adminApartadoPrendasRows');
            var idx = box.querySelectorAll('.admin-apartado-prenda-row').length;
            box.insertAdjacentHTML('beforeend', htmlPrendaRow({}, idx));
            if (global.ObebeAdminCamposUi) global.ObebeAdminCamposUi.bindSelectOtros(box);
            pintarTotalApartadoForm();
        });

        document.getElementById('adminApartadoPrendasRows').addEventListener('input', function () {
            pintarTotalApartadoForm();
        });

        document.getElementById('adminApartadoPrendasRows').addEventListener('click', function (ev) {
            var invBtn = ev.target.closest('.admin-ap-prenda-inv');
            if (invBtn) {
                abrirInventarioPicker(invBtn.closest('.admin-apartado-prenda-row'));
                return;
            }
            var btn = ev.target.closest('.admin-ap-prenda-quitar');
            if (!btn) return;
            var row = btn.closest('.admin-apartado-prenda-row');
            var box = document.getElementById('adminApartadoPrendasRows');
            if (box.querySelectorAll('.admin-apartado-prenda-row').length <= 1) {
                var idx0 = row.getAttribute('data-prenda-idx') || '0';
                row.outerHTML = htmlPrendaRow({}, idx0);
                if (global.ObebeAdminCamposUi) global.ObebeAdminCamposUi.bindSelectOtros(box);
                return;
            }
            row.remove();
            pintarTotalApartadoForm();
        });

        document.getElementById('adminApartadoNuevoForm').addEventListener('submit', function (ev) {
            ev.preventDefault();
            var err = document.getElementById('adminApartadoFormError');
            if (err) err.textContent = '';
            var metaCli = leerClienteFormulario();
            var rowsEl = document.getElementById('adminApartadoPrendasRows');
            var prendas = leerPrendasDelForm(rowsEl);
            var total = totalPrendasForm(rowsEl);
            if (!metaCli.cliente) {
                if (err) err.textContent = tipoCliente === 'nuevo' ? 'Escribe el nombre del cliente.' : 'Selecciona un cliente.';
                return;
            }
            if (total <= 0) {
                if (err) err.textContent = 'Indica el precio de cada prenda (el total se calcula solo).';
                return;
            }
            if (!prendas.length) {
                if (err) err.textContent = 'Agrega al menos una prenda con nombre.';
                return;
            }
            var sinPrecio = prendas.some(function (p) { return !(p.precio > 0); });
            if (sinPrecio) {
                if (err) err.textContent = 'Cada prenda debe tener precio mayor a 0.';
                return;
            }
            ObebeAdminDialog.confirm({
                title: '¿Estás seguro?',
                message: '¿Guardar este apartado para ' + metaCli.cliente + ' por ' + fmt(total) + '?',
                confirmText: 'Guardar apartado',
                cancelText: 'Cancelar',
                variant: 'warn',
                cancelDanger: true
            }).then(function (ok) {
                if (!ok) return;
            ObebeApartadosStore.crearApartado({
                cliente: metaCli.cliente,
                clienteId: metaCli.clienteId,
                totalAPagar: total,
                prendas: prendas,
                telefono: metaCli.telefono,
                redSocial: metaCli.redSocial,
                link: metaCli.link,
                notas: (document.getElementById('adminApartadoNotas') || {}).value || ''
            });
            document.getElementById('adminApartadoNuevoForm').reset();
            clienteSeleccionadoId = '';
            document.getElementById('adminApartadoPrendasRows').innerHTML = htmlPrendaRow({}, 0);
            if (global.ObebeAdminCamposUi) global.ObebeAdminCamposUi.bindSelectOtros(container);
            pintarTotalApartadoForm();
            actualizarPanelClienteApartado(container);
            pintarResumenClienteApartado();
            filtroEstado = 'activo';
            pintarFiltros();
            pintarLista();
            ObebeAdminDialog.alert({
                title: 'Apartado guardado',
                message: 'Ya puedes registrar abonos; cada uno sumará en Ventas.',
                confirmText: 'Listo'
            });
            });
        });

        container.addEventListener('click', function (ev) {
            var fbtn = ev.target.closest('[data-ap-filtro]');
            if (fbtn) {
                filtroEstado = fbtn.getAttribute('data-ap-filtro') || 'activo';
                pintarFiltros();
                pintarLista();
                return;
            }
            var ent = ev.target.closest('[data-ap-entregar]');
            if (ent && !ev.target.closest('[data-ap-entregar-todo]')) {
                ejecutarEntregarPrenda(ent.getAttribute('data-ap-entregar'), ent.getAttribute('data-ap-prenda'));
                return;
            }
            var entT = ev.target.closest('[data-ap-entregar-todo]');
            if (entT) {
                ejecutarEntregarTodas(entT.getAttribute('data-ap-entregar-todo'));
                return;
            }
            var abono = ev.target.closest('[data-ap-abono]');
            if (abono) {
                abrirAbonoModal(abono.getAttribute('data-ap-abono'), { vendedorDefault: vendedorDefault });
                return;
            }
            var comp = ev.target.closest('[data-ap-completar]');
            if (comp) {
                var idC = comp.getAttribute('data-ap-completar');
                ObebeAdminDialog.confirm({
                    title: '¿Estás seguro?',
                    message: 'Marcar este apartado como liquidado (sin venta ni stock).',
                    confirmText: 'Sí, liquidado',
                    cancelText: 'Cancelar',
                    variant: 'warn',
                    cancelDanger: true
                }).then(function (ok) {
                    if (!ok) return;
                    ObebeApartadosStore.marcarEstado(idC, 'completado');
                    pintarLista();
                });
                return;
            }
            var desliq = ev.target.closest('[data-ap-desliquidar]');
            if (desliq) {
                var idDq = desliq.getAttribute('data-ap-desliquidar');
                ObebeAdminDialog.confirm({
                    title: '¿Estás seguro?',
                    message: 'El apartado volverá a estado activo (aunque ya esté pagado).',
                    confirmText: 'Desliquidar',
                    cancelText: 'Cancelar',
                    variant: 'warn',
                    cancelDanger: true
                }).then(function (ok) {
                    if (!ok) return;
                    ObebeApartadosStore.desliquidar(idDq);
                    pintarLista();
                });
                return;
            }
            var del = ev.target.closest('[data-ap-borrar]');
            if (del) {
                var idD = del.getAttribute('data-ap-borrar');
                ObebeAdminDialog.confirm({
                    title: '¿Estás seguro?',
                    message: 'Eliminar este apartado del registro local. Las ventas de abonos se mantienen.',
                    confirmText: 'Sí, eliminar',
                    cancelText: 'Volver',
                    variant: 'danger',
                    cancelDanger: false
                }).then(function (ok) {
                    if (!ok) return;
                    ObebeApartadosStore.removeApartado(idD);
                    pintarLista();
                });
            }
        });
    }

    if (!global.__obebeApartadoInvBodyBound) {
        global.__obebeApartadoInvBodyBound = true;
        document.body.addEventListener('click', function (ev) {
            var pick = ev.target.closest('.admin-ap-inv-pick');
            if (!pick || !inventarioPickRowEl) return;
            if (!ev.target.closest('#adminApartadoInvModal')) return;
            inventarioPickSelected = {
                invId: pick.getAttribute('data-inv-id'),
                filaSheet: pick.getAttribute('data-fila')
            };
            pintarListaInventarioPicker();
        });
    }

    global.ObebeAdminApartados = { mount: mount };
})(window);
