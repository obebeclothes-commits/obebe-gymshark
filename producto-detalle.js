// Página de detalle de producto (producto.html?id=X)
(function() {
    const container = document.getElementById('productDetailContainer');
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const categoriaParam = params.get('categoria');
    if (!id) {
        container.innerHTML = '<div class="product-detail-error"><p>No se especificó ningún producto.</p><p><a href="productos.html?categoria=Hombre">Ver todos los productos</a></p></div>';
        return;
    }

    // Si viene categoria=Mujer, buscar primero en mujer para que id 1 mujer no se confunda con id 1 hombre
    const producto = categoriaParam === 'Mujer'
        ? (typeof productosMujer !== 'undefined' && productosMujer.find(function(p) { return String(p.id) === String(id); }))
            || (typeof productos !== 'undefined' && productos.find(function(p) { return String(p.id) === String(id); }))
        : (typeof productos !== 'undefined' && productos.find(function(p) { return String(p.id) === String(id); }))
            || (typeof productosMujer !== 'undefined' && productosMujer.find(function(p) { return String(p.id) === String(id); }));
    if (!producto) {
        container.innerHTML = '<div class="product-detail-error"><p>Producto no encontrado.</p><p><a href="productos.html?categoria=Hombre">Ver todos los productos</a></p></div>';
        return;
    }

    const imagen1 = producto.imagen1 || '';
    const tieneSegundaImagen = producto.imagen2 && String(producto.imagen2).trim() !== '';
    const imagen2 = tieneSegundaImagen ? producto.imagen2 : '';
    const esImagen1 = typeof esRutaImagen === 'function' && esRutaImagen(imagen1);
    const esImagen2 = typeof esRutaImagen === 'function' && esRutaImagen(imagen2);
    function imageHTML(src, esImg) {
        if (esImg) return '<img src="' + src + '" alt="' + producto.nombre.replace(/"/g, '&quot;') + '" loading="lazy">';
        return '<span>' + (src || '🛍️') + '</span>';
    }
    var agotado = producto.stock === 0;
    var showFullImage = producto.id === 6 || producto.id === 7 || producto.id === 8 || producto.id === 9;
    var imageWrapClass = 'product-detail-image' + (agotado ? ' product-image-wrap out-of-stock' : '');
    var overlayBlock = agotado ? '<div class="product-out-of-stock-overlay" aria-hidden="true"><span>AGOTADO</span></div>' : '';
    var imagesBlock = '<div class="product-detail-images' + (showFullImage ? ' product-detail-show-full-image' : '') + '">';
    imagesBlock += '<div class="' + imageWrapClass + '">' + imageHTML(imagen1, esImagen1) + overlayBlock + '</div>';
    if (tieneSegundaImagen) {
        imagesBlock += '<div class="' + imageWrapClass + '">' + imageHTML(imagen2, esImagen2) + overlayBlock + '</div>';
    }
    imagesBlock += '</div>';

    const backHref = 'productos.html?categoria=' + encodeURIComponent(producto.categoria || 'Hombre');
    document.title = producto.nombre + ' - Obebe GymShark Collection';

    var colorLine = producto.color ? '<p class="product-color">Color: ' + producto.color + '</p>' : '';
    var btnHtml = agotado
        ? '<button type="button" class="add-to-cart-detail agotado" id="addToCartDetailBtn" disabled>Agotado</button>'
        : '<button type="button" class="add-to-cart-detail" id="addToCartDetailBtn">Agregar al Carrito</button>';
    container.innerHTML = ''
        + '<a href="' + backHref + '" class="back-link">← Volver a productos</a>'
        + imagesBlock
        + '<div class="product-detail-info">'
        + '<h1>' + producto.nombre + '</h1>'
        + '<p class="product-size">Talla: ' + producto.talla + '</p>'
        + colorLine
        + '<p class="product-price">$' + producto.precio.toFixed(2) + '</p>'
        + btnHtml
        + '</div>';

    var btn = document.getElementById('addToCartDetailBtn');
    var fixedBar = document.getElementById('addToCartFixedBar');
    var fixedBtn = document.getElementById('addToCartFixedBtn');

    if (btn && !agotado && typeof agregarAlCarrito === 'function') {
        btn.addEventListener('click', function() {
            agregarAlCarrito(producto, { button: btn });
        });
    }
    if (fixedBtn && !agotado && typeof agregarAlCarrito === 'function') {
        fixedBtn.addEventListener('click', function() {
            agregarAlCarrito(producto, { button: fixedBtn });
        });
    }

    if (agotado && fixedBar) {
        fixedBar.style.display = 'none';
    }
    if (btn && fixedBar && !agotado && typeof IntersectionObserver !== 'undefined') {
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    fixedBar.classList.add('hidden');
                } else {
                    fixedBar.classList.remove('hidden');
                }
            });
        }, { threshold: 0.85, rootMargin: '0px 0px 0px 0px' });
        observer.observe(btn);
    }

    if (typeof actualizarBadgeCarrito === 'function') actualizarBadgeCarrito();
})();
