// Base de datos de productos GymShark
const productos = [
    {
        id: 1,
        nombre: "Fit Repeat 6 - Shorts",
        categoria: "Hombre",
        precio: 500.00,
        stock: 1,
        imagen1: "1.jpeg",
        imagen2: "1.1.jpeg",
        talla: "M - Slim Fit",
        tallaBase: "M",
        tipo: "Shorts",
        color: "Verde"
    },
    {
        id: 1,
        nombre: "Fit Repeat 6 - Shorts",
        categoria: "Hombre",
        precio: 500.00,
        stock: 0,
        imagen1: "1.jpeg",
        imagen2: "1.1.jpeg",
        talla: "L - Slim Fit",
        tallaBase: "M",
        tipo: "Shorts",
        color: "Verde"
    },
    {
        id: 2,
        nombre: "GSLC - Hoodie",
        categoria: "Hombre",
        precio: 800.00,
        stock: 1,
        imagen1: "2.jpeg",
        imagen2: "",
        talla: "L - Extreme Oversized",
        tallaBase: "L",
        tipo: "Hoodie",
        color: "Gris"
    },
    {
        id: 3,
        nombre: "Ligthweight Seamless - Tshirt",
        categoria: "Hombre",
        precio: 500.00,
        stock: 1,
        imagen1: "3.jpeg",
        imagen2: "",
        talla: "M - Regular Fit",
        tallaBase: "M",
        tipo: "Tshirt",
        color: "Negro"
    },
    {
        id: 4,
        nombre: "Sport 5 - Short",
        categoria: "Hombre",
        precio: 500.00,
        stock: 1,
        imagen1: "4.jpeg",
        imagen2: "",
        talla: "M - Slim Fit",
        tallaBase: "M",
        tipo: "Short",
        color: "Cafe"
    },
    {
        id: 5,
        nombre: "Collegiate - Short",
        categoria: "Hombre",
        precio: 500.00,
        stock: 1,
        imagen1: "5.jpeg",
        imagen2: "",
        talla: "L - Regular Fit",
        tallaBase: "L",
        tipo: "Short",
        color: "Gris"
    },
    {
        id: 6,
        nombre: "Coonditioning - Tshirt",
        categoria: "Hombre",
        precio: 500.00,
        stock: 1,
        imagen1: "6.jpeg",
        imagen2: "",
        talla: "M - Regular Fit",
        tallaBase: "M",
        tipo: "Tshirt",
        color: "Gris"
    },
    {
        id: 7,
        nombre: "Olympic Bar - Tshirt",
        categoria: "Hombre",
        precio: 500.00,
        stock: 1,
        imagen1: "7.jpeg",
        imagen2: "",
        talla: "L - Oversized Fit",
        tallaBase: "L",
        tipo: "Tshirt",
        color: "Negro"
    },
    {
        id: 8,
        nombre: "Olympic Bar - Tank",
        categoria: "Hombre",
        precio: 500.00,
        stock: 1,
        imagen1: "8.jpeg",
        imagen2: "",
        talla: "M - Oversized",
        tallaBase: "M",
        tipo: "Tank",
        color: "Gris"
    },
    {
        id: 9,
        nombre: "Conditioning - Tshirt",
        categoria: "Hombre",
        precio: 500.00,
        stock: 0,
        imagen1: "9.jpeg",
        imagen2: "",
        talla: "L - Regular Fit",
        tallaBase: "L",
        tipo: "Tshirt",
        color: "Negro"
    },
    {
        id: 10,
        nombre: "Arrival 7 - Short",
        categoria: "Hombre",
        precio: 500.00,
        stock: 1,
        imagen1: "10.jpeg",
        imagen2: "",
        talla: "L - Slim Fit",
        tallaBase: "L",
        tipo: "Short",
        color: "Blanco"
    },
    {
        id: 11,
        nombre: "Collegiate - Short",
        categoria: "Hombre",
        precio: 600.00,
        stock: 1,
        imagen1: "11.jpeg",
        imagen2: "",
        talla: "L - Regular Fit",
        tallaBase: "L",
        tipo: "Short",
        color: "Gris"
    }
];

function esRutaImagen(valor) {
    return /\.(png|jpe?g|webp|gif|svg)$/i.test(valor);
}

function renderizarImagenProducto(contenedor, fuente) {
    if (contenedor.dataset.type === 'img') {
        contenedor.innerHTML = `<img src="${fuente}" alt="${contenedor.dataset.alt}" loading="lazy">`;
        return;
    }

    contenedor.textContent = fuente;
}

function inicializarHoverImagenes() {
    const carousel = document.getElementById('productsCarousel');
    if (!carousel) return;

    carousel.addEventListener('mouseover', (e) => {
        const card = e.target.closest('.product-card');
        if (!card || card.dataset.hovered === 'true') return;
        card.dataset.hovered = 'true';
        const imgContainer = card.querySelector('.product-image');
        if (imgContainer && imgContainer.dataset.img2) {
            renderizarImagenProducto(imgContainer, imgContainer.dataset.img2);
        }
    });

    carousel.addEventListener('mouseout', (e) => {
        const card = e.target.closest('.product-card');
        if (!card) return;
        // Verificar si el mouse realmente salió de la tarjeta
        const related = e.relatedTarget;
        if (related && card.contains(related)) return;
        card.dataset.hovered = 'false';
        const imgContainer = card.querySelector('.product-image');
        if (imgContainer && imgContainer.dataset.img1) {
            renderizarImagenProducto(imgContainer, imgContainer.dataset.img1);
        }
    });
}

// Función para renderizar productos en el carrusel
function renderizarProductos(categoria = 'Hombre', mostrarTodos = false) {
    const productsCarousel = document.getElementById('productsCarousel');
    if (!productsCarousel) return;
    
    productsCarousel.innerHTML = '';

    let productosFiltrados = productos.filter(p => p.categoria === categoria || p.categoria === 'Unisex');
    
    // Si no es "mostrar todos", limitar a 8 productos (4 visibles + 4 más)
    if (!mostrarTodos && productosFiltrados.length > 8) {
        productosFiltrados = productosFiltrados.slice(0, 8);
    }

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

        const imagen1 = producto.imagen1 || '';
        const tieneSegundaImagen = producto.imagen2 && String(producto.imagen2).trim() !== '';
        const esImagen = esRutaImagen(imagen1);

        const imageWrap = document.createElement('div');
        imageWrap.className = 'product-image-wrap' + (agotado ? ' out-of-stock' : '');

        const imageContainer = document.createElement('div');
        imageContainer.className = 'product-image';
        imageContainer.dataset.img1 = imagen1;
        if (tieneSegundaImagen) imageContainer.dataset.img2 = producto.imagen2;
        imageContainer.dataset.type = esImagen ? 'img' : 'emoji';
        imageContainer.dataset.alt = producto.nombre;
        renderizarImagenProducto(imageContainer, imagen1);
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
            <p class="product-price">$${producto.precio.toFixed(2)}</p>
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

// Función para manejar el scroll del carrusel
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

// Función para scroll con mouse (drag)
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

// Función para inicializar el carrusel y controles
function inicializarCarousel() {
    // Inicializar flechas de navegación
    const arrowLeft = document.getElementById('arrowLeft');
    const arrowRight = document.getElementById('arrowRight');
    
    if (arrowLeft) {
        arrowLeft.addEventListener('click', () => scrollCarousel('left'));
    }
    
    if (arrowRight) {
        arrowRight.addEventListener('click', () => scrollCarousel('right'));
    }

    // Deslizamiento libre en móvil: el carrusel sigue el dedo (arrastre táctil)
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

    // El botón "VER TODO" ahora redirige a productos.html

    // Actualizar flechas cuando cambie el tamaño de la ventana
    window.addEventListener('resize', () => {
        actualizarFlechas();
    });
}

// Función para mostrar modal de restricción
function mostrarRestriccion() {
    const restrictionModal = document.getElementById('restrictionModal');
    if (restrictionModal) {
        restrictionModal.classList.add('active');
    }
}

// Función para suavizar el scroll en los enlaces
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

    // Menú móvil en todas las páginas que tengan el botón (index, productos, producto)
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

        // Cerrar menú al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!mobileMenuBtn.contains(e.target) && !mobileNav.contains(e.target)) {
                mobileMenuBtn.classList.remove('active');
                mobileNav.classList.remove('active');
                document.body.classList.remove('mobile-menu-open');
            }
        });
    }

    // Botón "Hombre" en el header (desktop y mobile)
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

    // Botón "Mujer" en el header - mostrar restricción (desktop y mobile)
    const btnMujer = document.getElementById('btnMujer');
    const btnMujerMobile = document.getElementById('btnMujerMobile');
    
    if (btnMujer) {
        btnMujer.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mostrarRestriccion();
            return false;
        });
    }
    
    if (btnMujerMobile) {
        btnMujerMobile.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mostrarRestriccion();
            if (mobileMenuBtn && mobileNav) {
                mobileMenuBtn.classList.remove('active');
                mobileNav.classList.remove('active');
            }
            return false;
        });
    }

    // Enlaces del hero
    const heroLinks = document.querySelectorAll('.hero-link');
    
    heroLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const categoria = link.getAttribute('data-category');
            
            // Si es "Mujer", mostrar restricción
            if (categoria === 'Mujer') {
                e.preventDefault();
                mostrarRestriccion();
                return;
            }
            
            // Si es "Hombre", ya tiene href="productos.html?categoria=Hombre" y se maneja automáticamente
            // No necesitamos prevenir el comportamiento por defecto
        });
    });

    // Cerrar modal de restricción
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

// Función para rotar mensajes promocionales
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
        
        // Limpiar clase exit del mensaje anterior después de la transición
        setTimeout(() => {
            const previousIndex = (currentIndex - 1 + messages.length) % messages.length;
            messages[previousIndex].classList.remove('exit');
        }, 600);
    }

    // Cambiar mensaje cada 5 segundos
    setInterval(cambiarMensaje, 5000);
}

// Función para rotar videos del hero
function inicializarHeroVideos() {
    const videos = document.querySelectorAll('.hero-video');
    let currentVideoIndex = 0;
    let videoTimer = null;
    let preloadTimer = null;

    // Duración específica para cada video (en milisegundos)
    const duraciones = {
        0: 4500, // Video 1: 4.5 segundos
        1: 4100, // Video 2: 4.1 segundos (mantener)
        2: 3500, // Video 3: 3.5 segundos
        3: 4000, // Video 4: 4 segundos
        4: 4000  // Video 5: 4 segundos
    };

    // Precargar el siguiente video N ms antes del cambio (evita pantalla negra al rotar)
    const PRELOAD_ANTES_MS = 2500;

    function programarPreloadSiguiente(indiceActual, duracionActual) {
        if (preloadTimer) clearTimeout(preloadTimer);
        const cuandoPreload = Math.max(0, duracionActual - PRELOAD_ANTES_MS);
        preloadTimer = setTimeout(() => {
            const siguienteIndice = (indiceActual + 1) % videos.length;
            const siguienteVideo = videos[siguienteIndice];
            if (siguienteVideo && siguienteVideo.readyState < 2) {
                siguienteVideo.preload = 'auto';
                siguienteVideo.load();
            }
            preloadTimer = null;
        }, cuandoPreload);
    }

    // Pausar todos los videos excepto el primero
    videos.forEach((video, index) => {
        if (index !== 0) {
            video.pause();
        }
    });

    function cambiarVideo() {
        // Limpiar timers anteriores
        if (videoTimer) {
            clearTimeout(videoTimer);
            videoTimer = null;
        }
        if (preloadTimer) {
            clearTimeout(preloadTimer);
            preloadTimer = null;
        }

        // Obtener el video actual y el siguiente
        const currentVideo = videos[currentVideoIndex];
        currentVideoIndex = (currentVideoIndex + 1) % videos.length;
        const nextVideo = videos[currentVideoIndex];

        // Remover clase active del video actual
        currentVideo.classList.remove('active');
        
        // Pausar el video actual
        currentVideo.pause();
        currentVideo.removeEventListener('ended', cambiarVideo);

        // Agregar clase active al siguiente video y reproducirlo
        nextVideo.classList.add('active');
        nextVideo.currentTime = 0;
        nextVideo.play();

        // Configurar duración según el video
        const duracion = duraciones[currentVideoIndex];
        
        // Precargar el que sigue para que al rotar ya esté listo
        programarPreloadSiguiente(currentVideoIndex, duracion);
        
        // Timer para el próximo cambio
        videoTimer = setTimeout(() => {
            cambiarVideo();
        }, duracion);
    }

    // Iniciar el primer video y precargar el segundo antes del primer cambio
    const primerVideo = videos[0];
    if (primerVideo) {
        const duracionPrimerVideo = duraciones[0];
        programarPreloadSiguiente(0, duracionPrimerVideo);
        videoTimer = setTimeout(() => {
            cambiarVideo();
        }, duracionPrimerVideo);
    }
}

// Al volver atrás (bfcache), refrescar imágenes de productos para evitar "?" o imagen rota en móvil
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

// Inicializar cuando el DOM esté listo (solo en index; en productos/producto lo hace productos.js)
document.addEventListener('DOMContentLoaded', () => {
    const isIndexPage = document.getElementById('inicio') || document.querySelector('section.hero');
    if (isIndexPage) {
        inicializarHoverImagenes();
        renderizarProductos('Hombre', false);
        inicializarCarousel();
        inicializarNavegacion();
        inicializarPromoBar();
        inicializarHeroVideos();
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
            cartModal.addEventListener('click', (e) => {
                if (e.target === cartModal) cartModal.classList.remove('active');
            });
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
        // Asegurar que el badge del carrito muestre el número al volver desde productos
        if (typeof actualizarBadgeCarrito === 'function') {
            actualizarBadgeCarrito();
        }
    }
});

// Al volver atrás (ej. desde productos.html), la página puede restaurarse desde bfcache
// y DOMContentLoaded no se ejecuta de nuevo. pageshow sí se dispara: actualizar badge.
window.addEventListener('pageshow', (event) => {
    const isIndexPage = document.getElementById('inicio') || document.querySelector('section.hero');
    if (isIndexPage && typeof actualizarBadgeCarrito === 'function') {
        actualizarBadgeCarrito();
    }
});
