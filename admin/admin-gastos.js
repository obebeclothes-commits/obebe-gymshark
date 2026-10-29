(function (global) {
    'use strict';

    var gastosCache = [];
    var resumenCache = null;
    var editId = null;

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function hoyRaw() {
        var d = new Date();
        return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
    }

    function mount(container, opts) {
        opts = opts || {};
        container.innerHTML =
            '<div id="adminGastosBanner" class="admin-banner admin-hidden" role="status"></div>' +
            '<div class="admin-kpi-grid" id="adminGastosKpi"></div>' +
            '<div class="admin-panel">' +
            '<div class="admin-panel-head"><h3>Registrar gasto</h3></div>' +
            '<form id="adminGastosForm" class="admin-gastos-form">' +
            '<div class="admin-field-row">' +
            '<div class="admin-field"><label for="adminGastoFecha">Fecha</label>' +
            '<input id="adminGastoFecha" type="text" placeholder="dd/mm/aaaa" autocomplete="off"></div>' +
            '<div class="admin-field admin-field-grow"><label for="adminGastoConcepto">Concepto</label>' +
            '<input id="adminGastoConcepto" type="text" placeholder="Ej. Renta, gasolina, empaque…" required></div>' +
            '<div class="admin-field"><label for="adminGastoCantidad">Cantidad</label>' +
            '<input id="adminGastoCantidad" type="text" inputmode="decimal" placeholder="0" required></div>' +
            '<div class="admin-field"><label for="adminGastoPagado">Quién lo pagó</label>' +
            '<input id="adminGastoPagado" type="text" placeholder="Daniel, Ugo, Fer…"></div>' +
            '</div>' +
            '<p id="adminGastosFormError" class="admin-login-error" role="alert"></p>' +
            '<div class="admin-gastos-form-actions">' +
            '<button type="submit" class="admin-btn admin-btn-primary" id="adminGastoGuardar">Guardar gasto</button>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-hidden" id="adminGastoCancelarEd">Cancelar edición</button>' +
            '</div></form></div>' +
            '<div class="admin-panel">' +
            '<div class="admin-panel-head admin-panel-head--ventas-reg">' +
            '<h3>Gastos operativos</h3>' +
            '<div class="admin-panel-head-actions">' +
            '<input type="search" class="admin-search" id="adminGastosBuscar" placeholder="Buscar concepto, persona…">' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" id="adminGastosMigrarNeg">Revisar ventas negativas</button>' +
            '</div></div>' +
            '<div id="adminGastosTable"></div></div>' +
            '<div class="admin-banner info">Los gastos <strong>no</strong> van en Ventas. Si antes registrabas gastos con precio negativo en ventas, usa «Revisar ventas negativas» para moverlos aquí.</div>';

        document.getElementById('adminGastoFecha').value = hoyRaw();

        function pintarKpi() {
            var r = resumenCache || { hoy: 0, semana: 0, mes: 0, totalRegistros: 0 };
            document.getElementById('adminGastosKpi').innerHTML =
                '<div class="admin-kpi"><div class="label">Hoy</div><div class="value">' +
                ObebeAdminData.formatoMoney(r.hoy) + '</div></div>' +
                '<div class="admin-kpi"><div class="label">Semana</div><div class="value">' +
                ObebeAdminData.formatoMoney(r.semana) + '</div></div>' +
                '<div class="admin-kpi"><div class="label">Mes</div><div class="value">' +
                ObebeAdminData.formatoMoney(r.mes) + '</div></div>' +
                '<div class="admin-kpi"><div class="label">Registros</div><div class="value">' +
                r.totalRegistros + '</div></div>';
        }

        function tablaHtml(lista) {
            if (!lista.length) {
                return '<p class="admin-muted-text" style="padding:1rem">Sin gastos registrados.</p>';
            }
            var rows = lista.map(function (g) {
                return '<tr data-gasto-id="' + g.id + '">' +
                    '<td>' + esc(ObebeAdminData.formatoFecha(g.fechaIso, g.fechaRaw)) + '</td>' +
                    '<td>' + esc(g.concepto) + '</td>' +
                    '<td>' + ObebeAdminData.formatoMoney(g.cantidad) + '</td>' +
                    '<td>' + esc(ObebeAdminData.etiquetaCuentaVentas(g.pagadoPor)) + '</td>' +
                    '<td class="admin-vr-acciones">' +
                    '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-g-edit="' + g.id + '">Editar</button> ' +
                    '<button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-g-del="' + g.id + '">Borrar</button>' +
                    '</td></tr>';
            }).join('');
            return '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
                '<th>Fecha</th><th>Concepto</th><th>Cantidad</th><th>Quién pagó</th><th>Opciones</th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table></div>';
        }

        function pintarTabla(q) {
            var f = ObebeAdminData.filtrarGastos(gastosCache, q);
            document.getElementById('adminGastosTable').innerHTML = tablaHtml(f);
        }

        function resetForm() {
            editId = null;
            document.getElementById('adminGastoFecha').value = hoyRaw();
            document.getElementById('adminGastoConcepto').value = '';
            document.getElementById('adminGastoCantidad').value = '';
            document.getElementById('adminGastoPagado').value = '';
            document.getElementById('adminGastoCancelarEd').classList.add('admin-hidden');
            document.getElementById('adminGastoGuardar').textContent = 'Guardar gasto';
            var err = document.getElementById('adminGastosFormError');
            if (err) err.textContent = '';
        }

        function cargarTodo() {
            return ObebeAdminData.cargarGastos(true).then(function (p) {
                gastosCache = p.gastos || [];
                resumenCache = p.resumen || ObebeAdminData.calcularResumenGastos(gastosCache);
                pintarKpi();
                pintarTabla((document.getElementById('adminGastosBuscar') || {}).value || '');
            });
        }

        function mostrarBanner(msg, tipo) {
            var el = document.getElementById('adminGastosBanner');
            if (!el) return;
            if (!msg) {
                el.classList.add('admin-hidden');
                el.textContent = '';
                return;
            }
            el.className = 'admin-banner' + (tipo === 'error' ? '' : ' info');
            el.textContent = msg;
            el.classList.remove('admin-hidden');
        }

        ObebeAdminData.limpiarVentasNegativasEnVentas().then(function (r) {
            if (r && r.error) {
                mostrarBanner(r.error, 'error');
            } else if (r && r.migrados > 0) {
                mostrarBanner('Se quitaron ' + r.migrados + ' línea(s) con precio negativo de Ventas y se copiaron aquí como gastos.', 'info');
                if (opts.onVentasActualizada) opts.onVentasActualizada();
            }
            return cargarTodo();
        }).catch(function (e) {
            mostrarBanner(e.message || String(e), 'error');
            return cargarTodo();
        });

        document.getElementById('adminGastosForm').addEventListener('submit', function (ev) {
            ev.preventDefault();
            var err = document.getElementById('adminGastosFormError');
            if (err) err.textContent = '';
            var campos = {
                fechaRaw: document.getElementById('adminGastoFecha').value.trim(),
                concepto: document.getElementById('adminGastoConcepto').value.trim(),
                cantidad: document.getElementById('adminGastoCantidad').value.trim(),
                pagadoPor: document.getElementById('adminGastoPagado').value.trim()
            };
            var prom = editId
                ? ObebeAdminData.actualizarGastoOperativo(editId, campos)
                : ObebeAdminData.crearGastoOperativo(campos);
            prom.then(function (res) {
                if (!res || res.ok === false) {
                    if (err) err.textContent = (res && res.error) || 'No se pudo guardar.';
                    return;
                }
                resetForm();
                return cargarTodo();
            }).catch(function (e) {
                if (err) err.textContent = e.message || String(e);
            });
        });

        document.getElementById('adminGastoCancelarEd').addEventListener('click', resetForm);

        document.getElementById('adminGastosBuscar').addEventListener('input', function (ev) {
            pintarTabla(ev.target.value);
        });

        document.getElementById('adminGastosMigrarNeg').addEventListener('click', function () {
            try {
                localStorage.removeItem('obebe_ventas_neg_migrado_v1');
            } catch (e) { /* ignore */ }
            ObebeAdminData.limpiarVentasNegativasEnVentas().then(function (r) {
                if (r && r.error) {
                    ObebeAdminDialog.alert({ title: 'No se pudo', message: r.error });
                    return;
                }
                var n = (r && r.migrados) || 0;
                ObebeAdminDialog.alert({
                    title: 'Listo',
                    message: n ? ('Migradas ' + n + ' línea(s) desde Ventas.') : 'No había ventas con precio negativo.'
                });
                if (n && opts.onVentasActualizada) opts.onVentasActualizada();
                return cargarTodo();
            }).catch(function (e) {
                ObebeAdminDialog.alert({ title: 'Error', message: e.message || String(e) });
            });
        });

        document.getElementById('adminGastosTable').addEventListener('click', function (ev) {
            var ed = ev.target.closest('[data-g-edit]');
            if (ed) {
                var id = parseInt(ed.getAttribute('data-g-edit'), 10);
                var g = gastosCache.find(function (x) { return x.id === id; });
                if (!g) return;
                editId = id;
                document.getElementById('adminGastoFecha').value = g.fechaRaw || '';
                document.getElementById('adminGastoConcepto').value = g.concepto || '';
                document.getElementById('adminGastoCantidad').value = String(g.cantidad != null ? g.cantidad : '');
                document.getElementById('adminGastoPagado').value = g.pagadoPor || '';
                document.getElementById('adminGastoCancelarEd').classList.remove('admin-hidden');
                document.getElementById('adminGastoGuardar').textContent = 'Guardar cambios';
                return;
            }
            var del = ev.target.closest('[data-g-del]');
            if (!del) return;
            var idDel = parseInt(del.getAttribute('data-g-del'), 10);
            var gDel = gastosCache.find(function (x) { return x.id === idDel; });
            ObebeAdminDialog.confirm({
                title: '¿Borrar gasto?',
                message: 'Se eliminará: ' + (gDel ? gDel.concepto : 'gasto') + '.',
                confirmText: 'Borrar',
                cancelText: 'Cancelar',
                variant: 'danger'
            }).then(function (ok) {
                if (!ok) return;
                return ObebeAdminData.eliminarGastoOperativo(idDel);
            }).then(function (res) {
                if (!res) return;
                if (editId === idDel) resetForm();
                return cargarTodo();
            });
        });
    }

    global.ObebeAdminGastos = { mount: mount };
})(window);
