// Sincroniza stock, precio, tipo, color, talla y marca desde Google Sheets al cargar la página.
// Los filtros de la tienda usan los valores del sheet (solo filas con stock > 0).
(function() {
    var SPREADSHEET_ID = '195xshQr985FH1FI4xzBhQrvrBEayAE5_manTNrfH-ko';
    var HOJA_INVENTARIO = 'INVENTARIO';
    var HOJA_INVENTARIO_LEGACY = 'HOMBRE';
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
        'PINK': 'Rosa', 'ROSA': 'Rosa',
        'YELLOW': 'Amarillo', 'AMARILLO': 'Amarillo',
        'ORANGE': 'Naranja', 'NARANJA': 'Naranja',
        'PURPLE': 'Morado', 'MORADO': 'Morado',
        'BURGUNDY': 'Burdeos', 'BURDEOS': 'Burdeos'
    };

    var COLOR_CLAVE_ALIAS = {
        marron: 'marron',
        marrn: 'marron',
        brown: 'marron',
        cafe: 'marron',
        burgundy: 'burdeos',
        burdeos: 'burdeos'
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

    function setsToSortedArrays(opciones) {
        function ordenar(arr) {
            return arr.slice().sort(function(a, b) {
                return String(a).localeCompare(String(b), 'es', { sensitivity: 'base' });
            });
        }
        return {
            tallas: ordenar(Array.from(opciones.tallas)),
            tipos: ordenar(Array.from(opciones.tipos)),
            colores: ordenar(Array.from(opciones.colores)),
            marcas: ordenar(Array.from(opciones.marcas))
        };
    }

    function leerFilasSheet(csvTexto, categoria) {
        var filas = parseCSV(csvTexto);
        var usarSegmento = hojaUsaColumnaSegmento(filas);
        var mapa = new Map();
        var opciones = {
            tallas: new Set(),
            tipos: new Set(),
            colores: new Set(),
            marcas: new Set()
        };
        for (var i = FILA_INICIO; i < filas.length; i++) {
            var f = filas[i];
            var nombre = (f[1] || '').trim();
            if (!nombre || nombre.toUpperCase() === 'NOMBRE') continue;
            if (!filaPerteneceCategoria(f, categoria, usarSegmento)) continue;
            var stock = parsearStock(f[2]);
            var talla = (f[3] || '').trim();
            var color = normalizarColor(f[4]);
            var tipo = normalizarTipo(f[5]);
            var marca = normalizarMarca(f[6]);
            var precio = parsearPrecio(f[7]);
            if (stock > 0) {
                if (talla) opciones.tallas.add(talla);
                if (color) opciones.colores.add(color);
                if (tipo) opciones.tipos.add(tipo);
                if (marca) opciones.marcas.add(marca);
            }
            var clave = claveProducto(nombre, talla, color, marca);
            var datosFila = { stock: stock, precio: precio, tipo: tipo, color: color, marca: marca, talla: talla };
            var previo = mapa.get(clave);
            if (previo) {
                previo.stock = Math.min(previo.stock, stock);
                if (precio > 0) previo.precio = precio;
                if (tipo) previo.tipo = tipo;
                if (color) previo.color = color;
                if (marca) previo.marca = marca;
                if (talla) previo.talla = talla;
            } else {
                mapa.set(clave, datosFila);
            }
        }
        return { mapa: mapa, opciones: setsToSortedArrays(opciones) };
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
                if (datos.color) p.color = datos.color;
                if (datos.marca) p.marca = datos.marca;
                if (datos.talla) {
                    p.talla = datos.talla;
                    p.tallaBase = datos.talla;
                }
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
        var opcionesSheet = {};
        if (typeof productosHombre !== 'undefined' && Array.isArray(productosHombre)) {
            var datosHombre = leerFilasSheet(csv, 'Hombre');
            sincronizarCatalogo(productosHombre, datosHombre.mapa);
            opcionesSheet.Hombre = datosHombre.opciones;
        }
        if (typeof productosMujer !== 'undefined' && Array.isArray(productosMujer)) {
            var datosMujer = leerFilasSheet(csv, 'Mujer');
            sincronizarCatalogo(productosMujer, datosMujer.mapa);
            opcionesSheet.Mujer = datosMujer.opciones;
        }
        window.opcionesInventarioSheet = opcionesSheet;
        return opcionesSheet;
    }

    window.sincronizarStockDesdeSheets = function() {
        var tieneHombre = typeof productosHombre !== 'undefined' && Array.isArray(productosHombre);
        var tieneMujer = typeof productosMujer !== 'undefined' && Array.isArray(productosMujer);

        if (!tieneHombre && !tieneMujer) {
            return Promise.resolve();
        }

        return descargarHoja(HOJA_INVENTARIO)
            .catch(function() {
                console.warn('[stock-sheet] Probando hoja legacy ' + HOJA_INVENTARIO_LEGACY);
                return descargarHoja(HOJA_INVENTARIO_LEGACY);
            })
            .then(function(csv) {
                sincronizarDesdeCsv(csv);
            })
            .catch(function(err) {
                console.warn('[stock-sheet] inventario:', err);
            });
    };
})();
