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
    // Siempre sincronizar stock desde Sheets (catálogo local solo como respaldo inicial).
    w.__obebeOmitirSyncSheet = false;
})(window);

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('sw.js').catch(function() {});
    });
}
