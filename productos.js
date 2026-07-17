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
        img.decoding = 'async';
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

function inicializarHoverImagenes() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    grid.addEventListener('mouseover', (e) => {
        const card = e.target.closest('.product-card-full');
        if (!card || card.dataset.hovered === 'true') return;
        card.dataset.hovered = 'true';
        const imgContainer = card.querySelector('.product-image');
        if (imgContainer && imgContainer.dataset.img2) {
            renderizarImagenProducto(imgContainer, imgContainer.dataset.img2, { noOcultarSiFalla: true });
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

function tieneCategoriaEnURL() {
    return new URLSearchParams(window.location.search).has('categoria');
}

function esModoMayoreo() {
    var params = new URLSearchParams(window.location.search);
    var valor = (params.get('mayoreo') || '').trim().toLowerCase();
    if (valor === '1' || valor === 'si' || valor === 'true') return true;
    var retorno = params.get('retorno');
    if (retorno) {
        try {
            var retornoParams = new URLSearchParams(decodeURIComponent(retorno));
            var rv = (retornoParams.get('mayoreo') || '').trim().toLowerCase();
            if (rv === '1' || rv === 'si' || rv === 'true') return true;
        } catch (err) {
            // ignorar retorno mal formado
        }
    }
    return false;
}

function esModoNuevoStock() {
    var params = new URLSearchParams(window.location.search);
    var valor = (params.get('nuevoStock') || '').trim().toLowerCase();
    if (valor === '1' || valor === 'si' || valor === 'true') return true;
    var retorno = params.get('retorno');
    if (retorno) {
        try {
            var retornoParams = new URLSearchParams(decodeURIComponent(retorno));
            var rv = (retornoParams.get('nuevoStock') || '').trim().toLowerCase();
            if (rv === '1' || rv === 'si' || rv === 'true') return true;
        } catch (err) {
            // ignorar retorno mal formado
        }
    }
    return false;
}

function esModoMayoreo50() {
    var params = new URLSearchParams(window.location.search);
    var valor = (params.get('mayoreo50') || '').trim().toLowerCase();
    if (valor === '1' || valor === 'si' || valor === 'true') return true;
    var retorno = params.get('retorno');
    if (retorno) {
        try {
            var retornoParams = new URLSearchParams(decodeURIComponent(retorno));
            var rv = (retornoParams.get('mayoreo50') || '').trim().toLowerCase();
            if (rv === '1' || rv === 'si' || rv === 'true') return true;
        } catch (err) {
            // ignorar retorno mal formado
        }
    }
    return false;
}

function esProductoMayoreo50(producto) {
    return !!producto && Number(producto.precioMayoreo50) > 0;
}

function esProductoNuevoStock(producto) {
    if (!producto || !producto.fechaStock || !window.fechaStockMasReciente) return false;
    return producto.fechaStock === window.fechaStockMasReciente;
}

function hayMarcaActivaEnURL() {
    return (leerFiltrosDesdeURL().marcas || []).length > 0;
}

// El filtro Hombre/Mujer aparece en Nuevo stock, Mayoreo +20/+50 y al filtrar por marca.
function debeMostrarFiltroGenero() {
    return esModoNuevoStock() || esModoMayoreo() || esModoMayoreo50() || hayMarcaActivaEnURL();
}

function obtenerCategoriaFiltroGenero() {
    var params = new URLSearchParams(window.location.search);
    if (!params.has('categoria')) return '';
    return (params.get('categoria') || '').trim();
}

function actualizarFiltroGeneroNuevoStockUI() {
    var cont = document.getElementById('nuevoStockGenderFilter');
    if (!cont) return;
    var activo = debeMostrarFiltroGenero();
    cont.hidden = !activo;
    if (!activo) return;
    var cat = obtenerCategoriaFiltroGenero();
    cont.querySelectorAll('.nuevo-stock-gender-btn').forEach(function(btn) {
        var val = btn.getAttribute('data-categoria') || '';
        var seleccionado = val === (cat || '');
        btn.classList.toggle('is-active', seleccionado);
        btn.setAttribute('aria-pressed', seleccionado ? 'true' : 'false');
    });
}

function navegarFiltroGeneroNuevoStock(categoria) {
    var params = new URLSearchParams(window.location.search);
    if (categoria) {
        params.set('categoria', categoria);
    } else {
        params.delete('categoria');
    }
    var qs = params.toString();
    history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
    renderizarTodosLosProductos();
}

function inicializarFiltroGeneroNuevoStock() {
    var cont = document.getElementById('nuevoStockGenderFilter');
    if (!cont) return;
    actualizarFiltroGeneroNuevoStockUI();
    cont.querySelectorAll('.nuevo-stock-gender-btn').forEach(function(btn) {
        if (btn.dataset.genderBound === '1') return;
        btn.dataset.genderBound = '1';
        btn.addEventListener('click', function() {
            navegarFiltroGeneroNuevoStock(btn.getAttribute('data-categoria') || '');
        });
    });
}

function precioVigenteProducto(producto) {
    if (esModoMayoreo50() && esProductoMayoreo50(producto)) {
        return Number(producto.precioMayoreo50);
    }
    if (esModoMayoreo() && producto && producto.mayoreo && Number(producto.precioMayoreo) > 0) {
        return Number(producto.precioMayoreo);
    }
    return Number(producto && producto.precio) || 0;
}

function htmlBadgeDescuento(porcentaje, extraClase) {
    if (!porcentaje) return '';
    var texto = String(porcentaje).indexOf('%') !== -1 ? String(porcentaje) : (porcentaje + '%');
    var cls = 'product-discount-badge' + (extraClase ? ' ' + extraClase : '');
    return '<span class="' + cls + '">-' + texto + '</span>';
}

function htmlPrecioProducto(producto) {
    var retail = Number(producto.precio) || 0;
    var mayor = Number(producto.precioMayoreo) || 0;
    var mayor50 = Number(producto.precioMayoreo50) || 0;

    if (esModoMayoreo50() && mayor50 > 0) {
        var partes = '';
        if (retail > 0) {
            partes += '<span class="price-tier"><span class="product-price-retail">$' + formatearPrecio(retail) + '</span></span>';
        }
        if (mayor > 0 && Math.abs(mayor - mayor50) > 0.009) {
            partes += '<span class="price-tier">'
                + '<span class="product-price-retail">$' + formatearPrecio(mayor) + '</span>'
                + htmlBadgeDescuento(producto.descuentoMayoreo, 'product-discount-badge-20')
                + '</span>';
        }
        partes += '<span class="price-tier">'
            + '<span class="product-price-wholesale">$' + formatearPrecio(mayor50) + '</span>'
            + htmlBadgeDescuento(producto.descuentoMayoreo50)
            + '</span>';
        return '<p class="product-price product-price-mayoreo product-price-mayoreo50">' + partes + '</p>';
    }

    if (esModoMayoreo() && producto.mayoreo && mayor > 0) {
        if (retail > 0 && Math.abs(retail - mayor) > 0.009) {
            return '<p class="product-price product-price-mayoreo">'
                + '<span class="product-price-retail">$' + formatearPrecio(retail) + '</span>'
                + '<span class="product-price-wholesale">$' + formatearPrecio(mayor) + '</span>'
                + htmlBadgeDescuento(producto.descuentoMayoreo)
                + '</p>';
        }
        return '<p class="product-price">$' + formatearPrecio(mayor) + htmlBadgeDescuento(producto.descuentoMayoreo) + '</p>';
    }
    return '<p class="product-price">$' + formatearPrecio(retail) + '</p>';
}

window.esModoMayoreo = esModoMayoreo;
window.esModoMayoreo50 = esModoMayoreo50;
window.esProductoMayoreo50 = esProductoMayoreo50;
window.esModoNuevoStock = esModoNuevoStock;
window.esProductoNuevoStock = esProductoNuevoStock;
window.precioVigenteProducto = precioVigenteProducto;
window.htmlPrecioProducto = htmlPrecioProducto;

function obtenerMarcaDeURL() {
    const params = new URLSearchParams(window.location.search);
    return (params.get('marca') || '').trim();
}

// Devuelve el array de productos según la categoría (sin filtrar por marca; eso va en el panel de filtros)
function obtenerProductosPorCategoria() {
    var params = new URLSearchParams(window.location.search);
    var modoMayoreo = esModoMayoreo();
    var modoMayoreo50 = esModoMayoreo50();
    var modoNuevoStock = esModoNuevoStock();
    var categoria = params.get('categoria') || 'Hombre';

    function filtrarLista(lista, cat) {
        return lista.filter(function(p) {
            if (!(p.categoria === cat || p.categoria === 'Unisex')) return false;
            if (Number(p.stock) <= 0) return false;
            if (modoNuevoStock) return esProductoNuevoStock(p);
            if (modoMayoreo50) return esProductoMayoreo50(p);
            if (modoMayoreo) return !!p.mayoreo;
            return true;
        });
    }

    // "Todos" (sin categoría en la URL) combina Hombre + Mujer cuando el filtro de género está activo
    // (Nuevo stock, Mayoreo +20/+50 o filtro por marca). La marca se aplica luego en aplicarFiltrosYOrdenar.
    if (!tieneCategoriaEnURL() && debeMostrarFiltroGenero()) {
        var todos = [];
        if (typeof productosHombre !== 'undefined' && Array.isArray(productosHombre)) {
            todos = todos.concat(productosHombre);
        } else if (typeof productos !== 'undefined' && Array.isArray(productos)) {
            todos = todos.concat(productos);
        }
        if (typeof productosMujer !== 'undefined' && Array.isArray(productosMujer)) {
            todos = todos.concat(productosMujer);
        }
        return todos.filter(function(p) {
            if (Number(p.stock) <= 0) return false;
            if (modoNuevoStock) return esProductoNuevoStock(p);
            if (modoMayoreo50) return esProductoMayoreo50(p);
            if (modoMayoreo) return !!p.mayoreo;
            return true;
        });
    }

    if (categoria === 'Mujer') {
        return typeof productosMujer !== 'undefined'
            ? filtrarLista(productosMujer, 'Mujer')
            : [];
    }
    return filtrarLista(productos, categoria);
}

// Función para obtener todas las tallas, tipos y colores únicos de los productos
function obtenerOpcionesFiltros(productos) {
    var categoria = obtenerCategoriaDeURL();
    if (typeof window.opcionesInventarioSheet !== 'undefined' && window.opcionesInventarioSheet[categoria]) {
        return window.opcionesInventarioSheet[categoria];
    }

    const tallas = new Set();
    const tipos = new Set();
    const colores = new Set();
    const marcas = new Set();

    productos.forEach(producto => {
        const tallaBase = producto.tallaBase || obtenerTallaBaseFallback(producto.talla);
        if (tallaBase) tallas.add(tallaBase);
        const tipo = producto.tipo || obtenerTipoProductoFallback(producto.nombre);
        if (tipo) tipos.add(tipo);
        if (producto.color) colores.add(producto.color);
        if (producto.marca) marcas.add(producto.marca);
    });

    return {
        tallas: Array.from(tallas).sort(),
        tipos: Array.from(tipos).sort(),
        colores: Array.from(colores).sort(),
        marcas: Array.from(marcas).sort()
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

// Orden preferido de tallas: S, M, L, XL, UNI y luego numéricas (30, 32...)
var ORDEN_TALLAS = ['S', 'M', 'L', 'XL', 'UNI'];

function ordenarTallas(tallas) {
    return (tallas || []).slice().sort(function(a, b) {
        var ia = ORDEN_TALLAS.indexOf(String(a).toUpperCase());
        var ib = ORDEN_TALLAS.indexOf(String(b).toUpperCase());
        var numA = parseFloat(a);
        var numB = parseFloat(b);
        var esNumA = !isNaN(numA);
        var esNumB = !isNaN(numB);

        // 1) Las de la lista preferida primero, en su orden
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;

        // 2) Luego las numéricas ordenadas de menor a mayor
        if (esNumA && esNumB) return numA - numB;
        if (esNumA) return -1;
        if (esNumB) return 1;

        // 3) El resto, alfabético
        return String(a).localeCompare(String(b), 'es', { sensitivity: 'base' });
    });
}

function ordenarAlfabetico(valores) {
    return (valores || []).slice().sort(function(a, b) {
        return String(a).localeCompare(String(b), 'es', { sensitivity: 'base' });
    });
}

// Función para generar los checkboxes de filtros
function generarFiltros(productos) {
    const opciones = obtenerOpcionesFiltros(productos);
    const tallasOrdenadas = ordenarTallas(opciones.tallas);
    const tiposOrdenados = ordenarAlfabetico(opciones.tipos);
    const marcasOrdenadas = ordenarAlfabetico(opciones.marcas);

    // Generar filtros de talla
    const tallaFilters = document.getElementById('tallaFilters');
    if (tallaFilters) {
        tallaFilters.innerHTML = '';
        tallasOrdenadas.forEach(talla => {
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
        tiposOrdenados.forEach(tipo => {
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

    // Generar filtros de marca
    const marcaFilters = document.getElementById('marcaFilters');
    if (marcaFilters) {
        marcaFilters.innerHTML = '';
        if (marcasOrdenadas && marcasOrdenadas.length > 0) {
            marcasOrdenadas.forEach(marca => {
                const safeId = marca.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
                const item = document.createElement('div');
                item.className = 'filter-checkbox-item';
                item.innerHTML = `
                    <input type="checkbox" id="marca-${safeId}" value="${marca.replace(/"/g, '&quot;')}" class="filter-checkbox">
                    <label for="marca-${safeId}">${marca}</label>
                `;
                marcaFilters.appendChild(item);
            });
        } else {
            marcaFilters.innerHTML = '<p style="font-size:0.85rem;color:#666;">Sin marcas disponibles</p>';
        }
    }
}

function leerFiltrosDesdeURL() {
    var params = new URLSearchParams(window.location.search);

    function valoresMulti(nombre) {
        var todos = params.getAll(nombre);
        if (todos.length > 1) return todos;
        var uno = params.get(nombre);
        if (!uno) return [];
        return uno.split(',').map(function(v) { return v.trim(); }).filter(Boolean);
    }

    var marcas = valoresMulti('marcas');
    var marcaPill = (params.get('marca') || '').trim();
    if (marcaPill && marcas.indexOf(marcaPill) === -1) {
        marcas.push(marcaPill);
    }

    return {
        tallas: valoresMulti('talla'),
        tipos: valoresMulti('tipo'),
        colores: valoresMulti('color'),
        marcas: marcas,
        ordenarPor: params.get('orden') || '',
        busqueda: params.get('q') || ''
    };
}

function marcaCoincideFiltro(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function restaurarFiltrosDesdeURL() {
    var f = leerFiltrosDesdeURL();

    document.querySelectorAll('#tallaFilters .filter-checkbox').forEach(function(cb) {
        cb.checked = f.tallas.indexOf(cb.value) !== -1;
    });
    document.querySelectorAll('#tipoFilters .filter-checkbox').forEach(function(cb) {
        cb.checked = f.tipos.indexOf(cb.value) !== -1;
    });
    var colorFiltersEl = document.getElementById('colorFilters');
    if (colorFiltersEl) {
        colorFiltersEl.querySelectorAll('.filter-checkbox').forEach(function(cb) {
            cb.checked = f.colores.indexOf(cb.value) !== -1;
        });
    }
    var marcaFiltersEl = document.getElementById('marcaFilters');
    if (marcaFiltersEl) {
        marcaFiltersEl.querySelectorAll('.filter-checkbox').forEach(function(cb) {
            cb.checked = f.marcas.some(function(m) { return marcaCoincideFiltro(m, cb.value); });
        });
    }

    var sortBy = document.getElementById('sortBy');
    if (sortBy) sortBy.value = f.ordenarPor;

    var searchMobile = document.getElementById('productSearchInput');
    var searchDesktop = document.getElementById('productSearchInputDesktop');
    if (searchMobile) searchMobile.value = f.busqueda;
    if (searchDesktop) searchDesktop.value = f.busqueda;
}

function sincronizarFiltrosConURL() {
    var filtros = obtenerFiltrosActivos();
    var searchEl = document.getElementById('productSearchInput');
    var busqueda = searchEl && searchEl.value.trim() ? searchEl.value.trim() : '';
    var params = new URLSearchParams(window.location.search);

    ['talla', 'tipo', 'color', 'marcas', 'marca', 'orden', 'q'].forEach(function(k) { params.delete(k); });
    filtros.tallas.forEach(function(v) { params.append('talla', v); });
    filtros.tipos.forEach(function(v) { params.append('tipo', v); });
    filtros.colores.forEach(function(v) { params.append('color', v); });
    filtros.marcas.forEach(function(v) { params.append('marcas', v); });
    if (filtros.ordenarPor) params.set('orden', filtros.ordenarPor);
    if (busqueda) params.set('q', busqueda);

    var qs = params.toString();
    history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
}

function limpiarFiltrosEnURL() {
    var params = new URLSearchParams(window.location.search);
    ['talla', 'tipo', 'color', 'marcas', 'marca', 'orden', 'q'].forEach(function(k) { params.delete(k); });
    var qs = params.toString();
    history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
}

function construirQueryRetornoProductos() {
    var qs = window.location.search.replace(/^\?/, '');
    return qs ? encodeURIComponent(qs) : '';
}

function construirUrlDetalleProducto(producto) {
    var url = 'producto.html?id=' + encodeURIComponent(producto.id);
    if (producto.categoria === 'Mujer') url += '&categoria=Mujer';
    if (esModoMayoreo()) url += '&mayoreo=1';
    if (esModoMayoreo50()) url += '&mayoreo50=1';
    if (esModoNuevoStock()) url += '&nuevoStock=1';
    var retorno = construirQueryRetornoProductos();
    if (retorno) url += '&retorno=' + retorno;
    return url;
}

function construirUrlVolverProductos(params) {
    var retorno = params.get('retorno');
    if (retorno) {
        try {
            return 'productos.html?' + decodeURIComponent(retorno);
        } catch (err) {
            console.warn('No se pudo leer retorno de filtros:', err);
        }
    }
    if (esModoMayoreo()) return 'productos.html?mayoreo=1';
    if (esModoMayoreo50()) return 'productos.html?mayoreo50=1';
    if (esModoNuevoStock()) return 'productos.html?nuevoStock=1';
    var categoria = params.get('categoria') || 'Hombre';
    return 'productos.html?categoria=' + encodeURIComponent(categoria);
}

window.construirUrlDetalleProducto = construirUrlDetalleProducto;
window.construirUrlVolverProductos = construirUrlVolverProductos;

// Función para obtener filtros activos
function obtenerFiltrosActivos() {
    const tallasSeleccionadas = Array.from(document.querySelectorAll('#tallaFilters .filter-checkbox:checked')).map(cb => cb.value);
    const tiposSeleccionados = Array.from(document.querySelectorAll('#tipoFilters .filter-checkbox:checked')).map(cb => cb.value);
    const colorFiltersEl = document.getElementById('colorFilters');
    const coloresSeleccionados = colorFiltersEl
        ? Array.from(colorFiltersEl.querySelectorAll('.filter-checkbox:checked')).map(cb => cb.value)
        : [];
    const marcaFiltersEl = document.getElementById('marcaFilters');
    const marcasSeleccionadas = marcaFiltersEl
        ? Array.from(marcaFiltersEl.querySelectorAll('.filter-checkbox:checked')).map(cb => cb.value)
        : [];
    const sortByEl = document.getElementById('sortBy');
    const ordenarPor = sortByEl ? sortByEl.value : '';

    return {
        tallas: tallasSeleccionadas,
        tipos: tiposSeleccionados,
        colores: coloresSeleccionados,
        marcas: marcasSeleccionadas,
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

    // Filtrar por marca (incluye la marca de la URL aunque no tenga checkbox, p. ej. marcas sin stock)
    var marcasEfectivas = (filtros.marcas || []).slice();
    (leerFiltrosDesdeURL().marcas || []).forEach(function(m) {
        if (!marcasEfectivas.some(function(x) { return marcaCoincideFiltro(x, m); })) {
            marcasEfectivas.push(m);
        }
    });
    if (marcasEfectivas.length > 0) {
        productosFiltrados = productosFiltrados.filter(function(producto) {
            return producto.marca && marcasEfectivas.some(function(m) { return marcaCoincideFiltro(m, producto.marca); });
        });
    }

    // Ordenar: primero con stock al inicio, agotados (stock 0) al final; dentro de cada grupo por precio si aplica
    productosFiltrados.sort((a, b) => {
        const aAgotado = a.stock === 0 ? 1 : 0;
        const bAgotado = b.stock === 0 ? 1 : 0;
        if (aAgotado !== bAgotado) return aAgotado - bAgotado;
        if (filtros.ordenarPor === 'price-desc') return precioVigenteProducto(b) - precioVigenteProducto(a);
        if (filtros.ordenarPor === 'price-asc') return precioVigenteProducto(a) - precioVigenteProducto(b);
        return 0;
    });

    return productosFiltrados;
}

function obtenerTerminoBusqueda() {
    var mobile = document.getElementById('productSearchInput');
    var desktop = document.getElementById('productSearchInputDesktop');
    var valor = (mobile && mobile.value.trim()) || (desktop && desktop.value.trim()) || '';
    return valor.toLowerCase();
}

function aplicarBusquedaNombre(productosFiltrados) {
    var term = obtenerTerminoBusqueda();
    if (!term) return productosFiltrados;
    return productosFiltrados.filter(function(p) {
        return p.nombre.toLowerCase().includes(term);
    });
}

function textoContadorArticulos(cantidad) {
    var n = Number(cantidad) || 0;
    return n === 1 ? '1 artículo' : n + ' artículos';
}

function actualizarContadorArticulos(cantidad) {
    var el = document.getElementById('pageProductCount');
    if (!el) return;
    if (cantidad === 0 && marcaFiltroActiva()) {
        el.textContent = '';
        return;
    }
    el.textContent = textoContadorArticulos(cantidad);
}

// Aplicar búsqueda por nombre (si hay input de búsqueda) y renderizar
function aplicarBusquedaYRenderizar(productosFiltrados) {
    var visibles = aplicarBusquedaNombre(productosFiltrados);
    actualizarContadorArticulos(visibles.length);
    renderizarProductos(visibles);
    actualizarFiltroGeneroNuevoStockUI();
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

// Comparación normalizada para id+talla+color (evita que tipo string/number impida encontrar la misma línea)
function mismoProductoEnCarrito(item, producto) {
    return Number(item.id) === Number(producto.id) &&
        String(item.talla) === String(producto.talla) &&
        (item.color || '') === (producto.color || '');
}

// Agregar producto al carrito (opciones: { button: elemento } para mostrar palomita en el botón)
// Un mismo artículo puede estar varias veces si difiere en talla o color (id + talla + color identifican la línea)
// Respeta el stock: no permite agregar más unidades de las disponibles
function agregarAlCarrito(producto, opciones) {
    const stockNum = Number(producto.stock);
    const stockDisponible = (typeof producto.stock === 'number' && !isNaN(stockNum)) ? stockNum : Infinity;
    if (stockDisponible <= 0) return;

    const carrito = obtenerCarrito();
    const colorProducto = producto.color || '';

    // Cantidad ya en el carrito para este producto (misma id+talla+color), sumando todas las líneas por si hubiera duplicados
    const cantidadEnCarrito = carrito.reduce(function (sum, item) {
        return mismoProductoEnCarrito(item, producto) ? sum + (item.cantidad || 0) : sum;
    }, 0);

    if (cantidadEnCarrito >= stockDisponible) {
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('No hay más stock disponible (máx. ' + stockDisponible + ')');
        }
        return;
    }

    const itemExistente = carrito.find(function (item) { return mismoProductoEnCarrito(item, producto); });

    if (itemExistente) {
        itemExistente.cantidad += 1;
    } else {
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: precioVigenteProducto(producto),
            precioMenudeo: producto.precio,
            esMayoreo: (esModoMayoreo() && !!producto.mayoreo) || (esModoMayoreo50() && esProductoMayoreo50(producto)),
            talla: producto.talla,
            color: colorProducto,
            imagen1: producto.imagen1,
            cantidad: 1,
            categoria: producto.categoria || 'Hombre'
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
                <div class="cart-item-price">$${formatearPrecio(subtotal)}</div>
            </div>
            <button class="remove-item-btn" data-cart-remove data-id="${item.id}" data-talla="${tallaEscaped.replace(/"/g, '&quot;')}" data-color="${colorEscaped.replace(/"/g, '&quot;')}" aria-label="Eliminar">×</button>
        `;

        cartItems.appendChild(itemDiv);
    });

    cartTotal.textContent = `Total: $${formatearPrecio(total)}`;
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
        const linkProducto = baseUrl + 'producto.html?id=' + item.id + (item.categoria === 'Mujer' ? '&categoria=Mujer' : '');
        mensaje += `${index + 1}. ${item.nombre}\n`;
        mensaje += `   Talla: ${item.talla}\n`;
        if (item.color) mensaje += `   Color: ${item.color}\n`;
        mensaje += `   Cantidad: ${item.cantidad}\n`;
        mensaje += `   Precio: $${formatearPrecio(subtotal)}\n`;
        mensaje += `   Link: ${linkProducto}\n\n`;
    });

    mensaje += `Total: $${formatearPrecio(total)}\n\n`;
    mensaje += 'Gracias!';

    const numeroWhatsApp = '524462207365';
    const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// Función para renderizar productos
function marcaFiltroActiva() {
    var filtros = leerFiltrosDesdeURL();
    if (filtros.marcas && filtros.marcas.length === 1) return filtros.marcas[0];
    var pill = obtenerMarcaDeURL();
    return pill || '';
}

function htmlEstadoVacio() {
    var marca = marcaFiltroActiva();
    if (marca) {
        var marcaSegura = String(marca).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return ''
            + '<div class="coming-soon" role="status">'
            + '  <span class="coming-soon-tag">' + marcaSegura.toUpperCase() + '</span>'
            + '  <span class="coming-soon-title">COMING<span class="coming-soon-amp"> </span>SOON</span>'
            + '  <span class="coming-soon-sub">Nuevo drop en camino</span>'
            + '  <span class="coming-soon-bar"></span>'
            + '</div>';
    }
    return '<p style="padding: 2rem; color: #666; text-align: center; grid-column: 1 / -1;">No hay productos que coincidan con los filtros seleccionados.</p>';
}

// Crea el elemento de una tarjeta de producto (extraído para reutilizarlo en la paginación)
function crearTarjetaProducto(producto) {
    const card = document.createElement('div');
    card.className = 'product-card-full';
    card.setAttribute('data-product-id', producto.id);

    const imagen1 = typeof obtenerRutaImagenProducto === 'function'
        ? obtenerRutaImagenProducto(producto, 1)
        : (producto.imagen1 || '');
    const imagen2 = typeof obtenerRutaImagenProducto === 'function'
        ? obtenerRutaImagenProducto(producto, 2)
        : (producto.imagen2 || '');
    const agotado = producto.stock === 0;

    const detalleUrl = typeof construirUrlDetalleProducto === 'function'
        ? construirUrlDetalleProducto(producto)
        : 'producto.html?id=' + producto.id + (producto.categoria === 'Mujer' ? '&categoria=Mujer' : '');
    const linkProducto = document.createElement(agotado ? 'div' : 'a');
    linkProducto.className = 'product-image-link' + (agotado ? ' product-image-link-agotado' : '');
    if (!agotado) {
        linkProducto.href = detalleUrl;
        linkProducto.setAttribute('aria-label', 'Ver ' + producto.nombre);
    } else {
        linkProducto.setAttribute('aria-label', producto.nombre + ' (agotado)');
    }

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
        ${htmlPrecioProducto(producto)}
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

    return card;
}

// ===== Paginación: renderizar de 50 en 50 =====
var PRODUCTOS_POR_BLOQUE = 50;
var _listaRenderizado = [];
var _renderizadosCount = 0;
var _observerCargarMas = null;
var _cargandoMas = false;

function contarTarjetasEnGrid() {
    var grid = document.getElementById('productsGrid');
    if (!grid) return 0;
    return grid.querySelectorAll('.product-card-full').length;
}

function sincronizarContadorRenderizado() {
    var enDom = contarTarjetasEnGrid();
    if (enDom > _renderizadosCount) {
        _renderizadosCount = Math.min(enDom, _listaRenderizado.length);
    }
}

function sentinelVisible() {
    var sentinel = document.getElementById('loadMoreSentinel');
    if (!sentinel) return false;
    var rect = sentinel.getBoundingClientRect();
    return rect.top <= window.innerHeight + 600;
}

function productosPendientesDeRenderizar() {
    sincronizarContadorRenderizado();
    return Math.max(0, _listaRenderizado.length - _renderizadosCount);
}

function actualizarControlesCargarMas() {
    var wrap = document.getElementById('loadMoreWrap');
    var quedan = productosPendientesDeRenderizar();
    if (wrap) {
        if (quedan > 0) {
            wrap.hidden = false;
            var btn = document.getElementById('loadMoreBtn');
            if (btn) btn.textContent = 'Ver más productos';
        } else {
            wrap.hidden = true;
        }
    }
    var sentinel = document.getElementById('loadMoreSentinel');
    if (!sentinel || !('IntersectionObserver' in window)) return;
    if (quedan > 0) {
        if (!_observerCargarMas) {
            _observerCargarMas = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) renderizarSiguienteBloque();
                });
            }, { rootMargin: '600px 0px' });
        }
        _observerCargarMas.observe(sentinel);
    } else if (_observerCargarMas) {
        _observerCargarMas.unobserve(sentinel);
    }
}

function renderizarSiguienteBloque() {
    if (_cargandoMas) return;
    sincronizarContadorRenderizado();
    if (_renderizadosCount >= _listaRenderizado.length) {
        actualizarControlesCargarMas();
        return;
    }

    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;

    _cargandoMas = true;
    try {
        var fin = Math.min(_renderizadosCount + PRODUCTOS_POR_BLOQUE, _listaRenderizado.length);
        if (sentinelVisible()) {
            fin = _listaRenderizado.length;
        }
        var fragmento = document.createDocumentFragment();
        for (var i = _renderizadosCount; i < fin; i++) {
            fragmento.appendChild(crearTarjetaProducto(_listaRenderizado[i]));
        }
        productsGrid.appendChild(fragmento);
        _renderizadosCount = fin;
    } finally {
        _cargandoMas = false;
    }

    actualizarControlesCargarMas();

    if (productosPendientesDeRenderizar() > 0 && sentinelVisible()) {
        renderizarSiguienteBloque();
    }
}

function renderizarProductos(productosParaRenderizar) {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;

    productsGrid.innerHTML = '';
    _listaRenderizado = productosParaRenderizar || [];
    _renderizadosCount = 0;

    if (_listaRenderizado.length === 0) {
        productsGrid.innerHTML = htmlEstadoVacio();
        actualizarControlesCargarMas();
        return;
    }

    renderizarSiguienteBloque();
}

// Función principal para renderizar todos los productos
function renderizarTodosLosProductos() {
    const categoria = obtenerCategoriaDeURL();
    const marca = obtenerMarcaDeURL();
    const pageTitle = document.getElementById('pageTitle');
    
    function actualizarTituloPagina() {
        if (!pageTitle) return;
        var tituloBase = categoria === 'Hombre' ? 'PARA NUESTROS ATLETAS' : (categoria === 'Mujer' ? 'PARA NUESTRAS ATLETAS' : 'Productos');
        if (esModoMayoreo50()) tituloBase = 'MAYOREO +50';
        else if (esModoMayoreo()) tituloBase = 'MAYOREO +20';
        else if (esModoNuevoStock()) {
            tituloBase = 'NUEVO STOCK';
            if (window.fechaStockMasRecienteEtiqueta) {
                tituloBase += ' · ' + window.fechaStockMasRecienteEtiqueta.toUpperCase();
            }
        }
        var filtrosUrl = leerFiltrosDesdeURL();
        var marcaTitulo = filtrosUrl.marcas.length === 1 ? filtrosUrl.marcas[0] : (marca || '');
        var titulo = marcaTitulo ? (tituloBase + ' · ' + marcaTitulo.toUpperCase()) : tituloBase;
        var esMovil = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
        pageTitle.textContent = esMovil ? tituloBase : titulo;
    }
    actualizarTituloPagina();
    if (pageTitle && window.matchMedia) {
        var mq = window.matchMedia('(max-width: 768px)');
        if (mq.addEventListener) mq.addEventListener('change', actualizarTituloPagina);
        else if (mq.addListener) mq.addListener(actualizarTituloPagina);
    }

    // Filtrar productos por categoría (Mujer usa archivo separado productos-mujer.js)
    const productosCategoria = obtenerProductosPorCategoria();

    // Generar filtros dinámicamente
    generarFiltros(productosCategoria);
    restaurarFiltrosDesdeURL();

    // Aplicar filtros y ordenamiento inicial
    const productosFiltrados = aplicarFiltrosYOrdenar(productosCategoria);
    aplicarBusquedaYRenderizar(productosFiltrados);
    actualizarFiltroGeneroNuevoStockUI();
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
        var searchMobile = document.getElementById('productSearchInput');
        var searchDesktop = document.getElementById('productSearchInputDesktop');
        if (searchMobile) searchMobile.value = '';
        if (searchDesktop) searchDesktop.value = '';
        limpiarFiltrosEnURL();
        const productosCategoria = obtenerProductosPorCategoria();
        aplicarBusquedaYRenderizar(productosCategoria);
    }

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function(e) {
            e.preventDefault();
            renderizarSiguienteBloque();
        });
    }

    const clearFilters = document.getElementById('clearFilters');
    if (clearFilters) clearFilters.addEventListener('click', ejecutarLimpiarFiltros);

    const clearFiltersTop = document.getElementById('clearFiltersTop');
    if (clearFiltersTop) clearFiltersTop.addEventListener('click', ejecutarLimpiarFiltros);

    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            sincronizarFiltrosConURL();
            const productosCategoria = obtenerProductosPorCategoria();
            const productosFiltrados = aplicarFiltrosYOrdenar(productosCategoria);
            aplicarBusquedaYRenderizar(productosFiltrados);
            var wrapper = document.getElementById('filtersProductsWrapper');
            var toggleBtn = document.getElementById('filtersToggleBtn');
            if (wrapper) wrapper.classList.remove('filters-panel-open');
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('filters-mobile-open');
        });
    }

    function onSearchInput() {
        sincronizarFiltrosConURL();
        const productosCategoria = obtenerProductosPorCategoria();
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
    if (toggleBtn.dataset.filtersInit === 'true') return;
    toggleBtn.dataset.filtersInit = 'true';

    function abrirFiltros() {
        wrapper.classList.add('filters-panel-open');
        toggleBtn.setAttribute('aria-expanded', 'true');
        document.body.classList.add('filters-mobile-open');
    }

    function cerrarFiltros() {
        wrapper.classList.remove('filters-panel-open');
        toggleBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('filters-mobile-open');
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

    // Evitar listener global de "click fuera": el botón Filtros está fuera del wrapper
    // y en móvil cerraba el panel al instante de abrirlo.
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

    // Botón "Mujer" es un <a href="productos.html?categoria=Mujer">: no interceptar el clic
    // para que funcione siempre (localhost y en línea) sin depender de JavaScript.
    const btnMujerMobile = document.getElementById('btnMujerMobile');
    if (btnMujerMobile && mobileMenuBtn && mobileNav) {
        btnMujerMobile.addEventListener('click', () => {
            mobileMenuBtn.classList.remove('active');
            mobileNav.classList.remove('active');
            document.body.classList.remove('mobile-menu-open');
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

// Al volver atrás (bfcache), restaurar filtros y refrescar imágenes
window.addEventListener('pageshow', (event) => {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    if (event.persisted) {
        var productosCategoria = obtenerProductosPorCategoria();
        generarFiltros(productosCategoria);
        restaurarFiltrosDesdeURL();
        var productosFiltrados = aplicarFiltrosYOrdenar(productosCategoria);
        aplicarBusquedaYRenderizar(productosFiltrados);
        actualizarFiltroGeneroNuevoStockUI();
    }

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

    const iniciarPagina = () => {
        if (isProductDetailPage) {
            inicializarCarrito();
            inicializarNavegacion();
            if (typeof iniciarDetalleProducto === 'function') iniciarDetalleProducto();
        } else if (isProductsGridPage) {
            renderizarTodosLosProductos();
            inicializarFiltroGeneroNuevoStock();
            inicializarHoverImagenes();
            inicializarEventosFiltros();
            inicializarFiltrosToggle();
            inicializarCarrito();
            inicializarNavegacion();
        } else {
            var isIndexPage = document.getElementById('inicio') || document.querySelector('section.hero');
            if (!isIndexPage) {
                inicializarCarrito();
                inicializarNavegacion();
            }
        }
    };

    if (typeof sincronizarStockDesdeSheets === 'function') {
        var promesaStock = sincronizarStockDesdeSheets();
        var promesaML = typeof cargarListadosMercadoLibre === 'function'
            ? cargarListadosMercadoLibre()
            : Promise.resolve();
        Promise.all([promesaStock, promesaML]).then(iniciarPagina);
    } else if (typeof cargarListadosMercadoLibre === 'function') {
        cargarListadosMercadoLibre().then(iniciarPagina);
    } else {
        iniciarPagina();
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
