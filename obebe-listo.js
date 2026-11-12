(function(w, d) {
    var VERSION = '20261112a';

    function cargarExtra(src, alTerminar) {
        if (d.querySelector('script[data-obebe-extra="' + src + '"]')) {
            if (alTerminar) alTerminar();
            return;
        }
        var el = d.createElement('script');
        el.src = src + '?v=' + VERSION;
        el.async = true;
        el.setAttribute('data-obebe-extra', src);
        el.onload = function() { if (alTerminar) alTerminar(); };
        el.onerror = function() { if (alTerminar) alTerminar(); };
        d.body.appendChild(el);
    }

    function dispararScriptsReady() {
        if (w.__obebeScriptsReadyDisparado) return;
        w.__obebeScriptsReadyDisparado = true;
        d.dispatchEvent(new Event('obebe-scripts-ready'));
    }

    /** Precios/stock vienen del inventario (Supabase); la tienda no debe pintar antes de sincronizar. */
    function arrancarInventarioYTienda() {
        if (typeof w.aplicarInventarioCacheTienda === 'function') {
            w.aplicarInventarioCacheTienda();
        }
        if (typeof w.sincronizarStockDesdeSheets !== 'function') {
            dispararScriptsReady();
            return;
        }
        w.sincronizarStockDesdeSheets().catch(function() {}).finally(dispararScriptsReady);
    }

    cargarExtra('obebe-data-config.js', function() {
        cargarExtra('inventario-columnas.js', function() {
            cargarExtra('stock-sheet.js', arrancarInventarioYTienda);
        });
    });
    cargarExtra('mercadolibre-web.js', function() {
        d.dispatchEvent(new Event('obebe-scripts-extra'));
    });
})(window, document);
