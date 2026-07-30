(function(w, d) {
    var VERSION = '20260737';

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

    function syncStockEnBackground() {
        if (typeof w.sincronizarStockDesdeSheets !== 'function') return;
        w.sincronizarStockDesdeSheets().then(function() {
            if (typeof w.refrescarTiendaTrasSyncStock === 'function') {
                w.refrescarTiendaTrasSyncStock();
            }
        }).catch(function() {});
    }

    if (!w.__obebeScriptsReadyDisparado) {
        w.__obebeScriptsReadyDisparado = true;
        d.dispatchEvent(new Event('obebe-scripts-ready'));
    }

    cargarExtra('stock-sheet.js', syncStockEnBackground);
    cargarExtra('mercadolibre-web.js', function() {
        d.dispatchEvent(new Event('obebe-scripts-extra'));
    });
})(window, document);
