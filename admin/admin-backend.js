(function (global) {
    'use strict';

    function cfg() {
        return global.OBEBE_ADMIN_CONFIG || {};
    }

    function cfgData() {
        return global.OBEBE_DATA_CONFIG || {};
    }

    function usarSupabaseAdmin() {
        return String(cfg().dataSource || '').toLowerCase() === 'supabase';
    }

    function usarSupabaseTienda() {
        var d = cfgData();
        if (String(d.dataSource || '').toLowerCase() === 'supabase') return true;
        return usarSupabaseAdmin();
    }

    function supabaseUrl() {
        return String(cfg().supabaseUrl || cfgData().supabaseUrl || '').trim();
    }

    function supabaseAnonKey() {
        return String(cfg().supabaseAnonKey || cfgData().supabaseAnonKey || '').trim();
    }

    function adminApiUrl() {
        return String(cfg().adminApiUrl || '').trim();
    }

    function supabaseListoAdmin() {
        return usarSupabaseAdmin() && supabaseUrl() && supabaseAnonKey() && adminApiUrl();
    }

    function headersAnon() {
        var key = supabaseAnonKey();
        return {
            apikey: key,
            Authorization: 'Bearer ' + key,
            'Content-Type': 'application/json'
        };
    }

    function resolveAccessToken() {
        if (global.ObebeAdminAuth && typeof global.ObebeAdminAuth.accessToken === 'function') {
            return global.ObebeAdminAuth.accessToken();
        }
        return Promise.resolve(null);
    }

    function callAdminApi(action, payload) {
        if (!adminApiUrl()) {
            return Promise.reject(new Error('Falta adminApiUrl en admin-config.js (Edge Function admin-api).'));
        }
        var body = Object.assign({ action: action }, payload || {});
        delete body.secret;
        return resolveAccessToken().then(function (token) {
            if (!token) {
                throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
            }
            return fetch(adminApiUrl(), {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: supabaseAnonKey(),
                    Authorization: 'Bearer ' + token
                },
                body: JSON.stringify(body)
            });
        }).then(function (res) {
            return res.text().then(function (text) {
                var data;
                try {
                    data = text ? JSON.parse(text) : {};
                } catch (e) {
                    throw new Error('Respuesta no JSON (HTTP ' + res.status + '): ' + text.slice(0, 200));
                }
                if (data && data.ok === false) {
                    throw new Error((data && data.error) || 'Error en admin-api');
                }
                if (!res.ok && (!data || data.ok !== true)) {
                    throw new Error((data && data.error) || ('HTTP ' + res.status));
                }
                return data;
            });
        });
    }

    /** Inventario completo (con costos): solo vía admin-api con JWT de administrador. */
    function fetchInventarioRaw(intento) {
        intento = intento || 0;
        return callAdminApi('getInventario', {}).then(function (res) {
            return res.rows || [];
        }).catch(function (err) {
            if (intento < 2) {
                return new Promise(function (resolve) {
                    setTimeout(resolve, 800 * (intento + 1));
                }).then(function () {
                    return fetchInventarioRaw(intento + 1);
                });
            }
            throw err;
        });
    }

    function fetchVentasDesdeApi() {
        return callAdminApi('getVentas', {}).then(function (res) {
            if (!res || res.ok === false) {
                throw new Error((res && res.error) || 'Error al leer ventas');
            }
            return res.ventas || [];
        });
    }

    global.ObebeAdminBackend = {
        usarSupabaseAdmin: usarSupabaseAdmin,
        usarSupabaseTienda: usarSupabaseTienda,
        supabaseListoAdmin: supabaseListoAdmin,
        supabaseUrl: supabaseUrl,
        supabaseAnonKey: supabaseAnonKey,
        callAdminApi: callAdminApi,
        fetchInventarioRaw: fetchInventarioRaw,
        fetchVentasDesdeApi: fetchVentasDesdeApi
    };
})(window);
