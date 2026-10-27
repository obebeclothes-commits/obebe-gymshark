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

    global.ObebeAdminDialog = {
        confirm: confirm,
        alert: alert
    };
})(window);
