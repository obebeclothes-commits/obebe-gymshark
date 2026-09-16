function formatearPrecio(valor) {
    var n = Number(valor) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
window.formatearPrecio = formatearPrecio;

function actualizarEtiquetaNuevoStock() {
    var el = document.getElementById('nuevoStockFechaLabel');
    if (!el) return;
    var etiqueta = window.fechaStockMasRecienteEtiqueta || '';
    el.textContent = etiqueta ? ('Llegada ' + etiqueta) : 'Última llegada';
}

// Catalogo Hombre: definido en productos-hombre.js (cargar ese script antes que este).
const productos = (typeof productosHombre !== 'undefined' && Array.isArray(productosHombre))
    ? productosHombre
    : [];


/** Bust de caché para fotos (CDN / navegador) al corregir un archivo. */
var VERSION_IMAGENES_PRODUCTO = '20260819';

function esRutaImagen(valor) {
    return /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(valor || '');
}

function conVersionImagen(ruta) {
    if (!ruta || /[?&]v=/.test(ruta)) return ruta || '';
    return ruta + (ruta.indexOf('?') >= 0 ? '&' : '?') + 'v=' + VERSION_IMAGENES_PRODUCTO;
}

/** Usa rutas del catálogo o convención hombre|mujer/{id}.webp si faltan. */
function obtenerRutaImagenProducto(producto, numero) {
    var guardada = numero === 2 ? (producto.imagen2 || '') : (producto.imagen1 || '');
    if (guardada && esRutaImagen(guardada)) return conVersionImagen(guardada);
    if (numero !== 1 || !producto || !producto.id) return '';
    var carpeta = (producto.categoria === 'Mujer') ? 'mujer' : 'hombre';
    return conVersionImagen(carpeta + '/' + producto.id + '.webp');
}

function candidatosImagen(fuente) {
    if (!fuente) return [];
    var q = '';
    var qi = fuente.indexOf('?');
    var path = fuente;
    if (qi >= 0) {
        q = fuente.slice(qi);
        path = fuente.slice(0, qi);
    }
    var base = path.replace(/\.(png|jpe?g|webp)$/i, '');
    return [path + q, base + '.webp' + q, base + '.png' + q, base + '.jpeg' + q, base + '.jpg' + q]
        .filter(function(v, i, a) { return v && a.indexOf(v) === i; });
}

function renderizarImagenProducto(contenedor, fuente, opciones) {
    opciones = opciones || {};
    var candidatos = candidatosImagen(fuente);
    if (!candidatos.length) {
        contenedor.dataset.type = 'emoji';
        contenedor.textContent = '🛍️';
        return;
    }
    if (contenedor.dataset.type === 'img' || !contenedor.dataset.type) {
        contenedor.dataset.type = 'img';
        var alt = contenedor.dataset.alt || '';
        var img = document.createElement('img');
        img.alt = alt;
        img.loading = 'lazy';
        var intento = 0;
        img.addEventListener('error', function() {
            intento += 1;
            if (intento < candidatos.length) {
                img.src = candidatos[intento];
                return;
            }
            if (opciones.noOcultarSiFalla && contenedor.dataset.img1) {
                renderizarImagenProducto(contenedor, contenedor.dataset.img1);
                return;
            }
            contenedor.dataset.type = 'emoji';
            contenedor.textContent = '🛍️';
        });
        img.src = candidatos[0];
        contenedor.innerHTML = '';
        contenedor.appendChild(img);
        return;
    }

    contenedor.textContent = fuente;
}

/** Productos con columna U del Sheet = posiciones 1..6 en el carrusel (7.º recuadro = Ver más). */
function obtenerProductosParaCarrusel(catalogo, categoria) {
    var slots = new Array(6);
    if (!Array.isArray(catalogo)) return [];
    catalogo.forEach(function(p) {
        if (p.categoria !== categoria && p.categoria !== 'Unisex') return;
        var pos = parseInt(p.posicionCarrusel, 10);
        if (pos >= 1 && pos <= 6) slots[pos - 1] = p;
    });
    var resultado = [];
    for (var i = 0; i < slots.length; i++) {
        if (slots[i]) resultado.push(slots[i]);
    }
    return resultado;
}

var VERSION_IMAGENES_SECCIONES = '20260916r';

function crearTarjetaVerMasCarrusel(opciones) {
    var href = opciones.href || 'productos.html';
    var archivoImagen = opciones.archivoImagen || 'secciones/ver-mas.jpg';
    var titulo = opciones.titulo || 'VER MÁS';
    var subtitulo = opciones.subtitulo || 'Ver catálogo completo';
    var imgSrc = archivoImagen.indexOf('?') >= 0
        ? archivoImagen
        : archivoImagen + '?v=' + VERSION_IMAGENES_SECCIONES;

    var card = document.createElement('a');
    card.className = 'product-card product-card-ver-mas'
        + (opciones.variante === 'ofertas' ? ' product-card-ver-mas--ofertas' : '');
    card.href = href;
    card.setAttribute('aria-label', titulo + ' — ' + subtitulo);

    var imageWrap = document.createElement('div');
    imageWrap.className = 'product-image-wrap product-card-ver-mas-image-wrap coleccion-card-image';
    imageWrap.setAttribute('data-label', titulo);

    var imageContainer = document.createElement('div');
    imageContainer.className = 'product-image';
    var img = document.createElement('img');
    img.src = imgSrc;
    img.alt = titulo;
    img.loading = 'lazy';
    img.width = 320;
    img.height = 380;
    if (opciones.imagenFallback) {
        var fallbackSrc = opciones.imagenFallback.indexOf('?') >= 0
            ? opciones.imagenFallback
            : opciones.imagenFallback + '?v=' + VERSION_IMAGENES_SECCIONES;
        img.addEventListener('error', function onImgError() {
            img.removeEventListener('error', onImgError);
            img.src = fallbackSrc;
        });
    }
    imageContainer.appendChild(img);

    var overlay = document.createElement('div');
    overlay.className = 'product-card-ver-mas-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    var overlayTitle = document.createElement('span');
    overlayTitle.className = 'product-card-ver-mas-title'
        + (opciones.estiloTitulo === 'gymshark' ? ' product-card-ver-mas-title--gymshark' : '')
        + (opciones.estiloTitulo === 'nuevo-drop' ? ' product-card-ver-mas-title--nuevo-drop' : '');
    overlayTitle.textContent = titulo;

    var overlaySub = document.createElement('span');
    overlaySub.className = 'product-card-ver-mas-sub';
    overlaySub.textContent = subtitulo;

    overlay.appendChild(overlayTitle);
    overlay.appendChild(overlaySub);

    imageWrap.appendChild(imageContainer);
    imageWrap.appendChild(overlay);
    card.appendChild(imageWrap);

    return card;
}

function mensajeCarruselCargando() {
    return '<p style="padding:2rem;text-align:center;color:#666;">Cargando productos...</p>';
}

function mensajeCarruselError() {
    return '<p style="padding:2rem;text-align:center;color:#666;line-height:1.5;">No se pudo cargar el inventario. '
        + '<a href="javascript:location.reload()" style="color:#111;text-decoration:underline;">Reintentar</a></p>';
}

function inicializarHoverCarruselHombre() {
    const carousel = document.getElementById('productsCarousel');
    if (!carousel) return;

    carousel.addEventListener('mouseover', (e) => {
        const card = e.target.closest('.product-card');
        if (!card || card.classList.contains('product-card-ver-mas') || card.dataset.hovered === 'true') return;
        card.dataset.hovered = 'true';
        const imgContainer = card.querySelector('.product-image');
        if (imgContainer && imgContainer.dataset.img2) {
            renderizarImagenProducto(imgContainer, imgContainer.dataset.img2, { noOcultarSiFalla: true });
        }
    });

    carousel.addEventListener('mouseout', (e) => {
        const card = e.target.closest('.product-card');
        if (!card || card.classList.contains('product-card-ver-mas')) return;
        // Verificar si el mouse realmente sali�� de la tarjeta
        const related = e.relatedTarget;
        if (related && card.contains(related)) return;
        card.dataset.hovered = 'false';
        const imgContainer = card.querySelector('.product-image');
        if (imgContainer && imgContainer.dataset.img1) {
            renderizarImagenProducto(imgContainer, imgContainer.dataset.img1);
        }
    });
}

// Funci��n para renderizar productos en el carrusel
function renderizarCarruselHombre(categoria = 'Hombre', mostrarTodos = false) {
    const productsCarousel = document.getElementById('productsCarousel');
    if (!productsCarousel) return;
    
    productsCarousel.innerHTML = '';

    let productosFiltrados = obtenerProductosParaCarrusel(productos, categoria);

    if (productosFiltrados.length === 0) {
        productsCarousel.innerHTML = '<p style="padding: 2rem; color: #666;">No hay productos disponibles.</p>';
        return;
    }

    productosFiltrados.forEach(producto => {
        const agotado = producto.stock === 0;
        const card = document.createElement('a');
        card.className = 'product-card' + (agotado ? ' product-card-agotado' : '');
        if (!agotado) {
            card.href = 'producto.html?id=' + producto.id;
        } else {
            card.href = '#';
            card.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
        }
        card.setAttribute('aria-label', agotado ? (producto.nombre + ' (agotado)') : 'Ver ' + producto.nombre);
        card.setAttribute('data-product-id', producto.id);

        const imagen1 = obtenerRutaImagenProducto(producto, 1);
        const imagen2 = obtenerRutaImagenProducto(producto, 2);

        const imageWrap = document.createElement('div');
        imageWrap.className = 'product-image-wrap' + (agotado ? ' out-of-stock' : '');

        const imageContainer = document.createElement('div');
        imageContainer.className = 'product-image';
        imageContainer.dataset.alt = producto.nombre;
        if (imagen1) {
            imageContainer.dataset.type = 'img';
            imageContainer.dataset.img1 = imagen1;
            if (imagen2) imageContainer.dataset.img2 = imagen2;
            renderizarImagenProducto(imageContainer, imagen1);
        } else {
            imageContainer.dataset.type = 'emoji';
            imageContainer.textContent = '🛍️';
        }
        imageWrap.appendChild(imageContainer);

        if (agotado) {
            const overlay = document.createElement('div');
            overlay.className = 'product-out-of-stock-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.innerHTML = '<span>AGOTADO</span>';
            imageWrap.appendChild(overlay);
        }

        if (typeof adjuntarBadgeDescuentoEnImagen === 'function') {
            adjuntarBadgeDescuentoEnImagen(imageWrap, producto);
        }

        card.appendChild(imageWrap);

        const info = document.createElement('div');
        info.className = 'product-info';
        const btnTexto = agotado ? 'Agotado' : 'Agregar al Carrito';
        const btnClase = 'add-to-cart-carousel' + (agotado ? ' agotado' : '');
        var precioHtml = typeof htmlPrecioListadoProducto === 'function'
            ? htmlPrecioListadoProducto(producto, { sinBadgeOferta: true })
            : ('<p class="product-price">$' + formatearPrecio(typeof precioVigenteProducto === 'function' ? precioVigenteProducto(producto) : producto.precio) + '</p>');
        info.innerHTML = `
            <h3 class="product-name">${producto.nombre}</h3>
            <p class="product-size">Talla: ${producto.talla}</p>
            ${precioHtml}
            <button type="button" class="${btnClase}" data-product-id="${producto.id}" ${agotado ? ' disabled' : ''}>${btnTexto}</button>
        `;

        card.appendChild(info);

        const addBtn = info.querySelector('.add-to-cart-carousel');
        if (addBtn && !agotado && typeof agregarAlCarrito === 'function') {
            addBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                agregarAlCarrito(producto, { button: addBtn });
            });
        }

        productsCarousel.appendChild(card);
    });

    productsCarousel.appendChild(crearTarjetaVerMasCarrusel({
        href: 'productos.html?categoria=Hombre',
        archivoImagen: 'secciones/hombre-final.jpg',
        titulo: 'HOMBRE',
        subtitulo: 'Ver catálogo completo'
    }));

    // Resetear scroll
    currentScroll = 0;
    productsCarousel.style.transform = 'translateX(0)';
    actualizarFlechas();
}

// Carrusel de mujer en index: productos con bot��n Agregar al Carrito (usa productosMujer de productos-mujer.js)
function renderizarProductosMujer() {
    const carousel = document.getElementById('productsCarouselMujer');
    if (!carousel) return;
    if (typeof productosMujer === 'undefined' || !productosMujer.length) return;

    let list = obtenerProductosParaCarrusel(productosMujer, 'Mujer');

    currentScrollMujer = 0;
    carousel.innerHTML = '';
    carousel.classList.remove('products-carousel--static');
    carousel.style.transform = 'translateX(0)';

    if (list.length === 0) {
        carousel.innerHTML = '<p style="padding: 2rem; color: #666;">No hay productos disponibles.</p>';
        return;
    }

    list.forEach(function(producto) {
        const agotado = producto.stock === 0;
        const card = document.createElement('a');
        card.className = 'product-card' + (agotado ? ' product-card-agotado' : '');
        if (!agotado) {
            card.href = 'producto.html?id=' + producto.id + '&categoria=Mujer';
        } else {
            card.href = '#';
            card.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); });
        }
        card.setAttribute('aria-label', agotado ? (producto.nombre + ' (agotado)') : 'Ver ' + producto.nombre);
        card.setAttribute('data-product-id', producto.id);

        const imagen1 = obtenerRutaImagenProducto(producto, 1);
        const imagen2 = obtenerRutaImagenProducto(producto, 2);

        const imageWrap = document.createElement('div');
        imageWrap.className = 'product-image-wrap' + (agotado ? ' out-of-stock' : '');

        const imageContainer = document.createElement('div');
        imageContainer.className = 'product-image';
        imageContainer.dataset.alt = producto.nombre;
        if (imagen1) {
            imageContainer.dataset.type = 'img';
            imageContainer.dataset.img1 = imagen1;
            if (imagen2) imageContainer.dataset.img2 = imagen2;
            renderizarImagenProducto(imageContainer, imagen1);
        } else {
            imageContainer.dataset.type = 'emoji';
            imageContainer.textContent = '🛍️';
        }
        imageWrap.appendChild(imageContainer);

        if (agotado) {
            const overlay = document.createElement('div');
            overlay.className = 'product-out-of-stock-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.innerHTML = '<span>AGOTADO</span>';
            imageWrap.appendChild(overlay);
        }

        if (typeof adjuntarBadgeDescuentoEnImagen === 'function') {
            adjuntarBadgeDescuentoEnImagen(imageWrap, producto);
        }

        card.appendChild(imageWrap);

        const info = document.createElement('div');
        info.className = 'product-info';
        const btnTexto = agotado ? 'Agotado' : 'Agregar al Carrito';
        const btnClase = 'add-to-cart-carousel' + (agotado ? ' agotado' : '');
        var precioHtmlMujer = typeof htmlPrecioListadoProducto === 'function'
            ? htmlPrecioListadoProducto(producto, { sinBadgeOferta: true })
            : ('<p class="product-price">$' + (producto.precio ? formatearPrecio(typeof precioVigenteProducto === 'function' ? precioVigenteProducto(producto) : producto.precio) : '0') + '</p>');
        info.innerHTML = '<h3 class="product-name">' + producto.nombre + '</h3><p class="product-size">Talla: ' + producto.talla + '</p>' + precioHtmlMujer + '<button type="button" class="' + btnClase + '" data-product-id="' + producto.id + '" ' + (agotado ? ' disabled' : '') + '>' + btnTexto + '</button>';

        card.appendChild(info);

        const addBtn = info.querySelector('.add-to-cart-carousel');
        if (addBtn && !agotado && typeof agregarAlCarrito === 'function') {
            addBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                agregarAlCarrito(producto, { button: addBtn });
            });
        }

        carousel.appendChild(card);
    });

    carousel.appendChild(crearTarjetaVerMasCarrusel({
        href: 'productos.html?categoria=Mujer',
        archivoImagen: 'secciones/mujer-final.jpg',
        titulo: 'MUJER',
        subtitulo: 'Ver catálogo completo'
    }));

    // Hover segunda imagen en carrusel mujer
    carousel.addEventListener('mouseover', function(e) {
        const card = e.target.closest('.product-card');
        if (!card || card.classList.contains('product-card-ver-mas') || card.dataset.hovered === 'true') return;
        card.dataset.hovered = 'true';
        const imgContainer = card.querySelector('.product-image');
        if (imgContainer && imgContainer.dataset.img2) {
            renderizarImagenProducto(imgContainer, imgContainer.dataset.img2, { noOcultarSiFalla: true });
        }
    });
    carousel.addEventListener('mouseout', function(e) {
        const card = e.target.closest('.product-card');
        if (!card || card.classList.contains('product-card-ver-mas')) return;
        const related = e.relatedTarget;
        if (related && card.contains(related)) return;
        card.dataset.hovered = 'false';
        const imgContainer = card.querySelector('.product-image');
        if (imgContainer && imgContainer.dataset.img1) {
            renderizarImagenProducto(imgContainer, imgContainer.dataset.img1);
        }
    });
    actualizarFlechasMujer();
}

function htmlPrecioCarruselOferta(producto) {
    if (typeof htmlPrecioListadoProducto === 'function') {
        return htmlPrecioListadoProducto(producto, { sinBadgeOferta: true });
    }
    var retail = Number(producto.precio) || 0;
    var oferta = typeof precioOfertaSemanalProducto === 'function'
        ? precioOfertaSemanalProducto(producto)
        : Math.round(retail * 0.75 * 100) / 100;
    if (oferta > 0 && retail > oferta) {
        return '<p class="product-price product-price-oferta-semanal">'
            + '<span class="product-price-retail">$' + formatearPrecio(retail) + '</span>'
            + '<span class="product-price-wholesale">$' + formatearPrecio(oferta) + '</span>'
            + '</p>';
    }
    return '<p class="product-price">$' + formatearPrecio(typeof precioVigenteProducto === 'function' ? precioVigenteProducto(producto) : retail) + '</p>';
}

function renderizarCarruselOfertas() {
    var carousel = document.getElementById('productsCarouselOfertas');
    var section = document.getElementById('inventario-ofertas');
    if (!carousel) return;

    var list = typeof obtenerProductosOfertaSemanal === 'function'
        ? obtenerProductosOfertaSemanal(4)
        : [];

    currentScrollOfertas = 0;
    carousel.innerHTML = '';
    carousel.classList.remove('products-carousel--static');
    carousel.style.transform = 'translateX(0)';

    if (section) {
        section.hidden = false;
    }

    list.forEach(function(producto) {
        var agotado = producto.stock === 0;
        var card = document.createElement('a');
        card.className = 'product-card product-card-oferta' + (agotado ? ' product-card-agotado' : '');
        if (!agotado) {
            card.href = typeof construirUrlDetalleProductoOfertaSemanal === 'function'
                ? construirUrlDetalleProductoOfertaSemanal(producto)
                : (typeof construirUrlDetalleProducto === 'function'
                    ? construirUrlDetalleProducto(producto, { desdeOfertasSemanales: true })
                    : ('producto.html?id=' + encodeURIComponent(producto.id)
                        + (producto.categoria === 'Mujer' ? '&categoria=Mujer' : '')
                        + '&ofertas=1&retorno=' + encodeURIComponent('ofertas-semanales.html')));
        } else {
            card.href = '#';
            card.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); });
        }
        card.setAttribute('aria-label', agotado ? (producto.nombre + ' (agotado)') : ('Oferta: ' + producto.nombre));
        card.setAttribute('data-product-id', producto.id);

        var imagen1 = obtenerRutaImagenProducto(producto, 1);
        var imagen2 = obtenerRutaImagenProducto(producto, 2);

        var imageWrap = document.createElement('div');
        imageWrap.className = 'product-image-wrap' + (agotado ? ' out-of-stock' : '');

        var imageContainer = document.createElement('div');
        imageContainer.className = 'product-image';
        imageContainer.dataset.alt = producto.nombre;
        if (imagen1) {
            imageContainer.dataset.type = 'img';
            imageContainer.dataset.img1 = imagen1;
            if (imagen2) imageContainer.dataset.img2 = imagen2;
            renderizarImagenProducto(imageContainer, imagen1);
        } else {
            imageContainer.dataset.type = 'emoji';
            imageContainer.textContent = '🛍️';
        }
        imageWrap.appendChild(imageContainer);

        if (agotado) {
            var overlay = document.createElement('div');
            overlay.className = 'product-out-of-stock-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.innerHTML = '<span>AGOTADO</span>';
            imageWrap.appendChild(overlay);
        }

        var badge = document.createElement('span');
        badge.className = 'product-card-oferta-badge';
        var pctOferta = typeof porcentajeDescuentoOfertaSemanalProducto === 'function'
            ? porcentajeDescuentoOfertaSemanalProducto(producto)
            : 0;
        badge.textContent = pctOferta > 0 ? ('-' + pctOferta + '%') : '-%';
        imageWrap.appendChild(badge);

        card.appendChild(imageWrap);

        var info = document.createElement('div');
        info.className = 'product-info';
        var btnTexto = agotado ? 'Agotado' : 'Agregar al Carrito';
        var btnClase = 'add-to-cart-carousel' + (agotado ? ' agotado' : '');
        info.innerHTML = '<h3 class="product-name">' + producto.nombre + '</h3>'
            + '<p class="product-size">Talla: ' + producto.talla + '</p>'
            + htmlPrecioCarruselOferta(producto)
            + '<button type="button" class="' + btnClase + '" data-product-id="' + producto.id + '" ' + (agotado ? ' disabled' : '') + '>' + btnTexto + '</button>';
        card.appendChild(info);

        var addBtn = info.querySelector('.add-to-cart-carousel');
        if (addBtn && !agotado && typeof agregarAlCarrito === 'function') {
            addBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                agregarAlCarrito(producto, { button: addBtn });
            });
        }

        carousel.appendChild(card);
    });

    carousel.appendChild(crearTarjetaVerMasCarrusel({
        href: 'ofertas-semanales.html',
        archivoImagen: 'colecciones/OFERTAS.png',
        imagenFallback: 'secciones/OFERTAS.jpg',
        titulo: 'OFERTAS SEMANALES',
        subtitulo: 'Ver todas las ofertas',
        estiloTitulo: 'nuevo-drop',
        variante: 'ofertas'
    }));

    if (!carousel._ofertasHoverBound) {
        carousel._ofertasHoverBound = true;
        carousel.addEventListener('mouseover', function(e) {
            var card = e.target.closest('.product-card');
            if (!card || card.classList.contains('product-card-ver-mas') || card.dataset.hovered === 'true') return;
            card.dataset.hovered = 'true';
            var imgContainer = card.querySelector('.product-image');
            if (imgContainer && imgContainer.dataset.img2) {
                renderizarImagenProducto(imgContainer, imgContainer.dataset.img2, { noOcultarSiFalla: true });
            }
        });
        carousel.addEventListener('mouseout', function(e) {
            var card = e.target.closest('.product-card');
            if (!card || card.classList.contains('product-card-ver-mas')) return;
            var related = e.relatedTarget;
            if (related && card.contains(related)) return;
            card.dataset.hovered = 'false';
            var imgContainer = card.querySelector('.product-image');
            if (imgContainer && imgContainer.dataset.img1) {
                renderizarImagenProducto(imgContainer, imgContainer.dataset.img1);
            }
        });
    }

    actualizarFlechasOfertas();
}

window.renderizarCarruselOfertas = renderizarCarruselOfertas;

// Carrusel mujer: scroll y flechas
let currentScrollMujer = 0;

function scrollCarouselMujer(direction) {
    const carousel = document.getElementById('productsCarouselMujer');
    if (!carousel) return;
    const wrapper = carousel.parentElement;
    if (!wrapper) return;

    const gap = 10;
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    let scrollAmount;
    const firstCard = carousel.querySelector('.product-card');
    if (isMobile && firstCard) {
        scrollAmount = firstCard.offsetWidth + gap;
    } else {
        scrollAmount = (320 + gap) * 4;
    }

    const maxScroll = Math.max(0, carousel.scrollWidth - wrapper.offsetWidth);
    if (direction === 'left') {
        currentScrollMujer = Math.max(0, currentScrollMujer - scrollAmount);
    } else {
        currentScrollMujer = Math.min(maxScroll, currentScrollMujer + scrollAmount);
    }
    carousel.style.transition = 'transform 0.3s ease-out';
    carousel.style.transform = 'translateX(-' + currentScrollMujer + 'px)';
    actualizarFlechasMujer();
}

function actualizarFlechasMujer() {
    const carousel = document.getElementById('productsCarouselMujer');
    const arrowLeft = document.getElementById('arrowLeftMujer');
    const arrowRight = document.getElementById('arrowRightMujer');
    if (!carousel || !arrowLeft || !arrowRight) return;
    const wrapper = carousel.parentElement;
    const maxScroll = Math.max(0, carousel.scrollWidth - wrapper.offsetWidth);
    arrowLeft.disabled = currentScrollMujer <= 0;
    arrowRight.disabled = currentScrollMujer >= maxScroll - 1;
}

let currentScrollOfertas = 0;

function scrollCarouselOfertas(direction) {
    var carousel = document.getElementById('productsCarouselOfertas');
    if (!carousel) return;
    var wrapper = carousel.parentElement;
    if (!wrapper) return;

    var gap = 10;
    var isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    var scrollAmount;
    var firstCard = carousel.querySelector('.product-card');
    if (isMobile && firstCard) {
        scrollAmount = firstCard.offsetWidth + gap;
    } else {
        scrollAmount = (320 + gap) * 4;
    }

    var maxScroll = Math.max(0, carousel.scrollWidth - wrapper.offsetWidth);
    if (direction === 'left') {
        currentScrollOfertas = Math.max(0, currentScrollOfertas - scrollAmount);
    } else {
        currentScrollOfertas = Math.min(maxScroll, currentScrollOfertas + scrollAmount);
    }
    carousel.style.transition = 'transform 0.3s ease-out';
    carousel.style.transform = 'translateX(-' + currentScrollOfertas + 'px)';
    actualizarFlechasOfertas();
}

function actualizarFlechasOfertas() {
    var carousel = document.getElementById('productsCarouselOfertas');
    var arrowLeft = document.getElementById('arrowLeftOfertas');
    var arrowRight = document.getElementById('arrowRightOfertas');
    if (!carousel || !arrowLeft || !arrowRight) return;
    var wrapper = carousel.parentElement;
    var maxScroll = Math.max(0, carousel.scrollWidth - wrapper.offsetWidth);
    arrowLeft.disabled = currentScrollOfertas <= 0;
    arrowRight.disabled = currentScrollOfertas >= maxScroll - 1;
}

let currentScrollColecciones = 0;

function scrollCarouselColecciones(direction) {
    var carousel = document.getElementById('coleccionesCarousel');
    if (!carousel) return;
    var wrapper = carousel.parentElement;
    if (!wrapper) return;

    var gap = 10;
    var firstCard = carousel.querySelector('.product-card');
    var scrollAmount = firstCard ? firstCard.offsetWidth + gap : 330;
    var maxScroll = Math.max(0, carousel.scrollWidth - wrapper.offsetWidth);

    if (direction === 'left') {
        currentScrollColecciones = Math.max(0, currentScrollColecciones - scrollAmount);
    } else {
        currentScrollColecciones = Math.min(maxScroll, currentScrollColecciones + scrollAmount);
    }
    carousel.style.transition = 'transform 0.3s ease-out';
    carousel.style.transform = 'translateX(-' + currentScrollColecciones + 'px)';
    actualizarFlechasColecciones();
}

function actualizarFlechasColecciones() {
    var carousel = document.getElementById('coleccionesCarousel');
    var arrowLeft = document.getElementById('coleccionesArrowLeft');
    var arrowRight = document.getElementById('coleccionesArrowRight');
    if (!carousel || !arrowLeft || !arrowRight) return;
    var wrapper = carousel.parentElement;
    var maxScroll = Math.max(0, carousel.scrollWidth - wrapper.offsetWidth);
    arrowLeft.disabled = currentScrollColecciones <= 0;
    arrowRight.disabled = currentScrollColecciones >= maxScroll - 1;
}

function configurarPlaceholdersImagenesInventario() {
    document.querySelectorAll('#inventario .coleccion-card-image img, #inventario .home-tile-photo-wrap img, #inventario-mujer .product-card-ver-mas-image-wrap img, #inventario .product-card-ver-mas-image-wrap img, #inventario-ofertas .product-card-ver-mas-image-wrap img').forEach(function(img) {
        function marcarPlaceholder() {
            var contenedor = img.closest('.coleccion-card-image') || img.closest('.home-tile-photo-wrap') || img.closest('.product-card-ver-mas-image-wrap');
            if (contenedor) contenedor.classList.add('is-placeholder');
            img.remove();
        }
        img.addEventListener('error', marcarPlaceholder);
        if (img.complete && img.naturalWidth === 0) marcarPlaceholder();
    });
}

function inicializarCarouselColecciones() {
    var carousel = document.getElementById('coleccionesCarousel');
    var wrapper = document.getElementById('coleccionesCarouselWrapper');
    var arrowLeft = document.getElementById('coleccionesArrowLeft');
    var arrowRight = document.getElementById('coleccionesArrowRight');

    configurarPlaceholdersImagenesInventario();

    if (!carousel || !wrapper) return;

    if (arrowLeft) arrowLeft.addEventListener('click', function() { scrollCarouselColecciones('left'); });
    if (arrowRight) arrowRight.addEventListener('click', function() { scrollCarouselColecciones('right'); });

    var touchStartX = 0;
    var scrollStart = 0;
    wrapper.addEventListener('touchstart', function(e) {
        touchStartX = e.touches[0].clientX;
        scrollStart = currentScrollColecciones;
        carousel.style.transition = 'none';
    }, { passive: true });
    wrapper.addEventListener('touchmove', function(e) {
        var deltaX = e.touches[0].clientX - touchStartX;
        var maxScroll = Math.max(0, carousel.scrollWidth - wrapper.offsetWidth);
        currentScrollColecciones = Math.max(0, Math.min(maxScroll, scrollStart - deltaX));
        carousel.style.transform = 'translateX(-' + currentScrollColecciones + 'px)';
        actualizarFlechasColecciones();
        e.preventDefault();
    }, { passive: false });
    wrapper.addEventListener('touchend', function() {
        carousel.style.transition = 'transform 0.3s ease-out';
        actualizarFlechasColecciones();
    }, { passive: true });

    var isDragging = false;
    var dragStartX = 0;
    var dragScrollStart = 0;
    wrapper.addEventListener('mousedown', function(e) {
        isDragging = true;
        dragStartX = e.clientX;
        dragScrollStart = currentScrollColecciones;
        carousel.style.transition = 'none';
        wrapper.style.cursor = 'grabbing';
        e.preventDefault();
    });
    window.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        var deltaX = e.clientX - dragStartX;
        var maxScroll = Math.max(0, carousel.scrollWidth - wrapper.offsetWidth);
        currentScrollColecciones = Math.max(0, Math.min(maxScroll, dragScrollStart - deltaX));
        carousel.style.transform = 'translateX(-' + currentScrollColecciones + 'px)';
        actualizarFlechasColecciones();
    });
    window.addEventListener('mouseup', function() {
        if (!isDragging) return;
        isDragging = false;
        carousel.style.transition = 'transform 0.3s ease-out';
        wrapper.style.cursor = 'grab';
        actualizarFlechasColecciones();
    });

    currentScrollColecciones = 0;
    carousel.style.transform = 'translateX(0)';
    actualizarFlechasColecciones();
    window.addEventListener('resize', actualizarFlechasColecciones);
}

function inicializarCarouselMujer() {
    const arrowLeft = document.getElementById('arrowLeftMujer');
    const arrowRight = document.getElementById('arrowRightMujer');
    const carousel = document.getElementById('productsCarouselMujer');
    const wrapper = carousel ? carousel.parentElement : null;

    if (arrowLeft) {
        arrowLeft.addEventListener('click', function() { scrollCarouselMujer('left'); });
    }
    if (arrowRight) {
        arrowRight.addEventListener('click', function() { scrollCarouselMujer('right'); });
    }

    // Deslizamiento t��ctil en m��vil: el carrusel sigue el dedo (igual que el de hombre)
    if (wrapper && carousel) {
        var touchStartXMujer = 0;
        var scrollStartMujer = 0;
        wrapper.addEventListener('touchstart', function(e) {
            touchStartXMujer = e.touches[0].clientX;
            scrollStartMujer = currentScrollMujer;
            carousel.style.transition = 'none';
        }, { passive: true });
        wrapper.addEventListener('touchmove', function(e) {
            var x = e.touches[0].clientX;
            var deltaX = x - touchStartXMujer;
            var maxScroll = Math.max(0, carousel.scrollWidth - wrapper.offsetWidth);
            currentScrollMujer = Math.max(0, Math.min(maxScroll, scrollStartMujer - deltaX));
            carousel.style.transform = 'translateX(-' + currentScrollMujer + 'px)';
            actualizarFlechasMujer();
            e.preventDefault();
        }, { passive: false });
        wrapper.addEventListener('touchend', function() {
            carousel.style.transition = 'transform 0.3s ease-out';
            actualizarFlechasMujer();
        }, { passive: true });
    }

    actualizarFlechasMujer();
    window.addEventListener('resize', actualizarFlechasMujer);
}

function inicializarCarouselOfertas() {
    var arrowLeft = document.getElementById('arrowLeftOfertas');
    var arrowRight = document.getElementById('arrowRightOfertas');
    var carousel = document.getElementById('productsCarouselOfertas');
    var wrapper = carousel ? carousel.parentElement : null;

    if (arrowLeft) {
        arrowLeft.addEventListener('click', function() { scrollCarouselOfertas('left'); });
    }
    if (arrowRight) {
        arrowRight.addEventListener('click', function() { scrollCarouselOfertas('right'); });
    }

    if (wrapper && carousel) {
        var touchStartXOfertas = 0;
        var scrollStartOfertas = 0;
        wrapper.addEventListener('touchstart', function(e) {
            touchStartXOfertas = e.touches[0].clientX;
            scrollStartOfertas = currentScrollOfertas;
            carousel.style.transition = 'none';
        }, { passive: true });
        wrapper.addEventListener('touchmove', function(e) {
            var deltaX = e.touches[0].clientX - touchStartXOfertas;
            var maxScroll = Math.max(0, carousel.scrollWidth - wrapper.offsetWidth);
            currentScrollOfertas = Math.max(0, Math.min(maxScroll, scrollStartOfertas - deltaX));
            carousel.style.transform = 'translateX(-' + currentScrollOfertas + 'px)';
            actualizarFlechasOfertas();
            e.preventDefault();
        }, { passive: false });
        wrapper.addEventListener('touchend', function() {
            carousel.style.transition = 'transform 0.3s ease-out';
            actualizarFlechasOfertas();
        }, { passive: true });
    }

    actualizarFlechasOfertas();
    window.addEventListener('resize', actualizarFlechasOfertas);
}

// Funci��n para manejar el scroll del carrusel
let currentScroll = 0;
let isDragging = false;
let startX = 0;
let scrollLeft = 0;
let hoverDirection = 0;
let hoverAnimationId = null;

function scrollCarousel(direction) {
    const carousel = document.getElementById('productsCarousel');
    if (!carousel) return;

    const gap = 10;
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    let scrollAmount;

    if (isMobile) {
        var firstCard = carousel.querySelector('.product-card');
        var productWidth = firstCard ? firstCard.offsetWidth : 200;
        scrollAmount = productWidth + gap;
    } else {
        scrollAmount = (320 + gap) * 4;
    }

    const maxScroll = Math.max(0, carousel.scrollWidth - carousel.parentElement.offsetWidth);

    if (direction === 'left') {
        currentScroll = Math.max(0, currentScroll - scrollAmount);
    } else {
        currentScroll = Math.min(maxScroll, currentScroll + scrollAmount);
    }

    carousel.style.transform = `translateX(-${currentScroll}px)`;
    actualizarFlechas();
}

// Funci��n para scroll con mouse (drag)
function inicializarScrollMouse() {
    const carousel = document.getElementById('productsCarousel');
    const wrapper = carousel ? carousel.parentElement : null;

    if (!wrapper || !carousel) return;

    wrapper.addEventListener('mousedown', (e) => {
        isDragging = true;
        wrapper.style.cursor = 'grabbing';
        hoverDirection = 0;
        if (hoverAnimationId) {
            cancelAnimationFrame(hoverAnimationId);
            hoverAnimationId = null;
        }
        startX = e.pageX - wrapper.offsetLeft;
        scrollLeft = currentScroll;
        carousel.style.transition = 'none';
    });

    wrapper.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            wrapper.style.cursor = 'grab';
            carousel.style.transition = 'transform 0.3s ease-out';
        }
        hoverDirection = 0;
        if (hoverAnimationId) {
            cancelAnimationFrame(hoverAnimationId);
            hoverAnimationId = null;
        }
    });

    wrapper.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            wrapper.style.cursor = 'grab';
            carousel.style.transition = 'transform 0.3s ease-out';
            actualizarFlechas();
        }
    });

    wrapper.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault();
            const x = e.pageX - wrapper.offsetLeft;
            const walk = (x - startX) * 2; // Velocidad del scroll
            const maxScroll = Math.max(0, carousel.scrollWidth - wrapper.offsetWidth);

            currentScroll = Math.max(0, Math.min(maxScroll, scrollLeft - walk));
            carousel.style.transform = `translateX(-${currentScroll}px)`;
            return;
        }

        const ratio = e.offsetX / wrapper.clientWidth;
        const newDirection = ratio > 0.8 ? 1 : ratio < 0.2 ? -1 : 0;

        if (newDirection !== hoverDirection) {
            hoverDirection = newDirection;
            if (hoverDirection !== 0 && !hoverAnimationId) {
                iniciarAutoScroll(wrapper, carousel);
            }
        }
    });
}

function iniciarAutoScroll(wrapper, carousel) {
    const velocidad = 10;
    const step = () => {
        if (hoverDirection === 0) {
            hoverAnimationId = null;
            return;
        }

        const maxScroll = Math.max(0, carousel.scrollWidth - wrapper.offsetWidth);
        currentScroll = Math.max(0, Math.min(maxScroll, currentScroll + hoverDirection * velocidad));
        carousel.style.transform = `translateX(-${currentScroll}px)`;
        actualizarFlechas();

        hoverAnimationId = requestAnimationFrame(step);
    };

    hoverAnimationId = requestAnimationFrame(step);
}

function actualizarFlechas() {
    const carousel = document.getElementById('productsCarousel');
    const arrowLeft = document.getElementById('arrowLeft');
    const arrowRight = document.getElementById('arrowRight');
    
    if (!carousel || !arrowLeft || !arrowRight) return;

    const wrapper = carousel.parentElement;
    const maxScroll = Math.max(0, carousel.scrollWidth - wrapper.offsetWidth);
    
    arrowLeft.disabled = currentScroll <= 0;
    arrowRight.disabled = currentScroll >= maxScroll - 1; // -1 para evitar problemas de redondeo
}

// Funci��n para inicializar el carrusel y controles
function inicializarCarousel() {
    // Inicializar flechas de navegaci��n
    const arrowLeft = document.getElementById('arrowLeft');
    const arrowRight = document.getElementById('arrowRight');
    
    if (arrowLeft) {
        arrowLeft.addEventListener('click', () => scrollCarousel('left'));
    }
    
    if (arrowRight) {
        arrowRight.addEventListener('click', () => scrollCarousel('right'));
    }

    // Deslizamiento libre en móvil: el carrusel sigue el dedo (arrastre táctil)
    const carousel = document.getElementById('productsCarousel');
    const wrapper = carousel ? carousel.parentElement : null;
    if (wrapper && carousel && !wrapper.dataset.touchCarouselBound) {
        wrapper.dataset.touchCarouselBound = '1';
        let touchStartX = 0;
        let scrollStart = 0;

        wrapper.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            scrollStart = currentScroll;
            carousel.style.transition = 'none';
        }, { passive: true });

        wrapper.addEventListener('touchmove', (e) => {
            const x = e.touches[0].clientX;
            const deltaX = x - touchStartX;
            const maxScroll = Math.max(0, carousel.scrollWidth - wrapper.offsetWidth);
            currentScroll = Math.max(0, Math.min(maxScroll, scrollStart - deltaX));
            carousel.style.transform = `translateX(-${currentScroll}px)`;
            actualizarFlechas();
            e.preventDefault();
        }, { passive: false });

        wrapper.addEventListener('touchend', () => {
            carousel.style.transition = 'transform 0.3s ease-out';
            actualizarFlechas();
        }, { passive: true });
    }

    // El bot��n "VER TODO" ahora redirige a productos.html

    // Actualizar flechas cuando cambie el tama?o de la ventana
    window.addEventListener('resize', () => {
        actualizarFlechas();
    });
}

// Funci��n para mostrar modal de restricci��n
function mostrarRestriccion() {
    const restrictionModal = document.getElementById('restrictionModal');
    if (restrictionModal) {
        restrictionModal.classList.add('active');
    }
}

// Funci��n para suavizar el scroll en los enlaces
function inicializarNavegacion() {
    const logoLink = document.getElementById('logoLink') || document.querySelector('.logo-link');
    
    if (logoLink) {
        logoLink.addEventListener('click', (e) => {
            const href = (logoLink.getAttribute('href') || '').trim();
            // Solo interceptar si el enlace es # (estamos en index): scroll suave al inicio
            if (href === '#' || href === '') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            // Si href es index.html u otra ruta, dejar que navegue con normalidad
        });
    }

    // Men�� m��vil en todas las p��ginas que tengan el bot��n (index, productos, producto)
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileNav = document.getElementById('mobileNav');
    
    if (mobileMenuBtn && mobileNav) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = mobileNav.classList.contains('active');
            if (isOpen) {
                mobileMenuBtn.classList.remove('active');
                mobileNav.classList.remove('active');
                document.body.classList.remove('mobile-menu-open');
            } else {
                mobileMenuBtn.classList.add('active');
                mobileNav.classList.add('active');
                document.body.classList.add('mobile-menu-open');
            }
        }, true);

        // Cerrar men�� al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!mobileMenuBtn.contains(e.target) && !mobileNav.contains(e.target)) {
                mobileMenuBtn.classList.remove('active');
                mobileNav.classList.remove('active');
                document.body.classList.remove('mobile-menu-open');
            }
        });
    }

    // Bot��n "Hombre" en el header (desktop y mobile)
    const btnHombre = document.getElementById('btnHombre');
    const btnHombreMobile = document.getElementById('btnHombreMobile');
    
    if (btnHombre) {
        btnHombre.addEventListener('click', () => {
            window.location.href = 'productos.html?categoria=Hombre';
        });
    }
    
    if (btnHombreMobile) {
        btnHombreMobile.addEventListener('click', () => {
            window.location.href = 'productos.html?categoria=Hombre';
            if (mobileMenuBtn && mobileNav) {
                mobileMenuBtn.classList.remove('active');
                mobileNav.classList.remove('active');
            }
        });
    }

    // Bot��n "Mujer" es un <a href="productos.html?categoria=Mujer">: no interceptar el clic
    // para que funcione siempre (localhost y en l��nea) sin depender de JavaScript.
    const btnMujerMobile = document.getElementById('btnMujerMobile');
    if (btnMujerMobile && mobileMenuBtn && mobileNav) {
        btnMujerMobile.addEventListener('click', () => {
            mobileMenuBtn.classList.remove('active');
            mobileNav.classList.remove('active');
            document.body.classList.remove('mobile-menu-open');
        });
    }

    // Enlaces del hero: ambos van a la tienda en la misma pesta?a
    const heroLinks = document.querySelectorAll('.hero-link');
    
    heroLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const categoria = link.getAttribute('data-category');
            if (categoria === 'Mujer') {
                e.preventDefault();
                window.location.href = 'productos.html?categoria=Mujer';
                return;
            }
        });
    });

    // Cerrar modal de restricci��n
    const closeRestrictionBtn = document.getElementById('closeRestrictionBtn');
    const restrictionModal = document.getElementById('restrictionModal');
    
    if (closeRestrictionBtn && restrictionModal) {
        closeRestrictionBtn.addEventListener('click', () => {
            restrictionModal.classList.remove('active');
        });
        
        // Cerrar al hacer clic fuera del modal
        restrictionModal.addEventListener('click', (e) => {
            if (e.target === restrictionModal) {
                restrictionModal.classList.remove('active');
            }
        });
    }
}

// Funci��n para rotar mensajes promocionales
function inicializarPromoBar() {
    const messages = document.querySelectorAll('.promo-message');
    let currentIndex = 0;

    function cambiarMensaje() {
        // Agregar clase exit al mensaje actual para que salga hacia arriba
        messages[currentIndex].classList.remove('active');
        messages[currentIndex].classList.add('exit');
        
        // Avanzar al siguiente mensaje
        currentIndex = (currentIndex + 1) % messages.length;
        
        // Remover clases del nuevo mensaje y agregar active
        messages[currentIndex].classList.remove('exit');
        messages[currentIndex].classList.add('active');
        
        // Limpiar clase exit del mensaje anterior despu��s de la transici��n
        setTimeout(() => {
            const previousIndex = (currentIndex - 1 + messages.length) % messages.length;
            messages[previousIndex].classList.remove('exit');
        }, 600);
    }

    // Cambiar mensaje cada 5 segundos
    setInterval(cambiarMensaje, 5000);
}

// Fijar altura del hero en p��xeles para que no se estire al hacer scroll (navegador in-app de Instagram, etc.)
var heroHeightLock = null;

function fijarAlturaHero() {
    const hero = document.querySelector('section.hero');
    if (!hero) return;
    hero.style.removeProperty('height');
    hero.style.removeProperty('min-height');
    hero.style.removeProperty('max-height');
    heroHeightLock = null;
}

// Si el navegador (ej. Instagram in-app) cambia el tama?o del hero al hacer scroll, volver a fijarlo
function instalarResizeObserverHero() {
    const hero = document.querySelector('section.hero');
    if (!hero || heroHeightLock == null || typeof ResizeObserver === 'undefined') return;
    var ro = new ResizeObserver(function() {
        if (heroHeightLock == null) return;
        var current = hero.getBoundingClientRect().height;
        if (Math.abs(current - heroHeightLock) > 3) {
            hero.style.setProperty('height', heroHeightLock + 'px', 'important');
            hero.style.setProperty('min-height', heroHeightLock + 'px', 'important');
            hero.style.setProperty('max-height', heroHeightLock + 'px', 'important');
        }
    });
    ro.observe(hero);
}

function obtenerCatalogoCompletoOfertas() {
    var todos = [];
    if (typeof productosHombre !== 'undefined' && Array.isArray(productosHombre)) {
        todos = todos.concat(productosHombre);
    } else if (Array.isArray(productos)) {
        todos = todos.concat(productos);
    }
    if (typeof productosMujer !== 'undefined' && Array.isArray(productosMujer)) {
        todos = todos.concat(productosMujer);
    }
    return todos;
}

function obtenerProductosOfertaSemanalHero() {
    if (typeof obtenerProductosOfertaSemanal === 'function') {
        return obtenerProductosOfertaSemanal(2);
    }
    return [];
}

function urlDetalleProductoHero(producto) {
    if (typeof construirUrlDetalleProductoOfertaSemanal === 'function') {
        return construirUrlDetalleProductoOfertaSemanal(producto);
    }
    if (typeof construirUrlDetalleProducto === 'function') {
        return construirUrlDetalleProducto(producto, { desdeOfertasSemanales: true });
    }
    var url = 'producto.html?id=' + encodeURIComponent(producto.id);
    if (producto.categoria === 'Mujer') url += '&categoria=Mujer';
    return url;
}

function htmlPrecioHeroOferta(producto) {
    if (typeof htmlPrecioListadoProducto === 'function') {
        return htmlPrecioListadoProducto(producto, { sinBadgeOferta: true })
            .replace('product-price product-price-oferta-semanal', 'hero-oferta-card-prices product-price-oferta-semanal')
            .replace('<p class="product-price">', '<p class="hero-oferta-card-prices">');
    }
    var retail = Number(producto.precio) || 0;
    var oferta = typeof precioOfertaSemanalProducto === 'function'
        ? precioOfertaSemanalProducto(producto)
        : Math.round(retail * 0.75 * 100) / 100;
    if (oferta > 0 && retail > oferta) {
        return '<p class="hero-oferta-card-prices">'
            + '<span class="product-price-retail">$' + formatearPrecio(retail) + '</span>'
            + '<span class="product-price-wholesale">$' + formatearPrecio(oferta) + '</span>'
            + '</p>';
    }
    return '<p class="hero-oferta-card-prices"><span class="product-price-wholesale">$' + formatearPrecio(typeof precioVigenteProducto === 'function' ? precioVigenteProducto(producto) : retail) + '</span></p>';
}

function crearTarjetaHeroOferta(producto) {
    var card = document.createElement('a');
    card.className = 'hero-oferta-card';
    card.href = urlDetalleProductoHero(producto);
    card.setAttribute('aria-label', 'Ver oferta: ' + producto.nombre);

    var media = document.createElement('div');
    media.className = 'hero-oferta-card-media';
    var imgSrc = obtenerRutaImagenProducto(producto, 1);
    if (imgSrc) {
        var img = document.createElement('img');
        img.src = imgSrc;
        img.alt = producto.nombre;
        img.loading = 'lazy';
        media.appendChild(img);
    }

    var pctHero = typeof porcentajeDescuentoOfertaSemanalProducto === 'function'
        ? porcentajeDescuentoOfertaSemanalProducto(producto)
        : 0;
    if (pctHero > 0) {
        var badgeHero = document.createElement('span');
        badgeHero.className = 'product-card-oferta-badge hero-oferta-card-badge';
        badgeHero.textContent = '-' + pctHero + '%';
        media.appendChild(badgeHero);
    }

    var body = document.createElement('div');
    body.className = 'hero-oferta-card-body';
    body.innerHTML = '<h3 class="hero-oferta-card-name"></h3>';
    body.querySelector('.hero-oferta-card-name').textContent = producto.nombre;
    body.insertAdjacentHTML('beforeend', htmlPrecioHeroOferta(producto));

    card.appendChild(media);
    card.appendChild(body);
    return card;
}

function crearPlaceholderHeroOferta(texto) {
    var el = document.createElement('div');
    el.className = 'hero-oferta-card hero-oferta-card--placeholder';
    el.innerHTML = '<span>' + (texto || 'Próxima oferta') + '</span>';
    return el;
}

function actualizarHeroOfertasSemanales() {
    var grid = document.getElementById('heroOfertasGrid');
    if (!grid) return;
    grid.innerHTML = '';
    var ofertas = obtenerProductosOfertaSemanalHero();
    for (var i = 0; i < 2; i++) {
        if (ofertas[i]) {
            grid.appendChild(crearTarjetaHeroOferta(ofertas[i]));
        } else {
            grid.appendChild(crearPlaceholderHeroOferta('Pon el precio de oferta en la columna Y'));
        }
    }
}

window.actualizarHeroOfertasSemanales = actualizarHeroOfertasSemanales;

var heroCarruselControl = null;

function inicializarHeroCarrusel() {
    var slides = document.querySelectorAll('.hero-slide');
    if (!slides.length) return;

    actualizarHeroOfertasSemanales();

    var navArrows = document.getElementById('heroNavArrows');
    if (slides.length <= 1) {
        if (navArrows) {
            navArrows.classList.add('hero-nav-arrows--hidden');
            navArrows.setAttribute('aria-hidden', 'true');
        }
        return;
    }

    if (navArrows) {
        navArrows.classList.remove('hero-nav-arrows--hidden');
        navArrows.setAttribute('aria-hidden', 'false');
    }

    if (heroCarruselControl && typeof heroCarruselControl.destruir === 'function') {
        heroCarruselControl.destruir();
    }

    var indice = 0;
    var arrowLeft = document.getElementById('heroArrowLeft');
    var arrowRight = document.getElementById('heroArrowRight');
    var hero = document.querySelector('section.hero');
    var welcome = document.getElementById('heroWelcomeContent');
    var autoplayMs = 3000;
    var timer = null;

    function actualizarOverlay() {
        if (!welcome) return;
        var slide = slides[indice];
        var esPortada = slide && slide.getAttribute('data-hero-slide') === 'portada';
        welcome.classList.toggle('is-hidden', !esPortada);
        welcome.setAttribute('aria-hidden', esPortada ? 'false' : 'true');
    }

    function reiniciarAutoplay() {
        if (timer) clearInterval(timer);
        if (slides.length <= 1) return;
        timer = setInterval(function() {
            mostrar(indice + 1);
        }, autoplayMs);
    }

    function mostrar(nuevoIndice) {
        slides[indice].classList.remove('active');
        indice = (nuevoIndice + slides.length) % slides.length;
        slides[indice].classList.add('active');
        actualizarOverlay();
        reiniciarAutoplay();
    }

    actualizarOverlay();
    reiniciarAutoplay();

    function onArrowLeft(e) {
        e.preventDefault();
        e.stopPropagation();
        mostrar(indice - 1);
    }

    function onArrowRight(e) {
        e.preventDefault();
        e.stopPropagation();
        mostrar(indice + 1);
    }

    if (arrowLeft) {
        arrowLeft.removeEventListener('click', heroCarruselControl && heroCarruselControl.onArrowLeft);
        arrowLeft.addEventListener('click', onArrowLeft);
    }

    if (arrowRight) {
        arrowRight.removeEventListener('click', heroCarruselControl && heroCarruselControl.onArrowRight);
        arrowRight.addEventListener('click', onArrowRight);
    }

    var touchStartX = 0;
    function onTouchStart(e) {
        if (e.touches.length === 1) touchStartX = e.touches[0].clientX;
    }
    function onTouchEnd(e) {
        if (!e.changedTouches.length) return;
        var delta = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(delta) < 50) return;
        if (delta < 0) mostrar(indice + 1);
        else mostrar(indice - 1);
    }

    if (hero) {
        hero.removeEventListener('touchstart', heroCarruselControl && heroCarruselControl.onTouchStart);
        hero.removeEventListener('touchend', heroCarruselControl && heroCarruselControl.onTouchEnd);
        hero.addEventListener('touchstart', onTouchStart, { passive: true });
        hero.addEventListener('touchend', onTouchEnd, { passive: true });
    }

    heroCarruselControl = {
        onArrowLeft: onArrowLeft,
        onArrowRight: onArrowRight,
        onTouchStart: onTouchStart,
        onTouchEnd: onTouchEnd,
        destruir: function() {
            if (timer) clearInterval(timer);
            timer = null;
            if (arrowLeft) arrowLeft.removeEventListener('click', onArrowLeft);
            if (arrowRight) arrowRight.removeEventListener('click', onArrowRight);
            if (hero) {
                hero.removeEventListener('touchstart', onTouchStart);
                hero.removeEventListener('touchend', onTouchEnd);
            }
        }
    };
}

// Al volver atr��s (bfcache), refrescar im��genes de productos para evitar "?" o imagen rota en m��vil
window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    const carousel = document.getElementById('productsCarousel');
    if (!carousel) return;
    carousel.querySelectorAll('.product-card .product-image').forEach(container => {
        const src = container.dataset.img1;
        const alt = container.dataset.alt;
        if (src && container.dataset.type === 'img') {
            container.innerHTML = '';
            const img = document.createElement('img');
            img.src = src;
            img.alt = alt || '';
            img.loading = 'lazy';
            container.appendChild(img);
        }
    });
});

// Inicializar cuando el DOM esta listo (solo en index; en productos/producto lo hace productos.js)
function arrancarIndexPagina() {
    if (window.__obebeIndexIniciado) return;
    window.__obebeIndexIniciado = true;

    const isIndexPage = document.getElementById('inicio') || document.querySelector('section.hero');
    if (!isIndexPage) return;

    var esInstagramInApp = /Instagram|FB_IAB|FBAV/i.test(navigator.userAgent);
    if (esInstagramInApp) {
        fijarAlturaHero();
        setTimeout(function() { fijarAlturaHero(); instalarResizeObserverHero(); }, 150);
        window.addEventListener('resize', fijarAlturaHero);
        window.addEventListener('orientationchange', function() { setTimeout(fijarAlturaHero, 100); });
    }
    inicializarHoverCarruselHombre();
    actualizarEtiquetaNuevoStock();
    renderizarCarruselHombre('Hombre', false);
    if (typeof productosMujer !== 'undefined') renderizarProductosMujer();
    renderizarCarruselOfertas();
    inicializarCarousel();
    inicializarCarouselColecciones();
    inicializarNavegacion();
    inicializarPromoBar();
    actualizarHeroOfertasSemanales();
    inicializarHeroCarrusel();
    const cartIconBtn = document.getElementById('cartIconBtn');
    const cartModal = document.getElementById('cartModal');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (cartIconBtn && cartModal && typeof renderizarCarrito === 'function') {
        cartIconBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            renderizarCarrito();
            cartModal.classList.add('active');
        });
    }
    if (cartModal && closeCartBtn) {
        closeCartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            cartModal.classList.remove('active');
        });
        function handleCartModalClick(e) {
            const removeBtn = e.target.closest('[data-cart-remove]');
            if (removeBtn && typeof eliminarDelCarrito === 'function') {
                e.preventDefault();
                e.stopPropagation();
                const id = parseInt(removeBtn.getAttribute('data-id'), 10);
                const talla = removeBtn.getAttribute('data-talla') || '';
                const color = removeBtn.getAttribute('data-color') || '';
                eliminarDelCarrito(id, talla, color);
                return;
            }
            if (e.target === cartModal) cartModal.classList.remove('active');
        }
        cartModal.addEventListener('click', handleCartModalClick);
        cartModal.addEventListener('touchend', handleCartModalClick, { passive: false });
    }
    if (clearCartBtn && typeof vaciarCarrito === 'function') {
        clearCartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            vaciarCarrito();
        });
    }
    if (checkoutBtn && typeof enviarMensajeWhatsApp === 'function') {
        checkoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            enviarMensajeWhatsApp();
        });
    }
    if (typeof actualizarBadgeCarrito === 'function') {
        actualizarBadgeCarrito();
    }

    if (typeof inicializarCarouselMujer === 'function') inicializarCarouselMujer();
    if (typeof inicializarCarouselOfertas === 'function') inicializarCarouselOfertas();
}

document.addEventListener('obebe-scripts-ready', arrancarIndexPagina);

// Al volver atr��s (ej. desde productos.html) o abrir desde Instagram, la p��gina puede restaurarse desde bfcache
// y DOMContentLoaded no se ejecuta de nuevo. pageshow s�� se dispara: actualizar badge y altura del hero (solo Instagram).
window.addEventListener('pageshow', (event) => {
    const isIndexPage = document.getElementById('inicio') || document.querySelector('section.hero');
    if (isIndexPage) {
        if (/Instagram|FB_IAB|FBAV/i.test(navigator.userAgent) && typeof fijarAlturaHero === 'function') fijarAlturaHero();
        if (typeof actualizarBadgeCarrito === 'function') actualizarBadgeCarrito();
    }
});
