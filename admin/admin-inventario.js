(function (global) {
    'use strict';

    var state = {
        filas: [],
        filtro: '',
        modoEdicion: false,
        snapshot: null,
        seleccion: {},
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
        var base = state.filas.concat(state.nuevasFilas);
        return ObebeAdminData.filtrarFilas(base, state.filtro, { soloStock: true });
    }

    function keyFila(f) {
        return f._localId || ('sheet-' + f.filaSheet);
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
        var c = cfg();
        var apiOk = 'Guardar requiere backend';
        if (ObebeAdminData.usarSupabase && ObebeAdminData.usarSupabase()) {
            apiOk = ObebeAdminData.supabaseListo && ObebeAdminData.supabaseListo()
                ? 'Guardar → Supabase'
                : 'Completa Supabase en admin-config.js';
        } else if (c.appsScriptUrl) {
            apiOk = 'Guardar → Apps Script';
        } else if (ObebeAdminData.escrituraLocalHabilitada && ObebeAdminData.escrituraLocalHabilitada()) {
            apiOk = 'Sin URL: solo caché local al guardar (no implementado aquí)';
        }
        var modo = state.modoEdicion
            ? '<span class="admin-inv-modo admin-inv-modo-edit">Editando</span>'
            : '<span class="admin-inv-modo">Solo vista</span>';

        var acciones = '<button type="button" class="admin-btn admin-btn-ghost" id="adminInvReload">Recargar</button>';
        if (state.modoEdicion) {
            acciones += '<button type="button" class="admin-btn admin-btn-ghost" id="adminInvCancel">Cancelar</button>' +
                '<button type="button" class="admin-btn admin-btn-primary" id="adminInvSave">Guardar cambios</button>' +
                '<button type="button" class="admin-btn admin-btn-ghost" id="adminInvAddRow">+ Fila</button>' +
                '<button type="button" class="admin-btn admin-btn-ghost" id="adminInvDelRows">Eliminar filas</button>';
        } else {
            acciones += '<button type="button" class="admin-btn admin-btn-primary" id="adminInvEdit">Editar</button>';
        }

        return '<div class="admin-inv-toolbar">' +
            modo +
            '<input type="search" class="admin-search" id="adminInvSearch" placeholder="Buscar…" value="' + esc(state.filtro) + '">' +
            acciones +
            '<span class="admin-inv-api">' + esc(apiOk) + '</span></div>' +
            (state.msg ? '<div class="admin-banner ' + (state.msgOk ? 'info' : '') + '">' + esc(state.msg) + '</div>' : '');
    }

    var IDX_COL_IMAGEN = 9;

    function renderCeldaInventario(f, colIdx, edit) {
        var val = (f.celdas[colIdx] == null ? '' : String(f.celdas[colIdx]));
        if (colIdx === IDX_COL_IMAGEN && !edit) {
            var url = ObebeAdminData.urlImagenFilaInventario(f);
            if (url) {
                return '<td class="admin-inv-thumb-cell"><img src="' + esc(url) + '" alt="" class="admin-inv-thumb" loading="lazy" ' +
                    'onerror="typeof adminMayoreoImgFallback===\'function\'&&adminMayoreoImgFallback(this)"></td>';
            }
            return '<td class="admin-inv-thumb-cell"><span class="admin-mayoreo-thumb-empty admin-inv-thumb"></span></td>';
        }
        if (edit) {
            return '<td><input type="text" class="admin-inv-cell" data-key="' + esc(keyFila(f)) + '" data-col="' + colIdx + '" value="' + esc(val) + '"></td>';
        }
        return '<td><span class="admin-inv-readonly">' + esc(val) + '</span></td>';
    }

    function renderGrid() {
        var numCols = ObebeAdminData.INVENTARIO_COLS_VISTA || 25;
        var enc = state.encabezadosFila2 || [];
        var vis = filasVisibles();
        var edit = state.modoEdicion;

        var thLetters = '';
        var thSheet = '';
        var c;
        for (c = 0; c < numCols; c++) {
            thLetters += '<th class="admin-inv-th-letter" title="Columna ' + esc(ObebeAdminData.colLetter(c)) + '">' +
                esc(ObebeAdminData.colLetter(c)) + '</th>';
            var titulo = (enc[c] || '').trim();
            thSheet += '<th class="admin-inv-th-title" title="' + esc(titulo) + '">' + esc(titulo) + '</th>';
        }
        var selHead = edit ? '<th class="admin-inv-sel admin-inv-sticky-corner">✓</th>' : '';
        var headLetters = '<tr class="admin-inv-head-letters">' + selHead +
            '<th class="admin-inv-row admin-inv-sticky-corner2">#</th>' + thLetters + '</tr>';
        var headSheet = '<tr class="admin-inv-head-sheet">' + (edit ? '<th class="admin-inv-sel admin-inv-sticky-corner"></th>' : '') +
            '<th class="admin-inv-row admin-inv-sticky-corner2">2</th>' + thSheet + '</tr>';

        var tbody = vis.map(function (f) {
            var k = keyFila(f);
            var checked = state.seleccion[k] ? ' checked' : '';
            var rowNum = f.filaSheet || 'nueva';
            var cells = '';
            for (var colIdx = 0; colIdx < numCols; colIdx++) {
                cells += renderCeldaInventario(f, colIdx, edit);
            }
            var sel = edit
                ? '<td class="admin-inv-sel"><input type="checkbox" class="admin-inv-pick" data-key="' + esc(k) + '"' + checked + '></td>'
                : '';
            return '<tr>' + sel +
                '<td class="admin-inv-row">' + rowNum + '</td>' + cells + '</tr>';
        }).join('');

        var foot = edit
            ? 'Modo edición · columnas A–Y · solo artículos con stock'
            : 'Solo artículos con stock &gt; 0 · agotados en módulo Histórico · columna J = foto';

        return '<div class="admin-inv-scroll' + (edit ? ' admin-inv-scroll--edit' : '') + '">' +
            '<table class="admin-table admin-inv-grid' + (edit ? ' admin-inv-grid--edit' : '') + '"><thead>' + headLetters + headSheet +
            '</thead><tbody>' + (tbody || '<tr><td colspan="' + (numCols + (edit ? 2 : 1)) + '">Sin filas</td></tr>') + '</tbody></table></div>' +
            '<p class="admin-inv-foot">' + vis.length + ' filas · ' + foot + '</p>';
    }

    function refreshUi(container, onReload) {
        var wrap = container.querySelector('.admin-inv-wrap');
        if (!wrap) return;
        wrap.className = 'admin-inv-wrap' + (state.modoEdicion ? ' admin-inv-wrap--edit' : '');
        wrap.innerHTML = renderToolbar() + renderGrid();
        bindEvents(container, onReload);
    }

    function bindEvents(container, onReload) {
        container.querySelector('#adminInvSearch').addEventListener('input', function (e) {
            state.filtro = e.target.value;
            refreshUi(container, onReload);
        });
        container.querySelector('#adminInvReload').addEventListener('click', function () {
            state.modoEdicion = false;
            state.snapshot = null;
            if (onReload) onReload();
        });

        var btnEdit = container.querySelector('#adminInvEdit');
        if (btnEdit) {
            btnEdit.addEventListener('click', function () {
                state.snapshot = clonarFilas(state.filas);
                state.modoEdicion = true;
                state.msg = '';
                refreshUi(container, onReload);
            });
        }

        var btnCancel = container.querySelector('#adminInvCancel');
        if (btnCancel) {
            btnCancel.addEventListener('click', function () {
                state.filas = clonarFilas(state.snapshot || state.filas);
                state.nuevasFilas = [];
                state.seleccion = {};
                state.modoEdicion = false;
                state.snapshot = null;
                state.msg = 'Edición cancelada.';
                state.msgOk = true;
                refreshUi(container, onReload);
            });
        }

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
            container.querySelectorAll('.admin-inv-pick').forEach(function (cb) {
                cb.addEventListener('change', function () {
                    state.seleccion[cb.getAttribute('data-key')] = cb.checked;
                });
            });
            var addBtn = container.querySelector('#adminInvAddRow');
            if (addBtn) {
                addBtn.addEventListener('click', function () {
                    var vacia = [];
                    for (var i = 0; i < ObebeAdminData.INVENTARIO_NUM_COLS; i++) vacia.push('');
                    var localId = 'new-' + Date.now();
                    state.nuevasFilas.push({
                        _localId: localId,
                        celdas: vacia,
                        nombre: '',
                        stock: 0,
                        ref: 0,
                        filaSheet: 0,
                        _isNew: true,
                        _dirty: {}
                    });
                    refreshUi(container, onReload);
                });
            }
            var saveBtn = container.querySelector('#adminInvSave');
            if (saveBtn) saveBtn.addEventListener('click', function () { guardar(onReload, container); });
            var delBtn = container.querySelector('#adminInvDelRows');
            if (delBtn) delBtn.addEventListener('click', function () { eliminarSeleccion(onReload, container); });
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
        f.nombre = (f.celdas[1] || '').trim();
        f.stock = parseInt(f.celdas[2], 10) || 0;
        f.ref = parseInt(f.celdas[0], 10) || 0;
        f.marca = (f.celdas[6] || '').trim();
        f.fotoUrl = (f.celdas[9] || '').trim();
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

        if (!filasSheet.length) {
            state.msg = 'Filas quitadas.';
            state.msgOk = true;
            refreshUi(container, onReload);
            return;
        }
        apiInventario('deleteRows', { filas: filasSheet }).then(function (res) {
            if (res && res.ok === false) throw new Error(res.error || 'Error');
            state.msg = 'Filas eliminadas del Sheet.';
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
        state.encabezadosFila2 = (encabezadosFila2 || []).slice();
        state.nuevasFilas = [];
        state.seleccion = {};
        state.modoEdicion = false;
        state.snapshot = null;
        state.msg = '';
        container.innerHTML =
            '<div class="admin-panel admin-panel-inventario">' +
            '<div class="admin-panel-head"><h3>Inventario (A–Y)</h3></div>' +
            '<div class="admin-inv-wrap">' + renderToolbar() + renderGrid() + '</div></div>' +
            (ObebeAdminData.usarSupabase && ObebeAdminData.usarSupabase()
                ? '<div class="admin-banner info">Guardar cambios → <strong>Supabase</strong>. Si la tabla está vacía, importa desde Configuración.</div>'
                : '<div class="admin-banner info">Para <strong>guardar</strong>: Web App Apps Script o modo Supabase en <code>admin-config.js</code>.</div>');
        bindEvents(container, onReload);
    }

    global.ObebeAdminInventario = { mount: mount };
})(window);
