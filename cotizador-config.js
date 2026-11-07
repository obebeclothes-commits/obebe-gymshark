/**
 * Valores por defecto del Cotizador Obebe.
 * El admin (Ventas → Cotizador) puede cambiarlos; la tienda intenta
 * leer la versión en la nube y, si no hay, usa estos defaults.
 *
 * Fórmula:
 *   (((sumaUSD * factorUsd) * valorDolar) + envio) * margen
 */
window.OBEBE_COTIZADOR_DEFAULTS = {
    factorUsd: 1.085,
    valorDolar: 17.5,
    envio: 40,
    margen: 1.3
};

window.OBEBE_COTIZADOR_CONFIG = Object.assign({}, window.OBEBE_COTIZADOR_DEFAULTS);
