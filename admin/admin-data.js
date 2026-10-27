(function (global) {
    'use strict';

    var SPREADSHEET_ID = '195xshQr985FH1FI4xzBhQrvrBEayAE5_manTNrfH-ko';
    var HOJA_INVENTARIO = 'INVENTARIO';
    var HOJA_VENTAS = 'VENTAS';
    var HOJA_MAYOREO = 'MAYOREO';
    /** Clientes que se gestionan en hoja MAYOREO (no en ranking Clientes retail). Siguen en VENTAS. */
    var CLIENTES_SOLO_MAYOREO = ['naty'];
    var CLIENTE_MAYOREO_DEFAULT = 'NATY';
    /** gid de cada pestaña (htmlview del libro). /export?gid=… ignora filtros ocultos en Sheets. */
    var GID_POR_HOJA = {
        INVENTARIO: 0,
        VENTAS: 915963655,
        MAYOREO: 1380760612
    };
    var MAYOREO_FILA_INICIO = 1;
    var MAYOREO_FILA_MAX = 95;
    var FILA_INICIO = 2;
    var FILA_ENCABEZADOS = 1;
    var INVENTARIO_NUM_COLS = 29;

    var IDX = {
        imagen: 0,
        nombre: 1,
        stock: 2,
        talla: 3,
        color: 4,
        tipo: 5,
        marca: 6,
        precio: 7,
        fechaStock: 10,
        precioMayoreo: 15,
        mayoreo: 17,
        precioMayoreo50: 21,
        segmento: 19,
        ubicacion: 27
    };

    var IDX_V = {
        fecha: 1,
        nombre: 2,
        tipo: 3,
        precio: 4,
        talla: 5,
        color: 6,
        segmento: 7,
        cliente: 8,
        vendedor: 9,
        cuenta: 10,
        redSocial: 11,
        link: 12,
        telefono: 13
    };

    var MESES_FECHA = {
        ene: 0, enero: 0, feb: 1, febrero: 1, mar: 2, marzo: 2, abr: 3, abril: 3,
        may: 4, mayo: 4, jun: 5, junio: 5, jul: 6, julio: 6, ago: 7, agosto: 7,
        sep: 8, sept: 8, septiembre: 8, oct: 9, octubre: 9, nov: 10, noviembre: 10,
        dic: 11, diciembre: 11
    };

    var IDX_M = {
        nombre: 1,
        cantidad: 2,
        talla: 3,
        color: 4,
        tipo: 5,
        marca: 6,
        precioRetail: 7,
        precioMayoreo: 8,
        costoNeto: 9
    };

    var CACHE_INV_KEY = 'obebe_admin_inv_cache_v1';
    /** Memoria: evita re-fetch al cambiar de módulo */
    var MEMORY_INV_TTL_MS = 5 * 60 * 1000;
    /** localStorage: abre el panel al instante y refresca en segundo plano */
    var STORAGE_INV_TTL_MS = 20 * 60 * 1000;

    var estado = {
        filas: [],
        ventas: [],
        lineasMayoreo: [],
        encabezadosFila2: [],
        cargadoEn: null,
        ventasCargadoEn: null,
        mayoreoCargadoEn: null,
        error: null,
        errorVentas: null,
        errorMayoreo: null,
        sheetUrl: 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit',
        inventarioSyncEnCurso: false
    };

    function guardarCacheInventarioLocal() {
        if (!estado.filas.length) return;
        try {
            localStorage.setItem(CACHE_INV_KEY, JSON.stringify({
                t: Date.now(),
                encabezadosFila2: estado.encabezadosFila2,
                filas: estado.filas
            }));
        } catch (e) {
            console.warn('[admin-data] cache inventario', e);
        }
    }

    function leerCacheInventarioLocal() {
        try {
            var raw = localStorage.getItem(CACHE_INV_KEY);
            if (!raw) return null;
            var o = JSON.parse(raw);
            if (!o || !o.t || !Array.isArray(o.filas) || !o.filas.length) return null;
            if (Date.now() - o.t > STORAGE_INV_TTL_MS) return null;
            return o;
        } catch (e) {
            return null;
        }
    }

    function aplicarFilasInventarioEnEstado(filas, encabezados, ts) {
        estado.filas = filas || [];
        estado.encabezadosFila2 = encabezados || [];
        estado.cargadoEn = ts || Date.now();
    }

    function paqueteInventarioDesdeEstado() {
        return {
            filas: estado.filas,
            resumen: calcularResumen(estado.filas),
            encabezadosFila2: estado.encabezadosFila2
        };
    }

    /** Datos listos sin red (para pintar UI de inmediato). */
    function snapshotInventarioCacheLocal() {
        if (estado.filas.length && estado.cargadoEn) {
            return paqueteInventarioDesdeEstado();
        }
        var c = leerCacheInventarioLocal();
        if (!c) return null;
        aplicarFilasInventarioEnEstado(c.filas, c.encabezadosFila2, c.t);
        return paqueteInventarioDesdeEstado();
    }

    function refrescarInventarioEnFondo() {
        if (estado.inventarioSyncEnCurso) return;
        estado.inventarioSyncEnCurso = true;
        fetchTextoHoja(HOJA_INVENTARIO).then(function (texto) {
            estado.encabezadosFila2 = leerEncabezadosInventario(texto);
            estado.filas = parsearFilasInventario(texto);
            estado.cargadoEn = Date.now();
            guardarCacheInventarioLocal();
        }).catch(function (err) {
            console.warn('[admin-data] sync inventario fondo', err.message || err);
        }).finally(function () {
            estado.inventarioSyncEnCurso = false;
        });
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

    function parseNum(val) {
        var t = String(val || '').trim();
        if (!t) return 0;
        t = t.replace(/\$/g, '').replace(/\s/g, '');
        // Miles con punto (ej. $1.300 → 1300), como en el Sheet
        if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
            t = t.replace(/\./g, '').replace(',', '.');
        } else if (/^\d+,\d{1,2}$/.test(t)) {
            t = t.replace(',', '.');
        } else {
            t = t.replace(/,/g, '');
        }
        t = t.replace(/[^\d.-]/g, '');
        var n = parseFloat(t);
        return isNaN(n) ? 0 : n;
    }

    function parseStock(val) {
        var n = parseInt(String(val || '').trim(), 10);
        return isNaN(n) ? 0 : Math.max(0, n);
    }

    function parseMayoreoFlag(val) {
        var t = String(val || '').trim().toLowerCase();
        return t === 'si' || t === 'sí' || t === 'yes' || t === '1' || t === 'true' || t === 'x';
    }

    function idFilaInventario(r) {
        return [
            String(r.ref || 0),
            norm(r.nombre),
            norm(r.talla),
            norm(r.color),
            norm(r.marca)
        ].join('::');
    }

    function esProductoMayoreo50(fila) {
        return !!(fila && Number(fila.precioMayoreo50) > 0);
    }

    /** unidadesTotales = piezas en el carrito del pedido */
    function precioPedidoMayoreo(fila, unidadesTotales) {
        var retail = Number(fila && fila.precio) || 0;
        var m20 = Number(fila && fila.precioMayoreo) || 0;
        var m50 = Number(fila && fila.precioMayoreo50) || 0;
        var tiene20 = !!(fila && fila.mayoreo && m20 > 0);
        var tiene50 = m50 > 0;
        var u = Math.max(0, unidadesTotales || 0);
        var tier = 'intro';
        var precioCliente = retail;
        var nota = '';

        if (u >= 50 && tiene50) {
            tier = '50';
            precioCliente = m50;
            nota = 'Mayoreo +50';
        } else if (u >= 20 && tiene20) {
            tier = '20';
            precioCliente = m20;
            nota = 'Mayoreo +20';
        } else if (tiene20) {
            tier = 'retail';
            precioCliente = retail;
            nota = 'Mayoreo +20 desde 20 pzas.';
        } else {
            tier = '10off';
            precioCliente = Math.round(retail * 0.9);
            nota = '10% off mayoreo';
        }
        return {
            retail: retail,
            precioCliente: precioCliente,
            tier: tier,
            nota: nota,
            ahorro: Math.max(0, retail - precioCliente)
        };
    }

    function etiquetaTierPedido(unidades) {
        if (unidades >= 50) return 'Tarifa +50 activa (' + unidades + ' pzas.)';
        if (unidades >= 20) return 'Tarifa +20 activa (' + unidades + ' pzas.)';
        if (unidades > 0) return 'Llevas ' + unidades + ' pzas. — +20 desde 20 · +50 desde 50';
        return 'Agrega piezas para activar tarifas +20 / +50';
    }

    function parseRef(val) {
        var n = parseInt(String(val || '').trim(), 10);
        return isNaN(n) || n <= 0 ? 0 : n;
    }

    function pad2(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function fechaAISO(y, m, d) {
        return y + '-' + pad2(m + 1) + '-' + pad2(d);
    }

    function normalizarMesTexto(mes) {
        var clave = String(mes || '').trim().toLowerCase().replace(/\./g, '');
        return MESES_FECHA[clave];
    }

    function parseFechaVenta(valor) {
        var texto = String(valor || '').trim();
        if (!texto) return '';

        var iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (iso) return fechaAISO(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));

        var serialMatch = texto.replace(/\s/g, '').match(/^(\d{4,6})(\.\d+)?$/);
        if (serialMatch) {
            var serial = parseFloat(serialMatch[1] + (serialMatch[2] || ''));
            if (serial >= 40000 && serial <= 65000) {
                var utc = Date.UTC(1899, 11, 30) + Math.round(serial * 86400000);
                var d = new Date(utc);
                return fechaAISO(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            }
        }

        var dmy = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (dmy) {
            var dia = parseInt(dmy[1], 10);
            var mes = parseInt(dmy[2], 10) - 1;
            var anio = parseInt(dmy[3], 10);
            if (anio < 100) anio += 2000;
            return fechaAISO(anio, mes, dia);
        }

        var dmyTexto = texto.match(/^(\d{1,2})[-\/\s]([a-zA-Z]{3,})[-\/\s](\d{2,4})$/i);
        if (dmyTexto) {
            var mesT = normalizarMesTexto(dmyTexto[2]);
            if (mesT !== undefined) {
                var anioT = parseInt(dmyTexto[3], 10);
                if (anioT < 100) anioT += 2000;
                return fechaAISO(anioT, mesT, parseInt(dmyTexto[1], 10));
            }
        }

        var parsed = Date.parse(texto);
        if (!isNaN(parsed)) {
            var dt = new Date(parsed);
            return fechaAISO(dt.getFullYear(), dt.getMonth(), dt.getDate());
        }
        return '';
    }

    function normSegmento(val) {
        var clave = String(val || '').trim().toUpperCase();
        if (clave === 'MUJER' || clave === 'WOMEN' || clave === 'F') return 'Mujer';
        if (clave === 'HOMBRE' || clave === 'MEN' || clave === 'M') return 'Hombre';
        if (!clave) return '';
        return clave.charAt(0) + clave.slice(1).toLowerCase();
    }

    function inferirSegmento(fila) {
        var seg = (fila[IDX.segmento] || '').trim();
        if (seg) return normSegmento(seg);
        var u = (fila[IDX.ubicacion] || '').trim().toLowerCase();
        if (u.indexOf('mujer') >= 0) return 'Mujer';
        if (u.indexOf('hombre') >= 0) return 'Hombre';
        return 'Hombre';
    }

    function norm(s) {
        return String(s || '').trim().toLowerCase();
    }

    function contarArticulosUnicos(filas) {
        var refs = {};
        var sinRef = {};
        filas.forEach(function (r) {
            if (r.ref > 0) refs[r.ref] = true;
            else {
                var k = norm(r.nombre);
                if (k) sinRef[k] = true;
            }
        });
        return Object.keys(refs).length + Object.keys(sinRef).length;
    }

    function urlExportCsv(gid) {
        return 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID +
            '/export?format=csv&gid=' + gid + '&_=' + Date.now();
    }

    function urlCsvGviz(hoja) {
        return 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID +
            '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(hoja) + '&_=' + Date.now();
    }

    function validarCsvHoja(texto, claveHoja) {
        if (!texto || texto.length < 20) return false;
        var low = texto.slice(0, 800).toLowerCase();
        if (low.indexOf('<!doctype') >= 0 || low.indexOf('<html') >= 0) return false;
        var up = texto.slice(0, 6000).toUpperCase();
        if (claveHoja === 'VENTAS') {
            return up.indexOf('ARTICULO') >= 0 || up.indexOf('ARTÍCULO') >= 0;
        }
        if (claveHoja === 'INVENTARIO') {
            return up.indexOf('NOMBRE') >= 0 || up.indexOf('STOCK') >= 0;
        }
        if (claveHoja === 'MAYOREO') {
            return up.indexOf('NOMBRE') >= 0 && up.indexOf('CANTIDAD') >= 0;
        }
        return true;
    }

    function esClienteSoloMayoreo(nombre) {
        var n = norm(nombre);
        return CLIENTES_SOLO_MAYOREO.indexOf(n) >= 0;
    }

    function resolverIndicesMayoreo(grid) {
        var idx = {
            cliente: -1,
            nombre: IDX_M.nombre,
            cantidad: IDX_M.cantidad,
            talla: IDX_M.talla,
            color: IDX_M.color,
            tipo: IDX_M.tipo,
            marca: IDX_M.marca,
            precioRetail: IDX_M.precioRetail,
            precioMayoreo: IDX_M.precioMayoreo,
            costoNeto: IDX_M.costoNeto
        };
        var hdr = grid[0] || [];
        for (var c = 0; c < hdr.length; c++) {
            var t = String(hdr[c] || '').trim().toUpperCase();
            if (t === 'CLIENTE') idx.cliente = c;
            else if (t === 'NOMBRE') idx.nombre = c;
            else if (t.indexOf('CANTIDAD') >= 0) idx.cantidad = c;
            else if (t === 'TALLA') idx.talla = c;
            else if (t === 'COLOR') idx.color = c;
            else if (t === 'TIPO') idx.tipo = c;
            else if (t === 'MARCA') idx.marca = c;
            else if (t.indexOf('RETAIL') >= 0) idx.precioRetail = c;
            else if (t.indexOf('MAYOREO') >= 0) idx.precioMayoreo = c;
            else if (t.indexOf('COSTO') >= 0) idx.costoNeto = c;
        }
        return idx;
    }

    function parseCantidadMayoreo(val) {
        var n = parseInt(String(val || '').trim(), 10);
        return isNaN(n) || n <= 0 ? 1 : n;
    }

    function parsearFilasMayoreo(csvTexto) {
        var grid = parseCSV(csvTexto);
        var idx = resolverIndicesMayoreo(grid);
        var out = [];
        for (var i = MAYOREO_FILA_INICIO; i < grid.length; i++) {
            var filaSheet = i + 1;
            if (filaSheet > MAYOREO_FILA_MAX) break;
            var f = grid[i];
            var nombre = String(celda(f, idx.nombre) || '').trim();
            if (!nombre) continue;
            if (nombre.toUpperCase() === 'NOMBRE') continue;
            var cliente = idx.cliente >= 0
                ? String(celda(f, idx.cliente) || '').trim()
                : '';
            if (!cliente) cliente = CLIENTE_MAYOREO_DEFAULT;
            var cantidad = parseCantidadMayoreo(celda(f, idx.cantidad));
            var precioMayoreo = parseNum(celda(f, idx.precioMayoreo));
            var costoNeto = parseNum(celda(f, idx.costoNeto));
            var precioRetail = parseNum(celda(f, idx.precioRetail));
            out.push({
                cliente: cliente,
                nombre: nombre,
                cantidad: cantidad,
                talla: String(celda(f, idx.talla) || '').trim(),
                color: String(celda(f, idx.color) || '').trim(),
                tipo: String(celda(f, idx.tipo) || '').trim(),
                marca: String(celda(f, idx.marca) || '').trim(),
                precioRetail: precioRetail,
                precioMayoreo: precioMayoreo,
                costoNeto: costoNeto,
                utilidadLinea: precioRetail - precioMayoreo,
                filaSheet: filaSheet
            });
        }
        return out;
    }

    function calcularClientesMayoreo(lineas) {
        var map = {};
        (lineas || []).forEach(function (r) {
            var key = norm(r.cliente) || 'naty';
            if (!map[key]) {
                map[key] = {
                    id: key,
                    nombre: r.cliente || CLIENTE_MAYOREO_DEFAULT,
                    articulos: 0,
                    totalCobrado: 0,
                    sumaRetail: 0,
                    utilidad: 0
                };
            }
            var c = map[key];
            c.articulos += r.cantidad;
            c.totalCobrado += r.precioMayoreo;
            c.sumaRetail += r.precioRetail;
            c.utilidad = c.sumaRetail - c.totalCobrado;
        });
        var lista = Object.keys(map).map(function (k) { return map[k]; });
        lista.sort(function (a, b) { return b.totalCobrado - a.totalCobrado; });
        return lista;
    }

    function calcularResumenMayoreo(clientes, lineas) {
        var res = {
            clientes: clientes.length,
            articulos: 0,
            totalCobrado: 0,
            utilidad: 0,
            lineas: lineas.length
        };
        clientes.forEach(function (c) {
            res.articulos += c.articulos;
            res.totalCobrado += c.totalCobrado;
            res.utilidad += c.utilidad;
        });
        return res;
    }

    function filtrarLineasMayoreo(lineas, query) {
        query = norm(query);
        if (!query) return lineas || [];
        return (lineas || []).filter(function (r) {
            var blob = [
                r.cliente, r.nombre, r.talla, r.color, r.tipo, r.marca
            ].join(' ').toLowerCase();
            return blob.indexOf(query) >= 0;
        });
    }

    function claveClienteMayoreo(nombre) {
        return norm(nombre) || 'naty';
    }

    function filtrarLineasPorClienteMayoreo(lineas, clienteKey) {
        var k = claveClienteMayoreo(clienteKey);
        return (lineas || []).filter(function (r) {
            return claveClienteMayoreo(r.cliente) === k;
        });
    }

    var VERSION_IMAGENES_ADMIN = '20261021b';

    var MARCAS_CANON = {
        'GYMSHARK': 'Gym Shark',
        'GYM SHARK': 'Gym Shark',
        'YOUNGLA': 'YoungLA',
        'YOUNG LA': 'YoungLA',
        'UNIQLO': 'Uniqlo',
        'ON CLOUD': 'On Cloud'
    };

    function normalizarMarca(valor) {
        var clave = String(valor || '').trim().toUpperCase().replace(/\s+/g, ' ');
        if (MARCAS_CANON[clave]) return MARCAS_CANON[clave];
        var t = String(valor || '').trim();
        if (!t) return '';
        return t.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }

    var COLOR_CLAVE_ADMIN = {
        negro: 'negro', black: 'negro',
        blanco: 'blanco', white: 'blanco',
        gris: 'gris', grey: 'gris', gray: 'gris',
        verde: 'verde', green: 'verde',
        azul: 'azul', blue: 'azul',
        rojo: 'rojo', red: 'rojo',
        rosa: 'rosa', pink: 'rosa',
        beige: 'beige',
        marron: 'marron', marrón: 'marron', brown: 'marron', cafe: 'marron', café: 'marron'
    };

    function normColorClaveAdmin(val) {
        var k = norm(val).replace(/\s/g, '');
        return COLOR_CLAVE_ADMIN[k] || k;
    }

    function normTallaAdmin(val) {
        return norm(val).replace(/\s/g, '').toUpperCase();
    }

    function claveMatchInventarioMayoreo(r) {
        return [
            norm(r.nombre),
            normTallaAdmin(r.talla),
            normColorClaveAdmin(r.color),
            norm(r.marca)
        ].join('|');
    }

    function normalizarRutaImagenAdmin(val) {
        var t = String(val || '').trim();
        if (!t) return '';
        if (/^https?:\/\//i.test(t)) return t;
        t = t.replace(/^\.\.\//, '').replace(/^\/+/, '');
        if (t.indexOf('hombre/') === 0 || t.indexOf('mujer/') === 0) {
            return '../' + t.split('?')[0] + '?v=' + VERSION_IMAGENES_ADMIN;
        }
        if (/\.(webp|jpe?g|png|avif)(\?|$)/i.test(t)) {
            return '../' + t.split('?')[0] + '?v=' + VERSION_IMAGENES_ADMIN;
        }
        return '';
    }

    function construirMapaImagenesInventario(filas) {
        var map = {};
        (filas || []).forEach(function (f) {
            var hit = {
                ref: f.ref,
                segmento: f.segmento,
                fotoUrl: f.fotoUrl || '',
                marca: f.marca || ''
            };
            if (!hit.ref && !hit.fotoUrl) return;
            var key = claveMatchInventarioMayoreo(f);
            if (!map[key]) map[key] = hit;
        });
        return map;
    }

    function extensionImagenRef(hit) {
        if (norm(normalizarMarca(hit.marca)) === 'uniqlo') return 'avif';
        return 'webp';
    }

    function urlImagenFilaInventario(fila) {
        var celdas = (fila && fila.celdas) || [];
        var url = normalizarRutaImagenAdmin(celdas[9] || fila.fotoUrl || '');
        if (url) return url;
        var ref = fila.ref || parseRef(celdas[0]);
        if (!ref) return '';
        var seg = fila.segmento;
        if (!seg && celdas[IDX.segmento]) seg = normSegmento(celdas[IDX.segmento]);
        if (!seg && fila.ubicacion) {
            var u = String(fila.ubicacion).toLowerCase();
            if (u.indexOf('mujer') >= 0) seg = 'Mujer';
            else seg = 'Hombre';
        }
        var marca = fila.marca || celdas[IDX.marca] || '';
        var hit = { ref: ref, segmento: seg || 'Hombre', marca: marca, fotoUrl: '' };
        return urlImagenDesdeHit(hit);
    }

    function urlImagenDesdeHit(hit) {
        if (!hit) return '';
        if (hit.fotoUrl) return hit.fotoUrl;
        if (!hit.ref) return '';
        var carpeta = hit.segmento === 'Mujer' ? 'mujer' : 'hombre';
        var ext = extensionImagenRef(hit);
        return '../' + carpeta + '/' + hit.ref + '.' + ext + '?v=' + VERSION_IMAGENES_ADMIN;
    }

    function puntuarMatchMayoreoInventario(linea, f) {
        if (norm(linea.nombre) !== norm(f.nombre)) return -1;
        var score = 10;
        if (normTallaAdmin(linea.talla) === normTallaAdmin(f.talla)) score += 6;
        else if (linea.talla && f.talla) score -= 2;
        if (normColorClaveAdmin(linea.color) === normColorClaveAdmin(f.color)) score += 4;
        if (norm(linea.marca) === norm(f.marca)) score += 2;
        if (norm(linea.tipo) === norm(f.tipo)) score += 1;
        return score;
    }

    function resolverImagenMayoreo(linea, mapa, filasInventario) {
        var hit = mapa[claveMatchInventarioMayoreo(linea)];
        if (!hit && filasInventario && filasInventario.length) {
            var mejor = null;
            var mejorScore = -1;
            for (var i = 0; i < filasInventario.length; i++) {
                var f = filasInventario[i];
                var sc = puntuarMatchMayoreoInventario(linea, f);
                if (sc > mejorScore) {
                    mejorScore = sc;
                    mejor = {
                        ref: f.ref,
                        segmento: f.segmento,
                        fotoUrl: f.fotoUrl || '',
                        marca: f.marca || ''
                    };
                }
            }
            if (mejorScore >= 10) hit = mejor;
        }
        return urlImagenDesdeHit(hit);
    }

    function enriquecerLineasMayoreoImagenes(lineas, filasInventario) {
        var mapa = construirMapaImagenesInventario(filasInventario);
        return (lineas || []).map(function (r) {
            var copia = {};
            Object.keys(r).forEach(function (k) { copia[k] = r[k]; });
            copia.imagenUrl = resolverImagenMayoreo(r, mapa, filasInventario);
            return copia;
        });
    }

    function cargarSoloMayoreo(forzar) {
        return Promise.all([
            cargarMayoreo(!!forzar),
            cargarInventario(!!forzar)
        ]).then(function (parts) {
            var m = parts[0];
            var inv = parts[1];
            return {
                filas: inv.filas,
                resumen: inv.resumen,
                encabezadosFila2: inv.encabezadosFila2 || [],
                ventas: [],
                resumenVentas: calcularResumenVentas([]),
                errorVentas: null,
                clientes: [],
                lineasMayoreo: m.lineasMayoreo,
                clientesMayoreo: m.clientesMayoreo,
                resumenMayoreo: m.resumenMayoreo,
                errorMayoreo: m.error || null
            };
        });
    }

    /** Descarga hoja completa vía /export (ignora filtros ocultos en Sheets). */
    function fetchTextoHoja(nombreHoja, intento) {
        var clave = String(nombreHoja || '').trim().toUpperCase();
        var gid = GID_POR_HOJA[clave];
        var n = intento || 0;
        if (gid === undefined) {
            return fetchConTimeout(urlCsvGviz(nombreHoja), 25000).then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.text();
            });
        }
        return fetchConTimeout(urlExportCsv(gid), 25000).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.text();
        }).then(function (texto) {
            if (!validarCsvHoja(texto, clave)) {
                throw new Error('respuesta no es CSV del Sheet');
            }
            return texto;
        }).catch(function (err) {
            if (n < 2) {
                console.warn('[admin-data] reintento export', clave, n + 1, err.message || err);
                return fetchTextoHoja(nombreHoja, n + 1);
            }
            throw new Error(clave + ': ' + (err.message || err));
        });
    }

    function resolverIndicesVentas(grid) {
        var idx = {
            fecha: IDX_V.fecha,
            nombre: IDX_V.nombre,
            tipo: IDX_V.tipo,
            precio: IDX_V.precio,
            talla: IDX_V.talla,
            color: IDX_V.color,
            segmento: IDX_V.segmento,
            cliente: IDX_V.cliente,
            vendedor: IDX_V.vendedor,
            cuenta: IDX_V.cuenta,
            redSocial: IDX_V.redSocial,
            link: IDX_V.link,
            telefono: IDX_V.telefono
        };
        var hdr = grid[FILA_ENCABEZADOS] || [];
        for (var c = 0; c < hdr.length; c++) {
            var t = String(hdr[c] || '').trim().toUpperCase();
            if (t === 'FECHA') idx.fecha = c;
            else if (t === 'ARTICULO' || t === 'ARTÍCULO') idx.nombre = c;
            else if (t === 'TIPO') idx.tipo = c;
            else if (t === 'PRECIO') idx.precio = c;
            else if (t === 'TALLA') idx.talla = c;
            else if (t === 'COLOR') idx.color = c;
            else if (t.indexOf('HOMBRE') >= 0 && t.indexOf('MUJER') >= 0) idx.segmento = c;
            else if (t === 'CLIENTE') idx.cliente = c;
            else if (t.indexOf('VEND') >= 0) idx.vendedor = c;
            else if (t.indexOf('CUENTA') >= 0) idx.cuenta = c;
            else if (t.indexOf('RED') >= 0 && t.indexOf('SOCIAL') >= 0) idx.redSocial = c;
            else if (t === 'LINK' || t.indexOf('LINK') >= 0 || t.indexOf('PERFIL') >= 0) idx.link = c;
            else if (t.indexOf('TEL') >= 0 || t.indexOf('WHATS') >= 0 || t.indexOf('CEL') >= 0 ||
                t.indexOf('NÚMERO') >= 0 || t.indexOf('NUMERO') >= 0) idx.telefono = c;
        }
        return idx;
    }

    function normTelefono(val) {
        return String(val || '').replace(/\D/g, '');
    }

    function claveCliente(nombre) {
        var n = norm(nombre);
        return n ? 'nom:' + n : '';
    }

    function elegirRedPrincipal(conteo) {
        var mejor = '';
        var max = 0;
        Object.keys(conteo || {}).forEach(function (k) {
            if (conteo[k] > max) {
                max = conteo[k];
                mejor = k;
            }
        });
        return mejor || 'Sin dato';
    }

    function elegirTipoPrincipal(conteo) {
        return elegirRedPrincipal(conteo);
    }

    function calcularPerfilesClientes(ventas) {
        var map = {};
        (ventas || []).forEach(function (v) {
            var nombre = String(v.cliente || '').trim();
            if (!nombre) return;
            if (esClienteSoloMayoreo(nombre)) return;
            var key = claveCliente(nombre);
            if (!key) return;
            if (!map[key]) {
                map[key] = {
                    id: key,
                    nombre: nombre,
                    telefono: '',
                    link: '',
                    redSocial: {},
                    tipos: {},
                    articulos: 0,
                    gasto: 0,
                    ultimaCompraIso: '',
                    ultimaCompraRaw: ''
                };
            }
            var c = map[key];
            if (v.telefono && !c.telefono) c.telefono = String(v.telefono).trim();
            if (v.link && !c.link) c.link = String(v.link).trim();
            var red = String(v.redSocial || '').trim() || 'Sin dato';
            c.redSocial[red] = (c.redSocial[red] || 0) + 1;
            var tipo = String(v.tipo || '').trim() || 'Sin tipo';
            c.tipos[tipo] = (c.tipos[tipo] || 0) + 1;
            c.articulos += 1;
            c.gasto += v.precio || 0;
            if (v.fechaIso && (!c.ultimaCompraIso || v.fechaIso > c.ultimaCompraIso)) {
                c.ultimaCompraIso = v.fechaIso;
                c.ultimaCompraRaw = v.fechaRaw || '';
            }
            if (v.telefono) c.telefono = String(v.telefono).trim();
            if (v.link) c.link = String(v.link).trim();
        });
        var lista = Object.keys(map).map(function (k) {
            var c = map[k];
            return {
                id: c.id,
                nombre: c.nombre,
                telefono: c.telefono,
                link: c.link,
                redPrincipal: elegirRedPrincipal(c.redSocial),
                tipoPrincipal: elegirTipoPrincipal(c.tipos),
                redSocial: c.redSocial,
                tipos: c.tipos,
                articulos: c.articulos,
                gasto: c.gasto,
                ultimaCompraIso: c.ultimaCompraIso,
                ultimaCompraRaw: c.ultimaCompraRaw
            };
        });
        lista.sort(function (a, b) {
            if (b.gasto !== a.gasto) return b.gasto - a.gasto;
            return b.articulos - a.articulos;
        });
        lista.forEach(function (c, i) { c.ranking = i + 1; });
        return lista;
    }

    function filtrarClientes(clientes, query) {
        query = norm(query);
        if (!query) return clientes || [];
        return (clientes || []).filter(function (c) {
            var blob = [
                c.nombre, c.telefono, c.link, c.redPrincipal, c.tipoPrincipal,
                String(c.ranking)
            ].join(' ').toLowerCase();
            return blob.indexOf(query) >= 0;
        });
    }

    function fetchConTimeout(url, ms) {
        ms = ms || 20000;
        var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = setTimeout(function () {
            if (ctrl) ctrl.abort();
        }, ms);
        return fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
            .finally(function () { clearTimeout(timer); });
    }

    function esFilaEncabezadoVenta(nombre, fechaRaw) {
        var n = nombre.toUpperCase();
        if (n === 'ARTICULO' || n === 'ARTÍCULO' || n === 'NOMBRE') return true;
        var f = String(fechaRaw || '').toUpperCase();
        if (f === 'FECHA') return true;
        return false;
    }

    function colLetter(index) {
        var n = index + 1;
        var s = '';
        while (n > 0) {
            var r = (n - 1) % 26;
            s = String.fromCharCode(65 + r) + s;
            n = Math.floor((n - 1) / 26);
        }
        return s;
    }

    function padCeldas(fila) {
        var out = [];
        for (var c = 0; c < INVENTARIO_NUM_COLS; c++) {
            out.push(c < fila.length ? String(fila[c] == null ? '' : fila[c]) : '');
        }
        return out;
    }

    function filaInventarioVacia(celdas) {
        for (var c = 0; c < celdas.length; c++) {
            if (String(celdas[c] || '').trim()) return false;
        }
        return true;
    }

    function inventarioHeaders() {
        var titulos = [
            '', 'Nombre', 'Stock', 'Talla', 'Color', 'Tipo', 'Marca', 'Precio', 'Valor línea',
            'Foto J', '', '', '', '', '', 'Mayoreo P', '', 'Mayoreo R', 'Faltante', 'Género T',
            'Carrusel U', '', '', 'Colección X', 'Oferta Y', '', 'Comentario', 'Ubicación', ''
        ];
        var headers = [];
        for (var c = 0; c < INVENTARIO_NUM_COLS; c++) {
            var t = titulos[c] || '';
            headers.push({ col: c + 1, letter: colLetter(c), title: t });
        }
        return headers;
    }

    function leerEncabezadosInventario(csvTexto) {
        var grid = parseCSV(csvTexto);
        if (grid.length <= FILA_ENCABEZADOS) return padCeldas([]);
        return padCeldas(grid[FILA_ENCABEZADOS]);
    }

    function parsearFilasInventario(csvTexto) {
        var grid = parseCSV(csvTexto);
        var out = [];
        for (var i = FILA_INICIO; i < grid.length; i++) {
            var f = grid[i];
            var celdas = padCeldas(f);
            var nombre = (celdas[IDX.nombre] || '').trim();
            if (nombre.toUpperCase() === 'NOMBRE') continue;
            if (filaInventarioVacia(celdas)) continue;
            if (!nombre && !parseRef(celdas[IDX.imagen])) continue;
            var ref = parseRef(celdas[IDX.imagen]);
            var stock = parseStock(celdas[IDX.stock]);
            var precio = parseNum(celdas[IDX.precio]);
            var valorLinea = parseNum(celdas[8]);
            if (!valorLinea && precio > 0 && stock > 0) valorLinea = precio * stock;
            var segmento = inferirSegmento(f);
            out.push({
                ref: ref,
                nombre: nombre,
                stock: stock,
                talla: (celdas[IDX.talla] || '').trim(),
                color: (celdas[IDX.color] || '').trim(),
                tipo: (celdas[IDX.tipo] || '').trim(),
                marca: normalizarMarca(celdas[IDX.marca]),
                precio: precio,
                precioMayoreo: parseNum(celdas[IDX.precioMayoreo]),
                precioMayoreo50: parseNum(celdas[IDX.precioMayoreo50]),
                mayoreo: parseMayoreoFlag(celdas[IDX.mayoreo]),
                fechaStockIso: parseFechaVenta(celdas[IDX.fechaStock]),
                valorLinea: valorLinea,
                segmento: segmento,
                ubicacion: (celdas[IDX.ubicacion] || '').trim(),
                fotoUrl: normalizarRutaImagenAdmin(celdas[9]),
                filaSheet: i + 1,
                celdas: celdas
            });
        }
        return out;
    }

    function celda(f, col) {
        return col < f.length ? f[col] : '';
    }

    function parsearFilasVentas(csvTexto) {
        var grid = parseCSV(csvTexto);
        var idx = resolverIndicesVentas(grid);
        var out = [];
        for (var i = FILA_INICIO; i < grid.length; i++) {
            var f = grid[i];
            var nombre = String(celda(f, idx.nombre) || '').trim();
            var fechaRaw = String(celda(f, idx.fecha) || '').trim();
            if (esFilaEncabezadoVenta(nombre, fechaRaw)) continue;
            if (!nombre && !fechaRaw) continue;
            var precio = parseNum(celda(f, idx.precio));
            if (!nombre && precio <= 0) continue;
            var fechaIso = parseFechaVenta(fechaRaw);
            out.push({
                fechaIso: fechaIso,
                fechaRaw: fechaRaw,
                nombre: nombre,
                tipo: String(celda(f, idx.tipo) || '').trim(),
                precio: precio,
                talla: String(celda(f, idx.talla) || '').trim(),
                color: String(celda(f, idx.color) || '').trim(),
                segmento: normSegmento(celda(f, idx.segmento)),
                cliente: String(celda(f, idx.cliente) || '').trim(),
                vendedor: String(celda(f, idx.vendedor) || '').trim(),
                cuenta: String(celda(f, idx.cuenta) || '').trim(),
                redSocial: String(celda(f, idx.redSocial) || '').trim(),
                link: String(celda(f, idx.link) || '').trim(),
                telefono: String(celda(f, idx.telefono) || '').trim(),
                filaSheet: i + 1
            });
        }
        return out.sort(function (a, b) {
            var ta = a.fechaIso ? new Date(a.fechaIso + 'T12:00:00').getTime() : 0;
            var tb = b.fechaIso ? new Date(b.fechaIso + 'T12:00:00').getTime() : 0;
            return tb - ta;
        });
    }

    function calcularResumen(filas) {
        var res = {
            articulosUnicos: contarArticulosUnicos(filas),
            lineasInventario: filas.length,
            unidades: 0,
            agotados: 0,
            stockBajo: 0,
            valorEstimado: 0,
            porMarca: {},
            porSegmento: { Hombre: 0, Mujer: 0 },
            ubicaciones: {}
        };
        filas.forEach(function (r) {
            res.unidades += r.stock;
            if (r.stock === 0) res.agotados++;
            else if (r.stock <= 2) res.stockBajo++;
            if (r.valorLinea > 0) res.valorEstimado += r.valorLinea;
            else if (r.precio > 0 && r.stock > 0) res.valorEstimado += r.precio * r.stock;
            var m = r.marca || 'Sin marca';
            res.porMarca[m] = (res.porMarca[m] || 0) + 1;
            if (r.segmento === 'Mujer') res.porSegmento.Mujer += r.stock;
            else res.porSegmento.Hombre += r.stock;
            var u = r.ubicacion || 'Sin ubicación';
            if (!res.ubicaciones[u]) res.ubicaciones[u] = { lineas: 0, unidades: 0 };
            res.ubicaciones[u].lineas++;
            res.ubicaciones[u].unidades += r.stock;
        });
        return res;
    }

    function inicioDiaLocal(d) {
        var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return x.getTime();
    }

    function inicioSemanaLunes(ref) {
        var d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
        var dia = d.getDay();
        var restar = dia === 0 ? 6 : dia - 1;
        d.setDate(d.getDate() - restar);
        return d.getTime();
    }

    var MESES_ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    function mesAbrev(monthIndex) {
        return MESES_ABREV[monthIndex] || '';
    }

    function etiquetaRangoSemana(ref) {
        ref = ref || new Date();
        var tLunes = inicioSemanaLunes(ref);
        var lun = new Date(tLunes);
        var dom = new Date(tLunes);
        dom.setDate(dom.getDate() + 6);
        if (lun.getMonth() === dom.getMonth()) {
            return lun.getDate() + '–' + dom.getDate() + ' ' + mesAbrev(lun.getMonth());
        }
        return lun.getDate() + ' ' + mesAbrev(lun.getMonth()) + '–' + dom.getDate() + ' ' + mesAbrev(dom.getMonth());
    }

    function etiquetaDia(ref) {
        ref = ref || new Date();
        return ref.getDate() + ' ' + mesAbrev(ref.getMonth());
    }

    function etiquetaMesActual(ref) {
        ref = ref || new Date();
        return mesAbrev(ref.getMonth());
    }

    function fechaLocalIso(ref) {
        return ref.getFullYear() + '-' + pad2(ref.getMonth() + 1) + '-' + pad2(ref.getDate());
    }

    function enPeriodo(fechaIso, periodo) {
        if (!fechaIso) return false;
        var partes = fechaIso.split('-');
        if (partes.length !== 3) return false;
        var hoy = new Date();
        if (periodo === 'hoy') return fechaIso === fechaLocalIso(hoy);
        if (periodo === 'semana') {
            var tLunes = inicioSemanaLunes(hoy);
            var lun = new Date(tLunes);
            var dom = new Date(tLunes);
            dom.setDate(dom.getDate() + 6);
            var isoLun = fechaLocalIso(lun);
            var isoDom = fechaLocalIso(dom);
            return fechaIso >= isoLun && fechaIso <= isoDom;
        }
        if (periodo === 'mes') {
            return parseInt(partes[0], 10) === hoy.getFullYear() &&
                parseInt(partes[1], 10) === hoy.getMonth() + 1;
        }
        return false;
    }

    function acumularPeriodo(rv, venta, periodo) {
        if (!enPeriodo(venta.fechaIso, periodo)) return;
        rv[periodo].monto += venta.precio;
        rv[periodo].count++;
    }

    function calcularResumenVentas(ventas) {
        var rv = {
            hoy: { monto: 0, count: 0 },
            semana: { monto: 0, count: 0 },
            mes: { monto: 0, count: 0 },
            porVendedorMes: {},
            porSegmentoMes: { Hombre: 0, Mujer: 0, '': 0 },
            porTipoMes: {},
            porCuentaMes: {},
            masVendidosMes: {},
            totalRegistros: ventas.length
        };
        ventas.forEach(function (v) {
            acumularPeriodo(rv, v, 'hoy');
            acumularPeriodo(rv, v, 'semana');
            acumularPeriodo(rv, v, 'mes');
            if (!enPeriodo(v.fechaIso, 'mes')) return;
            var vend = v.vendedor || 'Sin vendedor';
            rv.porVendedorMes[vend] = (rv.porVendedorMes[vend] || 0) + v.precio;
            var seg = v.segmento || '';
            rv.porSegmentoMes[seg] = (rv.porSegmentoMes[seg] || 0) + v.precio;
            var tipo = v.tipo || 'Sin tipo';
            rv.porTipoMes[tipo] = (rv.porTipoMes[tipo] || 0) + 1;
            var cuenta = v.cuenta || 'Sin cuenta';
            rv.porCuentaMes[cuenta] = (rv.porCuentaMes[cuenta] || 0) + v.precio;
            if (v.nombre) {
                rv.masVendidosMes[v.nombre] = (rv.masVendidosMes[v.nombre] || 0) + 1;
            }
        });
        return rv;
    }

    function cargarInventario(forzar) {
        if (!forzar && estado.filas.length && estado.cargadoEn &&
            (Date.now() - estado.cargadoEn < MEMORY_INV_TTL_MS)) {
            return Promise.resolve(paqueteInventarioDesdeEstado());
        }
        if (!forzar && !estado.filas.length) {
            var cache = leerCacheInventarioLocal();
            if (cache) {
                aplicarFilasInventarioEnEstado(cache.filas, cache.encabezadosFila2, cache.t);
                refrescarInventarioEnFondo();
                return Promise.resolve(paqueteInventarioDesdeEstado());
            }
        }
        estado.error = null;
        return fetchTextoHoja(HOJA_INVENTARIO)
            .then(function (texto) {
                estado.encabezadosFila2 = leerEncabezadosInventario(texto);
                estado.filas = parsearFilasInventario(texto);
                estado.cargadoEn = Date.now();
                guardarCacheInventarioLocal();
                return paqueteInventarioDesdeEstado();
            })
            .catch(function (err) {
                if (estado.filas.length) {
                    console.warn('[admin-data] inventario red falló, usando cache', err.message || err);
                    return paqueteInventarioDesdeEstado();
                }
                estado.error = err.message || String(err);
                throw err;
            });
    }

    function cargarVentas(forzar) {
        if (!forzar && estado.ventas.length >= 50 && estado.ventasCargadoEn && (Date.now() - estado.ventasCargadoEn < 60000)) {
            return Promise.resolve({
                ventas: estado.ventas,
                resumenVentas: calcularResumenVentas(estado.ventas)
            });
        }
        estado.errorVentas = null;
        return fetchTextoHoja(HOJA_VENTAS)
            .then(function (texto) {
                estado.ventas = parsearFilasVentas(texto);
                estado.ventasCargadoEn = Date.now();
                return {
                    ventas: estado.ventas,
                    resumenVentas: calcularResumenVentas(estado.ventas)
                };
            })
            .catch(function (err) {
                estado.errorVentas = err.message || String(err);
                estado.ventas = [];
                return {
                    ventas: [],
                    resumenVentas: calcularResumenVentas([]),
                    error: estado.errorVentas
                };
            });
    }

    function cargarMayoreo(forzar) {
        if (!forzar && estado.lineasMayoreo.length && estado.mayoreoCargadoEn &&
            (Date.now() - estado.mayoreoCargadoEn < 60000)) {
            var clientesM = calcularClientesMayoreo(estado.lineasMayoreo);
            return Promise.resolve({
                lineasMayoreo: estado.lineasMayoreo,
                clientesMayoreo: clientesM,
                resumenMayoreo: calcularResumenMayoreo(clientesM, estado.lineasMayoreo)
            });
        }
        estado.errorMayoreo = null;
        return fetchTextoHoja(HOJA_MAYOREO)
            .then(function (texto) {
                estado.lineasMayoreo = parsearFilasMayoreo(texto);
                estado.mayoreoCargadoEn = Date.now();
                var clientesM = calcularClientesMayoreo(estado.lineasMayoreo);
                return {
                    lineasMayoreo: estado.lineasMayoreo,
                    clientesMayoreo: clientesM,
                    resumenMayoreo: calcularResumenMayoreo(clientesM, estado.lineasMayoreo)
                };
            })
            .catch(function (err) {
                estado.errorMayoreo = err.message || String(err);
                estado.lineasMayoreo = [];
                return {
                    lineasMayoreo: [],
                    clientesMayoreo: [],
                    resumenMayoreo: calcularResumenMayoreo([], []),
                    error: estado.errorMayoreo
                };
            });
    }

    function cargarTodo(forzar) {
        forzar = !!forzar;
        return cargarInventario(forzar).then(function (inv) {
            var base = {
                filas: inv.filas,
                resumen: inv.resumen,
                encabezadosFila2: inv.encabezadosFila2 || [],
                ventas: estado.ventas.length ? estado.ventas : [],
                resumenVentas: calcularResumenVentas(estado.ventas),
                errorVentas: null,
                clientes: calcularPerfilesClientes(estado.ventas),
                lineasMayoreo: estado.lineasMayoreo.length ? estado.lineasMayoreo : [],
                clientesMayoreo: calcularClientesMayoreo(estado.lineasMayoreo),
                resumenMayoreo: calcularResumenMayoreo(
                    calcularClientesMayoreo(estado.lineasMayoreo),
                    estado.lineasMayoreo
                ),
                errorMayoreo: null
            };
            return Promise.all([
                cargarVentas(forzar),
                cargarMayoreo(forzar)
            ]).then(function (parts) {
                base.ventas = parts[0].ventas;
                base.resumenVentas = parts[0].resumenVentas;
                base.errorVentas = parts[0].error || null;
                base.clientes = calcularPerfilesClientes(parts[0].ventas);
                base.lineasMayoreo = parts[1].lineasMayoreo;
                base.clientesMayoreo = parts[1].clientesMayoreo;
                base.resumenMayoreo = parts[1].resumenMayoreo;
                base.errorMayoreo = parts[1].error || null;
                return base;
            }).catch(function () {
                return base;
            });
        });
    }

    function filtrarFilas(filas, query, filtros) {
        query = norm(query);
        filtros = filtros || {};
        return filas.filter(function (r) {
            if (filtros.soloStock && r.stock <= 0) return false;
            if (filtros.soloBajo && (r.stock === 0 || r.stock > 2)) return false;
            if (filtros.segmento && r.segmento !== filtros.segmento) return false;
            if (filtros.marca && normalizarMarca(r.marca) !== normalizarMarca(filtros.marca)) return false;
            if (!query) return true;
            var blob = [
                r.nombre, r.marca, r.tipo, r.color, r.talla, r.segmento,
                String(r.ref)
            ].join(' ').toLowerCase();
            return blob.indexOf(query) >= 0;
        });
    }

    function filtrarVentas(ventas, query) {
        query = norm(query);
        if (!query) return ventas;
        return ventas.filter(function (v) {
            var blob = [
                v.nombre, v.tipo, v.talla, v.color, v.segmento, v.cliente,
                v.vendedor, v.cuenta, v.redSocial, v.link, v.telefono,
                v.fechaRaw, v.fechaIso
            ].join(' ').toLowerCase();
            return blob.indexOf(query) >= 0;
        });
    }

    function formatoMoney(n) {
        return '$' + (Math.round(n * 100) / 100).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    function formatoFecha(iso, raw) {
        if (iso) {
            var p = iso.split('-');
            return p[2] + '/' + p[1] + '/' + p[0];
        }
        return raw || '—';
    }

    function topEntries(obj, n, byCount) {
        return Object.keys(obj).map(function (k) {
            return { key: k, val: obj[k] };
        }).sort(function (a, b) { return b.val - a.val; }).slice(0, n || 5);
    }

    global.ObebeAdminData = {
        cargarInventario: cargarInventario,
        snapshotInventarioCacheLocal: snapshotInventarioCacheLocal,
        cargarVentas: cargarVentas,
        cargarMayoreo: cargarMayoreo,
        cargarTodo: cargarTodo,
        cargarSoloMayoreo: cargarSoloMayoreo,
        filtrarLineasPorClienteMayoreo: filtrarLineasPorClienteMayoreo,
        enriquecerLineasMayoreoImagenes: enriquecerLineasMayoreoImagenes,
        imagenParaLineaMayoreo: function (linea, filasInventario) {
            var mapa = construirMapaImagenesInventario(filasInventario);
            return resolverImagenMayoreo(linea, mapa, filasInventario);
        },
        filtrarFilas: filtrarFilas,
        filtrarVentas: filtrarVentas,
        calcularResumen: calcularResumen,
        calcularResumenVentas: calcularResumenVentas,
        calcularPerfilesClientes: calcularPerfilesClientes,
        filtrarClientes: filtrarClientes,
        calcularClientesMayoreo: calcularClientesMayoreo,
        calcularResumenMayoreo: calcularResumenMayoreo,
        filtrarLineasMayoreo: filtrarLineasMayoreo,
        esClienteSoloMayoreo: esClienteSoloMayoreo,
        CLIENTE_MAYOREO_DEFAULT: CLIENTE_MAYOREO_DEFAULT,
        getEstado: function () { return estado; },
        formatoMoney: formatoMoney,
        formatoFecha: formatoFecha,
        topEntries: topEntries,
        etiquetaRangoSemana: etiquetaRangoSemana,
        etiquetaDia: etiquetaDia,
        etiquetaMesActual: etiquetaMesActual,
        INVENTARIO_NUM_COLS: INVENTARIO_NUM_COLS,
        inventarioHeaders: inventarioHeaders,
        colLetter: colLetter,
        urlProductoWeb: function (r) {
            if (!r.ref) return '../productos.html';
            var cat = r.segmento === 'Mujer' ? 'Mujer' : 'Hombre';
            return '../producto.html?id=' + encodeURIComponent(r.ref) + '&categoria=' + encodeURIComponent(cat);
        },
        idFilaInventario: idFilaInventario,
        normalizarMarca: normalizarMarca,
        urlImagenFilaInventario: urlImagenFilaInventario,
        INVENTARIO_COLS_VISTA: 25,
        precioPedidoMayoreo: precioPedidoMayoreo,
        etiquetaTierPedido: etiquetaTierPedido,
        esProductoMayoreo50: esProductoMayoreo50,
        formatoFechaLarga: function (isoOrMs) {
            if (isoOrMs == null || isoOrMs === '') return '—';
            var d;
            if (typeof isoOrMs === 'number') d = new Date(isoOrMs);
            else {
                var p = String(isoOrMs).split('-');
                if (p.length === 3) d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
                else d = new Date(isoOrMs);
            }
            if (isNaN(d.getTime())) return '—';
            return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
    };
})(window);
