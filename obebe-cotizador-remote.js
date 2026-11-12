/**
 * Carga la configuración del cotizador desde admin-api (público) o REST de Supabase.
 * Usado en cotizador.html (tienda).
 */
(function (global) {
    'use strict';

    var PREVIEW_KEY = 'obebe_cotizador_preview_v1';

    function normalizar(raw) {
        if (global.ObebeCotizadorFormula && ObebeCotizadorFormula.normalizarConfig) {
            return ObebeCotizadorFormula.normalizarConfig(raw);
        }
        var d = global.OBEBE_COTIZADOR_DEFAULTS || {
            factorUsd: 1.085,
            valorDolar: 18.9,
            envio: 40,
            margen: 0.3
        };
        return Object.assign({}, d, raw || {});
    }

    function leerPreviewSesion() {
        try {
            var raw = sessionStorage.getItem(PREVIEW_KEY);
            if (!raw) return null;
            return normalizar(JSON.parse(raw));
        } catch (e) {
            return null;
        }
    }

    function leerPreviewHash() {
        var h = String(global.location.hash || '');
        var m = /^#preview=([^&]+)/i.exec(h);
        if (!m) return null;
        try {
            var o = JSON.parse(atob(decodeURIComponent(m[1])));
            return normalizar({
                factorUsd: o.f,
                valorDolar: o.v,
                envio: o.e,
                margen: o.m,
                actualizadoEn: o.t
            });
        } catch (e) {
            return null;
        }
    }

    function urlConPreview(cfg, baseUrl) {
        cfg = normalizar(cfg);
        baseUrl = String(baseUrl || '').split('#')[0];
        try {
            var pack = {
                f: cfg.factorUsd,
                v: cfg.valorDolar,
                e: cfg.envio,
                m: cfg.margen,
                t: cfg.actualizadoEn || Date.now()
            };
            return baseUrl + '#preview=' + encodeURIComponent(btoa(JSON.stringify(pack)));
        } catch (e) {
            return baseUrl;
        }
    }

    function publicarPreview(cfg) {
        try {
            sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(normalizar(cfg)));
        } catch (e) { /* ignore */ }
    }

    function cargarConfigSupabaseRest() {
        var dataCfg = global.OBEBE_DATA_CONFIG || {};
        var base = String(dataCfg.supabaseUrl || '').trim().replace(/\/$/, '');
        var key = String(dataCfg.supabaseAnonKey || '').trim();
        if (!base || !key) return Promise.resolve({ config: null, source: 'none' });
        var rest = base + '/rest/v1/admin_modulos_blob?module_key=eq.cotizador&select=payload&limit=1';
        return fetch(rest, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-store',
            headers: { apikey: key, Authorization: 'Bearer ' + key }
        }).then(function (res) {
            if (!res.ok) return { config: null, source: 'rest', error: 'HTTP ' + res.status };
            return res.json();
        }).then(function (rows) {
            if (!rows || !Array.isArray(rows) || !rows[0] || !rows[0].payload) {
                return { config: null, source: 'rest' };
            }
            var payload = rows[0].payload;
            var hit = null;
            if (Array.isArray(payload)) {
                for (var i = 0; i < payload.length; i++) {
                    var p = payload[i];
                    if (p && (p.id === 'obebe-cotizador-config' || p.factorUsd != null)) {
                        hit = p;
                        break;
                    }
                }
            }
            return { config: hit ? normalizar(hit) : null, source: 'rest' };
        }).catch(function (err) {
            return { config: null, source: 'rest', error: String((err && err.message) || err) };
        });
    }

    function cargarConfigNube() {
        var dataCfg = global.OBEBE_DATA_CONFIG || {};
        var adminCfg = global.OBEBE_ADMIN_CONFIG || {};
        var url = String(dataCfg.adminApiUrl || adminCfg.adminApiUrl || '').trim();
        var key = String(dataCfg.supabaseAnonKey || adminCfg.supabaseAnonKey || '').trim();
        if (!url) {
            return cargarConfigSupabaseRest();
        }
        return fetch(url, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + key,
                apikey: key
            },
            body: JSON.stringify({ action: 'getCotizadorConfig' })
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (data && data.ok && data.config) {
                    return { config: normalizar(data.config), source: 'api', updatedAt: data.updatedAt };
                }
                var err = (data && data.error) ? String(data.error) : ('HTTP ' + res.status);
                if (err.indexOf('action') !== -1 || err.indexOf('desconocid') !== -1) {
                    err = 'admin-api sin getCotizadorConfig (redeploy Edge Function)';
                }
                return cargarConfigSupabaseRest().then(function (fallback) {
                    fallback.apiError = err;
                    return fallback;
                });
            });
        }).catch(function (err) {
            return cargarConfigSupabaseRest().then(function (fallback) {
                fallback.apiError = String((err && err.message) || err);
                return fallback;
            });
        });
    }

    /** Devuelve la config más reciente: nube + vista previa del admin (misma pestaña/origen). */
    function resolverConfigRemota() {
        return cargarConfigNube().then(function (res) {
            var cfg = res.config ? normalizar(res.config) : null;
            var preview = leerPreviewHash() || leerPreviewSesion();
            if (preview) {
                var tsPrev = preview.actualizadoEn || 0;
                var tsCfg = cfg && cfg.actualizadoEn ? cfg.actualizadoEn : 0;
                if (!cfg || tsPrev >= tsCfg) {
                    cfg = preview;
                    res = Object.assign({}, res, {
                        source: leerPreviewHash() ? 'preview-hash' : 'preview',
                        config: cfg
                    });
                    if (leerPreviewHash() && global.history && global.history.replaceState) {
                        try {
                            global.history.replaceState(null, '', String(global.location.pathname + global.location.search));
                        } catch (e) { /* ignore */ }
                    }
                }
            }
            if (!cfg) {
                cfg = normalizar(global.OBEBE_COTIZADOR_DEFAULTS || {});
                res = Object.assign({}, res, { source: res.source || 'defaults', config: cfg });
            } else {
                res.config = cfg;
            }
            return res;
        });
    }

    global.ObebeCotizadorRemote = {
        PREVIEW_KEY: PREVIEW_KEY,
        normalizar: normalizar,
        publicarPreview: publicarPreview,
        urlConPreview: urlConPreview,
        leerPreviewSesion: leerPreviewSesion,
        leerPreviewHash: leerPreviewHash,
        cargarConfigNube: cargarConfigNube,
        resolverConfigRemota: resolverConfigRemota
    };
})(window);
