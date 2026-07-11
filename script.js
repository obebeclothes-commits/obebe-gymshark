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


function esRutaImagen(valor) {
    return /\.(png|jpe?g|webp|gif|svg)$/i.test(valor);
}

/** Usa rutas del catálogo o convención hombre|mujer/{id}.webp si faltan. */
function obtenerRutaImagenProducto(producto, numero) {
    var guardada = numero === 2 ? (producto.imagen2 || '') : (producto.imagen1 || '');
    if (guardada && esRutaImagen(guardada)) return guardada;
    if (numero !== 1 || !producto || !producto.id) return '';
    var carpeta = (producto.categoria === 'Mujer') ? 'mujer' : 'hombre';
    return carpeta + '/' + producto.id + '.webp';
}

function candidatosImagen(fuente) {
    if (!fuente) return [];
    var base = fuente.replace(/\.(png|jpe?g|webp)$/i, '');
    return [fuente, base + '.webp', base + '.png', base + '.jpeg', base + '.jpg']
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

/** Productos con columna U = 1..8, ordenados por posición (máx. 8 por carrusel). */
function obtenerProductosParaCarrusel(catalogo, categoria) {
    var slots = new Array(8);
    if (!Array.isArray(catalogo)) return [];
    catalogo.forEach(function(p) {
        if (p.categoria !== categoria && p.categoria !== 'Unisex') return;
        if (Number(p.stock) <= 0) return;
        var pos = parseInt(p.posicionCarrusel, 10);
        if (pos >= 1 && pos <= 8) slots[pos - 1] = p;
    });
    var resultado = [];
    for (var i = 0; i < slots.length; i++) {
        if (slots[i]) resultado.push(slots[i]);
    }
    return resultado;
}

function inicializarHoverCarruselHombre() {
    const carousel = document.getElementById('productsCarousel');
    if (!carousel) return;

    carousel.addEventListener('mouseover', (e) => {
        const card = e.target.closest('.product-card');
        if (!card || card.dataset.hovered === 'true') return;
        card.dataset.hovered = 'true';
        const imgContainer = card.querySelector('.product-image');
        if (imgContainer && imgContainer.dataset.img2) {
            renderizarImagenProducto(imgContainer, imgContainer.dataset.img2, { noOcultarSiFalla: true });
        }
    });

    carousel.addEventListener('mouseout', (e) => {
        const card = e.target.closest('.product-card');
        if (!card) return;
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

        card.appendChild(imageWrap);

        const info = document.createElement('div');
        info.className = 'product-info';
        const btnTexto = agotado ? 'Agotado' : 'Agregar al Carrito';
        const btnClase = 'add-to-cart-carousel' + (agotado ? ' agotado' : '');
        info.innerHTML = `
            <h3 class="product-name">${producto.nombre}</h3>
            <p class="product-size">Talla: ${producto.talla}</p>
            <p class="product-price">$${formatearPrecio(producto.precio)}</p>
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

        card.appendChild(imageWrap);

        const info = document.createElement('div');
        info.className = 'product-info';
        const btnTexto = agotado ? 'Agotado' : 'Agregar al Carrito';
        const btnClase = 'add-to-cart-carousel' + (agotado ? ' agotado' : '');
        info.innerHTML = '<h3 class="product-name">' + producto.nombre + '</h3><p class="product-size">Talla: ' + producto.talla + '</p><p class="product-price">$' + (producto.precio ? formatearPrecio(producto.precio) : '0') + '</p><button type="button" class="' + btnClase + '" data-product-id="' + producto.id + '" ' + (agotado ? ' disabled' : '') + '>' + btnTexto + '</button>';

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

    // Hover segunda imagen en carrusel mujer
    carousel.addEventListener('mouseover', function(e) {
        const card = e.target.closest('.product-card');
        if (!card || card.dataset.hovered === 'true') return;
        card.dataset.hovered = 'true';
        const imgContainer = card.querySelector('.product-image');
        if (imgContainer && imgContainer.dataset.img2) {
            renderizarImagenProducto(imgContainer, imgContainer.dataset.img2, { noOcultarSiFalla: true });
        }
    });
    carousel.addEventListener('mouseout', function(e) {
        const card = e.target.closest('.product-card');
        if (!card) return;
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
    const wrapper = document.querySelector('.products-carousel-wrapper');
    const carousel = document.getElementById('productsCarousel');
    
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

    // Deslizamiento libre en m��vil: el carrusel sigue el dedo (arrastre t��ctil)
    const wrapper = document.querySelector('.products-carousel-wrapper');
    const carousel = document.getElementById('productsCarousel');
    if (wrapper && carousel) {
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

// Funci��n para rotar videos del hero
function inicializarHeroCarrusel() {
    var slides = document.querySelectorAll('.hero-slide');
    if (!slides.length) return;

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

    var indice = 0;
    var arrowLeft = document.getElementById('heroArrowLeft');
    var arrowRight = document.getElementById('heroArrowRight');

    function mostrar(nuevoIndice) {
        slides[indice].classList.remove('active');
        indice = (nuevoIndice + slides.length) % slides.length;
        slides[indice].classList.add('active');
    }

    if (arrowLeft) {
        arrowLeft.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            mostrar(indice - 1);
        });
    }

    if (arrowRight) {
        arrowRight.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            mostrar(indice + 1);
        });
    }

    var hero = document.querySelector('section.hero');
    if (hero) {
        var touchStartX = 0;
        hero.addEventListener('touchstart', function(e) {
            if (e.touches.length === 1) touchStartX = e.touches[0].clientX;
        }, { passive: true });
        hero.addEventListener('touchend', function(e) {
            if (!e.changedTouches.length) return;
            var delta = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(delta) < 50) return;
            if (delta < 0) mostrar(indice + 1);
            else mostrar(indice - 1);
        }, { passive: true });
    }
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

// Inicializar cuando el DOM est�� listo (solo en index; en productos/producto lo hace productos.js)
document.addEventListener('DOMContentLoaded', () => {
    const iniciarIndex = () => {
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
        renderizarProductosMujer();
        inicializarCarousel();
        inicializarCarouselMujer();
        inicializarNavegacion();
        inicializarPromoBar();
        inicializarHeroCarrusel();
        // Asegurar eventos del modal del carrito en index (complementa productos.js)
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
        // Asegurar que el badge del carrito muestre el n��mero al volver desde productos
        if (typeof actualizarBadgeCarrito === 'function') {
            actualizarBadgeCarrito();
        }
    };

    const isIndexPage = document.getElementById('inicio') || document.querySelector('section.hero');
    if (!isIndexPage) return;

    const run = () => iniciarIndex();
    if (typeof sincronizarStockDesdeSheets === 'function') {
        sincronizarStockDesdeSheets().then(run);
    } else {
        run();
    }
});

// Al volver atr��s (ej. desde productos.html) o abrir desde Instagram, la p��gina puede restaurarse desde bfcache
// y DOMContentLoaded no se ejecuta de nuevo. pageshow s�� se dispara: actualizar badge y altura del hero (solo Instagram).
window.addEventListener('pageshow', (event) => {
    const isIndexPage = document.getElementById('inicio') || document.querySelector('section.hero');
    if (isIndexPage) {
        if (/Instagram|FB_IAB|FBAV/i.test(navigator.userAgent) && typeof fijarAlturaHero === 'function') fijarAlturaHero();
        if (typeof actualizarBadgeCarrito === 'function') actualizarBadgeCarrito();
    }
});
