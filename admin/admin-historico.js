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
        var filas = opts.filas || [];
        var filtro = '';

        function agotadas(q) {
            var list = filas.filter(function (r) { return (r.stock || 0) === 0; });
            return ObebeAdminData.filtrarFilas(list, q, {});
        }

        function pintar() {
            var list = agotadas(filtro);
            var tbody = list.map(function (r) {
                var img = ObebeAdminData.urlImagenFilaInventario(r);
                var imgHtml = img
                    ? '<img src="' + esc(img) + '" alt="" class="admin-inv-thumb" loading="lazy" onerror="typeof adminMayoreoImgFallback===\'function\'&&adminMayoreoImgFallback(this)">'
                    : '<span class="admin-mayoreo-thumb-empty admin-inv-thumb"></span>';
                return '<tr data-sheet-row="' + r.filaSheet + '">' +
                    '<td class="admin-inv-thumb-cell">' + imgHtml + '</td>' +
                    '<td>#' + r.ref + '</td><td>' + esc(r.nombre) + '</td>' +
                    '<td>' + esc(r.talla) + '</td><td>' + esc(r.color) + '</td>' +
                    '<td>' + esc(r.marca) + '</td>' +
                    '<td><span class="admin-tag admin-tag-danger">0</span></td>' +
                    '<td><input type="number" min="1" value="1" class="admin-venta-num admin-hist-stock-input" ' +
                    'data-row="' + r.filaSheet + '" aria-label="Nuevo stock"></td>' +
                    '<td><button type="button" class="admin-btn admin-btn-primary admin-btn-compact admin-hist-guardar" data-row="' +
                    r.filaSheet + '">Regresar a inventario</button></td></tr>';
            }).join('');

            document.getElementById('adminHistoricoTable').innerHTML =
                '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
                '<th></th><th>Ref</th><th>Nombre</th><th>Talla</th><th>Color</th><th>Marca</th>' +
                '<th>Stock actual</th><th>Nuevo stock</th><th></th></tr></thead><tbody>' +
                (tbody || '<tr><td colspan="9">No hay artículos agotados.</td></tr>') +
                '</tbody></table></div>';
            var cnt = document.getElementById('adminHistoricoCount');
            if (cnt) cnt.textContent = list.length + ' artículo(s) agotado(s)';
        }

        container.innerHTML =
            '<div class="admin-banner info">Artículos con <strong>stock 0</strong> no aparecen en Inventario. ' +
            'Pon stock ≥ 1 (sugerido: <strong>1</strong>) para que vuelvan al inventario activo.</div>' +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Histórico (agotados)</h3>' +
            '<input type="search" class="admin-search" id="adminHistoricoSearch" placeholder="Buscar…"></div>' +
            '<p id="adminHistoricoCount" class="admin-muted-text" style="padding:0 1rem 0.5rem;margin:0"></p>' +
            '<div id="adminHistoricoTable"></div></div>' +
            '<p id="adminHistoricoError" class="admin-login-error" role="alert"></p>';

        pintar();

        document.getElementById('adminHistoricoSearch').addEventListener('input', function (e) {
            filtro = e.target.value;
            pintar();
        });

        container.onclick = function (ev) {
            var btn = ev.target.closest('.admin-hist-guardar');
            if (!btn) return;
            var row = parseInt(btn.getAttribute('data-row'), 10);
            var input = container.querySelector('.admin-hist-stock-input[data-row="' + row + '"]');
            var stock = input ? parseInt(input.value, 10) : 1;
            if (isNaN(stock) || stock < 1) {
                var err = document.getElementById('adminHistoricoError');
                if (err) err.textContent = 'El stock debe ser al menos 1.';
                return;
            }
            var errEl = document.getElementById('adminHistoricoError');
            if (errEl) errEl.textContent = '';
            btn.disabled = true;
            ObebeAdminData.actualizarStockFila(row, stock).then(function (res) {
                if (!res.ok) {
                    if (errEl) errEl.textContent = res.error || 'Error';
                    btn.disabled = false;
                    return;
                }
                var idx = filas.findIndex(function (f) { return f.filaSheet === row; });
                if (idx >= 0) {
                    filas[idx].stock = stock;
                    if (filas[idx].celdas) filas[idx].celdas[2] = String(stock);
                }
                if (opts.onStockRestaurado) opts.onStockRestaurado(row, stock);
                pintar();
            }).catch(function (e) {
                if (errEl) errEl.textContent = e.message || String(e);
                btn.disabled = false;
            });
        };
    }

    global.ObebeAdminHistorico = { mount: mount };
})(window);
