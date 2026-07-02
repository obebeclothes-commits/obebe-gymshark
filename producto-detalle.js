// Página de detalle de producto (producto.html?id=X)
window.iniciarDetalleProducto = function() {
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
    function mismoId(p) { return p && String(p.id) === String(id); }
    var producto = null;
    if (categoriaParam === 'Mujer') {
        if (typeof productosMujer !== 'undefined' && Array.isArray(productosMujer)) producto = productosMujer.find(mismoId);
        if (!producto && typeof productos !== 'undefined' && Array.isArray(productos)) producto = productos.find(mismoId);
    } else {
        if (typeof productos !== 'undefined' && Array.isArray(productos)) producto = productos.find(mismoId);
        if (!producto && typeof productosMujer !== 'undefined' && Array.isArray(productosMujer)) producto = productosMujer.find(mismoId);
    }
    if (!producto) {
        container.innerHTML = '<div class="product-detail-error"><p>Producto no encontrado.</p><p><a href="productos.html?categoria=Hombre">Ver todos los productos</a></p></div>';
        return;
    }

    const imagen1 = (producto.imagen1 || '').trim();
    const imagen2 = (producto.imagen2 || '').trim();
    var agotado = producto.stock === 0;
    var imageWrapClass = 'product-detail-image' + (agotado ? ' product-image-wrap out-of-stock' : '');
    var tieneImagenes = !!(imagen1 || imagen2);

    const backHref = 'productos.html?categoria=' + encodeURIComponent(producto.categoria || 'Hombre');
    document.title = producto.nombre + ' - Obebe GymShark Collection';

    container.innerHTML = '';
    var backLink = document.createElement('a');
    backLink.href = backHref;
    backLink.className = 'back-link';
    backLink.textContent = '← Volver a productos';
    container.appendChild(backLink);

    var imagesBlock = document.createElement('div');
    imagesBlock.className = 'product-detail-images' + (tieneImagenes ? ' product-detail-show-full-image' : '');

    function crearBloqueImagen(ruta) {
        var wrap = document.createElement('div');
        wrap.className = imageWrapClass;
        if (ruta && typeof renderizarImagenProducto === 'function') {
            wrap.dataset.type = 'img';
            wrap.dataset.alt = producto.nombre;
            renderizarImagenProducto(wrap, ruta);
        } else {
            wrap.textContent = '🛍️';
        }
        if (agotado) {
            var overlay = document.createElement('div');
            overlay.className = 'product-out-of-stock-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.innerHTML = '<span>AGOTADO</span>';
            wrap.appendChild(overlay);
        }
        return wrap;
    }

    if (imagen1) imagesBlock.appendChild(crearBloqueImagen(imagen1));
    if (imagen2) imagesBlock.appendChild(crearBloqueImagen(imagen2));
    if (!imagen1 && !imagen2) imagesBlock.appendChild(crearBloqueImagen(''));
    container.appendChild(imagesBlock);

    var info = document.createElement('div');
    info.className = 'product-detail-info';
    info.innerHTML = ''
        + '<h1>' + producto.nombre + '</h1>'
        + '<p class="product-size">Talla: ' + producto.talla + '</p>'
        + (producto.color ? '<p class="product-color">Color: ' + producto.color + '</p>' : '')
        + '<p class="product-price">$' + producto.precio.toFixed(2) + '</p>'
        + (agotado
            ? '<button type="button" class="add-to-cart-detail agotado" id="addToCartDetailBtn" disabled>Agotado</button>'
            : '<button type="button" class="add-to-cart-detail" id="addToCartDetailBtn">Agregar al Carrito</button>');
    container.appendChild(info);

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

    (function initProductImageLightbox() {
        var lightbox = document.getElementById('productImageLightbox');
        var lbImg = document.getElementById('productImageLightboxImg');
        var lbInner = document.getElementById('productImageLightboxInner');
        var closeBtn = document.getElementById('productImageLightboxClose');
        if (!lightbox || !lbImg || !lbInner || !closeBtn) return;

        function isMobileDetailView() {
            return window.matchMedia('(max-width: 768px)').matches;
        }

        function openLightbox(src, alt) {
            if (!src) return;
            lbImg.src = src;
            lbImg.alt = alt || '';
            lightbox.classList.add('active');
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeLightbox() {
            lightbox.classList.remove('active');
            lightbox.setAttribute('aria-hidden', 'true');
            lbImg.removeAttribute('src');
            lbImg.alt = '';
            document.body.style.overflow = '';
        }

        container.querySelectorAll('.product-detail-image').forEach(function(wrap) {
            var img = wrap.querySelector('img');
            if (!img) return;
            wrap.addEventListener('click', function() {
                if (!isMobileDetailView()) return;
                openLightbox(img.currentSrc || img.src, img.alt);
            });
        });

        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeLightbox();
        });

        lightbox.addEventListener('click', function(e) {
            if (e.target === lightbox) closeLightbox();
        });
        lbInner.addEventListener('click', function(e) {
            if (e.target === lbInner) closeLightbox();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && lightbox.classList.contains('active')) closeLightbox();
        });
    })();
};
