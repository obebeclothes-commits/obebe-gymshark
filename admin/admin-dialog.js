(function (global) {
    'use strict';

    var pendingResolve = null;
    var dialogMode = 'confirm';
    var boundKey = false;

    function ensureRoot() {
        var root = document.getElementById('adminDialogRoot');
        if (root) return root;
        root = document.createElement('div');
        root.id = 'adminDialogRoot';
        root.className = 'admin-dialog-root admin-hidden';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML =
            '<div class="admin-dialog-backdrop" data-admin-dialog-dismiss="1"></div>' +
            '<div class="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="adminDialogTitle" aria-describedby="adminDialogMessage">' +
            '<div class="admin-dialog-icon" id="adminDialogIcon" aria-hidden="true"></div>' +
            '<h3 class="admin-dialog-title" id="adminDialogTitle"></h3>' +
            '<p class="admin-dialog-message" id="adminDialogMessage"></p>' +
            '<div class="admin-dialog-actions">' +
            '<button type="button" class="admin-btn admin-btn-ghost" id="adminDialogCancel">Cancelar</button>' +
            '<button type="button" class="admin-btn admin-btn-danger" id="adminDialogConfirm">Eliminar</button>' +
            '</div></div>';
        document.body.appendChild(root);

        root.querySelector('[data-admin-dialog-dismiss]').addEventListener('click', function () {
            close(false);
        });
        document.getElementById('adminDialogCancel').addEventListener('click', function () {
            close(false);
        });
        document.getElementById('adminDialogConfirm').addEventListener('click', function () {
            close(dialogMode === 'alert' ? undefined : true);
        });

        if (!boundKey) {
            boundKey = true;
            document.addEventListener('keydown', function (ev) {
                if (ev.key === 'Escape' && pendingResolve) close(false);
            });
        }
        return root;
    }

    function close(result) {
        var root = document.getElementById('adminDialogRoot');
        if (!root) return;
        root.classList.add('admin-hidden');
        root.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('admin-dialog-open');
        var fn = pendingResolve;
        pendingResolve = null;
        dialogMode = 'confirm';
        if (fn) fn(result);
    }

    function openDialog(opts, mode) {
        opts = opts || {};
        dialogMode = mode;
        var root = ensureRoot();
        var variant = opts.variant || (mode === 'alert' ? 'warn' : 'danger');
        var iconEl = document.getElementById('adminDialogIcon');
        var titleEl = document.getElementById('adminDialogTitle');
        var msgEl = document.getElementById('adminDialogMessage');
        var btnCancel = document.getElementById('adminDialogCancel');
        var btnConfirm = document.getElementById('adminDialogConfirm');

        iconEl.className = 'admin-dialog-icon admin-dialog-icon--' + variant;
        iconEl.textContent = variant === 'danger' ? '🗑' : '!';
        titleEl.textContent = opts.title || (mode === 'alert' ? 'Aviso' : '¿Confirmar?');
        msgEl.textContent = opts.message || '';

        if (mode === 'alert') {
            btnCancel.classList.add('admin-hidden');
            btnConfirm.textContent = opts.confirmText || 'Entendido';
            btnConfirm.className = 'admin-btn admin-btn-primary';
        } else {
            btnCancel.classList.remove('admin-hidden');
            btnCancel.textContent = opts.cancelText || 'Cancelar';
            btnConfirm.textContent = opts.confirmText || 'Confirmar';
            btnConfirm.className = 'admin-btn ' + (variant === 'danger' ? 'admin-btn-danger' : 'admin-btn-primary');
            btnCancel.className = 'admin-btn ' + (opts.cancelDanger ? 'admin-btn-danger' : 'admin-btn-ghost');
        }

        return new Promise(function (resolve) {
            pendingResolve = resolve;
            root.classList.remove('admin-hidden');
            root.setAttribute('aria-hidden', 'false');
            document.body.classList.add('admin-dialog-open');
            (mode === 'alert' ? btnConfirm : btnCancel).focus();
        });
    }

    function confirm(opts) {
        return openDialog(opts, 'confirm');
    }

    function alert(opts) {
        if (typeof opts === 'string') opts = { message: opts };
        return openDialog(opts, 'alert');
    }

    function confirmPassword(opts) {
        opts = opts || {};
        var root = ensureRoot();
        var msgEl = document.getElementById('adminDialogMessage');
        var titleEl = document.getElementById('adminDialogTitle');
        var btnCancel = document.getElementById('adminDialogCancel');
        var btnConfirm = document.getElementById('adminDialogConfirm');
        var iconEl = document.getElementById('adminDialogIcon');

        iconEl.className = 'admin-dialog-icon admin-dialog-icon--danger';
        iconEl.textContent = '🔒';
        titleEl.textContent = opts.title || 'Confirmar con contraseña OBEBE';
        msgEl.innerHTML = '<span class="admin-dialog-message-plain">' +
            String(opts.message || 'Para eliminar artículos del inventario.') + '</span>' +
            '<div class="admin-field admin-dialog-pw-field">' +
            '<label for="adminDialogPasswordInput">Contraseña</label>' +
            '<input type="password" id="adminDialogPasswordInput" autocomplete="current-password" class="admin-dialog-pw-input">' +
            '</div><p id="adminDialogPasswordError" class="admin-login-error" role="alert"></p>';

        btnCancel.classList.remove('admin-hidden');
        btnCancel.textContent = opts.cancelText || 'Cancelar';
        btnConfirm.textContent = opts.confirmText || 'Eliminar';
        btnConfirm.className = 'admin-btn admin-btn-danger';

        function finishDialog() {
            root.classList.add('admin-hidden');
            root.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('admin-dialog-open');
            msgEl.textContent = '';
            pendingResolve = null;
        }

        return new Promise(function (resolve) {
            function onCancel() {
                finishDialog();
                resolve(null);
            }
            function onConfirm() {
                var errEl = document.getElementById('adminDialogPasswordError');
                var input = document.getElementById('adminDialogPasswordInput');
                var pw = input ? input.value : '';
                if (!global.ObebeAdminAuth || !ObebeAdminAuth.verificarPasswordObebe(pw)) {
                    if (errEl) errEl.textContent = 'Contraseña incorrecta.';
                    if (input) input.focus();
                    return;
                }
                finishDialog();
                resolve(true);
            }
            pendingResolve = function (confirmed) {
                if (confirmed) onConfirm();
                else onCancel();
            };
            root.classList.remove('admin-hidden');
            root.setAttribute('aria-hidden', 'false');
            document.body.classList.add('admin-dialog-open');
            var inputFocus = document.getElementById('adminDialogPasswordInput');
            if (inputFocus) inputFocus.focus();
        });
    }

    global.ObebeAdminDialog = {
        confirm: confirm,
        alert: alert,
        confirmPassword: confirmPassword
    };
})(window);
