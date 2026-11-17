(function (global) {
    'use strict';

    var AGOTADOS_SEARCH_DEBOUNCE_MS = 280;
    var AGOTADOS_RENDER_MAX = 200;

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function filaKey(f) {
        if (!f) return '0';
        return String(f.inventarioDbId || f.filaSheet || '0');
    }

    function normAg(s) {
        return String(s || '').trim().toLowerCase();
    }

    function blobAgotado(r) {
        if (!r) return '';
        if (r._agBlob) return r._agBlob;
        r._agBlob = [r.nombre, r.marca, r.tipo, r.color, r.talla, String(r.ref || '')].join(' ').toLowerCase();
        return r._agBlob;
    }

    function filtrarAgotados(list, query) {
        query = normAg(query);
        var tokens = query ? query.split(/\s+/).filter(Boolean) : [];
        if (!tokens.length) return list;
        return (list || []).filter(function (r) {
            var blob = blobAgotado(r);
            for (var i = 0; i < tokens.length; i++) {
                if (blob.indexOf(tokens[i]) < 0) return false;
            }
            return true;
        });
    }

    function filasAgotadasDesde(arr) {
        return (arr || []).filter(function (r) { return (r.stock || 0) === 0; });
    }

    function ordenarAgotadas(list) {
        return list.slice().sort(function (a, b) {
            var ta = ObebeAdminData.timestampAgotadoFila(b.filaSheet);
            var tb = ObebeAdminData.timestampAgotadoFila(a.filaSheet);
            if (ta !== tb) return ta - tb;
            return (b.filaSheet || 0) - (a.filaSheet || 0);
        });
    }

    function mount(container, opts) {
        opts = opts || {};

        function filasVivas() {
            var st = ObebeAdminData.getEstado ? ObebeAdminData.getEstado() : {};
            return (st.filas && st.filas.length) ? st.filas : (opts.filas || []);
        }

        var filtro = '';
        var searchTimer = null;
        var baseAgotadas = null;

        function reconstruirBase() {
            var list = ordenarAgotadas(filasAgotadasDesde(filasVivas()));
            list.forEach(blobAgotado);
            baseAgotadas = list;
            return list;
        }

        function listaFiltrada() {
            if (!baseAgotadas) reconstruirBase();
            return filtrarAgotados(baseAgotadas, filtro);
        }

        function filaThumbHtml(r) {
            var url = ObebeAdminData.urlImagenFilaInventario(r);
            if (!url) {
                return '<span class="admin-mayoreo-thumb-empty admin-inv-thumb"></span>';
            }
            var base = url.split('?')[0];
            var q = url.indexOf('?') >= 0 ? '?' + url.split('?').slice(1).join('?') : '';
            var fb1 = base.replace(/\.avif$/i, '.webp') + q;
            if (fb1 === url) fb1 = base.replace(/\.webp$/i, '.jpeg') + q;
            var cands = [url, base.replace(/\.(avif|webp)$/i, '.avif') + q, fb1, base.replace(/\.(avif|webp)$/i, '.jpg') + q]
                .filter(function (v, i, a) { return v && a.indexOf(v) === i; });
            return '<img src="' + esc(cands[0]) + '" alt="" class="admin-inv-thumb" loading="lazy" decoding="async" ' +
                'data-candidate-step="0" data-candidates="' + esc(cands.join('|')) + '" ' +
                'data-fb1="' + esc(fb1) + '" data-fb2="' + esc(base.replace(/\.(avif|webp)$/i, '.jpg') + q) + '" ' +
                'onerror="typeof adminMayoreoImgFallback===\'function\'&&adminMayoreoImgFallback(this)">';
        }

        function pintarTbody() {
            var wrap = container.querySelector('#adminAgotadosTable .admin-table-wrap tbody');
            if (!wrap) {
                pintarCompleto();
                return;
            }
            var listAll = listaFiltrada();
            var trunc = listAll.length > AGOTADOS_RENDER_MAX;
            var list = trunc ? listAll.slice(0, AGOTADOS_RENDER_MAX) : listAll;
            var tbody = list.map(function (r) {
                var k = filaKey(r);
                return '<tr class="admin-agotados-row" data-inv-row-key="' + esc(k) + '">' +
                    '<td class="admin-inv-thumb-cell">' + filaThumbHtml(r) + '</td>' +
                    '<td>#' + r.ref + '</td><td>' + esc(r.nombre) + '</td>' +
                    '<td>' + esc(r.talla) + '</td><td>' + esc(r.color) + '</td>' +
                    '<td>' + esc(r.marca) + '</td>' +
                    '<td><span class="admin-tag admin-tag-danger">0</span></td>' +
                    '<td><input type="number" min="1" value="1" class="admin-venta-num admin-hist-stock-input" ' +
                    'data-row-key="' + esc(k) + '" aria-label="Nuevo stock"></td>' +
                    '<td><button type="button" class="admin-btn admin-btn-primary admin-btn-compact admin-hist-guardar" data-row-key="' +
                    esc(k) + '">Regresar a inventario</button></td></tr>';
            }).join('');
            wrap.innerHTML = tbody || '<tr><td colspan="9">No hay artículos agotados.</td></tr>';

            var cnt = document.getElementById('adminAgotadosCount');
            if (cnt) {
                var extra = trunc ? ' (mostrando ' + AGOTADOS_RENDER_MAX + ' — acota la búsqueda)' : '';
                cnt.textContent = listAll.length + ' artículo(s) agotado(s)' + extra;
            }
        }

        function pintarCompleto() {
            var listAll = listaFiltrada();
            var trunc = listAll.length > AGOTADOS_RENDER_MAX;
            var list = trunc ? listAll.slice(0, AGOTADOS_RENDER_MAX) : listAll;
            var tbody = list.map(function (r) {
                var k = filaKey(r);
                return '<tr class="admin-agotados-row" data-inv-row-key="' + esc(k) + '">' +
                    '<td class="admin-inv-thumb-cell">' + filaThumbHtml(r) + '</td>' +
                    '<td>#' + r.ref + '</td><td>' + esc(r.nombre) + '</td>' +
                    '<td>' + esc(r.talla) + '</td><td>' + esc(r.color) + '</td>' +
                    '<td>' + esc(r.marca) + '</td>' +
                    '<td><span class="admin-tag admin-tag-danger">0</span></td>' +
                    '<td><input type="number" min="1" value="1" class="admin-venta-num admin-hist-stock-input" ' +
                    'data-row-key="' + esc(k) + '" aria-label="Nuevo stock"></td>' +
                    '<td><button type="button" class="admin-btn admin-btn-primary admin-btn-compact admin-hist-guardar" data-row-key="' +
                    esc(k) + '">Regresar a inventario</button></td></tr>';
            }).join('');

            var tableHost = document.getElementById('adminAgotadosTable');
            if (tableHost) {
                tableHost.innerHTML =
                    '<div class="admin-table-wrap admin-agotados-scroll"><table class="admin-table"><thead><tr>' +
                    '<th>Foto</th><th>Ref</th><th>Nombre</th><th>Talla</th><th>Color</th><th>Marca</th>' +
                    '<th>Stock actual</th><th>Nuevo stock</th><th></th></tr></thead><tbody>' +
                    (tbody || '<tr><td colspan="9">No hay artículos agotados.</td></tr>') +
                    '</tbody></table></div>';
            }
            var cnt = document.getElementById('adminAgotadosCount');
            if (cnt) {
                var extra = trunc ? ' (mostrando ' + AGOTADOS_RENDER_MAX + ' — acota la búsqueda)' : '';
                cnt.textContent = listAll.length + ' artículo(s) agotado(s)' + extra;
            }
        }

        function refrescarDesde(optsIn) {
            optsIn = optsIn || {};
            if (optsIn.filas) opts.filas = optsIn.filas;
            baseAgotadas = null;
            reconstruirBase();
            pintarTbody();
        }

        if (container._obebeAgotadosMounted) {
            refrescarDesde(opts);
            return;
        }
        container._obebeAgotadosMounted = true;

        container.innerHTML =
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Agotados</h3>' +
            '<input type="search" class="admin-search" id="adminAgotadosSearch" placeholder="Buscar…"></div>' +
            '<p id="adminAgotadosCount" class="admin-muted-text" style="padding:0 1rem 0.5rem;margin:0"></p>' +
            '<div id="adminAgotadosTable"></div></div>' +
            '<p id="adminAgotadosError" class="admin-login-error" role="alert"></p>';

        reconstruirBase();
        pintarCompleto();

        var searchEl = document.getElementById('adminAgotadosSearch');
        if (searchEl) {
            searchEl.addEventListener('input', function (e) {
                filtro = e.target.value;
                if (searchTimer) clearTimeout(searchTimer);
                searchTimer = setTimeout(pintarTbody, AGOTADOS_SEARCH_DEBOUNCE_MS);
            });
        }

        function encontrarFilaPorKey(key) {
            key = String(key || '');
            var list = filasVivas();
            var hit = list.find(function (f) { return filaKey(f) === key; });
            if (hit) return hit;
            var n = parseInt(key, 10);
            if (n && ObebeAdminData.buscarFilaInventarioPorSheetOId) {
                hit = ObebeAdminData.buscarFilaInventarioPorSheetOId(n);
                if (hit) return hit;
            }
            if (ObebeAdminData.buscarFilaInventarioPorRef) {
                return ObebeAdminData.buscarFilaInventarioPorRef(key);
            }
            return null;
        }

        if (!container._obebeAgotadosClick) {
            container._obebeAgotadosClick = true;
            container.addEventListener('click', function (ev) {
                var btn = ev.target.closest('.admin-hist-guardar');
                if (!btn || !container.contains(btn)) return;
                var key = btn.getAttribute('data-row-key');
                var hit = encontrarFilaPorKey(key);
                if (!hit) {
                    var err0 = document.getElementById('adminAgotadosError');
                    if (err0) err0.textContent = 'No se encontró la fila. Recarga inventario (Ctrl+F5).';
                    return;
                }
                var input = container.querySelector('.admin-hist-stock-input[data-row-key="' + key + '"]');
                var stock = input ? parseInt(input.value, 10) : 1;
                if (isNaN(stock) || stock < 1) {
                    var err = document.getElementById('adminAgotadosError');
                    if (err) err.textContent = 'El stock debe ser al menos 1.';
                    return;
                }
                var nom = hit.nombre || 'este artículo';
                var refArt = ObebeAdminData.refDeFilaInventario
                    ? ObebeAdminData.refDeFilaInventario(hit)
                    : (hit.ref || 0);
                var msg =
                    '¿Seguro que quieres devolver «' + nom + '» al inventario con stock ' + stock + '?';
                if (refArt && ObebeAdminData.refApartadaPedidoMayoreoSiHay &&
                    ObebeAdminData.refApartadaPedidoMayoreoSiHay(refArt)) {
                    msg += ' Este artículo (ref #' + refArt + ') está como «Sí hay» en un pedido mayoreo; ' +
                        'el stock se conservará en inventario aunque siga apartado para mayoreo.';
                }
                ObebeAdminDialog.confirm({
                    title: '¿Regresar a inventario?',
                    message: msg,
                    confirmText: 'Sí, regresar',
                    cancelText: 'Cancelar',
                    variant: 'warn'
                }).then(function (ok) {
                    if (!ok) return;
                    var errEl = document.getElementById('adminAgotadosError');
                    if (errEl) errEl.textContent = '';
                    btn.disabled = true;
                    var idSheet = ObebeAdminData.filaSheetInventario
                        ? ObebeAdminData.filaSheetInventario(hit)
                        : (hit.filaSheet || hit.inventarioDbId);
                    return ObebeAdminData.actualizarStockFila(idSheet, stock, {
                        fila: hit,
                        restockDesdeAgotados: true
                    });
                }).then(function (res) {
                    if (!res) return;
                    if (!res.ok) {
                        var errEl2 = document.getElementById('adminAgotadosError');
                        if (errEl2) errEl2.textContent = res.error || 'Error';
                        btn.disabled = false;
                        return;
                    }
                    baseAgotadas = null;
                    if (opts.onStockRestaurado) {
                        return Promise.resolve(opts.onStockRestaurado(hit, stock)).then(function () {
                            reconstruirBase();
                            pintarTbody();
                        });
                    }
                    reconstruirBase();
                    pintarTbody();
                }).catch(function (e) {
                    var errEl3 = document.getElementById('adminAgotadosError');
                    if (errEl3) errEl3.textContent = e.message || String(e);
                    btn.disabled = false;
                });
            });
        }

        container._obebeAgotadosRefrescar = refrescarDesde;
    }

    function refrescar(container) {
        if (container && container._obebeAgotadosRefrescar) {
            container._obebeAgotadosRefrescar();
        }
    }

    global.ObebeAdminAgotados = { mount: mount, refrescar: refrescar };
    global.ObebeAdminHistorico = global.ObebeAdminAgotados;
})(window);