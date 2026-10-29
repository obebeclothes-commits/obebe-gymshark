(function (global) {
    'use strict';

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function mount(container, opts) {
        opts = opts || {};
        var filasLive = opts.filas || [];
        var filtro = '';

        function pintar() {
            var list = ObebeAdminData.filtrarHistoricoBd(
                ObebeAdminData.listarHistoricoInventario(filasLive),
                filtro
            );
            var tbody = list.map(function (row) {
                var e = row.entry;
                var liveF = filasLive.find(function (f) { return f.filaSheet === e.filaSheet; });
                var img = ObebeAdminData.urlImagenFilaInventario(liveF || {
                    ref: e.ref,
                    fotoUrl: e.celdas && e.celdas[9] ? e.celdas[9] : '',
                    segmento: e.segmento,
                    nombre: e.nombre
                });
                var imgHtml = img
                    ? '<img src="' + esc(img) + '" alt="" class="admin-inv-thumb" loading="lazy" onerror="typeof adminMayoreoImgFallback===\'function\'&&adminMayoreoImgFallback(this)">'
                    : '<span class="admin-mayoreo-thumb-empty admin-inv-thumb"></span>';
                var estado = row.agotado
                    ? '<span class="admin-tag admin-tag-danger">Agotado</span>'
                    : '<span class="admin-tag admin-tag-ok">Activo</span>';
                return '<tr><td class="admin-inv-thumb-cell">' + imgHtml + '</td>' +
                    '<td>#' + (e.ref || '—') + '</td><td>' + esc(e.nombre) + '</td>' +
                    '<td>' + esc(e.talla) + '</td><td>' + esc(e.color) + '</td>' +
                    '<td>' + esc(e.marca) + '</td><td>' + esc(e.tipo) + '</td>' +
                    '<td>' + row.cantidadVista + '</td>' +
                    '<td>' + ObebeAdminData.formatoMoney(e.precio || 0) + '</td>' +
                    '<td>' + estado + '</td></tr>';
            }).join('');

            document.getElementById('adminHistBdTable').innerHTML =
                '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
                '<th></th><th>Ref</th><th>Nombre</th><th>Talla</th><th>Color</th><th>Marca</th>' +
                '<th>Tipo</th><th>Cant.</th><th>Precio</th><th>Estado</th></tr></thead><tbody>' +
                (tbody || '<tr><td colspan="10">Sin registros todavía.</td></tr>') +
                '</tbody></table></div>';
            var cnt = document.getElementById('adminHistBdCount');
            if (cnt) cnt.textContent = list.length + ' registro(s) en histórico';
        }

        container.innerHTML =
            '<div class="admin-banner info">Base de datos local: guarda artículos del inventario. ' +
            'Las ventas no reducen la cantidad aquí; los agotados se muestran con cantidad 1.</div>' +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Histórico de inventario</h3>' +
            '<input type="search" class="admin-search" id="adminHistBdSearch" placeholder="Buscar…"></div>' +
            '<p id="adminHistBdCount" class="admin-muted-text" style="padding:0 1rem 0.5rem;margin:0"></p>' +
            '<div id="adminHistBdTable"></div></div>';

        pintar();
        document.getElementById('adminHistBdSearch').addEventListener('input', function (e) {
            filtro = e.target.value;
            pintar();
        });
    }

    global.ObebeAdminInventarioHistorico = { mount: mount };
})(window);
