(function (global) {
    'use strict';

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function kpi(label, value, hint) {
        return '<div class="admin-kpi"><div class="label">' + esc(label) + '</div>' +
            '<div class="value">' + esc(String(value)) + '</div>' +
            (hint ? '<div class="hint">' + esc(hint) + '</div>' : '') + '</div>';
    }

    function fmtMoney(n) {
        return ObebeAdminData.formatoMoney(n || 0);
    }

    function norm(s) {
        return String(s || '').trim().toLowerCase();
    }

    function etiquetaMetodoPago(m) {
        var k = norm(m);
        if (k === 'efectivo') return 'Efectivo';
        if (k === 'tarjeta') return 'Tarjeta';
        if (k === 'transferencia') return 'Transferencia';
        var t = String(m || '').trim();
        return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
    }

    function imagenUrlLineaVenta(l, clienteKey, filasInv) {
        if (l.imagenUrl) return l.imagenUrl;
        if (!l.lineaId) return '';
        var store = ObebeMayoreoStore.getLineasForCliente(clienteKey);
        var hit = store.find(function (x) { return x.id === l.lineaId; });
        if (hit && hit.imagenUrl) return hit.imagenUrl;
        if (hit && ObebeAdminData.imagenParaLineaMayoreo) {
            return ObebeAdminData.imagenParaLineaMayoreo({
                nombre: hit.nombreSheet,
                talla: hit.talla,
                color: hit.color,
                tipo: hit.tipo,
                marca: hit.marca
            }, filasInv || []);
        }
        return '';
    }

    function stripFotosHistorial(venta, clienteKey, filasInv) {
        var items = venta.lineas || [];
        if (!items.length) return '';
        var thumbs = items.map(function (l) {
            var url = imagenUrlLineaVenta(l, clienteKey, filasInv);
            if (!url) {
                return '<span class="admin-venta-hist-thumb admin-mayoreo-thumb-empty" title="' + esc(l.nombre) + '"></span>';
            }
            return '<img src="' + esc(url) + '" alt="' + esc(l.nombre) + '" class="admin-venta-hist-thumb" ' +
                'loading="lazy" onerror="adminMayoreoImgFallback(this)">';
        }).join('');
        var clase = items.length > 4 ? ' admin-venta-hist-scroll--many' : '';
        return '<div class="admin-venta-hist-scroll' + clase + '" tabindex="0" aria-label="Fotos de la venta">' +
            thumbs + '</div>';
    }

    function thumbHtml(url, alt) {
        if (!url) return '<span class="admin-mayoreo-thumb-empty"></span>';
        var cls = 'admin-venta-search-thumb';
        return '<img src="' + esc(url) + '" alt="' + esc(alt || '') + '" class="' + cls + '" ' +
            'loading="lazy" onerror="adminMayoreoImgFallback(this)">';
    }

    function catalogoDisponible(clienteKey, filasInv) {
        filasInv = filasInv || [];
        return ObebeMayoreoStore.getLineasForCliente(clienteKey)
            .filter(function (l) { return l.cantidadDisponible > 0; })
            .map(function (l) {
                var row = ObebeMayoreoStore.lineaToMayoreoRow(l);
                if (!row.imagenUrl && ObebeAdminData.imagenParaLineaMayoreo) {
                    row.imagenUrl = ObebeAdminData.imagenParaLineaMayoreo({
                        nombre: l.nombreSheet,
                        talla: l.talla,
                        color: l.color,
                        tipo: l.tipo,
                        marca: l.marca
                    }, filasInv);
                }
                return row;
            });
    }

    function enPeriodoMayoreo(fechaIso, periodo) {
        if (!fechaIso) return false;
        var partes = fechaIso.split('-');
        if (partes.length !== 3) return false;
        var hoy = new Date();
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        var isoHoy = hoy.getFullYear() + '-' + pad(hoy.getMonth() + 1) + '-' + pad(hoy.getDate());
        if (periodo === 'hoy') return fechaIso === isoHoy;
        if (periodo === 'mes') {
            return parseInt(partes[0], 10) === hoy.getFullYear() &&
                parseInt(partes[1], 10) === hoy.getMonth() + 1;
        }
        if (periodo === 'semana') {
            var dow = hoy.getDay();
            var diff = dow === 0 ? 6 : dow - 1;
            var lun = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - diff);
            var dom = new Date(lun.getFullYear(), lun.getMonth(), lun.getDate() + 6);
            var fmt = function (d) {
                return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
            };
            return fechaIso >= fmt(lun) && fechaIso <= fmt(dom);
        }
        return false;
    }

    function ventasMayoreoParaGraficos(ventas) {
        return (ventas || []).map(function (v) {
            return { fechaIso: v.fechaIso, precio: v.total || 0 };
        });
    }

    function resumenUiVentasMayoreo(clienteKey) {
        var res = ObebeMayoreoStore.resumenVentas(clienteKey);
        var ventas = res.ventas || [];
        var semana = { monto: 0, count: 0 };
        var porCuentaSemana = {};
        var porCuentaMes = {};
        ventas.forEach(function (v) {
            var total = v.total || 0;
            var pago = etiquetaMetodoPago(v.metodoPago);
            if (enPeriodoMayoreo(v.fechaIso, 'semana')) {
                semana.monto += total;
                semana.count += 1;
                porCuentaSemana[pago] = (porCuentaSemana[pago] || 0) + total;
            }
            if (enPeriodoMayoreo(v.fechaIso, 'mes')) {
                porCuentaMes[pago] = (porCuentaMes[pago] || 0) + total;
            }
        });
        return {
            hoy: { monto: res.totalHoy || 0, count: res.countHoy || 0 },
            semana: semana,
            mes: { monto: res.totalMes || 0, count: res.countMes || 0 },
            porCuentaSemana: porCuentaSemana,
            porCuentaMes: porCuentaMes,
            ventas: ventas,
            chartVentas: ventasMayoreoParaGraficos(ventas),
            store: res
        };
    }

    function inferirSegmentoMayoreo(row) {
        var blob = ((row.tipo || '') + ' ' + (row.nombre || '')).toLowerCase();
        if (blob.indexOf('mujer') >= 0 || blob.indexOf('woman') >= 0) return 'Mujer';
        return 'Hombre';
    }

    function buscarFilaObebeParaMayoreo(row, filasInv) {
        var nombre = String(row.nombre || row.nombreSheet || '').trim();
        var nn = norm(nombre);
        if (!nn) return null;
        var nt = norm(row.talla);
        var nc = norm(row.color);
        var listas = [filasInv || []];
        if (global.ObebeAdminData && ObebeAdminData.getEstado) {
            var stFilas = ObebeAdminData.getEstado().filas;
            if (stFilas && stFilas.length) listas.push(stFilas);
        }
        var li, i, f;
        for (li = 0; li < listas.length; li++) {
            for (i = 0; i < listas[li].length; i++) {
                f = listas[li][i];
                if (!f) continue;
                if (norm(f.nombre) !== nn) continue;
                if (nt && norm(f.talla) !== nt) continue;
                if (nc && norm(f.color) !== nc) continue;
                return f;
            }
        }
        return null;
    }

    /** Margen % = (precio retail ref. − costo bruto) / precio retail ref. × 100 */
    function margenRegla3(costoBruto, precioRetailRef) {
        var c = parseFloat(String(costoBruto).replace(/[^\d.-]/g, '')) || 0;
        var r = parseFloat(String(precioRetailRef).replace(/[^\d.-]/g, '')) || 0;
        if (r <= 0 || c < 0) return '';
        var pct = (1 - c / r) * 100;
        if (!isFinite(pct)) return '';
        return String(Math.round(pct * 100) / 100);
    }

    function formatoCeldaPrecioInv(n) {
        n = parseFloat(n);
        if (!n || isNaN(n) || n <= 0) return '';
        return String(Math.round(n * 100) / 100);
    }

    function filasInventarioDesdeMayoreoCliente(clienteKey, filasInv) {
        var numCols = ObebeAdminData.INVENTARIO_NUM_COLS || 25;
        var idx = ObebeAdminData.idxInventario ? ObebeAdminData.idxInventario() : {};
        var iNom = idx.nombre != null ? idx.nombre : 1;
        var iImg = idx.imagen != null ? idx.imagen : 0;
        var iStock = idx.stock != null ? idx.stock : 2;
        var iTalla = idx.talla != null ? idx.talla : 3;
        var iColor = idx.color != null ? idx.color : 4;
        var iTipo = idx.tipo != null ? idx.tipo : 5;
        var iMarca = idx.marca != null ? idx.marca : 6;
        var iPrecio = idx.precio != null ? idx.precio : 7;
        var iTotal = idx.total != null ? idx.total : 8;
        var iFoto = idx.foto != null ? idx.foto : 9;
        var iCostoBruto = idx.costoBruto != null ? idx.costoBruto : 11;
        var iCostoNeto = idx.costoNeto != null ? idx.costoNeto : 12;
        var iMargen = idx.margen != null ? idx.margen : 14;
        var iGenero = idx.segmento != null ? idx.segmento : 19;
        return ObebeMayoreoStore.getLineasForCliente(clienteKey).map(function (l, index) {
            var row = ObebeMayoreoStore.lineaToMayoreoRow(l);
            var stock = l.cantidadDisponible != null ? l.cantidadDisponible : (l.cantidad || 0);
            var costoBruto = l.precioMayoreo != null ? l.precioMayoreo : (row.precioMayoreo || 0);
            var hitObebe = buscarFilaObebeParaMayoreo(row, filasInv);
            var costoNeto = row.precioRetail || 0;
            if (!costoNeto && hitObebe) {
                costoNeto = hitObebe.precio || (hitObebe.celdas && idx.precio != null
                    ? parseFloat(String(hitObebe.celdas[idx.precio] || '').replace(/[^\d.-]/g, '')) || 0
                    : 0);
            }
            var precioRetailNaty = 0;
            var ref = ObebeAdminData.refParaArticulo
                ? (ObebeAdminData.refParaArticulo(row) || 0)
                : 0;
            if (!ref && hitObebe && hitObebe.ref) ref = hitObebe.ref;
            if (!ref) ref = parseInt(String(l.filaSheet || '0'), 10) || 0;
            var img = row.imagenUrl;
            if (!img && ObebeAdminData.imagenParaLineaMayoreo) {
                img = ObebeAdminData.imagenParaLineaMayoreo({
                    nombre: row.nombreSheet || row.nombre,
                    talla: row.talla,
                    color: row.color,
                    tipo: row.tipo,
                    marca: row.marca
                }, filasInv || []);
            }
            var segmento = '';
            if (hitObebe && hitObebe.segmento) {
                segmento = hitObebe.segmento;
            } else {
                segmento = inferirSegmentoMayoreo(row);
            }
            var valorLinea = 0;
            var refMargen = costoNeto;
            var margen = margenRegla3(costoBruto, refMargen);
            var celdas = [];
            var c;
            for (c = 0; c < numCols; c++) celdas.push('');
            celdas[iImg] = ref ? String(ref) : '';
            celdas[iNom] = row.nombre || '';
            celdas[iStock] = String(stock);
            celdas[iTalla] = row.talla || '';
            celdas[iColor] = row.color || '';
            celdas[iTipo] = row.tipo || '';
            celdas[iMarca] = row.marca || '';
            celdas[iPrecio] = '';
            celdas[iTotal] = valorLinea > 0 ? String(valorLinea) : '';
            celdas[iCostoBruto] = formatoCeldaPrecioInv(costoBruto);
            celdas[iCostoNeto] = formatoCeldaPrecioInv(costoNeto);
            celdas[iMargen] = margen;
            celdas[iGenero] = segmento ? String(segmento).toUpperCase() : '';
            if (img) celdas[iFoto] = img;
            return {
                ref: ref,
                nombre: row.nombre || '',
                stock: stock,
                talla: row.talla || '',
                color: row.color || '',
                tipo: row.tipo || '',
                marca: row.marca || '',
                precio: precioRetailNaty,
                valorLinea: valorLinea,
                segmento: segmento,
                ubicacion: '',
                fotoUrl: img || '',
                filaSheet: index + 2,
                celdas: celdas,
                _localId: 'mayoreo-' + l.id,
                mayoreoLineaId: l.id
            };
        });
    }

    var COLS_INV_OCULTAS_MAYOREO = [10, 13, 15, 16, 17, 18, 20, 21, 22, 23, 24];

    function idLineaVentaMayoreo(ventaId, lineaIdx, subIdx) {
        var s = String(ventaId || '') + ':' + lineaIdx + ':' + (subIdx || 0);
        var h = 0;
        var i;
        for (i = 0; i < s.length; i++) {
            h = ((h << 5) - h) + s.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h) || (lineaIdx + 2);
    }

    function etiquetaMetodoPagoMayoreo(mp) {
        var k = ObebeMayoreoStore.normalizarMetodoPago
            ? ObebeMayoreoStore.normalizarMetodoPago(mp)
            : String(mp || '').trim().toLowerCase();
        if (k === 'tarjeta') return 'Tarjeta crédito';
        if (k === 'transferencia') return 'Transferencia';
        return 'Efectivo';
    }

    function metodoPagoDesdeEtiquetaMayoreo(cuenta) {
        if (ObebeMayoreoStore.normalizarMetodoPago) {
            return ObebeMayoreoStore.normalizarMetodoPago(cuenta);
        }
        var n = String(cuenta || '').trim().toLowerCase();
        if (n.indexOf('tarjeta') >= 0) return 'tarjeta';
        if (n.indexOf('transfer') >= 0) return 'transferencia';
        return 'efectivo';
    }

    function guardarEdicionVentaMayoreoRetail(clienteKey, ventaObj, campos) {
        campos = campos || {};
        var ventaId = ventaObj && ventaObj.mayoreoVentaId;
        var li = ventaObj && ventaObj.mayoreoLineaIdx;
        if (!ventaId || li == null) return Promise.resolve({ ok: false, error: 'No se encontró la venta en inventario mayoreo.' });
        var patchVenta = {};
        if (campos.cliente) patchVenta.comprador = campos.cliente;
        var fechaTxt = String(campos.fechaRaw || '').trim();
        if (fechaTxt) {
            var dmy = fechaTxt.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            if (dmy) {
                var anio = parseInt(dmy[3], 10);
                if (anio < 100) anio += 2000;
                var mes = ('0' + parseInt(dmy[2], 10)).slice(-2);
                var dia = ('0' + parseInt(dmy[1], 10)).slice(-2);
                patchVenta.fechaIso = anio + '-' + mes + '-' + dia;
            }
        }
        if (campos.cuenta) patchVenta.metodoPago = metodoPagoDesdeEtiquetaMayoreo(campos.cuenta);
        var r1 = ObebeMayoreoStore.actualizarVenta(ventaId, clienteKey, patchVenta);
        if (!r1.ok) return Promise.resolve(r1);
        var r2 = ObebeMayoreoStore.actualizarLineaEnVenta(ventaId, clienteKey, li, {
            nombre: campos.nombre,
            precio: campos.precio
        });
        if (!r2.ok) return Promise.resolve(r2);
        if (campos.cliente && ObebeMayoreoStore.actualizarContactoComprador && ventaObj.cliente) {
            ObebeMayoreoStore.actualizarContactoComprador(
                clienteKey,
                'nom:' + String(ventaObj.cliente || '').trim().toLowerCase(),
                {
                    nombre: campos.cliente,
                    telefono: campos.telefono || '',
                    link: campos.link || '',
                    redPrincipal: campos.redSocial || ''
                }
            );
        }
        return Promise.resolve({ ok: true });
    }

    function eliminarLineaVentaMayoreoRetail(clienteKey, ventaObj) {
        if (!ventaObj || !ventaObj.mayoreoVentaId) {
            return Promise.resolve({ ok: false, error: 'Venta no encontrada.' });
        }
        return Promise.resolve(
            ObebeMayoreoStore.eliminarLineaDeVenta(
                ventaObj.mayoreoVentaId,
                clienteKey,
                ventaObj.mayoreoLineaIdx
            )
        );
    }

    function ventasMayoreoLineasRetail(clienteKey) {
        var ventas = ventasOrdenRecientesMayoreo(ObebeMayoreoStore.resumenVentas(clienteKey).ventas || []);
        var out = [];
        ventas.forEach(function (v) {
            var meta = ObebeMayoreoStore.metaComprador
                ? ObebeMayoreoStore.metaComprador(clienteKey, v.comprador)
                : {};
            var cuentaLbl = etiquetaMetodoPagoMayoreo(v.metodoPago);
            var fechaRaw = (global.ObebeAdminData && ObebeAdminData.formatoFecha)
                ? ObebeAdminData.formatoFecha(v.fechaIso, '')
                : '';
            (v.lineas || []).forEach(function (l, li) {
                var qty = l.cantidad || 1;
                var unit = l.precioUnitario || 0;
                var sub = l.subtotal != null ? l.subtotal : unit * qty;
                out.push({
                    filaSheet: idLineaVentaMayoreo(v.id, li, 0),
                    fechaIso: v.fechaIso,
                    fechaRaw: fechaRaw,
                    nombre: l.nombre || '',
                    tipo: '',
                    precio: sub,
                    talla: '',
                    color: '',
                    segmento: 'Hombre',
                    cliente: v.comprador || '',
                    vendedor: 'NATY',
                    cuenta: cuentaLbl,
                    telefono: meta.telefono || '',
                    redSocial: meta.redPrincipal || '',
                    link: meta.link || '',
                    imagenUrl: l.imagenUrl || '',
                    mayoreoVentaId: v.id,
                    mayoreoLineaIdx: li,
                    mayoreoLineaId: l.lineaId || ''
                });
            });
        });
        return out;
    }

    function clientesPerfilDesdeMayoreo(clienteKey) {
        return ObebeMayoreoStore.calcularRankingClientes(clienteKey).map(function (c) {
            var meta = ObebeMayoreoStore.metaComprador
                ? ObebeMayoreoStore.metaComprador(clienteKey, c.nombre)
                : {};
            return {
                id: c.id,
                nombre: c.nombre,
                telefono: meta.telefono || '',
                link: meta.link || '',
                redPrincipal: meta.redPrincipal || '',
                articulos: c.articulos,
                gasto: c.gasto,
                ranking: c.ranking,
                tipoPrincipal: meta.tipoPrincipal || '—',
                ultimaCompraIso: c.ultimaCompraIso,
                ultimaCompraRaw: ''
            };
        });
    }

    function lineasVentasMayoreoParaResumen(clienteKey) {
        var ventas = ObebeMayoreoStore.resumenVentas(clienteKey).ventas || [];
        var out = [];
        ventas.forEach(function (v) {
            (v.lineas || []).forEach(function (l) {
                var precio = (l.precioUnitario || 0) * (l.cantidad || 1);
                if (precio <= 0) return;
                out.push({ fechaIso: v.fechaIso, precio: precio });
            });
        });
        return out;
    }

    function imagenUrlParaLineaMayoreo(l, row, filasInv) {
        var hit = buscarFilaObebeParaMayoreo(row, filasInv);
        var ref = ObebeAdminData.refParaArticulo
            ? (ObebeAdminData.refParaArticulo(row) || 0)
            : 0;
        if (!ref && hit && hit.ref) ref = hit.ref;
        var seg = hit && hit.segmento ? hit.segmento : inferirSegmentoMayoreo(row);
        var rawImg = l.imagenUrl || row.imagenUrl || (hit && hit.fotoUrl) || '';
        if (rawImg && ObebeAdminData.normalizarRutaImagenAdmin) {
            rawImg = ObebeAdminData.normalizarRutaImagenAdmin(rawImg) || rawImg;
        }
        var filaLike = {
            ref: ref,
            nombre: row.nombre,
            talla: row.talla,
            color: row.color,
            marca: row.marca,
            tipo: row.tipo,
            segmento: seg,
            fotoUrl: rawImg,
            celdas: hit && hit.celdas ? hit.celdas.slice() : []
        };
        var u = ObebeAdminData.urlImagenFilaInventario
            ? ObebeAdminData.urlImagenFilaInventario(filaLike)
            : '';
        if (u) return u;
        if (ObebeAdminData.imagenParaLineaMayoreo) {
            return ObebeAdminData.imagenParaLineaMayoreo({
                nombre: row.nombreSheet || row.nombre,
                talla: row.talla,
                color: row.color,
                tipo: row.tipo,
                marca: row.marca
            }, filasInv || []) || rawImg || '';
        }
        return rawImg || '';
    }

    function filasRetailDesdeInventarioMayoreo(clienteKey, filasInv) {
        return ObebeMayoreoStore.getLineasForCliente(clienteKey)
            .filter(function (l) { return (l.cantidadDisponible || 0) > 0; })
            .map(function (l) {
                var row = ObebeMayoreoStore.lineaToMayoreoRow(l);
                var hit = buscarFilaObebeParaMayoreo(row, filasInv);
                var ref = ObebeAdminData.refParaArticulo
                    ? (ObebeAdminData.refParaArticulo(row) || 0)
                    : 0;
                if (!ref && hit && hit.ref) ref = hit.ref;
                var img = imagenUrlParaLineaMayoreo(l, row, filasInv);
                var seg = hit && hit.segmento ? hit.segmento : inferirSegmentoMayoreo(row);
                var precioVenta = l.precioVentaPlaneado > 0
                    ? l.precioVentaPlaneado
                    : (row.precioVentaPlaneado > 0 ? row.precioVentaPlaneado : (row.precioRetail || 0));
                return {
                    ref: ref,
                    nombre: row.nombre,
                    talla: row.talla,
                    color: row.color,
                    marca: row.marca,
                    tipo: row.tipo,
                    stock: l.cantidadDisponible,
                    precio: precioVenta,
                    segmento: seg,
                    fotoUrl: img,
                    imagenUrl: img,
                    mayoreoLineaId: l.id
                };
            });
    }

    function clientesRetailDesdeRanking(clienteKey) {
        return ObebeMayoreoStore.calcularRankingClientes(clienteKey).map(function (c) {
            var meta = ObebeMayoreoStore.metaComprador
                ? ObebeMayoreoStore.metaComprador(clienteKey, c.nombre)
                : {};
            return {
                id: c.id || c.nombre,
                nombre: c.nombre,
                telefono: meta.telefono || '',
                redPrincipal: meta.redPrincipal || '',
                link: meta.link || ''
            };
        });
    }

    function filtrarVentasMayoreo(ventas, q) {
        q = norm(q);
        if (!q) return ventas || [];
        return (ventas || []).filter(function (v) {
            var blob = [
                v.comprador,
                v.metodoPago,
                v.fechaIso,
                (v.lineas || []).map(function (l) { return l.nombre; }).join(' ')
            ].join(' ').toLowerCase();
            return blob.indexOf(q) >= 0;
        });
    }

    function ventasOrdenRecientesMayoreo(list) {
        return (list || []).slice().sort(function (a, b) {
            var ia = String(a.fechaIso || '');
            var ib = String(b.fechaIso || '');
            if (ia !== ib) return ia > ib ? -1 : 1;
            return String(b.id || '').localeCompare(String(a.id || ''));
        });
    }

    function panelUltimasVentas(ventas, clienteKey, filasInv, limite) {
        limite = limite || 5;
        var slice = ventasOrdenRecientesMayoreo(ventas).slice(0, limite);
        return panelHistorial(slice, clienteKey, filasInv, 'Últimas ' + limite + ' ventas', false);
    }

    function mountUltimasVentas(container, opts) {
        opts = opts || {};
        var clienteKey = opts.clienteKey || 'naty';
        var res = ObebeMayoreoStore.resumenVentas(clienteKey);
        container.innerHTML = panelUltimasVentas(res.ventas, clienteKey, opts.filasInv, opts.limite || 5);
        bindHistorialVentas(container, opts);
    }

    function bindHistorialVentas(container, opts) {
        opts = opts || {};
        var clienteKey = opts.clienteKey || 'naty';
        container.addEventListener('click', function (ev) {
            var lapiz = ev.target.closest('.admin-venta-hist-lapiz');
            if (lapiz) {
                abrirEdicionHistorialCampo(lapiz.getAttribute('data-venta-id'), lapiz.getAttribute('data-field'));
                return;
            }
            var cancelar = ev.target.closest('.admin-venta-hist-cancel-field');
            if (cancelar) {
                var rowCancel = container.querySelector('tr.admin-venta-hist-row[data-venta-id="' + cancelar.getAttribute('data-venta-id') + '"]');
                restaurarFilaHistorial(rowCancel);
                return;
            }
            var guardar = ev.target.closest('.admin-venta-hist-save-field');
            if (guardar) {
                var vid = guardar.getAttribute('data-venta-id');
                var datos = leerFilaHistorial(vid);
                if (!datos) return;
                var upd = ObebeMayoreoStore.actualizarVenta(vid, clienteKey, datos);
                if (!upd.ok) {
                    ObebeAdminDialog.alert({ title: 'No se pudo guardar', message: upd.error });
                    return;
                }
                if (opts.onVentaGuardada) opts.onVentaGuardada();
                if (opts.onRepintar) opts.onRepintar();
                return;
            }
            var del = ev.target.closest('.admin-venta-borrar');
            if (del) {
                var ventaIdDel = del.getAttribute('data-venta-id');
                ObebeAdminDialog.confirm({
                    title: 'Eliminar venta',
                    message: 'Esta acción no se puede deshacer. Los artículos volverán al stock disponible.',
                    confirmText: 'Eliminar',
                    cancelText: 'Cancelar',
                    variant: 'danger'
                }).then(function (ok) {
                    if (!ok) return;
                    var delRes = ObebeMayoreoStore.eliminarVenta(ventaIdDel, clienteKey);
                    if (!delRes.ok) {
                        ObebeAdminDialog.alert({ title: 'No se pudo eliminar', message: delRes.error });
                        return;
                    }
                    if (opts.onVentaGuardada) opts.onVentaGuardada();
                    if (opts.onRepintar) opts.onRepintar();
                });
            }
        });
    }

    function mountModuloVentas(container, opts) {
        opts = opts || {};
        var clienteKey = opts.clienteKey || 'naty';
        var ui = resumenUiVentasMayoreo(clienteKey);
        var cuentasSemHtml = ObebeAdminData.topEntries(ui.porCuentaSemana, 8).map(function (x) {
            return '<tr><td>' + esc(x.key) + '</td><td>' + fmtMoney(x.val) + '</td></tr>';
        }).join('');
        var cuentasMesHtml = ObebeAdminData.topEntries(ui.porCuentaMes, 8).map(function (x) {
            return '<tr><td>' + esc(x.key) + '</td><td>' + fmtMoney(x.val) + '</td></tr>';
        }).join('');
        var chartMes = opts.graficoMes
            ? opts.graficoMes(ui.chartVentas)
            : '';
        var chartSem = opts.graficoSemana
            ? opts.graficoSemana(ui.chartVentas)
            : '';

        function repintarTabla() {
            var q = (document.getElementById('adminVentaMayoreoBuscar') || {}).value || '';
            var ventas = ObebeMayoreoStore.resumenVentas(clienteKey).ventas || [];
            var filtradas = filtrarVentasMayoreo(ventas, q);
            var box = document.getElementById('adminVentaMayoreoTabla');
            if (box) {
                box.innerHTML = panelHistorial(filtradas, clienteKey, opts.filasInv, 'Registro', true, true);
            }
        }

        container.innerHTML =
            '<div class="admin-kpi-grid admin-kpi-grid--ventas-focus">' +
            kpi('Hoy', fmtMoney(ui.hoy.monto), ui.hoy.count + ' venta(s)') +
            kpi('Semana', fmtMoney(ui.semana.monto), ui.semana.count + ' venta(s)') +
            kpi('Mes actual', fmtMoney(ui.mes.monto), ui.mes.count + ' venta(s)') +
            '</div>' +
            chartMes +
            '<div class="admin-ventas-cuentas-grid">' +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Por forma de pago (semana)</h3></div>' +
            '<div class="admin-table-wrap"><table class="admin-table admin-table-compact"><thead><tr><th>Pago</th><th>Total</th></tr></thead><tbody>' +
            (cuentasSemHtml || '<tr><td colspan="2">Sin datos</td></tr>') + '</tbody></table></div></div>' +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Por forma de pago (mes)</h3></div>' +
            '<div class="admin-table-wrap"><table class="admin-table admin-table-compact"><thead><tr><th>Pago</th><th>Total</th></tr></thead><tbody>' +
            (cuentasMesHtml || '<tr><td colspan="2">Sin datos</td></tr>') + '</tbody></table></div></div></div>' +
            chartSem +
            '<div class="admin-panel"><div class="admin-panel-head admin-panel-head--ventas-reg">' +
            '<h3>Registro de ventas</h3>' +
            '<div class="admin-panel-head-actions">' +
            '<input type="search" class="admin-search" id="adminVentaMayoreoBuscar" placeholder="Buscar comprador, artículo…">' +
            '</div></div>' +
            '<div id="adminVentaMayoreoTabla"></div>';

        repintarTabla();
        bindHistorialVentas(container, {
            clienteKey: clienteKey,
            onVentaGuardada: opts.onVentaGuardada,
            onRepintar: function () {
                ui = resumenUiVentasMayoreo(clienteKey);
                repintarTabla();
            }
        });
        var buscar = document.getElementById('adminVentaMayoreoBuscar');
        if (buscar) buscar.addEventListener('input', repintarTabla);
    }

    function mount(container, opts) {
        mountModuloVentas(container, opts);
    }

    function panelReporte(res) {
        var dias = Object.keys(res.porDia || {}).sort().reverse().slice(0, 14);
        var rowsD = dias.map(function (d) {
            var p = d.split('-');
            var label = p[2] + '/' + p[1] + '/' + p[0];
            return '<tr><td>' + esc(label) + '</td><td>' + fmtMoney(res.porDia[d]) + '</td></tr>';
        }).join('');
        var meses = Object.keys(res.porMes || {}).sort().reverse().slice(0, 6);
        var rowsM = meses.map(function (m) {
            return '<tr><td>' + esc(m) + '</td><td>' + fmtMoney(res.porMes[m]) + '</td></tr>';
        }).join('');
        return '<div class="admin-two-col" style="margin-top:1rem">' +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Por día</h3></div>' +
            '<div class="admin-table-wrap"><table class="admin-table admin-table-compact"><thead><tr><th>Fecha</th><th>Total</th></tr></thead><tbody>' +
            (rowsD || '<tr><td colspan="2">Sin ventas</td></tr>') + '</tbody></table></div></div>' +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Por mes</h3></div>' +
            '<div class="admin-table-wrap"><table class="admin-table admin-table-compact"><thead><tr><th>Mes</th><th>Total</th></tr></thead><tbody>' +
            (rowsM || '<tr><td colspan="2">Sin ventas</td></tr>') + '</tbody></table></div></div></div>';
    }

    function selectPagoHistorial(val, ventaId, disabled) {
        var v = norm(val);
        function opt(k) {
            return '<option value="' + k + '"' + (v === k ? ' selected' : '') + '>' + etiquetaMetodoPago(k) + '</option>';
        }
        var dis = disabled !== false ? ' disabled' : '';
        return '<div class="admin-venta-select-wrap admin-venta-select-wrap--compact">' +
            '<select class="admin-venta-pago-select admin-venta-hist-pago" data-venta-id="' + esc(ventaId) + '"' + dis + '>' +
            opt('efectivo') + opt('tarjeta') + opt('transferencia') +
            '</select></div>';
    }

    function fechaHistorialDisplay(iso) {
        if (!iso) return '—';
        var p = String(iso).split('-');
        if (p.length !== 3) return esc(iso);
        return esc(p[2] + '/' + p[1] + '/' + p[0]);
    }

    function celdaHistorialEditable(ventaId, field, viewHtml, editHtml) {
        return '<td class="admin-venta-hist-editable" data-field="' + field + '">' +
            '<div class="admin-venta-hist-view-wrap">' +
            '<span class="admin-venta-hist-view">' + viewHtml + '</span>' +
            '<button type="button" class="admin-venta-hist-lapiz" data-venta-id="' + esc(ventaId) + '" data-field="' + field + '" ' +
            'title="Editar" aria-label="Editar ' + field + '">&#9998;</button></div>' +
            '<div class="admin-venta-hist-edit-wrap admin-hidden">' + editHtml +
            '<div class="admin-venta-hist-edit-actions">' +
            '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact admin-venta-hist-save-field" data-venta-id="' + esc(ventaId) + '">Guardar</button>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-venta-hist-cancel-field" data-venta-id="' + esc(ventaId) + '" data-field="' + field + '">Cancelar</button>' +
            '</div></div></td>';
    }

    function panelHistorial(ventas, clienteKey, filasInv, titulo, sinLimite, soloTabla) {
        titulo = titulo || 'Historial';
        var lista = sinLimite ? (ventas || []) : (ventas || []).slice(0, 50);
        var rows = lista.map(function (v) {
            var arts = (v.lineas || []).map(function (l) {
                return esc(l.nombre) + ' ×' + l.cantidad + ' (' + fmtMoney(l.subtotal) + ')';
            }).join('<br>');
            var fotos = stripFotosHistorial(v, clienteKey, filasInv);
            var fechaVal = esc(v.fechaIso || '');
            var compradorVal = esc(v.comprador || '');
            var pagoView = esc(etiquetaMetodoPago(v.metodoPago));
            return '<tr data-venta-id="' + esc(v.id) + '" class="admin-venta-hist-row" ' +
                'data-fecha-orig="' + fechaVal + '" data-comprador-orig="' + compradorVal + '" data-pago-orig="' + esc(norm(v.metodoPago) || 'efectivo') + '">' +
                celdaHistorialEditable(v.id, 'fecha', fechaHistorialDisplay(v.fechaIso),
                    '<input type="date" class="admin-venta-hist-input admin-venta-hist-fecha" value="' + fechaVal + '" disabled>') +
                celdaHistorialEditable(v.id, 'comprador', esc(v.comprador || '—'),
                    '<input type="text" class="admin-venta-hist-input admin-venta-hist-comprador" value="' + compradorVal + '" disabled>') +
                celdaHistorialEditable(v.id, 'pago', pagoView, selectPagoHistorial(v.metodoPago, v.id, true)) +
                '<td>' + fmtMoney(v.total) + '</td>' +
                '<td class="admin-venta-hist-detalle">' + arts + '</td>' +
                '<td class="admin-venta-hist-fotos-cell">' + fotos + '</td>' +
                '<td class="admin-venta-hist-actions">' +
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-venta-borrar" data-venta-id="' + esc(v.id) + '">Eliminar</button></td></tr>';
        }).join('');
        var hint = sinLimite && !soloTabla
            ? '<p class="admin-muted-text" style="padding:0 1rem 0.5rem;margin:0;font-size:0.8rem">' +
            'Pulsa el lápiz en <strong>fecha</strong>, <strong>comprador</strong> o <strong>pago</strong> para editar; luego <strong>Guardar</strong> o <strong>Cancelar</strong>.</p>'
            : '';
        var tabla = '<div class="admin-table-wrap"><table class="admin-table admin-table-compact admin-venta-hist-table"><thead><tr>' +
            '<th>Fecha</th><th>Comprador</th><th>Pago</th><th>Total</th><th>Detalle</th><th>Fotos</th><th></th></tr></thead><tbody>' +
            (rows || '<tr><td colspan="7">Sin registros</td></tr>') + '</tbody></table></div>';
        if (soloTabla) return hint + tabla;
        return '<div class="admin-panel' + (titulo.indexOf('Últimas') === 0 ? ' admin-panel-ventas-ultimas' : '') + '" style="margin-top:1rem">' +
            '<div class="admin-panel-head"><h3>' + esc(titulo) + '</h3></div>' + hint + tabla + '</div>';
    }

    function restaurarFilaHistorial(row) {
        if (!row) return;
        var fecha = row.getAttribute('data-fecha-orig') || '';
        var comprador = row.getAttribute('data-comprador-orig') || '';
        var pago = row.getAttribute('data-pago-orig') || 'efectivo';
        var fechaIn = row.querySelector('.admin-venta-hist-fecha');
        var compIn = row.querySelector('.admin-venta-hist-comprador');
        var pagoIn = row.querySelector('.admin-venta-hist-pago');
        if (fechaIn) fechaIn.value = fecha;
        if (compIn) compIn.value = comprador;
        if (pagoIn) pagoIn.value = pago;
        row.querySelectorAll('.admin-venta-hist-editable').forEach(function (cell) {
            cell.querySelector('.admin-venta-hist-view-wrap').classList.remove('admin-hidden');
            cell.querySelector('.admin-venta-hist-edit-wrap').classList.add('admin-hidden');
            var ctrl = cell.querySelector('input, select');
            if (ctrl) ctrl.disabled = true;
        });
        row.classList.remove('admin-venta-hist-editing');
    }

    function cerrarEdicionHistorial(exceptRow) {
        document.querySelectorAll('tr.admin-venta-hist-editing').forEach(function (tr) {
            if (exceptRow && tr === exceptRow) return;
            restaurarFilaHistorial(tr);
        });
    }

    function abrirEdicionHistorialCampo(ventaId, field) {
        var row = document.querySelector('tr.admin-venta-hist-row[data-venta-id="' + ventaId + '"]');
        if (!row) return;
        cerrarEdicionHistorial(row);
        var cell = row.querySelector('.admin-venta-hist-editable[data-field="' + field + '"]');
        if (!cell) return;
        cell.querySelector('.admin-venta-hist-view-wrap').classList.add('admin-hidden');
        cell.querySelector('.admin-venta-hist-edit-wrap').classList.remove('admin-hidden');
        var ctrl = cell.querySelector('input, select');
        if (ctrl) {
            ctrl.disabled = false;
            ctrl.focus();
        }
        row.classList.add('admin-venta-hist-editing');
    }

    function leerFilaHistorial(ventaId) {
        var row = document.querySelector('tr.admin-venta-hist-row[data-venta-id="' + ventaId + '"]');
        if (!row) return null;
        var fecha = row.querySelector('.admin-venta-hist-fecha');
        var comprador = row.querySelector('.admin-venta-hist-comprador');
        var pago = row.querySelector('.admin-venta-hist-pago');
        return {
            fechaIso: fecha ? fecha.value : '',
            comprador: comprador ? comprador.value : '',
            metodoPago: pago ? pago.value : 'efectivo'
        };
    }

    global.ObebeAdminMayoreoVentas = {
        mount: mount,
        mountModuloVentas: mountModuloVentas,
        mountUltimasVentas: mountUltimasVentas,
        resumenUiVentasMayoreo: resumenUiVentasMayoreo,
        filasRetailDesdeInventarioMayoreo: filasRetailDesdeInventarioMayoreo,
        filasInventarioDesdeMayoreoCliente: filasInventarioDesdeMayoreoCliente,
        COLS_INV_OCULTAS_MAYOREO: COLS_INV_OCULTAS_MAYOREO,
        margenRegla3: margenRegla3,
        buscarFilaObebeParaMayoreo: buscarFilaObebeParaMayoreo,
        ventasMayoreoLineasRetail: ventasMayoreoLineasRetail,
        guardarEdicionVentaMayoreoRetail: guardarEdicionVentaMayoreoRetail,
        eliminarLineaVentaMayoreoRetail: eliminarLineaVentaMayoreoRetail,
        etiquetaMetodoPagoMayoreo: etiquetaMetodoPagoMayoreo,
        clientesPerfilDesdeMayoreo: clientesPerfilDesdeMayoreo,
        lineasVentasMayoreoParaResumen: lineasVentasMayoreoParaResumen,
        clientesRetailDesdeRanking: clientesRetailDesdeRanking,
        ventasMayoreoParaGraficos: ventasMayoreoParaGraficos
    };
})(window);
