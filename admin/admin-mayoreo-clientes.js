(function (global) {
    'use strict';

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function fmtFecha(iso) {
        if (!iso) return '—';
        var p = iso.split('-');
        if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
        return iso;
    }

    function tablaRanking(lista) {
        if (!lista.length) {
            return '<p class="admin-muted-text" style="padding:1rem">Aún no hay clientes. Registra ventas con el nombre del comprador en <strong>Ventas</strong>.</p>';
        }
        var rows = lista.map(function (c) {
            return '<tr><td><strong>#' + c.ranking + '</strong></td>' +
                '<td>' + esc(c.nombre) + '</td>' +
                '<td>' + c.numVentas + '</td>' +
                '<td>' + c.articulos + '</td>' +
                '<td>' + ObebeAdminData.formatoMoney(c.gasto) + '</td>' +
                '<td>' + esc(fmtFecha(c.ultimaCompraIso)) + '</td></tr>';
        }).join('');
        return '<div class="admin-table-wrap"><table class="admin-table admin-table-compact"><thead><tr>' +
            '<th>#</th><th>Cliente</th><th>Compras</th><th>Artículos</th><th>Total</th><th>Última compra</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    function mount(container, opts) {
        opts = opts || {};
        var clienteKey = opts.clienteKey || 'naty';
        var clientes = ObebeMayoreoStore.calcularRankingClientes(clienteKey);
        var totalGasto = 0;
        clientes.forEach(function (c) { totalGasto += c.gasto; });

        container.innerHTML =
            '<div class="admin-kpi-grid">' +
            '<div class="admin-kpi"><div class="label">Clientes</div><div class="value">' + clientes.length + '</div></div>' +
            '<div class="admin-kpi"><div class="label">Total vendido</div><div class="value">' +
            ObebeAdminData.formatoMoney(totalGasto) + '</div></div>' +
            '<div class="admin-kpi"><div class="label">Top cliente</div><div class="value">' +
            esc(clientes[0] ? clientes[0].nombre : '—') + '</div>' +
            (clientes[0] ? '<div class="hint">' + ObebeAdminData.formatoMoney(clientes[0].gasto) + '</div>' : '') +
            '</div></div>' +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Ranking de clientes</h3>' +
            '<input type="search" class="admin-search" id="adminSearchClientesNaty" placeholder="Buscar cliente…"></div>' +
            '<p id="adminClientesNatyResumen" class="admin-muted-text" style="padding:0 1rem 0.5rem;margin:0"></p>' +
            '<div id="adminClientesNatyTable"></div></div>';

        function pintar(q) {
            var f = ObebeMayoreoStore.filtrarRankingClientes(clientes, q);
            var sub = 0;
            f.forEach(function (c) { sub += c.gasto; });
            document.getElementById('adminClientesNatyTable').innerHTML = tablaRanking(f);
            document.getElementById('adminClientesNatyResumen').textContent =
                f.length + ' en lista · ' + ObebeAdminData.formatoMoney(sub);
        }

        pintar('');
        document.getElementById('adminSearchClientesNaty').addEventListener('input', function (e) {
            pintar(e.target.value);
        });
    }

    global.ObebeAdminMayoreoClientes = { mount: mount };
})(window);
