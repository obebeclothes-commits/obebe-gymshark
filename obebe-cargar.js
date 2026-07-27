(function() {
    var VERSION = '20260727';
    window.__obebeCargaExterna = true;
    window.__obebeScriptsFallidos = window.__obebeScriptsFallidos || [];

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

    function gruposScripts() {
        var pg = paginaActual();
        if (pg === 'asesorias.html') {
            return {
                paralelo: ['mercadolibre-web.js'],
                secuencial: ['script.js', 'productos.js']
            };
        }
        var paralelo = ['productos-hombre.js', 'stock-sheet.js', 'mercadolibre-web.js'];
        var secuencial = ['script.js', 'productos.js'];
        if (necesitaMujer() && !(window.__obebeRedMovil && pg === 'index.html')) {
            paralelo.push('productos-mujer.js');
        }
        if (pg === 'producto.html') secuencial.push('producto-detalle.js');
        return { paralelo: paralelo, secuencial: secuencial };
    }

    function cargarScript(src) {
        return new Promise(function(resolve) {
            var el = document.createElement('script');
            el.src = src + '?v=' + VERSION;
            var limite = window.__obebeRedMovil ? 45000 : 20000;
            var ok = false;
            var timer = setTimeout(function() {
                if (!ok) {
                    console.warn('[obebe-cargar] timeout', src);
                    window.__obebeScriptsFallidos.push(src);
                }
                resolve();
            }, limite);
            el.onload = function() {
                ok = true;
                clearTimeout(timer);
                resolve();
            };
            el.onerror = function() {
                ok = true;
                clearTimeout(timer);
                console.warn('[obebe-cargar] error', src);
                window.__obebeScriptsFallidos.push(src);
                resolve();
            };
            document.body.appendChild(el);
        });
    }

    function cargarParalelo(lista) {
        return Promise.all(lista.map(cargarScript));
    }

    function cargarSecuencia(lista, indice) {
        if (indice >= lista.length) return Promise.resolve();
        return cargarScript(lista[indice]).then(function() {
            return cargarSecuencia(lista, indice + 1);
        });
    }

    function avisoFalloCritico() {
        var hombreFallo = window.__obebeScriptsFallidos.indexOf('productos-hombre.js') >= 0;
        var sinCatalogo = typeof productosHombre === 'undefined' || !productosHombre.length;
        if (!hombreFallo && !sinCatalogo) return;

        var grid = document.getElementById('productsGrid');
        var carousel = document.getElementById('productsCarousel');
        var msg = '<p style="text-align:center;padding:2rem 1rem;color:#666;line-height:1.5;">'
            + 'No se pudo cargar el catálogo. Revisa tu conexión e '
            + '<a href="javascript:location.reload()" style="color:#111;text-decoration:underline;">intenta de nuevo</a>.'
            + '</p>';
        if (grid) grid.innerHTML = msg;
        else if (carousel) carousel.innerHTML = msg;
    }

    function cargarMujerDespues() {
        if (!necesitaMujer()) return;
        cargarScript('productos-mujer.js').then(function() {
            if (typeof renderizarProductosMujer === 'function') renderizarProductosMujer();
            if (typeof inicializarCarouselMujer === 'function') inicializarCarouselMujer();
        });
    }

    function iniciar() {
        var grupos = gruposScripts();
        cargarParalelo(grupos.paralelo)
            .then(function() { return cargarSecuencia(grupos.secuencial, 0); })
            .then(function() {
                avisoFalloCritico();
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
