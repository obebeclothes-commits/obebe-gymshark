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
    // Sync de inventario en segundo plano en redes lentas (Supabase).
    w.__obebeSyncEnBackground = true;
    w.__obebeCargaExterna = true;
    w.__obebeScriptsFallidos = [];

    var supaPre = (w.OBEBE_DATA_CONFIG && w.OBEBE_DATA_CONFIG.supabaseUrl) || '';
    if (supaPre) {
        try {
            var link = d.createElement('link');
            link.rel = 'preconnect';
            link.href = new URL(supaPre).origin;
            link.crossOrigin = 'anonymous';
            d.head.appendChild(link);
        } catch (e) { /* */ }
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(regs) {
            regs.forEach(function(reg) { reg.unregister(); });
        }).catch(function() {});
    }
})(window, document);
