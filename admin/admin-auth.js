(function (global) {
    'use strict';

    var SESSION_KEY = 'obebe_admin_session_v1';
    var SESSION_HOURS = 12;

    /** MVP: credenciales en cliente. Migrar a Apps Script / Supabase Auth antes de producción seria. */
    var CUENTAS = [
        {
            usuario: 'OBEBE',
            password: 'OBebeClothes.1',
            nombre: 'OBEBE',
            rol: 'Administrador',
            acceso: 'admin'
        },
        {
            usuario: 'NATY',
            password: 'mayoreo9',
            nombre: 'NATY',
            rol: 'Mayoreo',
            acceso: 'mayoreo_cliente',
            clienteMayoreo: 'naty'
        }
    ];

    function normUsuario(usuario) {
        return String(usuario || '').trim().toUpperCase();
    }

    function buscarCuenta(usuario, password) {
        var u = normUsuario(usuario);
        for (var i = 0; i < CUENTAS.length; i++) {
            var c = CUENTAS[i];
            if (normUsuario(c.usuario) === u && c.password === password) {
                return {
                    usuario: c.usuario,
                    nombre: c.nombre,
                    rol: c.rol,
                    acceso: c.acceso || 'admin',
                    clienteMayoreo: c.clienteMayoreo || ''
                };
            }
        }
        return null;
    }

    function tokenNuevo() {
        if (global.crypto && crypto.getRandomValues) {
            var buf = new Uint8Array(16);
            crypto.getRandomValues(buf);
            return Array.from(buf, function (b) {
                return b.toString(16).padStart(2, '0');
            }).join('');
        }
        return String(Date.now()) + Math.random().toString(36).slice(2);
    }

    function guardarSesion(usuario) {
        var exp = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
        var data = {
            token: tokenNuevo(),
            exp: exp,
            user: usuario
        };
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
        } catch (err) {
            console.warn('[admin-auth]', err);
        }
        return data;
    }

    function leerSesion() {
        try {
            var raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (!data || !data.exp || Date.now() > data.exp || !data.user) {
                sessionStorage.removeItem(SESSION_KEY);
                return null;
            }
            return data;
        } catch (e) {
            return null;
        }
    }

    function cerrarSesion() {
        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch (e) { /* ignore */ }
    }

    function iniciarSesion(usuario, password) {
        var user = buscarCuenta(usuario, password);
        if (!user) return { ok: false, error: 'Usuario o contraseña incorrectos.' };
        guardarSesion(user);
        return { ok: true, user: user };
    }

    function requiereAuth(onAutenticado) {
        var ses = leerSesion();
        if (ses && ses.user) {
            onAutenticado(ses.user);
            return true;
        }
        return false;
    }

    function esMayoreoCliente(user) {
        return !!(user && user.acceso === 'mayoreo_cliente');
    }

    global.ObebeAdminAuth = {
        iniciarSesion: iniciarSesion,
        cerrarSesion: cerrarSesion,
        leerSesion: leerSesion,
        requiereAuth: requiereAuth,
        esMayoreoCliente: esMayoreoCliente,
        usuarioEsperado: CUENTAS[0].usuario
    };
})(window);
