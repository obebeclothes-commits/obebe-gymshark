(function (global) {
    'use strict';

    var SESSION_HOURS = 12;
    var _client = null;
    var _cachedUser = null;

    function cfg() {
        return global.OBEBE_ADMIN_CONFIG || {};
    }

    function getClient() {
        if (_client) return _client;
        var sdk = global.supabase;
        if (!sdk || typeof sdk.createClient !== 'function') {
            throw new Error(
                'Falta el SDK de Supabase (supabase-js). Recarga con Ctrl+F5. Si persiste, el CDN no cargó.'
            );
        }
        var url = String(cfg().supabaseUrl || '').trim();
        var key = String(cfg().supabaseAnonKey || '').trim();
        if (!url || !key) {
            throw new Error('Faltan supabaseUrl o supabaseAnonKey en admin-config.js.');
        }
        _client = global.supabase.createClient(url, key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
                storage: global.localStorage
            }
        });
        return _client;
    }

    function accessToken() {
        return getClient().auth.getSession().then(function (res) {
            var session = res && res.data && res.data.session;
            return session && session.access_token ? session.access_token : null;
        });
    }

    function mapProfile(apiUser) {
        if (!apiUser) return null;
        return {
            usuario: apiUser.usuario || apiUser.nombre || '',
            nombre: apiUser.nombre || apiUser.usuario || '',
            rol: apiUser.rol || '',
            acceso: apiUser.acceso || 'admin',
            clienteMayoreo: apiUser.clienteMayoreo || '',
            email: apiUser.email || ''
        };
    }

    function fetchProfile() {
        if (!global.ObebeAdminBackend || typeof global.ObebeAdminBackend.callAdminApi !== 'function') {
            return Promise.reject(new Error('Backend admin no disponible.'));
        }
        return global.ObebeAdminBackend.callAdminApi('getMe', {}).then(function (data) {
            var user = mapProfile(data && data.user);
            if (!user) throw new Error('Perfil administrativo no encontrado.');
            _cachedUser = user;
            return user;
        });
    }

    function iniciarSesion(email, password) {
        var correo = String(email || '').trim().toLowerCase();
        var pass = String(password || '');
        if (!correo || !pass) {
            return Promise.resolve({ ok: false, error: 'Correo y contraseña son obligatorios.' });
        }
        return getClient().auth.signInWithPassword({ email: correo, password: pass })
            .then(function (res) {
                if (res.error) {
                    return { ok: false, error: 'Correo o contraseña incorrectos.' };
                }
                return fetchProfile().then(function (user) {
                    return { ok: true, user: user };
                }).catch(function (err) {
                    return getClient().auth.signOut().then(function () {
                        return {
                            ok: false,
                            error: (err && err.message) || 'Tu cuenta no tiene acceso al panel.'
                        };
                    });
                });
            })
            .catch(function (err) {
                return { ok: false, error: (err && err.message) || 'No se pudo iniciar sesión.' };
            });
    }

    function cerrarSesion() {
        _cachedUser = null;
        try {
            return getClient().auth.signOut().then(function () { return true; });
        } catch (e) {
            return Promise.resolve(true);
        }
    }

    function leerSesion() {
        if (_cachedUser) {
            return { user: _cachedUser, exp: Date.now() + SESSION_HOURS * 3600 * 1000 };
        }
        return null;
    }

    function restaurarSesion() {
        return getClient().auth.getSession().then(function (res) {
            var session = res && res.data && res.data.session;
            if (!session) {
                _cachedUser = null;
                return null;
            }
            return fetchProfile().then(function (user) {
                return { user: user };
            }).catch(function () {
                _cachedUser = null;
                return getClient().auth.signOut().then(function () { return null; });
            });
        }).catch(function () {
            _cachedUser = null;
            return null;
        });
    }

    function requiereAuth(onAutenticado) {
        var ses = leerSesion();
        if (ses && ses.user) {
            onAutenticado(ses.user);
            return true;
        }
        restaurarSesion().then(function (s) {
            if (s && s.user) onAutenticado(s.user);
        });
        return false;
    }

    function esMayoreoCliente(user) {
        return !!(user && user.acceso === 'mayoreo_cliente');
    }

    /**
     * Reautenticación para acciones sensibles del panel.
     * Valida la contraseña del usuario autenticado actual vía Supabase Auth.
     */
    function verificarPasswordActual(password) {
        var pass = String(password || '');
        if (!pass) return Promise.resolve(false);
        return getClient().auth.getUser().then(function (res) {
            var email = res && res.data && res.data.user && res.data.user.email;
            if (!email) return false;
            return getClient().auth.signInWithPassword({ email: email, password: pass })
                .then(function (r) { return !r.error; })
                .catch(function () { return false; });
        }).catch(function () { return false; });
    }

    /** @deprecated Usar verificarPasswordActual (async). */
    function verificarPasswordObebe(password) {
        console.warn('[admin-auth] verificarPasswordObebe está deprecado; usar verificarPasswordActual.');
        return false;
    }

    global.ObebeAdminAuth = {
        iniciarSesion: iniciarSesion,
        cerrarSesion: cerrarSesion,
        leerSesion: leerSesion,
        restaurarSesion: restaurarSesion,
        requiereAuth: requiereAuth,
        esMayoreoCliente: esMayoreoCliente,
        verificarPasswordActual: verificarPasswordActual,
        verificarPasswordObebe: verificarPasswordObebe,
        accessToken: accessToken,
        getClient: getClient,
        usuarioEsperado: ''
    };
})(window);
