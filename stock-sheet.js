// Sincroniza stock, precio, tipo, color, talla y marca desde Google Sheets al cargar la página.
// Los filtros de la tienda usan los valores del sheet (solo filas con stock > 0).
(function() {
    var SPREADSHEET_ID = '195xshQr985FH1FI4xzBhQrvrBEayAE5_manTNrfH-ko';
    var HOJA_INVENTARIO = 'INVENTARIO';
    var HOJA_INVENTARIO_LEGACY = 'HOMBRE';
    var FILA_INICIO = 2; // fila 3 del sheet (0-based en CSV)
    var IDX_IMAGEN = 0; // columna A (número de imagen / referencia de producto)
    var IDX_SEGMENTO = 19; // columna T
    var IDX_PRECIO_MAYOREO = 15; // columna P
    var IDX_MAYOREO = 17; // columna R
    var IDX_CARRUSEL = 20; // columna U
    var IDX_FECHA_STOCK = 10; // columna K

    var MESES_FECHA_STOCK = {
        ene: 0, enero: 0, feb: 1, febrero: 1, mar: 2, marzo: 2, abr: 3, abril: 3,
        may: 4, mayo: 4, jun: 5, junio: 5, jul: 6, julio: 6, ago: 7, agosto: 7,
        sep: 8, sept: 8, septiembre: 8, oct: 9, octubre: 9, nov: 10, noviembre: 10,
        dic: 11, diciembre: 11
    };

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

    function normalizarTalla(valor) {
        var texto = String(valor || '').trim();
        if (!texto) return '';
        var clave = texto.toUpperCase().replace(/\s+/g, ' ');
        var alias = {
            'UNI': 'UNI',
            'U': 'UNI',
            'OS': 'UNI',
            'ONE SIZE': 'UNI',
            'ONE-SIZE': 'UNI',
            'ONESIZE': 'UNI',
            'FREE SIZE': 'UNI',
            'FREE-SIZE': 'UNI',
            'TALLA UNICA': 'UNI',
            'TALLA ÚNICA': 'UNI',
            'UNICA': 'UNI',
            'ÚNICA': 'UNI',
            'UNIQUE': 'UNI'
        };
        return alias[clave] || texto;
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
            'CAPS': 'Cap',
            'BACKPACK': 'Backpack'
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

    function parsearMayoreo(valor) {
        var clave = String(valor || '').trim().toLowerCase().replace(/í/g, 'i');
        return clave === 'si' || clave === 'yes' || clave === '1' || clave === 'true';
    }

    function parsearPosicionCarrusel(valor) {
        var n = parseInt(String(valor || '').trim(), 10);
        return (n >= 1 && n <= 8) ? n : 0;
    }

    function pad2(num) {
        return String(num).padStart(2, '0');
    }

    function fechaStockAISO(anio, mes, dia) {
        if (!anio || mes < 0 || mes > 11 || !dia) return '';
        return String(anio) + '-' + pad2(mes + 1) + '-' + pad2(dia);
    }

    function parsearFechaStock(valor) {
        var texto = String(valor || '').trim();
        if (!texto) return '';

        var iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (iso) return fechaStockAISO(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));

        function parsearDmyTexto(partes) {
            var mesTexto = partes[2].toLowerCase().replace(/\./g, '');
            var mes = MESES_FECHA_STOCK[mesTexto];
            if (mes === undefined) mes = MESES_FECHA_STOCK[mesTexto.slice(0, 3)];
            if (mes === undefined) return '';
            var anio = parseInt(partes[3], 10);
            if (anio < 100) anio += 2000;
            return fechaStockAISO(anio, mes, parseInt(partes[1], 10));
        }

        var dmyTexto = texto.match(/^(\d{1,2})[-\/]([a-zA-Z]{3,})[-\/](\d{4})$/);
        if (dmyTexto) {
            var isoTexto = parsearDmyTexto(dmyTexto);
            if (isoTexto) return isoTexto;
        }

        var dmyTextoCorto = texto.match(/^(\d{1,2})[-\/]([a-zA-Z]{3,})[-\/](\d{2})$/);
        if (dmyTextoCorto) {
            var isoCorto = parsearDmyTexto(dmyTextoCorto);
            if (isoCorto) return isoCorto;
        }

        var dmyNum = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmyNum) {
            return fechaStockAISO(parseInt(dmyNum[3], 10), parseInt(dmyNum[2], 10) - 1, parseInt(dmyNum[1], 10));
        }

        var parsed = Date.parse(texto);
        if (!isNaN(parsed)) {
            var d = new Date(parsed);
            return fechaStockAISO(d.getFullYear(), d.getMonth(), d.getDate());
        }
        return '';
    }

    function formatearFechaStockEtiqueta(iso) {
        if (!iso) return '';
        var partes = iso.split('-');
        if (partes.length !== 3) return iso;
        var etiquetas = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        var mes = parseInt(partes[1], 10) - 1;
        if (mes < 0 || mes > 11) return iso;
        return pad2(parseInt(partes[2], 10)) + '-' + etiquetas[mes] + '-' + partes[0];
    }

    function extraerFechaStockMasReciente(csvTexto) {
        var filas = parseCSV(csvTexto);
        var maxTime = 0;
        var maxFecha = '';
        for (var i = FILA_INICIO; i < filas.length; i++) {
            var f = filas[i];
            var nombre = (f[1] || '').trim();
            if (!nombre || nombre.toUpperCase() === 'NOMBRE') continue;
            var fecha = parsearFechaStock(f[IDX_FECHA_STOCK]);
            if (!fecha) continue;
            var time = new Date(fecha + 'T00:00:00').getTime();
            if (!isNaN(time) && time >= maxTime) {
                maxTime = time;
                maxFecha = fecha;
            }
        }
        return maxFecha;
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

    function parsearNumeroImagen(valor) {
        var texto = String(valor || '').trim();
        if (!texto) return 0;
        var n = parseInt(texto, 10);
        return isNaN(n) || n <= 0 ? 0 : n;
    }

    function extraerRefImagenProducto(producto) {
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

    function claveProducto(nombre, talla, color, marca, refImagen) {
        var partes = [
            normTexto(nombre),
            normTexto(normalizarTalla(talla)),
            normColorClave(color),
            normTexto(normalizarMarca(marca))
        ];
        var ref = parsearNumeroImagen(refImagen);
        if (ref > 0) partes.push(String(ref));
        return partes.join('|');
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
            var talla = normalizarTalla(f[3]);
            var color = normalizarColor(f[4]);
            var tipo = normalizarTipo(f[5]);
            var marca = normalizarMarca(f[6]);
            var precio = parsearPrecio(f[7]);
            var precioMayoreo = parsearPrecio(f[IDX_PRECIO_MAYOREO]);
            var mayoreo = parsearMayoreo(f[IDX_MAYOREO]);
            var posicionCarrusel = parsearPosicionCarrusel(f[IDX_CARRUSEL]);
            var fechaStock = parsearFechaStock(f[IDX_FECHA_STOCK]);
            var refImagen = parsearNumeroImagen(f[IDX_IMAGEN]);
            if (stock > 0) {
                if (talla) opciones.tallas.add(talla);
                if (color) opciones.colores.add(color);
                if (tipo) opciones.tipos.add(tipo);
                if (marca) opciones.marcas.add(marca);
            }
            var clave = claveProducto(nombre, talla, color, marca, refImagen);
            var datosFila = {
                stock: stock,
                precio: precio,
                precioMayoreo: precioMayoreo,
                mayoreo: mayoreo,
                posicionCarrusel: posicionCarrusel,
                fechaStock: fechaStock,
                tipo: tipo,
                color: color,
                marca: marca,
                talla: talla,
                refImagen: refImagen
            };
            var previo = mapa.get(clave);
            if (previo) {
                previo.stock = Math.min(previo.stock, stock);
                if (precio > 0) previo.precio = precio;
                if (precioMayoreo > 0) previo.precioMayoreo = precioMayoreo;
                previo.mayoreo = previo.mayoreo || mayoreo;
                if (posicionCarrusel > 0) previo.posicionCarrusel = posicionCarrusel;
                if (fechaStock) previo.fechaStock = fechaStock;
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

    function buscarEnMapa(mapa, nombre, talla, color, marca, refImagen) {
        var ref = parsearNumeroImagen(refImagen);
        var intentos = [];
        if (ref > 0) intentos.push(ref);
        intentos.push(0);

        for (var i = 0; i < intentos.length; i++) {
            var clave = claveProducto(nombre, talla, color, marca, intentos[i]);
            if (mapa.has(clave)) return mapa.get(clave);
        }
        return null;
    }

    function sincronizarCatalogo(catalogo, mapaSheet) {
        if (!Array.isArray(catalogo)) return 0;
        var actualizados = 0;
        catalogo.forEach(function(p) {
            var talla = normalizarTalla(p.tallaBase || String(p.talla || '').split('-')[0].trim());
            var refImagen = extraerRefImagenProducto(p);
            var datos = buscarEnMapa(mapaSheet, p.nombre, talla, p.color, p.marca, refImagen);
            if (datos) {
                p.stock = datos.stock;
                if (datos.precio > 0) p.precio = datos.precio;
                if (datos.precioMayoreo > 0) p.precioMayoreo = datos.precioMayoreo;
                p.mayoreo = !!datos.mayoreo;
                p.posicionCarrusel = datos.posicionCarrusel || 0;
                p.fechaStock = datos.fechaStock || '';
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
        var fechaReciente = extraerFechaStockMasReciente(csv);
        window.fechaStockMasReciente = fechaReciente;
        window.fechaStockMasRecienteEtiqueta = formatearFechaStockEtiqueta(fechaReciente);

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
