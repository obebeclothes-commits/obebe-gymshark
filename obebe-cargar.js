(function() {
    var VERSION = '20260734';
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

    // async=false conserva el orden de ejecución pero descarga todo en paralelo.
    function cargarOrdenado(lista) {
        return new Promise(function(resolve) {
            var restantes = lista.length;
            if (!restantes) {
                resolve();
                return;
            }
            var terminado = function() {
                restantes -= 1;
                if (restantes === 0) resolve();
            };
            lista.forEach(function(src) {
                if (document.querySelector('script[data-obebe="' + src + '"]')) {
                    terminado();
                    return;
                }
                var el = document.createElement('script');
                el.src = src + '?v=' + VERSION;
                el.async = false;
                el.setAttribute('data-obebe', src);
                el.onload = terminado;
                el.onerror = function() {
                    console.warn('[obebe-cargar] error', src);
                    terminado();
                };
                document.body.appendChild(el);
            });
        });
    }

    function cargarExtras() {
        if (window.__obebeExtrasPedidos) return;
        window.__obebeExtrasPedidos = true;
        if (paginaActual() === 'asesorias.html') return;
        var el = document.createElement('script');
        el.src = 'obebe-listo.js?v=' + VERSION;
        el.async = true;
        document.body.appendChild(el);
    }

    // Se puede llamar más de una vez: los propios módulos evitan inicializar doble.
    function dispararReady() {
        document.dispatchEvent(new Event('obebe-scripts-ready'));
        cargarExtras();
    }

    function iniciar() {
        var failsafeMs = window.__obebeRedMovil ? 8000 : 5000;
        var failsafe = setTimeout(function() {
            console.warn('[obebe-cargar] failsafe — iniciando con lo disponible');
            dispararReady();
        }, failsafeMs);

        cargarOrdenado(scriptsEsenciales()).then(function() {
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
