(function (global) {
    'use strict';

    /**
     * 2.º pedido NATY · 29/10/2026 · 18 pzas.
     * Copia canónica desde hoja MAYOREO (filas 77–94 del export), para cuando ya no
     * hay líneas en inventario local ni copia en la nube.
     */
    var ITEMS_PEDIDO_NATY_20261029 = [
        { nombre: 'GLOBAL LIFTING OVERSIZED ESSENTIAL JOGGERS', cantidad: 1, talla: 'L', color: 'NEGRO', tipo: 'JOGGERS', marca: 'GYMSHARK', precioRetail: 750, precioCliente: 430 },
        { nombre: 'ACTIVE BACKPACK', cantidad: 1, talla: 'ONE SIZE', color: 'VERDE', tipo: 'ACCESORIOS', marca: 'GYMSHARK', precioRetail: 600, precioCliente: 360 },
        { nombre: 'ARRIVAL JOGGERS', cantidad: 1, talla: 'L', color: 'GRIS', tipo: 'JOGGERS', marca: 'GYMSHARK', precioRetail: 750, precioCliente: 560 },
        { nombre: 'ARRIVAL JOGGERS', cantidad: 1, talla: 'S', color: 'GRIS', tipo: 'JOGGERS', marca: 'GYMSHARK', precioRetail: 750, precioCliente: 560 },
        { nombre: 'ARRIVAL JOGGERS', cantidad: 1, talla: 'M', color: 'GRIS', tipo: 'JOGGERS', marca: 'GYMSHARK', precioRetail: 750, precioCliente: 560 },
        { nombre: 'SPORT 7 2 IN 1 SHORTS', cantidad: 1, talla: 'S', color: 'AZUL', tipo: 'SHORT', marca: 'GYMSHARK', precioRetail: 600, precioCliente: 360 },
        { nombre: 'ELEMENT BASELAYER T-SHIRT', cantidad: 1, talla: 'M', color: 'ROJO', tipo: 'T-SHIRT', marca: 'GYMSHARK', precioRetail: 800, precioCliente: 450 },
        { nombre: 'BUILT FOR MORE T-SHIRT', cantidad: 1, talla: 'S', color: 'BLANCO', tipo: 'T-SHIRT', marca: 'GYMSHARK', precioRetail: 550, precioCliente: 400 },
        { nombre: 'BUILT FOR MORE T-SHIRT', cantidad: 1, talla: 'M', color: 'GRIS', tipo: 'T-SHIRT', marca: 'GYMSHARK', precioRetail: 550, precioCliente: 400 },
        { nombre: 'BUILT FOR MORE T-SHIRT', cantidad: 1, talla: 'M', color: 'BLANCO', tipo: 'T-SHIRT', marca: 'GYMSHARK', precioRetail: 550, precioCliente: 400 },
        { nombre: 'ARRIVAL TANK', cantidad: 1, talla: 'L', color: 'VERDE', tipo: 'TANK', marca: 'GYMSHARK', precioRetail: 500, precioCliente: 380 },
        { nombre: '500ML BOTTLE', cantidad: 1, talla: 'ONE SIZE', color: 'GRIS', tipo: 'ACCESORIOS', marca: 'GYMSHARK', precioRetail: 500, precioCliente: 360 },
        { nombre: '2.2L WATER BOTTLE', cantidad: 1, talla: 'ONE SIZE', color: 'NEGRO', tipo: 'ACCESORIOS', marca: 'GYMSHARK', precioRetail: 510, precioCliente: 380 },
        { nombre: 'COLLEGIATE CAP', cantidad: 1, talla: 'ONE SIZE', color: 'AZUL', tipo: 'ACCESORIOS', marca: 'GYMSHARK', precioRetail: 500, precioCliente: 360 },
        { nombre: 'CREW SOCKS 5 PK', cantidad: 1, talla: 'S', color: 'NEGRO', tipo: 'ACCESORIOS', marca: 'GYMSHARK', precioRetail: 450, precioCliente: 330 },
        { nombre: 'COLLEGIATE CREW SOCKS 3PK', cantidad: 1, talla: 'M', color: 'ROSA', tipo: 'ACCESORIOS', marca: 'GYMSHARK', precioRetail: 520, precioCliente: 380 },
        { nombre: 'COLLEGIATE CREW SOCKS 3PK', cantidad: 1, talla: 'M', color: 'AZUL', tipo: 'ACCESORIOS', marca: 'GYMSHARK', precioRetail: 520, precioCliente: 380 },
        { nombre: 'OLY LIFTING STRAPS', cantidad: 1, talla: 'ONE SIZE', color: 'AZUL', tipo: 'ACCESORIOS', marca: 'GYMSHARK', precioRetail: 350, precioCliente: 260 }
    ];

    global.ObebeMayoreoPedidosNatySeed = {
        ITEMS_PEDIDO_NATY_20261029: ITEMS_PEDIDO_NATY_20261029,
        unidades: ITEMS_PEDIDO_NATY_20261029.length
    };
})(window);