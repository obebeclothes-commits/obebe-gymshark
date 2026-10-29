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

    /** Hoja VENTAS: datos en columnas B–N (A suele quedar vacía). Índices 0-based en CSV. */
    var VENTAS_COL_B = 1;
    var VENTAS_COL_N = 13;
    var VENTAS_ETIQUETAS = {
        1: 'B · Fecha',
        2: 'C · Artículo',
        3: 'D · Tipo',
        4: 'E · Precio',
        5: 'F · Talla',
        6: 'G · Color',
        7: 'H · Cat.',
        8: 'I · Cliente',
        9: 'J · Vendedor',
        10: 'K · Cuenta',
        11: 'L · Red social',
        12: 'M · Link',
        13: 'N · Teléfono'
    };

    var IDX_V = {
        fecha: VENTAS_COL_B,
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
        telefono: VENTAS_COL_N
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
    var CACHE_VENTAS_KEY = 'obebe_admin_ventas_cache_v1';
    var CACHE_GASTOS_KEY = 'obebe_gastos_cache_v1';
    var GASTOS_LOCAL_KEY = 'obebe_gastos_operativos_v1';
    var LIMPIEZA_VENTAS_NEG_KEY = 'obebe_ventas_neg_migrado_v1';
    /** Ventas/stock hechos sin Apps Script; se fusionan al refrescar desde Sheets */
    var PENDING_SYNC_KEY = 'obebe_admin_pending_sync_v1';
    var HISTORICO_BD_KEY = 'obebe_historico_inventario_v1';
    var AGOTADOS_TS_KEY = 'obebe_agotados_ts_v1';
    var KEY_CLIENTES_OVERRIDE = 'obebe_clientes_override_v1';
    var MEMORY_VENTAS_TTL_MS = 5 * 60 * 1000;
    var STORAGE_VENTAS_TTL_MS = 20 * 60 * 1000;
    /** Memoria: evita re-fetch al cambiar de módulo */
    var MEMORY_INV_TTL_MS = 5 * 60 * 1000;
    /** localStorage: abre el panel al instante y refresca en segundo plano */
    var STORAGE_INV_TTL_MS = 20 * 60 * 1000;

    var estado = {
        filas: [],
        ventas: [],
        gastos: [],
        lineasMayoreo: [],
        encabezadosFila2: [],
        cargadoEn: null,
        ventasCargadoEn: null,
        gastosCargadoEn: null,
        mayoreoCargadoEn: null,
        error: null,
        errorVentas: null,
        errorMayoreo: null,
        sheetUrl: 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit',
        inventarioSyncEnCurso: false,
        ventasSyncEnCurso: false,
        avisoSupabase: ''
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
        sincronizarHistoricoInventario(estado.filas);
        return {
            filas: estado.filas,
            resumen: calcularResumen(estado.filas),
            encabezadosFila2: estado.encabezadosFila2
        };
    }

    function leerAgotadosTs() {
        try {
            var raw = localStorage.getItem(AGOTADOS_TS_KEY);
            var o = raw ? JSON.parse(raw) : {};
            return o && typeof o === 'object' ? o : {};
        } catch (e) {
            return {};
        }
    }

    function guardarAgotadosTs(map) {
        try {
            localStorage.setItem(AGOTADOS_TS_KEY, JSON.stringify(map || {}));
        } catch (e) { /* ignore */ }
    }

    function registrarAgotadoFila(filaSheet) {
        if (!filaSheet) return;
        var map = leerAgotadosTs();
        map[String(filaSheet)] = Date.now();
        guardarAgotadosTs(map);
    }

    function quitarAgotadoFila(filaSheet) {
        if (!filaSheet) return;
        var map = leerAgotadosTs();
        delete map[String(filaSheet)];
        guardarAgotadosTs(map);
    }

    function timestampAgotadoFila(filaSheet) {
        var map = leerAgotadosTs();
        return map[String(filaSheet)] || 0;
    }

    function notificarCambioStockInventario(filaSheet, stock) {
        stock = parseInt(stock, 10);
        if (isNaN(stock)) return;
        if (stock === 0) registrarAgotadoFila(filaSheet);
        else quitarAgotadoFila(filaSheet);
    }

    function claveHistoricoFila(f) {
        f = f || {};
        return [
            f.filaSheet || 0,
            f.ref || 0,
            norm(f.nombre),
            norm(f.talla),
            norm(f.color),
            norm(f.marca)
        ].join('|');
    }

    function leerHistoricoBd() {
        try {
            var raw = localStorage.getItem(HISTORICO_BD_KEY);
            var arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function guardarHistoricoBd(arr) {
        try {
            localStorage.setItem(HISTORICO_BD_KEY, JSON.stringify(arr || []));
        } catch (e) {
            console.warn('[admin-data] historico bd', e);
        }
    }

    function copiarMetaHistorico(f, entry) {
        entry.ref = f.ref || 0;
        entry.nombre = f.nombre || '';
        entry.talla = f.talla || '';
        entry.color = f.color || '';
        entry.tipo = f.tipo || '';
        entry.marca = f.marca || '';
        entry.precio = f.precio || 0;
        entry.segmento = f.segmento || '';
        entry.filaSheet = f.filaSheet || entry.filaSheet || 0;
        entry.celdas = (f.celdas || []).slice();
        entry.actualizadoEn = Date.now();
    }

    function sincronizarHistoricoInventario(filas) {
        var bd = leerHistoricoBd();
        var byClave = {};
        bd.forEach(function (e) {
            if (e && e.clave) byClave[e.clave] = e;
        });
        (filas || []).forEach(function (f) {
            if (!f || !String(f.nombre || '').trim()) return;
            var k = claveHistoricoFila(f);
            var stock = f.stock || 0;
            if (!byClave[k]) {
                byClave[k] = {
                    clave: k,
                    cantidadRegistro: Math.max(1, stock),
                    creadoEn: Date.now(),
                    actualizadoEn: Date.now()
                };
                copiarMetaHistorico(f, byClave[k]);
            } else {
                var e = byClave[k];
                copiarMetaHistorico(f, e);
                if (stock > (e.cantidadRegistro || 0)) {
                    e.cantidadRegistro = stock;
                }
            }
        });
        var out = Object.keys(byClave).map(function (key) { return byClave[key]; });
        guardarHistoricoBd(out);
        return out;
    }

    function stockLivePorClave(filas) {
        var map = {};
        (filas || []).forEach(function (f) {
            map[claveHistoricoFila(f)] = f.stock || 0;
        });
        return map;
    }

    function listarHistoricoInventario(filasLive) {
        var bd = sincronizarHistoricoInventario(filasLive || estado.filas);
        var stockMap = stockLivePorClave(filasLive || estado.filas);
        return bd.map(function (e) {
            var live = stockMap[e.clave];
            var stockLive = live == null ? 0 : live;
            var cantidadVista = stockLive === 0 ? 1 : (e.cantidadRegistro || 1);
            return {
                entry: e,
                stockLive: stockLive,
                cantidadVista: cantidadVista,
                agotado: stockLive === 0
            };
        }).sort(function (a, b) {
            return String(a.entry.nombre).localeCompare(String(b.entry.nombre), 'es');
        });
    }

    function filtrarHistoricoBd(items, query) {
        query = norm(query);
        if (!query) return items;
        return (items || []).filter(function (row) {
            var e = row.entry || {};
            var blob = [
                e.nombre, e.tipo, e.talla, e.color, e.marca, e.segmento, String(e.ref)
            ].join(' ').toLowerCase();
            return blob.indexOf(query) >= 0;
        });
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
        if (escrituraLocalHabilitada()) return;
        if (usarSupabase() && supabaseListo()) {
            if (estado.inventarioSyncEnCurso) return;
            estado.inventarioSyncEnCurso = true;
            cargarInventarioDesdeSupabase().catch(function (err) {
                console.warn('[admin-data] sync inventario supabase', err.message || err);
            }).finally(function () {
                estado.inventarioSyncEnCurso = false;
            });
            return;
        }
        if (estado.inventarioSyncEnCurso) return;
        estado.inventarioSyncEnCurso = true;
        fetchTextoHoja(HOJA_INVENTARIO).then(function (texto) {
            estado.encabezadosFila2 = leerEncabezadosInventario(texto);
            estado.filas = parsearFilasInventario(texto);
            aplicarOverridesStockEnFilas(estado.filas, leerPendienteSync().stockByRow);
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

    function inferirSegmento(fila, idxInv) {
        idxInv = idxInv || idxInventario();
        var segCol = idxInv.segmento != null ? idxInv.segmento : IDX.segmento;
        var ubiCol = idxInv.ubicacion != null ? idxInv.ubicacion : IDX.ubicacion;
        var seg = (fila[segCol] || '').trim();
        if (seg) return normSegmento(seg);
        var u = (fila[ubiCol] || '').trim().toLowerCase();
        if (u.indexOf('mujer') >= 0) return 'Mujer';
        if (u.indexOf('hombre') >= 0) return 'Hombre';
        return 'Hombre';
    }

    function norm(s) {
        return String(s || '').trim().toLowerCase();
    }

    function contarArticulosUnicos(filas, soloConStock) {
        var refs = {};
        var sinRef = {};
        filas.forEach(function (r) {
            if (soloConStock && (r.stock || 0) <= 0) return;
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
        var iFoto = idxInventario().foto != null ? idxInventario().foto : 9;
        var url = normalizarRutaImagenAdmin(celdas[iFoto] || fila.fotoUrl || '');
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
            else if (t === 'ARTICULO' || t === 'ARTÍCULO' || t === 'NOMBRE') idx.nombre = c;
            else if (t === 'TIPO') idx.tipo = c;
            else if (t === 'PRECIO') idx.precio = c;
            else if (t === 'TALLA') idx.talla = c;
            else if (t === 'COLOR') idx.color = c;
            else if (t.indexOf('HOMBRE') >= 0 && t.indexOf('MUJER') >= 0) idx.segmento = c;
            else if (t === 'CLIENTE' || t.indexOf('CLIENTE') >= 0) idx.cliente = c;
            else if (t.indexOf('VEND') >= 0) idx.vendedor = c;
            else if (t.indexOf('CUENTA') >= 0) idx.cuenta = c;
            else if (t.indexOf('RED') >= 0 && t.indexOf('SOCIAL') >= 0) idx.redSocial = c;
            else if (t === 'LINK' || t.indexOf('LINK') >= 0 || t.indexOf('PERFIL') >= 0) idx.link = c;
            else if (t.indexOf('TEL') >= 0 || t.indexOf('WHATS') >= 0 || t.indexOf('CEL') >= 0 ||
                t.indexOf('NÚMERO') >= 0 || t.indexOf('NUMERO') >= 0) idx.telefono = c;
        }
        return idx;
    }

    function guardarCacheVentasLocal() {
        if (!estado.ventas.length) return;
        try {
            localStorage.setItem(CACHE_VENTAS_KEY, JSON.stringify({
                t: Date.now(),
                ventas: estado.ventas
            }));
        } catch (e) {
            console.warn('[admin-data] cache ventas', e);
        }
    }

    function leerCacheVentasLocal() {
        try {
            var raw = localStorage.getItem(CACHE_VENTAS_KEY);
            if (!raw) return null;
            var o = JSON.parse(raw);
            if (!o || !o.t || !Array.isArray(o.ventas)) return null;
            if (Date.now() - o.t > STORAGE_VENTAS_TTL_MS) return null;
            return o;
        } catch (e) {
            return null;
        }
    }

    function paqueteVentasDesdeEstado() {
        return {
            ventas: estado.ventas,
            resumenVentas: calcularResumenVentas(estado.ventas),
            clientes: calcularPerfilesClientes(estado.ventas)
        };
    }

    function snapshotVentasCacheLocal() {
        if (estado.ventas.length && estado.ventasCargadoEn) {
            return paqueteVentasDesdeEstado();
        }
        var c = leerCacheVentasLocal();
        if (!c) return null;
        estado.ventas = c.ventas;
        estado.ventasCargadoEn = c.t;
        return paqueteVentasDesdeEstado();
    }

    function refrescarVentasEnFondo() {
        if (escrituraLocalHabilitada()) return;
        if (usarSupabase() && supabaseListo()) {
            if (estado.ventasSyncEnCurso) return;
            estado.ventasSyncEnCurso = true;
            cargarVentasDesdeSupabase().catch(function (err) {
                console.warn('[admin-data] sync ventas supabase', err.message || err);
            }).finally(function () {
                estado.ventasSyncEnCurso = false;
            });
            return;
        }
        if (estado.ventasSyncEnCurso) return;
        estado.ventasSyncEnCurso = true;
        var pend = leerPendienteSync();
        fetchTextoHoja(HOJA_VENTAS).then(function (texto) {
            estado.ventas = fusionarVentasConPendientes(parsearFilasVentas(texto), pend.ventasLocales);
            estado.ventasCargadoEn = Date.now();
            guardarCacheVentasLocal();
        }).catch(function (err) {
            console.warn('[admin-data] sync ventas fondo', err.message || err);
        }).finally(function () {
            estado.ventasSyncEnCurso = false;
        });
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

    function leerOverridesClientes() {
        try {
            var raw = localStorage.getItem(KEY_CLIENTES_OVERRIDE);
            var o = raw ? JSON.parse(raw) : {};
            return o && typeof o === 'object' ? o : {};
        } catch (e) {
            return {};
        }
    }

    function guardarOverridesClientes(obj) {
        try {
            localStorage.setItem(KEY_CLIENTES_OVERRIDE, JSON.stringify(obj || {}));
        } catch (e) { /* ignore */ }
    }

    function aplicarOverridesClientes(lista) {
        var ov = leerOverridesClientes();
        return (lista || []).map(function (c) {
            var patch = ov[c.id];
            if (!patch) return c;
            var out = Object.assign({}, c);
            if (patch.telefono != null) out.telefono = patch.telefono;
            if (patch.link != null) out.link = patch.link;
            if (patch.redPrincipal != null) out.redPrincipal = patch.redPrincipal;
            return out;
        });
    }

    function actualizarContactoCliente(clienteId, campos) {
        clienteId = String(clienteId || '').trim();
        campos = campos || {};
        if (!clienteId) return Promise.resolve({ ok: false, error: 'Cliente inválido.' });

        var perfil = calcularPerfilesClientes(estado.ventas).find(function (c) { return c.id === clienteId; });
        if (!perfil) return Promise.resolve({ ok: false, error: 'Cliente no encontrado.' });
        var nombreAnterior = perfil.nombre;
        var nuevoNombre = String(campos.nombre != null ? campos.nombre : nombreAnterior).trim();
        if (!nuevoNombre) return Promise.resolve({ ok: false, error: 'Indica el nombre del cliente.' });

        var patch = {
            telefono: String(campos.telefono || '').trim(),
            link: String(campos.link || '').trim(),
            redPrincipal: String(campos.redPrincipal || campos.redSocial || '').trim()
        };
        var ov = leerOverridesClientes();
        var nuevoId = claveCliente(nuevoNombre);
        if (nuevoId && nuevoId !== clienteId) {
            delete ov[clienteId];
            ov[nuevoId] = patch;
        } else {
            ov[clienteId] = patch;
        }
        guardarOverridesClientes(ov);

        var nnOld = norm(nombreAnterior);
        var tel = patch.telefono;
        var link = patch.link;
        var red = patch.redPrincipal;
        var idsActualizar = [];
        estado.ventas.forEach(function (v) {
            if (norm(v.cliente) !== nnOld) return;
            v.cliente = nuevoNombre;
            v.telefono = tel;
            v.link = link;
            v.redSocial = red;
            if (parseInt(v.filaSheet, 10) > 0) idsActualizar.push(v.filaSheet);
        });
        estado.ventasCargadoEn = Date.now();
        guardarCacheVentasLocal();

        if (!edicionVentasHabilitada() || !idsActualizar.length) {
            return Promise.resolve({ ok: true, actualizadas: idsActualizar.length, soloLocal: !edicionVentasHabilitada() });
        }
        var uniq = {};
        idsActualizar.forEach(function (id) { uniq[id] = true; });
        var ids = Object.keys(uniq);
        var i = 0;
        function next() {
            if (i >= ids.length) return Promise.resolve({ ok: true, actualizadas: ids.length });
            var id = parseInt(ids[i++], 10);
            var v = estado.ventas.find(function (x) { return x.filaSheet === id; });
            if (!v) return next();
            return actualizarVentaLinea(id, ventaCamposDesdeObj(v)).then(next);
        }
        return next();
    }

    function calcularPerfilesClientes(ventas) {
        var map = {};
        (ventas || []).forEach(function (v) {
            if (!esLineaVentaRetail(v)) return;
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
                    vendedores: {},
                    cuentas: {},
                    articulos: 0,
                    gasto: 0,
                    ultimaCompraIso: '',
                    ultimaCompraRaw: ''
                };
            }
            var c = map[key];
            var red = String(v.redSocial || '').trim() || 'Sin dato';
            c.redSocial[red] = (c.redSocial[red] || 0) + 1;
            var tipo = String(v.tipo || '').trim() || 'Sin tipo';
            c.tipos[tipo] = (c.tipos[tipo] || 0) + 1;
            var vend = String(v.vendedor || '').trim() || 'Sin vendedor';
            c.vendedores[vend] = (c.vendedores[vend] || 0) + 1;
            var cta = String(v.cuenta || '').trim() || 'Sin cuenta';
            c.cuentas[cta] = (c.cuentas[cta] || 0) + 1;
            c.articulos += 1;
            c.gasto += v.precio || 0;
            if (v.fechaIso && (!c.ultimaCompraIso || v.fechaIso >= c.ultimaCompraIso)) {
                if (!c.ultimaCompraIso || v.fechaIso >= c.ultimaCompraIso) {
                    c.ultimaCompraIso = v.fechaIso;
                    c.ultimaCompraRaw = v.fechaRaw || '';
                    if (v.telefono) c.telefono = String(v.telefono).trim();
                    if (v.link) c.link = String(v.link).trim();
                }
            } else {
                if (v.telefono && !c.telefono) c.telefono = String(v.telefono).trim();
                if (v.link && !c.link) c.link = String(v.link).trim();
            }
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
                vendedorPrincipal: elegirRedPrincipal(c.vendedores),
                cuentaPrincipal: elegirRedPrincipal(c.cuentas),
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
        return aplicarOverridesClientes(lista);
    }

    function filtrarClientes(clientes, query) {
        query = norm(query);
        if (!query) return clientes || [];
        return (clientes || []).filter(function (c) {
            var blob = [
                c.nombre, c.telefono, c.link, c.redPrincipal, c.tipoPrincipal,
                c.vendedorPrincipal, c.cuentaPrincipal, String(c.ranking)
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
        var enc = encabezadosInventarioActuales();
        var headers = [];
        var cols = columnasVistaInventario();
        for (var i = 0; i < cols.length; i++) {
            var c = cols[i];
            headers.push({ col: c + 1, letter: colLetter(c), title: enc[c] || '' });
        }
        return headers;
    }

    function columnasVistaInventario() {
        if (global.ObebeInventarioColumnas) {
            return ObebeInventarioColumnas.columnasVistaInventario();
        }
        var out = [];
        for (var c = 0; c < 25; c++) {
            if (c !== 18) out.push(c);
        }
        return out;
    }

    function combinarEncabezadosInventario(filaEnc) {
        if (global.ObebeInventarioColumnas) {
            return ObebeInventarioColumnas.combinarEncabezados(filaEnc);
        }
        return filaEnc || [];
    }

    function encabezadosInventarioActuales() {
        if (estado.encabezadosFila2 && estado.encabezadosFila2.length) {
            return combinarEncabezadosInventario(estado.encabezadosFila2);
        }
        return combinarEncabezadosInventario([]);
    }

    function idxInventario() {
        return resolverIndicesInventario(encabezadosInventarioActuales());
    }

    function resolverIndicesInventario(enc) {
        if (global.ObebeInventarioColumnas) {
            return ObebeInventarioColumnas.resolver(enc);
        }
        return {
            imagen: 0, nombre: 1, stock: 2, talla: 3, color: 4, tipo: 5, marca: 6, precio: 7,
            total: 8, foto: 9, fechaStock: 10, precioMayoreo: 15, mayoreo: 17, precioMayoreo50: 21,
            segmento: 19, ubicacion: 27
        };
    }

    function leerEncabezadosInventario(csvTexto) {
        var grid = parseCSV(csvTexto);
        if (grid.length <= FILA_ENCABEZADOS) return combinarEncabezadosInventario([]);
        return combinarEncabezadosInventario(padCeldas(grid[FILA_ENCABEZADOS]));
    }

    function filaInventarioDesdeCeldas(celdas, filaSheet, idxInv) {
        celdas = padCeldas(celdas || []);
        idxInv = idxInv || idxInventario();
        var iNom = idxInv.nombre != null ? idxInv.nombre : IDX.nombre;
        var iImg = idxInv.imagen != null ? idxInv.imagen : IDX.imagen;
        var nombre = (celdas[iNom] || '').trim();
        if (nombre.toUpperCase() === 'NOMBRE' || nombre.toUpperCase() === 'ARTICULO' || nombre.toUpperCase() === 'ARTÍCULO') {
            return null;
        }
        if (filaInventarioVacia(celdas)) return null;
        if (!nombre && !parseRef(celdas[iImg])) return null;
        var ref = parseRef(celdas[iImg]);
        var stock = parseStock(celdas[idxInv.stock != null ? idxInv.stock : IDX.stock]);
        var precio = parseNum(celdas[idxInv.precio != null ? idxInv.precio : IDX.precio]);
        var iTotal = idxInv.total != null ? idxInv.total : 8;
        var valorLinea = parseNum(celdas[iTotal]);
        if (!valorLinea && precio > 0 && stock > 0) valorLinea = precio * stock;
        var segmento = inferirSegmento(celdas, idxInv);
        var iFoto = idxInv.foto != null ? idxInv.foto : 9;
        return {
            ref: ref,
            nombre: nombre,
            stock: stock,
            talla: (celdas[idxInv.talla != null ? idxInv.talla : IDX.talla] || '').trim(),
            color: (celdas[idxInv.color != null ? idxInv.color : IDX.color] || '').trim(),
            tipo: (celdas[idxInv.tipo != null ? idxInv.tipo : IDX.tipo] || '').trim(),
            marca: normalizarMarca(celdas[idxInv.marca != null ? idxInv.marca : IDX.marca]),
            precio: precio,
            precioMayoreo: parseNum(celdas[idxInv.precioMayoreo != null ? idxInv.precioMayoreo : IDX.precioMayoreo]),
            precioMayoreo50: parseNum(celdas[idxInv.precioMayoreo50 != null ? idxInv.precioMayoreo50 : IDX.precioMayoreo50]),
            mayoreo: parseMayoreoFlag(celdas[idxInv.mayoreo != null ? idxInv.mayoreo : IDX.mayoreo]),
            fechaStockIso: parseFechaVenta(celdas[idxInv.fechaStock != null ? idxInv.fechaStock : IDX.fechaStock]),
            valorLinea: valorLinea,
            segmento: segmento,
            ubicacion: (celdas[idxInv.ubicacion != null ? idxInv.ubicacion : IDX.ubicacion] || '').trim(),
            fotoUrl: normalizarRutaImagenAdmin(celdas[iFoto]),
            filaSheet: filaSheet,
            celdas: celdas
        };
    }

    function parsearFilasInventario(csvTexto) {
        var grid = parseCSV(csvTexto);
        if (grid.length > FILA_ENCABEZADOS) {
            estado.encabezadosFila2 = combinarEncabezadosInventario(padCeldas(grid[FILA_ENCABEZADOS]));
        }
        var idxInv = idxInventario();
        var out = [];
        for (var i = FILA_INICIO; i < grid.length; i++) {
            var f = grid[i];
            var row = filaInventarioDesdeCeldas(padCeldas(f), i + 1, idxInv);
            if (row) out.push(row);
        }
        return out;
    }

    function celdasDesdeRegistroSupabase(raw) {
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
            try {
                var p = JSON.parse(raw);
                return Array.isArray(p) ? p : [];
            } catch (e) {
                return [];
            }
        }
        return [];
    }

    function parsearFilasInventarioSupabase(rows) {
        var out = [];
        (rows || []).forEach(function (r) {
            var row = filaInventarioDesdeCeldas(celdasDesdeRegistroSupabase(r.celdas), r.id);
            if (row) out.push(row);
        });
        return out;
    }

    function cargarInventarioDesdeSheetsRed() {
        return fetchTextoHoja(HOJA_INVENTARIO).then(function (texto) {
            estado.encabezadosFila2 = leerEncabezadosInventario(texto);
            estado.filas = parsearFilasInventario(texto);
            aplicarOverridesStockEnFilas(estado.filas, leerPendienteSync().stockByRow);
            estado.cargadoEn = Date.now();
            guardarCacheInventarioLocal();
            return paqueteInventarioDesdeEstado();
        });
    }

    function importarFilasSupabaseEnChunks(actionReplace, actionAppend, filasPayload) {
        var CHUNK = 60;
        if (!filasPayload.length) return Promise.resolve({ ok: true, inserted: 0 });
        var first = filasPayload.slice(0, CHUNK);
        var rest = filasPayload.slice(CHUNK);
        return apiAdminScript(actionReplace, { filas: first }).then(function () {
            if (!rest.length) return { ok: true };
            var i = 0;
            function next() {
                if (i >= rest.length) return Promise.resolve({ ok: true });
                var batch = rest.slice(i, i + CHUNK);
                i += CHUNK;
                return apiAdminScript(actionAppend, { filas: batch }).then(next);
            }
            return next();
        });
    }

    function importarVentasSupabaseEnChunks(ventasLines) {
        var CHUNK = 200;
        if (!ventasLines.length) return Promise.resolve({ ok: true, inserted: 0 });
        var first = ventasLines.slice(0, CHUNK);
        var rest = ventasLines.slice(CHUNK);
        return apiAdminScript('importVentasReplace', { ventas: first }).then(function () {
            if (!rest.length) return { ok: true };
            var i = 0;
            function next() {
                if (i >= rest.length) return Promise.resolve({ ok: true });
                var batch = rest.slice(i, i + CHUNK);
                i += CHUNK;
                return apiAdminScript('importVentasAppend', { ventas: batch }).then(next);
            }
            return next();
        });
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
            articulosUnicos: contarArticulosUnicos(filas, true),
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
            var stock = r.stock || 0;
            res.unidades += stock;
            if (stock === 0) res.agotados++;
            else if (stock <= 2) res.stockBajo++;
            if (stock > 0) {
                if (r.valorLinea > 0) res.valorEstimado += r.valorLinea;
                else if (r.precio > 0) res.valorEstimado += r.precio * stock;
            }
            var m = r.marca || 'Sin marca';
            res.porMarca[m] = (res.porMarca[m] || 0) + stock;
            if (r.segmento === 'Mujer') res.porSegmento.Mujer += stock;
            else res.porSegmento.Hombre += stock;
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

    function esLineaVentaRetail(v) {
        return (Number(v && v.precio) || 0) > 0;
    }

    function acumularPeriodo(rv, venta, periodo) {
        if (!esLineaVentaRetail(venta)) return;
        if (!enPeriodo(venta.fechaIso, periodo)) return;
        rv[periodo].monto += venta.precio;
        rv[periodo].count++;
    }

    var CUENTAS_VENTAS_CANON = [
        { match: 'daniel', label: 'Daniel' },
        { match: 'ugo', label: 'Ugo' },
        { match: 'fer', label: 'Fer' }
    ];

    function etiquetaCuentaVentas(cuenta) {
        var c = String(cuenta || '').trim();
        if (!c) return 'Sin cuenta';
        var low = c.toLowerCase();
        var i;
        for (i = 0; i < CUENTAS_VENTAS_CANON.length; i++) {
            var m = CUENTAS_VENTAS_CANON[i].match;
            if (low.indexOf(m) === 0 || low.indexOf(m + ' ') >= 0 || low.indexOf(' ' + m) >= 0) {
                return CUENTAS_VENTAS_CANON[i].label;
            }
        }
        return c;
    }

    function calcularResumenVentas(ventas) {
        var rv = {
            hoy: { monto: 0, count: 0 },
            semana: { monto: 0, count: 0 },
            mes: { monto: 0, count: 0 },
            porVendedorMes: {},
            porSegmentoMes: { Hombre: 0, Mujer: 0, '': 0 },
            porTipoMes: {},
            porCuentaSemana: {},
            porCuentaMes: {},
            masVendidosMes: {},
            totalRegistros: ventas.length
        };
        ventas.forEach(function (v) {
            acumularPeriodo(rv, v, 'hoy');
            acumularPeriodo(rv, v, 'semana');
            acumularPeriodo(rv, v, 'mes');
            var cuenta = etiquetaCuentaVentas(v.cuenta);
            if (enPeriodo(v.fechaIso, 'semana') && esLineaVentaRetail(v)) {
                rv.porCuentaSemana[cuenta] = (rv.porCuentaSemana[cuenta] || 0) + v.precio;
            }
            if (!enPeriodo(v.fechaIso, 'mes') || !esLineaVentaRetail(v)) return;
            var vend = v.vendedor || 'Sin vendedor';
            rv.porVendedorMes[vend] = (rv.porVendedorMes[vend] || 0) + v.precio;
            var seg = v.segmento || '';
            rv.porSegmentoMes[seg] = (rv.porSegmentoMes[seg] || 0) + v.precio;
            var tipo = v.tipo || 'Sin tipo';
            rv.porTipoMes[tipo] = (rv.porTipoMes[tipo] || 0) + 1;
            rv.porCuentaMes[cuenta] = (rv.porCuentaMes[cuenta] || 0) + v.precio;
            if (v.nombre) {
                rv.masVendidosMes[v.nombre] = (rv.masVendidosMes[v.nombre] || 0) + 1;
            }
        });
        return rv;
    }

    /** Últimos N meses calendario (incl. mes actual), montos de venta por mes. */
    function ventasPorMes(ventas, cantidadMeses) {
        cantidadMeses = cantidadMeses || 12;
        var hoy = new Date();
        var buckets = [];
        var porKey = {};
        var i;
        for (i = cantidadMeses - 1; i >= 0; i--) {
            var d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
            var key = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
            var b = {
                key: key,
                label: mesAbrev(d.getMonth()) + ' \'' + String(d.getFullYear()).slice(-2),
                monto: 0,
                count: 0
            };
            buckets.push(b);
            porKey[key] = b;
        }
        (ventas || []).forEach(function (v) {
            if (!esLineaVentaRetail(v)) return;
            if (!v.fechaIso || v.fechaIso.length < 7) return;
            var k = v.fechaIso.slice(0, 7);
            if (porKey[k]) {
                porKey[k].monto += v.precio || 0;
                porKey[k].count += 1;
            }
        });
        return buckets;
    }

    /** Últimas N semanas (lunes–domingo, incl. semana actual). */
    function ventasPorSemana(ventas, cantidadSemanas) {
        cantidadSemanas = cantidadSemanas || 12;
        var hoy = new Date();
        var tEstaSemana = inicioSemanaLunes(hoy);
        var buckets = [];
        var i;
        for (i = cantidadSemanas - 1; i >= 0; i--) {
            var lun = new Date(tEstaSemana);
            lun.setDate(lun.getDate() - i * 7);
            var dom = new Date(lun);
            dom.setDate(dom.getDate() + 6);
            var isoLun = fechaLocalIso(lun);
            var isoDom = fechaLocalIso(dom);
            var label;
            if (lun.getMonth() === dom.getMonth()) {
                label = lun.getDate() + '–' + dom.getDate() + ' ' + mesAbrev(lun.getMonth());
            } else {
                label = lun.getDate() + ' ' + mesAbrev(lun.getMonth()) + '–' + dom.getDate() + ' ' +
                    mesAbrev(dom.getMonth());
            }
            buckets.push({
                key: isoLun,
                isoLun: isoLun,
                isoDom: isoDom,
                label: label,
                monto: 0,
                count: 0
            });
        }
        (ventas || []).forEach(function (v) {
            if (!esLineaVentaRetail(v)) return;
            if (!v.fechaIso) return;
            for (i = 0; i < buckets.length; i++) {
                var b = buckets[i];
                if (v.fechaIso >= b.isoLun && v.fechaIso <= b.isoDom) {
                    b.monto += v.precio || 0;
                    b.count += 1;
                    break;
                }
            }
        });
        return buckets;
    }

    function cfgAdmin() {
        return global.OBEBE_ADMIN_CONFIG || { appsScriptUrl: '', inventarioSecret: '', permitirEscrituraLocal: true };
    }

    function appsScriptConfigurado() {
        return !!String(cfgAdmin().appsScriptUrl || '').trim();
    }

    function usarSupabase() {
        return global.ObebeAdminBackend && ObebeAdminBackend.usarSupabaseAdmin();
    }

    function supabaseListo() {
        return global.ObebeAdminBackend && ObebeAdminBackend.supabaseListoAdmin();
    }

    function escrituraLocalHabilitada() {
        if (usarSupabase() && supabaseListo()) return false;
        var c = cfgAdmin();
        if (appsScriptConfigurado()) return false;
        return c.permitirEscrituraLocal !== false;
    }

    function leerPendienteSync() {
        try {
            var raw = localStorage.getItem(PENDING_SYNC_KEY);
            if (!raw) return { stockByRow: {}, ventasLocales: [] };
            var o = JSON.parse(raw);
            if (!o || typeof o !== 'object') return { stockByRow: {}, ventasLocales: [] };
            return {
                stockByRow: o.stockByRow && typeof o.stockByRow === 'object' ? o.stockByRow : {},
                ventasLocales: Array.isArray(o.ventasLocales) ? o.ventasLocales : []
            };
        } catch (e) {
            return { stockByRow: {}, ventasLocales: [] };
        }
    }

    function guardarPendienteSync(pend) {
        try {
            localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pend || { stockByRow: {}, ventasLocales: [] }));
        } catch (e) {
            console.warn('[admin-data] pending sync', e);
        }
    }

    function limpiarPendienteSync() {
        try {
            localStorage.removeItem(PENDING_SYNC_KEY);
        } catch (e) { /* ignore */ }
    }

    function aplicarOverridesStockEnFilas(filas, stockByRow) {
        if (!filas || !stockByRow) return;
        Object.keys(stockByRow).forEach(function (k) {
            var row = parseInt(k, 10);
            var stock = parseInt(stockByRow[k], 10);
            if (isNaN(row) || isNaN(stock)) return;
            filas.forEach(function (f) {
                if (f.filaSheet !== row) return;
                f.stock = stock;
                if (f.celdas) f.celdas[IDX.stock] = String(stock);
            });
        });
    }

    function fusionarVentasConPendientes(desdeSheet, pendientes) {
        var sheet = desdeSheet || [];
        var extra = pendientes || [];
        if (!extra.length) return sheet;
        var vistos = {};
        sheet.forEach(function (v) {
            var k = [v.fechaRaw, v.nombre, v.precio, v.talla, v.cliente, v.vendedor].join('|');
            vistos[k] = true;
        });
        var unicas = extra.filter(function (v) {
            var k = [v.fechaRaw, v.nombre, v.precio, v.talla, v.cliente, v.vendedor].join('|');
            if (vistos[k]) return false;
            vistos[k] = true;
            return true;
        });
        return unicas.concat(sheet);
    }

    function registrarPendienteTrasVentaLocal(stockUpdates, ventasLocal) {
        var pend = leerPendienteSync();
        (stockUpdates || []).forEach(function (u) {
            if (u.row != null) pend.stockByRow[String(u.row)] = u.stock;
        });
        (ventasLocal || []).forEach(function (v) {
            pend.ventasLocales.unshift(v);
        });
        guardarPendienteSync(pend);
    }

    function aplicarVentaRetailEnEstado(stockUpdates, ventasLocal) {
        (stockUpdates || []).forEach(function (u) {
            var hit = estado.filas.find(function (x) { return x.filaSheet === u.row; });
            if (hit) {
                hit.stock = u.stock;
                if (hit.celdas) hit.celdas[IDX.stock] = String(u.stock);
            }
            notificarCambioStockInventario(u.row, u.stock);
        });
        (ventasLocal || []).forEach(function (v) {
            estado.ventas.unshift(v);
        });
        estado.ventasCargadoEn = Date.now();
        sincronizarHistoricoInventario(estado.filas);
        guardarCacheInventarioLocal();
        guardarCacheVentasLocal();
    }

    function fechaTextoHoyVentas() {
        var d = new Date();
        return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
    }

    function lineaVentaDesdeFila(f, meta) {
        meta = meta || {};
        return [
            meta.fechaRaw || fechaTextoHoyVentas(),
            f.nombre || '',
            f.tipo || '',
            String(meta.precio != null ? meta.precio : f.precio || 0),
            f.talla || '',
            f.color || '',
            f.segmento || '',
            meta.cliente || '',
            meta.vendedor || '',
            meta.cuenta || '',
            meta.redSocial || '',
            meta.link || '',
            meta.telefono || ''
        ];
    }

    function ventaObjetoDesdeFila(f, meta) {
        meta = meta || {};
        var fechaRaw = meta.fechaRaw || fechaTextoHoyVentas();
        var precio = meta.precio != null ? meta.precio : f.precio || 0;
        return {
            fechaIso: parseFechaVenta(fechaRaw) || fechaLocalIso(new Date()),
            fechaRaw: fechaRaw,
            nombre: f.nombre,
            tipo: f.tipo,
            precio: precio,
            talla: f.talla,
            color: f.color,
            segmento: f.segmento,
            cliente: meta.cliente || '',
            vendedor: meta.vendedor || '',
            cuenta: meta.cuenta || '',
            redSocial: meta.redSocial || '',
            link: meta.link || '',
            telefono: meta.telefono || '',
            filaSheet: 0
        };
    }

    function apiAdminScript(action, payload) {
        if (usarSupabase()) {
            if (!supabaseListo()) {
                return Promise.reject(new Error(
                    'Supabase incompleto: supabaseUrl, supabaseAnonKey y adminApiUrl en admin-config.js.'
                ));
            }
            return ObebeAdminBackend.callAdminApi(action, payload).then(function (res) {
                if (!res || res.ok === false) {
                    throw new Error((res && res.error) || 'Error API Supabase');
                }
                return res;
            });
        }
        var c = cfgAdmin();
        if (!c.appsScriptUrl) {
            return Promise.reject(new Error('Falta appsScriptUrl en admin-config.js (Web App Apps Script).'));
        }
        var body = Object.assign({ action: action, secret: c.inventarioSecret || '' }, payload || {});
        return fetch(c.appsScriptUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body)
        }).then(function (res) { return res.json(); });
    }

    function cargarInventarioDesdeSupabase() {
        return ObebeAdminBackend.fetchInventarioRaw().then(function (rows) {
            if (!estado.encabezadosFila2 || !estado.encabezadosFila2.length) {
                estado.encabezadosFila2 = combinarEncabezadosInventario([]);
            }
            estado.filas = parsearFilasInventarioSupabase(rows);
            aplicarOverridesStockEnFilas(estado.filas, leerPendienteSync().stockByRow);
            if (!rows.length || !estado.filas.length) {
                estado.avisoSupabase =
                    'Supabase no tiene inventario todavía. Ve a Configuración → Importar desde Google. ' +
                    'Mientras tanto se muestra el Sheet (solo lectura).';
                return cargarInventarioDesdeSheetsRed();
            }
            estado.avisoSupabase = '';
            estado.cargadoEn = Date.now();
            guardarCacheInventarioLocal();
            return paqueteInventarioDesdeEstado();
        });
    }

    function cargarVentasDesdeSupabase() {
        return ObebeAdminBackend.fetchVentasDesdeApi().then(function (ventas) {
            var pend = leerPendienteSync();
            estado.ventas = fusionarVentasConPendientes(ventas, pend.ventasLocales);
            estado.ventasCargadoEn = Date.now();
            guardarCacheVentasLocal();
            var pack = paqueteVentasDesdeEstado();
            return {
                ventas: pack.ventas,
                resumenVentas: pack.resumenVentas,
                clientes: pack.clientes
            };
        });
    }

    function probarConexionSupabase() {
        if (!supabaseListo()) {
            return Promise.resolve({ ok: false, error: 'Faltan URL o claves en admin-config.js' });
        }
        return ObebeAdminBackend.callAdminApi('ping', {}).then(function (ping) {
            return ObebeAdminBackend.callAdminApi('getDbStats', {}).then(function (stats) {
                return ObebeAdminBackend.fetchInventarioRaw().then(function (rows) {
                    return {
                        ok: true,
                        ping: ping,
                        stats: stats,
                        inventarioLeido: (rows || []).length
                    };
                });
            });
        }).catch(function (e) {
            return { ok: false, error: e.message || String(e) };
        });
    }

    function importarSoloVentasDesdeGoogle() {
        if (!supabaseListo()) {
            return Promise.reject(new Error('Configura Supabase y despliega admin-api.'));
        }
        return apiAdminScript('importVentasFromGoogle', {}).then(function (res) {
            return cargarVentas(true).then(function () {
                return res;
            });
        }).catch(function (err) {
            var msg = err.message || String(err);
            if (msg.indexOf('desconocida') >= 0 || msg.indexOf('Acción') >= 0) {
                return Promise.reject(new Error(
                    'La Edge Function no tiene importVentasFromGoogle. Redeploy admin-api con el index.ts del repo.'
                ));
            }
            throw err;
        });
    }

    function migrarDesdeGoogleSheets() {
        if (!supabaseListo()) {
            return Promise.reject(new Error('Configura Supabase y despliega admin-api antes de migrar.'));
        }
        return apiAdminScript('importFromGoogleRetail', {}).then(function (res) {
            limpiarPendienteSync();
            estado.avisoSupabase = '';
            return cargarInventario(true).then(function () {
                return cargarVentas(true);
            }).then(function () {
                return res;
            });
        }).catch(function (err) {
            var msg = err.message || String(err);
            if (msg.indexOf('desconocida') >= 0 || msg.indexOf('Acción') >= 0) {
                return migrarDesdeGoogleSheetsLegacy();
            }
            throw err;
        });
    }

    function migrarDesdeGoogleSheetsLegacy() {
        return Promise.all([
            fetchTextoHoja(HOJA_INVENTARIO),
            fetchTextoHoja(HOJA_VENTAS)
        ]).then(function (parts) {
            var filas = parsearFilasInventario(parts[0]);
            var ventasGrid = parseCSV(parts[1]);
            var idx = resolverIndicesVentas(ventasGrid);
            var ventasLines = [];
            for (var i = FILA_INICIO; i < ventasGrid.length; i++) {
                var f = ventasGrid[i];
                var nombre = String(celda(f, idx.nombre) || '').trim();
                var fechaRaw = String(celda(f, idx.fecha) || '').trim();
                if (esFilaEncabezadoVenta(nombre, fechaRaw)) continue;
                if (!nombre && !fechaRaw) continue;
                ventasLines.push([
                    fechaRaw,
                    nombre,
                    String(celda(f, idx.tipo) || '').trim(),
                    String(parseNum(celda(f, idx.precio))),
                    String(celda(f, idx.talla) || '').trim(),
                    String(celda(f, idx.color) || '').trim(),
                    normSegmento(celda(f, idx.segmento)),
                    String(celda(f, idx.cliente) || '').trim(),
                    String(celda(f, idx.vendedor) || '').trim(),
                    String(celda(f, idx.cuenta) || '').trim(),
                    String(celda(f, idx.redSocial) || '').trim(),
                    String(celda(f, idx.link) || '').trim(),
                    String(celda(f, idx.telefono) || '').trim()
                ]);
            }
            var invPayload = filas.map(function (r) {
                return { celdas: r.celdas, legacy_sheet_row: r.filaSheet };
            });
            if (!invPayload.length) {
                return Promise.reject(new Error('No se leyeron filas de INVENTARIO desde Google.'));
            }
            return importarFilasSupabaseEnChunks(
                'importInventarioReplace',
                'importInventarioAppend',
                invPayload
            ).then(function () {
                return importarVentasSupabaseEnChunks(ventasLines);
            }).then(function () {
                limpiarPendienteSync();
                estado.avisoSupabase = '';
                return cargarInventario(true).then(function () {
                    return cargarVentas(true);
                });
            });
        });
    }

    function registrarVentaRetail(carrito, meta) {
        meta = meta || {};
        if (!carrito || !carrito.length) {
            return Promise.resolve({ ok: false, error: 'Agrega al menos un artículo.' });
        }
        var ventas = [];
        var ventasLocal = [];
        var stockByRow = {};
        carrito.forEach(function (c) {
            var f = c.fila;
            if (!f || !f.filaSheet) return;
            var qty = c.cantidad || 1;
            if (stockByRow[f.filaSheet] == null) stockByRow[f.filaSheet] = f.stock || 0;
            var precioU = c.precioUnitario != null ? c.precioUnitario : f.precio || 0;
            var lineMeta = Object.assign({}, meta, { precio: precioU });
            for (var i = 0; i < qty; i++) {
                ventas.push(lineaVentaDesdeFila(f, lineMeta));
                ventasLocal.push(ventaObjetoDesdeFila(f, lineMeta));
            }
            stockByRow[f.filaSheet] = Math.max(0, stockByRow[f.filaSheet] - qty);
        });
        var stockUpdates = Object.keys(stockByRow).map(function (k) {
            return { row: parseInt(k, 10), stock: stockByRow[k] };
        });
        if (escrituraLocalHabilitada()) {
            aplicarVentaRetailEnEstado(stockUpdates, ventasLocal);
            registrarPendienteTrasVentaLocal(stockUpdates, ventasLocal);
            return Promise.resolve({
                ok: true,
                soloLocal: true,
                ventas: ventasLocal.length,
                clientes: calcularPerfilesClientes(estado.ventas)
            });
        }
        return apiAdminScript('registrarVentaRetail', { ventas: ventas, stockUpdates: stockUpdates })
            .then(function (res) {
                if (!res || res.ok === false) {
                    throw new Error((res && res.error) || 'Error al registrar venta');
                }
                limpiarPendienteSync();
                aplicarVentaRetailEnEstado(stockUpdates, ventasLocal);
                return { ok: true, ventas: ventasLocal.length, clientes: calcularPerfilesClientes(estado.ventas) };
            });
    }

    function ventaCamposDesdeObj(v) {
        v = v || {};
        return {
            fechaRaw: v.fechaRaw || '',
            nombre: v.nombre || '',
            tipo: v.tipo || '',
            precio: v.precio != null ? v.precio : 0,
            talla: v.talla || '',
            color: v.color || '',
            segmento: v.segmento || '',
            cliente: v.cliente || '',
            vendedor: v.vendedor || '',
            cuenta: v.cuenta || '',
            redSocial: v.redSocial || '',
            link: v.link || '',
            telefono: v.telefono || ''
        };
    }

    function ventaObjetoDesdeCampos(campos, ventaId) {
        campos = campos || {};
        var fechaRaw = String(campos.fechaRaw || '').trim() || fechaTextoHoyVentas();
        var precio = parseNum(campos.precio);
        return {
            fechaIso: parseFechaVenta(fechaRaw) || fechaLocalIso(new Date()),
            fechaRaw: fechaRaw,
            nombre: String(campos.nombre || '').trim(),
            tipo: String(campos.tipo || '').trim(),
            precio: precio,
            talla: String(campos.talla || '').trim(),
            color: String(campos.color || '').trim(),
            segmento: normSegmento(campos.segmento),
            cliente: String(campos.cliente || '').trim(),
            vendedor: String(campos.vendedor || '').trim(),
            cuenta: String(campos.cuenta || '').trim(),
            redSocial: String(campos.redSocial || '').trim(),
            link: String(campos.link || '').trim(),
            telefono: String(campos.telefono || '').trim(),
            filaSheet: ventaId || 0
        };
    }

    function reemplazarVentaEnEstado(ventaId, nuevo) {
        var id = parseInt(ventaId, 10);
        var idx = estado.ventas.findIndex(function (v) { return v.filaSheet === id; });
        if (idx < 0) return false;
        if (nuevo) estado.ventas[idx] = nuevo;
        else estado.ventas.splice(idx, 1);
        estado.ventasCargadoEn = Date.now();
        guardarCacheVentasLocal();
        return true;
    }

    function insertarVentaEnEstado(nuevo) {
        if (!nuevo) return;
        if (!parseInt(nuevo.filaSheet, 10) && escrituraLocalHabilitada()) {
            nuevo.filaSheet = generarVentaLocalId();
        }
        estado.ventas.unshift(nuevo);
        estado.ventasCargadoEn = Date.now();
        guardarCacheVentasLocal();
    }

    function generarVentaLocalId() {
        var min = 0;
        (estado.ventas || []).forEach(function (v) {
            var id = parseInt(v.filaSheet, 10);
            if (!isNaN(id) && id < min) min = id;
        });
        return min - 1;
    }

    function ventaTieneIdEditable(v) {
        return !!parseInt(v && v.filaSheet, 10);
    }

    function ventasNecesitanSincronizarIds(list) {
        list = list || estado.ventas || [];
        if (!list.length) return false;
        if (!list.some(function (v) { return !ventaTieneIdEditable(v); })) return false;
        return true;
    }

    function repararVentasLocalIdsNegativos() {
        var changed = false;
        (estado.ventas || []).forEach(function (v) {
            if (!ventaTieneIdEditable(v)) {
                v.filaSheet = generarVentaLocalId();
                changed = true;
            }
        });
        if (changed) {
            estado.ventasCargadoEn = Date.now();
            guardarCacheVentasLocal();
        }
        return changed;
    }

    function sincronizarVentasParaEdicion() {
        if (usarSupabase() && supabaseListo()) {
            return cargarVentasDesdeSupabase().then(function (paq) {
                if (paq && paq.ventas) {
                    estado.ventas = paq.ventas;
                    estado.resumenVentas = paq.resumenVentas;
                    estado.ventasCargadoEn = Date.now();
                    guardarCacheVentasLocal();
                }
                return paq;
            });
        }
        repararVentasLocalIdsNegativos();
        return Promise.resolve(paqueteVentasDesdeEstado());
    }

    function aplicarStockUpdateEnEstado(stockUpdates) {
        (stockUpdates || []).forEach(function (u) {
            var hit = estado.filas.find(function (x) { return x.filaSheet === u.row; });
            if (hit) {
                hit.stock = u.stock;
                if (hit.celdas) hit.celdas[IDX.stock] = String(u.stock);
            }
            notificarCambioStockInventario(u.row, u.stock);
        });
        sincronizarHistoricoInventario(estado.filas);
        guardarCacheInventarioLocal();
    }

    function esErrorAccionVentaAntigua(err) {
        var m = String((err && err.message) || err || '');
        return /acci[oó]n desconocida|unknown action|desconocida/i.test(m);
    }

    function errorVentasParaUi(msg) {
        var t = String(msg || '').trim();
        if (!t) return null;
        if (esErrorAccionVentaAntigua({ message: t })) return null;
        return t;
    }

    function lineaVentaDesdeObj(v) {
        return [
            v.fechaRaw || '',
            v.nombre || '',
            v.tipo || '',
            String(v.precio != null ? v.precio : 0),
            v.talla || '',
            v.color || '',
            v.segmento || '',
            v.cliente || '',
            v.vendedor || '',
            v.cuenta || '',
            v.redSocial || '',
            v.link || '',
            v.telefono || ''
        ];
    }

    function ventasObjsALineas(list) {
        return (list || []).map(lineaVentaDesdeObj);
    }

    function buscarFilaInventarioPorVenta(nombre, talla, color) {
        var nn = norm(nombre);
        if (!nn) return null;
        var nt = norm(talla);
        var nc = norm(color);
        for (var i = 0; i < estado.filas.length; i++) {
            var f = estado.filas[i];
            if (norm(f.nombre) !== nn) continue;
            if (nt && norm(f.talla) !== nt) continue;
            if (nc && norm(f.color) !== nc) continue;
            return f;
        }
        return null;
    }

    var KEY_PEDIDOS_MAYOREO = 'obebe_mayoreo_pedidos_v1';

    function leerPedidosMayoreoLocal() {
        try {
            var raw = localStorage.getItem(KEY_PEDIDOS_MAYOREO);
            var arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function guardarPedidosMayoreoLocal(arr) {
        try {
            localStorage.setItem(KEY_PEDIDOS_MAYOREO, JSON.stringify(arr || []));
        } catch (e) { /* ignore */ }
    }

    function marcarStockObebePedidoMayoreo(pedidoId, aplicado) {
        var todos = leerPedidosMayoreoLocal();
        var idx = todos.findIndex(function (p) { return p.id === pedidoId; });
        if (idx < 0) return;
        todos[idx].stockInventarioObebeAplicado = !!aplicado;
        todos[idx].stockInventarioObebeAplicadoEn = aplicado ? Date.now() : null;
        guardarPedidosMayoreoLocal(todos);
    }

    function resolverFilaInventarioDesdeItemPedido(it) {
        it = it || {};
        if (it.inventarioId) {
            var porId = estado.filas.find(function (f) {
                return idFilaInventario(f) === it.inventarioId;
            });
            if (porId) return porId;
        }
        if (it.ref) {
            var ref = parseInt(it.ref, 10);
            var candidatos = estado.filas.filter(function (f) { return f.ref === ref; });
            if (candidatos.length === 1) return candidatos[0];
            if (candidatos.length > 1) {
                var nt = norm(it.talla);
                var nc = norm(it.color);
                var exact = candidatos.find(function (f) {
                    return (!nt || norm(f.talla) === nt) && (!nc || norm(f.color) === nc);
                });
                if (exact) return exact;
            }
        }
        return buscarFilaInventarioPorVenta(it.nombre, it.talla, it.color);
    }

    function calcularUpdatesStockPedidoMayoreo(pedido, signo) {
        signo = signo < 0 ? -1 : 1;
        var porFila = {};
        (pedido.items || []).forEach(function (it) {
            if (it.disponibilidad !== 'si') return;
            var qty = it.cantidad || 1;
            var f = resolverFilaInventarioDesdeItemPedido(it);
            if (!f || !f.filaSheet) return;
            var row = f.filaSheet;
            if (porFila[row] == null) porFila[row] = f.stock || 0;
            porFila[row] = Math.max(0, porFila[row] + signo * qty);
        });
        return Object.keys(porFila).map(function (k) {
            return { row: parseInt(k, 10), stock: porFila[k] };
        });
    }

    function aplicarUpdatesStockSecuencial(updates) {
        if (!updates.length) return Promise.resolve({ ok: true, count: 0 });
        var i = 0;
        function next() {
            if (i >= updates.length) {
                return Promise.resolve({ ok: true, count: updates.length });
            }
            var u = updates[i++];
            return actualizarStockFila(u.row, u.stock).then(next);
        }
        return next();
    }

    function descontarStockPedidoMayoreo(pedido) {
        if (!pedido || !pedido.id) {
            return Promise.resolve({ ok: false, error: 'Pedido inválido.' });
        }
        if (pedido.stockInventarioObebeAplicado) {
            return Promise.resolve({ ok: true, omitido: true });
        }
        if (pedido.estado !== 'revisado') {
            return Promise.resolve({ ok: false, error: 'El pedido no está confirmado.' });
        }
        var updates = calcularUpdatesStockPedidoMayoreo(pedido, -1);
        return aplicarUpdatesStockSecuencial(updates).then(function (res) {
            marcarStockObebePedidoMayoreo(pedido.id, true);
            sincronizarHistoricoInventario(estado.filas);
            return Object.assign({ ok: true }, res, { unidades: updates.length });
        });
    }

    function revertirStockPedidoMayoreo(pedido) {
        if (!pedido || !pedido.id || !pedido.stockInventarioObebeAplicado) {
            return Promise.resolve({ ok: true, omitido: true });
        }
        var updates = calcularUpdatesStockPedidoMayoreo(pedido, 1);
        return aplicarUpdatesStockSecuencial(updates).then(function (res) {
            marcarStockObebePedidoMayoreo(pedido.id, false);
            sincronizarHistoricoInventario(estado.filas);
            return Object.assign({ ok: true }, res);
        });
    }

    function aplicarStockPendientePedidosMayoreo() {
        var todos = leerPedidosMayoreoLocal();
        var pend = todos.filter(function (p) {
            return p.estado === 'revisado' && !p.stockInventarioObebeAplicado;
        });
        var aplicados = 0;
        var chain = Promise.resolve();
        pend.forEach(function (p) {
            chain = chain.then(function () {
                return descontarStockPedidoMayoreo(p).then(function (r) {
                    if (r && r.ok && !r.omitido) aplicados += 1;
                });
            });
        });
        return chain.then(function () {
            return { ok: true, aplicados: aplicados, pendientes: pend.length };
        });
    }

    function ventasLineasDesdePedidoMayoreo(pedido) {
        pedido = pedido || {};
        var items = (pedido.items || []).filter(function (it) { return it.disponibilidad === 'si'; });
        if (!items.length) {
            return { ok: false, error: 'No hay artículos marcados como Sí hay.', lineas: [], ventasLocal: [] };
        }
        var fechaRaw = fechaTextoHoyVentas();
        var metaBase = {
            fechaRaw: fechaRaw,
            cliente: String(pedido.clienteNombre || pedido.clienteKey || 'Mayoreo').trim(),
            vendedor: 'Mayoreo',
            cuenta: 'Mayoreo'
        };
        var lineas = [];
        var ventasLocal = [];
        items.forEach(function (it) {
            var f = resolverFilaInventarioDesdeItemPedido(it);
            var fila = f || {
                nombre: it.nombre || '',
                tipo: it.tipo || '',
                talla: it.talla || '',
                color: it.color || '',
                segmento: it.segmento || 'Hombre',
                precio: it.precioCliente || 0
            };
            var precioU = it.precioCliente != null ? it.precioCliente : (fila.precio || 0);
            var meta = Object.assign({}, metaBase, { precio: precioU });
            var qty = it.cantidad || 1;
            for (var i = 0; i < qty; i++) {
                lineas.push(lineaVentaDesdeFila(fila, meta));
                ventasLocal.push(ventaObjetoDesdeFila(fila, meta));
            }
        });
        return { ok: true, lineas: lineas, ventasLocal: ventasLocal };
    }

    function registrarVentasDesdePedidoMayoreo(pedido) {
        if (!pedido || pedido.estado !== 'revisado') {
            return Promise.resolve({ ok: false, error: 'El pedido debe tener respuesta enviada al cliente.' });
        }
        if (pedido.ventaRetailRegistradaEn) {
            return Promise.resolve({ ok: false, error: 'La venta de este pedido ya fue registrada.' });
        }
        var pack = ventasLineasDesdePedidoMayoreo(pedido);
        if (!pack.ok) return Promise.resolve(pack);
        var camposList = (pack.ventasLocal || []).map(function (v) {
            return ventaCamposDesdeObj(v);
        });
        var chain = Promise.resolve({ n: 0 });
        camposList.forEach(function (campos) {
            chain = chain.then(function (acc) {
                return crearVentaLineaManual(campos, { ajustarStock: false }).then(function (res) {
                    if (!res || res.ok === false) {
                        throw new Error((res && res.error) || 'No se pudo registrar una línea de venta.');
                    }
                    return { n: acc.n + 1 };
                });
            });
        });
        return chain.then(function (acc) {
            return sincronizarVentasParaEdicion().then(function () {
                return {
                    ok: true,
                    lineas: acc.n,
                    soloLocal: escrituraLocalHabilitada()
                };
            });
        });
    }

    function gastoObjetoDesdeCampos(campos, id) {
        campos = campos || {};
        var fechaRaw = String(campos.fechaRaw || '').trim() || fechaTextoHoyVentas();
        var cantidad = Math.abs(parseNum(campos.cantidad));
        return {
            id: id || 0,
            fechaIso: parseFechaVenta(fechaRaw) || fechaLocalIso(new Date()),
            fechaRaw: fechaRaw,
            concepto: String(campos.concepto || '').trim(),
            cantidad: cantidad,
            pagadoPor: String(campos.pagadoPor || campos.pagado_por || '').trim()
        };
    }

    function gastoCamposDesdeObj(g) {
        g = g || {};
        return {
            fechaRaw: g.fechaRaw || '',
            concepto: g.concepto || '',
            cantidad: g.cantidad != null ? g.cantidad : 0,
            pagadoPor: g.pagadoPor || ''
        };
    }

    function leerGastosLocalStorage() {
        try {
            var raw = localStorage.getItem(GASTOS_LOCAL_KEY);
            var arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function guardarGastosLocalStorage(arr) {
        try {
            localStorage.setItem(GASTOS_LOCAL_KEY, JSON.stringify(arr || []));
        } catch (e) { /* ignore */ }
    }

    function generarGastoLocalId(gastos) {
        var min = 0;
        (gastos || []).forEach(function (g) {
            var id = parseInt(g.id, 10);
            if (!isNaN(id) && id < min) min = id;
        });
        return min - 1;
    }

    function calcularResumenGastos(gastos) {
        var rv = {
            hoy: 0,
            semana: 0,
            mes: 0,
            totalRegistros: (gastos || []).length
        };
        (gastos || []).forEach(function (g) {
            var m = Math.abs(Number(g.cantidad) || 0);
            if (enPeriodo(g.fechaIso, 'hoy')) rv.hoy += m;
            if (enPeriodo(g.fechaIso, 'semana')) rv.semana += m;
            if (enPeriodo(g.fechaIso, 'mes')) rv.mes += m;
        });
        return rv;
    }

    function filtrarGastos(gastos, q) {
        q = norm(q);
        if (!q) return gastos || [];
        return (gastos || []).filter(function (g) {
            return norm(g.concepto).indexOf(q) >= 0 ||
                norm(g.pagadoPor).indexOf(q) >= 0 ||
                norm(g.fechaRaw).indexOf(q) >= 0;
        });
    }

    function guardarCacheGastosLocal() {
        try {
            localStorage.setItem(CACHE_GASTOS_KEY, JSON.stringify({
                t: Date.now(),
                gastos: estado.gastos
            }));
        } catch (e) { /* ignore */ }
    }

    function cargarGastosDesdeSupabase() {
        return apiAdminScript('getGastos', {}).then(function (res) {
            if (!res || res.ok === false) {
                throw new Error((res && res.error) || 'Error al leer gastos');
            }
            estado.gastos = res.gastos || [];
            estado.gastosCargadoEn = Date.now();
            guardarCacheGastosLocal();
            return { gastos: estado.gastos, resumen: calcularResumenGastos(estado.gastos) };
        });
    }

    function cargarGastos(forzar) {
        if (usarSupabase() && supabaseListo()) {
            return cargarGastosDesdeSupabase();
        }
        estado.gastos = leerGastosLocalStorage();
        estado.gastosCargadoEn = Date.now();
        return Promise.resolve({
            gastos: estado.gastos,
            resumen: calcularResumenGastos(estado.gastos)
        });
    }

    function migrarVentasNegativasLocalAGastos() {
        var neg = (estado.ventas || []).filter(function (v) {
            return (Number(v.precio) || 0) < 0;
        });
        if (!neg.length) return { migrados: 0, eliminados: 0 };
        var gastos = leerGastosLocalStorage();
        neg.forEach(function (v) {
            gastos.unshift(gastoObjetoDesdeCampos({
                fechaRaw: v.fechaRaw,
                concepto: v.nombre || v.tipo || 'Gasto operativo',
                cantidad: Math.abs(Number(v.precio) || 0),
                pagadoPor: v.cuenta || v.vendedor || v.cliente || '—'
            }, generarGastoLocalId(gastos)));
        });
        guardarGastosLocalStorage(gastos);
        estado.gastos = gastos;
        estado.ventas = estado.ventas.filter(function (v) { return (Number(v.precio) || 0) >= 0; });
        estado.ventasCargadoEn = Date.now();
        guardarCacheVentasLocal();
        return { migrados: neg.length, eliminados: neg.length };
    }

    function limpiarVentasNegativasEnVentas() {
        var ya;
        try {
            ya = localStorage.getItem(LIMPIEZA_VENTAS_NEG_KEY);
        } catch (e) { ya = null; }
        var tieneNeg = (estado.ventas || []).some(function (v) { return (Number(v.precio) || 0) < 0; });
        if (ya && !tieneNeg) {
            return Promise.resolve({ ok: true, omitido: true, migrados: 0, eliminados: 0 });
        }
        if (usarSupabase() && supabaseListo()) {
            return apiAdminScript('limpiarVentasNegativasMigrarGastos', {}).then(function (res) {
                if (!res || res.ok === false) {
                    throw new Error((res && res.error) || 'No se pudo limpiar ventas negativas');
                }
                try {
                    localStorage.setItem(LIMPIEZA_VENTAS_NEG_KEY, String(Date.now()));
                } catch (e) { /* ignore */ }
                return cargarVentasDesdeSupabase().then(function () {
                    return cargarGastos(true).then(function () {
                        return res;
                    });
                });
            }).catch(function (err) {
                if (esErrorAccionVentaAntigua(err)) {
                    var localFb = migrarVentasNegativasLocalAGastos();
                    try {
                        localStorage.setItem(LIMPIEZA_VENTAS_NEG_KEY, String(Date.now()));
                    } catch (e) { /* ignore */ }
                    return Promise.resolve({
                        ok: true,
                        fallback: true,
                        migrados: localFb.migrados,
                        eliminados: localFb.eliminados
                    });
                }
                var msg = String(err.message || err);
                if (/gastos_operativos|relation|does not exist/i.test(msg)) {
                    return {
                        ok: false,
                        error: 'Crea la tabla gastos_operativos: ejecuta scripts/supabase/schema.sql en Supabase y redeploy admin-api.'
                    };
                }
                throw err;
            });
        }
        var local = migrarVentasNegativasLocalAGastos();
        try {
            localStorage.setItem(LIMPIEZA_VENTAS_NEG_KEY, String(Date.now()));
        } catch (e) { /* ignore */ }
        return Promise.resolve({ ok: true, migrados: local.migrados, eliminados: local.eliminados });
    }

    function crearGastoOperativo(campos) {
        campos = gastoCamposDesdeObj(campos);
        if (!campos.concepto) return Promise.resolve({ ok: false, error: 'Indica el concepto.' });
        if (Math.abs(parseNum(campos.cantidad)) <= 0) {
            return Promise.resolve({ ok: false, error: 'Indica la cantidad.' });
        }
        if (!campos.fechaRaw) campos.fechaRaw = fechaTextoHoyVentas();
        if (usarSupabase() && supabaseListo()) {
            return apiAdminScript('createGasto', { gasto: campos }).then(function (res) {
                if (res.gasto) {
                    estado.gastos.unshift(res.gasto);
                    guardarCacheGastosLocal();
                }
                return res;
            });
        }
        var gastos = leerGastosLocalStorage();
        var g = gastoObjetoDesdeCampos(campos, generarGastoLocalId(gastos));
        gastos.unshift(g);
        guardarGastosLocalStorage(gastos);
        estado.gastos = gastos;
        return Promise.resolve({ ok: true, gasto: g, soloLocal: true });
    }

    function actualizarGastoOperativo(gastoId, campos) {
        var id = parseInt(gastoId, 10);
        if (!id) return Promise.resolve({ ok: false, error: 'Gasto inválido.' });
        campos = gastoCamposDesdeObj(campos);
        if (!campos.concepto) return Promise.resolve({ ok: false, error: 'Indica el concepto.' });
        if (Math.abs(parseNum(campos.cantidad)) <= 0) {
            return Promise.resolve({ ok: false, error: 'Indica la cantidad.' });
        }
        if (usarSupabase() && supabaseListo()) {
            return apiAdminScript('updateGasto', { gastoId: id, gasto: campos }).then(function (res) {
                if (res.gasto) {
                    var idx = estado.gastos.findIndex(function (x) { return x.id === id; });
                    if (idx >= 0) estado.gastos[idx] = res.gasto;
                    guardarCacheGastosLocal();
                }
                return res;
            });
        }
        var gastos = leerGastosLocalStorage();
        var idxL = gastos.findIndex(function (x) { return x.id === id; });
        if (idxL < 0) return Promise.resolve({ ok: false, error: 'Gasto no encontrado.' });
        gastos[idxL] = gastoObjetoDesdeCampos(campos, id);
        guardarGastosLocalStorage(gastos);
        estado.gastos = gastos;
        return Promise.resolve({ ok: true, gasto: gastos[idxL], soloLocal: true });
    }

    function eliminarGastoOperativo(gastoId) {
        var id = parseInt(gastoId, 10);
        if (!id) return Promise.resolve({ ok: false, error: 'Gasto inválido.' });
        if (usarSupabase() && supabaseListo()) {
            return apiAdminScript('deleteGasto', { gastoId: id }).then(function (res) {
                estado.gastos = estado.gastos.filter(function (x) { return x.id !== id; });
                guardarCacheGastosLocal();
                return res;
            });
        }
        var gastos = leerGastosLocalStorage().filter(function (x) { return x.id !== id; });
        guardarGastosLocalStorage(gastos);
        estado.gastos = gastos;
        return Promise.resolve({ ok: true, soloLocal: true });
    }

    function devolverStockPorVenta(v) {
        var hit = buscarFilaInventarioPorVenta(v.nombre, v.talla, v.color);
        if (!hit || !hit.filaSheet) return Promise.resolve(null);
        return actualizarStockFila(hit.filaSheet, Math.max(0, (hit.stock || 0) + 1));
    }

    function descontarStockPorCampos(campos) {
        var hit = buscarFilaInventarioPorVenta(campos.nombre, campos.talla, campos.color);
        if (!hit || !hit.filaSheet || (hit.stock || 0) <= 0) return Promise.resolve(null);
        return actualizarStockFila(hit.filaSheet, Math.max(0, hit.stock - 1));
    }

    function reescribirVentasSupabaseDesdeEstado(nuevaLista) {
        if (!nuevaLista || !nuevaLista.length) {
            return apiAdminScript('importVentasReplace', { ventas: [] }).then(function () {
                estado.ventas = [];
                estado.ventasCargadoEn = Date.now();
                guardarCacheVentasLocal();
                return paqueteVentasDesdeEstado();
            });
        }
        var lines = ventasObjsALineas(nuevaLista);
        return importarVentasSupabaseEnChunks(lines).then(function () {
            return cargarVentasDesdeSupabase();
        });
    }

    function eliminarVentaLineaLegacyApi(id, opts) {
        var v = estado.ventas.find(function (x) { return x.filaSheet === id; });
        if (!v) return Promise.resolve({ ok: false, error: 'Venta no encontrada.' });
        var rest = estado.ventas.filter(function (x) { return x.filaSheet !== id; });
        var stockP = opts.ajustarStock !== false ? devolverStockPorVenta(v) : Promise.resolve(null);
        return stockP.then(function () {
            return reescribirVentasSupabaseDesdeEstado(rest);
        }).then(function () {
            return { ok: true, deleted: 1, fallback: true };
        });
    }

    function actualizarVentaLineaLegacyApi(id, campos) {
        var idx = estado.ventas.findIndex(function (x) { return x.filaSheet === id; });
        if (idx < 0) return Promise.resolve({ ok: false, error: 'Venta no encontrada.' });
        var copia = estado.ventas.slice();
        copia[idx] = ventaObjetoDesdeCampos(campos, id);
        return reescribirVentasSupabaseDesdeEstado(copia).then(function () {
            return { ok: true, venta: ventaObjetoDesdeCampos(campos, id), fallback: true };
        });
    }

    function crearVentaLineaLegacyApi(campos, opts) {
        var line = lineaVentaDesdeObj(ventaObjetoDesdeCampos(campos, 0));
        var stockP = opts.ajustarStock !== false ? descontarStockPorCampos(campos) : Promise.resolve(null);
        return stockP.then(function () {
            return apiAdminScript('importVentasAppend', { ventas: [line] });
        }).then(function () {
            return cargarVentasDesdeSupabase();
        }).then(function () {
            return { ok: true, fallback: true };
        });
    }

    function actualizarVentaLinea(ventaId, campos) {
        var id = parseInt(ventaId, 10);
        if (!id) return Promise.resolve({ ok: false, error: 'Venta inválida.' });
        campos = ventaCamposDesdeObj(campos);
        if (escrituraLocalHabilitada()) {
            var local = ventaObjetoDesdeCampos(campos, id);
            reemplazarVentaEnEstado(id, local);
            return Promise.resolve({ ok: true, venta: local, soloLocal: true });
        }
        return apiAdminScript('updateVentaLine', { ventaId: id, venta: campos }).then(function (res) {
            if (res.venta) reemplazarVentaEnEstado(id, res.venta);
            return res;
        }).catch(function (err) {
            if (!esErrorAccionVentaAntigua(err)) throw err;
            return actualizarVentaLineaLegacyApi(id, campos);
        });
    }

    function eliminarVentaLinea(ventaId, opts) {
        opts = opts || {};
        var id = parseInt(ventaId, 10);
        if (!id) return Promise.resolve({ ok: false, error: 'Venta inválida.' });
        if (escrituraLocalHabilitada()) {
            reemplazarVentaEnEstado(id, null);
            return Promise.resolve({ ok: true, soloLocal: true });
        }
        return apiAdminScript('deleteVentaLine', {
            ventaId: id,
            ajustarStock: opts.ajustarStock !== false
        }).then(function (res) {
            reemplazarVentaEnEstado(id, null);
            if (res.stock && res.stock.matched && res.stock.row != null && res.stock.stock != null) {
                aplicarStockUpdateEnEstado([{ row: res.stock.row, stock: res.stock.stock }]);
            }
            return res;
        }).catch(function (err) {
            if (!esErrorAccionVentaAntigua(err)) throw err;
            return eliminarVentaLineaLegacyApi(id, opts);
        });
    }

    function crearVentaLineaManual(campos, opts) {
        opts = opts || {};
        campos = ventaCamposDesdeObj(campos);
        if (escrituraLocalHabilitada()) {
            var local = ventaObjetoDesdeCampos(campos, generarVentaLocalId());
            insertarVentaEnEstado(local);
            return Promise.resolve({ ok: true, venta: local, soloLocal: true });
        }
        return apiAdminScript('createVentaLine', {
            venta: campos,
            ajustarStock: opts.ajustarStock !== false
        }).then(function (res) {
            if (res.venta) insertarVentaEnEstado(res.venta);
            if (res.stock && res.stock.matched && res.stock.row != null && res.stock.stock != null) {
                aplicarStockUpdateEnEstado([{ row: res.stock.row, stock: res.stock.stock }]);
            }
            return res;
        }).catch(function (err) {
            if (!esErrorAccionVentaAntigua(err)) throw err;
            return crearVentaLineaLegacyApi(campos, opts);
        });
    }

    function edicionVentasHabilitada() {
        if (usarSupabase() && supabaseListo()) return true;
        if (escrituraLocalHabilitada()) return true;
        return false;
    }

    function actualizarStockFila(filaSheet, stock) {
        stock = parseInt(stock, 10);
        if (isNaN(stock) || stock < 0) {
            return Promise.resolve({ ok: false, error: 'Stock inválido.' });
        }
        if (escrituraLocalHabilitada()) {
            var hitL = estado.filas.find(function (x) { return x.filaSheet === filaSheet; });
            if (hitL) {
                hitL.stock = stock;
                if (hitL.celdas) hitL.celdas[IDX.stock] = String(stock);
            }
            notificarCambioStockInventario(filaSheet, stock);
            sincronizarHistoricoInventario(estado.filas);
            var pend = leerPendienteSync();
            pend.stockByRow[String(filaSheet)] = stock;
            guardarPendienteSync(pend);
            guardarCacheInventarioLocal();
            return Promise.resolve({ ok: true, stock: stock, soloLocal: true });
        }
        return apiAdminScript('actualizarStock', { filaSheet: filaSheet, stock: stock }).then(function (res) {
            if (!res || res.ok === false) {
                throw new Error((res && res.error) || 'No se pudo actualizar stock');
            }
            var hit = estado.filas.find(function (x) { return x.filaSheet === filaSheet; });
            if (hit) {
                hit.stock = stock;
                if (hit.celdas) hit.celdas[IDX.stock] = String(stock);
            }
            notificarCambioStockInventario(filaSheet, stock);
            sincronizarHistoricoInventario(estado.filas);
            guardarCacheInventarioLocal();
            return { ok: true, stock: stock };
        });
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
        if (usarSupabase()) {
            if (!supabaseListo()) {
                estado.error = 'Supabase: completa supabaseUrl, supabaseAnonKey y adminApiUrl.';
                throw new Error(estado.error);
            }
            return cargarInventarioDesdeSupabase().catch(function (err) {
                if (estado.filas.length) {
                    console.warn('[admin-data] inventario supabase falló, cache', err.message || err);
                    return paqueteInventarioDesdeEstado();
                }
                estado.error = err.message || String(err);
                throw err;
            });
        }
        return cargarInventarioDesdeSheetsRed().catch(function (err) {
            if (estado.filas.length) {
                console.warn('[admin-data] inventario red falló, usando cache', err.message || err);
                return paqueteInventarioDesdeEstado();
            }
            estado.error = err.message || String(err);
            throw err;
        });
    }

    var sanitizandoVentasNeg = false;

    function empaquetarVentasTrasSanear(extra) {
        extra = extra || {};
        if (sanitizandoVentasNeg) {
            var packSkip = paqueteVentasDesdeEstado();
            return Promise.resolve({
                ventas: packSkip.ventas,
                resumenVentas: packSkip.resumenVentas,
                clientes: packSkip.clientes,
                error: errorVentasParaUi(extra.error)
            });
        }
        sanitizandoVentasNeg = true;
        return limpiarVentasNegativasEnVentas().then(function () {
            var pack = paqueteVentasDesdeEstado();
            return {
                ventas: pack.ventas,
                resumenVentas: pack.resumenVentas,
                clientes: pack.clientes,
                error: errorVentasParaUi(extra.error)
            };
        }).catch(function (err) {
            if (esErrorAccionVentaAntigua(err)) {
                migrarVentasNegativasLocalAGastos();
            }
            var pack = paqueteVentasDesdeEstado();
            var errUi = extra.error != null ? extra.error : (err.message || String(err));
            return {
                ventas: pack.ventas,
                resumenVentas: pack.resumenVentas,
                clientes: pack.clientes,
                error: errorVentasParaUi(errUi)
            };
        }).finally(function () {
            sanitizandoVentasNeg = false;
        });
    }

    function cargarVentas(forzar) {
        if (!forzar && estado.ventas.length && estado.ventasCargadoEn &&
            (Date.now() - estado.ventasCargadoEn < MEMORY_VENTAS_TTL_MS)) {
            return empaquetarVentasTrasSanear({});
        }
        if (!forzar && !estado.ventas.length) {
            var cacheV = leerCacheVentasLocal();
            if (cacheV) {
                estado.ventas = cacheV.ventas;
                estado.ventasCargadoEn = cacheV.t;
                refrescarVentasEnFondo();
                return empaquetarVentasTrasSanear({});
            }
        }
        estado.errorVentas = null;
        if (usarSupabase()) {
            if (!supabaseListo()) {
                estado.errorVentas = 'Supabase: completa adminApiUrl y claves.';
                return empaquetarVentasTrasSanear({ error: estado.errorVentas });
            }
            return cargarVentasDesdeSupabase()
                .then(function (pack) {
                    return empaquetarVentasTrasSanear({ error: pack.error });
                })
                .catch(function (err) {
                    if (estado.ventas.length) {
                        console.warn('[admin-data] ventas supabase falló, usando cache', err.message || err);
                        return empaquetarVentasTrasSanear({});
                    }
                    estado.errorVentas = errorVentasParaUi(err.message || String(err));
                    return empaquetarVentasTrasSanear({ error: estado.errorVentas });
                });
        }
        var pendV = leerPendienteSync();
        return fetchTextoHoja(HOJA_VENTAS)
            .then(function (texto) {
                estado.ventas = fusionarVentasConPendientes(parsearFilasVentas(texto), pendV.ventasLocales);
                estado.ventasCargadoEn = Date.now();
                guardarCacheVentasLocal();
                return empaquetarVentasTrasSanear({});
            })
            .catch(function (err) {
                if (estado.ventas.length) {
                    console.warn('[admin-data] ventas red falló, usando cache', err.message || err);
                    return empaquetarVentasTrasSanear({});
                }
                estado.errorVentas = errorVentasParaUi(err.message || String(err));
                estado.ventas = [];
                return empaquetarVentasTrasSanear({ error: estado.errorVentas });
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
                base.errorVentas = errorVentasParaUi(parts[0].error) || null;
                base.clientes = parts[0].clientes || calcularPerfilesClientes(parts[0].ventas);
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
            var tokens = query.split(/\s+/).filter(Boolean);
            if (!tokens.length) return true;
            for (var ti = 0; ti < tokens.length; ti++) {
                if (blob.indexOf(tokens[ti]) < 0) return false;
            }
            return true;
        });
    }

    function filaCoincideTokensNombre(f, tokensNombre) {
        var n = norm(f.nombre);
        return (tokensNombre || []).every(function (t) {
            return n.indexOf(norm(t)) >= 0;
        });
    }

    var KEY_BAJA_COLLEGIATE_HOODIE = 'obebe_baja_collegiate_hoodie_ml_v1';

    /** Baja stock M/L COLLEGIATE TECH HOODIE (mayoreo, sin registrar venta). Una sola vez por navegador. */
    function aplicarBajaStockMayoreoCollegiateHoodie() {
        var ya;
        try {
            ya = localStorage.getItem(KEY_BAJA_COLLEGIATE_HOODIE);
        } catch (e) { ya = null; }
        if (ya) return Promise.resolve({ ok: true, omitido: true });

        var tokens = ['collegiate', 'tech', 'hoodie'];
        var tallas = { m: true, l: true };
        var filasHit = (estado.filas || []).filter(function (f) {
            if (!f.filaSheet) return false;
            if (!filaCoincideTokensNombre(f, tokens)) return false;
            var t = norm(f.talla);
            return !!tallas[t];
        });
        if (!filasHit.length) {
            try {
                localStorage.setItem(KEY_BAJA_COLLEGIATE_HOODIE, '1');
            } catch (e) { /* ignore */ }
            return Promise.resolve({ ok: true, aplicados: 0, sinCoincidencias: true });
        }

        var chain = Promise.resolve({ aplicados: 0 });
        filasHit.forEach(function (f) {
            if ((f.stock || 0) <= 0) return;
            chain = chain.then(function (acc) {
                return actualizarStockFila(f.filaSheet, 0).then(function () {
                    acc.aplicados += 1;
                    return acc;
                });
            });
        });
        return chain.then(function (acc) {
            sincronizarHistoricoInventario(estado.filas);
            try {
                localStorage.setItem(KEY_BAJA_COLLEGIATE_HOODIE, '1');
            } catch (e) { /* ignore */ }
            return { ok: true, aplicados: acc.aplicados, filas: filasHit.length };
        });
    }

    function etiquetaMetodoPagoEntrega(m) {
        var k = norm(m);
        if (k === 'efectivo') return 'Efectivo';
        if (k === 'tarjeta') return 'Tarjeta';
        if (k === 'transferencia') return 'Transferencia';
        var t = String(m || '').trim();
        return t || 'Efectivo';
    }

    function stockUpdatesDesdeCarritoEntrega(carrito, signo) {
        signo = signo < 0 ? -1 : 1;
        var porFila = {};
        (carrito || []).forEach(function (c) {
            var f = c.fila;
            if (!f || !f.filaSheet) return;
            var row = f.filaSheet;
            if (porFila[row] == null) {
                var hit = estado.filas.find(function (x) { return x.filaSheet === row; });
                porFila[row] = hit ? (hit.stock || 0) : (f.stock || 0);
            }
            porFila[row] = Math.max(0, porFila[row] + signo * (c.cantidad || 1));
        });
        return Object.keys(porFila).map(function (k) {
            return { row: parseInt(k, 10), stock: porFila[k] };
        });
    }

    function stockDisponibleConEntregas(fila) {
        if (!fila) return 0;
        return Math.max(0, fila.stock || 0);
    }

    function validarCarritoEntrega(carrito) {
        if (!carrito || !carrito.length) {
            return { ok: false, error: 'Agrega al menos un artículo.' };
        }
        var i;
        for (i = 0; i < carrito.length; i++) {
            var c = carrito[i];
            var f = c.fila;
            if (!f || !f.filaSheet) {
                return { ok: false, error: 'Artículo sin referencia de inventario.' };
            }
            var disp = stockDisponibleConEntregas(f);
            if ((c.cantidad || 1) > disp) {
                return {
                    ok: false,
                    error: 'Stock insuficiente para «' + (f.nombre || '') + '» (disp. ' + disp + ').'
                };
            }
        }
        return { ok: true };
    }

    function itemsDesdeCarritoEntrega(carrito) {
        return (carrito || []).map(function (c) {
            var f = c.fila || {};
            var img = c.imagenUrl || urlImagenFilaInventario(f);
            return {
                filaSheet: f.filaSheet,
                inventarioId: idFilaInventario(f),
                nombre: f.nombre || '',
                talla: f.talla || '',
                color: f.color || '',
                tipo: f.tipo || '',
                marca: f.marca || '',
                segmento: f.segmento || '',
                cantidad: c.cantidad || 1,
                precioUnitario: c.precioUnitario != null ? c.precioUnitario : (f.precio || 0),
                imagenUrl: img || ''
            };
        });
    }

    function crearEntregaTrasVenta(datos, carrito) {
        if (!global.ObebeEntregasStore) {
            return Promise.resolve({ ok: false, error: 'Módulo de entregas no cargado.' });
        }
        datos = datos || {};
        if (!carrito || !carrito.length) {
            return Promise.resolve({ ok: false, error: 'Sin artículos para la entrega.' });
        }
        if (!String(datos.cliente || '').trim()) {
            return Promise.resolve({ ok: false, error: 'Indica el cliente.' });
        }
        if (!String(datos.lugar || '').trim()) {
            return Promise.resolve({ ok: false, error: 'Indica el lugar de entrega.' });
        }
        var fechaRaw = String(datos.fechaRaw || '').trim() || fechaTextoHoyVentas();
        var ent = {
            id: ObebeEntregasStore.uid(),
            estado: 'pendiente',
            ventaYaRegistrada: true,
            fechaIso: parseFechaVenta(fechaRaw) || fechaLocalIso(new Date()),
            fechaRaw: fechaRaw,
            hora: String(datos.hora || '').trim(),
            lugar: String(datos.lugar || '').trim(),
            cliente: String(datos.cliente || '').trim(),
            telefono: String(datos.telefono || '').trim(),
            metodoPago: norm(datos.metodoPago) || 'efectivo',
            notas: String(datos.notas || '').trim(),
            vendedor: String(datos.vendedor || '').trim(),
            items: itemsDesdeCarritoEntrega(carrito),
            creadoEn: Date.now(),
            completadaEn: null,
            stockReservado: false
        };
        ObebeEntregasStore.saveEntrega(ent);
        return Promise.resolve({ ok: true, entrega: ent });
    }

    function crearEntregaProgramada(datos, carrito) {
        return crearEntregaTrasVenta(datos, carrito);
    }

    function actualizarEntregaProgramada(entregaId, datos) {
        if (!global.ObebeEntregasStore) {
            return Promise.resolve({ ok: false, error: 'Módulo de entregas no cargado.' });
        }
        var ent = ObebeEntregasStore.getById(entregaId);
        if (!ent) return Promise.resolve({ ok: false, error: 'Entrega no encontrada.' });
        if (ent.estado !== 'pendiente') {
            return Promise.resolve({ ok: false, error: 'Solo puedes editar entregas pendientes.' });
        }
        datos = datos || {};
        if (!String(datos.cliente || ent.cliente || '').trim()) {
            return Promise.resolve({ ok: false, error: 'Indica el cliente.' });
        }
        if (!String(datos.lugar || ent.lugar || '').trim()) {
            return Promise.resolve({ ok: false, error: 'Indica el lugar de entrega.' });
        }
        var fechaRaw = String(datos.fechaRaw || ent.fechaRaw || '').trim() || fechaTextoHoyVentas();
        ent.fechaRaw = fechaRaw;
        ent.fechaIso = parseFechaVenta(fechaRaw) || ent.fechaIso || fechaLocalIso(new Date());
        ent.hora = datos.hora != null ? String(datos.hora).trim() : ent.hora;
        ent.lugar = String(datos.lugar || ent.lugar).trim();
        ent.cliente = String(datos.cliente || ent.cliente).trim();
        ent.telefono = datos.telefono != null ? String(datos.telefono).trim() : ent.telefono;
        if (datos.metodoPago) ent.metodoPago = norm(datos.metodoPago) || ent.metodoPago;
        ent.notas = datos.notas != null ? String(datos.notas).trim() : ent.notas;
        ent.actualizadaEn = Date.now();
        ObebeEntregasStore.saveEntrega(ent);
        return Promise.resolve({ ok: true, entrega: ent });
    }

    function cancelarEntregaProgramada(entregaId) {
        var ent = ObebeEntregasStore.getById(entregaId);
        if (!ent) return Promise.resolve({ ok: false, error: 'Entrega no encontrada.' });
        if (ent.estado !== 'pendiente') {
            return Promise.resolve({ ok: false, error: 'Solo se pueden cancelar entregas pendientes.' });
        }
        function marcarCancelada() {
            ent.estado = 'cancelada';
            ent.canceladaEn = Date.now();
            ObebeEntregasStore.saveEntrega(ent);
            return { ok: true };
        }
        if (ent.ventaYaRegistrada || !ent.stockReservado) {
            return Promise.resolve(marcarCancelada());
        }
        var carrito = (ent.items || []).map(function (it) {
            var f = estado.filas.find(function (x) { return x.filaSheet === it.filaSheet; }) || {
                filaSheet: it.filaSheet,
                stock: 0,
                nombre: it.nombre,
                talla: it.talla,
                color: it.color,
                tipo: it.tipo,
                segmento: it.segmento,
                precio: it.precioUnitario
            };
            return { fila: f, cantidad: it.cantidad || 1 };
        });
        var updates = stockUpdatesDesdeCarritoEntrega(carrito, 1);
        return aplicarUpdatesStockSecuencial(updates).then(function () {
            guardarCacheInventarioLocal();
            return marcarCancelada();
        });
    }

    function completarEntregaProgramada(entregaId, vendedor) {
        var ent = ObebeEntregasStore.getById(entregaId);
        if (!ent) return Promise.resolve({ ok: false, error: 'Entrega no encontrada.' });
        if (ent.estado !== 'pendiente') {
            return Promise.resolve({ ok: false, error: 'Esta entrega ya fue cerrada.' });
        }
        if (ent.ventaYaRegistrada) {
            ent.estado = 'completada';
            ent.completadaEn = Date.now();
            ObebeEntregasStore.saveEntrega(ent);
            return Promise.resolve({ ok: true, lineas: 0, entrega: ent, soloCierre: true });
        }
        var metaBase = {
            fechaRaw: ent.fechaRaw || fechaTextoHoyVentas(),
            cliente: ent.cliente || '',
            cuenta: etiquetaMetodoPagoEntrega(ent.metodoPago),
            vendedor: String(vendedor || 'OBEBE').trim() || 'OBEBE',
            redSocial: 'Entrega · ' + (ent.lugar || ''),
            link: '',
            telefono: ent.telefono || ''
        };
        var chain = Promise.resolve({ n: 0 });
        (ent.items || []).forEach(function (it) {
            var f = estado.filas.find(function (x) { return x.filaSheet === it.filaSheet; });
            if (!f) {
                f = {
                    nombre: it.nombre,
                    tipo: it.tipo,
                    talla: it.talla,
                    color: it.color,
                    segmento: it.segmento || 'Hombre',
                    precio: it.precioUnitario || 0
                };
            }
            var qty = it.cantidad || 1;
            var precioU = it.precioUnitario != null ? it.precioUnitario : (f.precio || 0);
            var j;
            for (j = 0; j < qty; j++) {
                (function (filaCopy, precio) {
                    chain = chain.then(function (acc) {
                        return crearVentaLineaManual({
                            fechaRaw: metaBase.fechaRaw,
                            nombre: filaCopy.nombre,
                            tipo: filaCopy.tipo,
                            precio: precio,
                            talla: filaCopy.talla,
                            color: filaCopy.color,
                            segmento: filaCopy.segmento,
                            cliente: metaBase.cliente,
                            vendedor: metaBase.vendedor,
                            cuenta: metaBase.cuenta,
                            redSocial: metaBase.redSocial,
                            link: metaBase.link,
                            telefono: metaBase.telefono
                        }, { ajustarStock: false }).then(function (res) {
                            if (!res || res.ok === false) {
                                throw new Error((res && res.error) || 'No se pudo registrar venta.');
                            }
                            return { n: acc.n + 1 };
                        });
                    });
                })(f, precioU);
            }
        });
        return chain.then(function (acc) {
            return sincronizarVentasParaEdicion().then(function () {
                ent.estado = 'completada';
                ent.completadaEn = Date.now();
                ent.lineasVentas = acc.n;
                ObebeEntregasStore.saveEntrega(ent);
                return { ok: true, lineas: acc.n, entrega: ent };
            });
        });
    }

    function listarEntregasAdmin(estadoFiltro) {
        if (!global.ObebeEntregasStore) return [];
        return ObebeEntregasStore.listar(estadoFiltro || null);
    }

    function listarHistoricoEntregas(limite) {
        if (!global.ObebeEntregasStore) return [];
        limite = limite || 40;
        return ObebeEntregasStore.getAll()
            .filter(function (e) {
                return e.estado === 'completada' || e.estado === 'cancelada';
            })
            .sort(function (a, b) {
                var ta = a.completadaEn || a.canceladaEn || a.creadoEn || 0;
                var tb = b.completadaEn || b.canceladaEn || b.creadoEn || 0;
                return tb - ta;
            })
            .slice(0, limite);
    }

    function filtrarVentas(ventas, query) {
        var base = (ventas || []).filter(esLineaVentaRetail);
        query = norm(query);
        if (!query) return base;
        return base.filter(function (v) {
            var blob = [
                v.nombre, v.tipo, v.talla, v.color, v.segmento, v.cliente,
                v.vendedor, v.cuenta, v.redSocial, v.link, v.telefono,
                v.fechaRaw, v.fechaIso, String(v.filaSheet || '')
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
        calcularPerfilesClientes: calcularPerfilesClientes,
        snapshotVentasCacheLocal: snapshotVentasCacheLocal,
        VENTAS_ETIQUETAS: VENTAS_ETIQUETAS,
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
        listarHistoricoInventario: listarHistoricoInventario,
        filtrarHistoricoBd: filtrarHistoricoBd,
        timestampAgotadoFila: timestampAgotadoFila,
        sincronizarHistoricoInventario: sincronizarHistoricoInventario,
        descontarStockPedidoMayoreo: descontarStockPedidoMayoreo,
        revertirStockPedidoMayoreo: revertirStockPedidoMayoreo,
        aplicarStockPendientePedidosMayoreo: aplicarStockPendientePedidosMayoreo,
        registrarVentasDesdePedidoMayoreo: registrarVentasDesdePedidoMayoreo,
        ventasNecesitanSincronizarIds: ventasNecesitanSincronizarIds,
        sincronizarVentasParaEdicion: sincronizarVentasParaEdicion,
        cargarGastos: cargarGastos,
        calcularResumenGastos: calcularResumenGastos,
        filtrarGastos: filtrarGastos,
        gastoCamposDesdeObj: gastoCamposDesdeObj,
        crearGastoOperativo: crearGastoOperativo,
        actualizarGastoOperativo: actualizarGastoOperativo,
        eliminarGastoOperativo: eliminarGastoOperativo,
        limpiarVentasNegativasEnVentas: limpiarVentasNegativasEnVentas,
        aplicarBajaStockMayoreoCollegiateHoodie: aplicarBajaStockMayoreoCollegiateHoodie,
        calcularResumen: calcularResumen,
        calcularResumenVentas: calcularResumenVentas,
        ventasPorMes: ventasPorMes,
        ventasPorSemana: ventasPorSemana,
        calcularPerfilesClientes: calcularPerfilesClientes,
        actualizarContactoCliente: actualizarContactoCliente,
        filtrarClientes: filtrarClientes,
        calcularClientesMayoreo: calcularClientesMayoreo,
        calcularResumenMayoreo: calcularResumenMayoreo,
        filtrarLineasMayoreo: filtrarLineasMayoreo,
        esClienteSoloMayoreo: esClienteSoloMayoreo,
        CLIENTE_MAYOREO_DEFAULT: CLIENTE_MAYOREO_DEFAULT,
        getEstado: function () { return estado; },
        formatoMoney: formatoMoney,
        etiquetaCuentaVentas: etiquetaCuentaVentas,
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
        errorVentasParaUi: errorVentasParaUi,
        stockDisponibleConEntregas: stockDisponibleConEntregas,
        crearEntregaProgramada: crearEntregaProgramada,
        crearEntregaTrasVenta: crearEntregaTrasVenta,
        actualizarEntregaProgramada: actualizarEntregaProgramada,
        listarHistoricoEntregas: listarHistoricoEntregas,
        completarEntregaProgramada: completarEntregaProgramada,
        cancelarEntregaProgramada: cancelarEntregaProgramada,
        listarEntregasAdmin: listarEntregasAdmin,
        etiquetaMetodoPagoEntrega: etiquetaMetodoPagoEntrega,
        registrarVentaRetail: registrarVentaRetail,
        actualizarVentaLinea: actualizarVentaLinea,
        eliminarVentaLinea: eliminarVentaLinea,
        crearVentaLineaManual: crearVentaLineaManual,
        ventaCamposDesdeObj: ventaCamposDesdeObj,
        edicionVentasHabilitada: edicionVentasHabilitada,
        actualizarStockFila: actualizarStockFila,
        apiAdminScript: apiAdminScript,
        appsScriptConfigurado: appsScriptConfigurado,
        escrituraLocalHabilitada: escrituraLocalHabilitada,
        leerPendienteSync: leerPendienteSync,
        usarSupabase: usarSupabase,
        supabaseListo: supabaseListo,
        migrarDesdeGoogleSheets: migrarDesdeGoogleSheets,
        importarSoloVentasDesdeGoogle: importarSoloVentasDesdeGoogle,
        probarConexionSupabase: probarConexionSupabase,
        fetchTextoHoja: fetchTextoHoja,
        normalizarMarca: normalizarMarca,
        urlImagenFilaInventario: urlImagenFilaInventario,
        INVENTARIO_COLS_VISTA: columnasVistaInventario().length,
        columnasVistaInventario: columnasVistaInventario,
        idxInventario: idxInventario,
        combinarEncabezadosInventario: combinarEncabezadosInventario,
        encabezadosInventarioActuales: encabezadosInventarioActuales,
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
