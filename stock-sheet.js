// Sincroniza stock, precio y tipo desde Google Sheets al cargar la página.
// Si columna C (CANTIDAD) es 0, el producto queda con stock 0 y se oculta en la tienda.
(function() {
    var SPREADSHEET_ID = '195xshQr985FH1FI4xzBhQrvrBEayAE5_manTNrfH-ko';
    var HOJA_INVENTARIO = 'HOMBRE';
    var FILA_INICIO = 2; // fila 3 del sheet (0-based en CSV)
    var IDX_SEGMENTO = 19; // columna T

    var MARCAS = {
        'GYMSHARK': 'Gym Shark',
        'GYM SHARK': 'Gym Shark',
        'YOUNGLA': 'YoungLA',
        'YOUNG LA': 'YoungLA',
        'UNIQLO': 'Uniqlo',
        'ON CLOUD': 'On Cloud'
    };

    var COLORES = {
        'BLACK': 'Negro', 'NEGRO': 'Negro',
        'WHITE': 'Blanco', 'BLANCO': 'Blanco',
        'GREY': 'Gris', 'GRAY': 'Gris', 'GRIS': 'Gris',
        'GREEN': 'Verde', 'VERDE': 'Verde',
        'BLUE': 'Azul', 'AZUL': 'Azul',
        'RED': 'Rojo', 'ROJO': 'Rojo',
        'BROWN': 'Marrón', 'CAFE': 'Marrón', 'CAFÉ': 'Marrón', 'MARRON': 'Marrón', 'MARRÓN': 'Marrón',
        'BEIGE': 'Beige',
        'TEAL': 'Verde azulado',
        'PINK': 'Rosa', 'ROSA': 'Rosa',
        'YELLOW': 'Amarillo', 'AMARILLO': 'Amarillo',
        'ORANGE': 'Naranja', 'NARANJA': 'Naranja',
        'PURPLE': 'Morado', 'MORADO': 'Morado',
        'NAVY': 'Azul marino', 'AZUL MARINO': 'Azul marino',
        'BURGUNDY': 'Burgundy', 'BURDEOS': 'Burgundy'
    };

    var COLOR_CLAVE_ALIAS = {
        marron: 'marron',
        marrn: 'marron',
        brown: 'marron',
        cafe: 'marron',
        verdeazulado: 'verdeazulado',
        teal: 'verdeazulado',
        azulmarino: 'azulmarino',
        navy: 'azulmarino',
        burgundy: 'burgundy',
        burdeos: 'burgundy'
    };

    function normTexto(valor) {
        return String(valor || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    function normalizarMarca(valor) {
        var clave = String(valor || '').trim().toUpperCase().replace(/\s+/g, ' ');
        return MARCAS[clave] || String(valor || '').trim().replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    }

    function normalizarColor(valor) {
        var clave = String(valor || '').trim().toUpperCase();
        if (!clave) return '';
        return COLORES[clave] || String(valor || '').trim().replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    }

    function normalizarTipo(valor) {
        var texto = String(valor || '').trim();
        if (!texto) return '';
        var mapa = {
            'T-SHIRT': 'T-Shirt',
            'TSHIRT': 'T-Shirt',
            'TEE': 'T-Shirt',
            'TANK TOP': 'Tank Top',
            'TANK': 'Tank Top',
            'HOODIE': 'Hoodie',
            'JOGGERS': 'Joggers',
            'PANTS': 'Pants',
            'SHORT': 'Short',
            'JERSEY': 'Jersey',
            'POLO': 'Polo',
            'CAP': 'Cap',
            'CAPS': 'Cap'
        };
        var clave = texto.toUpperCase();
        if (mapa[clave]) return mapa[clave];
        return texto.toLowerCase().replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    }

    function parsearStock(valor) {
        if (!valor || !String(valor).trim()) return 0;
        var n = parseInt(String(valor).trim().replace(',', '.'), 10);
        return isNaN(n) ? 0 : n;
    }

    function parsearPrecio(valor) {
        if (!valor || !String(valor).trim()) return 0;
        var texto = String(valor).trim().replace(/\$/g, '').replace(/\s/g, '');
        if (/^\d{1,3}(\.\d{3})+$/.test(texto)) texto = texto.replace(/\./g, '');
        var n = parseFloat(texto.replace(',', '.'));
        return isNaN(n) ? 0 : Math.round(n * 100) / 100;
    }

    function parseCSV(texto) {
        var filas = [];
        var fila = [];
        var celda = '';
        var enComillas = false;
        for (var i = 0; i < texto.length; i++) {
            var c = texto[i];
            var sig = texto[i + 1];
            if (c === '"') {
                if (enComillas && sig === '"') { celda += '"'; i++; }
                else enComillas = !enComillas;
            } else if (c === ',' && !enComillas) {
                fila.push(celda); celda = '';
            } else if ((c === '\n' || c === '\r') && !enComillas) {
                if (c === '\r' && sig === '\n') i++;
                fila.push(celda); celda = '';
                if (fila.length > 1 || (fila[0] && fila[0].trim())) filas.push(fila);
                fila = [];
            } else {
                celda += c;
            }
        }
        if (celda.length || fila.length) {
            fila.push(celda);
            if (fila.length > 1 || (fila[0] && fila[0].trim())) filas.push(fila);
        }
        return filas;
    }

    function normColorClave(color) {
        var texto = normalizarColor(color);
        var base = normTexto(texto)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\?/g, '');
        var compact = base.replace(/\s+/g, '');
        return COLOR_CLAVE_ALIAS[compact] || COLOR_CLAVE_ALIAS[base] || compact || base;
    }

    function claveProducto(nombre, talla, color, marca) {
        return [
            normTexto(nombre),
            normTexto(talla),
            normColorClave(color),
            normTexto(normalizarMarca(marca))
        ].join('|');
    }

    function normalizarSegmento(valor) {
        var clave = String(valor || '').trim().toUpperCase().replace(/\s+/g, ' ');
        if (clave === 'MUJER' || clave === 'WOMAN' || clave === 'WOMEN' || clave === 'FEMENINO' || clave === 'F') {
            return 'Mujer';
        }
        return 'Hombre';
    }

    function hojaUsaColumnaSegmento(filas) {
        for (var i = FILA_INICIO; i < filas.length; i++) {
            var f = filas[i];
            var nombre = (f[1] || '').trim();
            if (!nombre) continue;
            if ((f[IDX_SEGMENTO] || '').trim()) return true;
        }
        return false;
    }

    function filaPerteneceCategoria(fila, categoria, usarSegmento) {
        if (!usarSegmento) return true;
        return normalizarSegmento(fila[IDX_SEGMENTO]) === categoria;
    }

    function leerFilasSheet(csvTexto, categoria) {
        var filas = parseCSV(csvTexto);
        var usarSegmento = hojaUsaColumnaSegmento(filas);
        var mapa = new Map();
        for (var i = FILA_INICIO; i < filas.length; i++) {
            var f = filas[i];
            var nombre = (f[1] || '').trim();
            if (!nombre) continue;
            if (!filaPerteneceCategoria(f, categoria, usarSegmento)) continue;
            var stock = parsearStock(f[2]);
            var talla = (f[3] || '').trim();
            var color = normalizarColor(f[4]);
            var tipo = normalizarTipo(f[5]);
            var marca = normalizarMarca(f[6]);
            var precio = parsearPrecio(f[7]);
            var clave = claveProducto(nombre, talla, color, marca);
            var previo = mapa.get(clave);
            if (previo) {
                previo.stock = Math.min(previo.stock, stock);
                if (precio > 0) previo.precio = precio;
                if (tipo) previo.tipo = tipo;
            } else {
                mapa.set(clave, { stock: stock, precio: precio, tipo: tipo });
            }
        }
        return mapa;
    }

    function buscarEnMapa(mapa, nombre, talla, color, marca) {
        var clave = claveProducto(nombre, talla, color, marca);
        if (mapa.has(clave)) return mapa.get(clave);

        var prefijo = normTexto(nombre) + '|' + normTexto(talla) + '|';
        var sufijo = '|' + normTexto(normalizarMarca(marca));
        var candidato = null;
        var coincidencias = 0;
        mapa.forEach(function(valor, key) {
            if (key.indexOf(prefijo) === 0 && key.slice(-sufijo.length) === sufijo) {
                coincidencias += 1;
                candidato = valor;
            }
        });
        return coincidencias === 1 ? candidato : null;
    }

    function sincronizarCatalogo(catalogo, mapaSheet) {
        if (!Array.isArray(catalogo)) return 0;
        var actualizados = 0;
        catalogo.forEach(function(p) {
            var talla = p.tallaBase || String(p.talla || '').split('-')[0].trim();
            var datos = buscarEnMapa(mapaSheet, p.nombre, talla, p.color, p.marca);
            if (datos) {
                p.stock = datos.stock;
                if (datos.precio > 0) p.precio = datos.precio;
                if (datos.tipo) p.tipo = datos.tipo;
                actualizados += 1;
            }
            // Sin coincidencia en el sheet: conservar stock del catálogo local.
        });
        return actualizados;
    }

    function descargarHoja(nombreHoja) {
        var url = 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID +
            '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(nombreHoja) +
            '&_=' + Date.now();
        return fetch(url, { cache: 'no-store' }).then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.text();
        });
    }

    function sincronizarDesdeCsv(csv) {
        var tareas = [];
        if (typeof productosHombre !== 'undefined' && Array.isArray(productosHombre)) {
            var nH = sincronizarCatalogo(productosHombre, leerFilasSheet(csv, 'Hombre'));
            tareas.push(nH);
        }
        if (typeof productosMujer !== 'undefined' && Array.isArray(productosMujer)) {
            var nM = sincronizarCatalogo(productosMujer, leerFilasSheet(csv, 'Mujer'));
            tareas.push(nM);
        }
        return tareas;
    }

    window.sincronizarStockDesdeSheets = function() {
        var tieneHombre = typeof productosHombre !== 'undefined' && Array.isArray(productosHombre);
        var tieneMujer = typeof productosMujer !== 'undefined' && Array.isArray(productosMujer);

        if (!tieneHombre && !tieneMujer) {
            return Promise.resolve();
        }

        return descargarHoja(HOJA_INVENTARIO)
            .then(function(csv) {
                sincronizarDesdeCsv(csv);
            })
            .catch(function(err) {
                console.warn('[stock-sheet] ' + HOJA_INVENTARIO + ':', err);
            });
    };
})();
