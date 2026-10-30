(function (global) {
    'use strict';

    var state = {
        filas: [],
        filtro: '',
        modoEdicion: false,
        snapshot: null,
        seleccion: {},
        modoEliminar: false,
        nuevasFilas: [],
        encabezadosFila2: [],
        msg: '',
        msgOk: false
    };

    function cfg() {
        return global.OBEBE_ADMIN_CONFIG || { appsScriptUrl: '', inventarioSecret: '' };
    }

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function clonarFilas(arr) {
        return (arr || []).map(function (f) {
            return {
                ref: f.ref,
                nombre: f.nombre,
                stock: f.stock,
                talla: f.talla,
                color: f.color,
                tipo: f.tipo,
                marca: f.marca,
                precio: f.precio,
                valorLinea: f.valorLinea,
                segmento: f.segmento,
                ubicacion: f.ubicacion,
                fotoUrl: f.fotoUrl,
                filaSheet: f.filaSheet,
                celdas: (f.celdas || []).slice(),
                _dirty: {},
                _localId: f._localId,
                _isNew: f._isNew
            };
        });
    }

    function filasVisibles() {
        var activas = ObebeAdminData.filtrarFilas(state.filas, state.filtro, { soloStock: true });
        var nuevas = ObebeAdminData.filtrarFilas(state.nuevasFilas, state.filtro, {});
        return activas.concat(nuevas);
    }

    function mountSeccionAgotados(rootContainer, onReload) {
        var el = rootContainer.querySelector('#adminInvAgotadosMount');
        if (!el || !global.ObebeAdminAgotados) return;
        global.ObebeAdminAgotados.mount(el, {
            filas: state.filas,
            onStockRestaurado: function () {
                refreshGrid(rootContainer, onReload);
                mountSeccionAgotados(rootContainer, onReload);
                if (onReload) onReload();
            }
        });
    }

    function keyFila(f) {
        return f._localId || ('sheet-' + f.filaSheet);
    }

    function hayCambiosPendientes() {
        if (state.nuevasFilas.length > 0) return true;
        var i;
        for (i = 0; i < state.filas.length; i++) {
            var f = state.filas[i];
            if (f._dirty && Object.keys(f._dirty).length) return true;
        }
        return false;
    }

    function cancelarEdicionInv(container, onReload) {
        state.filas = clonarFilas(state.snapshot || state.filas);
        state.nuevasFilas = [];
        state.seleccion = {};
        state.modoEdicion = false;
        state.modoEliminar = false;
        state.snapshot = null;
        state.msg = '';
        refreshUi(container, onReload);
    }

    function irAFilaInventario(container, rowKey) {
        requestAnimationFrame(function () {
            var sc = container.querySelector('.admin-inv-scroll');
            var row = rowKey
                ? container.querySelector('tr[data-inv-key="' + rowKey + '"]')
                : null;
            if (sc) sc.scrollTop = sc.scrollHeight;
            if (row) {
                row.scrollIntoView({ block: 'end', behavior: 'smooth' });
                row.classList.add('admin-inv-row-highlight');
                setTimeout(function () { row.classList.remove('admin-inv-row-highlight'); }, 2200);
            }
        });
    }

    function recolectarCambios() {
        var updates = [];
        state.filas.forEach(function (f) {
            if (!f._dirty || !f.filaSheet) return;
            Object.keys(f._dirty).forEach(function (colIdx) {
                var c = parseInt(colIdx, 10);
                updates.push({
                    row: f.filaSheet,
                    col: c + 1,
                    value: f.celdas[c]
                });
            });
        });
        return updates;
    }

    function apiInventario(action, payload) {
        return ObebeAdminData.apiAdminScript(action, payload);
    }

    function renderToolbar() {
        var modo = state.modoEdicion
            ? '<span class="admin-inv-modo admin-inv-modo-edit">Editando</span>'
            : '<span class="admin-inv-modo">Solo vista</span>';

        var acciones = '';
        if (state.modoEdicion) {
            acciones =
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact" id="adminInvAddRow">+ Fila</button>' +
                '<button type="button" class="admin-btn admin-btn-danger admin-btn-compact" id="adminInvDelRows">Eliminar</button>' +
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact" id="adminInvCancel">Cancelar</button>' +
                '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact" id="adminInvSave">Guardar</button>';
        } else {
            acciones =
                '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact" id="adminInvEdit">Editar</button>';
        }

        return '<div class="admin-inv-toolbar">' +
            modo +
            '<input type="search" class="admin-search" id="adminInvSearch" placeholder="Buscar…" value="' + esc(state.filtro) + '">' +
            '<div class="admin-inv-toolbar-actions">' + acciones + '</div></div>' +
            '<p id="adminInvStockCount" class="admin-muted-text admin-inv-stock-count">' + esc(textoExistencia()) + '</p>' +
            (state.msg ? '<div class="admin-banner ' + (state.msgOk ? 'info' : '') + '">' + esc(state.msg) + '</div>' : '');
    }

    function actualizarConteoExistencia(container) {
        var el = container.querySelector('#adminInvStockCount');
        if (el) el.textContent = textoExistencia();
    }

    function colFotoInventario() {
        var idx = ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : { foto: 9 };
        return idx.foto != null ? idx.foto : 9;
    }

    function esVacioONa(val) {
        var s = String(val == null ? '' : val).trim();
        if (!s) return true;
        var u = s.toUpperCase().replace(/\s/g, '');
        return u === 'NA' || u === 'N/A' || u === '—' || s === '-';
    }

    function precioRetailFila(f) {
        if (f && f.precio > 0) return f.precio;
        var idx = ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : { precio: 7 };
        var col = idx.precio != null ? idx.precio : 7;
        var raw = f && f.celdas ? f.celdas[col] : '';
        var t = String(raw || '').trim().replace(/\$/g, '').replace(/\s/g, '');
        if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
        else if (/^\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
        var n = parseFloat(t);
        return isNaN(n) ? 0 : n;
    }

    function valorCeldaMostrar(f, colIdx, val) {
        var idx = ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : {};
        var colCosto = idx.costoNeto != null ? idx.costoNeto : 12;
        var colMargen = idx.margen != null ? idx.margen : 14;
        if (!esVacioONa(val)) return val;
        if (colIdx === colMargen) return '30%';
        if (colIdx === colCosto) {
            var retail = precioRetailFila(f);
            if (!retail) return val;
            var neto = Math.round(retail * 0.7);
            return ObebeAdminData.formatoMoney ? ObebeAdminData.formatoMoney(neto) : String(neto);
        }
        return val;
    }

    function textoExistencia() {
        var n = ObebeAdminData.filtrarFilas(state.filas, state.filtro, { soloStock: true }).length;
        var nuevas = ObebeAdminData.filtrarFilas(state.nuevasFilas, state.filtro, {}).length;
        return (n + nuevas) + ' artículo(s) en existencia';
    }

    function renderCeldaThumb(f) {
        var url = ObebeAdminData.urlImagenFilaInventario(f);
        if (url) {
            var base = url.split('?')[0];
            var q = url.indexOf('?') >= 0 ? '?' + url.split('?').slice(1).join('?') : '';
            var fb1 = base.replace(/\.avif$/i, '.webp') + q;
            if (fb1 === url) fb1 = base.replace(/\.webp$/i, '.jpeg') + q;
            var cands = [url, base.replace(/\.(avif|webp)$/i, '.avif') + q, fb1, base.replace(/\.(avif|webp)$/i, '.jpg') + q]
                .filter(function (v, i, a) { return v && a.indexOf(v) === i; });
            return '<img src="' + esc(cands[0]) + '" alt="" class="admin-inv-thumb" loading="lazy" ' +
                'data-candidate-step="0" data-candidates="' + esc(cands.join('|')) + '" ' +
                'data-fb1="' + esc(fb1) + '" data-fb2="' + esc(base.replace(/\.(avif|webp)$/i, '.jpg') + q) + '" ' +
                'onerror="typeof adminMayoreoImgFallback===\'function\'&&adminMayoreoImgFallback(this)">';
        }
        return '<span class="admin-mayoreo-thumb-empty admin-inv-thumb"></span>';
    }

    function renderCeldaInventario(f, colIdx, edit) {
        var val = (f.celdas[colIdx] == null ? '' : String(f.celdas[colIdx]));
        var mostrar = valorCeldaMostrar(f, colIdx, val);
        if (colIdx === colFotoInventario()) {
            return '<td class="admin-inv-thumb-cell">' + renderCeldaThumb(f) + '</td>';
        }
        if (edit) {
            var inputVal = esVacioONa(val) ? mostrar : val;
            return '<td><input type="text" class="admin-inv-cell" data-key="' + esc(keyFila(f)) + '" data-col="' + colIdx + '" value="' + esc(inputVal) + '"></td>';
        }
        return '<td><span class="admin-inv-readonly">' + esc(mostrar) + '</span></td>';
    }

    function renderGrid() {
        var colsVista = ObebeAdminData.columnasVistaInventario
            ? ObebeAdminData.columnasVistaInventario()
            : [];
        var enc = ObebeAdminData.encabezadosInventarioActuales
            ? ObebeAdminData.encabezadosInventarioActuales()
            : (state.encabezadosFila2 || []);
        if (!enc.length && ObebeAdminData.combinarEncabezadosInventario) {
            enc = ObebeAdminData.combinarEncabezadosInventario(state.encabezadosFila2);
        }
        var vis = filasVisibles();
        var edit = state.modoEdicion;
        var pick = edit;

        var thLetters = '';
        var thSheet = '';
        var i;
        for (i = 0; i < colsVista.length; i++) {
            var c = colsVista[i];
            thLetters += '<th class="admin-inv-th-letter" title="Columna ' + esc(ObebeAdminData.colLetter(c)) + '">' +
                esc(ObebeAdminData.colLetter(c)) + '</th>';
            var titulo = (enc[c] || '').trim();
            thSheet += '<th class="admin-inv-th-title" title="' + esc(titulo) + '">' + esc(titulo) + '</th>';
        }
        var selHead = pick ? '<th class="admin-inv-sel admin-inv-sticky-corner">✓</th>' : '';
        var headLetters = '<tr class="admin-inv-head-letters">' + selHead +
            '<th class="admin-inv-row admin-inv-sticky-corner2">#</th>' + thLetters + '</tr>';
        var headSheet = '<tr class="admin-inv-head-sheet">' + (pick ? '<th class="admin-inv-sel admin-inv-sticky-corner"></th>' : '') +
            '<th class="admin-inv-row admin-inv-sticky-corner2">2</th>' + thSheet + '</tr>';

        var tbody = vis.map(function (f) {
            var k = keyFila(f);
            var checked = state.seleccion[k] ? ' checked' : '';
            var rowNum = f.filaSheet || 'nueva';
            var cells = '';
            for (i = 0; i < colsVista.length; i++) {
                cells += renderCeldaInventario(f, colsVista[i], edit);
            }
            var sel = pick
                ? '<td class="admin-inv-sel"><input type="checkbox" class="admin-inv-pick" data-key="' + esc(k) + '"' + checked + '></td>'
                : '';
            return '<tr data-inv-key="' + esc(k) + '">' + sel +
                '<td class="admin-inv-row">' + rowNum + '</td>' + cells + '</tr>';
        }).join('');

        var colSpan = colsVista.length + 1 + (pick ? 1 : 0);
        return '<div class="admin-inv-scroll' + (edit ? ' admin-inv-scroll--edit' : '') + '">' +
            '<table class="admin-table admin-inv-grid' + (edit ? ' admin-inv-grid--edit' : '') + '"><thead>' + headLetters + headSheet +
            '</thead><tbody>' + (tbody || '<tr><td colspan="' + colSpan + '">Sin filas</td></tr>') + '</tbody></table></div>';
    }

    function refreshGrid(container, onReload) {
        var mount = container.querySelector('#adminInvGridMount');
        if (!mount) return;
        mount.innerHTML = renderGrid();
        bindGridEvents(container, onReload);
        actualizarConteoExistencia(container);
    }

    function refreshUi(container, onReload) {
        var wrap = container.querySelector('.admin-inv-wrap');
        if (!wrap) return;
        wrap.className = 'admin-inv-wrap' + (state.modoEdicion ? ' admin-inv-wrap--edit' : '');
        wrap.innerHTML =
            '<div id="adminInvToolbarMount">' + renderToolbar() + '</div>' +
            '<div id="adminInvGridMount">' + renderGrid() + '</div>';
        bindEvents(container, onReload);
        mountSeccionAgotados(container, onReload);
    }

    function bindGridEvents(container, onReload) {
        if (state.modoEdicion) {
            container.querySelectorAll('.admin-inv-cell').forEach(function (input) {
                input.addEventListener('change', function () {
                    var k = input.getAttribute('data-key');
                    var col = parseInt(input.getAttribute('data-col'), 10);
                    var f = findFila(k);
                    if (!f) return;
                    f.celdas[col] = input.value;
                    if (!f._dirty) f._dirty = {};
                    f._dirty[col] = true;
                    syncDerived(f);
                });
            });
        }
        if (state.modoEdicion) {
            container.querySelectorAll('.admin-inv-pick').forEach(function (cb) {
                cb.addEventListener('change', function () {
                    state.seleccion[cb.getAttribute('data-key')] = cb.checked;
                });
            });
        }
    }

    function bindEvents(container, onReload) {
        var searchEl = container.querySelector('#adminInvSearch');
        if (searchEl) {
            searchEl.addEventListener('input', function (e) {
                state.filtro = e.target.value;
                refreshGrid(container, onReload);
            });
        }
        var btnEdit = container.querySelector('#adminInvEdit');
        if (btnEdit) {
            btnEdit.addEventListener('click', function () {
                state.snapshot = clonarFilas(state.filas);
                state.modoEdicion = true;
                state.modoEliminar = false;
                state.msg = '';
                refreshUi(container, onReload);
            });
        }

        var btnCancel = container.querySelector('#adminInvCancel');
        if (btnCancel) {
            btnCancel.addEventListener('click', function () {
                if (!hayCambiosPendientes()) {
                    cancelarEdicionInv(container, onReload);
                    return;
                }
                ObebeAdminDialog.confirm({
                    title: '¿Salir sin guardar?',
                    message: 'Hay cambios sin guardar en el inventario. Si sales, se perderán.',
                    confirmText: 'Sí, salir',
                    cancelText: 'Seguir editando',
                    variant: 'warn'
                }).then(function (ok) {
                    if (ok) cancelarEdicionInv(container, onReload);
                });
            });
        }

        bindGridEvents(container, onReload);

        if (state.modoEdicion) {
            var addBtn = container.querySelector('#adminInvAddRow');
            if (addBtn) {
                addBtn.addEventListener('click', function () {
                    var vacia = [];
                    var numCols = ObebeAdminData.INVENTARIO_NUM_COLS || 25;
                    var idx = ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : {};
                    var colStock = idx.stock != null ? idx.stock : 2;
                    var i;
                    for (i = 0; i < numCols; i++) vacia.push('');
                    vacia[colStock] = '1';
                    var localId = 'new-' + Date.now();
                    state.nuevasFilas.push({
                        _localId: localId,
                        celdas: vacia,
                        nombre: '',
                        stock: 1,
                        ref: 0,
                        filaSheet: 0,
                        _isNew: true,
                        _dirty: {}
                    });
                    refreshGrid(container, onReload);
                    irAFilaInventario(container, localId);
                });
            }
            var saveBtn = container.querySelector('#adminInvSave');
            if (saveBtn) saveBtn.addEventListener('click', function () { guardar(onReload, container); });
        }
        var delBtn = container.querySelector('#adminInvDelRows');
        if (delBtn) {
            delBtn.addEventListener('click', function () { eliminarSeleccion(onReload, container); });
        }
    }

    function findFila(k) {
        var i;
        for (i = 0; i < state.filas.length; i++) {
            if (keyFila(state.filas[i]) === k) return state.filas[i];
        }
        for (i = 0; i < state.nuevasFilas.length; i++) {
            if (keyFila(state.nuevasFilas[i]) === k) return state.nuevasFilas[i];
        }
        return null;
    }

    function syncDerived(f) {
        var idx = ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : {};
        f.nombre = (f.celdas[idx.nombre != null ? idx.nombre : 1] || '').trim();
        f.stock = parseInt(f.celdas[idx.stock != null ? idx.stock : 2], 10) || 0;
        f.ref = parseInt(f.celdas[idx.imagen != null ? idx.imagen : 0], 10) || 0;
        f.marca = (f.celdas[idx.marca != null ? idx.marca : 6] || '').trim();
        f.fotoUrl = (f.celdas[colFotoInventario()] || '').trim();
        if (ObebeAdminData.normalizarMarca) f.marca = ObebeAdminData.normalizarMarca(f.marca);
    }

    function guardar(onReload, container) {
        state.msg = 'Guardando…';
        state.msgOk = true;
        refreshUi(container, onReload);

        var nuevas = state.nuevasFilas.slice();
        var updates = recolectarCambios();
        if (!updates.length && !nuevas.length) {
            state.msg = 'No hay cambios pendientes.';
            state.msgOk = false;
            refreshUi(container, onReload);
            return;
        }

        var chain = Promise.resolve();

        if (nuevas.length) {
            chain = chain.then(function () {
                return nuevas.reduce(function (p, f) {
                    return p.then(function () {
                        return apiInventario('appendRow', { celdas: f.celdas });
                    });
                }, Promise.resolve());
            });
        }
        if (updates.length) {
            chain = chain.then(function () {
                return apiInventario('updateCells', { updates: updates });
            });
        }

        chain.then(function (res) {
            if (res && res.ok === false) throw new Error(res.error || 'Error al guardar');
            state.msg = 'Cambios guardados en Google Sheets.';
            state.msgOk = true;
            state.modoEdicion = false;
            state.snapshot = null;
            state.nuevasFilas = [];
            if (onReload) return onReload();
        }).catch(function (err) {
            state.msg = err.message || String(err);
            state.msgOk = false;
        }).finally(function () {
            refreshUi(container, onReload);
        });
    }

    function eliminarSeleccion(onReload, container) {
        var keys = Object.keys(state.seleccion).filter(function (k) { return state.seleccion[k]; });
        if (!keys.length) {
            state.msg = 'Marca filas con ✓ para eliminar.';
            state.msgOk = false;
            refreshUi(container, onReload);
            return;
        }
        ObebeAdminDialog.confirmPassword({
            title: '¿Eliminar del inventario?',
            message: 'Se borrarán ' + keys.length + ' fila(s) de la base de datos. No se puede deshacer.',
            confirmText: 'Eliminar',
            cancelText: 'Cancelar'
        }).then(function (ok) {
            if (!ok) return;
            ejecutarEliminarSeleccion(keys, onReload, container);
        });
    }

    function ejecutarEliminarSeleccion(keys, onReload, container) {
        var filasSheet = [];
        keys.forEach(function (k) {
            var f = findFila(k);
            if (!f) return;
            if (!f._isNew && f.filaSheet) filasSheet.push(f.filaSheet);
        });
        state.nuevasFilas = state.nuevasFilas.filter(function (f) {
            return keys.indexOf(keyFila(f)) < 0;
        });
        state.filas = state.filas.filter(function (f) {
            return keys.indexOf(keyFila(f)) < 0;
        });
        keys.forEach(function (k) { delete state.seleccion[k]; });
        state.modoEliminar = false;

        if (!filasSheet.length) {
            state.msg = 'Filas quitadas.';
            state.msgOk = true;
            refreshUi(container, onReload);
            return;
        }
        apiInventario('deleteRows', { filas: filasSheet }).then(function (res) {
            if (res && res.ok === false) throw new Error(res.error || 'Error');
            state.msg = 'Artículos eliminados del inventario.';
            state.msgOk = true;
            if (onReload) return onReload();
        }).catch(function (err) {
            state.msg = err.message || String(err);
            state.msgOk = false;
        }).finally(function () {
            refreshUi(container, onReload);
        });
    }

    function mount(container, filas, onReload, encabezadosFila2) {
        state.filas = clonarFilas(filas);
        state.encabezadosFila2 = ObebeAdminData.combinarEncabezadosInventario
            ? ObebeAdminData.combinarEncabezadosInventario(encabezadosFila2 || [])
            : (encabezadosFila2 || []).slice();
        state.nuevasFilas = [];
        state.seleccion = {};
        state.modoEdicion = false;
        state.modoEliminar = false;
        state.snapshot = null;
        state.msg = '';
        container.innerHTML =
            '<div class="admin-panel admin-panel-inventario">' +
            '<div class="admin-panel-head"><h3>Inventario</h3></div>' +
            '<div class="admin-inv-wrap">' +
            '<div id="adminInvToolbarMount">' + renderToolbar() + '</div>' +
            '<div id="adminInvGridMount">' + renderGrid() + '</div></div></div>' +
            '<div id="adminInvAgotadosMount" class="admin-inv-agotados-wrap"></div>';
        bindEvents(container, onReload);
        mountSeccionAgotados(container, onReload);
    }

    global.ObebeAdminInventario = { mount: mount };
})(window);
