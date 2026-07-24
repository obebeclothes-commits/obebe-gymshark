document.documentElement.style.setProperty('--vh', (window.innerHeight / 100) + 'px');
(function(w) {
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
    w.__obebeSyncEnBackground = w.__obebeRedMovil;
    w.__obebeCargaExterna = true;

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(regs) {
            regs.forEach(function(reg) { reg.unregister(); });
        }).catch(function() {});
    }
})(window);
