document.documentElement.style.setProperty('--vh', (window.innerHeight / 100) + 'px');
(function(w, d) {
    w.__obebeRedMovil = (function() {
        try {
            var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (c && (c.type === 'wifi' || c.type === 'ethernet')) return false;
            if (c && (c.saveData || c.type === 'cellular' || /^(slow-2g|2g|3g)$/.test(String(c.effectiveType || '')))) {
                return true;
            }
        } catch (e) {}
        return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    })();
    w.__obebeOmitirSyncSheet = false;
    // Nunca bloquear la tienda esperando Google Sheets (datos móviles / redes lentas).
    w.__obebeSyncEnBackground = true;
    w.__obebeCargaExterna = true;
    w.__obebeScriptsFallidos = [];

    ['https://docs.google.com', 'https://www.gstatic.com'].forEach(function(href) {
        var link = d.createElement('link');
        link.rel = 'preconnect';
        link.href = href;
        link.crossOrigin = 'anonymous';
        d.head.appendChild(link);
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(regs) {
            regs.forEach(function(reg) { reg.unregister(); });
        }).catch(function() {});
    }
})(window, document);
