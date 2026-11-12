(function (global) {
    'use strict';

    var COL_FOTO = 9;
    var filas = [];
    var filtroPendiente = '';
    var filtroEarly = '';
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

    function renderCeldaCompras(f, c, editActivo) {
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

    function focoBusquedaActivo(root) {
        var a = document.activeElement;
        if (!a || !root || !root.contains(a)) return null;
        if (a.id === 'adminComprasBuscarPend' || a.id === 'adminComprasBuscarEarly') {
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

    function visibles() {
        return filas.filter(function (f) {
            if (f.enTienda) return false;
            if (f.earlyAccess) return coincideFiltroCompras(f, filtroEarly);
            return coincideFiltroCompras(f, filtroPendiente);
        });
    }

    function filasPendientesConfirmar() {
        return filas.filter(function (f) {
            return !f.earlyAccess && !f.enTienda && coincideFiltroCompras(f, filtroPendiente);
        });
    }

    function filasEarlyConfirmadas() {
        return filas.filter(function (f) {
            return f.earlyAccess && !f.enTienda && coincideFiltroCompras(f, filtroEarly);
        });
    }

    function filasYaEnTienda() {
        return filas.filter(function (f) { return f.enTienda; });
    }

    function htmlBuscadorZona(zona) {
        var id = zona === 'early' ? 'adminComprasBuscarEarly' : 'adminComprasBuscarPend';
        var val = zona === 'early' ? filtroEarly : filtroPendiente;
        var ph = zona === 'early' ? 'Buscar en tabla 2…' : 'Buscar en tabla 1…';
        return '<input type="text" class="admin-search admin-compras-zone-search" id="' + id + '" ' +
            'placeholder="' + esc(ph) + '" value="' + esc(val) + '" aria-label="' + esc(ph) + '" autocomplete="off">';
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

    function filasZonaSinFiltro(zona) {
        return filas.filter(function (f) {
            if (f.enTienda) return false;
            return zona === 'early' ? !!f.earlyAccess : !f.earlyAccess;
        });
    }

    function textoConteoZona(zona) {
        var lista = filasZonaSinFiltro(zona);
        var n = lista.length;
        var pzas = 0;
        lista.forEach(function (f) {
            pzas += numCelda(f.celdas && f.celdas[2]);
        });
        var tabLbl = zona === 'early' ? 'tabla 2' : 'tabla 1';
        return n + ' en Compras · ' + pzas + ' pzas · ' + n + ' ' + tabLbl;
    }

    function celdaExcel(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function exportarExcelZona(zona, list) {
        prepararFilasParaVista();
        var cols = columnas();
        var enc = encabezados();
        list = list || filasZonaSinFiltro(zona);
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
        var slug = zona === 'early' ? 'tabla2-early' : 'tabla1-nuevas';
        a.download = 'compras-obebe-' + slug + '-' + stamp + '.xls';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        aviso = 'Excel exportado (' + (zona === 'early' ? 'tabla 2' : 'tabla 1') + '): ' + list.length + ' fila(s).';
        return true;
    }

    function renderToolbar() {
        var editLabel = editandoZona === 'pendiente' ? 'Editando tabla 1'
            : (editandoZona === 'early' ? 'Editando tabla 2' : 'Pedidos en camino');
        return '<div class="admin-inv-toolbar">' +
            '<span class="admin-inv-modo' + (editandoZona ? ' admin-inv-modo-edit' : '') + '">' + esc(editLabel) + '</span>' +
            '</div>' +
            (aviso ? '<p class="admin-banner">' + esc(aviso) + '</p>' : '');
    }

    function botonComprasEarlyAccess(zona) {
        return '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact admin-compras-early" data-zona="' +
            esc(zona || 'pendiente') + '">Subir a early access</button>';
    }

    function botonExportarZona(zona) {
        return '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-compras-excel" data-zona="' +
            esc(zona) + '">Exportar Excel</button>';
    }

    function botonSubirInventario(zona) {
        return '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-compras-subir-inv" data-zona="' +
            esc(zona) + '">Subir a inventario</button>';
    }

    function botonesComprasBaseEdicion(zona) {
        var earlyBtn = zona === 'early' ? '' : botonComprasEarlyAccess('pendiente');
        return '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-compras-add-row" data-zona="' + esc(zona) + '">+ Fila</button>' +
            earlyBtn +
            '<button type="button" class="admin-btn admin-btn-danger admin-btn-compact admin-compras-borrar" data-zona="' + esc(zona) + '">Eliminar</button>';
    }

    function botonesComprasBaseVista(zona) {
        var earlyBtn = zona === 'pendiente' ? botonComprasEarlyAccess('pendiente') : '';
        return earlyBtn + botonSubirInventario(zona) + botonExportarZona(zona);
    }

    function botonesComprasExtrasEarly() {
        return '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-compras-quitar-early">Quitar early access</button>';
    }

    function botonesComprasGuardarCancelar(zona) {
        if (zona === 'early') {
            return '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact" id="adminComprasCancelarEarly">Cancelar</button>' +
                '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact" id="adminComprasGuardarEarly">Guardar</button>';
        }
        return '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact" id="adminComprasCancelarPend">Cancelar</button>' +
            '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact" id="adminComprasGuardarPend">Guardar</button>';
    }

    function botonEditarZona(zona) {
        var id = zona === 'early' ? 'adminComprasEditarEarly' : 'adminComprasEditarPend';
        return '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact" id="' + id + '">Editar</button>';
    }

    function renderZonaToolbar(zona) {
        var on = editandoZona === zona;
        var extraEarly = zona === 'early' ? botonesComprasExtrasEarly() : '';
        if (on) {
            return '<div class="admin-compras-zone-toolbar admin-compras-zone-toolbar--edit">' +
                '<div class="admin-compras-zone-toolbar-grp admin-compras-zone-toolbar-grp--izq">' +
                botonesComprasBaseEdicion(zona) +
                '</div>' +
                '<div class="admin-compras-zone-toolbar-grp admin-compras-zone-toolbar-grp--der">' +
                botonSubirInventario(zona) + botonExportarZona(zona) + extraEarly + botonesComprasGuardarCancelar(zona) +
                '</div></div>';
        }
        var earlyVista = zona === 'pendiente' ? botonComprasEarlyAccess('pendiente') : '';
        return '<div class="admin-compras-zone-toolbar admin-compras-zone-toolbar--vista">' +
            '<div class="admin-compras-zone-toolbar-grp admin-compras-zone-toolbar-grp--izq">' +
            botonEditarZona(zona) + earlyVista +
            '</div>' +
            '<div class="admin-compras-zone-toolbar-grp admin-compras-zone-toolbar-grp--der">' +
            botonSubirInventario(zona) + botonExportarZona(zona) + extraEarly +
            '</div></div>';
    }

    function renderGridTabla(list, opts) {
        opts = opts || {};
        var zona = opts.zona || 'pendiente';
        var editActivo = editandoZona === zona;
        var cols = columnas();
        var enc = encabezados();
        var thLetters = '';
        var thSheet = '';
        cols.forEach(function (c) {
            thLetters += '<th class="admin-inv-th-letter">' + esc(ObebeAdminData.colLetter(c)) + '</th>';
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
            var trCls = f.earlyAccess ? ' class="admin-compras-row--early"' : '';
            return '<tr' + trCls + '>' + check + '<td class="admin-inv-row">' + (i + 1) + '</td>' + tds + '</tr>';
        }).join('');
        if (!body) {
            body = '<tr><td colspan="' + (cols.length + 2) + '">' + esc(vacio) + '</td></tr>';
        }
        var titulo = opts.titulo
            ? '<div class="admin-compras-section-head"><h3 class="admin-compras-section-title">' + esc(opts.titulo) +
              '</h3><p class="admin-muted-text admin-inv-stock-count">' + esc(textoConteoZona(zona)) + '</p>' +
              '<div class="admin-compras-section-search">' + htmlBuscadorZona(zona) + '</div>' +
              renderZonaToolbar(zona) + '</div>'
            : renderZonaToolbar(zona);
        return '<section class="admin-compras-section"' + (opts.sectionId ? ' id="' + esc(opts.sectionId) + '"' : '') + '>' +
            titulo +
            '<div class="admin-inv-scroll' + (editActivo ? ' admin-inv-scroll--edit' : '') + '">' +
            '<table class="admin-table admin-inv-grid"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div></section>';
    }

    function renderAllGrids() {
        var pend = filasPendientesConfirmar();
        var early = filasEarlyConfirmadas();
        var html = renderGridTabla(pend, {
            zona: 'pendiente',
            titulo: 'Tabla 1 — Nuevas compras',
            emptyMsg: 'No hay compras nuevas. Corre el script de detección o usa + Fila en Editar.',
            sectionId: 'adminComprasPendientes'
        });
        html += renderGridTabla(early, {
            zona: 'early',
            titulo: 'Tabla 2 — Early access confirmado',
            emptyMsg: 'Nada en early access. Confírmalo desde la tabla 1.',
            sectionId: 'adminComprasEarly'
        });
        return '<div class="admin-compras-grids">' + html + '</div>';
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
        var buscarPend = root.querySelector('#adminComprasBuscarPend');
        if (buscarPend) {
            buscarPend.addEventListener('input', function () {
                filtroPendiente = buscarPend.value || '';
                pintar(root);
            });
        }
        var buscarEarly = root.querySelector('#adminComprasBuscarEarly');
        if (buscarEarly) {
            buscarEarly.addEventListener('input', function () {
                filtroEarly = buscarEarly.value || '';
                pintar(root);
            });
        }
        root.querySelectorAll('.admin-compras-excel').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var z = btn.getAttribute('data-zona') || 'pendiente';
                var list = filasZonaSinFiltro(z);
                var n = list.length;
                if (!n || !global.ObebeAdminDialog) {
                    if (!n) {
                        aviso = 'Esta tabla no tiene filas para exportar.';
                        pintar(root);
                    }
                    return;
                }
                var tabNom = z === 'early' ? 'tabla 2 (early access)' : 'tabla 1 (nuevas compras)';
                ObebeAdminDialog.confirm({
                    title: '¿Exportar Excel?',
                    message: 'Se descargará un Excel solo de ' + tabNom + ' (' + n + ' fila(s)).',
                    confirmText: 'Sí, exportar',
                    cancelText: 'Cancelar',
                    confirmSuccess: true
                }).then(function (ok) {
                    if (!ok) return;
                    exportarExcelZona(z, list);
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
                var z = btn.getAttribute('data-zona') || 'early';
                if (z === 'early') subirEarlyAInventario(root);
                else subirPendientesAInventario(root);
            });
        });
        var editPend = root.querySelector('#adminComprasEditarPend');
        if (editPend) editPend.addEventListener('click', function () {
            editandoZona = 'pendiente';
            pintar(root);
        });
        var editEarly = root.querySelector('#adminComprasEditarEarly');
        if (editEarly) editEarly.addEventListener('click', function () {
            editandoZona = 'early';
            pintar(root);
        });
        function cancelarEdicion() {
            editandoZona = null;
            filas = ObebeComprasStore.getAll();
            pintar(root);
        }
        var cancP = root.querySelector('#adminComprasCancelarPend');
        if (cancP) cancP.addEventListener('click', cancelarEdicion);
        var cancE = root.querySelector('#adminComprasCancelarEarly');
        if (cancE) cancE.addEventListener('click', cancelarEdicion);
        function guardarEdicion() {
            filas.forEach(function (f) { syncFilaCompras(f); f.actualizadoEn = Date.now(); });
            persistir();
            editandoZona = null;
            pintar(root);
        }
        var guardP = root.querySelector('#adminComprasGuardarPend');
        if (guardP) guardP.addEventListener('click', guardarEdicion);
        var guardE = root.querySelector('#adminComprasGuardarEarly');
        if (guardE) guardE.addEventListener('click', guardarEdicion);
        root.querySelectorAll('.admin-compras-add-row').forEach(function (addRow) {
            addRow.addEventListener('click', function () {
                var zona = addRow.getAttribute('data-zona') || editandoZona || 'pendiente';
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
                if (zona === 'early') {
                    nueva.earlyAccess = true;
                    nueva.earlyAccessEn = Date.now();
                    asignarFotoColJ(nueva);
                }
                filas.push(nueva);
                persistir();
                pintar(root);
            });
        });
        root.querySelectorAll('.admin-compras-borrar').forEach(function (borrar) {
            borrar.addEventListener('click', function () {
                var zona = borrar.getAttribute('data-zona') || editandoZona;
                var section = zona === 'early'
                    ? root.querySelector('#adminComprasEarly')
                    : root.querySelector('#adminComprasPendientes');
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
        return filas.filter(function (f) { return !f.earlyAccess && !f.enTienda; });
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

    function ofrecerLimpiarInventarioDuplicado(root) {
        if (!filas.length || !global.ObebeAdminDialog || !global.ObebeAdminBackend) return Promise.resolve();
        var refs = refsDesdeLista(filas);
        if (!refs.length) return Promise.resolve();
        return resolverFilasInventarioParaBorrado().then(function (filasInv) {
            var ids = idsInventarioPorRefsCompras(refs, filasInv);
            if (!ids.length) return;
            return ObebeAdminDialog.confirm({
                title: 'Quitar duplicado en inventario',
                message: 'Hay ' + ids.length + ' artículos de Compras que quedaron en inventario por un early access anterior. ¿Borrarlos del inventario? Naty los verá solo desde Compras (early access) hasta que subas a tienda.',
                confirmText: 'Sí, borrar del inventario',
                cancelText: 'Ahora no',
                variant: 'warn',
                confirmSuccess: true
            }).then(function (ok) {
                if (!ok) return;
                return ejecutarBorradoInventarioCompras(root, ids, refs);
            });
        });
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
            message: 'Naty verá ' + n + ' artículo(s) en Pedidos (early access) sin publicarlos en la web. No se suben al inventario hasta Subir a inventario. Se llenan fotos en columna J y pasan a la tabla «Early access confirmado».',
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

    function subirPendientesAInventario(root) {
        if (subiendo || !global.ObebeAdminDialog || !global.ObebeAdminBackend) return;
        var candidatas = filasPendientesConfirmar();
        if (!candidatas.length) {
            aviso = 'La tabla 1 no tiene filas pendientes para subir (sin early access).';
            pintar(root);
            return;
        }
        var n = candidatas.length;
        ObebeAdminDialog.confirm({
            title: '¿Subir tabla 1 a inventario?',
            message: 'Se publican ' + n + ' artículo(s) de nuevas compras. Salen de Compras al terminar. No pasan por early access de Naty.',
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

    function subirEarlyAInventario(root) {
        if (subiendo || !global.ObebeAdminDialog || !global.ObebeAdminBackend) return;
        var candidatas = filas.filter(function (f) { return f.earlyAccess && !f.enTienda; });
        if (!candidatas.length) {
            aviso = 'La tabla 2 no tiene filas en early access para subir.';
            pintar(root);
            return;
        }
        var n = candidatas.length;
        ObebeAdminDialog.confirm({
            title: '¿Subir tabla 2 a inventario?',
            message: 'Se publican solo los ' + n + ' artículo(s) de early access confirmado. Salen de Compras al terminar.',
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
                    return ofrecerLimpiarInventarioDuplicado(container);
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
