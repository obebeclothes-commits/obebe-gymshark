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

    function adminSecret() {
        return cfg().inventarioSecret || cfg().adminApiSecret || 'OBebeClotes.1';
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

    function callAdminApi(action, payload) {
        if (!adminApiUrl()) {
            return Promise.reject(new Error('Falta adminApiUrl en admin-config.js (Edge Function admin-api).'));
        }
        var body = Object.assign({ action: action, secret: adminSecret() }, payload || {});
        return fetch(adminApiUrl(), {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + supabaseAnonKey() },
            body: JSON.stringify(body)
        }).then(function (res) {
            return res.text().then(function (text) {
                var data;
                try {
                    data = text ? JSON.parse(text) : {};
                } catch (e) {
                    throw new Error('Respuesta no JSON (HTTP ' + res.status + '): ' + text.slice(0, 200));
                }
                if (!res.ok && (!data || data.ok !== true)) {
                    throw new Error((data && data.error) || ('HTTP ' + res.status));
                }
                return data;
            });
        });
    }

    function fetchInventarioRaw() {
        if (!supabaseUrl() || !supabaseAnonKey()) {
            return Promise.reject(new Error('Faltan supabaseUrl o supabaseAnonKey.'));
        }
        var url = supabaseUrl().replace(/\/$/, '') +
            '/rest/v1/inventario_filas?select=id,celdas,legacy_sheet_row&order=id.asc&limit=5000';
        return fetch(url, { cache: 'no-store', headers: headersAnon() })
            .then(function (res) {
                if (!res.ok) throw new Error('Inventario Supabase HTTP ' + res.status);
                return res.json();
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
