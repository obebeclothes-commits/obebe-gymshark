(function (global) {
    'use strict';

    var KEY = 'obebe_cotizador_config_v1';
    var BLOB_ID = 'obebe-cotizador-config';

    var DEFAULTS = {
        factorUsd: 1.085,
        valorDolar: 17.5,
        envio: 40,
        margen: 1.3
    };

    function defaults() {
        var base = (global.OBEBE_COTIZADOR_DEFAULTS && typeof global.OBEBE_COTIZADOR_DEFAULTS === 'object')
            ? global.OBEBE_COTIZADOR_DEFAULTS
            : DEFAULTS;
        return {
            factorUsd: Number(base.factorUsd) || DEFAULTS.factorUsd,
            valorDolar: Number(base.valorDolar) || DEFAULTS.valorDolar,
            envio: Number(base.envio) || DEFAULTS.envio,
            margen: Number(base.margen) || DEFAULTS.margen
        };
    }

    function normalizar(raw) {
        var d = defaults();
        raw = raw && typeof raw === 'object' ? raw : {};
        var out = {
            factorUsd: Number(raw.factorUsd),
            valorDolar: Number(raw.valorDolar),
            envio: Number(raw.envio),
            margen: Number(raw.margen),
            actualizadoEn: Number(raw.actualizadoEn) || 0
        };
        if (!isFinite(out.factorUsd) || out.factorUsd <= 0) out.factorUsd = d.factorUsd;
        if (!isFinite(out.valorDolar) || out.valorDolar <= 0) out.valorDolar = d.valorDolar;
        if (!isFinite(out.envio) || out.envio < 0) out.envio = d.envio;
        if (!isFinite(out.margen) || out.margen <= 0) out.margen = d.margen;
        return out;
    }

    function leer() {
        try {
            var raw = localStorage.getItem(KEY);
            if (!raw) return normalizar(defaults());
            return normalizar(JSON.parse(raw));
        } catch (e) {
            return normalizar(defaults());
        }
    }

    function guardar(cfg) {
        var clean = normalizar(cfg);
        clean.actualizadoEn = Date.now();
        try {
            localStorage.setItem(KEY, JSON.stringify(clean));
        } catch (e) { /* ignore */ }
        if (global.ObebeAdminModulosCloud && ObebeAdminModulosCloud.notifyCotizadorSaved) {
            ObebeAdminModulosCloud.notifyCotizadorSaved();
        }
        return clean;
    }

    function payloadParaCloud(cfg) {
        var c = normalizar(cfg || leer());
        return [{
            id: BLOB_ID,
            factorUsd: c.factorUsd,
            valorDolar: c.valorDolar,
            envio: c.envio,
            margen: c.margen,
            actualizadoEn: c.actualizadoEn || Date.now()
        }];
    }

    function desdePayloadCloud(arr) {
        if (!Array.isArray(arr) || !arr.length) return null;
        var hit = null;
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] && (arr[i].id === BLOB_ID || arr[i].factorUsd != null)) {
                hit = arr[i];
                break;
            }
        }
        return hit ? normalizar(hit) : null;
    }

    function cotizarTotalUsd(sumaUsd, cfg) {
        cfg = normalizar(cfg || leer());
        var usd = Number(sumaUsd) || 0;
        if (usd <= 0) return 0;
        var base = ((usd * cfg.factorUsd) * cfg.valorDolar) + cfg.envio;
        return Math.round(base * cfg.margen * 100) / 100;
    }

    global.ObebeCotizadorStore = {
        KEY: KEY,
        BLOB_ID: BLOB_ID,
        defaults: defaults,
        normalizar: normalizar,
        leer: leer,
        guardar: guardar,
        payloadParaCloud: payloadParaCloud,
        desdePayloadCloud: desdePayloadCloud,
        cotizarTotalUsd: cotizarTotalUsd
    };
})(window);
