(function () {
    'use strict';

    var NAV_ADMIN = [
        { type: 'link', id: 'dashboard', label: 'Dashboard', live: true },
        { type: 'link', id: 'registrar_venta', label: 'Registrar venta', live: true },
        { type: 'link', id: 'entregas', label: 'Entregas', live: true },
        {
            type: 'group',
            id: 'nav_grp_ventas',
            label: 'Ventas',
            children: [
                { id: 'ventas', label: 'Ventas', live: true },
                { id: 'clientes', label: 'Clientes', live: true },
                { id: 'gastos', label: 'Gastos', live: true }
            ]
        },
        {
            type: 'group',
            id: 'nav_grp_inventario',
            label: 'Inventario',
            children: [
                { id: 'inventario', label: 'Inventario', live: true },
                { id: 'pedidos', label: 'Pedidos', live: true },
                { id: 'compras', label: 'Compras', live: false },
                { id: 'historico', label: 'Histórico', live: true }
            ]
        },
        {
            type: 'group',
            id: 'nav_grp_mayoreo',
            label: 'Mayoreo',
            children: [
                { id: 'mayoreo', label: 'Mayoreo', live: true },
                { id: 'pedidos_mayoreo', label: 'Pedidos mayoreo', live: true }
            ]
        }
    ];

    var MODULOS_MAYOREO_CLIENTE = [
        { id: 'mayoreo', label: 'Inventario', live: true },
        { id: 'calendario_mayoreo', label: 'Calendario', live: true },
        { id: 'pedidos_mayoreo', label: 'Pedidos', live: true },
        { id: 'ventas_mayoreo', label: 'Ventas', live: true },
        { id: 'clientes_mayoreo', label: 'Clientes', live: true }
    ];

    var navGruposAbiertos = {
        nav_grp_ventas: false,
        nav_grp_inventario: false,
        nav_grp_mayoreo: false
    };

    function navEstructura(user) {
        if (user && ObebeAdminAuth.esMayoreoCliente(user)) {
            return MODULOS_MAYOREO_CLIENTE.map(function (m) {
                return { type: 'link', id: m.id, label: m.label, live: m.live };
            });
        }
        return NAV_ADMIN;
    }

    function navModulosFlat(user) {
        var out = [];
        navEstructura(user).forEach(function (entry) {
            if (entry.type === 'link') out.push(entry);
            else if (entry.children) {
                entry.children.forEach(function (c) { out.push(c); });
            }
        });
        return out;
    }

    function moduloPermitido(id) {
        return navModulosFlat(userActual).some(function (m) { return m.id === id; });
    }

    function navBadgeHtml(live) {
        if (live === false) return ' <span class="badge-soon">Próximo</span>';
        if (live === 'partial') return ' <span class="badge-soon">Parcial</span>';
        return '';
    }

    function navGrupoContieneModulo(grupo, modId) {
        return (grupo.children || []).some(function (c) { return c.id === modId; });
    }

    function idsGruposNav(user) {
        var ids = [];
        navEstructura(user).forEach(function (entry) {
            if (entry.type === 'group') ids.push(entry.id);
        });
        return ids;
    }

    /** Solo un grupo abierto; exceptoId = null cierra todos. */
    function sincronizarGruposNavAbiertos(exceptoId) {
        idsGruposNav(userActual).forEach(function (gid) {
            navGruposAbiertos[gid] = exceptoId != null && gid === exceptoId;
        });
    }

    function asegurarGrupoAbiertoParaVista() {
        var abierto = null;
        navEstructura(userActual).forEach(function (entry) {
            if (entry.type === 'group' && navGrupoContieneModulo(entry, vistaActual)) {
                abierto = entry.id;
            }
        });
        sincronizarGruposNavAbiertos(abierto);
    }

    function errorMayoreoVisible(msg) {
        var t = String(msg || '').trim();
        if (!t) return null;
        if (/cannot read properties|is not a function|undefined|null/i.test(t)) return null;
        return t;
    }

    function importarMayoreoSheetAlStore(clienteKeyOpcional) {
        if (!datosCache) datosCache = { filas: [], lineasMayoreo: [], errorMayoreo: null };
        var filasInv = datosCache.filas || [];
        var sheet = datosCache.lineasMayoreo || [];
        if (clienteKeyOpcional) {
            sheet = ObebeAdminData.filtrarLineasPorClienteMayoreo(sheet, clienteKeyOpcional);
        }
        if (!sheet.length) return;
        var enriquecidas = ObebeAdminData.enriquecerLineasMayoreoImagenes(sheet, filasInv);
        ObebeMayoreoStore.importFromSheet(enriquecidas);
    }

    function lineasDesdeStoreParaCalculo(clienteKey) {
        if (!datosCache) datosCache = { filas: [], lineasMayoreo: [], errorMayoreo: null };
        var filasInv = datosCache.filas || [];
        var raw = clienteKey
            ? ObebeMayoreoStore.getLineasForCliente(clienteKey)
            : ObebeMayoreoStore.getAllLineasEnriched();
        return raw.map(function (l) {
            var row = ObebeMayoreoStore.lineaToMayoreoRow(l);
            if (!row.imagenUrl) {
                row.imagenUrl = ObebeAdminData.imagenParaLineaMayoreo({
                    nombre: l.nombreSheet,
                    talla: l.talla,
                    color: l.color,
                    tipo: l.tipo,
                    marca: l.marca
                }, filasInv);
                if (row.imagenUrl) ObebeMayoreoStore.updateLinea(l.id, { imagenUrl: row.imagenUrl });
            }
            row.utilidadLinea = (row.precioRetail || 0) - (row.precioMayoreo || 0);
            return row;
        });
    }

    function datosMayoreoParaVista() {
        if (!datosCache) {
            datosCache = { filas: [], lineasMayoreo: [], errorMayoreo: null };
        }
        var vistaCliente = ObebeAdminAuth.esMayoreoCliente(userActual);
        var clienteKey = vistaCliente && userActual.clienteMayoreo ? userActual.clienteMayoreo : '';
        if ((datosCache.lineasMayoreo || []).length) {
            importarMayoreoSheetAlStore(vistaCliente ? clienteKey : null);
        }
        var lineas = vistaCliente
            ? lineasDesdeStoreParaCalculo(clienteKey)
            : lineasDesdeStoreParaCalculo(null);
        var clientes = ObebeAdminData.calcularClientesMayoreo(lineas);
        var resumen = ObebeAdminData.calcularResumenMayoreo(clientes, lineas);
        return {
            lineasMayoreo: lineas,
            clientesMayoreo: clientes,
            resumenMayoreo: resumen,
            errorMayoreo: errorMayoreoVisible(datosCache.errorMayoreo),
            vistaCliente: vistaCliente,
            usarStoreLocal: true,
            filasInv: datosCache.filas || [],
            clienteKey: vistaCliente && userActual.clienteMayoreo ? userActual.clienteMayoreo : ''
        };
    }

    var vistaActual = 'dashboard';
    var datosCache = null;
    var userActual = null;

    var elLogin = document.getElementById('adminLoginView');
    var elApp = document.getElementById('adminAppView');
    var elContent = document.getElementById('adminModuleContent');
    var elTitle = document.getElementById('adminPageTitle');
    var elNav = document.getElementById('adminNav');
    var elSidebar = document.getElementById('adminSidebar');
    var elBackdrop = document.getElementById('adminSidebarBackdrop');
    var elUserChip = document.getElementById('adminUserChip');

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function tagStock(stock) {
        if (stock <= 0) return '<span class="admin-tag admin-tag-danger">Agotado</span>';
        if (stock <= 2) return '<span class="admin-tag admin-tag-warn">Bajo (' + stock + ')</span>';
        return '<span class="admin-tag admin-tag-ok">' + stock + '</span>';
    }

    function renderNav() {
        var html = navEstructura(userActual).map(function (entry) {
            if (entry.type === 'link') {
                return '<button type="button" data-module="' + esc(entry.id) + '" class="' +
                    (entry.id === vistaActual ? 'active' : '') + '">' +
                    esc(entry.label) + navBadgeHtml(entry.live) + '</button>';
            }
            var abierto = !!navGruposAbiertos[entry.id];
            var hijoActivo = navGrupoContieneModulo(entry, vistaActual);
            var items = (entry.children || []).map(function (c) {
                return '<button type="button" data-module="' + esc(c.id) + '" class="admin-nav-sub' +
                    (c.id === vistaActual ? ' active' : '') + '">' +
                    esc(c.label) + navBadgeHtml(c.live) + '</button>';
            }).join('');
            return '<div class="admin-nav-group' + (abierto ? ' is-open' : '') + '" data-nav-group="' + esc(entry.id) + '">' +
                '<button type="button" class="admin-nav-group-toggle' + (hijoActivo ? ' has-active' : '') +
                '" data-nav-toggle="' + esc(entry.id) + '" aria-expanded="' + (abierto ? 'true' : 'false') + '">' +
                '<span class="admin-nav-group-label">' + esc(entry.label) + '</span>' +
                '<span class="admin-nav-chevron" aria-hidden="true">' + (abierto ? '▾' : '▸') + '</span></button>' +
                '<div class="admin-nav-group-items">' + items + '</div></div>';
        }).join('');
        elNav.innerHTML = html;

        elNav.querySelectorAll('[data-nav-toggle]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var gid = btn.getAttribute('data-nav-toggle');
                if (navGruposAbiertos[gid]) {
                    sincronizarGruposNavAbiertos(null);
                } else {
                    sincronizarGruposNavAbiertos(gid);
                }
                renderNav();
            });
        });
        elNav.querySelectorAll('[data-module]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                irModulo(btn.getAttribute('data-module'));
                cerrarSidebarMovil();
            });
        });
    }

    function irModulo(id) {
        var flat = navModulosFlat(userActual);
        if (userActual && !moduloPermitido(id)) {
            id = flat.length ? flat[0].id : 'dashboard';
        }
        vistaActual = id;
        var mod = flat.find(function (m) { return m.id === id; });
        elTitle.textContent = mod ? mod.label : 'Admin';
        asegurarGrupoAbiertoParaVista();
        renderNav();
        renderModulo(id);
    }

    function cerrarSidebarMovil() {
        elSidebar.classList.remove('open');
        elBackdrop.classList.add('admin-hidden');
    }

    function abrirSidebarMovil() {
        elSidebar.classList.add('open');
        elBackdrop.classList.remove('admin-hidden');
    }

    function resumenInventarioVacio() {
        return {
            unidades: 0, articulosUnicos: 0, agotados: 0, valorEstimado: 0,
            porMarca: {}, porSegmento: { Hombre: 0, Mujer: 0 }
        };
    }

    function promesaConTimeout(prom, ms) {
        return new Promise(function (resolve) {
            var listo = false;
            function fin(val) {
                if (listo) return;
                listo = true;
                resolve(val);
            }
            prom.then(function (v) { fin(v); }).catch(function (e) { fin({ __error: e }); });
            setTimeout(function () { fin({ __timeout: true }); }, ms);
        });
    }

    function baseDatosMayoreoCliente(inv) {
        inv = inv || {};
        return {
            filas: inv.filas || [],
            resumen: inv.resumen || resumenInventarioVacio(),
            encabezadosFila2: inv.encabezadosFila2 || [],
            errorInventario: inv.errorInventario || null,
            ventas: [],
            resumenVentas: ObebeAdminData.calcularResumenVentas([]),
            errorVentas: null,
            clientes: [],
            lineasMayoreo: [],
            clientesMayoreo: [],
            resumenMayoreo: ObebeAdminData.calcularResumenMayoreo([], []),
            errorMayoreo: null
        };
    }

    function cargarDatosMayoreoCliente(forzar) {
        var key = userActual && userActual.clienteMayoreo ? userActual.clienteMayoreo : 'naty';
        var tieneLocal = ObebeMayoreoStore.hasLineas(key);
        var necesitaSheet = !!forzar || !tieneLocal;

        if (tieneLocal && !forzar) {
            return Promise.resolve(baseDatosMayoreoCliente({ filas: [] }));
        }

        var invProm = promesaConTimeout(
            ObebeAdminData.cargarInventario(!!forzar).catch(function (err) {
                return {
                    filas: [],
                    resumen: resumenInventarioVacio(),
                    encabezadosFila2: [],
                    errorInventario: err.message || String(err)
                };
            }),
            12000
        );

        return invProm.then(function (inv) {
            if (inv && inv.__timeout) {
                inv = { filas: [], resumen: resumenInventarioVacio(), encabezadosFila2: [] };
            } else if (inv && inv.__error) {
                inv = {
                    filas: [],
                    resumen: resumenInventarioVacio(),
                    encabezadosFila2: [],
                    errorInventario: inv.__error.message || String(inv.__error)
                };
            }
            var base = baseDatosMayoreoCliente(inv);
            if (!necesitaSheet) return base;
            if (typeof ObebeAdminData.cargarMayoreo !== 'function') {
                return base;
            }
            return promesaConTimeout(ObebeAdminData.cargarMayoreo(!!forzar), 20000).then(function (m) {
                if (m && m.__timeout) {
                    base.errorMayoreo = 'No se pudo conectar a MAYOREO a tiempo. Si ya importaste, usa los datos locales.';
                    return base;
                }
                if (m && m.__error) {
                    base.errorMayoreo = m.__error.message || String(m.__error);
                    return base;
                }
                base.lineasMayoreo = m.lineasMayoreo;
                base.clientesMayoreo = m.clientesMayoreo;
                base.resumenMayoreo = m.resumenMayoreo;
                base.errorMayoreo = m.error || null;
                if ((m.lineasMayoreo || []).length) {
                    importarMayoreoSheetAlStore(key);
                }
                return base;
            });
        });
    }

    function enriquecerInventarioNatyEnFondo() {
        if (!userActual || !ObebeAdminAuth.esMayoreoCliente(userActual)) return;
        ObebeAdminData.cargarInventario(false).then(function (inv) {
            if (!datosCache) datosCache = baseDatosMayoreoCliente(inv);
            else datosCache.filas = inv.filas || [];
            if (vistaActual === 'mayoreo' || vistaActual === 'ventas_mayoreo' || vistaActual === 'pedidos_mayoreo') {
                renderModulo(vistaActual);
            }
        }).catch(function () { /* fotos opcionales */ });
    }

    function armarDatosParcialesDesdeInventario(inv) {
        inv = inv || {};
        return {
            filas: inv.filas || [],
            resumen: inv.resumen || resumenInventarioVacio(),
            encabezadosFila2: inv.encabezadosFila2 || [],
            ventas: (datosCache && datosCache.ventas) || [],
            resumenVentas: (datosCache && datosCache.resumenVentas) || ObebeAdminData.calcularResumenVentas([]),
            errorVentas: null,
            clientes: (datosCache && datosCache.clientes) || [],
            lineasMayoreo: (datosCache && datosCache.lineasMayoreo) || [],
            clientesMayoreo: (datosCache && datosCache.clientesMayoreo) || [],
            resumenMayoreo: (datosCache && datosCache.resumenMayoreo) ||
                ObebeAdminData.calcularResumenMayoreo([], []),
            errorMayoreo: null
        };
    }

    function cargarDatos(forzar) {
        var soloMayoreo = userActual && ObebeAdminAuth.esMayoreoCliente(userActual);
        var pintadoRapido = false;
        if (!soloMayoreo && !forzar && ObebeAdminData.snapshotInventarioCacheLocal) {
            var rapido = ObebeAdminData.snapshotInventarioCacheLocal();
            if (rapido && rapido.filas && rapido.filas.length) {
                datosCache = armarDatosParcialesDesdeInventario(rapido);
                renderModulo(vistaActual);
                pintadoRapido = true;
            }
        }
        if (!soloMayoreo && !pintadoRapido) {
            elContent.innerHTML = '<div class="admin-loading">Cargando INVENTARIO…</div>';
        } else if (soloMayoreo) {
            var keyNaty = userActual && userActual.clienteMayoreo ? userActual.clienteMayoreo : 'naty';
            if (!ObebeMayoreoStore.hasLineas(keyNaty)) {
                elContent.innerHTML = '<div class="admin-loading">Importando compras (solo la primera vez)…</div>';
            }
        }
        var prom;
        if (soloMayoreo) {
            prom = cargarDatosMayoreoCliente(!!forzar);
        } else {
            prom = ObebeAdminData.cargarTodo(!!forzar);
        }
        return prom.then(function (d) {
            datosCache = d;
            if (!soloMayoreo && pintadoRapido) {
                renderModulo(vistaActual);
            }
            if (soloMayoreo) {
                enriquecerInventarioNatyEnFondo();
            }
            if (!soloMayoreo && (d.lineasMayoreo || []).length) {
                importarMayoreoSheetAlStore(null);
            }
            return d;
        }).catch(function (err) {
            if (soloMayoreo) {
                datosCache = datosCache || baseDatosMayoreoCliente({ filas: [] });
                enriquecerInventarioNatyEnFondo();
                return datosCache;
            }
            throw err;
        });
    }

    function bannerFase() {
        return '<div class="admin-banner info">Fase MVP: lectura desde Google Sheets (INVENTARIO). ' +
            'Ventas, pedidos y escritura al Sheet llegarán con Apps Script. Sin Supabase todavía.</div>';
    }

    function graficoBarrasVentas(buckets, titulo, meta, ariaLabel) {
        buckets = buckets || [];
        var max = 0;
        buckets.forEach(function (b) {
            if (b.monto > max) max = b.monto;
        });
        var cols = buckets.map(function (b) {
            var pct = max > 0 ? Math.round((b.monto / max) * 100) : 0;
            if (b.monto > 0 && pct < 4) pct = 4;
            var val = b.monto > 0 ? ObebeAdminData.formatoMoney(b.monto) : '—';
            var cnt = b.count || 0;
            var inBar = cnt > 0
                ? '<span class="admin-bar-infill">' + cnt + '</span>'
                : '';
            var tip = b.label + ': ' + val + (cnt ? ' · ' + cnt + ' artículos' : '');
            return '<div class="admin-bar-col" title="' + esc(tip) + '">' +
                '<span class="admin-bar-val">' + (b.monto > 0 ? esc(val) : '') + '</span>' +
                '<div class="admin-bar-track"><div class="admin-bar-fill" style="height:' + pct + '%">' +
                inBar + '</div></div>' +
                '<span class="admin-bar-lbl">' + esc(b.label) + '</span></div>';
        }).join('');
        return '<div class="admin-panel admin-panel-chart">' +
            '<div class="admin-panel-head"><h3>' + esc(titulo) + '</h3>' +
            '<span class="admin-panel-head-meta">' + esc(meta) + '</span></div>' +
            '<div class="admin-bar-chart" role="img" aria-label="' + esc(ariaLabel) + '">' +
            (cols || '<p class="admin-muted-text">Sin datos de ventas</p>') +
            '</div></div>';
    }

    function graficoBarrasVentasPorMes(ventas) {
        return graficoBarrasVentas(
            ObebeAdminData.ventasPorMes(ventas, 12),
            'Ventas por mes',
            'Últimos 12 meses',
            'Gráfico de ventas por mes'
        );
    }

    function graficoBarrasVentasPorSemana(ventas) {
        return graficoBarrasVentas(
            ObebeAdminData.ventasPorSemana(ventas, 12),
            'Ventas por semana',
            'Últimas 12 semanas',
            'Gráfico de ventas por semana'
        );
    }

    function panelVentasDashboard(sv, ventas) {
        if (!sv) sv = { hoy: {}, semana: {}, mes: {} };
        var errV = ObebeAdminData.errorVentasParaUi
            ? ObebeAdminData.errorVentasParaUi(datosCache.errorVentas)
            : datosCache.errorVentas;
        var aviso = errV
            ? '<p class="admin-ventas-aviso">' + esc(errV) + '</p>' : '';
        return '<div class="admin-panel admin-panel-ventas admin-panel-ventas--focus">' +
            '<div class="admin-panel-head"><h3>Ventas</h3></div>' +
            '<div class="admin-panel-ventas-body">' + aviso +
            '<div class="admin-kpi-grid admin-kpi-grid--ventas-focus">' +
            kpiDestacado('Hoy', ObebeAdminData.formatoMoney(sv.hoy.monto || 0),
                (sv.hoy.count || 0) + ' artículos · ' + ObebeAdminData.etiquetaDia()) +
            kpiDestacado('Semana', ObebeAdminData.formatoMoney(sv.semana.monto || 0),
                (sv.semana.count || 0) + ' artículos · ' + ObebeAdminData.etiquetaRangoSemana()) +
            kpiDestacado('Mes actual', ObebeAdminData.formatoMoney(sv.mes.monto || 0),
                (sv.mes.count || 0) + ' artículos · ' + ObebeAdminData.etiquetaMesActual()) +
            '</div></div></div>' +
            graficoBarrasVentasPorMes(ventas || []);
    }

    function kpiDestacado(label, value, hint) {
        return '<div class="admin-kpi admin-kpi--destacado">' +
            '<div class="label">' + esc(label) + '</div>' +
            '<div class="value">' + esc(String(value)) + '</div>' +
            (hint ? '<div class="hint">' + esc(hint) + '</div>' : '') + '</div>';
    }

    function renderDashboard() {
        var r = datosCache.resumen;
        var sv = datosCache.resumenVentas || {};
        var marcasOrden = Object.keys(r.porMarca).map(function (k) {
            return { key: k, val: r.porMarca[k] };
        }).sort(function (a, b) { return b.val - a.val; });
        var marcasHtml = marcasOrden.map(function (x) {
            return '<tr><td>' + esc(x.key) + '</td><td>' + x.val + '</td></tr>';
        }).join('');

        elContent.innerHTML =
            '<div class="admin-dashboard-top">' +
            '<div class="admin-panel admin-panel-marcas admin-panel-marcas--focus"><div class="admin-panel-head"><h3>Stock por marca</h3></div>' +
            '<div class="admin-panel-marcas-table"><table class="admin-table admin-table-compact admin-table-marcas"><thead><tr><th>Marca</th><th>Stock</th></tr></thead><tbody>' +
            (marcasHtml || '<tr><td colspan="2">Sin datos</td></tr>') +
            '</tbody></table></div></div>' +
            '<div class="admin-kpi-grid admin-kpi-grid--dashboard admin-kpi-grid--dashboard-focus">' +
            kpiDestacado('Stock total', r.unidades, '') +
            kpiDestacado('Stock Hombre / Mujer', r.porSegmento.Hombre + ' / ' + r.porSegmento.Mujer, '') +
            kpiDestacado('Valor stock', ObebeAdminData.formatoMoney(r.valorEstimado), '') +
            '</div></div>' +
            panelVentasDashboard(sv, datosCache.ventas);
    }

    function kpi(label, value, hint) {
        return '<div class="admin-kpi"><div class="label">' + esc(label) + '</div>' +
            '<div class="value">' + esc(String(value)) + '</div>' +
            (hint ? '<div class="hint">' + esc(hint) + '</div>' : '') + '</div>';
    }

    function renderTablaBajoStock(filas, limite) {
        var bajos = filas.filter(function (r) { return r.stock > 0 && r.stock <= 2; })
            .sort(function (a, b) { return a.stock - b.stock; })
            .slice(0, limite);
        var rows = bajos.map(function (r) {
            return '<tr><td>#' + r.ref + '</td><td>' + esc(r.nombre) + '</td><td>' + esc(r.talla) + '</td>' +
                '<td>' + tagStock(r.stock) + '</td><td>' + esc(r.marca) + '</td></tr>';
        }).join('');
        return '<div class="admin-panel" style="margin-top:1rem"><div class="admin-panel-head"><h3>Existencias bajas</h3></div>' +
            '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Ref</th><th>Nombre</th><th>Talla</th><th>Stock</th><th>Marca</th></tr></thead><tbody>' +
            (rows || '<tr><td colspan="5">Ninguno con stock 1–2</td></tr>') + '</tbody></table></div></div>';
    }

    function tablaInventario(filas, limite) {
        limite = limite || 400;
        var rows = filas.slice(0, limite).map(function (r) {
            var link = ObebeAdminData.urlProductoWeb(r);
            return '<tr><td>' + r.ref + '</td><td>' + esc(r.nombre) + '</td><td>' + esc(r.marca) + '</td>' +
                '<td>' + esc(r.tipo) + '</td><td>' + esc(r.talla) + '</td><td>' + esc(r.color) + '</td>' +
                '<td>' + tagStock(r.stock) + '</td><td>' + ObebeAdminData.formatoMoney(r.precio) + '</td>' +
                '<td>' + esc(r.segmento) + '</td>' +
                '<td><a href="' + esc(link) + '" target="_blank" rel="noopener">Ver web</a></td></tr>';
        }).join('');
        var extra = filas.length > limite
            ? '<p style="padding:0.5rem 1rem;font-size:0.75rem;color:var(--admin-muted)">Mostrando ' + limite + ' de ' + filas.length + '. Usa la búsqueda para acotar.</p>' : '';
        return extra + '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
            '<th>Ref</th><th>Nombre</th><th>Marca</th><th>Tipo</th><th>Talla</th><th>Color</th><th>Stock</th><th>Precio</th><th>Cat.</th><th></th></tr></thead><tbody>' +
            (rows || '<tr><td colspan="10">Sin resultados</td></tr>') + '</tbody></table></div>';
    }

    function bindSearch(inputId, renderFn) {
        var input = document.getElementById(inputId);
        if (!input) return;
        input.addEventListener('input', function () {
            renderFn(input.value);
        });
    }

    function bannerAvisoSupabase() {
        var st = ObebeAdminData.getEstado();
        var msg = st && st.avisoSupabase ? String(st.avisoSupabase).trim() : '';
        if (!msg) return '';
        return '<div class="admin-banner warn" style="margin-bottom:1rem">' + esc(msg) + '</div>';
    }

    function renderInventario() {
        function pintarInv() {
            elContent.innerHTML = bannerAvisoSupabase() +
                '<div id="adminInvMount"></div>';
            ObebeAdminInventario.mount(
                document.getElementById('adminInvMount'),
                datosCache.filas,
                onReloadInventario,
                datosCache.encabezadosFila2
            );
        }
        function onReloadInventario() {
            return cargarDatos(true).then(function (d) {
                datosCache = d;
                if (vistaActual === 'inventario') pintarInv();
            });
        }
        ObebeAdminData.aplicarBajaStockMayoreoCollegiateHoodie().then(function (r) {
            if (r && r.aplicados > 0) {
                return cargarDatos(true).then(function (d) {
                    datosCache = d;
                });
            }
        }).catch(function () { /* ignore */ }).then(function () {
            pintarInv();
        });
    }

    function linkCortoVentas(url) {
        var u = String(url || '').trim();
        if (!u) return '—';
        var href = u.indexOf('http') === 0 ? u : 'https://' + u.replace(/^\/+/, '');
        var txt = u.length > 28 ? u.slice(0, 26) + '…' : u;
        return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(txt) + '</a>';
    }

    function ventasOrdenRecientes(list) {
        var retail = ObebeAdminData.filtrarVentas(list || [], '');
        return retail.slice().sort(function (a, b) {
            var ia = String(a.fechaIso || '');
            var ib = String(b.fechaIso || '');
            if (ia !== ib) return ia > ib ? -1 : 1;
            return (parseInt(b.filaSheet, 10) || 0) - (parseInt(a.filaSheet, 10) || 0);
        });
    }

    function bannerVentasSync() {
        if (ObebeAdminData.usarSupabase && ObebeAdminData.usarSupabase()) {
            return '<div class="admin-banner info">Ventas y stock en <strong>Supabase</strong>. La tienda debe usar <code>obebe-data-config.js</code> con el mismo origen.</div>';
        }
        if (ObebeAdminData.escrituraLocalHabilitada && ObebeAdminData.escrituraLocalHabilitada()) {
            return '<div class="admin-banner warn">Modo <strong>solo admin (local)</strong>: no escribe en Google Sheets. Configura Supabase o <code>appsScriptUrl</code>.</div>';
        }
        return '<div class="admin-banner info">Las ventas se escriben en <strong>VENTAS (B–N)</strong> y bajan stock vía Apps Script.</div>';
    }

    function onVentaRegistradaDesdeRetail(res) {
        var st = ObebeAdminData.getEstado();
        datosCache.filas = st.filas || datosCache.filas;
        datosCache.ventas = st.ventas || datosCache.ventas;
        datosCache.resumenVentas = ObebeAdminData.calcularResumenVentas(datosCache.ventas);
        datosCache.clientes = res.clientes || ObebeAdminData.calcularPerfilesClientes(datosCache.ventas);
        datosCache.resumen = ObebeAdminData.calcularResumen(datosCache.filas);
        if (vistaActual === 'registrar_venta') pintarTablaVentasUltimas();
        if (vistaActual === 'ventas') pintarTablaVentasRegistro();
    }

    function opcionesMountRetail() {
        return {
            filas: datosCache.filas || [],
            clientes: datosCache.clientes || [],
            vendedor: (userActual && userActual.nombre) ? userActual.nombre : 'OBEBE',
            getFilas: function () { return datosCache.filas || []; },
            onVentaRegistrada: onVentaRegistradaDesdeRetail
        };
    }

    function refrescarDatosTrasEditarVenta() {
        var st = ObebeAdminData.getEstado();
        datosCache.ventas = st.ventas || datosCache.ventas;
        datosCache.resumenVentas = ObebeAdminData.calcularResumenVentas(datosCache.ventas);
        datosCache.clientes = ObebeAdminData.calcularPerfilesClientes(datosCache.ventas);
        function repintarTablasVentas() {
            if (vistaActual === 'registrar_venta') pintarTablaVentasUltimas();
            if (vistaActual === 'ventas') pintarTablaVentasRegistro();
        }
        if (ObebeAdminData.usarSupabase && ObebeAdminData.usarSupabase()) {
            return ObebeAdminData.cargarVentas(true).then(function (p) {
                datosCache.ventas = p.ventas;
                datosCache.resumenVentas = p.resumenVentas;
                datosCache.clientes = p.clientes || datosCache.clientes;
                return ObebeAdminData.cargarInventario(true).then(function (inv) {
                    datosCache.filas = inv.filas;
                    datosCache.resumen = ObebeAdminData.calcularResumen(inv.filas);
                    repintarTablasVentas();
                });
            });
        }
        repintarTablasVentas();
        return Promise.resolve();
    }

    function pintarTablaVentasRegistro() {
        var el = document.getElementById('adminVentasTable');
        if (!el) return;
        var q = (document.getElementById('adminSearchVentas') || {}).value || '';
        var f = ObebeAdminData.filtrarVentas(datosCache.ventas || [], q);
        ObebeAdminVentasRegistro.renderInto(el, f, {
            editable: ObebeAdminData.edicionVentasHabilitada(),
            limite: 500,
            getVentas: function () { return f; },
            onChanged: refrescarDatosTrasEditarVenta
        });
    }

    function pintarTablaVentasUltimas() {
        var el = document.getElementById('adminVentasUltimasTable');
        if (!el) return;
        var recientes = ventasOrdenRecientes(datosCache.ventas || []).slice(0, 5);
        ObebeAdminVentasRegistro.renderInto(el, recientes, {
            editable: ObebeAdminData.edicionVentasHabilitada(),
            limite: 5,
            getVentas: function () { return recientes; },
            onChanged: refrescarDatosTrasEditarVenta
        });
    }

    function renderEntregas() {
        elContent.innerHTML = '<div id="adminEntregasMount"></div>';
        ObebeAdminEntregas.mount(document.getElementById('adminEntregasMount'), {
            filas: datosCache.filas || [],
            clientes: datosCache.clientes || [],
            vendedor: (userActual && userActual.nombre) ? userActual.nombre : 'OBEBE',
            getFilas: function () { return datosCache.filas || []; },
            onInventarioActualizado: function () {
                var st = ObebeAdminData.getEstado();
                datosCache.filas = st.filas || datosCache.filas;
                datosCache.resumen = ObebeAdminData.calcularResumen(datosCache.filas);
            },
            onVentasActualizada: function () {
                return ObebeAdminData.cargarVentas(true).then(function (p) {
                    datosCache.ventas = p.ventas || datosCache.ventas;
                    datosCache.resumenVentas = p.resumenVentas || datosCache.resumenVentas;
                    datosCache.clientes = p.clientes || datosCache.clientes;
                });
            }
        });
    }

    function renderRegistrarVenta() {
        elContent.innerHTML =
            '<div id="adminVentaRetailMount"></div>' +
            '<div class="admin-panel admin-panel-ventas-ultimas">' +
            '<div class="admin-panel-head admin-panel-head--ventas-reg">' +
            '<h3>Últimas 5 ventas</h3>' +
            '<div class="admin-panel-head-actions">' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-module="ventas">Ver registro completo</button>' +
            '</div></div>' +
            '<div id="adminVentasUltimasTable"></div></div>';

        ObebeAdminVentasRetail.mount(document.getElementById('adminVentaRetailMount'), opcionesMountRetail());
        pintarTablaVentasUltimas();
        var irVentas = elContent.querySelector('[data-module="ventas"]');
        if (irVentas) {
            irVentas.addEventListener('click', function () { irModulo('ventas'); });
        }
    }

    function renderVentas() {
        var sv = datosCache.resumenVentas || {};
        var cuentasSemHtml = ObebeAdminData.topEntries(sv.porCuentaSemana, 8).map(function (x) {
            return '<tr><td>' + esc(x.key) + '</td><td>' + ObebeAdminData.formatoMoney(x.val) + '</td></tr>';
        }).join('');
        var cuentasMesHtml = ObebeAdminData.topEntries(sv.porCuentaMes, 8).map(function (x) {
            return '<tr><td>' + esc(x.key) + '</td><td>' + ObebeAdminData.formatoMoney(x.val) + '</td></tr>';
        }).join('');
        elContent.innerHTML =
            panelVentasDashboard(sv, datosCache.ventas) +
            '<div class="admin-ventas-cuentas-grid">' +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Dinero por cuenta (semana)</h3></div>' +
            '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Cuenta</th><th>Total</th></tr></thead><tbody>' +
            (cuentasSemHtml || '<tr><td colspan="2">Sin datos</td></tr>') + '</tbody></table></div></div>' +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Dinero por cuenta (mes)</h3></div>' +
            '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Cuenta</th><th>Total</th></tr></thead><tbody>' +
            (cuentasMesHtml || '<tr><td colspan="2">Sin datos</td></tr>') + '</tbody></table></div></div></div>' +
            graficoBarrasVentasPorSemana(datosCache.ventas || []) +
            '<div class="admin-panel">' +
            '<div class="admin-panel-head admin-panel-head--ventas-reg">' +
            '<h3>Registro de ventas</h3>' +
            '<div class="admin-panel-head-actions">' +
            '<input type="search" class="admin-search" id="adminSearchVentas" placeholder="Buscar artículo, cliente, vendedor…">' +
            '</div></div>' +
            '<div id="adminVentasTable"></div></div>';

        pintarTablaVentasRegistro();
        bindSearch('adminSearchVentas', pintarTablaVentasRegistro);
    }

    function renderHistoricoInventario() {
        ObebeAdminInventarioHistorico.mount(elContent, {
            filas: datosCache.filas || []
        });
    }

    function renderPlaceholder(titulo, texto, items) {
        var lis = (items || []).map(function (t) {
            return '<li><span class="num">·</span><span>' + esc(t) + '</span></li>';
        }).join('');
        elContent.innerHTML = bannerFase() +
            '<div class="admin-banner">' + esc(texto) + '</div>' +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>' + esc(titulo) + '</h3></div>' +
            (lis ? '<ul class="admin-placeholder-steps">' + lis + '</ul>' : '<div style="padding:1rem;color:var(--admin-muted);font-size:0.85rem">Sin datos conectados.</div>') +
            '</div>';
    }

    function renderModulo(id) {
        if (!datosCache && id !== 'ventas_mayoreo' && id !== 'mayoreo' &&
            id !== 'clientes_mayoreo' && id !== 'calendario_mayoreo' && id !== 'pedidos_mayoreo') {
            elContent.innerHTML = '<div class="admin-loading">Cargando…</div>';
            cargarDatos(false).then(function () { renderModulo(id); }).catch(function (err) {
                elContent.innerHTML = '<div class="admin-banner">' + esc(err.message) + '. Verifica que el Sheet sea público para lectura.</div>';
            });
            return;
        }
        if (!datosCache && (id === 'mayoreo' || id === 'ventas_mayoreo' || id === 'clientes_mayoreo' ||
            id === 'calendario_mayoreo' || id === 'pedidos_mayoreo')) {
            datosCache = { filas: [], lineasMayoreo: [], errorMayoreo: null };
        }
        switch (id) {
            case 'dashboard': renderDashboard(); break;
            case 'inventario': renderInventario(); break;
            case 'historico': renderHistoricoInventario(); break;
            case 'registrar_venta': renderRegistrarVenta(); break;
            case 'entregas': renderEntregas(); break;
            case 'ventas': renderVentas(); break;
            case 'gastos':
                ObebeAdminGastos.mount(elContent, {
                    onVentasActualizada: function () {
                        return ObebeAdminData.cargarVentas(true).then(function (p) {
                            if (!datosCache) return;
                            datosCache.ventas = p.ventas || datosCache.ventas;
                            datosCache.resumenVentas = p.resumenVentas || datosCache.resumenVentas;
                            datosCache.clientes = p.clientes || datosCache.clientes;
                        });
                    }
                });
                break;
            case 'pedidos':
                ObebeAdminPedidos.mount(elContent);
                break;
            case 'clientes':
                ObebeAdminClientes.mount(elContent, datosCache.clientes || [], {
                    onChanged: function () {
                        var st = ObebeAdminData.getEstado();
                        datosCache.ventas = st.ventas || datosCache.ventas;
                        datosCache.clientes = ObebeAdminData.calcularPerfilesClientes(datosCache.ventas);
                    }
                });
                break;
            case 'mayoreo':
                ObebeAdminMayoreo.mount(elContent, datosMayoreoParaVista());
                break;
            case 'ventas_mayoreo':
                if (!datosCache) datosCache = { filas: [], lineasMayoreo: [], errorMayoreo: null };
                ObebeAdminMayoreoVentas.mount(elContent, {
                    clienteKey: userActual.clienteMayoreo || 'naty',
                    filasInv: datosCache.filas || [],
                    onVentaGuardada: function () {
                        if (vistaActual === 'mayoreo') renderModulo('mayoreo');
                        if (vistaActual === 'clientes_mayoreo') renderModulo('clientes_mayoreo');
                    }
                });
                break;
            case 'clientes_mayoreo':
                ObebeAdminMayoreoClientes.mount(elContent, {
                    clienteKey: userActual.clienteMayoreo || 'naty'
                });
                break;
            case 'calendario_mayoreo':
                ObebeAdminMayoreoCalendario.mount(elContent, {
                    clienteKey: userActual.clienteMayoreo || 'naty'
                });
                break;
            case 'pedidos_mayoreo':
                if (ObebeAdminAuth.esMayoreoCliente(userActual)) {
                    var cargarPedNaty = function () {
                        ObebeAdminMayoreoPedidos.mount(elContent, {
                            clienteKey: userActual.clienteMayoreo || 'naty',
                            clienteNombre: userActual.nombre || 'NATY',
                            filasInv: datosCache.filas || []
                        });
                    };
                    if (!(datosCache.filas || []).length) {
                        elContent.innerHTML = '<div class="admin-loading">Cargando catálogo de tienda…</div>';
                        ObebeAdminData.cargarInventario(false).then(function (inv) {
                            datosCache.filas = inv.filas || [];
                            cargarPedNaty();
                        }).catch(function () { cargarPedNaty(); });
                    } else {
                        cargarPedNaty();
                    }
                } else {
                    var dmPed = datosMayoreoParaVista();
                    ObebeAdminMayoreoPedidos.mount(elContent, {
                        modoObebe: true,
                        filasInv: datosCache.filas || [],
                        clientesMayoreo: dmPed.clientesMayoreo || [],
                        onInventarioActualizado: function () {
                            var st = ObebeAdminData.getEstado();
                            datosCache.filas = st.filas || datosCache.filas;
                            datosCache.resumen = ObebeAdminData.calcularResumen(datosCache.filas);
                        },
                        onVentasActualizada: function () {
                            return ObebeAdminData.cargarVentas(true).then(function (p) {
                                datosCache.ventas = p.ventas || datosCache.ventas;
                                datosCache.resumenVentas = p.resumenVentas || datosCache.resumenVentas;
                                datosCache.clientes = p.clientes || datosCache.clientes;
                            });
                        }
                    });
                }
                break;
            case 'compras':
                renderPlaceholder('Compras a proveedores', 'Órdenes de compra, recepción parcial y comparación solicitado vs recibido.', [
                    'Entrada de mercancía ligada a inventario',
                    'Productos pendientes de recepción'
                ]);
                break;
            default: elContent.innerHTML = '<p>Módulo no encontrado</p>';
        }
    }

    function actualizarMarcaPanel(user) {
        var title = document.getElementById('adminBrandTitle');
        var sub = document.getElementById('adminBrandSub');
        if (ObebeAdminAuth.esMayoreoCliente(user)) {
            var nom = user.nombre || user.usuario || 'NATY';
            if (title) title.textContent = nom + ' · Panel de control';
            if (sub) sub.textContent = 'Mayoreo Obebe';
            document.title = nom + ' · Panel';
        } else {
            if (title) title.textContent = 'OBEBE ADMIN';
            if (sub) sub.textContent = 'ERP · Fase MVP';
            document.title = 'Obebe Admin';
        }
    }

    function mantenimientoMayoreoLocal() {
        try {
            if (window.ObebeMayoreoStore && ObebeMayoreoStore.ejecutarLimpiezaProgramadaMayoreo) {
                ObebeMayoreoStore.ejecutarLimpiezaProgramadaMayoreo();
            }
            if (window.ObebeMayoreoPedidosStore && ObebeMayoreoPedidosStore.asegurarPedidoNatyLegacy20261017) {
                ObebeMayoreoPedidosStore.asegurarPedidoNatyLegacy20261017();
            }
        } catch (e) {
            console.warn('[admin-app] mantenimiento mayoreo', e);
        }
    }

    function mostrarApp(user) {
        mantenimientoMayoreoLocal();
        userActual = user;
        elLogin.classList.add('admin-hidden');
        elApp.classList.remove('admin-hidden');
        elUserChip.textContent = user.nombre || user.usuario;
        actualizarMarcaPanel(user);
        renderNav();
        var inicio = ObebeAdminAuth.esMayoreoCliente(user) ? 'mayoreo' : 'dashboard';
        if (ObebeAdminAuth.esMayoreoCliente(user)) {
            datosCache = baseDatosMayoreoCliente({ filas: [] });
            irModulo(inicio);
            cargarDatos(false).then(function () {
                renderModulo(vistaActual);
            }).catch(function () {
                renderModulo(vistaActual);
            });
            return;
        }
        cargarDatos(false).then(function () {
            irModulo(inicio);
        }).catch(function (err) {
            datosCache = armarDatosParcialesDesdeInventario({ filas: [] });
            irModulo('dashboard');
            elContent.insertAdjacentHTML('afterbegin',
                '<div class="admin-banner">' + esc((err && err.message) || 'No se pudieron cargar los datos.') +
                ' · Verifica conexión o pulsa Actualizar.</div>');
        });
    }

    function mostrarLogin() {
        elApp.classList.add('admin-hidden');
        elLogin.classList.remove('admin-hidden');
    }

    function initLogin() {
        var form = document.getElementById('adminLoginForm');
        var err = document.getElementById('adminLoginError');
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            err.textContent = '';
            var usuario = form.usuario.value;
            var pass = form.password.value;
            var res = ObebeAdminAuth.iniciarSesion(usuario, pass);
            if (!res.ok) {
                err.textContent = res.error;
                return;
            }
            try {
                mostrarApp(res.user);
            } catch (ex) {
                err.textContent = 'Error al abrir el panel. Recarga la página (Ctrl+F5).';
                console.error('[admin-app] mostrarApp', ex);
            }
        });
    }

    function initApp() {
        document.getElementById('adminLogoutBtn').addEventListener('click', function () {
            ObebeAdminDialog.confirm({
                title: '¿Cerrar sesión?',
                message: '¿Estás seguro de que quieres salir del panel administrativo?',
                confirmText: 'Salir',
                cancelText: 'Cancelar',
                variant: 'warn'
            }).then(function (ok) {
                if (!ok) return;
                ObebeAdminAuth.cerrarSesion();
                mostrarLogin();
            });
        });
        document.getElementById('adminRefreshBtn').addEventListener('click', function () {
            cargarDatos(true).then(function () {
                renderModulo(vistaActual);
            });
        });
        document.getElementById('adminMenuToggle').addEventListener('click', abrirSidebarMovil);
        elBackdrop.addEventListener('click', cerrarSidebarMovil);
    }

    var ADMIN_THEME_KEY = 'obebe_admin_theme';

    function temaAdminActual() {
        return document.documentElement.getAttribute('data-admin-theme') === 'light' ? 'light' : 'dark';
    }

    function etiquetaBotonTema(tema) {
        return tema === 'light' ? 'Modo oscuro' : 'Modo claro';
    }

    function aplicarTemaAdmin(tema) {
        var t = tema === 'light' ? 'light' : 'dark';
        if (t === 'light') {
            document.documentElement.setAttribute('data-admin-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-admin-theme');
        }
        try {
            localStorage.setItem(ADMIN_THEME_KEY, t);
        } catch (e) { /* ignore */ }
        var label = etiquetaBotonTema(t);
        ['adminThemeToggle', 'adminThemeToggleLogin'].forEach(function (id) {
            var btn = document.getElementById(id);
            if (!btn) return;
            btn.textContent = label;
            btn.setAttribute('aria-label', label);
        });
    }

    function alternarTemaAdmin() {
        aplicarTemaAdmin(temaAdminActual() === 'light' ? 'dark' : 'light');
    }

    function initTemaAdmin() {
        var guardado = 'dark';
        try {
            guardado = localStorage.getItem(ADMIN_THEME_KEY) || 'dark';
        } catch (e) { /* ignore */ }
        aplicarTemaAdmin(guardado);
        ['adminThemeToggle', 'adminThemeToggleLogin'].forEach(function (id) {
            var btn = document.getElementById(id);
            if (btn && !btn._themeBound) {
                btn._themeBound = true;
                btn.addEventListener('click', alternarTemaAdmin);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        initTemaAdmin();
        initLogin();
        initApp();
        if (ObebeAdminAuth.requiereAuth(mostrarApp)) {
            /* sesión restaurada */
        } else {
            mostrarLogin();
        }
    });
})();
