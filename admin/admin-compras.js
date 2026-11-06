(function (global) {
    'use strict';

    var COL_FOTO = 9;
    var filas = [];
    var filtro = '';
    var editando = false;
    var mountSesion = 0;
    var aviso = '';
    var subiendo = false;

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function numCelda(v) {
        var t = String(v || '').replace(/\$/g, '').replace(/\s/g, '').replace(/,/g, '');
        var n = parseFloat(t);
        return isNaN(n) ? 0 : n;
    }

    function recalcular(celdas) {
        var qty = numCelda(celdas[2]);
        var retail = numCelda(celdas[7]);
        var neto = numCelda(celdas[12]);
        celdas[8] = retail > 0 ? String(Math.round(qty * retail)) : '';
        celdas[13] = neto > 0 ? String(Math.round(qty * neto)) : '';
        celdas[14] = retail > 0 && neto > 0
            ? Math.round(((retail - neto) / retail) * 100) + '%'
            : '';
    }

    function columnas() {
        return ObebeAdminData.columnasVistaInventario
            ? ObebeAdminData.columnasVistaInventario()
            : [];
    }

    function encabezados() {
        return ObebeAdminData.combinarEncabezadosInventario
            ? ObebeAdminData.combinarEncabezadosInventario([])
            : [];
    }

    function tituloCol(enc, c) {
        var titulo = (enc[c] || '').trim();
        if (/^(no\.?\s*)?imagen|^ref$|^#$/i.test(titulo)) titulo = 'Ref';
        return titulo;
    }

    function visibles() {
        var q = filtro.trim().toLowerCase();
        if (!q) return filas;
        return filas.filter(function (f) {
            return (f.celdas || []).join(' ').toLowerCase().indexOf(q) >= 0;
        });
    }

    function srcFoto(f) {
        var ruta = String((f.celdas && f.celdas[COL_FOTO]) || '').trim();
        if (!ruta || ruta === 'NA' || ruta === '-') return '';
        if (/^https?:/i.test(ruta)) return ruta;
        if (ruta.indexOf('compras/') === 0) return '../' + ruta;
        return '';
    }

    function htmlFoto(f) {
        var src = srcFoto(f);
        if (!src) return '<span class="admin-mayoreo-thumb-empty admin-inv-thumb"></span>';
        return '<img src="' + esc(src) + '" alt="" class="admin-inv-thumb" loading="lazy">';
    }

    function textoConteo() {
        var unicos = filas.length;
        var total = 0;
        filas.forEach(function (f) {
            total += numCelda(f.celdas && f.celdas[2]);
        });
        return unicos + ' artículos únicos · ' + total + ' en total';
    }

    function renderToolbar() {
        var subir = '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact" id="adminComprasSubir"' +
            (subiendo ? ' disabled' : '') + '>Subir a inventario</button>';
        var acciones = editando
            ? subir +
              '<button type="button" class="admin-btn admin-btn-danger admin-btn-compact" id="adminComprasBorrar">Eliminar</button>' +
              '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact" id="adminComprasCancelar">Cancelar</button>' +
              '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact" id="adminComprasGuardar">Guardar</button>'
            : subir +
              '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact" id="adminComprasEditar">Editar</button>';
        return '<div class="admin-inv-toolbar">' +
            '<span class="admin-inv-modo' + (editando ? ' admin-inv-modo-edit' : '') + '">' +
            (editando ? 'Editando' : 'Pedidos en camino') + '</span>' +
            '<input type="search" class="admin-search" id="adminComprasBuscar" placeholder="Buscar…" value="' + esc(filtro) + '">' +
            '<div class="admin-inv-toolbar-actions">' + acciones + '</div></div>' +
            (aviso ? '<p class="admin-banner">' + esc(aviso) + '</p>' : '') +
            '<p class="admin-muted-text admin-inv-stock-count">' + textoConteo() + '</p>';
    }

    function renderGrid() {
        var cols = columnas();
        var enc = encabezados();
        var list = visibles();
        var thLetters = '';
        var thSheet = '';
        cols.forEach(function (c) {
            thLetters += '<th class="admin-inv-th-letter">' + esc(ObebeAdminData.colLetter(c)) + '</th>';
            thSheet += '<th class="admin-inv-th-title">' + esc(tituloCol(enc, c)) + '</th>';
        });
        var sel = editando ? '<th class="admin-inv-sel"></th>' : '';
        var head = '<tr class="admin-inv-head-letters">' + sel + '<th class="admin-inv-row">#</th>' + thLetters + '</tr>' +
            '<tr class="admin-inv-head-sheet">' + sel + '<th class="admin-inv-row"></th>' + thSheet + '</tr>';
        var body = list.map(function (f, i) {
            var check = editando
                ? '<td class="admin-inv-sel"><input type="checkbox" class="admin-compras-sel" data-id="' + esc(f.id) + '"></td>'
                : '';
            var tds = cols.map(function (c) {
                if (c === COL_FOTO) {
                    return '<td class="admin-inv-thumb-cell">' + htmlFoto(f) + '</td>';
                }
                var val = f.celdas[c] == null ? '' : String(f.celdas[c]);
                if (!editando) return '<td><span class="admin-inv-readonly">' + esc(val) + '</span></td>';
                return '<td><input type="text" class="admin-inv-cell admin-compras-cell" data-id="' + esc(f.id) +
                    '" data-col="' + c + '" value="' + esc(val) + '"></td>';
            }).join('');
            return '<tr>' + check + '<td class="admin-inv-row">' + (i + 1) + '</td>' + tds + '</tr>';
        }).join('');
        if (!body) {
            body = '<tr><td colspan="' + (cols.length + 2) + '">Sin compras. Las capturas van en la carpeta compras, cada marca en su carpeta.</td></tr>';
        }
        return '<div class="admin-inv-scroll' + (editando ? ' admin-inv-scroll--edit' : '') + '">' +
            '<table class="admin-table admin-inv-grid"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
    }

    function pintar(root) {
        root.innerHTML = '<div class="admin-inv-wrap admin-compras-wrap">' + renderToolbar() + renderGrid() + '</div>';
        bind(root);
    }

    function filaPorId(id) {
        return filas.find(function (f) { return f.id === id; }) || null;
    }

    function persistir() {
        if (global.ObebeComprasStore) ObebeComprasStore.reemplazar(filas);
        filas = ObebeComprasStore.getAll();
    }

    function bind(root) {
        var buscar = root.querySelector('#adminComprasBuscar');
        if (buscar) {
            buscar.addEventListener('input', function () {
                filtro = buscar.value || '';
                var grid = root.querySelector('.admin-inv-scroll');
                if (grid) grid.outerHTML = renderGrid();
                bindCeldas(root);
            });
        }
        var subirBtn = root.querySelector('#adminComprasSubir');
        if (subirBtn) subirBtn.addEventListener('click', function () { subirAInventario(root); });
        var editar = root.querySelector('#adminComprasEditar');
        if (editar) editar.addEventListener('click', function () {
            editando = true;
            pintar(root);
        });
        var cancelar = root.querySelector('#adminComprasCancelar');
        if (cancelar) cancelar.addEventListener('click', function () {
            editando = false;
            filas = ObebeComprasStore.getAll();
            pintar(root);
        });
        var guardar = root.querySelector('#adminComprasGuardar');
        if (guardar) guardar.addEventListener('click', function () {
            filas.forEach(function (f) { recalcular(f.celdas); f.actualizadoEn = Date.now(); });
            persistir();
            editando = false;
            pintar(root);
        });
        var borrar = root.querySelector('#adminComprasBorrar');
        if (borrar) borrar.addEventListener('click', function () {
            var ids = {};
            root.querySelectorAll('.admin-compras-sel:checked').forEach(function (cb) {
                ids[cb.getAttribute('data-id')] = true;
            });
            var n = Object.keys(ids).length;
            if (!n) return;
            ObebeAdminDialog.confirm({
                title: '¿Quitar de compras?',
                message: 'Se quitan ' + n + ' artículo(s) de Compras. El inventario no cambia.',
                confirmText: 'Quitar',
                cancelText: 'Cancelar',
                variant: 'danger'
            }).then(function (ok) {
                if (!ok) return;
                filas = filas.filter(function (f) { return !ids[f.id]; });
                persistir();
                pintar(root);
            });
        });
        bindCeldas(root);
    }

    function bindCeldas(root) {
        root.querySelectorAll('.admin-compras-cell').forEach(function (input) {
            input.addEventListener('change', function () {
                var f = filaPorId(input.getAttribute('data-id'));
                var col = parseInt(input.getAttribute('data-col'), 10);
                if (!f || isNaN(col)) return;
                f.celdas[col] = input.value;
                recalcular(f.celdas);
                f.actualizadoEn = Date.now();
            });
        });
    }

    function celdasParaInventario(fila) {
        var celdas = (fila.celdas || []).slice();
        var i;
        for (i = celdas.length; i < 29; i++) celdas.push('');
        var foto = String(celdas[9] || '');
        if (foto.indexOf('compras/') === 0) celdas[9] = '';
        return celdas;
    }

    function enviarAlInventario(payload) {
        return ObebeAdminBackend.callAdminApi('importInventarioAppend', { filas: payload }).catch(function (err) {
            if (!/desconocida/i.test(String(err && err.message || ''))) throw err;
            return payload.reduce(function (cadena, fila) {
                return cadena.then(function () {
                    return ObebeAdminBackend.callAdminApi('appendRow', { celdas: fila.celdas }).then(function (res) {
                        if (!res || res.ok === false) {
                            throw new Error((res && res.error) || 'No se pudo subir al inventario');
                        }
                    });
                });
            }, Promise.resolve());
        }).then(function (res) {
            if (res && res.ok === false) {
                throw new Error(res.error || 'No se pudo subir al inventario');
            }
        });
    }

    function subirAInventario(root) {
        if (subiendo || !filas.length || !global.ObebeAdminDialog || !global.ObebeAdminBackend) return;
        var n = filas.length;
        ObebeAdminDialog.confirm({
            title: '¿Subir a inventario?',
            message: 'Se pasan ' + n + ' artículo(s) al inventario y Compras queda vacía.',
            confirmText: 'Sí, subir',
            cancelText: 'Cancelar',
            variant: 'ok',
            cancelDanger: true,
            confirmSuccess: true
        }).then(function (ok) {
            if (!ok) return;
            subiendo = true;
            aviso = '';
            var payload = filas.map(function (f) {
                return { celdas: celdasParaInventario(f) };
            });
            pintar(root);
            enviarAlInventario(payload).then(function () {
                if (global.ObebeComprasStore) ObebeComprasStore.reemplazar([]);
                filas = [];
                editando = false;
                aviso = 'Se subieron ' + n + ' artículo(s) al inventario.';
                document.dispatchEvent(new CustomEvent('obebe-compras-a-inventario'));
            }).catch(function (err) {
                aviso = (err && err.message) || 'No se pudo subir al inventario.';
            }).then(function () {
                subiendo = false;
                pintar(root);
            });
        });
    }

    function aplicarDetectadas() {
        if (global.ObebeComprasStore) {
            ObebeComprasStore.absorberDetectadas();
            filas = ObebeComprasStore.getAll();
        } else {
            filas = [];
        }
        if (!filas.length && global.OBEBE_COMPRAS_DETECTADAS && global.OBEBE_COMPRAS_DETECTADAS.length) {
            filas = global.OBEBE_COMPRAS_DETECTADAS;
        }
    }

    function traerDetectadas() {
        if (global.OBEBE_COMPRAS_DETECTADAS && global.OBEBE_COMPRAS_DETECTADAS.length) {
            return Promise.resolve();
        }
        return fetch('compras-detectadas.js?v=20261166', { cache: 'no-store' })
            .then(function (r) { return r.text(); })
            .then(function (text) {
                var i = text.indexOf('[');
                var j = text.lastIndexOf(']');
                if (i < 0 || j < i) return;
                global.OBEBE_COMPRAS_DETECTADAS = JSON.parse(text.slice(i, j + 1));
            })
            .catch(function () { /* se queda con lo que ya cargó el script */ });
    }

    function mount(container) {
        var sesion = ++mountSesion;
        function dibujar() {
            if (sesion !== mountSesion || !container) return;
            try {
                aplicarDetectadas();
                pintar(container);
            } catch (err) {
                container.innerHTML = '<p class="admin-banner">No se pudo mostrar Compras. ' +
                    esc(err && err.message) + '</p>';
            }
        }
        if (global.OBEBE_COMPRAS_DETECTADAS && global.OBEBE_COMPRAS_DETECTADAS.length) {
            dibujar();
        } else {
            container.innerHTML = '<div class="admin-loading">Cargando compras…</div>';
        }
        traerDetectadas().then(dibujar);
        var syncP = (global.ObebeAdminModulosCloud && ObebeAdminModulosCloud.syncCompras)
            ? ObebeAdminModulosCloud.syncCompras()
            : Promise.resolve();
        syncP.then(dibujar, dibujar);
    }

    global.ObebeAdminCompras = { mount: mount };
})(window);
