(function (global) {
    'use strict';

    var COL_FOTO = 9;
    /** Columna AA · texto "Apartado" (o cliente mayoreo legacy). */
    var COL_CLIENTE_MAYOREO = 26;
    var COL_AA_APARTADO = 26;
    /** Columna AB · casilla Apartado (sube a inventario pero no sale en la web). */
    var COL_AB_APARTADO = 27;
    var ZONA_COMPRAS = 'compras';
    var filas = [];
    var filtroCompras = '';
    var editandoZona = null;
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
        var t = String(v || '').trim();
        if (!t) return 0;
        t = t.replace(/\$/g, '').replace(/\s/g, '');
        if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
        else if (/^\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
        else t = t.replace(/,/g, '');
        t = t.replace(/[^\d.-]/g, '');
        var n = parseFloat(t);
        return isNaN(n) ? 0 : n;
    }

    function esVacioONa(val) {
        var s = String(val == null ? '' : val).trim();
        if (!s) return true;
        var u = s.toUpperCase().replace(/\s/g, '');
        return u === 'NA' || u === 'N/A' || u === '—' || s === '-';
    }

    function cfgCotizador() {
        if (global.ObebeCotizadorStore && ObebeCotizadorStore.leer) return ObebeCotizadorStore.leer();
        if (global.ObebeCotizadorFormula && ObebeCotizadorFormula.normalizarConfig) {
            return ObebeCotizadorFormula.normalizarConfig(global.OBEBE_COTIZADOR_DEFAULTS || {});
        }
        return { factorUsd: 1.085, valorDolar: 18.9, envio: 40, margen: 0.3 };
    }

    function cotizarRetailDesdeUsd(usd) {
        if (!(usd > 0)) return 0;
        if (global.ObebeCotizadorFormula && ObebeCotizadorFormula.cotizarUsd) {
            return ObebeCotizadorFormula.cotizarUsd(usd, cfgCotizador(), { conEnvio: true });
        }
        return 0;
    }

    function usdDesdeCeldas(celdas, idx) {
        var colBruto = idx.costoBruto != null ? idx.costoBruto : 11;
        var colNeto = idx.costoNeto != null ? idx.costoNeto : 12;
        var bruto = numCelda(celdas[colBruto]);
        if (bruto > 0) return bruto;
        var neto = numCelda(celdas[colNeto]);
        var colPrecio = idx.precio != null ? idx.precio : 7;
        var retail = numCelda(celdas[colPrecio]);
        if (neto > 0 && (retail <= 0 || neto < retail * 0.2)) return neto;
        return 0;
    }

    function netoMxnDesdeRetail(retail) {
        if (!(retail > 0)) return 0;
        return Math.round(retail * 0.7);
    }

    function celdaNetoPareceUsd(neto, retail) {
        if (!(neto > 0)) return true;
        if (!(retail > 0)) return neto > 0 && neto < 500;
        return neto < retail * 0.25 && neto < 500;
    }

    function esErrorCeldaMargen(val) {
        var u = String(val || '').trim().toUpperCase();
        return u.indexOf('#VALUE') >= 0 || u.indexOf('#REF') >= 0 || u.indexOf('#DIV') >= 0;
    }

    function precioRetailFila(f) {
        var idx = idxCols();
        var col = idx.precio != null ? idx.precio : 7;
        return numCelda(f.celdas && f.celdas[col]);
    }

    function costoNetoMxnFila(f) {
        var idx = idxCols();
        var col = idx.costoNeto != null ? idx.costoNeto : 12;
        return numCelda(f.celdas && f.celdas[col]);
    }

    function margenPctFila(f) {
        var retail = precioRetailFila(f);
        if (retail <= 0) return '';
        var costo = costoNetoMxnFila(f);
        if (costo <= 0) costo = netoMxnDesdeRetail(retail);
        var pct = Math.round(((retail - costo) / retail) * 100);
        return isFinite(pct) ? pct + '%' : '';
    }

    function valorCeldaMostrar(f, colIdx, val) {
        var idx = idxCols();
        var colCosto = idx.costoNeto != null ? idx.costoNeto : 12;
        var colMargen = idx.margen != null ? idx.margen : 14;
        if (colIdx === colMargen) {
            if (esErrorCeldaMargen(val) || esVacioONa(val)) {
                var calc = margenPctFila(f);
                return calc || '30%';
            }
            var sMargen = String(val).trim();
            if (/^\d+([.,]\d+)?$/.test(sMargen)) return Math.round(numCelda(sMargen)) + '%';
            return val;
        }
        if (!esVacioONa(val)) return val;
        if (colIdx === colCosto) {
            var retail = precioRetailFila(f);
            if (!retail) return val;
            var neto = netoMxnDesdeRetail(retail);
            return ObebeAdminData.formatoMoney ? ObebeAdminData.formatoMoney(neto) : String(neto);
        }
        return val;
    }

    function fmtMoney(n) {
        if (!(n > 0)) return '';
        return ObebeAdminData.formatoMoney ? ObebeAdminData.formatoMoney(n) : String(Math.round(n));
    }

    function idxCols() {
        var Ui = global.ObebeAdminCamposUi;
        if (Ui && Ui.idxInventarioAdmin) return Ui.idxInventarioAdmin();
        return ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : {
            imagen: 0, nombre: 1, stock: 2, talla: 3, color: 4, tipo: 5, marca: 6, precio: 7, total: 8
        };
    }

    function filasInventarioCatalogo() {
        var st = ObebeAdminData.getEstado ? ObebeAdminData.getEstado() : null;
        return (st && st.filas) || [];
    }

    function todasFilasCatalogo() {
        return filasInventarioCatalogo().concat(filas);
    }

    function recalcular(celdas) {
        var idx = idxCols();
        var colStock = idx.stock != null ? idx.stock : 2;
        var colPrecio = idx.precio != null ? idx.precio : 7;
        var colTotal = idx.total != null ? idx.total : 8;
        var colNeto = idx.costoNeto != null ? idx.costoNeto : 12;
        var colInversion = idx.inversion != null ? idx.inversion : 13;
        var colMargen = idx.margen != null ? idx.margen : 14;

        var retail = numCelda(celdas[colPrecio]);
        if (retail <= 0) {
            var usd = usdDesdeCeldas(celdas, idx);
            if (usd > 0) {
                retail = cotizarRetailDesdeUsd(usd);
                if (retail > 0) celdas[colPrecio] = String(retail);
            }
        }
        retail = numCelda(celdas[colPrecio]);

        var netoMxn = numCelda(celdas[colNeto]);
        if (retail > 0 && celdaNetoPareceUsd(netoMxn, retail)) {
            netoMxn = netoMxnDesdeRetail(retail);
            celdas[colNeto] = fmtMoney(netoMxn);
        }

        var qty = numCelda(celdas[colStock]);
        if (retail > 0 && qty > 0) {
            celdas[colTotal] = String(Math.round(qty * retail));
        } else if (retail <= 0) {
            celdas[colTotal] = '';
        }
        if (netoMxn > 0 && qty > 0 && celdas.length > colInversion) {
            celdas[colInversion] = String(Math.round(qty * netoMxn));
        } else if (celdas.length > colInversion) {
            celdas[colInversion] = '';
        }
        if (celdas.length > colMargen) {
            if (retail > 0 && netoMxn > 0) {
                celdas[colMargen] = Math.round(((retail - netoMxn) / retail) * 100) + '%';
            } else if (retail > 0) {
                celdas[colMargen] = '30%';
            } else {
                celdas[colMargen] = '';
            }
        }
    }

    function prepararFilasParaVista() {
        if (global.ObebeMayoreoPedidosStore && ObebeMayoreoPedidosStore.sincronizarFilasComprasConPedidos) {
            var sync = ObebeMayoreoPedidosStore.sincronizarFilasComprasConPedidos(filas);
            if (sync && sync.dirty && global.ObebeComprasStore) {
                filas = ObebeComprasStore.getAll();
            }
        }
        var dirtyFoto = false;
        filas.forEach(function (f) {
            var idx = idxCols();
            var colFoto = idx.foto != null ? idx.foto : COL_FOTO;
            var antes = String(f.celdas[colFoto] || '').trim();
            asignarFotoColJ(f);
            if (!antes && String(f.celdas[colFoto] || '').trim()) dirtyFoto = true;
            syncFilaCompras(f);
        });
        if (dirtyFoto && global.ObebeComprasStore) {
            ObebeComprasStore.reemplazar(filas);
            filas = ObebeComprasStore.getAll();
        }
    }

    function syncFilaCompras(f) {
        if (!f || !f.celdas) return;
        var Ui = global.ObebeAdminCamposUi;
        var idx = idxCols();
        if (Ui && Ui.normalizarValorColumnaInventario) {
            f.celdas[idx.nombre] = Ui.normalizarValorColumnaInventario(idx.nombre, f.celdas[idx.nombre]);
            f.celdas[idx.talla] = Ui.normalizarValorColumnaInventario(idx.talla, f.celdas[idx.talla]);
            f.celdas[idx.color] = Ui.normalizarValorColumnaInventario(idx.color, f.celdas[idx.color]);
            f.celdas[idx.tipo] = Ui.normalizarValorColumnaInventario(idx.tipo, f.celdas[idx.tipo]);
            f.celdas[idx.marca] = Ui.normalizarValorColumnaInventario(idx.marca, f.celdas[idx.marca]);
        }
        recalcular(f.celdas);
    }

    function siguienteRefCompras() {
        var idx = idxCols();
        var colRef = idx.imagen != null ? idx.imagen : 0;
        var max = 0;
        function scan(arr) {
            (arr || []).forEach(function (f) {
                var r = parseInt(f.celdas && f.celdas[colRef], 10);
                if (isNaN(r) && f.ref) r = parseInt(f.ref, 10);
                if (!isNaN(r) && r > max) max = r;
            });
        }
        scan(filasInventarioCatalogo());
        scan(filas);
        return max + 1;
    }

    function patchHtmlSelectGrid(html, rowId) {
        return String(html || '')
            .replace(/data-row-key/g, 'data-id')
            .replace(/admin-grid-cell-select/g,
                'admin-grid-cell-select admin-inv-cell-select admin-compras-cell-select')
            .replace(/admin-inv-cell-otro/g, 'admin-inv-cell-otro admin-compras-cell-otro');
    }

    function aplicarCambioCompras(root, f, col, valor) {
        if (!f) return;
        var Ui = global.ObebeAdminCamposUi;
        if (Ui && Ui.normalizarValorColumnaInventario) {
            valor = Ui.normalizarValorColumnaInventario(col, valor);
        } else if (Ui && Ui.esColumnaCatalogoMayus && Ui.esColumnaCatalogoMayus(col)) {
            valor = String(valor || '').trim().toUpperCase();
        }
        f.celdas[col] = valor;
        syncFilaCompras(f);
        f.actualizadoEn = Date.now();
        var idx = idxCols();
        var colTotal = idx.total != null ? idx.total : 8;
        var colBruto = idx.costoBruto != null ? idx.costoBruto : 11;
        var colNeto = idx.costoNeto != null ? idx.costoNeto : 12;
        if (root && (col === idx.stock || col === idx.precio || col === colTotal ||
            col === colBruto || col === colNeto ||
            col === idx.nombre || col === idx.talla || col === idx.color || col === idx.tipo || col === idx.marca)) {
            var td = root.querySelector('[data-compras-total-for="' + f.id + '"] .admin-inv-total');
            if (td) {
                td.textContent = valorCeldaMostrar(f, colTotal, f.celdas[colTotal]) || '';
            }
        }
    }

    function leerValorSelectCompras(selectEl) {
        var Ui = global.ObebeAdminCamposUi;
        if (!selectEl) return '';
        var otroCls = selectEl.getAttribute('data-otro-for');
        var row = selectEl.closest('tr');
        var otro = null;
        if (otroCls && row) otro = row.querySelector('.' + otroCls.split(/\s+/)[0]);
        var col = parseInt(selectEl.getAttribute('data-col'), 10);
        var val = Ui ? Ui.leerSelectOtro(selectEl, otro) : selectEl.value;
        return Ui ? Ui.normalizarValorColumnaInventario(col, val) : String(val || '').trim().toUpperCase();
    }

    function celdaApartadoMarcada(f) {
        if (!f) return false;
        if (f.apartadoManual) return true;
        var raw = String((f.celdas && f.celdas[COL_AB_APARTADO]) || '').trim().toLowerCase();
        if (raw === '1' || raw === 'si' || raw === 'sí' || raw === 'true' || raw === 'x' || raw === 'apartado') {
            return true;
        }
        var aa = String((f.celdas && f.celdas[COL_AA_APARTADO]) || '').trim().toLowerCase();
        return aa === 'apartado';
    }

    function setApartadoManual(f, on) {
        if (!f) return;
        if (!f.celdas) f.celdas = [];
        var i;
        for (i = f.celdas.length; i < 29; i++) f.celdas.push('');
        f.apartadoManual = !!on;
        f.celdas[COL_AB_APARTADO] = on ? '1' : '';
        f.celdas[COL_AA_APARTADO] = on ? 'Apartado' : (etiquetaClienteApartado(f) || '');
    }

    function renderCeldaCompras(f, c, editActivo) {
        if (c === COL_AB_APARTADO) {
            var on = celdaApartadoMarcada(f);
            return '<td class="admin-compras-apartado-td">' +
                '<label class="admin-compras-apartado-check">' +
                '<input type="checkbox" class="admin-compras-apartado-cb" data-id="' + esc(f.id) + '"' +
                (on ? ' checked' : '') + '> Apartado</label></td>';
        }
        if (c === COL_AA_APARTADO) {
            var txtAa = celdaApartadoMarcada(f)
                ? 'Apartado'
                : (etiquetaClienteApartado(f) || String((f.celdas && f.celdas[c]) || ''));
            return '<td><span class="admin-inv-readonly admin-compras-col-cliente-mayoreo">' +
                esc(txtAa) + '</span></td>';
        }
        var Ui = global.ObebeAdminCamposUi;
        var idx = idxCols();
        var val = f.celdas[c] == null ? '' : String(f.celdas[c]);
        var mostrar = valorCeldaMostrar(f, c, val);
        if (Ui && Ui.esColumnaCatalogoMayus && Ui.esColumnaCatalogoMayus(c)) {
            mostrar = Ui.normalizarValorColumnaInventario(c, mostrar);
        }
        if (!editActivo) {
            return '<td><span class="admin-inv-readonly">' + esc(mostrar) + '</span></td>';
        }
        var colTotal = idx.total != null ? idx.total : 8;
        var colMargen = idx.margen != null ? idx.margen : 14;
        var colInversion = idx.inversion != null ? idx.inversion : 13;
        if (c === colTotal || c === colMargen || c === colInversion) {
            return '<td class="admin-inv-total-td" data-compras-total-for="' + esc(f.id) + '">' +
                '<span class="admin-inv-readonly admin-inv-total">' + esc(mostrar) + '</span></td>';
        }
        if (Ui && Ui.htmlCeldaSelectGrid) {
            if (c === idx.talla) {
                return patchHtmlSelectGrid(Ui.htmlCeldaSelectGrid({
                    rowKey: f.id, colIdx: c, lista: Ui.listaTallasCatalogo(), valor: val
                }), f.id);
            }
            if (c === idx.color) {
                return patchHtmlSelectGrid(Ui.htmlCeldaSelectGrid({
                    rowKey: f.id, colIdx: c, lista: Ui.listaColoresCatalogo(todasFilasCatalogo()), valor: val
                }), f.id);
            }
            if (c === idx.tipo) {
                return patchHtmlSelectGrid(Ui.htmlCeldaSelectGrid({
                    rowKey: f.id, colIdx: c, lista: Ui.listaTiposCatalogo(todasFilasCatalogo()), valor: val
                }), f.id);
            }
            if (c === idx.marca) {
                return patchHtmlSelectGrid(Ui.htmlCeldaSelectGrid({
                    rowKey: f.id, colIdx: c, lista: Ui.listaMarcasCatalogo(todasFilasCatalogo()), valor: val
                }), f.id);
            }
        }
        if (Ui && Ui.esColumnaCatalogoMayus && Ui.esColumnaCatalogoMayus(c)) {
            val = Ui.normalizarValorColumnaInventario(c, val);
        }
        var inputVal = esVacioONa(val) ? mostrar : val;
        if (Ui && Ui.esColumnaCatalogoMayus && Ui.esColumnaCatalogoMayus(c)) {
            inputVal = Ui.normalizarValorColumnaInventario(c, inputVal);
        }
        return '<td><input type="text" class="admin-inv-cell admin-compras-cell" data-id="' + esc(f.id) +
            '" data-col="' + c + '" value="' + esc(inputVal) + '"></td>';
    }

    function columnas() {
        return ObebeAdminData.columnasVistaInventario
            ? ObebeAdminData.columnasVistaInventario()
            : [];
    }

    function columnasComprasGrid() {
        var cols = columnas().slice();
        if (cols.indexOf(COL_AA_APARTADO) < 0) cols.push(COL_AA_APARTADO);
        if (cols.indexOf(COL_AB_APARTADO) < 0) cols.push(COL_AB_APARTADO);
        return cols;
    }

    function encabezados() {
        return ObebeAdminData.combinarEncabezadosInventario
            ? ObebeAdminData.combinarEncabezadosInventario([])
            : [];
    }

    function tituloCol(enc, c) {
        if (c === COL_AB_APARTADO) return 'Apartado';
        if (c === COL_AA_APARTADO) return 'Apartado';
        var titulo = (enc[c] || '').trim();
        if (/^(no\.?\s*)?imagen|^ref$|^#$/i.test(titulo)) titulo = 'Ref';
        return titulo;
    }

    function filaApartadaMayoreo(f) {
        return refApartadaEnPedidoMayoreo(refNumeroFila(f));
    }

    function etiquetaClienteApartado(f) {
        var ref = refNumeroFila(f);
        if (!filaApartadaMayoreo(f)) return '';
        if (global.ObebeMayoreoPedidosStore && ObebeMayoreoPedidosStore.etiquetaClienteApartadoRef) {
            return ObebeMayoreoPedidosStore.etiquetaClienteApartadoRef(ref);
        }
        return 'Mayoreo';
    }

    function claseFilaCompras(f) {
        if (celdaApartadoMarcada(f)) return ' class="admin-compras-row--apartado-manual"';
        if (filaApartadaMayoreo(f)) return ' class="admin-compras-row--apartado-mayoreo"';
        if (f.earlyAccess) return ' class="admin-compras-row--early"';
        return '';
    }

    function coincideFiltroCompras(f, q) {
        q = String(q || '').trim().toLowerCase();
        if (!q) return true;
        var blob = (f.celdas || []).join(' ').toLowerCase();
        var tokens = q.split(/\s+/).filter(Boolean);
        if (!tokens.length) return true;
        if (tokens.length === 1) return blob.indexOf(tokens[0]) >= 0;
        return tokens.every(function (t) { return blob.indexOf(t) >= 0; });
    }

    function hayPendientesSinEarly() {
        return filas.some(function (f) { return !f.earlyAccess && !f.enTienda; });
    }

    /** Hay al menos una fila ya enviada a early access (Naty la ve en Pedidos). */
    function hayEarlyAccessEnCompras() {
        return filasActivasEnCompras().some(function (f) {
            return !!f.earlyAccess;
        });
    }

    function hayComprasPendientesEarly() {
        return filasSinEarlyAccess().length > 0;
    }

    function focoBusquedaActivo(root) {
        var a = document.activeElement;
        if (!a || !root || !root.contains(a)) return null;
        if (a.id === 'adminComprasBuscar') {
            return { id: a.id, start: a.selectionStart, end: a.selectionEnd };
        }
        return null;
    }

    function restaurarFocoBusqueda(root, info) {
        if (!info || !root) return;
        var el = root.querySelector('#' + info.id);
        if (!el) return;
        el.focus();
        try {
            if (info.start != null) el.setSelectionRange(info.start, info.end);
        } catch (e) { /* ignore */ }
    }

    function refApartadaEnPedidoMayoreo(ref) {
        if (!ref) return false;
        if (global.ObebeMayoreoPedidosStore && ObebeMayoreoPedidosStore.refApartadaEnMayoreo) {
            return ObebeMayoreoPedidosStore.refApartadaEnMayoreo(ref);
        }
        return false;
    }

    function esFilaTabla1Nuevas(f) {
        if (f.earlyAccess || f.enTienda) return false;
        if (f.earlyAccessSuspendidoPorPedido || f.mayoreoPublicarPendiente) return false;
        var ref = refNumeroFila(f);
        if (refApartadaEnPedidoMayoreo(ref)) return false;
        if (global.ObebeComprasEarlyStore && ObebeComprasEarlyStore.tieneRef(ref)) return false;
        return true;
    }

    function esFilaTabla2Early(f) {
        if (!f.earlyAccess || f.enTienda || f.mayoreoPublicarPendiente) return false;
        var ref = refNumeroFila(f);
        if (refApartadaEnPedidoMayoreo(ref)) return false;
        return true;
    }

    /** Elegidos por cliente mayoreo (early → pedido / columna AA). No se suben a inventario. */
    function filaReservadaMayoreo(f) {
        if (!f || f.enTienda) return false;
        if (f.mayoreoPublicarPendiente || f.earlyAccessSuspendidoPorPedido) return true;
        if (filaApartadaMayoreo(f) || etiquetaClienteApartado(f)) return true;
        return false;
    }

    /**
     * Candidatas a inventario: filas activas en Compras.
     * Las marcadas en AB (Apartado) también suben; no salen en la web.
     * Se excluyen solo las reservadas por pedido mayoreo (aún en flujo Naty).
     */
    function filtrarCandidatasSubirInventario(lista) {
        return (lista || []).filter(function (f) {
            if (!f || f.enTienda) return false;
            if (filaReservadaMayoreo(f) && !celdaApartadoMarcada(f)) return false;
            return true;
        });
    }

    function filasActivasEnCompras() {
        return filas.filter(function (f) { return !f.enTienda; });
    }

    function filasComprasVisibles() {
        return filasActivasEnCompras().filter(function (f) {
            return coincideFiltroCompras(f, filtroCompras);
        });
    }

    function filasYaEnTienda() {
        return filas.filter(function (f) { return f.enTienda; });
    }

    function htmlBuscadorCompras() {
        var ph = 'Buscar en compras…';
        return '<input type="text" class="admin-search admin-compras-zone-search" id="adminComprasBuscar" ' +
            'placeholder="' + esc(ph) + '" value="' + esc(filtroCompras) + '" aria-label="' + esc(ph) + '" autocomplete="off">';
    }

    function refNumeroFila(f) {
        var idx = idxCols();
        return parseInt(f.celdas && f.celdas[idx.imagen != null ? idx.imagen : 0], 10);
    }

    function segmentoCarpetaCompras(f) {
        var ref = refNumeroFila(f);
        if (global.ObebeAdminData && ObebeAdminData.segmentoEtiquetadaRef) {
            return ObebeAdminData.segmentoEtiquetadaRef(ref, f);
        }
        if (global.ObebeAdminData && ObebeAdminData.refEsEtiquetadaMujer && ObebeAdminData.refEsEtiquetadaMujer(ref)) {
            return 'mujer';
        }
        var idx = idxCols();
        var col = idx.segmento != null ? idx.segmento : 19;
        var raw = String((f.celdas && f.celdas[col]) || '').trim();
        if (/mujer/i.test(raw)) return 'mujer';
        return 'hombre';
    }

    function asignarFotoColJ(f) {
        if (!f || !f.celdas || (!f.earlyAccess && !f.enTienda)) return;
        var idx = idxCols();
        var colFoto = idx.foto != null ? idx.foto : COL_FOTO;
        var colRef = idx.imagen != null ? idx.imagen : 0;
        var ref = parseInt(f.celdas[colRef], 10);
        if (isNaN(ref) || ref <= 0) return;
        var seg = segmentoCarpetaCompras(f);
        var colGen = idx.segmento != null ? idx.segmento : 19;
        if (seg === 'mujer') f.celdas[colGen] = 'MUJER';
        var actual = String(f.celdas[colFoto] || '').trim();
        if (/etiquetadas/i.test(actual)) {
            f.celdas[colFoto] = '';
        }
    }

    function filaComprasParaFotos(f) {
        var idx = idxCols();
        var ref = refNumeroFila(f);
        var segRaw = segmentoCarpetaCompras(f);
        return {
            ref: ref,
            nombre: String((f.celdas && f.celdas[idx.nombre != null ? idx.nombre : 4]) || '').trim(),
            marca: String((f.celdas && f.celdas[idx.marca != null ? idx.marca : 8]) || '').trim(),
            segmento: segRaw === 'mujer' ? 'Mujer' : 'Hombre',
            celdas: f.celdas,
            soloComprasEarly: true
        };
    }

    function candidatosFotoCompras(f) {
        var out = [];
        if (global.ObebeAdminData && ObebeAdminData.urlsFotosTiendaObebe) {
            var pack = ObebeAdminData.urlsFotosTiendaObebe(filaComprasParaFotos(f));
            out = (pack.candidatos1 || []).concat(pack.candidatos2 || []);
        }
        var ruta = String((f.celdas && f.celdas[COL_FOTO]) || '').trim();
        if (ruta && ruta !== 'NA' && ruta !== '-' && !/etiquetadas/i.test(ruta)) {
            if (/^https?:/i.test(ruta)) out.push(ruta);
            else if (/^(hombre|mujer)\//i.test(ruta)) out.push('../' + ruta.split('?')[0]);
            else if (ruta.indexOf('compras/') !== 0) out.push('../' + ruta);
        }
        return out.filter(function (u, i, a) { return u && a.indexOf(u) === i; });
    }

    function srcFoto(f) {
        var cands = candidatosFotoCompras(f);
        return cands[0] || '';
    }

    function htmlFoto(f) {
        var cands = candidatosFotoCompras(f);
        if (!cands.length) return '<span class="admin-mayoreo-thumb-empty admin-inv-thumb"></span>';
        return '<img src="' + esc(cands[0]) + '" alt="" class="admin-inv-thumb" loading="lazy" ' +
            'data-candidate-step="0" data-candidates="' + esc(cands.join('|')) + '" ' +
            'onerror="typeof adminMayoreoImgFallback===\'function\'&&adminMayoreoImgFallback(this)">';
    }

    function textoConteoCompras(lista) {
        lista = lista || filasActivasEnCompras();
        var n = lista.length;
        var pzas = 0;
        var apart = 0;
        lista.forEach(function (f) {
            pzas += numCelda(f.celdas && f.celdas[2]);
            if (filaApartadaMayoreo(f)) apart += 1;
        });
        var extra = apart ? ' · ' + apart + ' apartado(s) mayoreo' : '';
        return n + ' en Compras · ' + pzas + ' pzas' + extra;
    }

    function celdaExcel(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function exportarExcelCompras(list) {
        prepararFilasParaVista();
        var cols = columnasComprasGrid();
        var enc = encabezados();
        list = list || filasActivasEnCompras();
        if (!list.length) {
            aviso = 'No hay filas en esta tabla para exportar.';
            return false;
        }
        var th = cols.map(function (c) {
            return '<th>' + celdaExcel(tituloCol(enc, c)) + '</th>';
        }).join('');
        var body = list.map(function (f) {
            var tds = cols.map(function (c) {
                var raw = f.celdas && f.celdas[c] != null ? f.celdas[c] : '';
                var val = valorCeldaMostrar(f, c, raw);
                if (c === COL_FOTO) val = srcFoto(f) || val;
                if (c === COL_CLIENTE_MAYOREO) val = etiquetaClienteApartado(f);
                return '<td>' + celdaExcel(val) + '</td>';
            }).join('');
            return '<tr>' + tds + '</tr>';
        }).join('');
        var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
            'xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
            '<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook>' +
            '<x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Compras</x:Name>' +
            '<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>' +
            '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->' +
            '</head><body><table border="1"><thead><tr>' + th + '</tr></thead><tbody>' +
            body + '</tbody></table></body></html>';
        var blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        var d = new Date();
        var stamp = d.getFullYear() +
            String(d.getMonth() + 1).padStart(2, '0') +
            String(d.getDate()).padStart(2, '0') + '-' +
            String(d.getHours()).padStart(2, '0') +
            String(d.getMinutes()).padStart(2, '0');
        a.href = url;
        a.download = 'compras-obebe-' + stamp + '.xls';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        aviso = 'Excel exportado: ' + list.length + ' fila(s).';
        return true;
    }

    function renderToolbar() {
        var editLabel = editandoZona === ZONA_COMPRAS ? 'Editando compras' : 'Pedidos en camino';
        return '<div class="admin-inv-toolbar">' +
            '<span class="admin-inv-modo' + (editandoZona ? ' admin-inv-modo-edit' : '') + '">' + esc(editLabel) + '</span>' +
            '</div>' +
            (aviso ? '<p class="admin-banner">' + esc(aviso) + '</p>' : '');
    }

    function botonComprasEarlyAccess() {
        return '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact admin-compras-early">Subir a early access</button>';
    }

    function botonExportarCompras() {
        return '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-compras-excel">Exportar Excel</button>';
    }

    function botonSubirInventario() {
        return '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-compras-subir-inv">Subir a inventario</button>';
    }

    function botonesComprasExtrasEarly() {
        return '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-compras-quitar-early">Quitar early access</button>';
    }

    function renderComprasToolbar() {
        var on = editandoZona === ZONA_COMPRAS;
        var btnEarly = hayComprasPendientesEarly() ? botonComprasEarlyAccess() : '';
        var btnSubir = filasActivasEnCompras().length ? botonSubirInventario() : '';
        var postEarly = hayEarlyAccessEnCompras() ? botonesComprasExtrasEarly() : '';
        if (on) {
            return '<div class="admin-compras-zone-toolbar admin-compras-zone-toolbar--edit">' +
                '<div class="admin-compras-zone-toolbar-grp admin-compras-zone-toolbar-grp--izq">' +
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-compras-add-row">+ Fila</button>' +
                btnEarly +
                '<button type="button" class="admin-btn admin-btn-danger admin-btn-compact admin-compras-borrar">Eliminar</button>' +
                '</div>' +
                '<div class="admin-compras-zone-toolbar-grp admin-compras-zone-toolbar-grp--der">' +
                btnSubir + postEarly + botonExportarCompras() +
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact" id="adminComprasCancelar">Cancelar</button>' +
                '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact" id="adminComprasGuardar">Guardar</button>' +
                '</div></div>';
        }
        return '<div class="admin-compras-zone-toolbar admin-compras-zone-toolbar--vista">' +
            '<div class="admin-compras-zone-toolbar-grp admin-compras-zone-toolbar-grp--izq">' +
            '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact" id="adminComprasEditar">Editar</button>' +
            btnEarly +
            '</div>' +
            '<div class="admin-compras-zone-toolbar-grp admin-compras-zone-toolbar-grp--der">' +
            btnSubir + postEarly + botonExportarCompras() +
            '</div></div>';
    }

    function renderGridTabla(list, opts) {
        opts = opts || {};
        var editActivo = editandoZona === ZONA_COMPRAS;
        var cols = columnasComprasGrid();
        var enc = encabezados();
        var thLetters = '';
        var thSheet = '';
        cols.forEach(function (c) {
            var letra = c === COL_AA_APARTADO ? 'AA'
                : (c === COL_AB_APARTADO ? 'AB' : ObebeAdminData.colLetter(c));
            thLetters += '<th class="admin-inv-th-letter">' + esc(letra) + '</th>';
            thSheet += '<th class="admin-inv-th-title">' + esc(tituloCol(enc, c)) + '</th>';
        });
        var sel = editActivo ? '<th class="admin-inv-sel"></th>' : '';
        var head = '<tr class="admin-inv-head-letters">' + sel + '<th class="admin-inv-row">#</th>' + thLetters + '</tr>' +
            '<tr class="admin-inv-head-sheet">' + sel + '<th class="admin-inv-row"></th>' + thSheet + '</tr>';
        var vacio = opts.emptyMsg || 'Sin filas.';
        var body = (list || []).map(function (f, i) {
            var check = editActivo
                ? '<td class="admin-inv-sel"><input type="checkbox" class="admin-compras-sel" data-id="' + esc(f.id) + '"></td>'
                : '';
            var tds = cols.map(function (c) {
                if (c === COL_FOTO) {
                    return '<td class="admin-inv-thumb-cell">' + htmlFoto(f) + '</td>';
                }
                return renderCeldaCompras(f, c, editActivo);
            }).join('');
            return '<tr' + claseFilaCompras(f) + '>' + check + '<td class="admin-inv-row">' + (i + 1) + '</td>' + tds + '</tr>';
        }).join('');
        if (!body) {
            body = '<tr><td colspan="' + (cols.length + 2) + '">' + esc(vacio) + '</td></tr>';
        }
        var titulo = '<div class="admin-compras-section-head"><h3 class="admin-compras-section-title">Compras</h3>' +
            '<p class="admin-muted-text admin-inv-stock-count">' + esc(textoConteoCompras(filasActivasEnCompras())) + '</p>' +
            '<div class="admin-compras-section-search">' + htmlBuscadorCompras() + '</div>' +
            renderComprasToolbar() + '</div>';
        return '<section class="admin-compras-section" id="adminComprasMain">' + titulo +
            '<div class="admin-inv-scroll' + (editActivo ? ' admin-inv-scroll--edit' : '') + '">' +
            '<table class="admin-table admin-inv-grid"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div></section>';
    }

    function renderAllGrids() {
        return '<div class="admin-compras-grids">' + renderGridTabla(filasComprasVisibles(), {
            emptyMsg: 'No hay compras pendientes. Corre el script de detección o usa + Fila en Editar.'
        }) + '</div>';
    }

    function pintar(root) {
        var foco = focoBusquedaActivo(root);
        prepararFilasParaVista();
        root.innerHTML = '<div class="admin-inv-wrap admin-compras-wrap">' + renderToolbar() + renderAllGrids() + '</div>';
        bind(root);
        restaurarFocoBusqueda(root, foco);
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
                filtroCompras = buscar.value || '';
                pintar(root);
            });
        }
        root.querySelectorAll('.admin-compras-excel').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var list = filasActivasEnCompras();
                var n = list.length;
                if (!n || !global.ObebeAdminDialog) {
                    if (!n) {
                        aviso = 'No hay filas en Compras para exportar.';
                        pintar(root);
                    }
                    return;
                }
                ObebeAdminDialog.confirm({
                    title: '¿Exportar Excel?',
                    message: 'Se descargará un Excel con todas las compras activas (' + n + ' fila(s)).',
                    confirmText: 'Sí, exportar',
                    cancelText: 'Cancelar',
                    confirmSuccess: true
                }).then(function (ok) {
                    if (!ok) return;
                    exportarExcelCompras(list);
                    pintar(root);
                    setTimeout(function () {
                        if (aviso.indexOf('Excel exportado') === 0) {
                            aviso = '';
                            pintar(root);
                        }
                    }, 5000);
                });
            });
        });
        root.querySelectorAll('.admin-compras-early').forEach(function (btn) {
            btn.addEventListener('click', function () { earlyAccessNaty(root); });
        });
        root.querySelectorAll('.admin-compras-quitar-early').forEach(function (btn) {
            btn.addEventListener('click', function () { quitarEarlyAccessNaty(root); });
        });
        root.querySelectorAll('.admin-compras-subir-inv').forEach(function (btn) {
            btn.addEventListener('click', function () {
                subirComprasAInventario(root);
            });
        });
        var edit = root.querySelector('#adminComprasEditar');
        if (edit) edit.addEventListener('click', function () {
            editandoZona = ZONA_COMPRAS;
            pintar(root);
        });
        function cancelarEdicion() {
            editandoZona = null;
            filas = ObebeComprasStore.getAll();
            pintar(root);
        }
        var canc = root.querySelector('#adminComprasCancelar');
        if (canc) canc.addEventListener('click', cancelarEdicion);
        function guardarEdicion() {
            filas.forEach(function (f) { syncFilaCompras(f); f.actualizadoEn = Date.now(); });
            persistir();
            editandoZona = null;
            pintar(root);
        }
        var guard = root.querySelector('#adminComprasGuardar');
        if (guard) guard.addEventListener('click', guardarEdicion);
        root.querySelectorAll('.admin-compras-add-row').forEach(function (addRow) {
            addRow.addEventListener('click', function () {
                var idx = idxCols();
                var vacia = [];
                var i;
                for (i = 0; i < 29; i++) vacia.push('');
                vacia[idx.imagen != null ? idx.imagen : 0] = String(siguienteRefCompras());
                vacia[idx.stock != null ? idx.stock : 2] = '1';
                var nueva = {
                    id: 'com-man-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                    celdas: vacia,
                    actualizadoEn: Date.now()
                };
                filas.push(nueva);
                persistir();
                pintar(root);
            });
        });
        root.querySelectorAll('.admin-compras-borrar').forEach(function (borrar) {
            borrar.addEventListener('click', function () {
                var section = root.querySelector('#adminComprasMain');
                var scope = section || root;
                var ids = {};
                scope.querySelectorAll('.admin-compras-sel:checked').forEach(function (cb) {
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
        });
        bindCeldas(root);
    }

    function bindCeldas(root) {
        if (editandoZona && global.ObebeAdminCamposUi) {
            ObebeAdminCamposUi.bindSelectOtros(root);
        }
        root.querySelectorAll('.admin-compras-apartado-cb').forEach(function (cb) {
            if (cb._comprasApartadoBound) return;
            cb._comprasApartadoBound = true;
            cb.addEventListener('change', function () {
                var f = filaPorId(cb.getAttribute('data-id'));
                if (!f) return;
                setApartadoManual(f, !!cb.checked);
                f.actualizadoEn = Date.now();
                persistir();
                pintar(root);
            });
        });
        root.querySelectorAll('.admin-compras-cell').forEach(function (input) {
            if (input._comprasBound) return;
            input._comprasBound = true;
            input.addEventListener('change', function () {
                var f = filaPorId(input.getAttribute('data-id'));
                var col = parseInt(input.getAttribute('data-col'), 10);
                if (!f || isNaN(col)) return;
                aplicarCambioCompras(root, f, col, input.value);
            });
        });
        root.querySelectorAll('.admin-compras-cell-select').forEach(function (sel) {
            if (sel._comprasBound) return;
            sel._comprasBound = true;
            sel.addEventListener('change', function () {
                if (global.ObebeAdminCamposUi) {
                    ObebeAdminCamposUi.toggleOtroInput(sel);
                    if (sel.value === ObebeAdminCamposUi.OTRO) ObebeAdminCamposUi.enfocarInputOtro(sel);
                }
                var f = filaPorId(sel.getAttribute('data-id'));
                var col = parseInt(sel.getAttribute('data-col'), 10);
                if (!f || isNaN(col)) return;
                aplicarCambioCompras(root, f, col, leerValorSelectCompras(sel));
            });
        });
        root.querySelectorAll('.admin-compras-cell-otro').forEach(function (inp) {
            if (inp._comprasBound) return;
            inp._comprasBound = true;
            inp.addEventListener('change', function () {
                var row = inp.closest('tr');
                var col = parseInt(inp.getAttribute('data-col'), 10);
                var sel = row ? row.querySelector('.admin-compras-cell-select[data-col="' + col + '"]') : null;
                var f = filaPorId(inp.getAttribute('data-id'));
                if (!f || !sel) return;
                aplicarCambioCompras(root, f, col, leerValorSelectCompras(sel));
            });
        });
    }

    function celdasParaInventario(fila) {
        var celdas = (fila.celdas || []).slice();
        var i;
        for (i = celdas.length; i < 29; i++) celdas.push('');
        var foto = String(celdas[9] || '');
        if (foto.indexOf('compras/') === 0) celdas[9] = '';
        if (celdaApartadoMarcada(fila)) {
            celdas[COL_AA_APARTADO] = 'Apartado';
            celdas[COL_AB_APARTADO] = '1';
            var idxCarr = idxCols();
            if (idxCarr.carrusel != null) celdas[idxCarr.carrusel] = '';
        }
        return celdas;
    }

    function celdasParaInventarioEarly(fila) {
        var celdas = (fila.celdas || []).slice();
        var i;
        for (i = celdas.length; i < 29; i++) celdas.push('');
        var idx = idxCols();
        if (idx.carrusel != null && celdas[idx.carrusel] != null) celdas[idx.carrusel] = '';
        if (idx.ofertaSemanal != null && celdas[idx.ofertaSemanal] != null) {
            celdas[idx.ofertaSemanal] = '';
        }
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

    function filasSinEarlyAccess() {
        return filas.filter(function (f) {
            return esFilaTabla1Nuevas(f);
        });
    }

    function refsDesdeLista(list) {
        var col = idxCols().imagen != null ? idxCols().imagen : 0;
        var out = [];
        (list || []).forEach(function (f) {
            var r = parseInt(f.celdas && f.celdas[col], 10);
            if (!isNaN(r) && r > 0) out.push(r);
        });
        return out;
    }

    function filasComprasMarcadasSubidas() {
        var sub = filas.filter(function (f) { return f.enTienda || f.earlyAccess; });
        return sub.length ? sub : filas.slice();
    }

    function idsInventarioPorRefsCompras(refs, filasInv) {
        if (global.ObebeAdminData && ObebeAdminData.idsBorrarInventarioPorRefs) {
            return ObebeAdminData.idsBorrarInventarioPorRefs(refs, filasInv);
        }
        return [];
    }

    function ejecutarBorradoInventarioCompras(root, ids, refs) {
        var refsSet = {};
        (refs || []).forEach(function (r) { refsSet[String(r)] = true; });
        subiendo = true;
        aviso = 'Borrando del inventario…';
        pintar(root);
        return ObebeAdminBackend.callAdminApi('deleteRows', { filas: ids }).then(function (res) {
            if (res && res.ok === false) {
                throw new Error(res.error || 'No se pudo borrar del inventario');
            }
            filas.forEach(function (f) {
                var col = idxCols().imagen != null ? idxCols().imagen : 0;
                var r = parseInt(f.celdas && f.celdas[col], 10);
                if (!isNaN(r) && refsSet[String(r)]) {
                    f.earlyAccess = false;
                    f.earlyAccessEn = null;
                    f.enTienda = false;
                    f.enTiendaEn = null;
                }
            });
            if (global.ObebeComprasEarlyStore) {
                ObebeComprasEarlyStore.quitarRefs(refs);
            }
            persistir();
            aviso = 'Se quitaron ' + ids.length + ' fila(s) del inventario. Solo siguen en Compras.';
            document.dispatchEvent(new CustomEvent('obebe-compras-a-inventario'));
        }).catch(function (err) {
            aviso = (err && err.message) || 'No se pudo quitar del inventario.';
        }).then(function () {
            subiendo = false;
            pintar(root);
        });
    }

    function inventarioFilasParaBuscar() {
        var st = global.ObebeAdminData && ObebeAdminData.getEstado ? ObebeAdminData.getEstado() : null;
        return (st && st.filas) || [];
    }

    function resolverFilasInventarioParaBorrado() {
        var inv = inventarioFilasParaBuscar();
        if (inv.length) return Promise.resolve(inv);
        if (global.ObebeAdminData && ObebeAdminData.cargarInventario) {
            return ObebeAdminData.cargarInventario(true).then(function (pack) {
                return (pack && pack.filas) || [];
            });
        }
        return Promise.resolve([]);
    }

    /** Ya no se ofrece borrar inventario al abrir Compras (causaba pérdida accidental). */
    function ofrecerLimpiarInventarioDuplicado() {
        return Promise.resolve();
    }

    var KEY_QUITAR_VERDE_TODO = 'obebe_compras_quitar_verde_todo_20261127g';

    /** Por ahora: quita todo el early access (verde) de Compras. */
    function desmarcarTodoVerdeEarlyAccess(root) {
        try {
            if (localStorage.getItem(KEY_QUITAR_VERDE_TODO)) {
                return Promise.resolve({ ok: true, omitido: true });
            }
        } catch (e0) { /* ignore */ }
        var n = 0;
        var refs = [];
        filas.forEach(function (f) {
            if (!f || f.enTienda) return;
            if (f.earlyAccess || f.earlyAccessEn) n += 1;
            f.earlyAccess = false;
            f.earlyAccessEn = null;
            f.earlyAccessSuspendidoPorPedido = !!f.earlyAccessSuspendidoPorPedido;
            var r = refNumeroFila(f);
            if (!isNaN(r) && r > 0) refs.push(r);
        });
        if (global.ObebeComprasEarlyStore) {
            if (ObebeComprasEarlyStore.reemplazarRefs) ObebeComprasEarlyStore.reemplazarRefs([]);
            else if (refs.length) ObebeComprasEarlyStore.quitarRefs(refs);
        }
        persistir();
        try { localStorage.setItem(KEY_QUITAR_VERDE_TODO, String(Date.now())); } catch (e1) { /* */ }
        try { localStorage.setItem('obebe_compras_reparo_verdes_undo_20261127c', 'replaced'); } catch (e2) { /* */ }
        aviso = n
            ? 'Se quitó el marcado verde (early access) de Compras. Usa la casilla AB · Apartado si aplica.'
            : '';
        document.dispatchEvent(new CustomEvent('obebe-compras-early-access'));
        pintar(root);
        return Promise.resolve({ ok: true, n: n });
    }

    function quitarDelInventario(root, listaFilas) {
        if (subiendo || !filas.length || !global.ObebeAdminBackend || !global.ObebeAdminDialog) return;
        listaFilas = listaFilas && listaFilas.length ? listaFilas : filas;
        var refs = refsDesdeLista(listaFilas);
        if (!refs.length) {
            aviso = 'No hay refs en Compras.';
            pintar(root);
            return;
        }
        resolverFilasInventarioParaBorrado().then(function (filasInv) {
            var ids = idsInventarioPorRefsCompras(refs, filasInv);
            if (!ids.length) {
                return;
            }
            ObebeAdminDialog.confirm({
                title: '¿Quitar del inventario?',
                message: 'Se borran ' + ids.length + ' fila(s) del inventario. Siguen solo en Compras.',
                confirmText: 'Borrar del inventario',
                cancelText: 'Cancelar',
                variant: 'danger'
            }).then(function (ok) {
                if (!ok) return;
                ejecutarBorradoInventarioCompras(root, ids, refs);
            });
        });
    }

    function marcarComprasPublicadasEnTienda(subset) {
        var ids = {};
        (subset || []).forEach(function (f) { ids[f.id] = true; });
        var refs = [];
        var n = 0;
        filas = filas.filter(function (f) {
            if (!ids[f.id]) return true;
            n += 1;
            var idx = idxCols();
            var col = idx.imagen != null ? idx.imagen : 0;
            var r = parseInt(f.celdas && f.celdas[col], 10);
            if (!isNaN(r) && r > 0) refs.push(r);
            return false;
        });
        if (global.ObebeComprasEarlyStore && refs.length) {
            ObebeComprasEarlyStore.quitarRefs(refs);
        }
        persistir();
        editandoZona = null;
        aviso = 'Se publicaron ' + n + ' artículo(s) en inventario. Salieron de Compras.';
        document.dispatchEvent(new CustomEvent('obebe-compras-a-inventario'));
    }

    function quitarEarlyAccessNaty(root) {
        if (subiendo || !global.ObebeAdminDialog) return;
        var activas = filas.filter(function (f) { return f.earlyAccess && !f.enTienda; });
        if (!activas.length) {
            aviso = 'No hay filas con early access.';
            pintar(root);
            return;
        }
        var n = activas.length;
        ObebeAdminDialog.confirm({
            title: '¿Quitar early access?',
            message: 'Naty dejará de ver ' + n + ' artículo(s) en Pedidos (filtro Early access). Volverán a la tabla de pendientes. Las fotos en columna J se conservan.',
            confirmText: 'Sí, quitar early access',
            cancelText: 'Cancelar',
            cancelDanger: true,
            confirmSuccess: true
        }).then(function (ok) {
            if (!ok) return;
            var refs = global.ObebeComprasEarlyStore
                ? ObebeComprasEarlyStore.refsDesdeFilas(activas)
                : [];
            var ids = {};
            activas.forEach(function (f) { ids[f.id] = true; });
            filas.forEach(function (f) {
                if (ids[f.id]) {
                    f.earlyAccess = false;
                    f.earlyAccessEn = null;
                }
            });
            if (global.ObebeComprasEarlyStore && refs.length) {
                ObebeComprasEarlyStore.quitarRefs(refs);
            }
            persistir();
            aviso = 'Early access quitado en ' + n + ' artículo(s).';
            document.dispatchEvent(new CustomEvent('obebe-compras-early-access'));
            pintar(root);
        });
    }

    function earlyAccessNaty(root) {
        if (subiendo || !filas.length || !global.ObebeAdminDialog || !global.ObebeAdminBackend) return;
        var pendientes = filasSinEarlyAccess();
        if (!pendientes.length) {
            aviso = 'Todos los artículos de Compras ya tienen early access.';
            pintar(root);
            return;
        }
        var n = pendientes.length;
        ObebeAdminDialog.confirm({
            title: '¿Early access para Naty?',
            message: 'Naty verá ' + n + ' artículo(s) en Pedidos (early access) sin publicarlos en la web. No se suben al inventario hasta Subir a inventario. Se llenan fotos en columna J y se marcan en verde en esta tabla.',
            confirmText: 'Sí, activar early access',
            cancelText: 'Cancelar',
            variant: 'ok',
            cancelDanger: true,
            confirmSuccess: true
        }).then(function (ok) {
            if (!ok) return;
            aviso = '';
            var refs = global.ObebeComprasEarlyStore
                ? ObebeComprasEarlyStore.refsDesdeFilas(pendientes)
                : [];
            var t = Date.now();
            var ids = {};
            pendientes.forEach(function (f) { ids[f.id] = true; });
            filas.forEach(function (f) {
                if (ids[f.id]) {
                    f.earlyAccess = true;
                    f.earlyAccessEn = t;
                    asignarFotoColJ(f);
                }
            });
            if (global.ObebeComprasEarlyStore && refs.length) {
                ObebeComprasEarlyStore.marcarRefs(refs);
            }
            persistir();
            aviso = 'Early access activo para ' + n + ' artículo(s). Naty ya puede pedirlos en Pedidos.';
            document.dispatchEvent(new CustomEvent('obebe-compras-early-access'));
            subiendo = false;
            pintar(root);
        });
    }

    function subirComprasAInventario(root) {
        if (subiendo || !global.ObebeAdminDialog || !global.ObebeAdminBackend) return;
        var candidatas = filtrarCandidatasSubirInventario(filasActivasEnCompras());
        if (!candidatas.length) {
            aviso = 'No hay artículos en Compras para subir a inventario.';
            pintar(root);
            return;
        }
        var n = candidatas.length;
        var nApart = candidatas.filter(celdaApartadoMarcada).length;
        var msg = 'Se publican ' + n + ' artículo(s) en inventario y salen de Compras.';
        if (nApart) {
            msg += ' ' + nApart + ' marcado(s) como Apartado (columna AB): entran al stock con AA = «Apartado» y no aparecen en la página web.';
        }
        ObebeAdminDialog.confirm({
            title: '¿Subir a inventario?',
            message: msg,
            confirmText: 'Sí, subir',
            cancelText: 'Cancelar',
            variant: 'ok',
            cancelDanger: true,
            confirmSuccess: true
        }).then(function (ok) {
            if (!ok) return;
            subiendo = true;
            aviso = '';
            var payload = candidatas.map(function (f) {
                return { celdas: celdasParaInventario(f) };
            });
            pintar(root);
            enviarAlInventario(payload).then(function () {
                marcarComprasPublicadasEnTienda(candidatas);
                pintar(root);
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

    function refsParaRecuperarCompras() {
        var refs = [];
        var map = global.ObebeComprasEarlyStore ? ObebeComprasEarlyStore.leerTodos() : {};
        refs = Object.keys(map || {});
        if (refs.length) return refs;
        var det = global.OBEBE_COMPRAS_DETECTADAS || [];
        var col = idxCols().imagen != null ? idxCols().imagen : 0;
        det.forEach(function (row) {
            var c = row.celdas || row;
            var r = parseInt(c[col], 10);
            if (!isNaN(r) && r > 0) refs.push(String(r));
        });
        return refs.filter(function (v, i, a) { return a.indexOf(v) === i; });
    }

    function recuperarComprasDesdeInventario() {
        if (filas.length) return Promise.resolve(false);
        var refsBuscar = refsParaRecuperarCompras();
        if (!refsBuscar.length) return Promise.resolve(false);

        function construirDesdeFilasInv(stFilas) {
            if (!stFilas || !stFilas.length) return false;
            var colRef = idxCols().imagen != null ? idxCols().imagen : 0;
            var byRef = {};
            stFilas.forEach(function (f) {
                var r = f.ref || parseInt(f.celdas && f.celdas[colRef], 10);
                if (!isNaN(r) && r > 0) byRef[String(r)] = f;
            });
            var nuevas = [];
            refsBuscar.forEach(function (refStr) {
                var inv = byRef[refStr];
                if (!inv) return;
                var celdas = (inv.celdas || []).slice();
                var i;
                for (i = celdas.length; i < 29; i++) celdas.push('');
                nuevas.push({
                    celdas: celdas,
                    enTienda: true,
                    enTiendaEn: Date.now(),
                    earlyAccess: false
                });
            });
            if (!nuevas.length) return false;
            if (global.ObebeComprasStore) {
                filas = ObebeComprasStore.reemplazar(nuevas);
            } else {
                filas = nuevas;
            }
            if (global.ObebeComprasEarlyStore) {
                ObebeComprasEarlyStore.quitarRefs(refsBuscar);
            }
            aviso = 'Se recuperaron ' + nuevas.length + ' artículo(s) en Compras (ya en inventario/tienda).';
            return true;
        }

        var st = global.ObebeAdminData && ObebeAdminData.getEstado ? ObebeAdminData.getEstado() : null;
        if (st && st.filas && st.filas.length) {
            return Promise.resolve(construirDesdeFilasInv(st.filas));
        }
        if (global.ObebeAdminData && ObebeAdminData.cargarInventario) {
            return ObebeAdminData.cargarInventario(false).then(function (inv) {
                return construirDesdeFilasInv(inv && inv.filas);
            });
        }
        return Promise.resolve(false);
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
                recuperarComprasDesdeInventario().then(function () {
                    if (sesion !== mountSesion || !container) return;
                    pintar(container);
                    return desmarcarTodoVerdeEarlyAccess(container);
                });
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
