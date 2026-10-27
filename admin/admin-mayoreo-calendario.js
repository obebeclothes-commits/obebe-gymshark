(function (global) {
    'use strict';

    var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    var DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function pad2(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function isoLocal(y, m, d) {
        return y + '-' + pad2(m + 1) + '-' + pad2(d);
    }

    function fechaLocalIsoFromMs(ms) {
        if (!ms) return '';
        var d = new Date(ms);
        return isoLocal(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function marcasCalendario(clienteKey) {
        var llegada = {};
        var pedido = {};
        var posibleLlegada = {};
        var legacy = ObebeMayoreoStore.FECHA_STOCK_LEGACY || '2026-10-17';
        llegada[legacy] = true;
        ObebeMayoreoStore.getLineasForCliente(clienteKey).forEach(function (l) {
            var iso = l.fechaStockIso || legacy;
            if (iso) llegada[iso] = true;
        });
        if (global.ObebeMayoreoPedidosStore) {
            ObebeMayoreoPedidosStore.pedidosForCliente(clienteKey).forEach(function (p) {
                var isoPed = fechaLocalIsoFromMs(p.creadoEn);
                if (isoPed) pedido[isoPed] = true;
                if (p.estado === 'pendiente' || p.estado === 'en_revision') {
                    if (isoPed) posibleLlegada[isoPed] = true;
                }
            });
        }
        return { llegada: llegada, pedido: pedido, posibleLlegada: posibleLlegada };
    }

    function ventasPorDia(clienteKey) {
        var map = {};
        ObebeMayoreoStore.ventasForCliente(clienteKey).forEach(function (v) {
            var iso = v.fechaIso || '';
            if (!iso) return;
            if (!map[iso]) map[iso] = { total: 0, piezas: 0, ventas: 0 };
            map[iso].total += v.total || 0;
            map[iso].ventas += 1;
            (v.lineas || []).forEach(function (l) {
                map[iso].piezas += l.cantidad || 0;
            });
        });
        return map;
    }

    function inicioMes(y, m) {
        return new Date(y, m, 1);
    }

    function diasEnMes(y, m) {
        return new Date(y, m + 1, 0).getDate();
    }

    function lunesPrimeraSemana(y, m) {
        var d = inicioMes(y, m).getDay();
        return d === 0 ? 6 : d - 1;
    }

    function mount(container, opts) {
        opts = opts || {};
        var clienteKey = opts.clienteKey || 'naty';
        var hoy = new Date();
        var viewYear = hoy.getFullYear();
        var viewMonth = hoy.getMonth();
        var selectedIso = isoLocal(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        var porDia = ventasPorDia(clienteKey);
        var marcas = marcasCalendario(clienteKey);

        function pintar() {
            porDia = ventasPorDia(clienteKey);
            marcas = marcasCalendario(clienteKey);
            container.innerHTML = build();
            bind();
        }

        function build() {
            var mesesAnio = MESES.map(function (nombre, idx) {
                var totalMes = 0;
                var diasMes = diasEnMes(viewYear, idx);
                for (var d = 1; d <= diasMes; d++) {
                    var iso = isoLocal(viewYear, idx, d);
                    if (porDia[iso]) totalMes += porDia[iso].total;
                }
                var activo = idx === viewMonth ? ' admin-cal-mes-pill--active' : '';
                return '<button type="button" class="admin-cal-mes-pill' + activo + '" data-mes="' + idx + '">' +
                    esc(nombre.slice(0, 3)) +
                    (totalMes > 0 ? '<span>' + ObebeAdminData.formatoMoney(totalMes) + '</span>' : '') +
                    '</button>';
            }).join('');

            var grid = buildMesGrid(viewYear, viewMonth);
            var detalle = buildDetalleDia(selectedIso);

            return '<div class="admin-panel"><div class="admin-panel-head admin-cal-head">' +
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact" id="adminCalPrev">‹</button>' +
                '<h3>' + esc(MESES[viewMonth] + ' ' + viewYear) + '</h3>' +
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-compact" id="adminCalNext">›</button>' +
                '</div>' +
                '<div class="admin-cal-meses-anio">' + mesesAnio + '</div>' +
                '<p class="admin-cal-leyenda"><span>👕</span> Llegada de ropa · <span>🛒</span> Pedido a OBEBE · <span>⏳</span> Posible llegada</p>' +
                grid + detalle + '</div>' +
                '<div class="admin-panel" style="margin-top:1rem"><div class="admin-panel-head"><h3>Resumen anual ' + viewYear + '</h3></div>' +
                buildResumenAnio(viewYear) + '</div>';
        }

        function buildMesGrid(y, m) {
            var offset = lunesPrimeraSemana(y, m);
            var totalDias = diasEnMes(y, m);
            var cells = [];
            DIAS.forEach(function (d) {
                cells.push('<div class="admin-cal-dow">' + d + '</div>');
            });
            for (var i = 0; i < offset; i++) {
                cells.push('<div class="admin-cal-day admin-cal-day--empty"></div>');
            }
            for (var day = 1; day <= totalDias; day++) {
                var iso = isoLocal(y, m, day);
                var info = porDia[iso];
                var cls = 'admin-cal-day';
                if (iso === selectedIso) cls += ' admin-cal-day--selected';
                if (info && info.total > 0) cls += ' admin-cal-day--venta';
                var dayMarks = [];
                if (marcas.llegada[iso]) {
                    dayMarks.push('<span class="admin-cal-tag admin-cal-tag-llegada" title="Llegada de ropa">👕</span>');
                }
                if (marcas.pedido[iso]) {
                    dayMarks.push('<span class="admin-cal-tag admin-cal-tag-pedido" title="Pedido enviado a OBEBE">🛒</span>');
                }
                if (marcas.posibleLlegada && marcas.posibleLlegada[iso]) {
                    dayMarks.push('<span class="admin-cal-tag admin-cal-tag-posible" title="Posible llegada (pedido en proceso)">⏳</span>');
                }
                var marksHtml = dayMarks.length
                    ? '<span class="admin-cal-marks">' + dayMarks.join('') + '</span>'
                    : '';
                cells.push('<button type="button" class="' + cls + '" data-iso="' + iso + '">' +
                    '<span class="admin-cal-day-num">' + day + '</span>' +
                    marksHtml +
                    (info && info.total > 0
                        ? '<span class="admin-cal-day-amt">' + ObebeAdminData.formatoMoney(info.total) + '</span>'
                        : '') +
                    '</button>');
            }
            return '<div class="admin-cal-grid">' + cells.join('') + '</div>';
        }

        function buildDetalleDia(iso) {
            var info = porDia[iso] || { total: 0, piezas: 0, ventas: 0 };
            var p = iso.split('-');
            var titulo = p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
            var ventasDia = ObebeMayoreoStore.ventasForCliente(clienteKey).filter(function (v) {
                return v.fechaIso === iso;
            });
            var rows = ventasDia.map(function (v) {
                var arts = (v.lineas || []).map(function (l) {
                    return esc(l.nombre) + ' ×' + l.cantidad;
                }).join(', ');
                return '<tr><td>' + esc(v.comprador || '—') + '</td><td>' + arts + '</td>' +
                    '<td>' + ObebeAdminData.formatoMoney(v.total) + '</td></tr>';
            }).join('');
            return '<div class="admin-cal-detalle">' +
                '<h4>' + esc(titulo) + '</h4>' +
                '<div class="admin-kpi-grid admin-kpi-grid--compact">' +
                '<div class="admin-kpi"><div class="label">Vendido</div><div class="value">' + ObebeAdminData.formatoMoney(info.total) + '</div></div>' +
                '<div class="admin-kpi"><div class="label">Piezas</div><div class="value">' + (info.piezas || 0) + '</div></div>' +
                '<div class="admin-kpi"><div class="label">Ventas</div><div class="value">' + (info.ventas || 0) + '</div></div>' +
                '</div>' +
                '<div class="admin-table-wrap"><table class="admin-table admin-table-compact"><thead><tr>' +
                '<th>Comprador</th><th>Artículos</th><th>Total</th></tr></thead><tbody>' +
                (rows || '<tr><td colspan="3">Sin ventas este día</td></tr>') +
                '</tbody></table></div></div>';
        }

        function buildResumenAnio(y) {
            var rows = MESES.map(function (nombre, idx) {
                var total = 0;
                var piezas = 0;
                var dias = diasEnMes(y, idx);
                for (var d = 1; d <= dias; d++) {
                    var iso = isoLocal(y, idx, d);
                    if (porDia[iso]) {
                        total += porDia[iso].total;
                        piezas += porDia[iso].piezas;
                    }
                }
                return '<tr><td>' + esc(nombre) + '</td><td>' + piezas + '</td><td>' + ObebeAdminData.formatoMoney(total) + '</td></tr>';
            }).join('');
            return '<div class="admin-table-wrap"><table class="admin-table admin-table-compact"><thead><tr>' +
                '<th>Mes</th><th>Piezas</th><th>Total vendido</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
        }

        function bind() {
            container.querySelectorAll('.admin-cal-day[data-iso]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    selectedIso = btn.getAttribute('data-iso');
                    pintar();
                });
            });
            container.querySelectorAll('.admin-cal-mes-pill').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    viewMonth = parseInt(btn.getAttribute('data-mes'), 10);
                    pintar();
                });
            });
            var prev = document.getElementById('adminCalPrev');
            var next = document.getElementById('adminCalNext');
            if (prev) prev.addEventListener('click', function () {
                viewMonth -= 1;
                if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
                pintar();
            });
            if (next) next.addEventListener('click', function () {
                viewMonth += 1;
                if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
                pintar();
            });
        }

        pintar();
    }

    global.ObebeAdminMayoreoCalendario = { mount: mount };
})(window);
