(function (global) {
    'use strict';

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function fmt(n) {
        return ObebeAdminData.formatoMoney(n || 0);
    }

    function norm(s) {
        return String(s || '').trim().toLowerCase();
    }

    function hoyIsoLocal() {
        var d = new Date();
        return d.getFullYear() + '-' +
            ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
            ('0' + d.getDate()).slice(-2);
    }

    function isoAFechaRaw(iso) {
        if (!iso) return '';
        var p = iso.split('-');
        if (p.length !== 3) return iso;
        return p[2] + '/' + p[1] + '/' + p[0];
    }

    function fechaEntregaAInput(iso, raw) {
        if (iso && String(iso).indexOf('-') >= 0) {
            return String(iso).slice(0, 10);
        }
        if (raw) {
            var p = String(raw).split('/');
            if (p.length === 3) {
                return p[2] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[0]).slice(-2);
            }
        }
        return hoyIsoLocal();
    }

    function selectPagoHtml(valor) {
        var v = norm(valor) || 'efectivo';
        function opt(k, label) {
            return '<option value="' + k + '"' + (v === k ? ' selected' : '') + '>' + label + '</option>';
        }
        return opt('efectivo', 'Efectivo') + opt('tarjeta', 'Tarjeta') + opt('transferencia', 'Transferencia');
    }

    function thumbHtml(url, alt) {
        if (!url) {
            return '<span class="admin-mayoreo-thumb-empty admin-entrega-thumb" aria-hidden="true"></span>';
        }
        return '<img src="' + esc(url) + '" alt="' + esc(alt || '') + '" class="admin-entrega-thumb" loading="lazy" onerror="adminMayoreoImgFallback(this)">';
    }

    function htmlThumbsItems(items) {
        return (items || []).map(function (it) {
            var url = it.imagenUrl || '';
            return '<div class="admin-entrega-item-chip">' + thumbHtml(url, it.nombre) +
                '<span class="admin-entrega-item-chip-meta">' + esc(it.nombre) +
                ' ×' + (it.cantidad || 1) + '</span></div>';
        }).join('');
    }

    function ensureModalRoot() {
        var root = document.getElementById('adminEntregaModalRoot');
        if (root) return root;
        root = document.createElement('div');
        root.id = 'adminEntregaModalRoot';
        root.className = 'admin-entrega-modal-root admin-hidden';
        root.setAttribute('aria-hidden', 'true');
        document.body.appendChild(root);
        return root;
    }

    function leerFormularioModal() {
        var fechaIso = (document.getElementById('adminEntregaModalFecha') || {}).value || hoyIsoLocal();
        return {
            fechaRaw: isoAFechaRaw(fechaIso),
            hora: (document.getElementById('adminEntregaModalHora') || {}).value || '',
            lugar: ((document.getElementById('adminEntregaModalLugar') || {}).value || '').trim(),
            cliente: ((document.getElementById('adminEntregaModalCliente') || {}).value || '').trim(),
            telefono: ((document.getElementById('adminEntregaModalTelefono') || {}).value || '').trim(),
            metodoPago: (document.getElementById('adminEntregaModalPago') || {}).value || 'efectivo',
            notas: (document.getElementById('adminEntregaModalNotas') || {}).value || ''
        };
    }

    function abrirModalFormEntrega(opts) {
        opts = opts || {};
        var modo = opts.modo || 'crear';
        var ent = opts.entrega || null;
        var meta = opts.meta || {};
        var carrito = (opts.carrito || []).slice();
        var items = ent ? (ent.items || []) : carrito.map(function (c) {
            var f = c.fila || {};
            return {
                nombre: f.nombre,
                cantidad: c.cantidad,
                imagenUrl: c.imagenUrl || ObebeAdminData.urlImagenFilaInventario(f)
            };
        });

        if (modo === 'crear' && !carrito.length) return Promise.resolve(null);
        if (modo === 'editar' && !ent) return Promise.resolve(null);

        var titulo = modo === 'editar' ? 'Editar entrega' : 'Programar entrega';
        var subt = modo === 'editar'
            ? 'Actualiza fecha, lugar u otros datos. Los artículos vienen de la venta.'
            : 'La venta ya está registrada. Completa cuándo y dónde entregar.';

        var cliente = ent ? ent.cliente : (meta.cliente || '');
        var telefono = ent ? (ent.telefono || '') : (meta.telefono || '');
        var fechaIn = fechaEntregaAInput(ent ? ent.fechaIso : null, ent ? ent.fechaRaw : null);
        var horaIn = ent ? (ent.hora || '') : '';
        var lugarIn = ent ? (ent.lugar || '') : '';
        var notasIn = ent ? (ent.notas || '') : '';
        var pagoIn = ent ? ent.metodoPago : 'efectivo';

        var root = ensureModalRoot();
        root.innerHTML =
            '<div class="admin-entrega-modal-backdrop" data-dismiss="1"></div>' +
            '<div class="admin-entrega-modal" role="dialog" aria-modal="true" aria-labelledby="adminEntregaModalTitle">' +
            '<h3 id="adminEntregaModalTitle">' + esc(titulo) + '</h3>' +
            '<p class="admin-muted-text">' + esc(subt) + '</p>' +
            '<div class="admin-entrega-modal-thumbs">' + htmlThumbsItems(items) + '</div>' +
            '<div class="admin-entregas-form admin-entregas-form--modal">' +
            '<div class="admin-field"><label>Cliente</label>' +
            '<input type="text" id="adminEntregaModalCliente" value="' + esc(cliente) + '"></div>' +
            '<div class="admin-field"><label>Teléfono</label>' +
            '<input type="text" id="adminEntregaModalTelefono" value="' + esc(telefono) + '"></div>' +
            '<div class="admin-field-row">' +
            '<div class="admin-field"><label>Fecha entrega</label><input type="date" id="adminEntregaModalFecha" value="' + esc(fechaIn) + '"></div>' +
            '<div class="admin-field"><label>Hora</label><input type="time" id="adminEntregaModalHora" value="' + esc(horaIn) + '"></div></div>' +
            '<div class="admin-field"><label>Lugar</label><input type="text" id="adminEntregaModalLugar" value="' + esc(lugarIn) + '" placeholder="Dirección o punto de encuentro"></div>' +
            '<div class="admin-field"><label>Forma de pago</label>' +
            '<select id="adminEntregaModalPago" class="admin-venta-pago-select">' + selectPagoHtml(pagoIn) + '</select></div>' +
            '<div class="admin-field"><label>Notas (opcional)</label><input type="text" id="adminEntregaModalNotas" value="' + esc(notasIn) + '"></div>' +
            '<p id="adminEntregaModalError" class="admin-login-error" role="alert"></p></div>' +
            '<div class="admin-entrega-modal-actions">' +
            '<button type="button" class="admin-btn admin-btn-ghost" id="adminEntregaModalCancel">' +
            (modo === 'editar' ? 'Cancelar' : 'Omitir') + '</button>' +
            '<button type="button" class="admin-btn admin-btn-primary" id="adminEntregaModalGuardar">' +
            (modo === 'editar' ? 'Guardar cambios' : 'Guardar entrega') + '</button></div></div>';

        return new Promise(function (resolve) {
            function cerrar(result) {
                root.classList.add('admin-hidden');
                root.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('admin-entrega-modal-open');
                root.innerHTML = '';
                resolve(result);
            }

            root.querySelector('[data-dismiss]').addEventListener('click', function () { cerrar(null); });
            document.getElementById('adminEntregaModalCancel').addEventListener('click', function () { cerrar(null); });
            document.getElementById('adminEntregaModalGuardar').addEventListener('click', function () {
                var err = document.getElementById('adminEntregaModalError');
                if (err) err.textContent = '';
                var datos = leerFormularioModal();
                datos.vendedor = meta.vendedor || (ent && ent.vendedor) || '';
                if (!datos.lugar) {
                    if (err) err.textContent = 'Indica el lugar de entrega.';
                    return;
                }
                if (!datos.cliente) {
                    if (err) err.textContent = 'Indica el cliente.';
                    return;
                }
                var prom;
                if (modo === 'editar') {
                    prom = ObebeAdminData.actualizarEntregaProgramada(ent.id, datos);
                } else {
                    prom = ObebeAdminData.crearEntregaTrasVenta(datos, carrito);
                }
                prom.then(function (res) {
                    if (!res.ok) {
                        if (err) err.textContent = res.error || 'Error';
                        return;
                    }
                    if (opts.onGuardada) opts.onGuardada(res.entrega);
                    cerrar(res.entrega);
                });
            });

            root.classList.remove('admin-hidden');
            root.setAttribute('aria-hidden', 'false');
            document.body.classList.add('admin-entrega-modal-open');
            var foco = document.getElementById('adminEntregaModalLugar');
            if (foco) foco.focus();
        });
    }

    function abrirModalPostVenta(opts) {
        opts = opts || {};
        return abrirModalFormEntrega({
            modo: 'crear',
            meta: opts.meta,
            carrito: opts.carrito,
            onGuardada: opts.onGuardada
        });
    }

    function tarjetaEntrega(e) {
        var total = (e.items || []).reduce(function (s, it) {
            return s + (it.precioUnitario || 0) * (it.cantidad || 1);
        }, 0);
        var thumbs = htmlThumbsItems(e.items);
        return '<article class="admin-entrega-card" data-entrega-id="' + esc(e.id) + '">' +
            '<div class="admin-entrega-card-head">' +
            '<div><strong>' + esc(e.cliente) + '</strong>' +
            (e.telefono ? '<div class="admin-muted-text">' + esc(e.telefono) + '</div>' : '') + '</div>' +
            '<div class="admin-entrega-card-fecha">' +
            esc(ObebeAdminData.formatoFecha(e.fechaIso, e.fechaRaw)) +
            (e.hora ? ' · ' + esc(e.hora) : '') + '</div></div>' +
            '<p class="admin-entrega-card-lugar"><span class="admin-muted-text">Lugar:</span> ' + esc(e.lugar) + '</p>' +
            '<p class="admin-entrega-card-pago">' + esc(ObebeAdminData.etiquetaMetodoPagoEntrega(e.metodoPago)) +
            ' · ' + fmt(total) + '</p>' +
            (e.notas ? '<p class="admin-muted-text admin-entrega-card-notas">' + esc(e.notas) + '</p>' : '') +
            '<div class="admin-entrega-card-thumbs">' + thumbs + '</div>' +
            '<div class="admin-entrega-card-actions">' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-entrega-editar" data-id="' + esc(e.id) + '">Editar</button>' +
            '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact admin-entrega-completar" data-id="' + esc(e.id) + '">Entrega completada</button>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-entrega-cancelar" data-id="' + esc(e.id) + '">Quitar de la lista</button>' +
            '</div></article>';
    }

    function filaHistorico(e) {
        var piezas = (e.items || []).reduce(function (s, it) { return s + (it.cantidad || 1); }, 0);
        var estado = e.estado === 'completada' ? 'Completada' : 'Quitada';
        var tagCls = e.estado === 'completada' ? 'admin-tag-ok' : 'admin-tag-warn';
        var cuando = e.completadaEn || e.canceladaEn || e.creadoEn;
        var fechaCierre = cuando
            ? ObebeAdminData.formatoFechaLarga(cuando)
            : ObebeAdminData.formatoFecha(e.fechaIso, e.fechaRaw);
        return '<tr><td><span class="admin-tag ' + tagCls + '">' + estado + '</span></td>' +
            '<td>' + esc(ObebeAdminData.formatoFecha(e.fechaIso, e.fechaRaw)) +
            (e.hora ? ' ' + esc(e.hora) : '') + '</td>' +
            '<td>' + esc(e.cliente) + '</td>' +
            '<td>' + esc(e.lugar) + '</td>' +
            '<td>' + piezas + '</td>' +
            '<td class="admin-muted-text">' + esc(fechaCierre) + '</td></tr>';
    }

    function mount(container, opts) {
        opts = opts || {};
        var vendedor = opts.vendedor || 'OBEBE';

        function pintarHistorico() {
            var box = document.getElementById('adminEntregasHistorico');
            if (!box) return;
            var list = ObebeAdminData.listarHistoricoEntregas(40);
            if (!list.length) {
                box.innerHTML = '<p class="admin-muted-text" style="padding:0 1rem 1rem">Sin entregas cerradas todavía.</p>';
                return;
            }
            box.innerHTML = '<div class="admin-table-wrap"><table class="admin-table admin-table-compact admin-entrega-hist-table"><thead><tr>' +
                '<th>Estado</th><th>Programada</th><th>Cliente</th><th>Lugar</th><th>Pzas.</th><th>Cierre</th>' +
                '</tr></thead><tbody>' + list.map(filaHistorico).join('') + '</tbody></table></div>';
        }

        function pintarLista() {
            var box = document.getElementById('adminEntregasLista');
            if (!box) return;
            var list = ObebeAdminData.listarEntregasAdmin('pendiente');
            if (!list.length) {
                box.innerHTML = '<p class="admin-muted-text" style="padding:0 1rem">' +
                    'No hay entregas pendientes. Al registrar una venta puedes programar la entrega desde el mismo flujo.</p>';
            } else {
                box.innerHTML = '<div class="admin-entrega-grid">' +
                    list.map(tarjetaEntrega).join('') + '</div>';
            }
            pintarHistorico();
        }

        container.innerHTML =
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Entregas por hacer</h3></div>' +
            '<p class="admin-muted-text" style="padding:0 1rem 0.75rem;margin:0;font-size:0.85rem">' +
            'Se crean al vender. Puedes editar fecha, lugar y contacto antes de completar.</p>' +
            '<div id="adminEntregasLista"></div></div>' +
            '<div class="admin-panel" style="margin-top:1rem"><div class="admin-panel-head"><h3>Registro de entregas</h3></div>' +
            '<p class="admin-muted-text" style="padding:0 1rem 0.5rem;margin:0;font-size:0.82rem">' +
            'Completadas o quitadas de la lista (últimas 40).</p>' +
            '<div id="adminEntregasHistorico"></div></div>';

        pintarLista();

        container.onclick = function (ev) {
            var edit = ev.target.closest('.admin-entrega-editar');
            if (edit) {
                var eid = edit.getAttribute('data-id');
                var ent = global.ObebeEntregasStore.getById(eid);
                if (!ent) return;
                abrirModalFormEntrega({
                    modo: 'editar',
                    entrega: ent,
                    onGuardada: function () { pintarLista(); }
                });
                return;
            }
            var comp = ev.target.closest('.admin-entrega-completar');
            if (comp) {
                var eidC = comp.getAttribute('data-id');
                ObebeAdminDialog.confirm({
                    title: '¿Estás seguro?',
                    message: 'Vas a marcar esta entrega como completada. La venta ya está registrada; esto solo cierra el pendiente.',
                    confirmText: 'Sí, completar',
                    cancelText: 'No',
                    variant: 'warn'
                }).then(function (ok) {
                    if (!ok) return;
                    ObebeAdminData.completarEntregaProgramada(eidC, vendedor).then(function (res) {
                        if (!res.ok) {
                            ObebeAdminDialog.alert({ title: 'No se pudo', message: res.error || 'Error' });
                            return;
                        }
                        pintarLista();
                    });
                });
                return;
            }
            var cancel = ev.target.closest('.admin-entrega-cancelar');
            if (cancel) {
                var cid = cancel.getAttribute('data-id');
                ObebeAdminDialog.confirm({
                    title: '¿Estás seguro?',
                    message: 'Quitarás esta entrega de la lista de pendientes. La venta no se borra.',
                    confirmText: 'Sí, quitar',
                    cancelText: 'No',
                    variant: 'danger'
                }).then(function (ok) {
                    if (!ok) return;
                    ObebeAdminData.cancelarEntregaProgramada(cid).then(function (res) {
                        if (!res.ok) {
                            ObebeAdminDialog.alert({ title: 'No se pudo', message: res.error || 'Error' });
                            return;
                        }
                        pintarLista();
                    });
                });
            }
        };
    }

    global.ObebeAdminEntregas = {
        mount: mount,
        abrirModalPostVenta: abrirModalPostVenta
    };
})(window);
