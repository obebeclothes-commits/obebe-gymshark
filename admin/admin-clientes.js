(function (global) {
    'use strict';

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function linkHtml(url) {
        var u = String(url || '').trim();
        if (!u) return '—';
        var href = u;
        if (href.indexOf('http://') !== 0 && href.indexOf('https://') !== 0) {
            href = 'https://' + href.replace(/^\/+/, '');
        }
        return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(u.length > 42 ? u.slice(0, 40) + '…' : u) + '</a>';
    }

    function tablaClientes(lista) {
        if (!lista.length) {
            return '<p class="admin-muted-text" style="padding:1rem">No hay clientes con nombre en la columna CLIENTE de VENTAS.</p>';
        }
        var rows = lista.map(function (c) {
            return '<tr>' +
                '<td><strong>#' + c.ranking + '</strong></td>' +
                '<td>' + esc(c.nombre) + '</td>' +
                '<td>' + esc(c.telefono || '—') + '</td>' +
                '<td>' + linkHtml(c.link) + '</td>' +
                '<td>' + esc(c.redPrincipal) + '</td>' +
                '<td>' + c.articulos + '</td>' +
                '<td>' + ObebeAdminData.formatoMoney(c.gasto) + '</td>' +
                '<td>' + esc(c.vendedorPrincipal || '—') + '</td>' +
                '<td>' + esc(c.cuentaPrincipal || '—') + '</td>' +
                '<td>' + esc(c.tipoPrincipal) + '</td>' +
                '<td>' + esc(ObebeAdminData.formatoFecha(c.ultimaCompraIso, c.ultimaCompraRaw)) + '</td>' +
                '</tr>';
        }).join('');
        return '<div class="admin-table-wrap"><table class="admin-table admin-table-clientes"><thead><tr>' +
            '<th>#</th><th>I · Cliente</th><th>N · Teléfono</th><th>M · Link</th><th>L · Red</th>' +
            '<th>Artículos</th><th>Total gastado</th><th>J · Vendedor</th><th>K · Cuenta</th>' +
            '<th>Tipo favorito</th><th>Última compra</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    function mount(container, clientes) {
        clientes = clientes || [];

        function pintar(q) {
            var f = ObebeAdminData.filtrarClientes(clientes, q);
            var totalGasto = 0;
            f.forEach(function (c) { totalGasto += c.gasto; });
            document.getElementById('adminClientesTable').innerHTML = tablaClientes(f);
            var elTot = document.getElementById('adminClientesTotales');
            if (elTot) {
                elTot.textContent = f.length + ' clientes · ' + ObebeAdminData.formatoMoney(totalGasto) + ' en compras (filtrado)';
            }
        }

        container.innerHTML =
            '<div class="admin-kpi-grid">' +
            '<div class="admin-kpi"><div class="label">Clientes únicos</div><div class="value">' + clientes.length + '</div>' +
            '<div class="hint">Columna I · VENTAS (B–N)</div></div>' +
            '<div class="admin-kpi"><div class="label">Top gasto</div><div class="value">' +
            (clientes[0] ? esc(clientes[0].nombre) : '—') + '</div>' +
            '<div class="hint">' + (clientes[0] ? ObebeAdminData.formatoMoney(clientes[0].gasto) : '') + '</div></div>' +
            '</div>' +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Ranking de clientes</h3>' +
            '<input type="search" class="admin-search" id="adminSearchClientes" placeholder="Buscar nombre, teléfono, red…"></div>' +
            '<p id="adminClientesTotales" class="admin-muted-text" style="padding:0 1rem 0.5rem;margin:0"></p>' +
            '<div id="adminClientesTable"></div></div>' +
            '<div class="admin-banner info">Perfiles generados desde la hoja <strong>VENTAS</strong> (columnas B–N). ' +
            'Contacto: teléfono <strong>N</strong>, link <strong>M</strong>, red <strong>L</strong> (última compra). ' +
            '<strong>NATY</strong> (mayoreo) no aparece aquí; usa el módulo <em>Mayoreo</em>.</div>';

        pintar('');
        var input = document.getElementById('adminSearchClientes');
        input.addEventListener('input', function () { pintar(input.value); });
    }

    global.ObebeAdminClientes = {
        mount: mount
    };
})(window);
