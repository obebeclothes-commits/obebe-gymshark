(function() {
    var VERSION = '20260733';
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

    function scriptsEsenciales() {
        var pg = paginaActual();
        if (pg === 'asesorias.html') {
            return ['mercadolibre-web.js', 'productos.js', 'script.js'];
        }
        var base = ['productos-hombre.js', 'script.js', 'productos.js'];
        if (necesitaMujer()) {
            base.splice(1, 0, 'productos-mujer.js');
        }
        if (pg === 'producto.html') base.push('producto-detalle.js');
        return base;
    }

    function cargarScript(src) {
        if (document.querySelector('script[src*="' + src + '"]')) {
            return Promise.resolve(true);
        }
        return new Promise(function(resolve) {
            var el = document.createElement('script');
            el.src = src + '?v=' + VERSION;
            var limite = window.__obebeRedMovil ? 120000 : 60000;
            var listo = false;
            var timer = setTimeout(function() {
                if (!listo) {
                    console.warn('[obebe-cargar] timeout', src);
                    resolve(false);
                }
            }, limite);
            el.onload = function() {
                listo = true;
                clearTimeout(timer);
                resolve(true);
            };
            el.onerror = function() {
                listo = true;
                clearTimeout(timer);
                console.warn('[obebe-cargar] error', src);
                resolve(false);
            };
            document.body.appendChild(el);
        });
    }

    function cargarSecuencia(lista, indice) {
        if (indice >= lista.length) return Promise.resolve();
        return cargarScript(lista[indice]).then(function() {
            return cargarSecuencia(lista, indice + 1);
        });
    }

    function cargarExtras() {
        if (paginaActual() === 'asesorias.html') return;
        var el = document.createElement('script');
        el.src = 'obebe-listo.js?v=' + VERSION;
        el.async = true;
        document.body.appendChild(el);
    }

    function dispararReady() {
        if (window.__obebeScriptsReadyDisparado) return;
        window.__obebeScriptsReadyDisparado = true;
        document.dispatchEvent(new Event('obebe-scripts-ready'));
        cargarExtras();
    }

    function iniciar() {
        var esenciales = scriptsEsenciales();
        var failsafeMs = window.__obebeRedMovil ? 8000 : 5000;
        var failsafe = setTimeout(function() {
            console.warn('[obebe-cargar] failsafe — iniciando con lo disponible');
            dispararReady();
        }, failsafeMs);

        cargarSecuencia(esenciales, 0).then(function() {
            clearTimeout(failsafe);
            dispararReady();
        }).catch(function() {
            clearTimeout(failsafe);
            dispararReady();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
