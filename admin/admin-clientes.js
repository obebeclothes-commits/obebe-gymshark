(function (global) {
    'use strict';

    var clientesCache = [];
    var opts = {};

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

    function totalVendido(lista) {
        var t = 0;
        (lista || []).forEach(function (c) { t += c.gasto || 0; });
        return t;
    }

    function totalArticulosVendidos(lista) {
        var t = 0;
        (lista || []).forEach(function (c) { t += c.articulos || 0; });
        return t;
    }

    function tablaClientes(lista) {
        if (!lista.length) {
            return '<p class="admin-muted-text" style="padding:1rem">No hay clientes con compras registradas.</p>';
        }
        var rows = lista.map(function (c) {
            return '<tr data-cliente-id="' + esc(c.id) + '">' +
                '<td><strong>#' + c.ranking + '</strong></td>' +
                '<td>' + esc(c.nombre) + '</td>' +
                '<td>' + esc(c.telefono || '—') + '</td>' +
                '<td>' + linkHtml(c.link) + '</td>' +
                '<td>' + esc(c.redPrincipal) + '</td>' +
                '<td>' + c.articulos + '</td>' +
                '<td>' + ObebeAdminData.formatoMoney(c.gasto) + '</td>' +
                '<td>' + esc(c.tipoPrincipal) + '</td>' +
                '<td>' + esc(ObebeAdminData.formatoFecha(c.ultimaCompraIso, c.ultimaCompraRaw)) + '</td>' +
                '<td class="admin-vr-acciones">' +
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm admin-cli-edit" data-cliente-id="' +
                esc(c.id) + '">Editar</button></td></tr>';
        }).join('');
        return '<div class="admin-table-wrap admin-table-wrap--sticky-cliente"><table class="admin-table admin-table-clientes"><thead><tr>' +
            '<th>#</th><th>Cliente</th><th>Teléfono</th><th>Link</th><th>Red</th>' +
            '<th>Artículos</th><th>Total</th><th>Tipo favorito</th><th>Última compra</th><th></th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    function ensureModal() {
        var root = document.getElementById('adminClienteModalRoot');
        if (root) return root;
        root = document.createElement('div');
        root.id = 'adminClienteModalRoot';
        root.className = 'admin-vr-modal-root admin-hidden';
        root.innerHTML =
            '<div class="admin-vr-modal-backdrop" data-cli-dismiss="1"></div>' +
            '<div class="admin-vr-modal" role="dialog" aria-modal="true">' +
            '<div class="admin-vr-modal-head"><h3>Editar cliente</h3>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-vr-modal-close" data-cli-dismiss="1">×</button></div>' +
            '<form id="adminClienteModalForm" class="admin-vr-modal-body">' +
            '<div class="admin-field"><label for="adminCliNombre">Nombre</label>' +
            '<input id="adminCliNombre" type="text" autocomplete="off" required></div>' +
            '<div class="admin-field-row">' +
            '<div class="admin-field"><label for="adminCliTel">Teléfono</label><input id="adminCliTel" type="text" autocomplete="off"></div>' +
            '<div class="admin-field"><label for="adminCliRed">Red social</label><input id="adminCliRed" type="text" autocomplete="off"></div>' +
            '</div>' +
            '<div class="admin-field"><label for="adminCliLink">Link</label><input id="adminCliLink" type="text" autocomplete="off"></div>' +
            '<p id="adminCliModalError" class="admin-vr-modal-error" role="alert"></p>' +
            '<div class="admin-vr-modal-actions">' +
            '<button type="button" class="admin-btn admin-btn-danger" data-cli-dismiss="1">Cancelar</button>' +
            '<button type="submit" class="admin-btn admin-btn-success admin-vr-modal-save">Guardar</button></div></form></div>';
        document.body.appendChild(root);
        root.querySelectorAll('[data-cli-dismiss]').forEach(function (el) {
            el.addEventListener('click', function () { cerrarModal(); });
        });
        document.getElementById('adminClienteModalForm').addEventListener('submit', onSubmitModal);
        return root;
    }

    var editId = null;

    function cerrarModal() {
        editId = null;
        var root = document.getElementById('adminClienteModalRoot');
        if (root) {
            root.classList.add('admin-hidden');
            document.body.classList.remove('admin-vr-modal-open');
        }
    }

    function abrirModal(cliente) {
        ensureModal();
        editId = cliente.id;
        document.getElementById('adminCliNombre').value = cliente.nombre || '';
        document.getElementById('adminCliTel').value = cliente.telefono || '';
        document.getElementById('adminCliLink').value = cliente.link || '';
        document.getElementById('adminCliRed').value = cliente.redPrincipal || '';
        document.getElementById('adminCliModalError').textContent = '';
        var root = document.getElementById('adminClienteModalRoot');
        root.classList.remove('admin-hidden');
        document.body.classList.add('admin-vr-modal-open');
        document.getElementById('adminCliNombre').focus();
    }

    function guardarDesdeModal() {
        if (!editId) return;
        var err = document.getElementById('adminCliModalError');
        err.textContent = '';
        var campos = {
            nombre: document.getElementById('adminCliNombre').value.trim(),
            telefono: document.getElementById('adminCliTel').value.trim(),
            link: document.getElementById('adminCliLink').value.trim(),
            redPrincipal: document.getElementById('adminCliRed').value.trim()
        };
        ObebeAdminData.actualizarContactoCliente(editId, campos).then(function (res) {
            if (!res || !res.ok) {
                err.textContent = (res && res.error) || 'No se pudo guardar.';
                return;
            }
            cerrarModal();
            clientesCache = ObebeAdminData.calcularPerfilesClientes(ObebeAdminData.getEstado().ventas);
            if (opts.onChanged) opts.onChanged();
            pintarKpis(clientesCache);
            pintarTabla((document.getElementById('adminSearchClientes') || {}).value || '');
        }).catch(function (e) {
            err.textContent = e.message || String(e);
        });
    }

    function onSubmitModal(ev) {
        ev.preventDefault();
        if (!editId) return;
        var nombre = document.getElementById('adminCliNombre').value.trim();
        if (!nombre) {
            document.getElementById('adminCliModalError').textContent = 'Indica el nombre del cliente.';
            return;
        }
        var dialog = global.ObebeAdminDialog;
        if (!dialog || !dialog.confirm) {
            guardarDesdeModal();
            return;
        }
        dialog.confirm({
            title: '¿Guardar cambios?',
            message: 'Se actualizarán todas las ventas donde aparezca este cliente (nombre y datos de contacto).',
            confirmText: 'Sí, guardar',
            cancelText: 'Cancelar',
            variant: 'warn'
        }).then(function (ok) {
            if (ok) guardarDesdeModal();
        });
    }

    function pintarKpis(lista) {
        var el = document.getElementById('adminClientesKpi');
        if (!el) return;
        var top = lista[0];
        var total = totalVendido(lista);
        var piezas = totalArticulosVendidos(lista);
        el.innerHTML =
            '<div class="admin-kpi"><div class="label">Cliente top</div><div class="value">' +
            (top ? esc(top.nombre) : '—') + '</div>' +
            '<div class="hint">' + (top ? ObebeAdminData.formatoMoney(top.gasto) : '') + '</div></div>' +
            '<div class="admin-kpi"><div class="label">Total vendido</div><div class="value">' +
            ObebeAdminData.formatoMoney(total) + '</div>' +
            '<div class="hint">' + lista.length + ' clientes</div></div>' +
            '<div class="admin-kpi"><div class="label">Artículos</div><div class="value">' +
            piezas + '</div></div>';
    }

    function pintarTabla(q) {
        var f = ObebeAdminData.filtrarClientes(clientesCache, q);
        document.getElementById('adminClientesTable').innerHTML = tablaClientes(f);
    }

    function mount(container, clientes, options) {
        opts = options || {};
        clientesCache = clientes || [];

        container.innerHTML =
            '<div class="admin-kpi-grid" id="adminClientesKpi"></div>' +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Ranking de clientes</h3>' +
            '<input type="search" class="admin-search" id="adminSearchClientes" placeholder="Buscar nombre, teléfono, red…"></div>' +
            '<div id="adminClientesTable"></div></div>';

        pintarKpis(clientesCache);
        pintarTabla('');

        document.getElementById('adminSearchClientes').addEventListener('input', function (ev) {
            pintarTabla(ev.target.value);
        });

        container.addEventListener('click', function (ev) {
            var btn = ev.target.closest('.admin-cli-edit');
            if (!btn) return;
            var id = btn.getAttribute('data-cliente-id');
            var c = clientesCache.find(function (x) { return x.id === id; });
            if (c) abrirModal(c);
        });
    }

    global.ObebeAdminClientes = {
        mount: mount
    };
})(window);
