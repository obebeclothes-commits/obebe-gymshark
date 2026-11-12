(function (global) {
    'use strict';

    var OTRO = '__otro__';

    var REDES_SOCIALES = [
        { v: 'Instagram', label: 'INSTAGRAM' },
        { v: 'Facebook', label: 'FACEBOOK' },
        { v: 'WhatsApp', label: 'WHATSAPP' },
        { v: 'Obebe.store', label: 'OBEBE.STORE' },
        { v: OTRO, label: 'OTRO' }
    ];

    var MARCAS_APARTADO = [
        { v: 'Gymshark', label: 'GYMSHARK' },
        { v: 'YoungLA', label: 'YOUNGLA' },
        { v: 'Uniqlo', label: 'UNIQLO' },
        { v: 'DFYNE', label: 'DFYNE' },
        { v: 'BreathDivinity', label: 'BREATHDIVINITY' },
        { v: OTRO, label: 'OTROS' }
    ];

    var COLORES_APARTADO = [
        { v: 'Negro', label: 'Negro' },
        { v: 'Blanco', label: 'Blanco' },
        { v: 'Gris', label: 'Gris' },
        { v: 'Azul', label: 'Azul' },
        { v: 'Rojo', label: 'Rojo' },
        { v: 'Rosa', label: 'Rosa' },
        { v: 'Verde', label: 'Verde' },
        { v: 'Beige', label: 'Beige' },
        { v: 'Café', label: 'Café' },
        { v: 'Morado', label: 'Morado' },
        { v: OTRO, label: 'OTROS' }
    ];

    var TALLAS_APARTADO = [
        { v: 'XS', label: 'XS' },
        { v: 'S', label: 'S' },
        { v: 'M', label: 'M' },
        { v: 'L', label: 'L' },
        { v: 'XL', label: 'XL' },
        { v: 'XXL', label: 'XXL' },
        { v: OTRO, label: 'OTROS' }
    ];

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function norm(s) {
        return String(s || '').trim().toLowerCase();
    }

    function resolverValorEnLista(valor, lista) {
        var v = String(valor || '').trim();
        if (!v) return { select: '', otro: '', showOtro: false };
        var i;
        for (i = 0; i < lista.length; i++) {
            if (lista[i].v === OTRO) continue;
            if (norm(lista[i].v) === norm(v) || norm(lista[i].label) === norm(v)) {
                return { select: lista[i].v, otro: '', showOtro: false };
            }
        }
        return { select: OTRO, otro: v, showOtro: true };
    }

    function htmlSelectConOtro(opts) {
        opts = opts || {};
        var lista = opts.lista || [];
        var res = resolverValorEnLista(opts.valor, lista);
        var selectVal = res.select;
        var otroVal = res.otro;
        var showOtro = res.showOtro;
        var optsHtml = '<option value="">— Elegir —</option>' + lista.map(function (o) {
            return '<option value="' + esc(o.v) + '"' + (selectVal === o.v ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        }).join('');
        var otroHidden = showOtro ? '' : ' admin-hidden';
        var swapHide = showOtro ? ' admin-select-otro-swap-hidden' : '';
        return '<div class="admin-select-otro-slot">' +
            '<select class="admin-venta-pago-select admin-campo-select-otro ' + esc(opts.selectClass || '') + swapHide +
            '" data-otro-for="' + esc(opts.otroClass || '') + '">' + optsHtml + '</select>' +
            '<input type="text" class="admin-campo-otro-input ' + esc(opts.otroClass || '') + otroHidden + '" value="' +
            esc(otroVal) + '" placeholder="' + esc(opts.otroPlaceholder || 'Especificar…') + '"></div>';
    }

    function encontrarInputOtro(selectEl) {
        if (!selectEl) return null;
        var cls = selectEl.getAttribute('data-otro-for');
        if (!cls) return null;
        var scope = selectEl.closest('.admin-select-otro-slot') ||
            selectEl.closest('.admin-apartado-prenda-row') ||
            selectEl.closest('.admin-field') ||
            selectEl.parentElement;
        if (!scope) return null;
        var porData = scope.querySelector('[data-inv-otro-for="' + cls + '"]');
        if (porData) return porData;
        var primera = cls.split(/\s+/)[0];
        if (typeof CSS !== 'undefined' && CSS.escape) {
            try {
                return scope.querySelector('.' + CSS.escape(primera));
            } catch (e) { /* ignore */ }
        }
        return scope.querySelector('.' + primera);
    }

    function toggleOtroInput(selectEl) {
        if (!selectEl) return;
        var otro = encontrarInputOtro(selectEl);
        if (!otro) return;
        if (selectEl.value === OTRO) {
            selectEl.classList.add('admin-select-otro-swap-hidden');
            otro.classList.remove('admin-hidden');
        } else {
            selectEl.classList.remove('admin-select-otro-swap-hidden');
            otro.classList.add('admin-hidden');
            otro.value = '';
        }
    }

    function enfocarInputOtro(selectEl) {
        var otro = encontrarInputOtro(selectEl);
        if (otro && selectEl.value === OTRO) otro.focus();
    }

    function leerSelectOtro(selectEl, otroEl) {
        if (!selectEl) return '';
        if (selectEl.value === OTRO) {
            return otroEl ? String(otroEl.value || '').trim() : '';
        }
        if (!selectEl.value) return '';
        return String(selectEl.value).trim();
    }

    function htmlRedSocialField(selectClass, otroClass, valor) {
        var res = resolverValorEnLista(valor, REDES_SOCIALES);
        var showOtro = res.showOtro ? '' : ' admin-hidden';
        var optsHtml = '<option value="">— Elegir —</option>' + REDES_SOCIALES.map(function (o) {
            return '<option value="' + esc(o.v) + '"' + (res.select === o.v ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        }).join('');
        var swapHide = res.showOtro ? ' admin-select-otro-swap-hidden' : '';
        return '<div class="admin-select-otro-slot">' +
            '<select class="admin-venta-pago-select admin-campo-select-otro ' + esc(selectClass) + swapHide +
            '" data-otro-for="' + esc(otroClass) + '">' + optsHtml + '</select>' +
            '<input type="text" class="admin-campo-otro-input ' + esc(otroClass) + showOtro + '" value="' +
            esc(res.otro) + '" placeholder="Otra red…"></div>';
    }

    function leerRedSocial(selectEl, otroEl) {
        return leerSelectOtro(selectEl, otroEl);
    }

    function setSelectConOtro(selectEl, otroEl, valor, lista) {
        if (!selectEl) return;
        var res = resolverValorEnLista(valor, lista || []);
        selectEl.value = res.select || '';
        if (otroEl) {
            otroEl.value = res.otro || '';
            otroEl.classList.toggle('admin-hidden', !res.showOtro);
        }
        toggleOtroInput(selectEl);
    }

    function bindSelectOtros(root) {
        (root || document).querySelectorAll('.admin-campo-select-otro').forEach(function (sel) {
            toggleOtroInput(sel);
            if (sel._otroBound) return;
            sel._otroBound = true;
            sel.addEventListener('change', function () {
                toggleOtroInput(sel);
                if (sel.value === OTRO) enfocarInputOtro(sel);
            });
            var otro = encontrarInputOtro(sel);
            if (otro && !otro._otroBlurBound) {
                otro._otroBlurBound = true;
                otro.addEventListener('blur', function () {
                    if (sel.value !== OTRO) return;
                    if (!String(otro.value || '').trim()) {
                        sel.value = '';
                        toggleOtroInput(sel);
                    }
                });
            }
        });
    }

    function mayusCatalogo(s) {
        return String(s || '').trim().toUpperCase();
    }

    function sinAcentos(s) {
        return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function esColorExcluidoLista(v) {
        return /APARTAD/.test(mayusCatalogo(v));
    }

    function normalizarColorCatalogo(v) {
        var u = mayusCatalogo(v);
        if (!u || esColorExcluidoLista(u)) return '';
        if (u === 'CAFE' || sinAcentos(u) === 'CAFE') return 'CAFÉ';
        var i;
        for (i = 0; i < COLORES_APARTADO.length; i++) {
            if (COLORES_APARTADO[i].v === OTRO) continue;
            var lbl = mayusCatalogo(COLORES_APARTADO[i].label || COLORES_APARTADO[i].v);
            if (u === lbl || sinAcentos(u) === sinAcentos(lbl)) return lbl;
        }
        return u;
    }

    var TALLAS_INVENTARIO_UI = [
        { v: 'XS', label: 'XS' },
        { v: 'S', label: 'S' },
        { v: 'M', label: 'M' },
        { v: 'L', label: 'L' },
        { v: 'XL', label: 'XL' },
        { v: OTRO, label: 'OTRA' }
    ];

    function valoresUnicosDesdeFilas(filasList, colIdx, normalizarFn) {
        var map = {};
        (filasList || []).forEach(function (f) {
            if (!f || !f.celdas) return;
            var v = normalizarFn ? normalizarFn(f.celdas[colIdx]) : mayusCatalogo(f.celdas[colIdx]);
            if (v) map[v] = v;
        });
        return Object.keys(map).sort(function (a, b) { return a.localeCompare(b, 'es'); });
    }

    function listaCatalogoConPresets(opts) {
        opts = opts || {};
        var preset = opts.preset || [];
        var colIdx = opts.colIdx;
        var filasList = opts.filas || [];
        var etiquetaOtro = opts.etiquetaOtro || 'OTRO';
        var normalizarFn = opts.normalizar || mayusCatalogo;
        var map = {};
        preset.forEach(function (o) {
            if (!o || o.v === OTRO) return;
            var up = normalizarFn(o.label || o.v);
            if (up) map[up] = { v: up, label: up };
        });
        valoresUnicosDesdeFilas(filasList, colIdx, normalizarFn).forEach(function (v) {
            map[v] = { v: v, label: v };
        });
        var arr = Object.keys(map).sort(function (a, b) { return a.localeCompare(b, 'es'); }).map(function (k) {
            return map[k];
        });
        arr.push({ v: OTRO, label: etiquetaOtro });
        return arr;
    }

    function idxInventarioAdmin() {
        if (global.ObebeAdminData && ObebeAdminData.idxInventario) return ObebeAdminData.idxInventario();
        return { imagen: 0, nombre: 1, stock: 2, talla: 3, color: 4, tipo: 5, marca: 6, precio: 7, total: 8 };
    }

    function listaColoresCatalogo(filasList) {
        var idx = idxInventarioAdmin();
        return listaCatalogoConPresets({
            colIdx: idx.color != null ? idx.color : 4,
            preset: COLORES_APARTADO,
            etiquetaOtro: 'OTRO',
            normalizar: normalizarColorCatalogo,
            filas: filasList
        });
    }

    function listaTiposCatalogo(filasList) {
        var idx = idxInventarioAdmin();
        return listaCatalogoConPresets({
            colIdx: idx.tipo != null ? idx.tipo : 5,
            preset: [],
            etiquetaOtro: 'OTRO',
            normalizar: mayusCatalogo,
            filas: filasList
        });
    }

    function listaMarcasCatalogo(filasList) {
        var idx = idxInventarioAdmin();
        return listaCatalogoConPresets({
            colIdx: idx.marca != null ? idx.marca : 6,
            preset: MARCAS_APARTADO,
            etiquetaOtro: 'OTRO',
            normalizar: mayusCatalogo,
            filas: filasList
        });
    }

    function listaTallasCatalogo() {
        return TALLAS_INVENTARIO_UI.slice();
    }

    function esColumnaCatalogoMayus(colIdx) {
        var idx = idxInventarioAdmin();
        return colIdx === idx.nombre || colIdx === idx.talla || colIdx === idx.color ||
            colIdx === idx.tipo || colIdx === idx.marca;
    }

    function normalizarValorColumnaInventario(colIdx, valor) {
        var idx = idxInventarioAdmin();
        if (colIdx === idx.color) return normalizarColorCatalogo(valor);
        if (esColumnaCatalogoMayus(colIdx)) return mayusCatalogo(valor);
        return String(valor == null ? '' : valor).trim();
    }

    function htmlCeldaSelectGrid(opts) {
        opts = opts || {};
        var lista = opts.lista || [];
        var val = opts.valor == null ? '' : String(opts.valor);
        var k = opts.rowKey || '';
        var colIdx = opts.colIdx;
        var res = resolverValorEnLista(normalizarValorColumnaInventario(colIdx, val), lista);
        var otroId = 'admin-grid-otro-' + k + '-' + colIdx;
        var optsHtml = '<option value="">—</option>' + lista.map(function (o) {
            return '<option value="' + esc(o.v) + '"' + (res.select === o.v ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        }).join('');
        var otroHidden = res.showOtro ? '' : ' admin-hidden';
        var otroVal = colIdx === idxInventarioAdmin().color
            ? normalizarColorCatalogo(res.otro)
            : mayusCatalogo(res.otro);
        var swapHide = res.showOtro ? ' admin-select-otro-swap-hidden' : '';
        return '<td class="admin-inv-select-td"><div class="admin-select-otro-slot">' +
            '<select class="admin-inv-cell-select admin-campo-select-otro admin-grid-cell-select' + swapHide +
            '" data-row-key="' + esc(k) + '" data-col="' + colIdx + '" data-otro-for="' + esc(otroId) + '">' +
            optsHtml + '</select>' +
            '<input type="text" class="admin-inv-cell-otro admin-campo-otro-input ' + esc(otroId) + otroHidden +
            '" data-row-key="' + esc(k) + '" data-col="' + colIdx + '" value="' + esc(otroVal) +
            '" placeholder="Especificar…"></div></td>';
    }

    global.ObebeAdminCamposUi = {
        OTRO: OTRO,
        REDES_SOCIALES: REDES_SOCIALES,
        MARCAS_APARTADO: MARCAS_APARTADO,
        COLORES_APARTADO: COLORES_APARTADO,
        TALLAS_APARTADO: TALLAS_APARTADO,
        TALLAS_INVENTARIO_UI: TALLAS_INVENTARIO_UI,
        htmlSelectConOtro: htmlSelectConOtro,
        htmlRedSocialField: htmlRedSocialField,
        leerSelectOtro: leerSelectOtro,
        leerRedSocial: leerRedSocial,
        toggleOtroInput: toggleOtroInput,
        enfocarInputOtro: enfocarInputOtro,
        encontrarInputOtro: encontrarInputOtro,
        setSelectConOtro: setSelectConOtro,
        bindSelectOtros: bindSelectOtros,
        resolverValorEnLista: resolverValorEnLista,
        mayusCatalogo: mayusCatalogo,
        normalizarColorCatalogo: normalizarColorCatalogo,
        esColorExcluidoLista: esColorExcluidoLista,
        listaColoresCatalogo: listaColoresCatalogo,
        listaTiposCatalogo: listaTiposCatalogo,
        listaMarcasCatalogo: listaMarcasCatalogo,
        listaTallasCatalogo: listaTallasCatalogo,
        esColumnaCatalogoMayus: esColumnaCatalogoMayus,
        normalizarValorColumnaInventario: normalizarValorColumnaInventario,
        htmlCeldaSelectGrid: htmlCeldaSelectGrid,
        idxInventarioAdmin: idxInventarioAdmin
    };
})(window);
