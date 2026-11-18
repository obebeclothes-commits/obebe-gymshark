(function (global) {
    'use strict';

    var state = {
        filas: [],
        filtro: '',
        filtroGenero: '',
        filtroTipo: '',
        modoEdicion: false,
        snapshot: null,
        seleccion: {},
        modoEliminar: false,
        nuevasFilas: [],
        encabezadosFila2: [],
        msg: '',
        msgOk: false,
        soloLectura: false,
        mayoreoInventario: null,
        columnasOcultas: [],
        mostrarAuditoriaStock: true,
        ordenAuditoria: null,
        _visCacheKey: '',
        _visCache: null
    };

    var INV_RENDER_MAX = 400;
    var INV_SEARCH_DEBOUNCE_MS = 280;
    var INV_AGOTADOS_RENDER_MAX = 200;
    var invSearchTimer = null;

    function colIdxAuditoriaInventario() {
        if (global.ObebeInventarioColumnas && ObebeInventarioColumnas.COL_AUDITORIA != null) {
            return ObebeInventarioColumnas.COL_AUDITORIA;
        }
        var idx = idxInventarioCols();
        return idx.auditoria != null ? idx.auditoria : 25;
    }

    function esColumnaAuditoria(colIdx) {
        return colIdx === colIdxAuditoriaInventario();
    }

    function columnasVistaGrid() {
        var cols = ObebeAdminData.columnasVistaInventario
            ? ObebeAdminData.columnasVistaInventario()
            : [];
        if (!state.mostrarAuditoriaStock) {
            var colAud = colIdxAuditoriaInventario();
            cols = cols.filter(function (c) { return c !== colAud; });
        }
        if (state.columnasOcultas && state.columnasOcultas.length) {
            cols = cols.filter(function (c) {
                return state.columnasOcultas.indexOf(c) < 0;
            });
        }
        return cols;
    }

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
                inventarioDbId: f.inventarioDbId || 0,
                celdas: (f.celdas || []).slice(),
                _dirty: {},
                _localId: f._localId,
                _isNew: f._isNew,
                mayoreoLineaId: f.mayoreoLineaId,
                precioVentaPlaneado: f.precioVentaPlaneado
            };
        });
    }

    function optsFiltro(extra) {
        var o = extra || {};
        if (state.filtroGenero) o.segmento = state.filtroGenero;
        if (state.filtroTipo) o.tipo = state.filtroTipo;
        return o;
    }

    function filasInventarioBase() {
        var filas = state.filas || [];
        if (ObebeAdminData.filtrarFilasSinApartadasMayoreo) {
            filas = ObebeAdminData.filtrarFilasSinApartadasMayoreo(filas);
        }
        return filas;
    }

    function invalidarCacheFilasVisibles() {
        state._visCacheKey = '';
        state._visCache = null;
    }

    function sincronizarStateFilasDesdeEstadoGlobal() {
        var st = ObebeAdminData.getEstado ? ObebeAdminData.getEstado() : null;
        if (!st || !st.filas || !st.filas.length) return;
        state.filas = clonarFilas(st.filas);
        state.filas.forEach(blobBusquedaFila);
    }

    function normInv(s) {
        return String(s || '').trim().toLowerCase();
    }

    function normSegmentoInv(s) {
        return ObebeAdminData.normSegmento ? ObebeAdminData.normSegmento(s) : normInv(s);
    }

    function blobBusquedaFila(f) {
        if (!f) return '';
        if (f._invBlob) return f._invBlob;
        f._invBlob = [
            f.nombre, f.marca, f.tipo, f.color, f.talla, f.segmento, String(f.ref || '')
        ].join(' ').toLowerCase();
        return f._invBlob;
    }

    function filtrarFilasInv(filas, query, filtros) {
        filtros = filtros || {};
        query = normInv(query);
        var tokens = query ? query.split(/\s+/).filter(Boolean) : [];
        return (filas || []).filter(function (r) {
            if (filtros.soloStock && (r.stock || 0) <= 0) return false;
            if (filtros.soloBajo && (r.stock === 0 || r.stock > 2)) return false;
            if (filtros.segmento && normSegmentoInv(r.segmento) !== normSegmentoInv(filtros.segmento)) {
                return false;
            }
            if (filtros.tipo && normInv(r.tipo) !== normInv(filtros.tipo)) return false;
            if (filtros.marca && ObebeAdminData.normalizarMarca &&
                ObebeAdminData.normalizarMarca(r.marca) !== ObebeAdminData.normalizarMarca(filtros.marca)) {
                return false;
            }
            if (!tokens.length) return true;
            var blob = blobBusquedaFila(r);
            for (var i = 0; i < tokens.length; i++) {
                if (blob.indexOf(tokens[i]) < 0) return false;
            }
            return true;
        });
    }

    function prepararListasRenderInventario() {
        state._listasInv = {
            tallas: listaTallasInventario(),
            colores: listaColoresInventario(),
            tipos: listaTiposInventario(),
            marcas: listaMarcasInventario()
        };
    }

    function valorAuditoriaFila(f) {
        var col = colIdxAuditoriaInventario();
        if (!f || !f.celdas) return '';
        return String(f.celdas[col] == null ? '' : f.celdas[col]).trim();
    }

    function compararFilasAuditoria(a, b, dir) {
        var va = valorAuditoriaFila(a);
        var vb = valorAuditoriaFila(b);
        var ea = !va;
        var eb = !vb;
        if (ea && eb) return 0;
        if (ea) return 1;
        if (eb) return -1;
        var cmp = va.localeCompare(vb, 'es', { sensitivity: 'base' });
        return dir === 'desc' ? -cmp : cmp;
    }

    function ordenarFilasPorAuditoria(lista) {
        if (!state.ordenAuditoria) return lista;
        return lista.slice().sort(function (a, b) {
            return compararFilasAuditoria(a, b, state.ordenAuditoria);
        });
    }

    function filasVisibles() {
        var cacheKey = [
            state.filtro, state.filtroGenero, state.filtroTipo, state.ordenAuditoria,
            state.filas.length, state.nuevasFilas.length
        ].join('|');
        if (state._visCacheKey === cacheKey && state._visCache) return state._visCache;
        var base = filasInventarioBase();
        var activas = filtrarFilasInv(base, state.filtro, optsFiltro({ soloStock: true }));
        var nuevas = filtrarFilasInv(state.nuevasFilas, state.filtro, optsFiltro({}));
        var out = ordenarFilasPorAuditoria(activas.concat(nuevas));
        state._visCacheKey = cacheKey;
        state._visCache = out;
        return out;
    }

    function etiquetaOrdenAuditoria() {
        if (state.ordenAuditoria === 'desc') return ' ▼';
        if (state.ordenAuditoria === 'asc') return ' ▲';
        return '';
    }

    function mountSeccionAgotados(rootContainer, onReload) {
        var el = rootContainer.querySelector('#adminInvAgotadosMount');
        if (!el || !global.ObebeAdminAgotados) return;
        var filasAgot = (ObebeAdminData.getEstado && ObebeAdminData.getEstado().filas)
            ? ObebeAdminData.getEstado().filas
            : state.filas;
        global.ObebeAdminAgotados.mount(el, {
            filas: filtrarFilasInv(filasAgot, '', optsFiltro()),
            onStockRestaurado: function () {
                sincronizarStateFilasDesdeEstadoGlobal();
                invalidarCacheFilasVisibles();
                refreshGrid(rootContainer, onReload);
                if (global.ObebeAdminAgotados.refrescar) {
                    global.ObebeAdminAgotados.refrescar(el);
                }
                if (onReload) return onReload();
                return Promise.resolve();
            }
        });
    }

    function keyFila(f) {
        return f._localId || ('sheet-' + f.filaSheet);
    }

    function otroIdInventario(k, colIdx) {
        var slug = String(k).replace(/[^a-zA-Z0-9_-]/g, '_');
        if (slug.length > 96) slug = slug.slice(0, 96);
        return 'invotro_' + slug + '_' + colIdx;
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
        invalidarCacheFilasVisibles();
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
                    row: f.inventarioDbId || f.filaSheet,
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

    function otroValorCamposUi() {
        return global.ObebeAdminCamposUi ? global.ObebeAdminCamposUi.OTRO : '__otro__';
    }

    var TALLAS_INVENTARIO = [
        { v: 'XS', label: 'XS' },
        { v: 'S', label: 'S' },
        { v: 'M', label: 'M' },
        { v: 'L', label: 'L' },
        { v: 'XL', label: 'XL' },
        { v: '__otro__', label: 'OTRA' }
    ];

    function mayusInv(s) {
        return String(s || '').trim().toUpperCase();
    }

    function valoresUnicosColumna(colIdx) {
        var map = {};
        function add(arr) {
            (arr || []).forEach(function (f) {
                if (!f || !f.celdas) return;
                var v = mayusInv(f.celdas[colIdx]);
                if (v) map[v] = v;
            });
        }
        add(state.filas);
        add(state.nuevasFilas);
        return Object.keys(map).sort(function (a, b) { return a.localeCompare(b, 'es'); });
    }

    function listaConPresetYPreset(preset, colIdx, etiquetaOtro) {
        var OTRO = otroValorCamposUi();
        var map = {};
        (preset || []).forEach(function (o) {
            if (!o || o.v === OTRO) return;
            var up = mayusInv(o.label || o.v);
            if (up) map[up] = { v: up, label: up };
        });
        valoresUnicosColumna(colIdx).forEach(function (v) {
            map[v] = { v: v, label: v };
        });
        var arr = Object.keys(map).sort(function (a, b) { return a.localeCompare(b, 'es'); }).map(function (k) {
            return map[k];
        });
        arr.push({ v: OTRO, label: etiquetaOtro || 'OTRO' });
        return arr;
    }

    function filasParaCatalogoInventario() {
        return (state.filas || []).concat(state.nuevasFilas || []);
    }

    function listaColoresInventario() {
        var Ui = global.ObebeAdminCamposUi;
        if (Ui && Ui.listaColoresCatalogo) return Ui.listaColoresCatalogo(filasParaCatalogoInventario());
        var idx = ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : { color: 4 };
        return listaConPresetYPreset([], idx.color != null ? idx.color : 4, 'OTRO');
    }

    function listaTiposInventario() {
        var Ui = global.ObebeAdminCamposUi;
        if (Ui && Ui.listaTiposCatalogo) return Ui.listaTiposCatalogo(filasParaCatalogoInventario());
        var idx = ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : { tipo: 5 };
        return listaConPresetYPreset([], idx.tipo != null ? idx.tipo : 5, 'OTRO');
    }

    function listaMarcasInventario() {
        var Ui = global.ObebeAdminCamposUi;
        if (Ui && Ui.listaMarcasCatalogo) return Ui.listaMarcasCatalogo(filasParaCatalogoInventario());
        var idx = ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : { marca: 6 };
        var preset = global.ObebeAdminCamposUi ? global.ObebeAdminCamposUi.MARCAS_APARTADO : [];
        return listaConPresetYPreset(preset, idx.marca != null ? idx.marca : 6, 'OTRO');
    }

    function listaTallasInventario() {
        var Ui = global.ObebeAdminCamposUi;
        if (Ui && Ui.listaTallasCatalogo) return Ui.listaTallasCatalogo();
        var OTRO = otroValorCamposUi();
        return TALLAS_INVENTARIO.map(function (o) {
            if (o.v === '__otro__') return { v: OTRO, label: 'OTRA' };
            return o;
        });
    }

    function idxInventarioCols() {
        return ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : {};
    }

    function esColumnaMayusculas(colIdx) {
        var idx = idxInventarioCols();
        return colIdx === idx.nombre || colIdx === idx.talla || colIdx === idx.color ||
            colIdx === idx.tipo || colIdx === idx.marca;
    }

    function colIdxArticuloInventario() {
        var idx = idxInventarioCols();
        return idx.nombre != null ? idx.nombre : 1;
    }

    function esColumnaArticulo(colIdx) {
        return colIdx === colIdxArticuloInventario();
    }

    function recalcularTotalFila(f) {
        if (!f || !f.celdas) return;
        var idx = idxInventarioCols();
        var colStock = idx.stock != null ? idx.stock : 2;
        var colPrecio = idx.precio != null ? idx.precio : 7;
        var colTotal = idx.total != null ? idx.total : 8;
        var qty = parseInt(f.celdas[colStock], 10) || 0;
        var precio = parseNumInventario(f.celdas[colPrecio]);
        var t = qty * precio;
        f.celdas[colTotal] = t > 0 ? String(Math.round(t * 100) / 100) : '';
    }

    function siguienteRefInventario() {
        var idx = idxInventarioCols();
        var col = idx.imagen != null ? idx.imagen : 0;
        var max = 0;
        function scan(arr) {
            (arr || []).forEach(function (f) {
                var r = parseInt(f.celdas[col], 10);
                if (isNaN(r)) r = parseInt(f.ref, 10) || 0;
                if (r > max) max = r;
            });
        }
        scan(state.filas);
        scan(state.nuevasFilas);
        return max + 1;
    }

    function renderCeldaSelectInventario(f, colIdx, lista) {
        var Ui = global.ObebeAdminCamposUi;
        var k = keyFila(f);
        var val = f.celdas[colIdx] == null ? '' : String(f.celdas[colIdx]);
        var otroId = otroIdInventario(k, colIdx);
        if (!Ui) {
            return '<td><input type="text" class="admin-inv-cell" data-key="' + esc(k) + '" data-col="' + colIdx +
                '" value="' + esc(mayusInv(val)) + '"></td>';
        }
        var valNorm = Ui.normalizarValorColumnaInventario
            ? Ui.normalizarValorColumnaInventario(colIdx, val)
            : mayusInv(val);
        var res = Ui.resolverValorEnLista(valNorm, lista);
        var opts = '<option value="">—</option>' + lista.map(function (o) {
            return '<option value="' + esc(o.v) + '"' + (res.select === o.v ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        }).join('');
        var otroHidden = res.showOtro ? '' : ' admin-hidden';
        var swapHide = res.showOtro ? ' admin-select-otro-swap-hidden' : '';
        return '<td class="admin-inv-select-td"><div class="admin-select-otro-slot">' +
            '<select class="admin-inv-cell-select admin-campo-select-otro' + swapHide + '" data-key="' + esc(k) +
            '" data-col="' + colIdx + '" data-otro-for="' + esc(otroId) + '">' + opts + '</select>' +
            '<input type="text" class="admin-inv-cell-otro admin-campo-otro-input ' + esc(otroId) + otroHidden +
            '" data-key="' + esc(k) +             '" data-col="' + colIdx + '" data-inv-otro-for="' + esc(otroId) + '" value="' + esc(mayusInv(res.otro)) +
            '" placeholder="Especificar…"></div></td>';
    }

    function leerValorSelectInventario(selectEl) {
        var Ui = global.ObebeAdminCamposUi;
        if (!selectEl) return '';
        var otroCls = selectEl.getAttribute('data-otro-for');
        var row = selectEl.closest('tr');
        var otro = null;
        if (otroCls && row) {
            otro = row.querySelector('[data-inv-otro-for="' + otroCls + '"]');
            if (!otro && typeof CSS !== 'undefined' && CSS.escape) {
                try {
                    otro = row.querySelector('.' + CSS.escape(otroCls));
                } catch (e) { /* ignore */ }
            }
        }
        if (Ui) {
            var col = parseInt(selectEl.getAttribute('data-col'), 10);
            var raw = Ui.leerSelectOtro(selectEl, otro);
            return Ui.normalizarValorColumnaInventario
                ? Ui.normalizarValorColumnaInventario(col, raw)
                : mayusInv(raw);
        }
        return mayusInv(selectEl.value);
    }

    function aplicarCambioCelda(container, f, col, valor) {
        if (!f) return;
        if (esColumnaMayusculas(col)) valor = mayusInv(valor);
        f.celdas[col] = valor;
        if (!f._dirty) f._dirty = {};
        f._dirty[col] = true;
        syncDerived(f);
        var idx = idxInventarioCols();
        var colTotal = idx.total != null ? idx.total : 8;
        if (col === idx.stock || col === idx.precio) {
            if (!f._dirty) f._dirty = {};
            f._dirty[colTotal] = true;
        }
        if (col === idx.stock || col === idx.precio || col === colTotal) {
            var td = container.querySelector('[data-inv-total-for="' + keyFila(f) + '"] .admin-inv-total');
            if (td) {
                td.textContent = valorCeldaMostrar(f, colTotal, f.celdas[colTotal]);
            }
        }
    }

    function tiposDisponibles() {
        var map = {};
        function tomar(f) {
            var t = String((f && f.tipo) || '').trim();
            if (!t) return;
            var k = t.toLowerCase();
            if (!map[k]) map[k] = t;
        }
        (state.filas || []).forEach(tomar);
        (state.nuevasFilas || []).forEach(tomar);
        if (state.filtroTipo && !map[state.filtroTipo.toLowerCase()]) {
            map[state.filtroTipo.toLowerCase()] = state.filtroTipo;
        }
        return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
            return a.localeCompare(b, 'es');
        });
    }

    function renderToolbar() {
        var modo = state.modoEdicion
            ? '<span class="admin-inv-modo admin-inv-modo-edit">Editando</span>'
            : '<span class="admin-inv-modo">Solo vista</span>';
        if (state.mayoreoInventario && state.modoEdicion) {
            modo += '<span class="admin-inv-modo-hint admin-muted-text">Solo puedes cambiar la columna H (tu precio de venta).</span>';
        } else if (state.modoEdicion && state.mostrarAuditoriaStock) {
            modo += '<span class="admin-inv-modo-hint admin-muted-text">Columna Z: notas de auditoría. Clic en encabezado Z para ordenar (vacíos al final).</span>';
        } else if (state.mostrarAuditoriaStock && !state.mayoreoInventario) {
            modo += '<span class="admin-inv-modo-hint admin-muted-text">Clic en columna Z para ordenar (▼ Z→A, vacíos al final).</span>';
        }

        var acciones = '';
        var puedeEditar = !state.soloLectura || !!state.mayoreoInventario;
        if (puedeEditar) {
            if (state.modoEdicion) {
                if (!state.mayoreoInventario) {
                    acciones +=
                        '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact" id="adminInvAddRow">+ Fila</button>' +
                        '<button type="button" class="admin-btn admin-btn-danger admin-btn-compact" id="adminInvDelRows">Eliminar</button>';
                }
                var cancelClass = state.mayoreoInventario
                    ? 'admin-btn admin-btn-danger admin-btn-compact'
                    : 'admin-btn admin-btn-ghost admin-btn-compact';
                acciones +=
                    '<button type="button" class="' + cancelClass + '" id="adminInvCancel">Cancelar</button>' +
                    '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact" id="adminInvSave">Guardar</button>';
            } else {
                acciones +=
                    '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact" id="adminInvEdit">Editar</button>';
            }
        }

        function btnGenero(valor, etiqueta) {
            var activo = (state.filtroGenero || '') === valor;
            return '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-inv-genero-btn' +
                (activo ? ' is-active' : '') + '" data-inv-genero="' + valor + '" aria-pressed="' +
                (activo ? 'true' : 'false') + '">' + etiqueta + '</button>';
        }

        var tipos = tiposDisponibles();
        var optsTipo = '<option value="">Todos</option>' + tipos.map(function (t) {
            var sel = state.filtroTipo && state.filtroTipo.toLowerCase() === t.toLowerCase() ? ' selected' : '';
            return '<option value="' + esc(t) + '"' + sel + '>' + esc(t) + '</option>';
        }).join('');

        return '<div class="admin-inv-toolbar">' +
            modo +
            '<input type="search" class="admin-search" id="adminInvSearch" placeholder="Buscar…" value="' + esc(state.filtro) + '">' +
            '<div class="admin-inv-genero" role="group" aria-label="Filtrar por género">' +
            btnGenero('', 'Todos') +
            btnGenero('Hombre', 'Hombre') +
            btnGenero('Mujer', 'Mujer') +
            '</div>' +
            (function () {
                var tipoLbl =
                    '<label class="admin-inv-tipo">Tipo' +
                    '<select id="adminInvTipo" aria-label="Filtrar por tipo">' + optsTipo + '</select></label>';
                var editTipo = '';
                var accRest = acciones;
                if (state.mayoreoInventario && puedeEditar && !state.modoEdicion && acciones) {
                    editTipo = '<span class="admin-inv-edit-tipo">' + acciones + '</span>';
                    accRest = '';
                }
                return tipoLbl + editTipo +
                    '<div class="admin-inv-toolbar-actions">' + accRest + '</div>';
            })() + '</div>' +
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

    function parseNumInventario(val) {
        var t = String(val || '').trim();
        if (!t) return 0;
        t = t.replace(/\$/g, '').replace(/\s/g, '');
        if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
        else if (/^\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
        else t = t.replace(/,/g, '');
        t = t.replace(/[^\d.-]/g, '');
        var n = parseFloat(t);
        return isNaN(n) ? 0 : n;
    }

    function precioRetailFila(f) {
        if (f && f.precio > 0) return f.precio;
        var idx = ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : { precio: 7 };
        var col = idx.precio != null ? idx.precio : 7;
        var raw = f && f.celdas ? f.celdas[col] : '';
        return parseNumInventario(raw);
    }

    function costoNetoFila(f) {
        var idx = ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : {};
        var colCosto = idx.costoNeto != null ? idx.costoNeto : 12;
        var raw = f && f.celdas ? f.celdas[colCosto] : '';
        return parseNumInventario(raw);
    }

    function esErrorCeldaMargen(val) {
        var u = String(val || '').trim().toUpperCase();
        return u.indexOf('#VALUE') >= 0 || u.indexOf('#REF') >= 0 || u.indexOf('#DIV') >= 0;
    }

    function margenPctRetailCosto(f) {
        var retail = precioRetailFila(f);
        if (retail <= 0) return '';
        var costo = costoNetoFila(f);
        if (costo <= 0) costo = Math.round(retail * 0.7);
        var pct = Math.round(((retail - costo) / retail) * 100);
        if (!isFinite(pct)) return '';
        return pct + '%';
    }

    function valorCeldaMostrar(f, colIdx, val) {
        var idx = ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : {};
        var colCosto = idx.costoNeto != null ? idx.costoNeto : 12;
        var colMargen = idx.margen != null ? idx.margen : 14;
        if (colIdx === colMargen) {
            if (esErrorCeldaMargen(val) || esVacioONa(val)) {
                var calc = margenPctRetailCosto(f);
                return calc || '30%';
            }
            var sMargen = String(val).trim();
            if (/^\d+([.,]\d+)?$/.test(sMargen)) return Math.round(parseNumInventario(sMargen)) + '%';
            return val;
        }
        if (!esVacioONa(val)) return val;
        if (colIdx === colCosto) {
            var retail = precioRetailFila(f);
            if (!retail) return val;
            var neto = Math.round(retail * 0.7);
            return ObebeAdminData.formatoMoney ? ObebeAdminData.formatoMoney(neto) : String(neto);
        }
        return val;
    }

    function textoExistencia() {
        var n = filtrarFilasInv(filasInventarioBase(), state.filtro, optsFiltro({ soloStock: true })).length;
        var nuevas = filtrarFilasInv(state.nuevasFilas, state.filtro, optsFiltro({})).length;
        var etiqueta = '';
        if (state.filtroGenero) etiqueta += ' · ' + state.filtroGenero;
        if (state.filtroTipo) etiqueta += ' · ' + state.filtroTipo;
        return (n + nuevas) + ' artículo(s) en existencia' + etiqueta;
    }

    function renderCeldaThumb(f) {
        var cands = ObebeAdminData.candidatosImagenInventarioAdmin
            ? ObebeAdminData.candidatosImagenInventarioAdmin(f)
            : [];
        if (!cands.length) {
            var url = ObebeAdminData.urlImagenFilaInventario(f);
            if (url && ObebeAdminData.candidatosUrlImagenAdmin) {
                cands = ObebeAdminData.candidatosUrlImagenAdmin(url);
            } else if (url) {
                cands = [url];
            }
        }
        if (!cands.length) {
            return '<span class="admin-mayoreo-thumb-empty admin-inv-thumb"></span>';
        }
        return '<img src="' + esc(cands[0]) + '" alt="" class="admin-inv-thumb" loading="lazy" decoding="async" ' +
            'data-candidate-step="0" data-candidates="' + esc(cands.join('|')) + '" ' +
            'onerror="typeof adminMayoreoImgFallback===\'function\'&&adminMayoreoImgFallback(this)">';
    }

    function colPrecioInventario() {
        var idx = idxInventarioCols();
        return idx.precio != null ? idx.precio : 7;
    }

    function renderCeldaInventario(f, colIdx, edit) {
        var idx = idxInventarioCols();
        var val = (f.celdas[colIdx] == null ? '' : String(f.celdas[colIdx]));
        var mostrar = valorCeldaMostrar(f, colIdx, val);
        if (esColumnaMayusculas(colIdx) && !esVacioONa(mostrar)) {
            mostrar = mayusInv(mostrar);
        }
        if (colIdx === colFotoInventario()) {
            if (state._renderCtx && state._renderCtx.omitThumbs) {
                return '<td class="admin-inv-thumb-cell"><span class="admin-mayoreo-thumb-empty admin-inv-thumb" aria-hidden="true"></span></td>';
            }
            return '<td class="admin-inv-thumb-cell">' + renderCeldaThumb(f) + '</td>';
        }
        var editCell = edit;
        if (editCell && state.mayoreoInventario && colIdx !== colPrecioInventario()) {
            editCell = false;
        }
        if (editCell) {
            var colTotal = idx.total != null ? idx.total : 8;
            if (colIdx === colTotal) {
                recalcularTotalFila(f);
                var totalMostrar = valorCeldaMostrar(f, colIdx, f.celdas[colIdx]);
                return '<td class="admin-inv-total-td" data-inv-total-for="' + esc(keyFila(f)) + '">' +
                    '<span class="admin-inv-readonly admin-inv-total">' + esc(totalMostrar) + '</span></td>';
            }
            var listas = state._listasInv;
            if (colIdx === (idx.talla != null ? idx.talla : 3)) {
                return renderCeldaSelectInventario(f, colIdx, listas ? listas.tallas : listaTallasInventario());
            }
            if (colIdx === (idx.color != null ? idx.color : 4)) {
                return renderCeldaSelectInventario(f, colIdx, listas ? listas.colores : listaColoresInventario());
            }
            if (colIdx === (idx.tipo != null ? idx.tipo : 5)) {
                return renderCeldaSelectInventario(f, colIdx, listas ? listas.tipos : listaTiposInventario());
            }
            if (colIdx === (idx.marca != null ? idx.marca : 6)) {
                return renderCeldaSelectInventario(f, colIdx, listas ? listas.marcas : listaMarcasInventario());
            }
            if (esColumnaAuditoria(colIdx)) {
                var audVal = esVacioONa(val) ? '' : val;
                return '<td class="admin-inv-auditoria-td"><textarea class="admin-inv-cell admin-inv-auditoria" rows="2" ' +
                    'data-key="' + esc(keyFila(f)) + '" data-col="' + colIdx + '">' +
                    esc(audVal) + '</textarea></td>';
            }
            var inputVal = esVacioONa(val) ? mostrar : val;
            if (esColumnaMayusculas(colIdx)) inputVal = mayusInv(inputVal);
            var tdArt = (state.mayoreoInventario && esColumnaArticulo(colIdx)) ? ' class="admin-inv-col-articulo"' : '';
            return '<td' + tdArt + '><input type="text" class="admin-inv-cell" data-key="' + esc(keyFila(f)) + '" data-col="' + colIdx + '" value="' + esc(inputVal) + '"></td>';
        }
        var tdArtRead = (state.mayoreoInventario && esColumnaArticulo(colIdx)) ? ' class="admin-inv-col-articulo"' : '';
        if (esColumnaAuditoria(colIdx)) {
            var notaAud = esVacioONa(mostrar) ? '—' : mostrar;
            return '<td class="admin-inv-auditoria-td"><span class="admin-inv-readonly admin-inv-auditoria-read" title="' +
                esc(notaAud) + '">' + esc(notaAud) + '</span></td>';
        }
        return '<td' + tdArtRead + '><span class="admin-inv-readonly">' + esc(mostrar) + '</span></td>';
    }

    function prepararRenderGridContext(visTotal) {
        var edit = state.modoEdicion;
        state._renderCtx = {
            edit: edit,
            omitThumbs: false
        };
        if (edit) prepararListasRenderInventario();
    }

    function visiblesParaRender() {
        var visAll = filasVisibles();
        var trunc = visAll.length > INV_RENDER_MAX;
        return {
            visAll: visAll,
            vis: trunc ? visAll.slice(0, INV_RENDER_MAX) : visAll,
            trunc: trunc
        };
    }

    function mensajeLimiteRender(visAll, trunc) {
        if (!trunc) return '';
        return '<p class="admin-inv-render-limit admin-muted-text">Mostrando los primeros ' + INV_RENDER_MAX +
            ' de ' + visAll.length + ' resultados. Acota la búsqueda o los filtros.</p>';
    }

    function renderFilasTbodyHtml(vis, edit, pick) {
        var colsVista = columnasVistaGrid();
        var i;
        return vis.map(function (f, visIdx) {
            var k = keyFila(f);
            var checked = state.seleccion[k] ? ' checked' : '';
            var rowNum = f.filaSheet;
            if (!rowNum || rowNum === 'nueva') rowNum = visIdx + 2;
            var cells = '';
            for (i = 0; i < colsVista.length; i++) {
                cells += renderCeldaInventario(f, colsVista[i], edit);
            }
            var sel = pick
                ? '<td class="admin-inv-sel"><input type="checkbox" class="admin-inv-pick" data-key="' + esc(k) + '"' + checked + '></td>'
                : '';
            return '<tr class="admin-inv-data-row" data-inv-key="' + esc(k) + '">' + sel +
                '<td class="admin-inv-row">' + rowNum + '</td>' + cells + '</tr>';
        }).join('');
    }

    function renderGrid() {
        var colsVista = columnasVistaGrid();
        var enc = ObebeAdminData.encabezadosInventarioActuales
            ? ObebeAdminData.encabezadosInventarioActuales()
            : (state.encabezadosFila2 || []);
        if (!enc.length && ObebeAdminData.combinarEncabezadosInventario) {
            enc = ObebeAdminData.combinarEncabezadosInventario(state.encabezadosFila2);
        }
        var pack = visiblesParaRender();
        prepararRenderGridContext(pack.visAll.length);
        var vis = pack.vis;
        var edit = state.modoEdicion;
        var pick = edit && !state.mayoreoInventario;

        var thLetters = '';
        var thSheet = '';
        var i;
        for (i = 0; i < colsVista.length; i++) {
            var c = colsVista[i];
            var thArt = (state.mayoreoInventario && esColumnaArticulo(c)) ? ' admin-inv-col-articulo' : '';
            var thAudL = esColumnaAuditoria(c) ? ' admin-inv-col-auditoria' : '';
            var sortAudL = esColumnaAuditoria(c) ? ' admin-inv-th-sortable' : '';
            var sortLblL = esColumnaAuditoria(c) ? etiquetaOrdenAuditoria() : '';
            var sortTitL = esColumnaAuditoria(c)
                ? 'Ordenar columna Z (vacíos al final). Clic: Z→A, A→Z, sin orden.'
                : ('Columna ' + ObebeAdminData.colLetter(c));
            thLetters += '<th class="admin-inv-th-letter' + thArt + thAudL + sortAudL + '"' +
                (esColumnaAuditoria(c) ? ' data-inv-sort-aud="1" role="button" tabindex="0"' : '') +
                ' title="' + esc(sortTitL) + '">' +
                esc(ObebeAdminData.colLetter(c)) + esc(sortLblL) + '</th>';
            var titulo = (enc[c] || '').trim();
            if (/^(no\.?\s*)?imagen|^ref$|^#$/i.test(titulo) || titulo.toLowerCase() === 'no imagen') titulo = 'Ref';
            if (esColumnaAuditoria(c) && !titulo) titulo = 'Comentario auditoría';
            var thAud = esColumnaAuditoria(c) ? ' admin-inv-col-auditoria' : '';
            thSheet += '<th class="admin-inv-th-title' + thArt + thAud + sortAudL + '"' +
                (esColumnaAuditoria(c) ? ' data-inv-sort-aud="1" role="button" tabindex="0"' : '') +
                ' title="' + esc(sortTitL) + '">' + esc(titulo) + esc(sortLblL) + '</th>';
        }
        var selHead = pick ? '<th class="admin-inv-sel admin-inv-sticky-corner">✓</th>' : '';
        var headLetters = '<tr class="admin-inv-head-letters">' + selHead +
            '<th class="admin-inv-row admin-inv-sticky-corner2">#</th>' + thLetters + '</tr>';
        var headSheet = '<tr class="admin-inv-head-sheet">' + (pick ? '<th class="admin-inv-sel admin-inv-sticky-corner"></th>' : '') +
            '<th class="admin-inv-row admin-inv-sticky-corner2">2</th>' + thSheet + '</tr>';

        var tbody = renderFilasTbodyHtml(vis, edit, pick);

        var colSpan = colsVista.length + 1 + (pick ? 1 : 0);
        var scrollCls = 'admin-inv-scroll' + (edit ? ' admin-inv-scroll--edit' : '') +
            (state.mayoreoInventario ? ' admin-inv-scroll--mayoreo' : '');
        return mensajeLimiteRender(pack.visAll, pack.trunc) +
            '<div class="' + scrollCls + '">' +
            '<table class="admin-table admin-inv-grid' + (edit ? ' admin-inv-grid--edit' : '') + '"><thead>' + headLetters + headSheet +
            '</thead><tbody>' + (tbody || '<tr><td colspan="' + colSpan + '">Sin filas</td></tr>') + '</tbody></table></div>';
    }

    function actualizarAvisoLimiteRender(mount, pack) {
        var prev = mount.querySelector('.admin-inv-render-limit');
        if (!pack.trunc) {
            if (prev) prev.remove();
            return;
        }
        var msg = 'Mostrando los primeros ' + INV_RENDER_MAX + ' de ' + pack.visAll.length +
            ' resultados. Acota la búsqueda o los filtros.';
        if (prev) prev.textContent = msg;
        else {
            var p = document.createElement('p');
            p.className = 'admin-inv-render-limit admin-muted-text';
            p.textContent = msg;
            mount.insertBefore(p, mount.firstChild);
        }
    }

    function refreshGrid(container, onReload) {
        var mount = container.querySelector('#adminInvGridMount');
        if (!mount) return;
        var pack = visiblesParaRender();
        prepararRenderGridContext(pack.visAll.length);
        var edit = state.modoEdicion;
        var pick = edit && !state.mayoreoInventario;
        var colsVista = columnasVistaGrid();
        var colSpan = colsVista.length + 1 + (pick ? 1 : 0);
        var tbodyHtml = renderFilasTbodyHtml(pack.vis, edit, pick) ||
            '<tr><td colspan="' + colSpan + '">Sin filas</td></tr>';

        var sc = mount.querySelector('.admin-inv-scroll');
        var scrollTop = sc ? sc.scrollTop : 0;
        var table = mount.querySelector('.admin-inv-grid');
        var canPatch = table && table.querySelector('tbody') && table.querySelector('thead') &&
            table.classList.contains('admin-inv-grid--edit') === !!edit;
        if (canPatch) {
            table.querySelector('tbody').innerHTML = tbodyHtml;
            actualizarAvisoLimiteRender(mount, pack);
            if (sc) sc.scrollTop = scrollTop;
        } else {
            mount.innerHTML = renderGrid();
        }
        ensureGridDelegatedEvents(container, onReload);
        if (global.ObebeAdminCamposUi && state.modoEdicion) {
            global.ObebeAdminCamposUi.bindSelectOtros(container);
        }
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
        if (!state.soloLectura) mountSeccionAgotados(container, onReload);
    }

    function ciclarOrdenAuditoria() {
        if (!state.ordenAuditoria) state.ordenAuditoria = 'desc';
        else if (state.ordenAuditoria === 'desc') state.ordenAuditoria = 'asc';
        else state.ordenAuditoria = null;
    }

    function ensureGridDelegatedEvents(container, onReload) {
        if (container._obebeInvGridDelegated) return;
        container._obebeInvGridDelegated = true;

        function activarSortAud(ev) {
            if (ev) ev.preventDefault();
            invalidarCacheFilasVisibles();
            ciclarOrdenAuditoria();
            refreshGrid(container, onReload);
        }

        container.addEventListener('click', function (ev) {
            var th = ev.target.closest('[data-inv-sort-aud]');
            if (!th || !container.contains(th)) return;
            activarSortAud(ev);
        });
        container.addEventListener('keydown', function (ev) {
            var th = ev.target.closest('[data-inv-sort-aud]');
            if (!th || !container.contains(th)) return;
            if (ev.key === 'Enter' || ev.key === ' ') activarSortAud(ev);
        });

        container.addEventListener('input', function (ev) {
            var t = ev.target;
            if (!state.modoEdicion || !container.contains(t)) return;
            if (t.classList.contains('admin-inv-cell')) {
                var k = t.getAttribute('data-key');
                var col = parseInt(t.getAttribute('data-col'), 10);
                var f = findFila(k);
                if (f) aplicarCambioCelda(container, f, col, t.value);
                return;
            }
            if (t.classList.contains('admin-inv-cell-otro')) {
                var k2 = t.getAttribute('data-key');
                var col2 = parseInt(t.getAttribute('data-col'), 10);
                var row = t.closest('tr');
                var sel = row ? row.querySelector('.admin-inv-cell-select[data-col="' + col2 + '"]') : null;
                var f2 = findFila(k2);
                if (f2 && sel) aplicarCambioCelda(container, f2, col2, leerValorSelectInventario(sel));
            }
        });

        container.addEventListener('change', function (ev) {
            var t = ev.target;
            if (!state.modoEdicion || !container.contains(t)) return;
            if (t.classList.contains('admin-inv-cell-select')) {
                if (global.ObebeAdminCamposUi) {
                    global.ObebeAdminCamposUi.toggleOtroInput(t);
                    if (t.value === (global.ObebeAdminCamposUi.OTRO || '__otro__')) {
                        global.ObebeAdminCamposUi.enfocarInputOtro(t);
                    }
                }
                var k = t.getAttribute('data-key');
                var col = parseInt(t.getAttribute('data-col'), 10);
                var f = findFila(k);
                if (f) aplicarCambioCelda(container, f, col, leerValorSelectInventario(t));
                return;
            }
            if (t.classList.contains('admin-inv-pick')) {
                state.seleccion[t.getAttribute('data-key')] = t.checked;
            }
        });
    }

    function bindGridEvents(container, onReload) {
        ensureGridDelegatedEvents(container, onReload);
    }

    function bindEvents(container, onReload) {
        var searchEl = container.querySelector('#adminInvSearch');
        if (searchEl) {
            searchEl.addEventListener('input', function (e) {
                state.filtro = e.target.value;
                if (invSearchTimer) clearTimeout(invSearchTimer);
                invSearchTimer = setTimeout(function () {
                    refreshGrid(container, onReload);
                }, INV_SEARCH_DEBOUNCE_MS);
            });
        }
        container.querySelectorAll('[data-inv-genero]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                state.filtroGenero = btn.getAttribute('data-inv-genero') || '';
                invalidarCacheFilasVisibles();
                refreshUi(container, onReload);
            });
        });
        var tipoEl = container.querySelector('#adminInvTipo');
        if (tipoEl) {
            tipoEl.addEventListener('change', function () {
                state.filtroTipo = tipoEl.value || '';
                invalidarCacheFilasVisibles();
                refreshUi(container, onReload);
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
                var dlgSalir = state.mayoreoInventario ? {
                    title: '¿Salir sin guardar?',
                    message: 'Hay cambios sin guardar en el inventario. Si sales, se perderán.',
                    confirmText: 'Sí, salir',
                    cancelText: 'Seguir editando',
                    variant: 'danger'
                } : {
                    title: '¿Salir sin guardar?',
                    message: 'Hay cambios sin guardar en el inventario. Si sales, se perderán.',
                    confirmText: 'Sí, salir',
                    cancelText: 'Seguir editando',
                    variant: 'warn'
                };
                ObebeAdminDialog.confirm(dlgSalir).then(function (ok) {
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
                    var colRef = idx.imagen != null ? idx.imagen : 0;
                    var nextRef = siguienteRefInventario();
                    var i;
                    for (i = 0; i < numCols; i++) vacia.push('');
                    vacia[colStock] = '1';
                    vacia[colRef] = String(nextRef);
                    var localId = 'new-' + Date.now();
                    state.nuevasFilas.push({
                        _localId: localId,
                        celdas: vacia,
                        nombre: '',
                        stock: 1,
                        ref: nextRef,
                        filaSheet: 0,
                        _isNew: true,
                        _dirty: {}
                    });
                    refreshGrid(container, onReload);
                    irAFilaInventario(container, localId);
                });
            }
            var saveBtn = container.querySelector('#adminInvSave');
            if (saveBtn) {
                saveBtn.addEventListener('click', function () {
                    if (state.mayoreoInventario) {
                        ObebeAdminDialog.confirm({
                            title: '¿Guardar cambios?',
                            message: 'Se guardarán los precios en tu inventario Naty.',
                            confirmText: 'Sí, guardar',
                            cancelText: 'Cancelar',
                            variant: 'warn'
                        }).then(function (ok) {
                            if (ok) guardar(onReload, container);
                        });
                        return;
                    }
                    guardar(onReload, container);
                });
            }
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
        var colNombre = idx.nombre != null ? idx.nombre : 1;
        var colTalla = idx.talla != null ? idx.talla : 3;
        var colColor = idx.color != null ? idx.color : 4;
        var colTipo = idx.tipo != null ? idx.tipo : 5;
        var colMarca = idx.marca != null ? idx.marca : 6;
        var Ui = global.ObebeAdminCamposUi;
        if (Ui && Ui.normalizarValorColumnaInventario) {
            f.celdas[colNombre] = Ui.normalizarValorColumnaInventario(colNombre, f.celdas[colNombre]);
            f.celdas[colTalla] = Ui.normalizarValorColumnaInventario(colTalla, f.celdas[colTalla]);
            f.celdas[colColor] = Ui.normalizarValorColumnaInventario(colColor, f.celdas[colColor]);
            f.celdas[colTipo] = Ui.normalizarValorColumnaInventario(colTipo, f.celdas[colTipo]);
            f.celdas[colMarca] = Ui.normalizarValorColumnaInventario(colMarca, f.celdas[colMarca]);
        } else {
            f.celdas[colNombre] = mayusInv(f.celdas[colNombre]);
            f.celdas[colTalla] = mayusInv(f.celdas[colTalla]);
            f.celdas[colColor] = mayusInv(f.celdas[colColor]);
            f.celdas[colTipo] = mayusInv(f.celdas[colTipo]);
            f.celdas[colMarca] = mayusInv(f.celdas[colMarca]);
        }
        f.nombre = String(f.celdas[colNombre] || '').trim();
        f.talla = String(f.celdas[colTalla] || '').trim();
        f.color = String(f.celdas[colColor] || '').trim();
        f.tipo = String(f.celdas[colTipo] || '').trim();
        f.stock = parseInt(f.celdas[idx.stock != null ? idx.stock : 2], 10) || 0;
        f.ref = parseInt(f.celdas[idx.imagen != null ? idx.imagen : 0], 10) || 0;
        f.marca = String(f.celdas[colMarca] || '').trim();
        f.fotoUrl = (f.celdas[colFotoInventario()] || '').trim();
        if (ObebeAdminData.normalizarMarca) f.marca = ObebeAdminData.normalizarMarca(f.marca);
        f.marca = mayusInv(f.marca);
        f.celdas[colMarca] = f.marca;
        recalcularTotalFila(f);
        f._invBlob = null;
    }

    function volcarInputsInventarioDesdeDom(container) {
        if (!container || !state.modoEdicion) return;
        container.querySelectorAll('.admin-inv-cell').forEach(function (input) {
            var k = input.getAttribute('data-key');
            var col = parseInt(input.getAttribute('data-col'), 10);
            if (isNaN(col)) return;
            var f = findFila(k);
            if (!f) return;
            aplicarCambioCelda(container, f, col, input.value);
        });
    }

    function guardarMayoreoInventario(onReload, container) {
        volcarInputsInventarioDesdeDom(container);
        var idx = ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : { precio: 7 };
        var colPrecio = idx.precio != null ? idx.precio : 7;
        var snap = state.snapshot || [];
        var cambios = 0;
        var sinLinea = 0;
        var fallosStore = 0;
        var idxFull = ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : {};
        var colMargen = idxFull.margen != null ? idxFull.margen : 14;
        var colCostoBruto = idxFull.costoBruto != null ? idxFull.costoBruto : 11;
        var colCostoNeto = idxFull.costoNeto != null ? idxFull.costoNeto : 12;
        state.filas.forEach(function (f) {
            if (!f.mayoreoLineaId) {
                sinLinea++;
                return;
            }
            var ant = snap.find(function (s) { return s._localId === f._localId; });
            var valNuevo = parseNumInventario(f.celdas[colPrecio]);
            var valAnt = ant ? parseNumInventario(ant.celdas[colPrecio]) : 0;
            var dirtyPrecio = f._dirty && f._dirty[colPrecio];
            if (dirtyPrecio || Math.abs(valNuevo - valAnt) >= 0.01) {
                var lineaOk = ObebeMayoreoStore.updateLinea(f.mayoreoLineaId, { precioVentaPlaneado: valNuevo });
                if (!lineaOk) {
                    fallosStore++;
                    return;
                }
                f.precio = valNuevo;
                f.precioVentaPlaneado = valNuevo;
                cambios++;
            }
            var bruto = parseNumInventario(f.celdas[colCostoBruto]);
            var neto = parseNumInventario(f.celdas[colCostoNeto]);
            var refM = valNuevo > 0 ? valNuevo : neto;
            if (refM > 0 && bruto >= 0 && global.ObebeAdminMayoreoVentas &&
                ObebeAdminMayoreoVentas.margenRegla3) {
                f.celdas[colMargen] = ObebeAdminMayoreoVentas.margenRegla3(bruto, refM);
            }
        });
        state.modoEdicion = false;
        state.snapshot = null;
        if (fallosStore) {
            state.msg = 'No se pudieron guardar ' + fallosStore + ' precio(s). Comprueba espacio del navegador o recarga.';
            state.msgOk = false;
        } else if (cambios) {
            state.msg = 'Precios de venta guardados en inventario Naty (' + cambios + '). Solo columna H · no afectan Supabase Obebe.';
            state.msgOk = true;
        } else if (sinLinea) {
            state.msg = 'No se encontraron líneas de mayoreo para guardar. Recarga la página (Ctrl+F5).';
            state.msgOk = false;
        } else {
            state.msg = 'No había cambios en la columna H (precio de venta).';
            state.msgOk = false;
        }
        refreshUi(container, onReload);
        if (onReload && cambios > 0 && !fallosStore) onReload();
    }

    function guardar(onReload, container) {
        if (state.mayoreoInventario) {
            return guardarMayoreoInventario(onReload, container);
        }
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
            state.msg = 'Cambios guardados en Supabase.';
            state.msgOk = true;
            state.modoEdicion = false;
            state.snapshot = null;
            state.nuevasFilas = [];
            if (onReload) return onReload();
        }).catch(function (err) {
            state.msg = err.message || String(err);
            state.msgOk = false;
        }).finally(function () {
            invalidarCacheFilasVisibles();
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

    function idFilaParaBorradoApi(f) {
        if (global.ObebeAdminData && ObebeAdminData.idInventarioParaBorrado) {
            return ObebeAdminData.idInventarioParaBorrado(f);
        }
        return parseInt(f.inventarioDbId, 10) || parseInt(f.filaSheet, 10) || 0;
    }

    function ejecutarEliminarSeleccion(keys, onReload, container) {
        var filasSheet = [];
        keys.forEach(function (k) {
            var f = findFila(k);
            if (!f) return;
            if (!f._isNew) {
                var idDel = idFilaParaBorradoApi(f);
                if (idDel > 0) filasSheet.push(idDel);
            }
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
            var soloNuevas = keys.length > 0;
            state.msg = soloNuevas
                ? 'Filas quitadas.'
                : 'No se pudo identificar filas en la base de datos. Recarga inventario (Ctrl+F5) e inténtalo de nuevo.';
            state.msgOk = soloNuevas;
            refreshUi(container, onReload);
            if (soloNuevas && onReload) onReload();
            return;
        }
        filasSheet = filasSheet.filter(function (v, i, a) { return a.indexOf(v) === i; });
        apiInventario('deleteRows', { filas: filasSheet }).then(function (res) {
            if (res && res.deleted === 0 && filasSheet.length) {
                throw new Error('La base no borró ninguna fila. Redespliega admin-api o recarga el panel.');
            }
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

    function mount(container, filas, onReload, encabezadosFila2, opts) {
        opts = opts || {};
        state.soloLectura = !!opts.soloLectura;
        state.mayoreoInventario = opts.mayoreoInventario || null;
        state.columnasOcultas = (opts.columnasOcultas || []).slice();
        state.mostrarAuditoriaStock = opts.mostrarAuditoriaStock !== false && !state.mayoreoInventario;
        state.filas = clonarFilas(filas);
        invalidarCacheFilasVisibles();
        state.filas.forEach(blobBusquedaFila);
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
        if (!state.soloLectura) mountSeccionAgotados(container, onReload);
    }

    global.ObebeAdminInventario = { mount: mount };
})(window);
