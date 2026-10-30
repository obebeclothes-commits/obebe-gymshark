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
        return '<select class="admin-venta-pago-select admin-campo-select-otro ' + esc(opts.selectClass || '') + '" data-otro-for="' +
            esc(opts.otroClass || '') + '">' + optsHtml + '</select>' +
            '<input type="text" class="admin-campo-otro-input ' + esc(opts.otroClass || '') + otroHidden + '" value="' +
            esc(otroVal) + '" placeholder="' + esc(opts.otroPlaceholder || 'Especificar…') + '">';
    }

    function toggleOtroInput(selectEl) {
        if (!selectEl) return;
        var cls = selectEl.getAttribute('data-otro-for');
        if (!cls) return;
        var row = selectEl.closest('.admin-apartado-prenda-row') || selectEl.closest('.admin-field') || selectEl.parentElement;
        var otro = row ? row.querySelector('.' + cls.split(' ')[0]) : null;
        if (!otro && cls) {
            otro = document.querySelector('.' + cls.split(' ')[0]);
        }
        if (!otro) return;
        if (selectEl.value === OTRO) {
            otro.classList.remove('admin-hidden');
            otro.focus();
        } else {
            otro.classList.add('admin-hidden');
            otro.value = '';
        }
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
        return '<select class="admin-venta-pago-select admin-campo-select-otro ' + esc(selectClass) + '" data-otro-for="' +
            esc(otroClass) + '">' + optsHtml + '</select>' +
            '<input type="text" class="admin-campo-otro-input ' + esc(otroClass) + showOtro + '" value="' +
            esc(res.otro) + '" placeholder="Otra red…">';
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
            sel.addEventListener('change', function () { toggleOtroInput(sel); });
        });
    }

    global.ObebeAdminCamposUi = {
        OTRO: OTRO,
        REDES_SOCIALES: REDES_SOCIALES,
        MARCAS_APARTADO: MARCAS_APARTADO,
        COLORES_APARTADO: COLORES_APARTADO,
        TALLAS_APARTADO: TALLAS_APARTADO,
        htmlSelectConOtro: htmlSelectConOtro,
        htmlRedSocialField: htmlRedSocialField,
        leerSelectOtro: leerSelectOtro,
        leerRedSocial: leerRedSocial,
        toggleOtroInput: toggleOtroInput,
        setSelectConOtro: setSelectConOtro,
        bindSelectOtros: bindSelectOtros,
        resolverValorEnLista: resolverValorEnLista
    };
})(window);
