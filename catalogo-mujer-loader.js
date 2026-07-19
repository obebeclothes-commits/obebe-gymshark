// Carga productos-mujer.js solo cuando la pagina lo necesita (ahorra ~80 KB en Hombre).
(function() {
    var VERSION = '20260721';
    var q = new URLSearchParams(location.search);
    var partes = location.pathname.split('/');
    var pg = partes[partes.length - 1] || 'index.html';
    if (!pg || pg.indexOf('.') === -1) pg = 'index.html';
    var cat = (q.get('categoria') || '').toLowerCase();
    var need = false;

    if (pg === 'index.html') need = true;
    else if (pg === 'asesorias.html') need = false;
    else if (pg === 'producto.html') need = cat !== 'hombre';
    else if (pg === 'productos.html') {
        if (cat === 'mujer') need = true;
        else if (cat === 'hombre') need = false;
        else if (q.get('mayoreo') || q.get('mayoreo50') || q.get('nuevoStock') || q.get('marca')) need = true;
    }

    if (!need) return;
    document.write('<script src="productos-mujer.js?v=' + VERSION + '"><\/script>');
})();
