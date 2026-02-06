// Fijar altura del viewport al cargar para que al hacer scroll no se mueva todo (barra de direcciones, etc.)
(function() {
    function setVh() {
        document.documentElement.style.setProperty('--vh', (window.innerHeight / 100) + 'px');
    }
    setVh();
    window.addEventListener('orientationchange', function() { setTimeout(setVh, 100); });
})();

// Script para la página de productos completa
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
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    grid.addEventListener('mouseover', (e) => {
        const card = e.target.closest('.product-card-full');
        if (!card || card.dataset.hovered === 'true') return;
        card.dataset.hovered = 'true';
        const imgContainer = card.querySelector('.product-image');
        if (imgContainer && imgContainer.dataset.img2) {
            renderizarImagenProducto(imgContainer, imgContainer.dataset.img2);
        }
    });

    grid.addEventListener('mouseout', (e) => {
        const card = e.target.closest('.product-card-full');
        if (!card) return;
        const related = e.relatedTarget;
        if (related && card.contains(related)) return;
        card.dataset.hovered = 'false';
        const imgContainer = card.querySelector('.product-image');
        if (imgContainer && imgContainer.dataset.img1) {
            renderizarImagenProducto(imgContainer, imgContainer.dataset.img1);
        }
    });
}

function obtenerCategoriaDeURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('categoria') || 'Hombre';
}

// Función para obtener todas las tallas, tipos y colores únicos de los productos
function obtenerOpcionesFiltros(productos) {
    const tallas = new Set();
    const tipos = new Set();
    const colores = new Set();

    productos.forEach(producto => {
        const tallaBase = producto.tallaBase || obtenerTallaBaseFallback(producto.talla);
        if (tallaBase) tallas.add(tallaBase);
        const tipo = producto.tipo || obtenerTipoProductoFallback(producto.nombre);
        if (tipo) tipos.add(tipo);
        if (producto.color) colores.add(producto.color);
    });

    return {
        tallas: Array.from(tallas).sort(),
        tipos: Array.from(tipos).sort(),
        colores: Array.from(colores).sort()
    };
}

// Función de respaldo para extraer talla base (por si algún producto no tiene tallaBase)
function obtenerTallaBaseFallback(talla) {
    if (!talla) return '';
    const tallaUpper = talla.toUpperCase();
    if (tallaUpper.includes('XL')) return 'XL';
    if (tallaUpper.includes('L')) return 'L';
    if (tallaUpper.includes('M')) return 'M';
    if (tallaUpper.includes('S')) return 'S';
    return '';
}

// Función de respaldo para extraer tipo (por si algún producto no tiene tipo)
function obtenerTipoProductoFallback(nombre) {
    const nombreLower = nombre.toLowerCase();
    if (nombreLower.includes('short')) return 'Shorts';
    if (nombreLower.includes('hoodie')) return 'Hoodie';
    if (nombreLower.includes('t-shirt') || nombreLower.includes('shirt')) return 'T-Shirt';
    if (nombreLower.includes('jogger')) return 'Joggers';
    if (nombreLower.includes('tank top')) return 'Tank Top';
    if (nombreLower.includes('legging')) return 'Leggings';
    if (nombreLower.includes('sports bra') || nombreLower.includes('bra')) return 'Sports Bra';
    if (nombreLower.includes('crop top')) return 'Crop Top';
    return 'Otro';
}

// Función para generar los checkboxes de filtros
function generarFiltros(productos) {
    const opciones = obtenerOpcionesFiltros(productos);
    
    // Generar filtros de talla
    const tallaFilters = document.getElementById('tallaFilters');
    if (tallaFilters) {
        tallaFilters.innerHTML = '';
        opciones.tallas.forEach(talla => {
            const item = document.createElement('div');
            item.className = 'filter-checkbox-item';
            item.innerHTML = `
                <input type="checkbox" id="talla-${talla}" value="${talla}" class="filter-checkbox">
                <label for="talla-${talla}">${talla}</label>
            `;
            tallaFilters.appendChild(item);
        });
    }

    // Generar filtros de tipo
    const tipoFilters = document.getElementById('tipoFilters');
    if (tipoFilters) {
        tipoFilters.innerHTML = '';
        opciones.tipos.forEach(tipo => {
            const item = document.createElement('div');
            item.className = 'filter-checkbox-item';
            item.innerHTML = `
                <input type="checkbox" id="tipo-${tipo}" value="${tipo}" class="filter-checkbox">
                <label for="tipo-${tipo}">${tipo}</label>
            `;
            tipoFilters.appendChild(item);
        });
    }

    // Generar filtros de color
    const colorFilters = document.getElementById('colorFilters');
    if (colorFilters && opciones.colores && opciones.colores.length > 0) {
        colorFilters.innerHTML = '';
        opciones.colores.forEach(color => {
            const safeId = color.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
            const item = document.createElement('div');
            item.className = 'filter-checkbox-item';
            item.innerHTML = `
                <input type="checkbox" id="color-${safeId}" value="${color.replace(/"/g, '&quot;')}" class="filter-checkbox">
                <label for="color-${safeId}">${color}</label>
            `;
            colorFilters.appendChild(item);
        });
    }
}

// Función para obtener filtros activos
function obtenerFiltrosActivos() {
    const tallasSeleccionadas = Array.from(document.querySelectorAll('#tallaFilters .filter-checkbox:checked')).map(cb => cb.value);
    const tiposSeleccionados = Array.from(document.querySelectorAll('#tipoFilters .filter-checkbox:checked')).map(cb => cb.value);
    const colorFiltersEl = document.getElementById('colorFilters');
    const coloresSeleccionados = colorFiltersEl
        ? Array.from(colorFiltersEl.querySelectorAll('.filter-checkbox:checked')).map(cb => cb.value)
        : [];
    const sortByEl = document.getElementById('sortBy');
    const ordenarPor = sortByEl ? sortByEl.value : '';

    return {
        tallas: tallasSeleccionadas,
        tipos: tiposSeleccionados,
        colores: coloresSeleccionados,
        ordenarPor: ordenarPor
    };
}

// Función para aplicar filtros y ordenamiento
function aplicarFiltrosYOrdenar(productos) {
    const filtros = obtenerFiltrosActivos();
    let productosFiltrados = [...productos];

    // Filtrar por talla (usa tallaBase directamente del producto)
    if (filtros.tallas.length > 0) {
        productosFiltrados = productosFiltrados.filter(producto => {
            const tallaBase = producto.tallaBase || obtenerTallaBaseFallback(producto.talla);
            return filtros.tallas.includes(tallaBase);
        });
    }

    // Filtrar por tipo (usa tipo directamente del producto)
    if (filtros.tipos.length > 0) {
        productosFiltrados = productosFiltrados.filter(producto => {
            const tipo = producto.tipo || obtenerTipoProductoFallback(producto.nombre);
            return filtros.tipos.includes(tipo);
        });
    }

    // Filtrar por color
    if (filtros.colores && filtros.colores.length > 0) {
        productosFiltrados = productosFiltrados.filter(producto => producto.color && filtros.colores.includes(producto.color));
    }

    // Ordenar por precio
    if (filtros.ordenarPor === 'price-desc') {
        productosFiltrados.sort((a, b) => b.precio - a.precio);
    } else if (filtros.ordenarPor === 'price-asc') {
        productosFiltrados.sort((a, b) => a.precio - b.precio);
    }

    return productosFiltrados;
}

// Aplicar búsqueda por nombre (si hay input de búsqueda) y renderizar
function aplicarBusquedaYRenderizar(productosFiltrados) {
    var searchEl = document.getElementById('productSearchInput');
    if (searchEl && searchEl.value.trim()) {
        var term = searchEl.value.trim().toLowerCase();
        productosFiltrados = productosFiltrados.filter(function(p) { return p.nombre.toLowerCase().includes(term); });
    }
    renderizarProductos(productosFiltrados);
}

// ========== FUNCIONALIDAD DEL CARRITO ==========

// Obtener carrito del localStorage
function obtenerCarrito() {
    const carrito = localStorage.getItem('carrito');
    return carrito ? JSON.parse(carrito) : [];
}

// Guardar carrito en localStorage
function guardarCarrito(carrito) {
    localStorage.setItem('carrito', JSON.stringify(carrito));
}

// Agregar producto al carrito (opciones: { button: elemento } para mostrar palomita en el botón)
// Un mismo artículo puede estar varias veces si difiere en talla o color (id + talla + color identifican la línea)
function agregarAlCarrito(producto, opciones) {
    const carrito = obtenerCarrito();
    const colorProducto = producto.color || '';
    const itemExistente = carrito.find(item =>
        item.id === producto.id && item.talla === producto.talla && (item.color || '') === colorProducto
    );

    if (itemExistente) {
        itemExistente.cantidad += 1;
    } else {
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            talla: producto.talla,
            color: colorProducto,
            imagen1: producto.imagen1,
            cantidad: 1
        });
    }
    
    guardarCarrito(carrito);
    actualizarBadgeCarrito();
    renderizarCarrito();
    var cartModal = document.getElementById('cartModal');
    if (cartModal) cartModal.classList.add('active');
    var btn = opciones && opciones.button;
    if (btn) {
        var textoOriginal = btn.textContent;
        btn.textContent = '\u2713 Agregado';
        btn.disabled = true;
        btn.classList.add('add-to-cart-added');
        setTimeout(function() {
            btn.textContent = textoOriginal;
            btn.disabled = false;
            btn.classList.remove('add-to-cart-added');
        }, 3500);
    }
}

// Eliminar producto del carrito (identificado por id + talla + color)
function eliminarDelCarrito(id, talla, color) {
    const carrito = obtenerCarrito();
    const idNum = Number(id);
    const tallaStr = talla !== undefined && talla !== null ? String(talla) : '';
    const colorStr = color !== undefined && color !== null ? String(color) : '';
    const nuevoCarrito = carrito.filter(item =>
        !(Number(item.id) === idNum && String(item.talla) === tallaStr && (item.color || '') === colorStr)
    );
    guardarCarrito(nuevoCarrito);
    actualizarBadgeCarrito();
    renderizarCarrito();
}

// Vaciar todo el carrito
function vaciarCarrito() {
    guardarCarrito([]);
    actualizarBadgeCarrito();
    renderizarCarrito();
    const cartModal = document.getElementById('cartModal');
    if (cartModal) cartModal.classList.remove('active');
}

// Actualizar badge del carrito
function actualizarBadgeCarrito() {
    const carrito = obtenerCarrito();
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    const badge = document.getElementById('cartBadge');
    if (badge) {
        badge.textContent = totalItems;
        badge.style.display = totalItems > 0 ? 'flex' : 'none';
    }
}

// Renderizar carrito
function renderizarCarrito() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    if (!cartItems || !cartTotal) return;

    const carrito = obtenerCarrito();
    
    if (carrito.length === 0) {
        cartItems.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Tu carrito está vacío</p>';
        cartTotal.textContent = 'Total: $0.00';
        return;
    }

    cartItems.innerHTML = '';
    let total = 0;

    carrito.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        
        const imagenSrc = esRutaImagen(item.imagen1) ? item.imagen1 : '🛍️';
        const imagenHTML = esRutaImagen(item.imagen1) 
            ? `<img src="${item.imagen1}" alt="${item.nombre}" class="cart-item-image" loading="lazy">`
            : `<div class="cart-item-image" style="display: flex; align-items: center; justify-content: center; font-size: 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">${imagenSrc}</div>`;
        
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        const colorItem = item.color || '';
        const tallaEscaped = (item.talla + '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const colorEscaped = (colorItem + '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        itemDiv.innerHTML = `
            ${imagenHTML}
            <div class="cart-item-info">
                <div class="cart-item-name">${item.nombre}</div>
                <div class="cart-item-details">Talla: ${item.talla}${colorItem ? ' | Color: ' + colorItem : ''} | Cantidad: ${item.cantidad}</div>
                <div class="cart-item-price">$${subtotal.toFixed(2)}</div>
            </div>
            <button class="remove-item-btn" data-cart-remove data-id="${item.id}" data-talla="${tallaEscaped.replace(/"/g, '&quot;')}" data-color="${colorEscaped.replace(/"/g, '&quot;')}" aria-label="Eliminar">×</button>
        `;

        cartItems.appendChild(itemDiv);
    });

    cartTotal.textContent = `Total: $${total.toFixed(2)}`;
}

// Mostrar notificación
function mostrarNotificacion(mensaje) {
    const notificacion = document.createElement('div');
    notificacion.style.cssText = `
        position: fixed;
        top: 150px;
        right: 20px;
        background: var(--primary-color);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 3000;
        animation: slideIn 0.3s ease;
    `;
    notificacion.textContent = mensaje;
    document.body.appendChild(notificacion);

    setTimeout(() => {
        notificacion.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notificacion.remove(), 300);
    }, 2000);
}

// Obtener URL base del sitio (para enlaces en WhatsApp)
function getBaseUrl() {
    const origin = window.location.origin;
    const path = window.location.pathname;
    const lastSlash = path.lastIndexOf('/');
    const basePath = lastSlash >= 0 ? path.substring(0, lastSlash + 1) : '/';
    return origin + basePath;
}

// Enviar mensaje a WhatsApp (incluye link de cada producto)
function enviarMensajeWhatsApp() {
    const carrito = obtenerCarrito();
    if (carrito.length === 0) {
        mostrarNotificacion('Tu carrito está vacío');
        return;
    }

    const baseUrl = getBaseUrl();
    let mensaje = 'Hola! Me interesa comprar los siguientes productos:\n\n';
    let total = 0;

    carrito.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        const linkProducto = baseUrl + 'producto.html?id=' + item.id;
        mensaje += `${index + 1}. ${item.nombre}\n`;
        mensaje += `   Talla: ${item.talla}\n`;
        if (item.color) mensaje += `   Color: ${item.color}\n`;
        mensaje += `   Cantidad: ${item.cantidad}\n`;
        mensaje += `   Precio: $${subtotal.toFixed(2)}\n`;
        mensaje += `   Link: ${linkProducto}\n\n`;
    });

    mensaje += `Total: $${total.toFixed(2)}\n\n`;
    mensaje += 'Gracias!';

    const numeroWhatsApp = '524428231138';
    const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// Función para renderizar productos
function renderizarProductos(productosParaRenderizar) {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;

    productsGrid.innerHTML = '';

    if (productosParaRenderizar.length === 0) {
        productsGrid.innerHTML = '<p style="padding: 2rem; color: #666; text-align: center; grid-column: 1 / -1;">No hay productos que coincidan con los filtros seleccionados.</p>';
        return;
    }

    productosParaRenderizar.forEach(producto => {
        const card = document.createElement('div');
        card.className = 'product-card-full';
        card.setAttribute('data-product-id', producto.id);

        const imagen1 = producto.imagen1 || '';
        const tieneSegundaImagen = producto.imagen2 && String(producto.imagen2).trim() !== '';
        const esImagen = esRutaImagen(imagen1);
        const agotado = producto.stock === 0;

        const linkProducto = document.createElement(agotado ? 'div' : 'a');
        linkProducto.className = 'product-image-link' + (agotado ? ' product-image-link-agotado' : '');
        if (!agotado) {
            linkProducto.href = 'producto.html?id=' + producto.id;
            linkProducto.setAttribute('aria-label', 'Ver ' + producto.nombre);
        } else {
            linkProducto.setAttribute('aria-label', producto.nombre + ' (agotado)');
        }

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

        linkProducto.appendChild(imageWrap);

        const info = document.createElement('div');
        info.className = 'product-info';
        const colorLine = producto.color ? `<p class="product-color">Color: ${producto.color}</p>` : '';
        const btnTexto = agotado ? 'Agotado' : 'Agregar al Carrito';
        const btnClase = 'add-to-cart-btn' + (agotado ? ' agotado' : '');
        info.innerHTML = `
            <h3 class="product-name">${producto.nombre}</h3>
            <p class="product-size">Talla: ${producto.talla}</p>
            ${colorLine}
            <p class="product-price">$${producto.precio.toFixed(2)}</p>
            <button type="button" class="${btnClase}" data-product-id="${producto.id}" data-product-talla="${producto.talla}" data-product-color="${(producto.color || '').replace(/"/g, '&quot;')}" ${agotado ? ' disabled' : ''}>${btnTexto}</button>
        `;

        card.appendChild(linkProducto);
        card.appendChild(info);

        const addToCartBtn = info.querySelector('.add-to-cart-btn');
        if (addToCartBtn && !agotado) {
            addToCartBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                agregarAlCarrito(producto, { button: addToCartBtn });
            });
        }

        productsGrid.appendChild(card);
    });
}

// Función principal para renderizar todos los productos
function renderizarTodosLosProductos() {
    const categoria = obtenerCategoriaDeURL();
    const pageTitle = document.getElementById('pageTitle');
    
    function actualizarTituloPagina() {
        if (!pageTitle) return;
        var esMovil = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
        if (esMovil) {
            pageTitle.textContent = categoria === 'Hombre' ? 'PARA NUESTROS ATLETAS' : (categoria === 'Mujer' ? 'PARA NUESTRAS ATLETAS' : 'Productos');
        } else {
            if (categoria === 'Hombre') {
                pageTitle.textContent = 'PARA NUESTROS ATLETAS';
            } else if (categoria === 'Mujer') {
                pageTitle.textContent = 'PARA NUESTRAS ATLETAS';
            } else {
                pageTitle.textContent = 'Productos';
            }
        }
    }
    actualizarTituloPagina();
    if (pageTitle && window.matchMedia) {
        var mq = window.matchMedia('(max-width: 768px)');
        if (mq.addEventListener) mq.addEventListener('change', actualizarTituloPagina);
        else if (mq.addListener) mq.addListener(actualizarTituloPagina);
    }

    // Filtrar productos por categoría
    const productosCategoria = productos.filter(p => p.categoria === categoria || p.categoria === 'Unisex');

    // Generar filtros dinámicamente
    generarFiltros(productosCategoria);

    // Aplicar filtros y ordenamiento inicial
    const productosFiltrados = aplicarFiltrosYOrdenar(productosCategoria);
    aplicarBusquedaYRenderizar(productosFiltrados);
}

// Función para inicializar eventos de filtros
function inicializarEventosFiltros() {
    var isMobileFilters = function() {
        return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    };

    // Orden y checkboxes no aplican hasta pulsar "Aplicar filtros" (desktop y móvil)
    const sortBy = document.getElementById('sortBy');
    if (sortBy) {
        sortBy.addEventListener('change', () => {
            // No re-renderizar aquí; solo al pulsar "Aplicar filtros"
        });
    }

    document.addEventListener('change', (e) => {
        if (!e.target.classList.contains('filter-checkbox')) return;
        // No re-renderizar aquí; solo al pulsar "Aplicar filtros"
    });

    function ejecutarLimpiarFiltros() {
        document.querySelectorAll('.filter-checkbox').forEach(cb => { cb.checked = false; });
        if (sortBy) sortBy.value = '';
        const categoria = obtenerCategoriaDeURL();
        const productosCategoria = productos.filter(p => p.categoria === categoria || p.categoria === 'Unisex');
        aplicarBusquedaYRenderizar(productosCategoria);
    }

    const clearFilters = document.getElementById('clearFilters');
    if (clearFilters) clearFilters.addEventListener('click', ejecutarLimpiarFiltros);

    const clearFiltersTop = document.getElementById('clearFiltersTop');
    if (clearFiltersTop) clearFiltersTop.addEventListener('click', ejecutarLimpiarFiltros);

    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            const categoria = obtenerCategoriaDeURL();
            const productosCategoria = productos.filter(p => p.categoria === categoria || p.categoria === 'Unisex');
            const productosFiltrados = aplicarFiltrosYOrdenar(productosCategoria);
            aplicarBusquedaYRenderizar(productosFiltrados);
            var wrapper = document.getElementById('filtersProductsWrapper');
            var toggleBtn = document.getElementById('filtersToggleBtn');
            if (wrapper) wrapper.classList.remove('filters-panel-open');
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
        });
    }

    function onSearchInput() {
        const categoria = obtenerCategoriaDeURL();
        const productosCategoria = productos.filter(p => p.categoria === categoria || p.categoria === 'Unisex');
        const productosFiltrados = aplicarFiltrosYOrdenar(productosCategoria);
        aplicarBusquedaYRenderizar(productosFiltrados);
    }
    var productSearchInput = document.getElementById('productSearchInput');
    if (productSearchInput) {
        productSearchInput.addEventListener('input', function() {
            var desktopInp = document.getElementById('productSearchInputDesktop');
            if (desktopInp) desktopInp.value = this.value;
            onSearchInput();
        });
    }
    var productSearchInputDesktop = document.getElementById('productSearchInputDesktop');
    if (productSearchInputDesktop) {
        productSearchInputDesktop.addEventListener('input', function() {
            var mobileInp = document.getElementById('productSearchInput');
            if (mobileInp) mobileInp.value = this.value;
            onSearchInput();
        });
    }
}

// Inicializar eventos del carrito
function inicializarCarrito() {
    const cartIconBtn = document.getElementById('cartIconBtn');
    const cartModal = document.getElementById('cartModal');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const clearCartBtn = document.getElementById('clearCartBtn');

    if (cartIconBtn && cartModal) {
        cartIconBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            renderizarCarrito();
            cartModal.classList.add('active');
        });
    }

    if (closeCartBtn && cartModal) {
        closeCartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            cartModal.classList.remove('active');
        });
    }

    if (cartModal) {
        function handleRemoveItem(e) {
            const removeBtn = e.target.closest('[data-cart-remove]');
            if (removeBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = parseInt(removeBtn.getAttribute('data-id'), 10);
                const talla = removeBtn.getAttribute('data-talla') || '';
                const color = removeBtn.getAttribute('data-color') || '';
                eliminarDelCarrito(id, talla, color);
                return;
            }
            if (e.target === cartModal) {
                cartModal.classList.remove('active');
            }
        }
        cartModal.addEventListener('click', handleRemoveItem);
        cartModal.addEventListener('touchend', handleRemoveItem, { passive: false });
    }

    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            vaciarCarrito();
        });
    }

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            enviarMensajeWhatsApp();
        });
    }

    actualizarBadgeCarrito();
}

// En vista móvil: botón que muestra/oculta el panel de filtros
function inicializarFiltrosToggle() {
    const toggleBtn = document.getElementById('filtersToggleBtn');
    const wrapper = document.getElementById('filtersProductsWrapper');
    const sidebar = document.getElementById('filtersSidebar');

    if (!toggleBtn || !wrapper || !sidebar) return;

    function abrirFiltros() {
        wrapper.classList.add('filters-panel-open');
        toggleBtn.setAttribute('aria-expanded', 'true');
    }

    function cerrarFiltros() {
        wrapper.classList.remove('filters-panel-open');
        toggleBtn.setAttribute('aria-expanded', 'false');
    }

    function toggleFiltros() {
        if (wrapper.classList.contains('filters-panel-open')) {
            cerrarFiltros();
        } else {
            abrirFiltros();
        }
    }

    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFiltros();
    });

    var closeBtn = document.getElementById('filtersCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            cerrarFiltros();
        });
    }

    var backdrop = document.getElementById('filtersOverlayBackdrop');
    if (backdrop) {
        backdrop.addEventListener('click', cerrarFiltros);
    }

    document.addEventListener('click', (e) => {
        if (!wrapper.classList.contains('filters-panel-open')) return;
        if (wrapper.contains(e.target)) return;
        cerrarFiltros();
    });
}

// Función para mostrar modal de restricción
function mostrarRestriccion() {
    const restrictionModal = document.getElementById('restrictionModal');
    if (restrictionModal) {
        restrictionModal.classList.add('active');
    }
}

// Función para inicializar navegación (productos.js se carga después de script.js y sobrescribe esta función, así que el menú debe configurarse aquí para productos.html y producto.html)
function inicializarNavegacion() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileNav = document.getElementById('mobileNav');

    if (mobileMenuBtn && mobileNav) {
        function cerrarMenu() {
            mobileMenuBtn.classList.remove('active');
            mobileNav.classList.remove('active');
            document.body.classList.remove('mobile-menu-open');
        }

        mobileMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = mobileNav.classList.contains('active');
            if (isOpen) {
                cerrarMenu();
            } else {
                mobileMenuBtn.classList.add('active');
                mobileNav.classList.add('active');
                document.body.classList.add('mobile-menu-open');
            }
        }, true);

        document.addEventListener('click', (e) => {
            if (!mobileMenuBtn.contains(e.target) && !mobileNav.contains(e.target)) {
                cerrarMenu();
            }
        });
    }

    // Botón "Hombre" en el header (desktop y mobile)
    const btnHombreMobile = document.getElementById('btnHombreMobile');
    
    if (btnHombreMobile) {
        btnHombreMobile.addEventListener('click', () => {
            window.location.href = 'productos.html?categoria=Hombre';
            if (mobileMenuBtn && mobileNav) {
                mobileMenuBtn.classList.remove('active');
                mobileNav.classList.remove('active');
                document.body.classList.remove('mobile-menu-open');
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
                document.body.classList.remove('mobile-menu-open');
            }
            return false;
        });
    }

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

// Al volver atrás (bfcache), refrescar imágenes de productos para evitar "?" o imagen rota en móvil
window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    grid.querySelectorAll('.product-card-full .product-image').forEach(container => {
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

document.addEventListener('DOMContentLoaded', () => {
    var isProductDetailPage = document.getElementById('productDetailContainer') && !document.getElementById('productsGrid');
    var isProductsGridPage = document.getElementById('productsGrid');

    if (isProductDetailPage) {
        inicializarCarrito();
        inicializarNavegacion();
    } else if (isProductsGridPage) {
        renderizarTodosLosProductos();
        inicializarHoverImagenes();
        inicializarEventosFiltros();
        inicializarFiltrosToggle();
        inicializarCarrito();
        inicializarNavegacion();
    } else {
        // Páginas sin grid de productos (ej. asesorias.html): solo menú móvil y carrito.
        // No ejecutar en index.html (ahí script.js ya lo hace; duplicar causaría doble toggle).
        var isIndexPage = document.getElementById('inicio') || document.querySelector('section.hero');
        if (!isIndexPage) {
            inicializarCarrito();
            inicializarNavegacion();
        }
    }

    var messages = document.querySelectorAll('.promo-message');
    var currentIndex = 0;
    function cambiarMensaje() {
        if (messages.length === 0) return;
        messages[currentIndex].classList.remove('active');
        messages[currentIndex].classList.add('exit');
        currentIndex = (currentIndex + 1) % messages.length;
        messages[currentIndex].classList.remove('exit');
        messages[currentIndex].classList.add('active');
        setTimeout(function() {
            var previousIndex = (currentIndex - 1 + messages.length) % messages.length;
            messages[previousIndex].classList.remove('exit');
        }, 600);
    }
    if (messages.length > 0) {
        setInterval(cambiarMensaje, 5000);
    }
});
