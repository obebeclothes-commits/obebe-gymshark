(function () {
    'use strict';

    var MODULOS_ADMIN = [
        { id: 'dashboard', label: 'Dashboard', live: true },
        { id: 'inventario', label: 'Inventario', live: true },
        { id: 'historico', label: 'Histórico', live: true },
        { id: 'ventas', label: 'Ventas', live: true },
        { id: 'pedidos', label: 'Pedidos', live: true },
        { id: 'clientes', label: 'Clientes', live: true },
        { id: 'mayoreo', label: 'Mayoreo', live: true },
        { id: 'pedidos_mayoreo', label: 'Pedidos mayoreo', live: true },
        { id: 'compras', label: 'Compras', live: false },
        { id: 'reportes', label: 'Reportes', live: 'partial' },
        { id: 'usuarios', label: 'Usuarios', live: false },
        { id: 'auditoria', label: 'Auditoría', live: false },
        { id: 'config', label: 'Configuración', live: true }
    ];

    var MODULOS_MAYOREO_CLIENTE = [
        { id: 'mayoreo', label: 'Inventario', live: true },
        { id: 'calendario_mayoreo', label: 'Calendario', live: true },
        { id: 'pedidos_mayoreo', label: 'Pedidos', live: true },
        { id: 'ventas_mayoreo', label: 'Ventas', live: true },
        { id: 'clientes_mayoreo', label: 'Clientes', live: true }
    ];

    function modulosVisibles(user) {
        if (user && ObebeAdminAuth.esMayoreoCliente(user)) return MODULOS_MAYOREO_CLIENTE;
        return MODULOS_ADMIN;
    }

    function moduloPermitido(id) {
        var lista = modulosVisibles(userActual);
        return lista.some(function (m) { return m.id === id; });
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
    var elSyncStatus = document.getElementById('adminSyncStatus');

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
        elNav.innerHTML = modulosVisibles(userActual).map(function (m) {
            var badge = '';
            if (m.live === false) badge = '<span class="badge-soon">Próximo</span>';
            else if (m.live === 'partial') badge = '<span class="badge-soon">Parcial</span>';
            return '<button type="button" data-module="' + m.id + '" class="' + (m.id === vistaActual ? 'active' : '') + '">' +
                esc(m.label) + badge + '</button>';
        }).join('');
        elNav.querySelectorAll('[data-module]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                irModulo(btn.getAttribute('data-module'));
                cerrarSidebarMovil();
            });
        });
    }

    function irModulo(id) {
        if (userActual && !moduloPermitido(id)) {
            id = modulosVisibles(userActual)[0].id;
        }
        vistaActual = id;
        var mod = modulosVisibles(userActual).find(function (m) { return m.id === id; });
        elTitle.textContent = mod ? mod.label : 'Admin';
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

    function setSyncStatus(ok, msg) {
        if (!elSyncStatus) return;
        var dot = ok ? 'ok' : (msg ? 'warn' : 'off');
        elSyncStatus.innerHTML = '<span class="admin-status-dot ' + dot + '"></span>' + esc(msg || '');
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
                setSyncStatus(true, 'Inventario local · sincronizando…');
                renderModulo(vistaActual);
                pintadoRapido = true;
            }
        }
        if (!pintadoRapido) {
            setSyncStatus(false, 'Sincronizando…');
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
            var msg;
            if (!soloMayoreo && pintadoRapido) {
                renderModulo(vistaActual);
            }
            if (soloMayoreo) {
                var dm = { lineasMayoreo: [], resumenMayoreo: { articulos: 0 } };
                try {
                    dm = datosMayoreoParaVista();
                } catch (e) {
                    console.warn('[admin] datosMayoreoParaVista', e);
                }
                msg = (dm.lineasMayoreo.length || 0) + ' en local · ' + (dm.resumenMayoreo.articulos || 0) + ' uds.';
                if (d.errorMayoreo && errorMayoreoVisible(d.errorMayoreo)) msg += ' (aviso importación)';
                setSyncStatus(true, msg);
                enriquecerInventarioNatyEnFondo();
            } else {
                msg = 'Inv. ' + d.resumen.articulosUnicos + ' · ' + d.ventas.length + ' ventas · ' +
                    (d.clientes ? d.clientes.length : 0) + ' cli. · ' +
                    (d.resumenMayoreo ? d.resumenMayoreo.clientes : 0) + ' mayoreo';
                if (d.errorVentas) msg += ' (VENTAS: aviso)';
                setSyncStatus(!d.errorVentas, msg);
            }
            if (!soloMayoreo && (d.lineasMayoreo || []).length) {
                importarMayoreoSheetAlStore(null);
            }
            return d;
        }).catch(function (err) {
            if (soloMayoreo) {
                datosCache = datosCache || baseDatosMayoreoCliente({ filas: [] });
                setSyncStatus(true, 'Datos locales');
                enriquecerInventarioNatyEnFondo();
                return datosCache;
            }
            setSyncStatus(false, 'Error al leer Sheet');
            throw err;
        });
    }

    function bannerFase() {
        return '<div class="admin-banner info">Fase MVP: lectura desde Google Sheets (INVENTARIO). ' +
            'Ventas, pedidos y escritura al Sheet llegarán con Apps Script. Sin Supabase todavía.</div>';
    }

    function panelVentasDashboard(sv) {
        if (!sv) sv = { hoy: {}, semana: {}, mes: {}, porVendedorMes: {}, masVendidosMes: {} };
        var vendRows = ObebeAdminData.topEntries(sv.porVendedorMes, 5).map(function (x) {
            return '<tr><td>' + esc(x.key) + '</td><td>' + ObebeAdminData.formatoMoney(x.val) + '</td></tr>';
        }).join('');
        var topRows = ObebeAdminData.topEntries(sv.masVendidosMes, 5, true).map(function (x) {
            return '<tr><td>' + esc(x.key) + '</td><td>' + x.val + '</td></tr>';
        }).join('');
        var aviso = datosCache.errorVentas
            ? '<p style="margin:0 0 0.5rem;color:var(--admin-warn)">' + esc(datosCache.errorVentas) + '</p>' : '';
        return '<div class="admin-panel admin-panel-ventas"><div class="admin-panel-head"><h3>Ventas</h3></div>' +
            '<div class="admin-panel-ventas-body">' + aviso +
            '<div class="admin-kpi-grid admin-kpi-grid--ventas">' +
            kpi('Hoy', ObebeAdminData.formatoMoney(sv.hoy.monto || 0),
                (sv.hoy.count || 0) + ' artículos · ' + ObebeAdminData.etiquetaDia()) +
            kpi('Semana (lun–dom)', ObebeAdminData.formatoMoney(sv.semana.monto || 0),
                (sv.semana.count || 0) + ' artículos · ' + ObebeAdminData.etiquetaRangoSemana()) +
            kpi('Mes actual', ObebeAdminData.formatoMoney(sv.mes.monto || 0),
                (sv.mes.count || 0) + ' artículos · ' + ObebeAdminData.etiquetaMesActual()) +
            '</div>' +
            '<div class="admin-two-col admin-ventas-tablas">' +
            '<div><p class="admin-ventas-sub">Por vendedor (mes)</p>' +
            '<table class="admin-table admin-table-compact"><thead><tr><th>Vendedor</th><th>Total</th></tr></thead><tbody>' +
            (vendRows || '<tr><td colspan="2">Sin datos</td></tr>') + '</tbody></table></div>' +
            '<div><p class="admin-ventas-sub">Más vendidos (mes)</p>' +
            '<table class="admin-table admin-table-compact"><thead><tr><th>Artículo</th><th>#</th></tr></thead><tbody>' +
            (topRows || '<tr><td colspan="2">Sin datos</td></tr>') + '</tbody></table></div>' +
            '</div></div></div>';
    }

    function renderDashboard() {
        var r = datosCache.resumen;
        var sv = datosCache.resumenVentas || {};
        var marcasHtml = Object.keys(r.porMarca).sort().slice(0, 8).map(function (k) {
            return '<tr><td>' + esc(k) + '</td><td>' + r.porMarca[k] + '</td></tr>';
        }).join('');

        elContent.innerHTML =
            '<div class="admin-dashboard-top">' +
            '<div class="admin-panel admin-panel-marcas"><div class="admin-panel-head"><h3>Líneas por marca</h3></div>' +
            '<div class="admin-table-wrap"><table class="admin-table admin-table-compact"><thead><tr><th>Marca</th><th>#</th></tr></thead><tbody>' +
            (marcasHtml || '<tr><td colspan="2">Sin datos</td></tr>') +
            '</tbody></table></div></div>' +
            '<div class="admin-kpi-grid admin-kpi-grid--dashboard">' +
            kpi('Unidades', r.unidades, '') +
            kpi('Artículos únicos', r.articulosUnicos, '') +
            kpi('Hombre / Mujer', r.porSegmento.Hombre + ' / ' + r.porSegmento.Mujer, '') +
            kpi('Agotados', r.agotados, 'Stock = 0') +
            kpi('Valor inventario', ObebeAdminData.formatoMoney(r.valorEstimado), '') +
            '</div></div>' +
            panelVentasDashboard(sv) +
            renderUltimasVentas(datosCache.ventas, 10);
    }

    function renderUltimasVentas(ventas, limite) {
        var rows = (ventas || []).slice(0, limite).map(function (v) {
            return '<tr><td>' + esc(ObebeAdminData.formatoFecha(v.fechaIso, v.fechaRaw)) + '</td>' +
                '<td>' + esc(v.nombre) + '</td><td>' + ObebeAdminData.formatoMoney(v.precio) + '</td>' +
                '<td>' + esc(v.vendedor) + '</td></tr>';
        }).join('');
        return '<div class="admin-panel" style="margin-top:1rem"><div class="admin-panel-head"><h3>Últimas ventas</h3></div>' +
            '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Fecha</th><th>Artículo</th><th>Precio</th><th>Vendedor</th></tr></thead><tbody>' +
            (rows || '<tr><td colspan="4">Sin registros</td></tr>') + '</tbody></table></div></div>';
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
        pintarInv();
    }

    function linkCortoVentas(url) {
        var u = String(url || '').trim();
        if (!u) return '—';
        var href = u.indexOf('http') === 0 ? u : 'https://' + u.replace(/^\/+/, '');
        var txt = u.length > 28 ? u.slice(0, 26) + '…' : u;
        return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(txt) + '</a>';
    }

    function tablaVentas(ventas, limite) {
        limite = limite || 500;
        var slice = ventas.slice(0, limite);
        var rows = slice.map(function (v) {
            return '<tr><td>' + esc(ObebeAdminData.formatoFecha(v.fechaIso, v.fechaRaw)) + '</td>' +
                '<td>' + esc(v.nombre) + '</td><td>' + esc(v.tipo) + '</td>' +
                '<td>' + ObebeAdminData.formatoMoney(v.precio) + '</td>' +
                '<td>' + esc(v.talla) + '</td><td>' + esc(v.color) + '</td>' +
                '<td>' + esc(v.segmento) + '</td><td>' + esc(v.cliente) + '</td>' +
                '<td>' + esc(v.vendedor) + '</td><td>' + esc(v.cuenta) + '</td>' +
                '<td>' + esc(v.redSocial) + '</td><td>' + linkCortoVentas(v.link) + '</td>' +
                '<td>' + esc(v.telefono) + '</td></tr>';
        }).join('');
        var extra = ventas.length > limite
            ? '<p style="padding:0.5rem 1rem;font-size:0.75rem;color:var(--admin-muted)">Mostrando ' + limite + ' de ' + ventas.length + '.</p>' : '';
        return extra + '<div class="admin-table-wrap"><table class="admin-table admin-table-ventas"><thead><tr>' +
            '<th>B · Fecha</th><th>C · Artículo</th><th>D · Tipo</th><th>E · Precio</th><th>F · Talla</th><th>G · Color</th>' +
            '<th>H · Cat.</th><th>I · Cliente</th><th>J · Vendedor</th><th>K · Cuenta</th>' +
            '<th>L · Red</th><th>M · Link</th><th>N · Tel.</th></tr></thead><tbody>' +
            (rows || '<tr><td colspan="13">Sin ventas</td></tr>') + '</tbody></table></div>';
    }

    function pintarTablaVentasRegistro() {
        var el = document.getElementById('adminVentasTable');
        if (!el) return;
        var q = (document.getElementById('adminSearchVentas') || {}).value || '';
        var f = ObebeAdminData.filtrarVentas(datosCache.ventas || [], q);
        el.innerHTML = tablaVentas(f);
    }

    function renderVentas() {
        var sv = datosCache.resumenVentas || {};
        var cuentasHtml = ObebeAdminData.topEntries(sv.porCuentaMes, 8).map(function (x) {
            return '<tr><td>' + esc(x.key) + '</td><td>' + ObebeAdminData.formatoMoney(x.val) + '</td></tr>';
        }).join('');
        elContent.innerHTML =
            '<div id="adminVentaRetailMount"></div>' +
            panelVentasDashboard(sv) +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Dinero por cuenta (mes)</h3></div>' +
            '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Cuenta</th><th>Total</th></tr></thead><tbody>' +
            (cuentasHtml || '<tr><td colspan="2">Sin datos</td></tr>') + '</tbody></table></div></div>' +
            '<div class="admin-panel">' +
            '<div class="admin-panel-head"><h3>Registro de ventas</h3>' +
            '<input type="search" class="admin-search" id="adminSearchVentas" placeholder="Buscar artículo, cliente, vendedor…"></div>' +
            '<div id="adminVentasTable"></div></div>' +
            (ObebeAdminData.usarSupabase && ObebeAdminData.usarSupabase()
                ? '<div class="admin-banner info">Ventas y stock en <strong>Supabase</strong>. La tienda debe usar <code>obebe-data-config.js</code> con el mismo origen.</div>'
                : (ObebeAdminData.escrituraLocalHabilitada && ObebeAdminData.escrituraLocalHabilitada()
                    ? '<div class="admin-banner warn">Modo <strong>solo admin (local)</strong>: no escribe en Google Sheets. Configura Supabase o <code>appsScriptUrl</code>.</div>'
                    : '<div class="admin-banner info">Las ventas se escriben en <strong>VENTAS (B–N)</strong> y bajan stock vía Apps Script.</div>'));

        ObebeAdminVentasRetail.mount(document.getElementById('adminVentaRetailMount'), {
            filas: datosCache.filas || [],
            clientes: datosCache.clientes || [],
            vendedor: (userActual && userActual.nombre) ? userActual.nombre : 'OBEBE',
            getFilas: function () { return datosCache.filas || []; },
            onVentaRegistrada: function (res) {
                var st = ObebeAdminData.getEstado();
                datosCache.filas = st.filas || datosCache.filas;
                datosCache.ventas = st.ventas || datosCache.ventas;
                datosCache.resumenVentas = ObebeAdminData.calcularResumenVentas(datosCache.ventas);
                datosCache.clientes = res.clientes || ObebeAdminData.calcularPerfilesClientes(datosCache.ventas);
                datosCache.resumen = ObebeAdminData.calcularResumen(datosCache.filas);
                pintarTablaVentasRegistro();
            }
        });

        pintarTablaVentasRegistro();
        bindSearch('adminSearchVentas', pintarTablaVentasRegistro);
    }

    function renderHistorico() {
        ObebeAdminHistorico.mount(elContent, {
            filas: datosCache.filas || [],
            onStockRestaurado: function (row, stock) {
                var st = ObebeAdminData.getEstado();
                datosCache.filas = st.filas || datosCache.filas;
                datosCache.resumen = ObebeAdminData.calcularResumen(datosCache.filas);
            }
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

    function renderReportes() {
        var r = datosCache.resumen;
        var sv = datosCache.resumenVentas || {};
        elContent.innerHTML = bannerFase() +
            '<div class="admin-kpi-grid">' +
            kpi('Ventas mes', ObebeAdminData.formatoMoney(sv.mes.monto || 0), (sv.mes.count || 0) + ' registros') +
            kpi('Ventas 7 días', ObebeAdminData.formatoMoney(sv.semana.monto || 0), '') +
            kpi('Valor inventario', ObebeAdminData.formatoMoney(r.valorEstimado), 'Precio de venta × stock') +
            kpi('Unidades en stock', r.unidades, '') +
            '</div>' +
            '<div class="admin-banner">Utilidad bruta y CMV requieren costo de adquisición por artículo (aún no conectado).</div>';
    }

    function renderUsuarios() {
        renderPlaceholder('Usuarios y permisos', 'Tres cuentas individuales con roles (Admin, Ventas, Operaciones) se configurarán con autenticación en servidor.', [
            'Hoy: una cuenta MVP compartida (solo panel oculto)',
            'Próximo: Google Sign-In o Supabase Auth + RLS',
            'Permisos no solo ocultando botones — validación en API'
        ]);
    }

    function renderAuditoria() {
        renderPlaceholder('Auditoría', 'Log append-only de movimientos, ventas y cambios sensibles.', [
            'Hoja AUDITORIA o tabla audit_log en Supabase',
            'Usuario, fecha, operación, registro afectado, motivo',
            'Los usuarios comunes no podrán borrar el historial'
        ]);
    }

    function renderConfig() {
        var st = ObebeAdminData.getEstado();
        var cfg = window.OBEBE_ADMIN_CONFIG || {};
        var modo = (cfg.dataSource || 'sheets').toLowerCase();
        var supabaseOk = ObebeAdminData.supabaseListo && ObebeAdminData.supabaseListo();
        elContent.innerHTML = bannerFase() +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Fuente de verdad</h3></div>' +
            '<div style="padding:1rem;font-size:0.85rem;line-height:1.6">' +
            '<p><strong>Modo:</strong> ' + esc(modo) +
            (modo === 'supabase' ? (supabaseOk ? ' · conectado' : ' · falta configurar URLs') : '') + '</p>' +
            (modo !== 'supabase'
                ? '<p><strong>Google Sheet</strong> (lectura)<br><a href="' + esc(st.sheetUrl) + '" target="_blank" rel="noopener">Abrir libro</a></p>'
                : '<p><strong>Supabase</strong> · INVENTARIO + VENTAS retail. Mayoreo sigue en Sheet hasta migrar.</p>') +
            '<p><strong>INVENTARIO:</strong> ' + (st.cargadoEn ? new Date(st.cargadoEn).toLocaleString('es-MX') : '—') +
            ' · <strong>VENTAS:</strong> ' + (st.ventasCargadoEn ? new Date(st.ventasCargadoEn).toLocaleString('es-MX') : '—') +
            ' · <strong>MAYOREO:</strong> ' + (st.mayoreoCargadoEn ? new Date(st.mayoreoCargadoEn).toLocaleString('es-MX') : '—') + '</p>' +
            '<p><strong>Registros:</strong> inventario ' + (st.filas ? st.filas.length : 0) +
            ' · ventas ' + (st.ventas ? st.ventas.length : 0) +
            ' · mayoreo ' + (st.lineasMayoreo ? st.lineasMayoreo.length : 0) + '</p>' +
            '<p><strong>Sesión:</strong> ' + esc(userActual.usuario || userActual.nombre) + ' · ' + esc(userActual.rol) + '</p>' +
            '</div></div>' +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Migrar a Supabase</h3></div>' +
            '<div style="padding:1rem;font-size:0.85rem;line-height:1.6">' +
            '<ol style="margin:0 0 1rem 1.1rem;line-height:1.55">' +
            '<li>Crea proyecto en <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a></li>' +
            '<li>Ejecuta <code>scripts/supabase/schema.sql</code> en SQL Editor</li>' +
            '<li>Despliega Edge Function <code>admin-api</code> (carpeta en repo) con secret <code>ADMIN_SECRET</code></li>' +
            '<li>En <code>admin-config.js</code>: <code>dataSource: \'supabase\'</code> + URL + anon key + adminApiUrl</li>' +
            '<li>Copia URL y anon key a <code>obebe-data-config.js</code> en la raíz (tienda)</li>' +
            '<li>Pulsa importar (copia INVENTARIO + VENTAS del Sheet una última vez)</li>' +
            '</ol>' +
            '<p id="adminMigracionMsg" class="admin-login-error" role="alert"></p>' +
            '<button type="button" class="admin-btn admin-btn-ghost" id="adminProbarSupabaseBtn"' +
            (supabaseOk ? '' : ' disabled') + '>Probar conexión Supabase</button> ' +
            '<button type="button" class="admin-btn admin-btn-primary" id="adminMigrarSheetsBtn"' +
            (supabaseOk ? '' : ' disabled') + '>Importar INVENTARIO + VENTAS desde Google</button> ' +
            '<button type="button" class="admin-btn admin-btn-ghost" id="adminImportVentasBtn"' +
            (supabaseOk ? '' : ' disabled') + '>Solo VENTAS (inventario ya está)</button>' +
            '<p class="admin-muted-text" style="margin-top:0.75rem">La importación la hace la Edge Function (admin-api) descargando el Sheet. ' +
            'Si inventario_filas sigue en 0, vuelve a desplegar admin-api con el código nuevo del repo.</p>' +
            '</div></div>';

        var btnProbar = document.getElementById('adminProbarSupabaseBtn');
        if (btnProbar) {
            btnProbar.onclick = function () {
                var msg = document.getElementById('adminMigracionMsg');
                if (msg) msg.textContent = 'Probando…';
                ObebeAdminData.probarConexionSupabase().then(function (r) {
                    if (!r.ok) {
                        if (msg) msg.textContent = r.error || 'Error';
                        return;
                    }
                    var n = (r.stats && r.stats.inventarioFilas) || r.inventarioLeido || 0;
                    var v = (r.stats && r.stats.ventasLineas) || 0;
                    if (msg) {
                        msg.textContent = 'OK · inventario_filas: ' + n + ' · ventas_lineas: ' + v +
                            (n === 0 ? ' → pulsa Importar' : '');
                    }
                });
            };
        }

        var btnVentas = document.getElementById('adminImportVentasBtn');
        if (btnVentas) {
            btnVentas.onclick = function () {
                var msg = document.getElementById('adminMigracionMsg');
                if (msg) msg.textContent = 'Importando ventas…';
                ObebeAdminData.importarSoloVentasDesdeGoogle().then(function (res) {
                    if (msg) {
                        msg.textContent = 'Ventas importadas: ' + (res.ventas || '—') + '. Pulsa Actualizar.';
                    }
                    return cargarDatos(true);
                }).then(function (d) {
                    datosCache = d;
                    renderConfig();
                }).catch(function (e) {
                    if (msg) msg.textContent = e.message || String(e);
                });
            };
        }

        var btn = document.getElementById('adminMigrarSheetsBtn');
        if (btn) {
            btn.onclick = function () {
                var msg = document.getElementById('adminMigracionMsg');
                if (msg) msg.textContent = 'Importando… puede tardar un minuto.';
                ObebeAdminDialog.confirm({
                    title: '¿Importar desde Google Sheets?',
                    message: 'Se borrarán inventario_filas y ventas_lineas en Supabase y se copiarán desde el libro actual.',
                    confirmText: 'Importar',
                    cancelText: 'Cancelar',
                    variant: 'warn'
                }).then(function (ok) {
                    if (!ok) {
                        if (msg) msg.textContent = '';
                        return;
                    }
                    ObebeAdminData.migrarDesdeGoogleSheets().then(function () {
                        if (msg) msg.textContent = 'Listo. Recarga datos con Actualizar.';
                        return cargarDatos(true);
                    }).then(function (d) {
                        datosCache = d;
                        renderConfig();
                    }).catch(function (e) {
                        if (msg) msg.textContent = e.message || String(e);
                    });
                });
            };
        }
    }

    function renderModulo(id) {
        if (!datosCache && id !== 'config' && id !== 'ventas_mayoreo' && id !== 'mayoreo' &&
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
            case 'historico': renderHistorico(); break;
            case 'ventas': renderVentas(); break;
            case 'pedidos':
                ObebeAdminPedidos.mount(elContent);
                break;
            case 'clientes':
                ObebeAdminClientes.mount(elContent, ObebeAdminData.calcularPerfilesClientes(datosCache.ventas || []));
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
                        clientesMayoreo: dmPed.clientesMayoreo || []
                    });
                }
                break;
            case 'compras':
                renderPlaceholder('Compras a proveedores', 'Órdenes de compra, recepción parcial y comparación solicitado vs recibido.', [
                    'Entrada de mercancía ligada a inventario',
                    'Productos pendientes de recepción'
                ]);
                break;
            case 'reportes': renderReportes(); break;
            case 'usuarios': renderUsuarios(); break;
            case 'auditoria': renderAuditoria(); break;
            case 'config': renderConfig(); break;
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

    function mostrarApp(user) {
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
        }).catch(function () {
            irModulo('config');
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
            mostrarApp(res.user);
        });
    }

    function initApp() {
        document.getElementById('adminLogoutBtn').addEventListener('click', function () {
            ObebeAdminAuth.cerrarSesion();
            mostrarLogin();
        });
        document.getElementById('adminRefreshBtn').addEventListener('click', function () {
            cargarDatos(true).then(function () {
                renderModulo(vistaActual);
            });
        });
        document.getElementById('adminMenuToggle').addEventListener('click', abrirSidebarMovil);
        elBackdrop.addEventListener('click', cerrarSidebarMovil);
    }

    document.addEventListener('DOMContentLoaded', function () {
        initLogin();
        initApp();
        if (ObebeAdminAuth.requiereAuth(mostrarApp)) {
            /* sesión restaurada */
        } else {
            mostrarLogin();
        }
    });
})();
