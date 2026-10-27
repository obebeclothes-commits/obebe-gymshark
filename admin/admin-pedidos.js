(function (global) {
    'use strict';

    var STORAGE_KEY = 'obebe_admin_pedidos_v1';
    var ESTADOS = [
        { id: 'pendiente', label: 'Pendiente' },
        { id: 'confirmado', label: 'Confirmado' },
        { id: 'surtido', label: 'Surtido' },
        { id: 'enviado', label: 'Enviado' },
        { id: 'entregado', label: 'Entregado' },
        { id: 'cancelado', label: 'Cancelado' }
    ];

    var state = {
        pedidos: [],
        editId: null,
        draft: null,
        msg: ''
    };

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function uid() {
        return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    function cargarPedidos() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            state.pedidos = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(state.pedidos)) state.pedidos = [];
        } catch (e) {
            state.pedidos = [];
        }
    }

    function guardarPedidos() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pedidos));
    }

    function etiquetaEstado(id) {
        var e = ESTADOS.find(function (x) { return x.id === id; });
        return e ? e.label : id;
    }

    function tagEstado(id) {
        var cls = 'admin-tag-muted';
        if (id === 'entregado') cls = 'admin-tag-ok';
        else if (id === 'cancelado') cls = 'admin-tag-danger';
        else if (id === 'pendiente') cls = 'admin-tag-warn';
        return '<span class="admin-tag ' + cls + '">' + esc(etiquetaEstado(id)) + '</span>';
    }

    function comprimirImagen(file) {
        return new Promise(function (resolve, reject) {
            if (!file || !file.type || file.type.indexOf('image/') !== 0) {
                reject(new Error('Archivo no es imagen'));
                return;
            }
            if (file.size > 8 * 1024 * 1024) {
                reject(new Error('Imagen muy grande (máx. 8 MB)'));
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                var img = new Image();
                img.onload = function () {
                    var maxW = 720;
                    var w = img.width;
                    var h = img.height;
                    if (w > maxW) {
                        h = Math.round(h * (maxW / w));
                        w = maxW;
                    }
                    var canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.78));
                };
                img.onerror = function () { reject(new Error('No se pudo leer la imagen')); };
                img.src = reader.result;
            };
            reader.onerror = function () { reject(new Error('Error al leer archivo')); };
            reader.readAsDataURL(file);
        });
    }

    function pedidoVacio() {
        return {
            id: uid(),
            creadoEn: new Date().toISOString(),
            estado: 'pendiente',
            clienteNombre: '',
            clienteTelefono: '',
            apartado: 0,
            fechaLlegadaEstimada: '',
            notas: '',
            articulos: [{ nombre: '', talla: '', imagenes: [] }]
        };
    }

    function formularioPedido(p) {
        var esNuevo = state.editId === '__nuevo__';
        var titulo = esNuevo ? 'Nuevo pedido / apartado' : 'Editar pedido';
        var arts = p.articulos && p.articulos.length ? p.articulos : [{ nombre: '', talla: '', imagenes: [] }];
        var artsHtml = arts.map(function (a, idx) {
            var imgs = (a.imagenes || []).map(function (src, ii) {
                return '<div class="admin-pedido-thumb"><img src="' + src + '" alt=""><button type="button" class="admin-thumb-del" data-art="' + idx + '" data-img="' + ii + '">×</button></div>';
            }).join('');
            return '<div class="admin-pedido-articulo" data-art-idx="' + idx + '">' +
                '<div class="admin-form-row cols-2">' +
                '<div><label>Artículo</label><input type="text" class="ped-art-nombre" value="' + esc(a.nombre) + '" placeholder="Nombre del producto"></div>' +
                '<div><label>Talla</label><input type="text" class="ped-art-talla" value="' + esc(a.talla) + '" placeholder="M, L, 32…"></div>' +
                '</div>' +
                '<div class="admin-pedido-imgs">' + (imgs || '<span class="admin-muted-text">Sin fotos</span>') + '</div>' +
                '<label class="admin-btn admin-btn-ghost admin-btn-sm"><input type="file" accept="image/*" class="ped-art-file" data-art="' + idx + '" hidden> + Foto</label>' +
                (arts.length > 1 ? '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm ped-quitar-art" data-art="' + idx + '">Quitar línea</button>' : '') +
                '</div>';
        }).join('');

        var optsEstado = ESTADOS.map(function (e) {
            return '<option value="' + e.id + '"' + (p.estado === e.id ? ' selected' : '') + '>' + esc(e.label) + '</option>';
        }).join('');

        return '<div class="admin-panel admin-pedido-form">' +
            '<div class="admin-panel-head"><h3>' + titulo + '</h3>' +
            '<button type="button" class="admin-btn admin-btn-ghost" id="pedCancelForm">Cerrar</button></div>' +
            '<form id="pedidoForm" class="admin-form-row">' +
            '<div class="admin-form-row cols-2">' +
            '<div><label>Nombre del cliente *</label><input name="clienteNombre" required value="' + esc(p.clienteNombre) + '"></div>' +
            '<div><label>Teléfono (WhatsApp)</label><input name="clienteTelefono" value="' + esc(p.clienteTelefono) + '" placeholder="52…"></div>' +
            '</div>' +
            '<div class="admin-form-row cols-2">' +
            '<div><label>Apartado / anticipo ($)</label><input name="apartado" type="number" min="0" step="1" value="' + esc(p.apartado || 0) + '"></div>' +
            '<div><label>Fecha posible de llegada</label><input name="fechaLlegadaEstimada" type="date" value="' + esc(p.fechaLlegadaEstimada || '') + '"></div>' +
            '</div>' +
            '<div><label>Estado</label><select name="estado">' + optsEstado + '</select></div>' +
            '<div><label>Notas</label><textarea name="notas" placeholder="Color, envío, referencia…">' + esc(p.notas) + '</textarea></div>' +
            '<div class="admin-pedido-articulos-wrap"><div class="admin-panel-head" style="padding:0 0 0.5rem"><h4 style="margin:0;font-size:0.9rem">Artículos</h4>' +
            '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" id="pedAddArticulo">+ Artículo</button></div>' +
            artsHtml + '</div>' +
            '<div class="admin-form-actions">' +
            '<button type="submit" class="admin-btn admin-btn-primary">Guardar pedido</button>' +
            '</div></form></div>';
    }

    function listaPedidosHtml() {
        if (!state.pedidos.length) {
            return '<p class="admin-muted-text" style="padding:1rem">Aún no hay pedidos. Crea el primero con el botón de arriba.</p>';
        }
        var sorted = state.pedidos.slice().sort(function (a, b) {
            return (b.creadoEn || '').localeCompare(a.creadoEn || '');
        });
        var rows = sorted.map(function (p) {
            var nArt = (p.articulos || []).length;
            var thumbs = '';
            (p.articulos || []).some(function (a) {
                if (a.imagenes && a.imagenes[0]) {
                    thumbs = '<img class="admin-pedido-list-thumb" src="' + a.imagenes[0] + '" alt="">';
                    return true;
                }
                return false;
            });
            return '<tr data-pedido-id="' + esc(p.id) + '">' +
                '<td>' + thumbs + esc(p.clienteNombre) + '</td>' +
                '<td>' + esc(p.clienteTelefono) + '</td>' +
                '<td>' + ObebeAdminData.formatoMoney(p.apartado || 0) + '</td>' +
                '<td>' + nArt + '</td>' +
                '<td>' + esc(p.fechaLlegadaEstimada || '—') + '</td>' +
                '<td>' + tagEstado(p.estado) + '</td>' +
                '<td><button type="button" class="admin-btn admin-btn-ghost admin-btn-sm ped-edit">Editar</button> ' +
                '<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm ped-del">Eliminar</button></td></tr>';
        }).join('');
        return '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
            '<th>Cliente</th><th>Teléfono</th><th>Apartado</th><th>Artículos</th><th>Llegada est.</th><th>Estado</th><th></th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    function leerFormulario(form, draft) {
        var fd = new FormData(form);
        draft.clienteNombre = String(fd.get('clienteNombre') || '').trim();
        draft.clienteTelefono = String(fd.get('clienteTelefono') || '').trim();
        draft.apartado = parseFloat(fd.get('apartado')) || 0;
        draft.fechaLlegadaEstimada = String(fd.get('fechaLlegadaEstimada') || '').trim();
        draft.estado = String(fd.get('estado') || 'pendiente');
        draft.notas = String(fd.get('notas') || '').trim();
        var arts = [];
        form.querySelectorAll('.admin-pedido-articulo').forEach(function (el) {
            var idx = parseInt(el.getAttribute('data-art-idx'), 10);
            var prev = draft.articulos && draft.articulos[idx] ? draft.articulos[idx] : { imagenes: [] };
            arts.push({
                nombre: String(el.querySelector('.ped-art-nombre').value || '').trim(),
                talla: String(el.querySelector('.ped-art-talla').value || '').trim(),
                imagenes: (prev.imagenes || []).slice()
            });
        });
        draft.articulos = arts.filter(function (a) { return a.nombre || a.talla || (a.imagenes && a.imagenes.length); });
        if (!draft.articulos.length) draft.articulos = [{ nombre: '', talla: '', imagenes: [] }];
        return draft;
    }

    function bindFormEvents(container, draft) {
        var form = container.querySelector('#pedidoForm');
        if (!form) return;

        container.querySelector('#pedCancelForm').addEventListener('click', function () {
            state.editId = null;
            state.draft = null;
            render(container);
        });

        container.querySelector('#pedAddArticulo').addEventListener('click', function () {
            var d = leerFormulario(form, JSON.parse(JSON.stringify(draft)));
            d.articulos.push({ nombre: '', talla: '', imagenes: [] });
            if (state.editId === '__nuevo__') state.draft = d;
            draft = d;
            render(container);
            bindFormEvents(container, draft);
        });

        form.querySelectorAll('.ped-quitar-art').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var i = parseInt(btn.getAttribute('data-art'), 10);
                var d = leerFormulario(form, JSON.parse(JSON.stringify(draft)));
                d.articulos.splice(i, 1);
                if (!d.articulos.length) d.articulos.push({ nombre: '', talla: '', imagenes: [] });
                draft = d;
                render(container);
                bindFormEvents(container, draft);
            });
        });

        form.querySelectorAll('.ped-art-file').forEach(function (input) {
            input.addEventListener('change', function () {
                var file = input.files && input.files[0];
                if (!file) return;
                var artIdx = parseInt(input.getAttribute('data-art'), 10);
                comprimirImagen(file).then(function (dataUrl) {
                    var d = leerFormulario(form, JSON.parse(JSON.stringify(draft)));
                    if (!d.articulos[artIdx].imagenes) d.articulos[artIdx].imagenes = [];
                    if (d.articulos[artIdx].imagenes.length >= 4) {
                        state.msg = 'Máximo 4 fotos por artículo.';
                        render(container);
                        bindFormEvents(container, d);
                        return;
                    }
                    d.articulos[artIdx].imagenes.push(dataUrl);
                    draft = d;
                    state.msg = '';
                    render(container);
                    bindFormEvents(container, draft);
                }).catch(function (err) {
                    state.msg = err.message || 'Error con imagen';
                    render(container);
                    bindFormEvents(container, draft);
                });
                input.value = '';
            });
        });

        form.querySelectorAll('.admin-thumb-del').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var ai = parseInt(btn.getAttribute('data-art'), 10);
                var ii = parseInt(btn.getAttribute('data-img'), 10);
                var d = leerFormulario(form, JSON.parse(JSON.stringify(draft)));
                d.articulos[ai].imagenes.splice(ii, 1);
                draft = d;
                render(container);
                bindFormEvents(container, draft);
            });
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var d = leerFormulario(form, JSON.parse(JSON.stringify(draft)));
            if (!d.clienteNombre) {
                state.msg = 'Indica el nombre del cliente.';
                return;
            }
            var idx = state.pedidos.findIndex(function (x) { return x.id === d.id; });
            if (idx >= 0) state.pedidos[idx] = d;
            else state.pedidos.push(d);
            guardarPedidos();
            state.editId = null;
            state.draft = null;
            state.msg = 'Pedido guardado en este navegador.';
            render(container);
        });
    }

    function pedidoEnEdicion() {
        if (state.editId === '__nuevo__') return state.draft || pedidoVacio();
        return state.pedidos.find(function (x) { return x.id === state.editId; }) || null;
    }

    function render(container) {
        cargarPedidos();
        var formBlock = '';
        if (state.editId !== null) {
            var p = pedidoEnEdicion();
            if (!p) {
                state.editId = null;
            } else {
                formBlock = formularioPedido(p);
            }
        }
        var msg = state.msg ? '<div class="admin-banner info">' + esc(state.msg) + '</div>' : '';
        container.innerHTML = msg +
            '<div class="admin-banner info">Pedidos se guardan en <strong>localStorage</strong> de este equipo (MVP). ' +
            'Para sincronizar con Google Sheet hará falta Apps Script más adelante.</div>' +
            '<div class="admin-toolbar">' +
            '<button type="button" class="admin-btn admin-btn-primary" id="pedNuevo">+ Nuevo pedido</button>' +
            '<span class="admin-muted-text">' + state.pedidos.length + ' pedidos registrados</span></div>' +
            formBlock +
            '<div class="admin-panel"><div class="admin-panel-head"><h3>Listado</h3></div>' +
            listaPedidosHtml() + '</div>';

        container.querySelector('#pedNuevo').addEventListener('click', function () {
            state.draft = pedidoVacio();
            state.editId = '__nuevo__';
            state.msg = '';
            render(container);
            var p = pedidoEnEdicion();
            if (p) bindFormEvents(container, p);
        });

        if (state.editId !== null) {
            var pe = pedidoEnEdicion();
            if (pe) bindFormEvents(container, pe);
        }

        container.querySelectorAll('.ped-edit').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var tr = btn.closest('tr');
                state.editId = tr.getAttribute('data-pedido-id');
                state.draft = null;
                state.msg = '';
                render(container);
            });
        });

        container.querySelectorAll('.ped-del').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var tr = btn.closest('tr');
                var id = tr.getAttribute('data-pedido-id');
                ObebeAdminDialog.confirm({
                    title: 'Eliminar pedido',
                    message: 'Se quitará este pedido de la lista local.',
                    confirmText: 'Eliminar',
                    cancelText: 'Cancelar',
                    variant: 'danger'
                }).then(function (ok) {
                    if (!ok) return;
                    state.pedidos = state.pedidos.filter(function (x) { return x.id !== id; });
                    guardarPedidos();
                    if (state.editId === id) state.editId = null;
                    render(container);
                });
            });
        });
    }

    global.ObebeAdminPedidos = {
        mount: function (container) {
            state.editId = null;
            state.msg = '';
            render(container);
        }
    };
})(window);
