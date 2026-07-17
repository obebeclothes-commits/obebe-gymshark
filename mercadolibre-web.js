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
        if (String(producto.nombre || '').trim().toUpperCase() === 'ARRIVAL REGULAR FIT') return null;
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

    function iconoMercadoLibre(tamano) {
        var s = tamano || 28;
        return ''
            + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="' + s + '" height="' + s + '" aria-hidden="true" class="ml-logo-icon">'
            + '<rect width="32" height="32" rx="6" fill="#FFE600"/>'
            + '<text x="16" y="21" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="11" fill="#2D3277">ML</text>'
            + '</svg>';
    }

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
            enlace.setAttribute('aria-label', 'Comprar en Mercado Libre');
            enlace.setAttribute('title', 'Comprar en Mercado Libre');
            enlace.innerHTML = iconoMercadoLibre(28) + '<span>Mercado Libre</span>';
            contenedor.appendChild(enlace);
        });

        document.querySelectorAll('.social-links').forEach(function(contenedor) {
            if (contenedor.querySelector('.social-link.mercadolibre')) return;
            var enlace = document.createElement('a');
            enlace.href = vendedor.permalink;
            enlace.target = '_blank';
            enlace.rel = 'noopener noreferrer';
            enlace.className = 'social-link mercadolibre';
            enlace.setAttribute('aria-label', 'Comprar en Mercado Libre');
            enlace.setAttribute('title', 'Mercado Libre');
            enlace.innerHTML = iconoMercadoLibre(24);
            contenedor.insertBefore(enlace, contenedor.firstChild);
        });
    }

    document.addEventListener('DOMContentLoaded', function() {
        cargarListadosMercadoLibre();
    });
})();
