// Arranque ligero: detecta datos móviles y carga solo los scripts necesarios.
(function() {
    var VERSION = '20260720';
    window.__obebeBootActivo = true;

    function esDispositivoMovil() {
        return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    }

    function esRedMovil() {
        try {
            var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (c) {
                if (c.saveData) return true;
                if (c.type === 'cellular') return true;
                if (/^(slow-2g|2g|3g)$/.test(String(c.effectiveType || ''))) return true;
            }
        } catch (e) {}
        return esDispositivoMovil();
    }

    window.__obebeRedMovil = esRedMovil();
    window.__obebeOmitirSyncSheet = window.__obebeRedMovil;

    function paginaActual() {
        var partes = location.pathname.split('/');
        var nombre = partes[partes.length - 1] || 'index.html';
        if (!nombre || nombre.indexOf('.') === -1) return 'index.html';
        return nombre;
    }

    function necesitaCatalogoMujer() {
        var pg = paginaActual();
        var q = new URLSearchParams(location.search);
        var cat = (q.get('categoria') || '').toLowerCase();

        if (pg === 'index.html') return true;
        if (pg === 'asesorias.html') return false;
        if (pg === 'producto.html') return cat !== 'hombre';
        if (pg === 'productos.html') {
            if (cat === 'mujer') return true;
            if (cat === 'hombre') return false;
            if (q.get('mayoreo') || q.get('mayoreo50') || q.get('nuevoStock') || q.get('marca')) return true;
            return false;
        }
        return true;
    }

    function necesitaCatalogoHombre() {
        var pg = paginaActual();
        var q = new URLSearchParams(location.search);
        var cat = (q.get('categoria') || '').toLowerCase();

        if (pg === 'index.html') return true;
        if (pg === 'asesorias.html') return false;
        if (pg === 'producto.html') return cat !== 'mujer';
        if (pg === 'productos.html') {
            if (cat === 'mujer') return false;
            return true;
        }
        return true;
    }

    function scriptsBase() {
        return [
            'stock-sheet.js?v=' + VERSION,
            'mercadolibre-web.js?v=' + VERSION,
            'script.js?v=' + VERSION,
            'productos.js?v=' + VERSION
        ];
    }

    function scriptsParaPagina() {
        var pg = paginaActual();

        if (pg === 'asesorias.html') {
            return [
                'mercadolibre-web.js?v=' + VERSION,
                'productos.js?v=' + VERSION,
                'script.js?v=' + VERSION
            ];
        }

        var list = [];
        if (necesitaCatalogoHombre()) list.push('productos-hombre.js?v=' + VERSION);
        if (necesitaCatalogoMujer()) list.push('productos-mujer.js?v=' + VERSION);
        list = list.concat(scriptsBase());
        if (pg === 'producto.html') list.push('producto-detalle.js?v=' + VERSION);
        return list;
    }

    function scriptsIndexMovilRapido() {
        return ['productos-hombre.js?v=' + VERSION].concat(scriptsBase());
    }

    function ocultarCargando() {
        var el = document.getElementById('siteBootLoading');
        if (el) el.hidden = true;
    }

    function cargarScript(src) {
        return new Promise(function(resolve) {
            var el = document.createElement('script');
            el.src = src;
            el.async = false;
            var limite = window.__obebeRedMovil ? 90000 : 30000;
            var timer = setTimeout(function() {
                console.warn('[boot] timeout', src);
                resolve();
            }, limite);
            el.onload = function() {
                clearTimeout(timer);
                resolve();
            };
            el.onerror = function() {
                clearTimeout(timer);
                console.warn('[boot] error', src);
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

    function finalizarBoot(extra) {
        ocultarCargando();
        document.dispatchEvent(new Event('obebe-scripts-ready'));
        if (typeof extra === 'function') extra();
    }

    function iniciar() {
        var pg = paginaActual();

        if (pg === 'index.html' && window.__obebeRedMovil) {
            cargarSecuencia(scriptsIndexMovilRapido(), 0, function() {
                finalizarBoot(function() {
                    cargarScript('productos-mujer.js?v=' + VERSION).then(function() {
                        if (typeof renderizarProductosMujer === 'function') {
                            renderizarProductosMujer();
                        }
                        if (typeof inicializarCarouselMujer === 'function') {
                            inicializarCarouselMujer();
                        }
                    });
                });
            });
            return;
        }

        cargarSecuencia(scriptsParaPagina(), 0, function() {
            finalizarBoot();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
