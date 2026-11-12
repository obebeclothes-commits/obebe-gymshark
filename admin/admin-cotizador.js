(function (global) {
    'use strict';

    var editando = false;
    var MAX_DEMO = 5;

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function numInput(id, label, valor, hint, readonly) {
        return '<div class="admin-cot-field">' +
            '<label for="' + id + '">' + esc(label) + '</label>' +
            '<input type="number" id="' + id + '" step="any" min="0" value="' + esc(String(valor)) + '"' +
            (readonly ? ' readonly' : '') + '>' +
            (hint ? '<p class="admin-cot-hint">' + esc(hint) + '</p>' : '') +
            '</div>';
    }

    function leerForm() {
        return {
            factorUsd: parseFloat((document.getElementById('cotFactorUsd') || {}).value),
            valorDolar: parseFloat((document.getElementById('cotValorDolar') || {}).value),
            envio: parseFloat((document.getElementById('cotEnvio') || {}).value),
            margen: parseFloat((document.getElementById('cotMargen') || {}).value)
        };
    }

    function setReadonly(on) {
        ['cotFactorUsd', 'cotValorDolar', 'cotEnvio', 'cotMargen'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) {
                if (on) el.setAttribute('readonly', 'readonly');
                else el.removeAttribute('readonly');
            }
        });
        var card = document.getElementById('adminCotizadorCard');
        if (card) card.classList.toggle('is-editing', !on);
    }

    function money(n) {
        return '$' + (Number(n) || 0).toLocaleString('es-MX', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });
    }

    function demoHtml() {
        return '<div class="admin-cot-demo">' +
            '<div class="admin-cot-demo-head">' +
            '<strong>Probar cotizador</strong>' +
            '<span class="admin-cot-demo-count" id="adminCotDemoCount">0 / ' + MAX_DEMO + '</span>' +
            '</div>' +
            '<div class="admin-cot-demo-rows" id="adminCotDemoRows"></div>' +
            '<div class="admin-cot-demo-actions">' +
            '<button type="button" class="admin-btn" id="adminCotDemoAdd">+ Artículo</button>' +
            '</div>' +
            '<div class="admin-cot-demo-total">' +
            '<span>Total estimado</span>' +
            '<strong id="adminCotDemoTotal">$0.00 MXN</strong>' +
            '</div>' +
            '</div>';
    }

    function filaDemo() {
        return '<div class="admin-cot-demo-row">' +
            '<input type="text" class="admin-cot-demo-nombre" placeholder="Artículo (opcional)">' +
            '<input type="number" class="admin-cot-demo-usd" min="0" step="0.01" placeholder="USD">' +
            '<button type="button" class="admin-cot-demo-remove" title="Quitar" aria-label="Quitar">&times;</button>' +
            '</div>';
    }

    function cfgActual() {
        return ObebeCotizadorStore.normalizar(leerForm());
    }

    function urlCotizadorTienda(cfg) {
        var h = String(global.location.hostname || '').toLowerCase();
        var base;
        if (h === 'obebe.store' || h === 'www.obebe.store') {
            base = global.location.origin + '/cotizador.html';
        } else {
            base = 'https://obebe.store/cotizador.html';
        }
        var ts = cfg && cfg.actualizadoEn ? cfg.actualizadoEn : Date.now();
        base = base + '?v=' + ts;
        if (global.ObebeCotizadorRemote && ObebeCotizadorRemote.urlConPreview) {
            return ObebeCotizadorRemote.urlConPreview(cfg || ObebeCotizadorStore.leer(), base);
        }
        return base;
    }

    function publicarParaTienda(cfg) {
        if (global.ObebeCotizadorRemote && ObebeCotizadorRemote.publicarPreview) {
            ObebeCotizadorRemote.publicarPreview(cfg || ObebeCotizadorStore.leer());
        }
    }

    function wireDemo() {
        var rows = document.getElementById('adminCotDemoRows');
        var addBtn = document.getElementById('adminCotDemoAdd');
        var countEl = document.getElementById('adminCotDemoCount');
        var totalEl = document.getElementById('adminCotDemoTotal');
        if (!rows || !addBtn || !countEl || !totalEl) return;

        function actualizar() {
            var n = rows.children.length;
            countEl.textContent = n + ' / ' + MAX_DEMO;
            addBtn.disabled = n >= MAX_DEMO;
            var usdList = [];
            rows.querySelectorAll('.admin-cot-demo-usd').forEach(function (inp) {
                var v = parseFloat(inp.value);
                if (!isNaN(v) && v > 0) usdList.push(v);
            });
            var total = ObebeCotizadorStore.cotizarListaUsd(usdList, cfgActual());
            totalEl.textContent = money(total) + ' MXN';
        }

        function ensureMin() {
            if (!rows.children.length) rows.insertAdjacentHTML('beforeend', filaDemo());
        }

        ensureMin();
        actualizar();

        addBtn.addEventListener('click', function () {
            if (rows.children.length >= MAX_DEMO) return;
            rows.insertAdjacentHTML('beforeend', filaDemo());
            actualizar();
        });
        rows.addEventListener('input', function (e) {
            if (e.target && (e.target.classList.contains('admin-cot-demo-usd') ||
                e.target.classList.contains('admin-cot-demo-nombre'))) {
                actualizar();
            }
        });
        rows.addEventListener('click', function (e) {
            var btn = e.target.closest('.admin-cot-demo-remove');
            if (!btn) return;
            if (rows.children.length <= 1) {
                var row = btn.parentElement;
                var n = row.querySelector('.admin-cot-demo-nombre');
                var u = row.querySelector('.admin-cot-demo-usd');
                if (n) n.value = '';
                if (u) u.value = '';
            } else {
                btn.parentElement.remove();
            }
            actualizar();
        });

        ['cotFactorUsd', 'cotValorDolar', 'cotEnvio', 'cotMargen'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', actualizar);
        });
    }

    function pintar() {
        var mount = document.getElementById('adminCotizadorMount');
        if (!mount || !global.ObebeCotizadorStore) return;
        editando = false;
        var cfg = ObebeCotizadorStore.leer();
        mount.innerHTML =
            '<div class="admin-cot-wrap">' +
            '<div class="admin-cot-head">' +
            '<div>' +
            '<p class="admin-cot-eyebrow">Ventas · Configuración</p>' +
            '<h2 class="admin-cot-title">Cotizador</h2>' +
            '<p class="admin-cot-sub">Parámetros de la calculadora pública. ' +
            '<a href="' + esc(urlCotizadorTienda(cfg)) + '" id="adminCotAbrirPagina" target="_blank" rel="noopener">Abrir página web</a></p>' +
            '</div>' +
            '<div class="admin-cot-actions" id="adminCotActions">' +
            '<button type="button" class="admin-btn admin-btn-primary admin-cot-btn" id="adminCotEdit">Editar</button>' +
            '</div>' +
            '</div>' +
            '<div class="admin-cot-card" id="adminCotizadorCard">' +
            '<form id="adminCotizadorForm" class="admin-cot-grid" autocomplete="off">' +
            numInput('cotFactorUsd', 'Factor sobre USD', cfg.factorUsd,
                'Ej. impuestos / multiplicador del precio en dólares', true) +
            numInput('cotValorDolar', 'Valor del dólar (MXN)', cfg.valorDolar,
                'Pesos mexicanos por 1 USD', true) +
            numInput('cotEnvio', 'Envío (MXN)', cfg.envio,
                'Se suma una sola vez por cotización', true) +
            numInput('cotMargen', 'Margen de ganancia', cfg.margen,
                'Decimal entre 0 y 1 (ej. 0.3 = 30 %). Precio = costo ÷ (1 − margen)', true) +
            '</form>' +
            '<div id="adminCotizadorDemo">' + demoHtml() + '</div>' +
            '<p id="adminCotizadorMsg" class="admin-cot-msg"></p>' +
            '</div></div>';

        var msg = document.getElementById('adminCotizadorMsg');
        var actions = document.getElementById('adminCotActions');
        var abrir = document.getElementById('adminCotAbrirPagina');
        if (abrir) {
            abrir.href = urlCotizadorTienda(cfg);
            abrir.addEventListener('click', function (e) {
                e.preventDefault();
                var live = editando ? cfgActual() : ObebeCotizadorStore.leer();
                publicarParaTienda(live);
                global.open(urlCotizadorTienda(live), '_blank', 'noopener,noreferrer');
            });
        }
        wireDemo();

        function pintarAcciones() {
            if (!actions) return;
            if (editando) {
                actions.innerHTML =
                    '<button type="button" class="admin-btn admin-btn-danger admin-cot-btn" id="adminCotCancel">Cancelar</button>' +
                    '<button type="button" class="admin-btn admin-btn-primary admin-cot-btn" id="adminCotSave">Guardar</button>';
                document.getElementById('adminCotCancel').addEventListener('click', function () {
                    editando = false;
                    pintar();
                });
                document.getElementById('adminCotSave').addEventListener('click', function () {
                    var dialog = global.ObebeAdminDialog;
                    var pedir = dialog && dialog.confirm
                        ? dialog.confirm({
                            title: 'Guardar cotizador',
                            message: 'Los cambios actualizarán la fórmula del cotizador en obebe.store. ¿Continuar?',
                            confirmText: 'Guardar',
                            confirmSuccess: true,
                            cancelDanger: true,
                            cancelText: 'Cancelar',
                            variant: 'warn'
                        })
                        : Promise.resolve(window.confirm('¿Guardar los cambios del cotizador?'));
                    pedir.then(function (ok) {
                        if (!ok) return;
                        var saved = ObebeCotizadorStore.guardar(leerForm(), { skipCloudNotify: true });
                        publicarParaTienda(saved);
                        editando = false;
                        var m = document.getElementById('adminCotizadorMsg');
                        if (m) m.textContent = 'Guardando en la nube para obebe.store…';
                        var push = global.ObebeAdminModulosCloud && ObebeAdminModulosCloud.pushCotizadorNow;
                        var fin = function (txt, alertOpts) {
                            pintar();
                            var msg = document.getElementById('adminCotizadorMsg');
                            if (msg) msg.textContent = txt;
                            if (alertOpts && dialog && dialog.alert) {
                                dialog.alert(alertOpts);
                            }
                        };
                        if (typeof push === 'function') {
                            push().then(function (res) {
                                var cuando = new Date(saved.actualizadoEn).toLocaleString('es-MX');
                                if (res && res.ok) {
                                    fin('Guardado y sincronizado con obebe.store · ' + cuando, {
                                        title: 'Cotizador guardado',
                                        message: 'La tienda ya puede leer los nuevos valores. Abre el cotizador con «Abrir página web» para comprobarlo.',
                                        variant: 'warn',
                                        confirmText: 'Entendido'
                                    });
                                } else if (res && res.offline) {
                                    fin('Guardado solo en este navegador (admin sin nube). Configura Supabase en admin-config.', {
                                        title: 'Sin sincronización',
                                        message: 'No hay conexión con admin-api. Los cambios no llegarán a obebe.store hasta que guardes con la nube activa.',
                                        variant: 'danger'
                                    });
                                } else {
                                    fin('Guardado local, pero falló la nube: ' + ((res && res.error) || 'error desconocido'), {
                                        title: 'Error al sincronizar',
                                        message: (res && res.error) || 'No se pudo subir la configuración. ¿Redesplegaste admin-api con soporte cotizador?',
                                        variant: 'danger'
                                    });
                                }
                            });
                        } else {
                            fin('Guardado · ' + new Date(saved.actualizadoEn).toLocaleString('es-MX'), {
                                title: 'Guardado local',
                                message: 'No está disponible la sincronización con la nube.',
                                variant: 'warn'
                            });
                        }
                    });
                });
            } else {
                actions.innerHTML = '<button type="button" class="admin-btn admin-btn-primary admin-cot-btn" id="adminCotEdit">Editar</button>';
                document.getElementById('adminCotEdit').addEventListener('click', function () {
                    editando = true;
                    setReadonly(false);
                    pintarAcciones();
                    if (msg) msg.textContent = 'Modo edición: ajusta los valores y pulsa Guardar.';
                });
            }
        }

        pintarAcciones();
        setReadonly(true);
    }

    function mount(el) {
        if (!el) return;
        el.id = el.id || 'adminCotizadorMount';
        if (el.id !== 'adminCotizadorMount') {
            el.innerHTML = '<div id="adminCotizadorMount"></div>';
        }
        function safePaint() {
            if (!global.ObebeCotizadorStore) {
                el.innerHTML = '<p class="admin-apartados-hint">Error: no cargó admin-cotizador-store.js. Recarga con Ctrl+F5.</p>';
                return;
            }
            pintar();
        }
        if (global.ObebeAdminModulosCloud && ObebeAdminModulosCloud.syncCotizador) {
            ObebeAdminModulosCloud.syncCotizador().catch(function () { /* ignore */ }).then(safePaint);
        } else {
            safePaint();
        }
    }

    global.ObebeAdminCotizador = { mount: mount, pintar: pintar };
})(window);
