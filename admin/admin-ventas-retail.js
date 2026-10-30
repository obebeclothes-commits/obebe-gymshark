(function (global) {
    'use strict';

    var MAX_CATALOGO = 400;
    var ORDEN_TALLAS = ['S', 'M', 'L', 'XL', 'UNI'];
    var EQUIPO = ['Ugo', 'Daniel', 'Fer'];

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function norm(s) {
        return String(s || '').trim().toLowerCase();
    }

    function fmt(n) {
        return ObebeAdminData.formatoMoney(n || 0);
    }

    function tallaBase(talla) {
        if (!talla) return '';
        var u = String(talla).toUpperCase();
        if (u.indexOf('XL') >= 0) return 'XL';
        if (u.indexOf('L') >= 0) return 'L';
        if (u.indexOf('M') >= 0) return 'M';
        if (u.indexOf('S') >= 0) return 'S';
        return String(talla).trim();
    }

    function claveTipoFiltro(tipo) {
        var t = String(tipo || '').trim().toLowerCase();
        if (t === 'sports bra' || t === 'sport bra') return 'sport-bra';
        if (t === 'short' || t === 'shorts') return 'short';
        return t.replace(/\s+/g, ' ');
    }

    function tipoCoincideFiltro(tipoProducto, tipoFiltro) {
        if (!tipoFiltro) return true;
        return claveTipoFiltro(tipoProducto) === claveTipoFiltro(tipoFiltro);
    }

    function tipoFila(r) {
        return (r.tipo || '').trim();
    }

    function ordenarTallas(tallas) {
        return (tallas || []).slice().sort(function (a, b) {
            var ia = ORDEN_TALLAS.indexOf(a);
            var ib = ORDEN_TALLAS.indexOf(b);
            if (ia >= 0 && ib >= 0) return ia - ib;
            if (ia >= 0) return -1;
            if (ib >= 0) return 1;
            var na = parseFloat(a);
            var nb = parseFloat(b);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return String(a).localeCompare(String(b), 'es');
        });
    }

    function uniqSorted(arr, sorter) {
        var set = {};
        (arr || []).forEach(function (v) {
            v = String(v || '').trim();
            if (v) set[v] = true;
        });
        var list = Object.keys(set);
        return sorter ? sorter(list) : list.sort(function (a, b) { return a.localeCompare(b, 'es'); });
    }

    function marcaCanon(s) {
        return ObebeAdminData.normalizarMarca ? ObebeAdminData.normalizarMarca(s) : String(s || '').trim();
    }

    function marcaCoincide(a, b) {
        return norm(marcaCanon(a)) === norm(marcaCanon(b));
    }

    function marcasUnicas(list) {
        var byNorm = {};
        (list || []).forEach(function (r) {
            var c = marcaCanon(r.marca);
            if (!c) return;
            byNorm[norm(c)] = c;
        });
        return Object.keys(byNorm).map(function (k) { return byNorm[k]; })
            .sort(function (a, b) { return a.localeCompare(b, 'es'); });
    }

    function catalogoConStock(filas) {
        return (filas || []).filter(function (r) { return (r.stock || 0) > 0; });
    }

    function selectEquipo(id, label) {
        var opts = '<option value="">— Elegir —</option>' +
            EQUIPO.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
        return '<div class="admin-field"><label>' + esc(label) + '</label>' +
            '<select id="' + id + '" class="admin-venta-pago-select">' + opts + '</select></div>';
    }

    function mount(container, opts) {
        opts = opts || {};
        var filasInv = catalogoConStock(opts.filas || []);
        var clientes = (opts.clientes || []).slice().sort(function (a, b) {
            return String(a.nombre).localeCompare(String(b.nombre), 'es');
        });
        var carrito = [];
        var tipoCliente = 'existente';
        var generoCatalogo = 'todos';
        var clienteSeleccionadoId = '';
        var descuentoManual = false;
        var descuentoManualPct = '';

        function piezasCarrito() {
            return carrito.reduce(function (s, c) { return s + (c.cantidad || 1); }, 0);
        }

        function pctDescuentoAuto(piezas) {
            if (piezas >= 10) return 8;
            if (piezas >= 5) return 5;
            return 0;
        }

        function pctDescuentoEfectivo() {
            if (descuentoManual) {
                var p = parseFloat(String(descuentoManualPct).replace(',', '.'));
                if (isNaN(p) || p <= 0) return 0;
                return Math.min(100, p);
            }
            return pctDescuentoAuto(piezasCarrito());
        }

        function leerEstadoDescuentoUi() {
            var chk = document.getElementById('adminVentaRetailDescManual');
            var inp = document.getElementById('adminVentaRetailDescPct');
            if (chk) descuentoManual = !!chk.checked;
            if (inp) descuentoManualPct = inp.value;
        }

        function subtotalCarrito() {
            return carrito.reduce(function (s, c) {
                return s + (c.precioUnitario || 0) * (c.cantidad || 1);
            }, 0);
        }

        function carritoParaVenta() {
            var pct = pctDescuentoEfectivo();
            if (pct <= 0) return carrito;
            var factor = 1 - pct / 100;
            return carrito.map(function (c) {
                var base = c.precioUnitario != null ? c.precioUnitario : 0;
                return {
                    fila: c.fila,
                    cantidad: c.cantidad,
                    precioUnitario: Math.round(base * factor * 100) / 100,
                    imagenUrl: c.imagenUrl
                };
            });
        }

        function htmlBloqueDescuento(subtotal) {
            var pct = pctDescuentoEfectivo();
            var descMonto = Math.round(subtotal * pct) / 100;
            var total = subtotal - descMonto;
            var piezas = piezasCarrito();
            var autoPct = pctDescuentoAuto(piezas);
            var hint;
            if (descuentoManual) {
                hint = 'Indica el % y se aplicará aunque tengas pocas piezas.';
            } else if (autoPct > 0) {
                hint = piezas + ' piezas → ' + autoPct + '% automático (5 pzs = 5% · 10 pzs = 8%).';
            } else {
                hint = 'Automático: 5 piezas = 5% · 10 piezas = 8%. Activa manual para otro %.';
            }
            return '<div class="admin-venta-descuento">' +
                '<div class="admin-venta-desc-grid">' +
                '<div class="admin-venta-desc-col admin-venta-desc-col--ctrl">' +
                '<span class="admin-venta-desc-title">Descuento</span>' +
                '<label class="admin-venta-desc-manual">' +
                '<input type="checkbox" id="adminVentaRetailDescManual"' + (descuentoManual ? ' checked' : '') + '> Manual</label>' +
                '<div class="admin-venta-desc-row">' +
                '<input type="number" min="0" max="100" step="0.5" id="adminVentaRetailDescPct" class="admin-venta-desc-input"' +
                (descuentoManual ? '' : ' disabled') + ' placeholder="%" value="' + esc(descuentoManualPct) + '">' +
                '<span class="admin-muted-text">%</span></div></div>' +
                '<div class="admin-venta-desc-col admin-venta-desc-col--resumen">' +
                '<span class="admin-muted-text admin-venta-desc-hint">' + esc(hint) + '</span>' +
                (pct > 0 ? '<span class="admin-venta-desc-line">Descuento (' + pct + '%): <strong>−' + fmt(descMonto) + '</strong></span>' : '') +
                '<span class="admin-venta-desc-total">Subtotal ' + fmt(subtotal) +
                ' · Total <strong>' + fmt(pct > 0 ? total : subtotal) + '</strong></span></div></div></div>';
        }

        function getFilasInv() {
            return catalogoConStock(opts.getFilas ? opts.getFilas() : filasInv);
        }

        function idFila(r) {
            return ObebeAdminData.idFilaInventario(r);
        }

        function imagenFila(r) {
            return ObebeAdminData.urlImagenFilaInventario(r);
        }

        function thumbHtml(url, alt, cls) {
            cls = cls || 'admin-ped-cart-thumb';
            if (!url) return '<span class="admin-mayoreo-thumb-empty ' + cls + '"></span>';
            return '<img src="' + esc(url) + '" alt="' + esc(alt || '') + '" class="' + cls + '" loading="lazy" onerror="adminMayoreoImgFallback(this)">';
        }

        function valoresCheckboxChecked(containerId) {
            var box = document.getElementById(containerId);
            if (!box) return [];
            return Array.prototype.map.call(
                box.querySelectorAll('.admin-ped-filter-cb:checked'),
                function (cb) { return cb.value; }
            );
        }

        function leerCheckedMap(containerId) {
            var map = {};
            valoresCheckboxChecked(containerId).forEach(function (v) { map[v] = true; });
            return map;
        }

        function htmlCheckboxGrupo(containerId, prefix, valores, prevChecked) {
            prevChecked = prevChecked || {};
            if (!valores.length) {
                return '<p class="admin-muted-text admin-ped-filter-empty">Sin opciones</p>';
            }
            return valores.map(function (val) {
                var id = prefix + '-' + val.replace(/[^a-zA-Z0-9_-]/g, '_');
                var checked = prevChecked[val] ? ' checked' : '';
                return '<label class="admin-ped-filter-item">' +
                    '<input type="checkbox" class="admin-ped-filter-cb" id="' + esc(id) + '" value="' + esc(val) + '"' + checked + '>' +
                    '<span>' + esc(val) + '</span></label>';
            }).join('');
        }

        function baseOpcionesFiltro() {
            var list = getFilasInv();
            if (generoCatalogo && generoCatalogo !== 'todos') {
                list = list.filter(function (r) {
                    var seg = r.segmento || 'Hombre';
                    return seg === generoCatalogo;
                });
            }
            return list;
        }

        function construirOpcionesFiltro() {
            var list = baseOpcionesFiltro();
            return {
                tallas: ordenarTallas(uniqSorted(list.map(function (r) { return tallaBase(r.talla); }))),
                tipos: uniqSorted(list.map(tipoFila)),
                colores: uniqSorted(list.map(function (r) { return r.color; })),
                marcas: marcasUnicas(list)
            };
        }

        function filtrarCatalogo(soloContar) {
            var q = norm((document.getElementById('adminVentaRetailBuscar') || {}).value || '');
            var list = getFilasInv();
            if (generoCatalogo && generoCatalogo !== 'todos') {
                list = list.filter(function (r) {
                    return (r.segmento || 'Hombre') === generoCatalogo;
                });
            }
            var tallas = valoresCheckboxChecked('adminVentaRetailFiltroTallas');
            var tipos = valoresCheckboxChecked('adminVentaRetailFiltroTipos');
            var colores = valoresCheckboxChecked('adminVentaRetailFiltroColores');
            var marcas = valoresCheckboxChecked('adminVentaRetailFiltroMarcas');
            list = list.filter(function (r) {
                if (tallas.length && tallas.indexOf(tallaBase(r.talla)) < 0) return false;
                if (tipos.length && !tipos.some(function (t) { return tipoCoincideFiltro(tipoFila(r), t); })) return false;
                if (colores.length && colores.indexOf((r.color || '').trim()) < 0) return false;
                if (marcas.length && !marcas.some(function (m) { return marcaCoincide(m, r.marca); })) return false;
                if (q) {
                    var blob = [r.nombre, r.marca, r.tipo, r.color, r.talla, r.segmento].join(' ').toLowerCase();
                    if (blob.indexOf(q) < 0) return false;
                }
                return true;
            });
            list.sort(function (a, b) {
                var sa = a.segmento === 'Mujer' ? 1 : 0;
                var sb = b.segmento === 'Mujer' ? 1 : 0;
                if (sa !== sb) return sa - sb;
                return String(a.nombre).localeCompare(String(b.nombre), 'es');
            });
            if (soloContar) return list;
            return list;
        }

        function rebuildFiltrosPanel() {
            var prevT = leerCheckedMap('adminVentaRetailFiltroTallas');
            var prevTp = leerCheckedMap('adminVentaRetailFiltroTipos');
            var prevC = leerCheckedMap('adminVentaRetailFiltroColores');
            var prevM = leerCheckedMap('adminVentaRetailFiltroMarcas');
            var op = construirOpcionesFiltro();
            var elT = document.getElementById('adminVentaRetailFiltroTallas');
            var elTp = document.getElementById('adminVentaRetailFiltroTipos');
            var elC = document.getElementById('adminVentaRetailFiltroColores');
            var elM = document.getElementById('adminVentaRetailFiltroMarcas');
            if (elT) elT.innerHTML = htmlCheckboxGrupo('adminVentaRetailFiltroTallas', 'vr-t', op.tallas, prevT);
            if (elTp) elTp.innerHTML = htmlCheckboxGrupo('adminVentaRetailFiltroTipos', 'vr-tp', op.tipos, prevTp);
            if (elC) elC.innerHTML = htmlCheckboxGrupo('adminVentaRetailFiltroColores', 'vr-c', op.colores, prevC);
            if (elM) elM.innerHTML = htmlCheckboxGrupo('adminVentaRetailFiltroMarcas', 'vr-m', op.marcas, prevM);
            var cnt = document.getElementById('adminVentaRetailContador');
            if (cnt) {
                var n = filtrarCatalogo(true).length;
                cnt.textContent = n + ' artículo(s)' + (n > MAX_CATALOGO ? ' (mostrando ' + MAX_CATALOGO + ')' : '');
            }
        }

        function pintarCatalogo() {
            var box = document.getElementById('adminVentaRetailCatalogo');
            if (!box) return;
            var list = filtrarCatalogo(false);
            var cnt = document.getElementById('adminVentaRetailContador');
            if (cnt) {
                cnt.textContent = list.length + ' artículo(s)' +
                    (list.length > MAX_CATALOGO ? ' (mostrando ' + MAX_CATALOGO + ')' : '');
            }
            if (!list.length) {
                box.innerHTML = '<p class="admin-muted-text">Sin resultados. Ajusta filtros o busca otro término.</p>';
                return;
            }
            box.innerHTML = list.slice(0, MAX_CATALOGO).map(function (r) {
                var id = idFila(r);
                var img = imagenFila(r);
                var seg = r.segmento === 'Mujer' ? 'Mujer' : 'Hombre';
                var imgHtml = img
                    ? '<img src="' + esc(img) + '" alt="" class="admin-ped-thumb" loading="lazy" onerror="adminMayoreoImgFallback(this)">'
                    : '<span class="admin-mayoreo-thumb-empty admin-ped-thumb"></span>';
                return '<button type="button" class="admin-ped-item admin-venta-retail-pick" data-id="' + esc(id) + '">' + imgHtml +
                    '<span class="admin-ped-item-info"><strong>' + esc(r.nombre) + '</strong>' +
                    '<span class="admin-ped-tags"><span class="admin-tag admin-tag-muted">' + esc(seg) + '</span></span>' +
                    '<span>' + esc(r.talla) + ' · ' + esc(r.color) + ' · ' + esc(r.tipo) + ' · Stock ' + r.stock + '</span>' +
                    '<span class="admin-ped-precios"><strong>' + fmt(r.precio) + '</strong></span></span></button>';
            }).join('');
        }

        function pintarCarrito() {
            var box = document.getElementById('adminVentaRetailCarrito');
            if (!box) return;
            if (box.querySelector('#adminVentaRetailDescManual')) {
                leerEstadoDescuentoUi();
            }
            if (!carrito.length) {
                descuentoManual = false;
                descuentoManualPct = '';
                box.innerHTML = '<p class="admin-muted-text" style="padding:0 1rem">Carrito vacío.</p>';
                pintarCatalogo();
                return;
            }
            var total = 0;
            var rows = carrito.map(function (c, idx) {
                var sub = (c.precioUnitario || 0) * (c.cantidad || 1);
                total += sub;
                var img = c.imagenUrl || imagenFila(c.fila);
                return '<tr><td class="admin-ped-cart-img-cell"><div class="admin-ped-cart-line">' +
                    thumbHtml(img, c.fila.nombre, 'admin-ped-cart-thumb') +
                    '<div><span class="admin-ped-cart-name">' + esc(c.fila.nombre) + '</span>' +
                    '<span class="admin-muted-text">' + esc(c.fila.talla) + ' · ' + esc(c.fila.color) + '</span></div></div></td>' +
                    '<td><input type="number" min="1" max="' + c.fila.stock + '" value="' + c.cantidad + '" class="admin-venta-num admin-venta-retail-qty" data-idx="' + idx + '"></td>' +
                    '<td>' + fmt(c.precioUnitario) + '</td><td>' + fmt(sub) + '</td>' +
                    '<td><button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-venta-retail-quitar" data-idx="' + idx + '">Quitar</button></td></tr>';
            }).join('');
            box.innerHTML = '<div class="admin-table-wrap"><table class="admin-table admin-table-compact"><thead><tr>' +
                '<th>Artículo</th><th>Cant.</th><th>Precio u.</th><th>Subtotal</th><th></th></tr></thead><tbody>' +
                rows + '</tbody></table></div>' +
                htmlBloqueDescuento(total);
            pintarCatalogo();
        }

        function panelFiltrosHtml() {
            function genBtn(g, label) {
                var act = generoCatalogo === g ? ' active' : '';
                return '<button type="button" class="admin-ped-genero-btn admin-vr-gen' + act + '" data-genero="' + g + '">' + esc(label) + '</button>';
            }
            return '<aside class="admin-ped-filtros" id="adminVentaRetailFiltros" aria-label="Filtros">' +
                '<div class="admin-ped-filtros-head">' +
                '<p class="admin-ped-filtros-title">Filtros</p>' +
                '<button type="button" class="admin-ped-filtros-close" id="adminVentaRetailFiltrosClose" aria-label="Cerrar filtros">×</button></div>' +
                '<p class="admin-ped-filtros-sub">Género</p>' +
                '<div class="admin-ped-genero-btns">' +
                genBtn('todos', 'Todos') + genBtn('Hombre', 'Hombre') + genBtn('Mujer', 'Mujer') +
                '</div>' +
                '<details open class="admin-ped-filter-block"><summary>Talla</summary><div id="adminVentaRetailFiltroTallas" class="admin-ped-filter-list"></div></details>' +
                '<details open class="admin-ped-filter-block"><summary>Tipo</summary><div id="adminVentaRetailFiltroTipos" class="admin-ped-filter-list"></div></details>' +
                '<details open class="admin-ped-filter-block"><summary>Color</summary><div id="adminVentaRetailFiltroColores" class="admin-ped-filter-list"></div></details>' +
                '<details open class="admin-ped-filter-block"><summary>Marca</summary><div id="adminVentaRetailFiltroMarcas" class="admin-ped-filter-list"></div></details>' +
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact" id="adminVentaRetailLimpiarFiltros">Limpiar filtros</button>' +
                '</aside>';
        }

        function opcionesClientesExistentes() {
            return '<option value="">— Selecciona cliente —</option>' +
                clientes.map(function (c) {
                    return '<option value="' + esc(c.id || c.nombre) + '">' + esc(c.nombre) + '</option>';
                }).join('');
        }

        function actualizarPanelCliente() {
            var nuevo = document.getElementById('adminVentaRetailPanelNuevo');
            var exist = document.getElementById('adminVentaRetailPanelExistente');
            if (nuevo) nuevo.classList.toggle('admin-hidden', tipoCliente !== 'nuevo');
            if (exist) exist.classList.toggle('admin-hidden', tipoCliente !== 'existente');
            container.querySelectorAll('.admin-vr-tipo-btn').forEach(function (b) {
                b.classList.toggle('active', b.getAttribute('data-tipo') === tipoCliente);
            });
        }

        function clienteExistenteHit() {
            if (!clienteSeleccionadoId) return null;
            return clientes.find(function (c) {
                return (c.id || c.nombre) === clienteSeleccionadoId;
            }) || null;
        }

        function pintarResumenClienteExistente() {
            var box = document.getElementById('adminVentaRetailClienteResumen');
            if (!box) return;
            var c = clienteExistenteHit();
            if (!c) {
                box.innerHTML = '<p class="admin-muted-text">Elige un cliente de la lista.</p>';
                return;
            }
            box.innerHTML = '<p class="admin-muted-text"><strong>Contacto guardado:</strong> ' +
                esc(c.telefono || '—') + ' · ' + esc(c.redPrincipal || '—') +
                (c.link ? ' · ' + esc(c.link) : '') + '</p>';
        }

        function buildShell() {
            return '<div class="admin-panel"><div class="admin-panel-head"><h3>Registrar venta</h3></div>' +
                '<div class="admin-venta-retail-cliente">' +
                '<p class="admin-ped-filtros-sub">Tipo de cliente</p>' +
                '<div class="admin-ped-genero-btns">' +
                '<button type="button" class="admin-ped-genero-btn admin-vr-tipo-btn" data-tipo="existente">Cliente existente</button>' +
                '<button type="button" class="admin-ped-genero-btn admin-vr-tipo-btn" data-tipo="nuevo">Cliente nuevo</button>' +
                '</div>' +
                '<div id="adminVentaRetailPanelExistente" class="admin-venta-retail-panel">' +
                '<div class="admin-field"><label>Cliente</label>' +
                '<select id="adminVentaRetailClienteSelect" class="admin-venta-pago-select">' + opcionesClientesExistentes() + '</select></div>' +
                '<div id="adminVentaRetailClienteResumen"></div>' +
                '<div class="admin-field-row">' + selectEquipo('adminVentaRetailCuentaEx', 'Quien tiene el dinero') +
                selectEquipo('adminVentaRetailVendedorEx', 'Vendedor') + '</div></div>' +
                '<div id="adminVentaRetailPanelNuevo" class="admin-venta-retail-panel admin-hidden">' +
                '<div class="admin-field"><label>Nombre cliente</label><input type="text" id="adminVentaRetailNombreNuevo" placeholder="Nombre completo" required></div>' +
                '<div class="admin-field-row">' +
                '<div class="admin-field"><label>Teléfono <span class="admin-label-opt">(opcional)</span></label><input type="text" id="adminVentaRetailTelNuevo"></div>' +
                '<div class="admin-field"><label>Red social <span class="admin-label-opt">(opcional)</span></label><input type="text" id="adminVentaRetailRedNuevo" placeholder="Instagram…"></div></div>' +
                '<div class="admin-field"><label>Link <span class="admin-label-opt">(opcional)</span></label><input type="text" id="adminVentaRetailLinkNuevo" placeholder="https://…"></div>' +
                '<div class="admin-field-row">' + selectEquipo('adminVentaRetailCuentaNuevo', 'Quien tiene el dinero') +
                selectEquipo('adminVentaRetailVendedorNuevo', 'Vendedor') + '</div></div></div></div>' +
                '<div class="admin-ped-filtros-backdrop admin-hidden" id="adminVentaRetailFiltrosBackdrop"></div>' +
                '<div class="admin-panel"><div class="admin-ped-layout">' + panelFiltrosHtml() +
                '<div class="admin-ped-main">' +
                '<div class="admin-panel-head admin-ped-head">' +
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-ped-filtros-toggle" id="adminVentaRetailFiltrosToggle">Filtros</button>' +
                '<h3 style="font-size:0.95rem">Inventario</h3>' +
                '<input type="search" class="admin-search" id="adminVentaRetailBuscar" placeholder="Buscar nombre, marca…"></div>' +
                '<p id="adminVentaRetailContador" class="admin-muted-text admin-ped-contador"></p>' +
                '<div id="adminVentaRetailCatalogo" class="admin-ped-catalogo"></div></div></div>' +
                '<div class="admin-panel-head" style="padding-left:1rem"><h3 style="font-size:0.95rem">Carrito</h3></div>' +
                '<div id="adminVentaRetailCarrito"></div>' +
                '<p id="adminVentaRetailError" class="admin-login-error" role="alert"></p>' +
                '<div class="admin-ped-form-actions" style="padding:0 1rem 1rem">' +
                '<button type="button" class="admin-btn admin-btn-primary" id="adminVentaRetailConfirm">Vender y descontar stock</button></div></div>';
        }

        function cerrarDrawerFiltros() {
            var drawer = document.getElementById('adminVentaRetailFiltros');
            var back = document.getElementById('adminVentaRetailFiltrosBackdrop');
            if (drawer) drawer.classList.remove('open');
            if (back) back.classList.add('admin-hidden');
            document.body.classList.remove('admin-ped-filtros-open');
        }

        function abrirDrawerFiltros() {
            var drawer = document.getElementById('adminVentaRetailFiltros');
            var back = document.getElementById('adminVentaRetailFiltrosBackdrop');
            if (drawer) drawer.classList.add('open');
            if (back) back.classList.remove('admin-hidden');
            document.body.classList.add('admin-ped-filtros-open');
        }

        function leerMetaVenta() {
            if (tipoCliente === 'nuevo') {
                return {
                    cliente: ((document.getElementById('adminVentaRetailNombreNuevo') || {}).value || '').trim(),
                    telefono: (document.getElementById('adminVentaRetailTelNuevo') || {}).value || '',
                    redSocial: (document.getElementById('adminVentaRetailRedNuevo') || {}).value || '',
                    link: (document.getElementById('adminVentaRetailLinkNuevo') || {}).value || '',
                    cuenta: (document.getElementById('adminVentaRetailCuentaNuevo') || {}).value || '',
                    vendedor: (document.getElementById('adminVentaRetailVendedorNuevo') || {}).value || ''
                };
            }
            var c = clienteExistenteHit();
            return {
                cliente: c ? c.nombre : '',
                telefono: c ? (c.telefono || '') : '',
                redSocial: c ? (c.redPrincipal || '') : '',
                link: c ? (c.link || '') : '',
                cuenta: (document.getElementById('adminVentaRetailCuentaEx') || {}).value || '',
                vendedor: (document.getElementById('adminVentaRetailVendedorEx') || {}).value || ''
            };
        }

        function validarMeta(meta, errEl) {
            if (!meta.cliente) {
                if (errEl) errEl.textContent = tipoCliente === 'nuevo' ? 'Escribe el nombre del cliente.' : 'Selecciona un cliente.';
                return false;
            }
            if (EQUIPO.indexOf(meta.cuenta) < 0) {
                if (errEl) errEl.textContent = 'Elige quién tiene el dinero (Ugo, Daniel o Fer).';
                return false;
            }
            if (EQUIPO.indexOf(meta.vendedor) < 0) {
                if (errEl) errEl.textContent = 'Elige vendedor (Ugo, Daniel o Fer).';
                return false;
            }
            return true;
        }

        container.innerHTML = buildShell();
        actualizarPanelCliente();
        rebuildFiltrosPanel();
        pintarCatalogo();
        pintarCarrito();
        pintarResumenClienteExistente();

        var buscar = document.getElementById('adminVentaRetailBuscar');
        if (buscar) buscar.oninput = function () { pintarCatalogo(); };

        document.getElementById('adminVentaRetailFiltrosToggle').onclick = abrirDrawerFiltros;
        document.getElementById('adminVentaRetailFiltrosClose').onclick = cerrarDrawerFiltros;
        document.getElementById('adminVentaRetailFiltrosBackdrop').onclick = cerrarDrawerFiltros;

        document.getElementById('adminVentaRetailClienteSelect').onchange = function (ev) {
            clienteSeleccionadoId = ev.target.value;
            pintarResumenClienteExistente();
        };

        container.onclick = function (ev) {
            var tipoBtn = ev.target.closest('.admin-vr-tipo-btn');
            if (tipoBtn) {
                tipoCliente = tipoBtn.getAttribute('data-tipo') || 'existente';
                actualizarPanelCliente();
                return;
            }
            var genBtn = ev.target.closest('.admin-vr-gen');
            if (genBtn) {
                generoCatalogo = genBtn.getAttribute('data-genero');
                container.querySelectorAll('.admin-vr-gen').forEach(function (b) {
                    b.classList.toggle('active', b === genBtn);
                });
                rebuildFiltrosPanel();
                pintarCatalogo();
                if (window.matchMedia('(max-width: 900px)').matches) cerrarDrawerFiltros();
                return;
            }
            if (ev.target.id === 'adminVentaRetailLimpiarFiltros' || ev.target.closest('#adminVentaRetailLimpiarFiltros')) {
                generoCatalogo = 'todos';
                container.querySelectorAll('.admin-vr-gen').forEach(function (b) {
                    b.classList.toggle('active', b.getAttribute('data-genero') === 'todos');
                });
                if (buscar) buscar.value = '';
                ['adminVentaRetailFiltroTallas', 'adminVentaRetailFiltroTipos', 'adminVentaRetailFiltroColores', 'adminVentaRetailFiltroMarcas'].forEach(function (id) {
                    var el = document.getElementById(id);
                    if (el) el.querySelectorAll('.admin-ped-filter-cb').forEach(function (cb) { cb.checked = false; });
                });
                rebuildFiltrosPanel();
                pintarCatalogo();
                return;
            }
            var pick = ev.target.closest('.admin-venta-retail-pick');
            if (pick) {
                var fid = pick.getAttribute('data-id');
                var f = getFilasInv().find(function (r) { return idFila(r) === fid; });
                if (!f) return;
                var ex = carrito.find(function (c) { return idFila(c.fila) === fid; });
                if (ex) {
                    if (ex.cantidad < f.stock) ex.cantidad += 1;
                } else {
                    carrito.push({
                        fila: f,
                        cantidad: 1,
                        precioUnitario: f.precio || 0,
                        imagenUrl: imagenFila(f)
                    });
                }
                pintarCarrito();
                return;
            }
            var quitar = ev.target.closest('.admin-venta-retail-quitar');
            if (quitar) {
                carrito.splice(parseInt(quitar.getAttribute('data-idx'), 10), 1);
                pintarCarrito();
                return;
            }
            if (ev.target.id === 'adminVentaRetailConfirm') {
                var err = document.getElementById('adminVentaRetailError');
                if (err) err.textContent = '';
                var meta = leerMetaVenta();
                if (!validarMeta(meta, err)) return;
                if (!carrito.length) {
                    if (err) err.textContent = 'Agrega artículos al carrito.';
                    return;
                }
                var pctDesc = pctDescuentoEfectivo();
                var msgVenta = 'Se registrará en VENTAS y se bajará el stock en INVENTARIO.';
                if (pctDesc > 0) {
                    msgVenta += ' Descuento aplicado: ' + pctDesc + '%.';
                }
                ObebeAdminDialog.confirm({
                    title: '¿Confirmar venta?',
                    message: msgVenta,
                    confirmText: 'Vender',
                    cancelText: 'Cancelar',
                    variant: 'warn'
                }).then(function (ok) {
                    if (!ok) return;
                    var metaVenta = leerMetaVenta();
                    var carritoVendido = carritoParaVenta().map(function (c) {
                        return {
                            fila: c.fila,
                            cantidad: c.cantidad,
                            precioUnitario: c.precioUnitario,
                            imagenUrl: c.imagenUrl || imagenFila(c.fila)
                        };
                    });
                    ObebeAdminData.registrarVentaRetail(carritoVendido, metaVenta).then(function (res) {
                        if (!res.ok) {
                            if (err) err.textContent = res.error || 'Error';
                            return;
                        }
                        carrito = [];
                        descuentoManual = false;
                        descuentoManualPct = '';
                        filasInv = getFilasInv();
                        pintarCarrito();
                        rebuildFiltrosPanel();
                        var msgOk = res.soloLocal
                            ? 'Guardado en este navegador. Google Sheets y la tienda web no se actualizaron. Configura appsScriptUrl para sincronizar.'
                            : 'Stock actualizado en INVENTARIO y filas en VENTAS.';
                        ObebeAdminDialog.alert({
                            title: 'Venta registrada',
                            message: msgOk,
                            confirmText: 'Listo'
                        }).then(function () {
                            if (!global.ObebeAdminEntregas || !ObebeAdminEntregas.abrirModalPostVenta) return;
                            return ObebeAdminDialog.confirm({
                                title: '¿Programar entrega?',
                                message: 'Puedes agendar fecha, hora y lugar. El cliente y los artículos ya vienen de esta venta.',
                                confirmText: 'Sí, programar',
                                cancelText: 'No por ahora',
                                variant: 'warn'
                            }).then(function (siEntrega) {
                                if (!siEntrega) return;
                                return ObebeAdminEntregas.abrirModalPostVenta({
                                    meta: metaVenta,
                                    carrito: carritoVendido,
                                    onGuardada: function () {
                                        ObebeAdminDialog.alert({
                                            title: 'Entrega programada',
                                            message: 'La verás en el módulo Entregas.',
                                            confirmText: 'Listo'
                                        });
                                    }
                                });
                            });
                        });
                        if (opts.onVentaRegistrada) opts.onVentaRegistrada(res);
                    }).catch(function (e) {
                        if (err) err.textContent = e.message || String(e);
                    });
                });
            }
        };

        container.onchange = function (ev) {
            if (ev.target.id === 'adminVentaRetailDescManual') {
                descuentoManual = !!ev.target.checked;
                pintarCarrito();
                return;
            }
            if (ev.target.id === 'adminVentaRetailDescPct') {
                descuentoManualPct = ev.target.value;
                pintarCarrito();
                return;
            }
            if (ev.target.classList.contains('admin-ped-filter-cb')) {
                pintarCatalogo();
                return;
            }
            var qty = ev.target.closest('.admin-venta-retail-qty');
            if (!qty) return;
            var idx = parseInt(qty.getAttribute('data-idx'), 10);
            if (isNaN(idx) || !carrito[idx]) return;
            var n = parseInt(qty.value, 10);
            var max = carrito[idx].fila.stock || 1;
            if (isNaN(n) || n < 1) n = 1;
            if (n > max) n = max;
            carrito[idx].cantidad = n;
            pintarCarrito();
        };

    }

    global.ObebeAdminVentasRetail = { mount: mount };
})(window);
