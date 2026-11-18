/**
 * Título de productos.html / ofertas antes de cargar productos.js (evita flash "Productos").
 */
(function (w) {
    function paramSi1(p, key) {
        var v = (p.get(key) || '').trim().toLowerCase();
        return v === '1' || v === 'si' || v === 'true';
    }

    function decod(s) {
        try {
            return decodeURIComponent(String(s || '').replace(/\+/g, ' ')).trim();
        } catch (e) {
            return String(s || '').trim();
        }
    }

    w.obebeTituloDesdeUrl = function (search) {
        if (w.__OEBE_PAGINA_OFERTAS) {
            return {
                text: 'OFERTAS SEMANALES',
                classes: ['page-title-ofertas', 'page-title-atletas']
            };
        }
        var p = search instanceof URLSearchParams ? search : new URLSearchParams(search || w.location.search);
        var coleccion = decod(p.get('coleccion'));
        if (coleccion) {
            return {
                text: 'COLECCIÓN ' + coleccion.toUpperCase(),
                classes: ['page-title-coleccion', 'page-title-atletas', 'page-title-auto-fit']
            };
        }
        if (paramSi1(p, 'mayoreo50')) {
            return {
                text: 'MAYOREO +50',
                classes: ['page-title-atletas', 'page-title-auto-fit']
            };
        }
        if (paramSi1(p, 'mayoreo')) {
            return {
                text: 'MAYOREO +20',
                classes: ['page-title-atletas', 'page-title-auto-fit']
            };
        }
        if (paramSi1(p, 'nuevoStock') || paramSi1(p, 'nuevostock')) {
            return {
                text: 'NUEVO STOCK',
                classes: ['page-title-atletas', 'page-title-auto-fit']
            };
        }
        if (paramSi1(p, 'ofertas')) {
            return {
                text: 'OFERTAS SEMANALES',
                classes: ['page-title-ofertas', 'page-title-atletas']
            };
        }
        var cat = (p.get('categoria') || '').trim();
        var marca = decod(p.get('marca'));
        if (cat === 'Hombre') {
            var th = 'PARA NUESTROS ATLETAS';
            if (marca) th += ' · ' + marca.toUpperCase();
            return {
                text: th,
                classes: ['page-title-gymshark', 'page-title-atletas', 'page-title-auto-fit']
            };
        }
        if (cat === 'Mujer') {
            var tm = 'PARA NUESTRAS ATLETAS';
            if (marca) tm += ' · ' + marca.toUpperCase();
            return {
                text: tm,
                classes: ['page-title-mujer', 'page-title-atletas', 'page-title-auto-fit']
            };
        }
        return null;
    };

    w.obebeAplicarTituloInicialPagina = function () {
        var h = document.getElementById('pageTitle');
        if (!h) return;
        var pack = w.obebeTituloDesdeUrl();
        if (!pack) return;
        h.textContent = pack.text;
        h.classList.remove('page-title-pending');
        h.removeAttribute('aria-hidden');
        (pack.classes || []).forEach(function (c) { h.classList.add(c); });
    };
})(window);