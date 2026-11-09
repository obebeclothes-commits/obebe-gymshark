/**
 * Cotizador Obebe — mismos parámetros que en admin (Ventas → Cotizador).
 *
 * Fórmula (como Excel REDONDEAR.MAS(…, -1)):
 *   (((USD * factorUsd) * valorDolar) + envío) / (1 - margen)
 * Redondeo: hacia arriba a la decena más cercana (…, 120, 130, 140).
 */
window.OBEBE_COTIZADOR_DEFAULTS = {
    factorUsd: 1.085,
    valorDolar: 18.9,
    envio: 40,
    margen: 0.3
};

window.OBEBE_COTIZADOR_CONFIG = Object.assign({}, window.OBEBE_COTIZADOR_DEFAULTS);

window.ObebeCotizadorFormula = {
    /** margen 0.3 → divisor 0.7; valores > 1 se tratan como legacy (multiplicador antiguo). */
    divisorMargen: function (margen) {
        var m = Number(margen);
        if (m > 1) return 0.7;
        if (m > 0 && m < 1) return 1 - m;
        return 0.7;
    },
    redondearMasDecenas: function (n) {
        var x = Number(n);
        if (!isFinite(x) || x <= 0) return 0;
        return Math.ceil(x / 10) * 10;
    },
    cotizarUsd: function (usd, cfg, opts) {
        opts = opts || {};
        cfg = cfg && typeof cfg === 'object' ? cfg : {};
        var u = Number(usd) || 0;
        if (u <= 0) return 0;
        var factorUsd = Number(cfg.factorUsd) > 0 ? Number(cfg.factorUsd) : 1.085;
        var valorDolar = Number(cfg.valorDolar) > 0 ? Number(cfg.valorDolar) : 18.9;
        var envio = Number(cfg.envio) >= 0 ? Number(cfg.envio) : 40;
        var mxn = (u * factorUsd) * valorDolar;
        if (opts.conEnvio) mxn += envio;
        var div = window.ObebeCotizadorFormula.divisorMargen(cfg.margen);
        if (!(div > 0)) div = 0.7;
        return window.ObebeCotizadorFormula.redondearMasDecenas(mxn / div);
    },
    /** Envío una sola vez por pedido, con margen y redondeo a decenas. */
    cargoEnvioMxn: function (cfg) {
        cfg = cfg && typeof cfg === 'object' ? cfg : {};
        var envio = Number(cfg.envio) >= 0 ? Number(cfg.envio) : 40;
        var div = window.ObebeCotizadorFormula.divisorMargen(cfg.margen);
        if (!(div > 0)) div = 0.7;
        return window.ObebeCotizadorFormula.redondearMasDecenas(envio / div);
    },
    /**
     * Varios artículos: cada USD con la fórmula sin envío + envío una vez.
     * Un solo artículo: incluye envío en ese precio (coincide línea y total).
     */
    cotizarCarrito: function (usdList, cfg) {
        cfg = cfg && typeof cfg === 'object' ? cfg : {};
        var list = (usdList || []).map(function (u) {
            return Number(u) || 0;
        }).filter(function (u) {
            return u > 0;
        });
        if (!list.length) return 0;
        if (list.length === 1) {
            return window.ObebeCotizadorFormula.cotizarUsd(list[0], cfg, { conEnvio: true });
        }
        var sum = 0;
        list.forEach(function (u) {
            sum += window.ObebeCotizadorFormula.cotizarUsd(u, cfg, { conEnvio: false });
        });
        return sum + window.ObebeCotizadorFormula.cargoEnvioMxn(cfg);
    }
};
