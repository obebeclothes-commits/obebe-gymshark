// Enlaces a publicaciones de Mercado Libre sincronizadas desde la API (mercadolibre-listings.json).
(function() {
    var CACHE = null;
    var PROMESA = null;

    function extraerRefImagen(producto) {
        if (!producto) return 0;
        var fuentes = [producto.imagen1, producto.imagen2, producto.id];
        for (var i = 0; i < fuentes.length; i++) {
            var valor = fuentes[i];
            if (valor === undefined || valor === null || valor === '') continue;
            var texto = String(valor);
            var match = texto.match(/(\d+)(?:\.\d+)?\.(?:webp|jpe?g|png|gif)$/i);
            if (match) return parseInt(match[1], 10);
            if (/^\d+$/.test(texto.trim())) return parseInt(texto.trim(), 10);
        }
        return 0;
    }

    function claveProductoML(producto) {
        if (!producto) return '';
        var ref = extraerRefImagen(producto);
        if (!ref) return '';
        var cat = String(producto.categoria || '').trim().toLowerCase();
        if (cat !== 'hombre' && cat !== 'mujer') return '';
        return cat + '-' + ref;
    }

    window.cargarListadosMercadoLibre = function() {
        if (PROMESA) return PROMESA;
        PROMESA = fetch('mercadolibre-listings.json?v=' + Date.now(), { cache: 'no-store' })
            .then(function(res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function(datos) {
                CACHE = datos || { por_clave: {} };
                if (!CACHE.por_clave) CACHE.por_clave = {};
                window.listadosMercadoLibre = CACHE;
                inyectarEnlacesGlobales(CACHE);
                return CACHE;
            })
            .catch(function(err) {
                console.warn('[mercadolibre-web] Sin listados ML:', err);
                CACHE = { por_clave: {}, vendedor: null };
                window.listadosMercadoLibre = CACHE;
                return CACHE;
            });
        return PROMESA;
    };

    window.obtenerEnlaceMercadoLibre = function(producto) {
        if (!CACHE || !producto) return null;
        var clave = claveProductoML(producto);
        if (!clave) return null;
        var item = CACHE.por_clave[clave];
        return item && item.permalink ? item : null;
    };

    window.htmlBotonMercadoLibre = function(permalink, texto) {
        if (!permalink) return '';
        var label = texto || 'Comprar en Mercado Libre';
        return '<a class="btn-mercadolibre" href="' + permalink + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    };

    function inyectarEnlacesGlobales(datos) {
        var vendedor = datos && datos.vendedor;
        if (!vendedor || !vendedor.permalink) return;

        document.querySelectorAll('.footer-social-links').forEach(function(contenedor) {
            if (contenedor.querySelector('.footer-social-link.mercadolibre')) return;
            var enlace = document.createElement('a');
            enlace.href = vendedor.permalink;
            enlace.target = '_blank';
            enlace.rel = 'noopener noreferrer';
            enlace.className = 'footer-social-link mercadolibre';
            enlace.setAttribute('aria-label', 'Mercado Libre');
            enlace.innerHTML = ''
                + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">'
                + '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.2 14.25H7.8V9.9h1.65v1.35h.06c.18-.42.63-.9 1.56-.9 1.17 0 2.13.99 2.13 2.43 0 1.44-.96 2.43-2.13 2.43-.93 0-1.38-.48-1.56-.9h-.06v1.35zm-1.8-3.57c0 .81.54 1.38 1.29 1.38.75 0 1.29-.57 1.29-1.38 0-.81-.54-1.38-1.29-1.38-.75 0-1.29.57-1.29 1.38z"/>'
                + '</svg>'
                + '<span>' + (vendedor.nickname || 'Mercado Libre') + '</span>';
            contenedor.appendChild(enlace);
        });

        document.querySelectorAll('.social-links').forEach(function(contenedor) {
            if (contenedor.querySelector('.social-link.mercadolibre')) return;
            var enlace = document.createElement('a');
            enlace.href = vendedor.permalink;
            enlace.target = '_blank';
            enlace.rel = 'noopener noreferrer';
            enlace.className = 'social-link mercadolibre';
            enlace.setAttribute('aria-label', 'Mercado Libre');
            enlace.innerHTML = ''
                + '<svg class="social-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">'
                + '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.2 14.25H7.8V9.9h1.65v1.35h.06c.18-.42.63-.9 1.56-.9 1.17 0 2.13.99 2.13 2.43 0 1.44-.96 2.43-2.13 2.43-.93 0-1.38-.48-1.56-.9h-.06v1.35zm-1.8-3.57c0 .81.54 1.38 1.29 1.38.75 0 1.29-.57 1.29-1.38 0-.81-.54-1.38-1.29-1.38-.75 0-1.29.57-1.29 1.38z"/>'
                + '</svg>';
            contenedor.insertBefore(enlace, contenedor.firstChild);
        });
    }

    document.addEventListener('DOMContentLoaded', function() {
        cargarListadosMercadoLibre();
    });
})();
