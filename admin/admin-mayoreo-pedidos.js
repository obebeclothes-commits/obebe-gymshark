(function (global) {
    'use strict';

    var MAX_CATALOGO = 400;
    var ORDEN_TALLAS = ['S', 'M', 'L', 'XL', 'UNI'];
    /** Inventario activo del panel (catálogo + modal Ver). */
    var filasInv = [];

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

    function filtrarModoMayoreo(list, modo) {
        if (modo === '20') {
            return list.filter(function (r) {
                return r.mayoreo && (Number(r.precioMayoreo) || 0) > 0;
            });
        }
        if (modo === '50') {
            return list.filter(function (r) {
                return (Number(r.precioMayoreo50) || 0) > 0;
            });
        }
        if (modo === 'early') {
            return list.filter(function (r) {
                if (r.soloComprasEarly) return true;
                return global.ObebeComprasEarlyStore && ObebeComprasEarlyStore.esEarlyAccessFila(r);
            });
        }
        return list;
    }

    function filtrarGenero(list, genero) {
        if (!genero || genero === 'todos') return list;
        return list.filter(function (r) {
            var seg = r.segmento || 'Hombre';
            return seg === genero;
        });
    }

    function precioVistaItem(r, unidadesCarrito, modo) {
        var retail = Number(r.precio) || 0;
        if (modo === '50' && (Number(r.precioMayoreo50) || 0) > 0) {
            return {
                retail: retail,
                precioCliente: Number(r.precioMayoreo50),
                precioMayoreo20: Number(r.precioMayoreo) || 0,
                nota: 'Mayoreo +50'
            };
        }
        if (modo === '20' && r.mayoreo && (Number(r.precioMayoreo) || 0) > 0) {
            return {
                retail: retail,
                precioCliente: Number(r.precioMayoreo),
                nota: 'Mayoreo +20'
            };
        }
        return ObebeAdminData.precioPedidoMayoreo(r, unidadesCarrito);
    }

    function filasInvConEarly(base) {
        base = base || [];
        if (global.ObebeAdminData && ObebeAdminData.combinarInventarioConComprasEarly) {
            return ObebeAdminData.combinarInventarioConComprasEarly(base);
        }
        return base;
    }

    function imagenFila(fila, filasInv) {
        if (!fila) return '';
        var earlyPorRef = fila.ref && global.ObebeComprasEarlyStore &&
            ObebeComprasEarlyStore.tieneRef(fila.ref);
        if (fila.soloComprasEarly || earlyPorRef) {
            var filaEarly = Object.assign({}, fila, { soloComprasEarly: true });
            if (ObebeAdminData.urlsFotosTiendaObebe) {
                var packEarly = ObebeAdminData.urlsFotosTiendaObebe(filaEarly);
                if (packEarly.foto1) return packEarly.foto1;
                if (packEarly.candidatos1 && packEarly.candidatos1.length) return packEarly.candidatos1[0];
            }
        }
        if (ObebeAdminData.urlImagenFilaInventario) {
            var uInv = ObebeAdminData.urlImagenFilaInventario(fila);
            if (uInv) return uInv;
        }
        if (fila.fotoUrl) return fila.fotoUrl;
        return ObebeAdminData.imagenParaLineaMayoreo({
            ref: fila.ref,
            nombre: fila.nombre,
            talla: fila.talla,
            color: fila.color,
            tipo: fila.tipo,
            marca: fila.marca
        }, filasInvConEarly(filasInv || []));
    }

    function candidatosImagenFila(fila) {
        if (!fila || !ObebeAdminData.urlsFotosTiendaObebe) return [];
        if (!fila.soloComprasEarly && fila.ref && global.ObebeComprasEarlyStore &&
            ObebeComprasEarlyStore.tieneRef(fila.ref)) {
            fila = Object.assign({}, fila, { soloComprasEarly: true });
        }
        var urls = ObebeAdminData.urlsFotosTiendaObebe(fila);
        return (urls.candidatos1 || []).concat(urls.candidatos2 || []);
    }

    function thumbHtml(url, alt, extraClass, candidates) {
        extraClass = extraClass || 'admin-ped-thumb';
        if (!url) {
            return '<span class="admin-mayoreo-thumb-empty ' + extraClass + '"></span>';
        }
        var cand = (candidates || []).filter(function (u, i, a) { return u && a.indexOf(u) === i; });
        if (!cand.length && ObebeAdminData.candidatosUrlImagenAdmin) {
            cand = ObebeAdminData.candidatosUrlImagenAdmin(url);
        }
        var candAttr = cand.length ? ' data-candidates="' + esc(cand.join('|')) + '" data-candidate-step="0"' : '';
        return '<img src="' + esc(url) + '" alt="' + esc(alt || '') + '" class="' + extraClass + '" ' +
            'loading="lazy"' + candAttr + ' onerror="adminMayoreoImgFallback(this)">';
    }

    function thumbHtmlFila(fila, alt, extraClass) {
        var url = imagenFila(fila, filasInv);
        return thumbHtml(url, alt, extraClass, candidatosImagenFila(fila));
    }

    function imgModalHtml(src, alt, candidates) {
        var cand = (candidates || []).filter(function (u, i, a) { return u && a.indexOf(u) === i; }).join('|');
        if (!src && cand) {
            src = cand.split('|')[0] || '';
        }
        return '<figure class="admin-ped-fotos-fig">' +
            (src
                ? '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" class="admin-ped-fotos-img" ' +
                'data-candidates="' + esc(cand) + '" data-candidate-step="0" loading="lazy" ' +
                'onerror="adminMayoreoImgFallback(this)">'
                : '<p class="admin-muted-text">Sin foto</p>') +
            '</figure>';
    }

    function ensureFotosPedidoModal() {
        var root = document.getElementById('adminPedFotosModal');
        if (root) return root;
        root = document.createElement('div');
        root.id = 'adminPedFotosModal';
        root.className = 'admin-apartado-modal-root admin-hidden';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML =
            '<div class="admin-apartado-modal-backdrop" data-ped-fotos-close="1"></div>' +
            '<div class="admin-apartado-modal admin-apartado-modal--wide" role="dialog" aria-modal="true">' +
            '<div class="admin-apartado-modal-head">' +
            '<h3 id="adminPedFotosTitulo">Fotos</h3>' +
            '<button type="button" class="admin-btn admin-btn-ghost" data-ped-fotos-close="1">×</button></div>' +
            '<div class="admin-apartado-modal-body">' +
            '<p id="adminPedFotosSub" class="admin-muted-text"></p>' +
            '<div id="adminPedFotosGrid" class="admin-ped-fotos-grid"></div>' +
            '<p class="admin-muted-text admin-ped-fotos-hint admin-hidden" aria-hidden="true"></p>' +
            '</div></div>';
        document.body.appendChild(root);
        root.querySelectorAll('[data-ped-fotos-close]').forEach(function (el) {
            el.addEventListener('click', function () {
                root.classList.add('admin-hidden');
                root.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('admin-apartado-modal-open');
            });
        });
        return root;
    }

    function filaCatalogoPorId(filaId) {
        var base = filasInvConEarly(filasInv);
        var hit = base.find(function (r) {
            return ObebeAdminData.idFilaInventario(r) === filaId;
        });
        if (hit) return hit;
        if (global.ObebeAdminData && ObebeAdminData.getEstado) {
            var st = ObebeAdminData.getEstado();
            base = filasInvConEarly(st.filas || []);
            return base.find(function (r) {
                return ObebeAdminData.idFilaInventario(r) === filaId;
            }) || null;
        }
        return null;
    }

    function filaDesdeDatasetPedido(filaId, data) {
        data = data || {};
        var ref = parseInt(data.ref, 10) || 0;
        if (!ref && !data.nombre) return null;
        var seg = data.segmento === 'Mujer' ? 'Mujer' : 'Hombre';
        var fila = {
            ref: ref,
            nombre: data.nombre || '',
            talla: data.talla || '',
            color: data.color || '',
            marca: data.marca || '',
            tipo: data.tipo || '',
            segmento: seg,
            stock: 1,
            celdas: []
        };
        if (ref > 0 && global.ObebeComprasEarlyStore && ObebeComprasEarlyStore.tieneRef(ref)) {
            fila.soloComprasEarly = true;
        }
        return fila;
    }

    function abrirFotosArticulo(filaId, dataCard) {
        if (!global.ObebeAdminData || !ObebeAdminData.urlsFotosTiendaObebe) return;
        var fila = filaCatalogoPorId(filaId) || filaDesdeDatasetPedido(filaId, dataCard);
        var root = ensureFotosPedidoModal();
        if (!fila) {
            document.getElementById('adminPedFotosTitulo').textContent = 'Artículo';
            document.getElementById('adminPedFotosSub').textContent = '';
            document.getElementById('adminPedFotosGrid').innerHTML =
                '<p class="admin-muted-text">No se encontró el artículo en el catálogo.</p>';
            root.classList.remove('admin-hidden');
            root.setAttribute('aria-hidden', 'false');
            document.body.classList.add('admin-apartado-modal-open');
            return;
        }
        var urls = ObebeAdminData.urlsFotosTiendaObebe(fila);
        if (!urls.foto1 && urls.candidatos1 && urls.candidatos1.length) urls.foto1 = urls.candidatos1[0];
        if (!urls.foto2 && urls.candidatos2 && urls.candidatos2.length) urls.foto2 = urls.candidatos2[0];
        var esEarly = !!(fila.soloComprasEarly || (global.ObebeComprasEarlyStore &&
            ObebeComprasEarlyStore.esEarlyAccessFila(fila)));
        document.getElementById('adminPedFotosTitulo').textContent = fila.nombre || 'Artículo';
        var sub = document.getElementById('adminPedFotosSub');
        if (sub) {
            sub.textContent = '';
            sub.classList.add('admin-hidden');
            sub.setAttribute('aria-hidden', 'true');
        }
        var grid = '';
        var seen = {};
        function addFigura(cands, prefer) {
            cands = (cands || []).slice();
            var src = prefer || cands[0] || '';
            if (!src && !cands.length) return;
            var key = String(src || cands[0] || '').split('?')[0];
            if (!key || seen[key]) return;
            seen[key] = true;
            grid += imgModalHtml(src || cands[0], fila.nombre, cands.length ? cands : [src]);
        }
        addFigura(urls.candidatos1, urls.foto1);
        var k1 = String(urls.foto1 || '').split('?')[0];
        var k2 = String(urls.foto2 || '').split('?')[0];
        if (k2 && k2 !== k1) {
            addFigura(urls.candidatos2, urls.foto2);
        } else if (urls.candidatos2 && urls.candidatos2.length && !seen[String(urls.candidatos2[0] || '').split('?')[0]]) {
            addFigura(urls.candidatos2, '');
        }
        if (!grid) grid = '<p class="admin-muted-text">Sin fotos disponibles para este artículo.</p>';
        document.getElementById('adminPedFotosGrid').innerHTML = grid;
        root.classList.add('admin-ped-fotos-modal-solo-img');
        root.classList.remove('admin-hidden');
        root.setAttribute('aria-hidden', 'false');
        document.body.classList.add('admin-apartado-modal-open');
    }

    function etiquetaEstadoPedido(estado) {
        var cls = 'admin-tag-warn';
        var label = estado || 'pendiente';
        if (estado === 'revisado') cls = 'admin-tag-ok';
        else if (estado === 'en_revision') cls = 'admin-tag-muted';
        else if (estado === 'cancelado') cls = 'admin-tag-danger';
        if (estado === 'en_revision') label = 'En revisión';
        if (estado === 'revisado') label = 'Respuesta enviada';
        return '<span class="admin-tag ' + cls + '">' + esc(label) + '</span>';
    }

    function tagDisponibilidad(val) {
        if (val === 'si') return '<span class="admin-tag admin-tag-ok">Sí hay</span>';
        if (val === 'no') return '<span class="admin-tag admin-tag-danger">No hay</span>';
        return '<span class="admin-tag admin-tag-warn">Sin revisar</span>';
    }

    function textoEstadoPedido(estado) {
        if (estado === 'revisado') return 'Respuesta enviada';
        if (estado === 'en_revision') return 'En revisión';
        if (estado === 'cancelado') return 'Cancelado';
        if (estado === 'pendiente') return 'Pendiente';
        return estado || 'Pendiente';
    }

    function fmtFechaPedido(ms) {
        if (!ms) return '—';
        return new Date(ms).toLocaleString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    function mount(container, opts) {
        opts = opts || {};
        var modoObebe = !!opts.modoObebe;
        var clienteKey = opts.clienteKey || 'naty';
        var clienteNombre = opts.clienteNombre || 'NATY';
        filasInv = opts.filasInv || [];
        var carrito = [];
        var filtroCliente = opts.filtroClienteInicial || '';
        var modoCatalogo = 'todos';
        var generoCatalogo = 'todos';
        var editingPedidoId = null;
        var expandedPedidos = {};
        function setOverlayEnvio(visible, texto) {
            var id = 'adminMayoreoEnvioOverlay';
            var el = document.getElementById(id);
            if (visible) {
                if (!el) {
                    el = document.createElement('div');
                    el.id = id;
                    el.className = 'admin-mayoreo-envio-overlay';
                    el.setAttribute('role', 'status');
                    el.setAttribute('aria-live', 'polite');
                    el.innerHTML =
                        '<div class="admin-mayoreo-envio-box">' +
                        '<div class="admin-mayoreo-envio-spinner" aria-hidden="true"></div>' +
                        '<p class="admin-mayoreo-envio-text"></p>' +
                        '</div>';
                    document.body.appendChild(el);
                }
                var txt = el.querySelector('.admin-mayoreo-envio-text');
                if (txt) txt.textContent = texto || 'Enviando respuesta…';
                el.classList.remove('admin-hidden');
                document.body.classList.add('admin-mayoreo-envio-lock');
            } else {
                if (el) el.classList.add('admin-hidden');
                document.body.classList.remove('admin-mayoreo-envio-lock');
            }
        }

        function cerrarRespuestaEnviadaConCarga() {
            if (!global.ObebeAdminDialog || !ObebeAdminDialog.mientras) {
                pintar();
                return Promise.resolve();
            }
            var t0 = Date.now();
            return ObebeAdminDialog.mientras(
                Promise.resolve().then(function () {
                    pintar();
                    var wait = Math.max(0, 550 - (Date.now() - t0));
                    return new Promise(function (resolve) { setTimeout(resolve, wait); });
                }),
                'Procesando respuesta…'
            );
        }

        function minimoCargaMs(ms) {
            var t0 = Date.now();
            return function (val) {
                var wait = Math.max(0, (ms || 1000) - (Date.now() - t0));
                return new Promise(function (resolve) {
                    setTimeout(function () { resolve(val); }, wait);
                });
            };
        }

        function unidadesCarrito() {
            var t = 0;
            carrito.forEach(function (c) { t += c.cantidad || 0; });
            return t;
        }

        function getModoActivo() {
            var btn = container.querySelector('.admin-ped-modo-btn.active');
            return btn ? btn.getAttribute('data-modo') : modoCatalogo;
        }

        function getGeneroActivo() {
            var btn = container.querySelector('.admin-ped-genero-btn.active');
            return btn ? btn.getAttribute('data-genero') : generoCatalogo;
        }

        function valoresCheckboxChecked(containerId) {
            var box = document.getElementById(containerId);
            if (!box) return [];
            return Array.prototype.map.call(
                box.querySelectorAll('.admin-ped-filter-cb:checked'),
                function (cb) { return cb.value; }
            );
        }

        function baseOpcionesFiltro() {
            var list = catalogoConStock(filasInvConEarly(filasInv));
            list = filtrarModoMayoreo(list, getModoActivo());
            list = filtrarGenero(list, getGeneroActivo());
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

        function leerCheckedMap(containerId) {
            var map = {};
            valoresCheckboxChecked(containerId).forEach(function (v) { map[v] = true; });
            return map;
        }

        function rebuildFiltrosPanel() {
            var prevT = leerCheckedMap('adminPedFiltroTallas');
            var prevTp = leerCheckedMap('adminPedFiltroTipos');
            var prevC = leerCheckedMap('adminPedFiltroColores');
            var prevM = leerCheckedMap('adminPedFiltroMarcas');
            var op = construirOpcionesFiltro();
            var elT = document.getElementById('adminPedFiltroTallas');
            var elTp = document.getElementById('adminPedFiltroTipos');
            var elC = document.getElementById('adminPedFiltroColores');
            var elM = document.getElementById('adminPedFiltroMarcas');
            if (elT) elT.innerHTML = htmlCheckboxGrupo('adminPedFiltroTallas', 'talla', op.tallas, prevT);
            if (elTp) elTp.innerHTML = htmlCheckboxGrupo('adminPedFiltroTipos', 'tipo', op.tipos, prevTp);
            if (elC) elC.innerHTML = htmlCheckboxGrupo('adminPedFiltroColores', 'color', op.colores, prevC);
            if (elM) elM.innerHTML = htmlCheckboxGrupo('adminPedFiltroMarcas', 'marca', op.marcas, prevM);
            var cnt = document.getElementById('adminPedContador');
            if (cnt) {
                var n = filtrarCatalogo(true).length;
                cnt.textContent = n + ' artículo(s)';
            }
        }

        function filtrarCatalogo(soloContar) {
            var q = norm((document.getElementById('adminPedBuscar') || {}).value || '');
            var list = catalogoConStock(filasInvConEarly(filasInv));
            list = filtrarModoMayoreo(list, getModoActivo());
            list = filtrarGenero(list, getGeneroActivo());

            var tallas = valoresCheckboxChecked('adminPedFiltroTallas');
            var tipos = valoresCheckboxChecked('adminPedFiltroTipos');
            var colores = valoresCheckboxChecked('adminPedFiltroColores');
            var marcas = valoresCheckboxChecked('adminPedFiltroMarcas');

            list = list.filter(function (r) {
                if (tallas.length && tallas.indexOf(tallaBase(r.talla)) < 0) return false;
                if (tipos.length && !tipos.some(function (t) { return tipoCoincideFiltro(tipoFila(r), t); })) return false;
                if (colores.length && colores.indexOf((r.color || '').trim()) < 0) return false;
                if (marcas.length && !marcas.some(function (m) { return marcaCoincide(m, r.marca); })) return false;
                if (q) {
                    var blob = [r.nombre, r.marca, r.tipo, r.color, r.talla, r.segmento, String(r.ref || '')].join(' ').toLowerCase();
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

        function pintar() {
            filasInv = opts.filasInv || filasInv;
            if (modoObebe) {
                container.innerHTML = vistaObebe();
                bindObebe();
                return;
            }
            container.innerHTML = vistaNaty();
            bindNaty();
        }

        function panelFiltrosHtml() {
            function modoBtn(m, label) {
                var act = modoCatalogo === m ? ' active' : '';
                return '<button type="button" class="admin-ped-modo-btn' + act + '" data-modo="' + m + '">' + esc(label) + '</button>';
            }
            function genBtn(g, label) {
                var act = generoCatalogo === g ? ' active' : '';
                return '<button type="button" class="admin-ped-genero-btn' + act + '" data-genero="' + g + '">' + esc(label) + '</button>';
            }
            return '<aside class="admin-ped-filtros" id="adminPedFiltros" aria-label="Filtros">' +
                '<div class="admin-ped-filtros-head">' +
                '<p class="admin-ped-filtros-title">Filtros</p>' +
                '<button type="button" class="admin-ped-filtros-close" id="adminPedFiltrosClose" aria-label="Cerrar filtros">×</button></div>' +
                '<div class="admin-ped-modo-btns">' +
                modoBtn('todos', 'Todo') + modoBtn('20', 'Mayoreo +20') + modoBtn('50', 'Mayoreo +50') +
                '</div>' +
                '<div class="admin-ped-modo-btns admin-ped-modo-btns--early">' +
                modoBtn('early', 'Early access') +
                '</div>' +
                '<p class="admin-ped-filtros-sub">Género</p>' +
                '<div class="admin-ped-genero-btns">' +
                genBtn('todos', 'Todos') + genBtn('Hombre', 'Hombre') + genBtn('Mujer', 'Mujer') +
                '</div>' +
                '<details open class="admin-ped-filter-block"><summary>Talla</summary><div id="adminPedFiltroTallas" class="admin-ped-filter-list"></div></details>' +
                '<details open class="admin-ped-filter-block"><summary>Tipo</summary><div id="adminPedFiltroTipos" class="admin-ped-filter-list"></div></details>' +
                '<details open class="admin-ped-filter-block"><summary>Color</summary><div id="adminPedFiltroColores" class="admin-ped-filter-list"></div></details>' +
                '<details open class="admin-ped-filter-block"><summary>Marca</summary><div id="adminPedFiltroMarcas" class="admin-ped-filter-list"></div></details>' +
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-ped-limpiar" id="adminPedLimpiarFiltros">Limpiar filtros</button>' +
                '</aside>';
        }

        function vistaNaty() {
            var hist = ObebeMayoreoPedidosStore.pedidosForCliente(clienteKey);
            return '<div class="admin-ped-filtros-backdrop admin-hidden" id="adminPedFiltrosBackdrop"></div>' +
                '<div class="admin-panel"><div class="admin-ped-layout">' +
                panelFiltrosHtml() +
                '<div class="admin-ped-main">' +
                '<div class="admin-panel-head admin-ped-head">' +
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-ped-filtros-toggle" id="adminPedFiltrosToggle">Filtros</button>' +
                '<h3 id="adminPedTituloForm">Nuevo pedido</h3>' +
                '<input type="search" class="admin-search" id="adminPedBuscar" placeholder="Buscar nombre, marca…"></div>' +
                '<p id="adminPedEdicionAviso" class="admin-banner info admin-hidden" style="margin:0 1rem 0.5rem"></p>' +
                '<p id="adminPedContador" class="admin-muted-text admin-ped-contador"></p>' +
                '<div id="adminPedCatalogo" class="admin-ped-catalogo"></div>' +
                '</div></div>' +
                '<div class="admin-panel-head" style="margin-top:0.75rem;padding-left:1rem"><h3 style="font-size:0.95rem">Carrito</h3></div>' +
                '<div id="adminPedCarrito"></div>' +
                '<p id="adminPedError" class="admin-login-error" role="alert"></p>' +
                '<div class="admin-ped-form-actions" id="adminPedFormActions" style="padding:0 1rem 1rem">' +
                '<button type="button" class="admin-btn admin-btn-danger admin-btn-compact admin-hidden" id="adminPedCancelarEdicion">Cancelar edición</button>' +
                '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact" id="adminPedEnviar">Enviar pedido a Obebe Clothes</button></div></div>' +
                panelHistorialPedidos(hist, false);
        }

        function vistaObebe() {
            var clientes = opts.clientesMayoreo || [];
            var optsCli = '<option value="">Todos los clientes</option>' +
                clientes.map(function (c) {
                    return '<option value="' + esc(c.id || '') + '"' +
                        (filtroCliente === (c.id || '') ? ' selected' : '') + '>' + esc(c.nombre) + '</option>';
                }).join('');
            var list = ObebeMayoreoPedidosStore.listarTodos(filtroCliente || null);
            return '<div class="admin-panel"><div class="admin-panel-head"><h3>Pedidos mayoreo</h3>' +
                '<select id="adminPedFiltroCliente" class="admin-venta-pago-select">' + optsCli + '</select></div>' +
                detalleListaPedidos(list, true) + '</div>';
        }

        function panelHistorialPedidos(lista, obebe) {
            return '<div class="admin-panel" style="margin-top:1rem"><div class="admin-panel-head"><h3>' +
                (obebe ? 'Listado' : 'Mis pedidos enviados') + '</h3></div>' +
                '<div id="adminPedHistorial">' + detalleListaPedidos(lista, obebe) + '</div></div>';
        }

        function pintarHistorial() {
            var box = document.getElementById('adminPedHistorial');
            if (!box || modoObebe) return;
            var hist = ObebeMayoreoPedidosStore.pedidosForCliente(clienteKey);
            box.innerHTML = detalleListaPedidos(hist, false);
        }

        function filaDesdeItemPedido(it) {
            var cat = catalogoConStock(filasInvConEarly(filasInv));
            var hit = cat.find(function (r) {
                return ObebeAdminData.idFilaInventario(r) === it.inventarioId;
            });
            if (hit) return hit;
            var ref = parseInt(it.ref, 10) || 0;
            var stub = {
                ref: ref,
                nombre: it.nombre || '',
                talla: it.talla || '',
                color: it.color || '',
                marca: it.marca || '',
                tipo: it.tipo || '',
                stock: it.cantidad || 99,
                precio: it.precioRetail || 0,
                precioMayoreo: it.precioCliente || 0,
                mayoreo: true,
                segmento: 'Hombre',
                celdas: []
            };
            if (ref > 0 && global.ObebeComprasEarlyStore && ObebeComprasEarlyStore.tieneRef(ref)) {
                stub.soloComprasEarly = true;
                stub.celdas[0] = String(ref);
                if (ObebeAdminData.refEsEtiquetadaMujer && ObebeAdminData.refEsEtiquetadaMujer(ref)) {
                    stub.segmento = 'Mujer';
                } else if (ObebeAdminData.segmentoEtiquetadaRef) {
                    var segStub = ObebeAdminData.segmentoEtiquetadaRef(ref, stub);
                    stub.segmento = segStub === 'mujer' ? 'Mujer' : 'Hombre';
                }
            }
            return stub;
        }

        function imagenDesdeItemPedido(it) {
            if (it.imagenUrl && !/etiquetadas/i.test(it.imagenUrl)) return it.imagenUrl;
            return imagenFila(filaDesdeItemPedido(it), filasInv);
        }

        function carritoDesdePedido(p) {
            return (p.items || []).map(function (it) {
                return {
                    id: it.inventarioId,
                    itemId: it.itemId,
                    fila: filaDesdeItemPedido(it),
                    cantidad: it.cantidad || 1,
                    imagenUrl: it.imagenUrl || ''
                };
            });
        }

        function actualizarUiFormPedido() {
            var tit = document.getElementById('adminPedTituloForm');
            var btn = document.getElementById('adminPedEnviar');
            var cancel = document.getElementById('adminPedCancelarEdicion');
            var actions = document.getElementById('adminPedFormActions');
            var aviso = document.getElementById('adminPedEdicionAviso');
            if (editingPedidoId) {
                if (tit) tit.textContent = 'Editar pedido';
                if (btn) btn.textContent = 'Guardar cambios y reenviar';
                if (cancel) cancel.classList.remove('admin-hidden');
                if (actions) actions.classList.add('admin-ped-form-actions--edit');
                if (aviso) {
                    var ped = ObebeMayoreoPedidosStore.pedidosForCliente(clienteKey).find(function (x) {
                        return x.id === editingPedidoId;
                    });
                    if (ped && ped.estado === 'revisado') {
                        aviso.textContent = 'Los artículos que ya tenían respuesta de Obebe Clothes se conservan. Solo lo nuevo quedará pendiente de confirmar.';
                    } else {
                        aviso.textContent = 'Quita o agrega artículos en el catálogo y carrito. Al guardar, Obebe Clothes revisará el pedido.';
                    }
                    aviso.classList.remove('admin-hidden');
                }
            } else {
                if (tit) tit.textContent = 'Nuevo pedido';
                if (btn) btn.textContent = 'Enviar pedido a Obebe Clothes';
                if (cancel) cancel.classList.add('admin-hidden');
                if (actions) actions.classList.remove('admin-ped-form-actions--edit');
                if (aviso) aviso.classList.add('admin-hidden');
            }
        }

        function iniciarEdicionPedido(pedidoId) {
            var p = ObebeMayoreoPedidosStore.pedidosForCliente(clienteKey).find(function (x) {
                return x.id === pedidoId;
            });
            if (!p) return;
            editingPedidoId = pedidoId;
            expandedPedidos[pedidoId] = true;
            carrito = carritoDesdePedido(p);
            actualizarUiFormPedido();
            pintarCarrito();
            pintarHistorial();
            var form = document.getElementById('adminPedTituloForm');
            if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function cancelarEdicionPedido() {
            editingPedidoId = null;
            carrito = [];
            actualizarUiFormPedido();
            pintarCarrito();
            pintarHistorial();
        }

        function htmlItemPedido(it, p, obebe) {
            var filaIt = filaDesdeItemPedido(it);
            var url = imagenDesdeItemPedido(it);
            var revBlock = '';
            if (obebe && p.estado !== 'revisado' && p.estado !== 'cancelado') {
                var siAct = it.disponibilidad === 'si' ? ' active' : '';
                var noAct = it.disponibilidad === 'no' ? ' active' : '';
                revBlock = '<div class="admin-ped-rev-actions">' +
                    '<button type="button" class="admin-btn admin-btn-compact admin-ped-disp-no' + noAct + '" data-pedido-id="' + esc(p.id) + '" data-item-id="' + esc(it.itemId) + '">No hay</button>' +
                    '<button type="button" class="admin-btn admin-btn-compact admin-ped-disp-si' + siAct + '" data-pedido-id="' + esc(p.id) + '" data-item-id="' + esc(it.itemId) + '">Sí hay</button>' +
                    '</div>';
            } else {
                revBlock = tagDisponibilidad(it.disponibilidad);
            }
            var comBlock = '';
            if (obebe && p.estado !== 'revisado' && p.estado !== 'cancelado') {
                comBlock = '<label class="admin-ped-com-label">Comentario' +
                    '<textarea class="admin-ped-com-input" rows="2" placeholder="Opcional…" data-pedido-id="' + esc(p.id) + '" data-item-id="' + esc(it.itemId) + '">' +
                    esc(it.comentarioObebe || '') + '</textarea></label>';
            } else if (it.comentarioObebe) {
                comBlock = '<p class="admin-ped-com-read"><strong>Comentario:</strong> ' + esc(it.comentarioObebe) + '</p>';
            }
            var accionesItem = '';
            if (obebe && p.estado === 'revisado' && it.disponibilidad === 'no') {
                if (it.clienteConfirmoNoHay) {
                    accionesItem = '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm admin-ped-quitar-item-obebe" data-pedido-id="' +
                        esc(p.id) + '" data-item-id="' + esc(it.itemId) + '">Quitar del pedido</button>';
                } else {
                    accionesItem = '<span class="admin-muted-text admin-ped-espera-conf">Esperando confirmación del cliente</span>';
                }
            } else if (!obebe && p.estado === 'revisado' && !p.ventaRetailRegistradaEn && it.disponibilidad === 'no') {
                accionesItem = '<div class="admin-ped-item-acciones-cliente">' +
                    (it.clienteConfirmoNoHay
                        ? '<button type="button" class="admin-btn admin-btn-danger admin-btn-sm admin-ped-quitar-item-cliente" data-pedido-id="' +
                        esc(p.id) + '" data-item-id="' + esc(it.itemId) + '">Quitar artículo</button>'
                        : '<button type="button" class="admin-btn admin-btn-warn admin-btn-sm admin-ped-conf-no-cliente" data-pedido-id="' +
                        esc(p.id) + '" data-item-id="' + esc(it.itemId) + '">Confirmo ausencia</button>' +
                        '<button type="button" class="admin-btn admin-btn-danger admin-btn-sm admin-ped-quitar-item-cliente" data-pedido-id="' +
                        esc(p.id) + '" data-item-id="' + esc(it.itemId) + '">Quitar artículo</button>') +
                    '</div>';
            }
            var notaTier = it.notaPrecio ? '<span class="admin-muted-text">' + esc(it.notaPrecio) + '</span>' : '';
            return '<div class="admin-ped-rev-item">' +
                thumbHtml(url, it.nombre, 'admin-ped-rev-thumb', candidatosImagenFila(filaIt)) +
                '<div class="admin-ped-rev-info"><strong class="admin-ped-rev-nombre">' + esc(it.nombre) + '</strong>' +
                '<span class="admin-muted-text">' + esc(it.talla) + ' · ' + esc(it.color) + ' · ×' + it.cantidad + '</span>' +
                '<span>' + fmt(it.precioCliente) + ' c/u · tienda ' + fmt(it.precioRetail) + '</span>' +
                notaTier + revBlock + comBlock + accionesItem + '</div></div>';
        }

        function detalleListaPedidos(lista, obebe) {
            if (!lista.length) {
                return '<p class="admin-muted-text" style="padding:1rem">Sin pedidos todavía.</p>';
            }
            return lista.map(function (p) {
                var items = (p.items || []).map(function (it) {
                    return htmlItemPedido(it, p, obebe);
                }).join('');
                var head = obebe
                    ? '<strong>' + esc(p.clienteNombre || p.clienteKey) + '</strong> · '
                    : '';
                var confirmObebe = '';
                if (obebe && p.estado !== 'revisado' && p.estado !== 'cancelado') {
                    var listo = ObebeMayoreoPedidosStore.todosItemsMarcados(p);
                    confirmObebe = '<div class="admin-ped-acciones-pedido-obebe admin-ped-acciones-pedido-obebe--col">' +
                        '<div class="admin-ped-acciones-par">' +
                        '<button type="button" class="admin-btn admin-btn-danger admin-btn-compact admin-ped-eliminar" data-pedido-id="' + esc(p.id) + '">Eliminar pedido</button>' +
                        '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact admin-ped-confirmar-revision" data-pedido-id="' + esc(p.id) + '"' +
                        (listo ? '' : ' disabled') + '>Enviar respuesta</button>' +
                        '</div>' +
                        '<span class="admin-muted-text admin-ped-acciones-hint">Marca cada prenda antes de enviar.</span></div>';
                } else if (obebe && p.estado === 'revisado') {
                    var ventaPedBtn = '';
                    if (p.ventaRetailRegistradaEn) {
                        ventaPedBtn = '<span class="admin-tag admin-tag-ok">Venta registrada · ' +
                            esc(fmtFechaPedido(p.ventaRetailRegistradaEn)) + '</span>';
                    } else {
                        var haySi = (p.items || []).some(function (it) { return it.disponibilidad === 'si'; });
                        ventaPedBtn = '<button type="button" class="admin-btn admin-btn-primary admin-btn-compact admin-ped-venta-confirmada" data-pedido-id="' + esc(p.id) + '"' +
                            (haySi ? '' : ' disabled') + '>Venta confirmada</button>';
                    }
                    confirmObebe = '<div class="admin-ped-acciones-pedido-obebe">' +
                        '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-ped-reabrir-revision" data-pedido-id="' + esc(p.id) + '"' +
                        (p.ventaRetailRegistradaEn ? ' disabled title="Ya hay venta registrada"' : '') +
                        '>Modificar respuesta</button>' +
                        '<div class="admin-ped-acciones-par">' +
                        '<button type="button" class="admin-btn admin-btn-danger admin-btn-compact admin-ped-eliminar" data-pedido-id="' + esc(p.id) + '">Eliminar pedido</button>' +
                        ventaPedBtn +
                        '</div></div>';
                }
                if (!obebe) {
                    var abierto = !!expandedPedidos[p.id];
                    var msgNaty = '';
                    if (p.estado === 'revisado') {
                        var hay = (p.items || []).filter(function (it) { return it.disponibilidad === 'si'; }).length;
                        var noHay = (p.items || []).filter(function (it) { return it.disponibilidad === 'no'; }).length;
                        msgNaty = '<p class="admin-ped-resumen-rev"><strong>Obebe Clothes:</strong> ' +
                            hay + ' con stock · ' + noHay + ' sin stock</p>';
                    } else if (p.estado === 'pendiente') {
                        msgNaty = '<p class="admin-muted-text">Esperando revisión…</p>';
                    } else if (p.estado === 'en_revision') {
                        var sinRev = (p.items || []).filter(function (it) {
                            return it.disponibilidad !== 'si' && it.disponibilidad !== 'no';
                        }).length;
                        msgNaty = sinRev
                            ? '<p class="admin-muted-text">Hay ' + sinRev + ' artículo(s) nuevo(s) por confirmar con Obebe Clothes. El resto conserva la respuesta anterior.</p>'
                            : '<p class="admin-muted-text">En revisión…</p>';
                    }
                    if (p.pedidoCombinado && p.avisoClienteTexto) {
                        var tagNuevo = !p.clienteVioAvisoEn ? ' <span class="admin-tag admin-tag-warn">Nuevo</span>' : '';
                        msgNaty = (msgNaty || '') + '<p class="admin-banner info admin-ped-aviso-combinado">' +
                            esc(p.avisoClienteTexto) + tagNuevo + '</p>';
                    }
                    var editandoEste = editingPedidoId === p.id;
                    var puedeEditar = p.estado !== 'cancelado' && !p.ventaRetailRegistradaEn;
                    var editRow = '<div class="admin-ped-edit-row">' +
                        (puedeEditar
                            ? (editandoEste
                                ? '<span class="admin-muted-text">Editando arriba en el catálogo…</span>'
                                : '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-ped-editar" data-pedido-id="' + esc(p.id) + '">Editar artículos</button>')
                            : (p.ventaRetailRegistradaEn
                                ? '<span class="admin-muted-text">Venta confirmada: no se puede editar ni eliminar.</span>'
                                : '')) +
                        (p.ventaRetailRegistradaEn
                            ? ''
                            : '<button type="button" class="admin-btn admin-btn-danger admin-btn-compact admin-ped-eliminar" data-pedido-id="' + esc(p.id) + '">Eliminar pedido</button>') +
                        '</div>';
                    return '<div class="admin-ped-card admin-ped-card--collapsible" data-pedido-id="' + esc(p.id) + '">' +
                        '<button type="button" class="admin-ped-card-toggle" data-pedido-id="' + esc(p.id) + '" aria-expanded="' + (abierto ? 'true' : 'false') + '">' +
                        '<span class="admin-ped-card-line1">' + esc(textoEstadoPedido(p.estado)) + ' · ' + esc(fmtFechaPedido(p.creadoEn)) +
                        (p.pedidoCombinado ? ' · Combinado' : '') + '</span>' +
                        '<span class="admin-ped-card-line2">' + p.unidades + ' pzas. · Total ' + fmt(p.totalCliente) + '</span>' +
                        '<span class="admin-ped-card-chevron" aria-hidden="true">' + (abierto ? '▾' : '▸') + '</span></button>' +
                        '<div class="admin-ped-card-body' + (abierto ? '' : ' admin-hidden') + '">' +
                        msgNaty +
                        '<div class="admin-ped-rev-list">' + items + '</div>' +
                        editRow +
                        '</div></div>';
                }
                var abiertoOb = !!expandedPedidos[p.id];
                var bannerCombOb = '';
                if (p.pedidoCombinado && p.avisoClienteTexto) {
                    bannerCombOb = '<p class="admin-banner info admin-ped-aviso-combinado">' + esc(p.avisoClienteTexto) +
                        (p.clienteNotificadoEn ? ' · Cliente notificado ' + esc(fmtFechaPedido(p.clienteNotificadoEn)) : '') +
                        '</p>';
                }
                var tierInfo = p.unidades ? '<span class="admin-muted-text">' +
                    esc(ObebeAdminData.etiquetaTierPedido(p.unidades)) + '</span>' : '';
                return '<div class="admin-ped-card admin-ped-card--collapsible" data-pedido-id="' + esc(p.id) + '">' +
                    '<button type="button" class="admin-ped-card-toggle" data-pedido-id="' + esc(p.id) + '" aria-expanded="' + (abiertoOb ? 'true' : 'false') + '">' +
                    '<span class="admin-ped-card-line1">' + head + etiquetaEstadoPedido(p.estado) + ' · ' + esc(fmtFechaPedido(p.creadoEn)) +
                    (p.pedidoCombinado ? ' · Combinado' : '') + '</span>' +
                    '<span class="admin-ped-card-line2">' + p.unidades + ' pzas. · Total ' + fmt(p.totalCliente) + '</span>' +
                    '<span class="admin-ped-card-chevron" aria-hidden="true">' + (abiertoOb ? '▾' : '▸') + '</span></button>' +
                    '<div class="admin-ped-card-body' + (abiertoOb ? '' : ' admin-hidden') + '">' +
                    bannerCombOb + tierInfo +
                    '<div class="admin-ped-rev-list admin-ped-rev-list--obebe">' + items + '</div>' +
                    confirmObebe +
                    (p.estado === 'cancelado'
                        ? '<div class="admin-ped-edit-row">' +
                        '<button type="button" class="admin-btn admin-btn-danger admin-btn-compact admin-ped-eliminar" data-pedido-id="' + esc(p.id) + '">Eliminar pedido</button></div>'
                        : '') +
                    '</div></div>';
            }).join('');
        }

        function pintarCatalogo() {
            var box = document.getElementById('adminPedCatalogo');
            if (!box) return;
            var list = filtrarCatalogo(false);
            var cnt = document.getElementById('adminPedContador');
            if (cnt) {
                cnt.textContent = list.length + ' artículo(s)' +
                    (list.length > MAX_CATALOGO ? ' (mostrando ' + MAX_CATALOGO + ')' : '');
            }
            if (!list.length) {
                box.innerHTML = '<p class="admin-muted-text">Sin resultados. Prueba otro filtro o pulsa <strong>Actualizar</strong>.</p>';
                return;
            }
            var slice = list.slice(0, MAX_CATALOGO);
            var u = unidadesCarrito();
            var modo = getModoActivo();
            box.innerHTML = slice.map(function (r) {
                var id = ObebeAdminData.idFilaInventario(r);
                var img = imagenFila(r, filasInv);
                var cands = candidatosImagenFila(r);
                var pr = precioVistaItem(r, u + 1, modo);
                var seg = r.segmento === 'Mujer' ? 'Mujer' : 'Hombre';
                var preciosLinea = '<span class="admin-ped-precios"><s>' + fmt(pr.retail) + '</s>';
                if (modo === '50' && (pr.precioMayoreo20 || 0) > 0) {
                    preciosLinea += ' · <s>' + fmt(pr.precioMayoreo20) + '</s>';
                }
                preciosLinea += ' → <strong>' + fmt(pr.precioCliente) + '</strong></span>';
                var earlyTag = (r.soloComprasEarly || (global.ObebeComprasEarlyStore && ObebeComprasEarlyStore.esEarlyAccessFila(r)))
                    ? '<span class="admin-tag admin-tag-warn">Próximo</span>' : '';
                var imgHtml = img
                    ? thumbHtml(img, r.nombre, 'admin-ped-thumb', cands.length ? cands : null)
                    : '<span class="admin-mayoreo-thumb-empty admin-ped-thumb"></span>';
                var segAttr = r.segmento === 'Mujer' ? 'Mujer' : 'Hombre';
                return '<div class="admin-ped-item" data-id="' + esc(id) + '" data-ref="' + esc(String(r.ref || '')) + '" data-nombre="' + esc(r.nombre) + '" data-talla="' + esc(r.talla) + '" data-color="' + esc(r.color) + '" data-marca="' + esc(r.marca) + '" data-tipo="' + esc(r.tipo) + '" data-segmento="' + esc(segAttr) + '" role="button" tabindex="0">' + imgHtml +
                    '<span class="admin-ped-item-info">' + ObebeAdminData.htmlRef(r.ref) +
                    '<strong>' + esc(r.nombre) + '</strong>' +
                    '<span class="admin-ped-tags"><span class="admin-tag admin-tag-muted">' + esc(seg) + '</span>' +
                    (modo === '20' ? '<span class="admin-tag admin-tag-ok">+20</span>' : '') +
                    (modo === '50' ? '<span class="admin-tag admin-tag-ok">+50</span>' : '') +
                    earlyTag +
                    '</span>' +
                    '<span>' + esc(r.talla) + ' · ' + esc(r.color) + ' · ' + esc(r.tipo) + ' · Stock ' + r.stock + '</span>' +
                    preciosLinea +
                    '<span class="admin-muted-text">' + esc(pr.nota) + '</span>' +
                    '<span class="admin-ped-item-foot">' +
                    '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact admin-ped-ver">Ver</button>' +
                    '<span class="admin-muted-text admin-ped-item-hint">Toca la tarjeta para agregar</span></span></span></div>';
            }).join('');
        }

        function pintarCarrito() {
            var box = document.getElementById('adminPedCarrito');
            if (!box) return;
            var u = unidadesCarrito();
            if (!carrito.length) {
                box.innerHTML = '<p class="admin-muted-text" style="padding:0 1rem">Carrito vacío.</p>';
                pintarCatalogo();
                return;
            }
            var totalR = 0;
            var totalC = 0;
            var rows = carrito.map(function (c, idx) {
                var pr = ObebeAdminData.precioPedidoMayoreo(c.fila, u);
                c.precioRetail = pr.retail;
                c.precioCliente = pr.precioCliente;
                var subR = pr.retail * c.cantidad;
                var subC = pr.precioCliente * c.cantidad;
                totalR += subR;
                totalC += subC;
                var img = c.imagenUrl || imagenFila(c.fila, filasInv);
                return '<tr><td class="admin-ped-cart-img-cell"><div class="admin-ped-cart-line">' +
                    thumbHtmlFila(c.fila, c.fila.nombre, 'admin-ped-cart-thumb') +
                    '<div>' + ObebeAdminData.htmlRef(c.fila.ref) +
                    '<span class="admin-ped-cart-name">' + esc(c.fila.nombre) + '</span>' +
                    '<span class="admin-muted-text">' + esc(c.fila.talla) + ' · ' + esc(c.fila.color) + '</span></div></div></td>' +
                    '<td><input type="number" min="1" max="' + c.fila.stock + '" value="' + c.cantidad + '" class="admin-venta-num admin-ped-qty" data-idx="' + idx + '"></td>' +
                    '<td><s>' + fmt(pr.retail) + '</s><br><strong>' + fmt(pr.precioCliente) + '</strong></td>' +
                    '<td>' + fmt(subC) + '</td>' +
                    '<td><button type="button" class="admin-btn admin-btn-danger admin-btn-compact admin-ped-quitar" data-idx="' + idx + '">Quitar</button></td></tr>';
            }).join('');
            box.innerHTML = '<div class="admin-table-wrap"><table class="admin-table admin-table-compact"><thead><tr>' +
                '<th>Artículo</th><th>Cant.</th><th>Precio u.</th><th>Subtotal</th><th></th></tr></thead><tbody>' +
                rows + '</tbody></table></div>' +
                '<p class="admin-ped-totales">Retail: <s>' + fmt(totalR) + '</s> · Tu total: <strong>' + fmt(totalC) + '</strong> · Ahorro: ' + fmt(totalR - totalC) +
                ' · <strong>' + u + '</strong> artículo' + (u === 1 ? '' : 's') + ' escogido' + (u === 1 ? '' : 's') + '</p>';
            pintarCatalogo();
        }

        function agregarAlCarrito(filaId) {
            var fila = catalogoConStock(filasInvConEarly(filasInv)).find(function (r) {
                return ObebeAdminData.idFilaInventario(r) === filaId;
            });
            if (!fila) return;
            var exist = carrito.find(function (c) { return c.id === filaId; });
            if (exist) {
                if (exist.cantidad >= fila.stock) return;
                exist.cantidad += 1;
            } else {
                carrito.push({
                    id: filaId,
                    fila: fila,
                    cantidad: 1,
                    imagenUrl: imagenFila(fila, filasInv)
                });
            }
            pintarCarrito();
        }

        function cerrarDrawerFiltros() {
            var drawer = document.getElementById('adminPedFiltros');
            var back = document.getElementById('adminPedFiltrosBackdrop');
            if (drawer) drawer.classList.remove('open');
            if (back) back.classList.add('admin-hidden');
            document.body.classList.remove('admin-ped-filtros-open');
        }

        function abrirDrawerFiltros() {
            var drawer = document.getElementById('adminPedFiltros');
            var back = document.getElementById('adminPedFiltrosBackdrop');
            if (drawer) drawer.classList.add('open');
            if (back) back.classList.remove('admin-hidden');
            document.body.classList.add('admin-ped-filtros-open');
        }

        function bindNaty() {
            rebuildFiltrosPanel();
            pintarCatalogo();
            pintarCarrito();
            actualizarUiFormPedido();

            var toggleF = document.getElementById('adminPedFiltrosToggle');
            if (toggleF) toggleF.onclick = abrirDrawerFiltros;
            var closeF = document.getElementById('adminPedFiltrosClose');
            if (closeF) closeF.onclick = cerrarDrawerFiltros;
            var backF = document.getElementById('adminPedFiltrosBackdrop');
            if (backF) backF.onclick = cerrarDrawerFiltros;

            var buscar = document.getElementById('adminPedBuscar');
            if (buscar) {
                buscar.oninput = function () {
                    pintarCatalogo();
                };
            }

            container.onclick = function (ev) {
                var modoBtn = ev.target.closest('.admin-ped-modo-btn');
                if (modoBtn) {
                    modoCatalogo = modoBtn.getAttribute('data-modo');
                    container.querySelectorAll('.admin-ped-modo-btn').forEach(function (b) {
                        b.classList.toggle('active', b === modoBtn);
                    });
                    rebuildFiltrosPanel();
                    pintarCatalogo();
                    if (window.matchMedia('(max-width: 900px)').matches) cerrarDrawerFiltros();
                    return;
                }
                var genBtn = ev.target.closest('.admin-ped-genero-btn');
                if (genBtn) {
                    generoCatalogo = genBtn.getAttribute('data-genero');
                    container.querySelectorAll('.admin-ped-genero-btn').forEach(function (b) {
                        b.classList.toggle('active', b === genBtn);
                    });
                    rebuildFiltrosPanel();
                    pintarCatalogo();
                    if (window.matchMedia('(max-width: 900px)').matches) cerrarDrawerFiltros();
                    return;
                }
                if (ev.target.id === 'adminPedLimpiarFiltros' || ev.target.closest('#adminPedLimpiarFiltros')) {
                    modoCatalogo = 'todos';
                    generoCatalogo = 'todos';
                    container.querySelectorAll('.admin-ped-modo-btn').forEach(function (b) {
                        b.classList.toggle('active', b.getAttribute('data-modo') === 'todos');
                    });
                    container.querySelectorAll('.admin-ped-genero-btn').forEach(function (b) {
                        b.classList.toggle('active', b.getAttribute('data-genero') === 'todos');
                    });
                    if (buscar) buscar.value = '';
                    rebuildFiltrosPanel();
                    pintarCatalogo();
                    if (window.matchMedia('(max-width: 900px)').matches) cerrarDrawerFiltros();
                    return;
                }
                var confNoCli = ev.target.closest('.admin-ped-conf-no-cliente');
                if (confNoCli) {
                    var rConf = ObebeMayoreoPedidosStore.confirmarNoHayItemCliente(
                        confNoCli.getAttribute('data-pedido-id'),
                        confNoCli.getAttribute('data-item-id'),
                        clienteKey
                    );
                    if (!rConf.ok) {
                        ObebeAdminDialog.alert({ title: 'No se pudo', message: rConf.error });
                        return;
                    }
                    pintarHistorial();
                    return;
                }
                var quitarCli = ev.target.closest('.admin-ped-quitar-item-cliente');
                if (quitarCli) {
                    ObebeAdminDialog.confirm({
                        title: '¿Quitar artículo?',
                        message: 'Se eliminará del pedido.',
                        confirmText: 'Quitar',
                        cancelText: 'Cancelar',
                        variant: 'danger'
                    }).then(function (ok) {
                        if (!ok) return;
                        var rQ = ObebeMayoreoPedidosStore.eliminarItemPedido(
                            quitarCli.getAttribute('data-pedido-id'),
                            quitarCli.getAttribute('data-item-id'),
                            'cliente',
                            clienteKey,
                            filasInv
                        );
                        if (!rQ.ok) {
                            ObebeAdminDialog.alert({ title: 'No se pudo', message: rQ.error });
                            return;
                        }
                        pintarHistorial();
                    });
                    return;
                }
                var togglePed = ev.target.closest('.admin-ped-card-toggle');
                if (togglePed) {
                    var pid = togglePed.getAttribute('data-pedido-id');
                    expandedPedidos[pid] = !expandedPedidos[pid];
                    if (expandedPedidos[pid]) {
                        ObebeMayoreoPedidosStore.marcarClienteVioAvisoPedido(pid, clienteKey);
                    }
                    pintarHistorial();
                    return;
                }
                var editPed = ev.target.closest('.admin-ped-editar');
                if (editPed) {
                    iniciarEdicionPedido(editPed.getAttribute('data-pedido-id'));
                    return;
                }
                var delPed = ev.target.closest('.admin-ped-eliminar');
                if (delPed) {
                    var delId = delPed.getAttribute('data-pedido-id');
                    ObebeAdminDialog.confirm({
                        title: 'Eliminar pedido',
                        message: 'Se borrará este pedido por completo. Esta acción no se puede deshacer.',
                        confirmText: 'Eliminar',
                        cancelText: 'Cancelar',
                        variant: 'danger'
                    }).then(function (ok) {
                        if (!ok) return;
                        Promise.resolve(ObebeMayoreoPedidosStore.eliminarPedido(delId, clienteKey)).then(function (res) {
                            if (!res.ok) {
                                ObebeAdminDialog.alert({ title: 'Error', message: res.error });
                                return;
                            }
                            if (editingPedidoId === delId) cancelarEdicionPedido();
                            delete expandedPedidos[delId];
                            pintarHistorial();
                            if (opts.onInventarioActualizado) opts.onInventarioActualizado();
                        });
                    });
                    return;
                }
                if (ev.target.id === 'adminPedCancelarEdicion' || ev.target.closest('#adminPedCancelarEdicion')) {
                    cancelarEdicionPedido();
                    return;
                }
                var verPed = ev.target.closest('.admin-ped-ver');
                if (verPed) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    var wrapVer = verPed.closest('.admin-ped-item');
                    if (wrapVer) {
                        abrirFotosArticulo(wrapVer.getAttribute('data-id'), {
                            ref: wrapVer.getAttribute('data-ref'),
                            nombre: wrapVer.getAttribute('data-nombre'),
                            talla: wrapVer.getAttribute('data-talla'),
                            color: wrapVer.getAttribute('data-color'),
                            marca: wrapVer.getAttribute('data-marca'),
                            tipo: wrapVer.getAttribute('data-tipo'),
                            segmento: wrapVer.getAttribute('data-segmento')
                        });
                    }
                    return;
                }
                var item = ev.target.closest('.admin-ped-item');
                if (item) {
                    agregarAlCarrito(item.getAttribute('data-id'));
                    return;
                }
                var quitar = ev.target.closest('.admin-ped-quitar');
                if (quitar) {
                    carrito.splice(parseInt(quitar.getAttribute('data-idx'), 10), 1);
                    pintarCarrito();
                    return;
                }
                if (ev.target.id === 'adminPedEnviar' || ev.target.closest('#adminPedEnviar')) {
                    var err = document.getElementById('adminPedError');
                    if (err) err.textContent = '';
                    if (!carrito.length) {
                        if (err) err.textContent = 'Agrega al menos un artículo al carrito.';
                        return;
                    }
                    var esEdicion = !!editingPedidoId;
                    ObebeAdminDialog.confirm({
                        title: esEdicion ? '¿Guardar y reenviar pedido?' : '¿Enviar pedido?',
                        message: esEdicion
                            ? (function () {
                                var pedEd = ObebeMayoreoPedidosStore.pedidosForCliente(clienteKey).find(function (x) {
                                    return x.id === editingPedidoId;
                                });
                                if (pedEd && pedEd.estado === 'revisado') {
                                    return 'Se actualizará el pedido. Los artículos que ya tenían respuesta se mantienen; solo lo nuevo lo revisará Obebe Clothes.';
                                }
                                return 'Se actualizará el pedido y Obebe Clothes lo revisará de nuevo.';
                            }())
                            : 'Se enviará el pedido a Obebe Clothes para revisión de disponibilidad.',
                        confirmText: esEdicion ? 'Sí, guardar' : 'Sí, enviar',
                        cancelText: 'Cancelar',
                        variant: 'warn',
                        cancelDanger: true
                    }).then(function (ok) {
                        if (!ok) return;
                        var u = unidadesCarrito();
                        var items = carrito.map(function (c) {
                            var pr = ObebeAdminData.precioPedidoMayoreo(c.fila, u);
                            var row = {
                                inventarioId: c.id,
                                ref: c.fila.ref,
                                nombre: c.fila.nombre,
                                talla: c.fila.talla,
                                color: c.fila.color,
                                marca: c.fila.marca,
                                tipo: c.fila.tipo,
                                cantidad: c.cantidad,
                                precioRetail: pr.retail,
                                precioCliente: pr.precioCliente,
                                notaPrecio: pr.nota,
                                imagenUrl: c.imagenUrl || imagenFila(c.fila, filasInv),
                                disponibilidad: null
                            };
                            if (c.itemId) row.itemId = c.itemId;
                            return row;
                        });
                        var enviarP = Promise.resolve().then(function () {
                            if (editingPedidoId) {
                                return ObebeMayoreoPedidosStore.actualizarPedidoCliente(editingPedidoId, clienteKey, items);
                            }
                            return ObebeMayoreoPedidosStore.registrarPedido({
                                clienteKey: clienteKey,
                                clienteNombre: clienteNombre,
                                items: items
                            });
                        }).then(minimoCargaMs(1000));
                        var promEnvio = global.ObebeAdminDialog && ObebeAdminDialog.mientras
                            ? ObebeAdminDialog.mientras(enviarP, 'Enviando pedido…')
                            : enviarP;
                        promEnvio.then(function (r) {
                            if (!r.ok) {
                                if (err) err.textContent = r.error;
                                return;
                            }
                            var fueEdicion = esEdicion;
                            var pidAbierto = editingPedidoId;
                            if (pidAbierto) expandedPedidos[pidAbierto] = true;
                            editingPedidoId = null;
                            carrito = [];
                            var msgOk = 'Obebe Clothes revisará cada artículo y te avisará qué hay en stock.';
                            if (fueEdicion && r.pendienteRevision) {
                                msgOk = 'Pedido guardado. Obebe Clothes solo debe confirmar los artículos nuevos; el resto mantiene la respuesta anterior.';
                            } else if (fueEdicion) {
                                msgOk = 'Pedido actualizado. Todos los artículos siguen con la misma respuesta de disponibilidad.';
                            }
                            ObebeAdminDialog.alert({
                                title: fueEdicion ? 'Pedido actualizado' : 'Pedido enviado',
                                message: msgOk,
                                confirmText: 'Perfecto'
                            }).then(function () { pintar(); });
                        }).catch(function (e) {
                            if (err) err.textContent = (e && e.message) || 'No se pudo enviar.';
                        });
                    });
                }
            };

            container.onchange = function (ev) {
                if (ev.target.classList.contains('admin-ped-filter-cb')) {
                    pintarCatalogo();
                    return;
                }
                var qty = ev.target.closest('.admin-ped-qty');
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

        function bindObebe() {
            var sel = document.getElementById('adminPedFiltroCliente');
            if (sel) {
                sel.onchange = function () {
                    filtroCliente = sel.value;
                    pintar();
                };
            }
            container.onclick = function (ev) {
                var quitarOb = ev.target.closest('.admin-ped-quitar-item-obebe');
                if (quitarOb) {
                    ObebeAdminDialog.confirm({
                        title: '¿Quitar artículo?',
                        message: 'El cliente ya confirmó que no hay stock.',
                        confirmText: 'Quitar',
                        cancelText: 'Cancelar',
                        variant: 'danger'
                    }).then(function (ok) {
                        if (!ok) return;
                        filasInv = (ObebeAdminData.getEstado().filas || filasInv);
                        var rOb = ObebeMayoreoPedidosStore.eliminarItemPedido(
                            quitarOb.getAttribute('data-pedido-id'),
                            quitarOb.getAttribute('data-item-id'),
                            'obebe',
                            null,
                            filasInv
                        );
                        if (!rOb.ok) {
                            ObebeAdminDialog.alert({ title: 'No se pudo', message: rOb.error });
                            return;
                        }
                        pintar();
                    });
                    return;
                }
                var togglePed = ev.target.closest('.admin-ped-card-toggle');
                if (togglePed) {
                    var pidT = togglePed.getAttribute('data-pedido-id');
                    expandedPedidos[pidT] = !expandedPedidos[pidT];
                    pintar();
                    return;
                }
                var si = ev.target.closest('.admin-ped-disp-si');
                if (si) {
                    ObebeMayoreoPedidosStore.marcarItemDisponibilidad(
                        si.getAttribute('data-pedido-id'),
                        si.getAttribute('data-item-id'),
                        'si'
                    );
                    pintar();
                    return;
                }
                var no = ev.target.closest('.admin-ped-disp-no');
                if (no) {
                    ObebeMayoreoPedidosStore.marcarItemDisponibilidad(
                        no.getAttribute('data-pedido-id'),
                        no.getAttribute('data-item-id'),
                        'no'
                    );
                    pintar();
                    return;
                }
                var reabrir = ev.target.closest('.admin-ped-reabrir-revision');
                if (reabrir) {
                    var pidRe = reabrir.getAttribute('data-pedido-id');
                    ObebeAdminDialog.confirm({
                        title: '¿Modificar respuesta?',
                        message: 'Podrás cambiar disponibilidad y comentarios. El inventario de NATY se ajustará al volver a enviar.',
                        confirmText: 'Modificar',
                        cancelText: 'Cancelar',
                        variant: 'warn',
                        cancelDanger: true
                    }).then(function (ok) {
                        if (!ok) return;
                        ObebeMayoreoPedidosStore.reabrirRevisionPedido(pidRe).then(function (rRe) {
                            if (!rRe.ok) {
                                ObebeAdminDialog.alert({ title: 'No se pudo', message: rRe.error });
                                return;
                            }
                            filasInv = (ObebeAdminData.getEstado().filas || filasInv);
                            if (opts.onInventarioActualizado) opts.onInventarioActualizado();
                            expandedPedidos[pidRe] = true;
                            pintar();
                        });
                    });
                    return;
                }
                var ventaConf = ev.target.closest('.admin-ped-venta-confirmada');
                if (ventaConf) {
                    var pidVenta = ventaConf.getAttribute('data-pedido-id');
                    ObebeAdminDialog.confirm({
                        title: '¿Confirmar compra?',
                        message: 'Se registrará la venta de hoy con los artículos marcados como Sí hay.',
                        confirmText: 'Confirmar compra',
                        cancelText: 'Cancelar',
                        variant: 'warn',
                        cancelDanger: true
                    }).then(function (ok) {
                        if (!ok) return;
                        ObebeMayoreoPedidosStore.confirmarVentaRetailPedido(pidVenta).then(function (rV) {
                            if (!rV.ok) {
                                ObebeAdminDialog.alert({ title: 'No se pudo', message: rV.error });
                                return;
                            }
                            var promVentas = opts.onVentasActualizada
                                ? opts.onVentasActualizada()
                                : Promise.resolve();
                            promVentas.then(function () {
                                var n = rV.lineas || 0;
                                ObebeAdminDialog.alert({
                                    title: 'Venta registrada',
                                    message: (rV.soloLocal
                                        ? 'Guardado en este navegador (' + n + ' línea(s)).'
                                        : n + ' línea(s) en Ventas con fecha de hoy.') +
                                        ' Revisa el módulo Ventas.',
                                    confirmText: 'Listo'
                                }).then(function () { pintar(); });
                            });
                        });
                    });
                    return;
                }
                var conf = ev.target.closest('.admin-ped-confirmar-revision');
                if (conf) {
                    var pidConf = conf.getAttribute('data-pedido-id');
                    ObebeAdminDialog.confirm({
                        title: '¿Enviar respuesta al cliente?',
                        message: clienteNombre + ' verá disponibilidad y comentarios por artículo.',
                        confirmText: 'Enviar respuesta',
                        cancelText: 'Volver',
                        variant: 'warn'
                    }).then(function (ok) {
                        if (!ok) return;
                        var envioRespP = ObebeMayoreoPedidosStore.confirmarRevisionPedido(pidConf).then(minimoCargaMs(700));
                        var promResp = global.ObebeAdminDialog && ObebeAdminDialog.mientras
                            ? ObebeAdminDialog.mientras(envioRespP, 'Enviando respuesta…')
                            : envioRespP;
                        promResp.then(function (res) {
                            if (!res.ok) {
                                ObebeAdminDialog.alert({ title: 'Falta revisar', message: res.error });
                                return;
                            }
                            filasInv = (ObebeAdminData.getEstado().filas || filasInv);
                            if (opts.onInventarioActualizado) opts.onInventarioActualizado();
                            var msgOk = clienteNombre + ' verá qué hay y qué no.';
                            if (res.stockObebe && res.stockObebe.count > 0) {
                                msgOk += ' Stock Obebe descontado.';
                            }
                            ObebeAdminDialog.alert({
                                title: 'Respuesta enviada',
                                message: msgOk,
                                confirmText: 'Listo'
                            }).then(function () { return cerrarRespuestaEnviadaConCarga(); });
                        }).catch(function (err) {
                            ObebeAdminDialog.alert({
                                title: 'No se pudo enviar',
                                message: String((err && err.message) || err || 'Intenta de nuevo.')
                            });
                        });
                    });
                    return;
                }
                var delPedOb = ev.target.closest('.admin-ped-eliminar');
                if (delPedOb) {
                    var delIdOb = delPedOb.getAttribute('data-pedido-id');
                    ObebeAdminDialog.confirm({
                        title: 'Eliminar pedido',
                        message: 'Se quitará este pedido del listado.',
                        confirmText: 'Eliminar',
                        cancelText: 'Cancelar',
                        variant: 'danger'
                    }).then(function (ok) {
                        if (!ok) return;
                        Promise.resolve(ObebeMayoreoPedidosStore.eliminarPedido(delIdOb)).then(function (resOb) {
                            if (!resOb.ok) {
                                ObebeAdminDialog.alert({ title: 'Error', message: resOb.error });
                                return;
                            }
                            if (opts.onInventarioActualizado) opts.onInventarioActualizado();
                            pintar();
                        });
                    });
                }
            };
            container.onchange = null;
            container.oninput = function (ev) {
                var ta = ev.target.closest('.admin-ped-com-input');
                if (!ta) return;
                ObebeMayoreoPedidosStore.actualizarComentarioItem(
                    ta.getAttribute('data-pedido-id'),
                    ta.getAttribute('data-item-id'),
                    ta.value
                );
            };
        }

        function syncStockPedidosPendientes() {
            if (!modoObebe || !ObebeAdminData.aplicarStockPendientePedidosMayoreo) return;
            ObebeAdminData.aplicarStockPendientePedidosMayoreo().then(function (r) {
                if (!r || !r.aplicados) return;
                filasInv = ObebeAdminData.getEstado().filas || filasInv;
                if (opts.onInventarioActualizado) opts.onInventarioActualizado();
                pintar();
            }).catch(function () { /* stock en segundo plano */ }).finally(function () {
                if (global.ObebeAdminDialog && ObebeAdminDialog.forzarOcultarOcupado) {
                    ObebeAdminDialog.forzarOcultarOcupado();
                }
            });
        }

        setOverlayEnvio(false);
        if (global.ObebeAdminDialog && ObebeAdminDialog.forzarOcultarOcupado) {
            ObebeAdminDialog.forzarOcultarOcupado();
        }
        document.body.classList.remove('admin-mayoreo-envio-lock');
        syncStockPedidosPendientes();
        pintar();
    }

    global.ObebeAdminMayoreoPedidos = { mount: mount };
})(window);
