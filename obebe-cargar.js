(function() {
    var VERSION = '20260723';
    window.__obebeCargaExterna = true;

    function paginaActual() {
        var partes = location.pathname.split('/');
        var nombre = partes[partes.length - 1] || 'index.html';
        if (!nombre || nombre.indexOf('.') === -1) return 'index.html';
        return nombre;
    }

    function necesitaMujer() {
        var pg = paginaActual();
        var q = new URLSearchParams(location.search);
        var cat = (q.get('categoria') || '').toLowerCase();
        if (pg === 'asesorias.html') return false;
        if (pg === 'index.html') return true;
        if (pg === 'producto.html') return cat !== 'hombre';
        if (pg === 'productos.html') {
            if (cat === 'mujer') return true;
            if (cat === 'hombre') return false;
            if (q.get('mayoreo') || q.get('mayoreo50') || q.get('nuevoStock') || q.get('marca')) return true;
            return false;
        }
        return true;
    }

    function scriptsParaPagina() {
        var pg = paginaActual();
        if (pg === 'asesorias.html') {
            return ['mercadolibre-web.js', 'productos.js', 'script.js'];
        }
        var list = ['productos-hombre.js', 'stock-sheet.js', 'mercadolibre-web.js', 'script.js', 'productos.js'];
        if (necesitaMujer() && !(window.__obebeRedMovil && pg === 'index.html')) {
            list.splice(1, 0, 'productos-mujer.js');
        }
        if (pg === 'producto.html') list.push('producto-detalle.js');
        return list;
    }

    function cargarScript(src) {
        return new Promise(function(resolve) {
            var el = document.createElement('script');
            el.src = src + '?v=' + VERSION;
            var limite = window.__obebeRedMovil ? 20000 : 12000;
            var timer = setTimeout(function() {
                console.warn('[obebe-cargar] timeout', src);
                resolve();
            }, limite);
            el.onload = function() {
                clearTimeout(timer);
                resolve();
            };
            el.onerror = function() {
                clearTimeout(timer);
                console.warn('[obebe-cargar] error', src);
                resolve();
            };
            document.body.appendChild(el);
        });
    }

    function cargarSecuencia(lista, indice, done) {
        if (indice >= lista.length) {
            done();
            return;
        }
        cargarScript(lista[indice]).then(function() {
            cargarSecuencia(lista, indice + 1, done);
        });
    }

    function cargarMujerDespues() {
        if (!necesitaMujer()) return;
        cargarScript('productos-mujer.js').then(function() {
            if (typeof renderizarProductosMujer === 'function') renderizarProductosMujer();
            if (typeof inicializarCarouselMujer === 'function') inicializarCarouselMujer();
        });
    }

    function iniciar() {
        cargarSecuencia(scriptsParaPagina(), 0, function() {
            document.dispatchEvent(new Event('obebe-scripts-ready'));
            if (window.__obebeRedMovil && paginaActual() === 'index.html') {
                cargarMujerDespues();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
