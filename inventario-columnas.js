/**
 * Inventario INVENTARIO (Supabase / admin): columnas A–Z (auditoría en Z) por título de encabezado,
 * no por letra fija — si mueves columnas, basta con mantener el texto del título.
 */
(function (global) {
    'use strict';

    var COL_FALTANTE = 18; // S · no se muestra en admin
    var COL_AUDITORIA = 25; // Z · comentario auditoría stock (OBEBE)
    var COL_AA_APARTADO = 26; // AA · texto "Apartado" / cliente mayoreo
    var COL_AB_APARTADO = 27; // AB · piezas apartadas (resto sí en web)
    var COL_VISTA_MAX = 28; // A–AB (índice 0..27)

    var TITULOS_DEFAULT = [
        'NO. IMAGEN',
        'ARTICULO',
        'CANTIDAD',
        'TALLA',
        'COLOR',
        'TIPO',
        'MARCA',
        'PRECIO RETAIL',
        'TOTAL',
        'FOTO',
        'FECHA DE LLEGADA',
        'COSTO BRUTO',
        'COSTO NETO',
        'INVERSION',
        'MARGEN',
        'MAYOREO +20',
        '%MAYOREO +20',
        'APLICA MAYOREO',
        'FALTANTE',
        'GENERO',
        'CARRUSEL',
        'MAYOREO +50',
        '%MAYOREO +50',
        'COLECCION',
        'OFERTA SEMANAL',
        'COMENTARIO AUDITORIA',
        'APARTADO',
        'APARTADO'
    ];

    var DEFAULT_IDX = {
        imagen: 0,
        nombre: 1,
        stock: 2,
        talla: 3,
        color: 4,
        tipo: 5,
        marca: 6,
        precio: 7,
        total: 8,
        foto: 9,
        fechaStock: 10,
        costoBruto: 11,
        costoNeto: 12,
        inversion: 13,
        margen: 14,
        precioMayoreo: 15,
        pctMayoreo20: 16,
        mayoreo: 17,
        faltante: 18,
        segmento: 19,
        carrusel: 20,
        precioMayoreo50: 21,
        pctMayoreo50: 22,
        coleccion: 23,
        ofertaSemanal: 24,
        auditoria: COL_AUDITORIA,
        apartadoLabel: COL_AA_APARTADO,
        apartado: COL_AB_APARTADO,
        ubicacion: COL_AB_APARTADO
    };

    function normTitulo(s) {
        return String(s || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ');
    }

    function combinarEncabezados(filaEnc) {
        var out = [];
        var i;
        for (i = 0; i < TITULOS_DEFAULT.length; i++) {
            var sheet = filaEnc && i < filaEnc.length ? String(filaEnc[i] || '').trim() : '';
            out.push(sheet || TITULOS_DEFAULT[i]);
        }
        return out;
    }

    function titulosDefault() {
        return TITULOS_DEFAULT.slice();
    }

    function columnasVistaInventario() {
        var out = [];
        var c;
        for (c = 0; c < COL_VISTA_MAX; c++) {
            if (c !== COL_FALTANTE) out.push(c);
        }
        return out;
    }

    function resolver(filaEnc) {
        var idx = {};
        var k;
        for (k in DEFAULT_IDX) {
            if (Object.prototype.hasOwnProperty.call(DEFAULT_IDX, k)) {
                idx[k] = DEFAULT_IDX[k];
            }
        }
        var enc = combinarEncabezados(filaEnc || []);
        var c;
        for (c = 0; c < enc.length; c++) {
            var t = normTitulo(enc[c]);
            if (!t) continue;
            if (/^(no\.?\s*)?imagen|^ref$|^#/.test(t) || t === 'no imagen') idx.imagen = c;
            else if (/articulo|nombre/.test(t)) idx.nombre = c;
            else if (/cantidad|^stock$/.test(t)) idx.stock = c;
            else if (/^talla/.test(t)) idx.talla = c;
            else if (/^color/.test(t)) idx.color = c;
            else if (/^tipo/.test(t)) idx.tipo = c;
            else if (/^marca/.test(t)) idx.marca = c;
            else if (/precio\s*retail|^precio$/.test(t)) idx.precio = c;
            else if (/^total|valor\s*linea/.test(t)) idx.total = c;
            else if (/^foto|imagen\s*url/.test(t)) idx.foto = c;
            else if (/fecha.*llegada|fecha.*stock/.test(t)) idx.fechaStock = c;
            else if (/costo\s*bruto/.test(t)) idx.costoBruto = c;
            else if (/costo\s*neto/.test(t)) idx.costoNeto = c;
            else if (/inversion|inversi\u00f3n/.test(t)) idx.inversion = c;
            else if (/^margen/.test(t)) idx.margen = c;
            else if (/mayoreo\s*\+?\s*20|mayoreo\s*20/.test(t) && !/%/.test(t)) idx.precioMayoreo = c;
            else if (/%.*mayoreo.*20|mayoreo.*20.*%/.test(t)) idx.pctMayoreo20 = c;
            else if (/aplica\s*mayoreo|^mayoreo$/.test(t)) idx.mayoreo = c;
            else if (/faltante/.test(t)) idx.faltante = c;
            else if (/genero|g\u00e9nero|hombre.*mujer|segmento/.test(t)) idx.segmento = c;
            else if (/carrusel/.test(t)) idx.carrusel = c;
            else if (/mayoreo\s*\+?\s*50|mayoreo\s*50/.test(t) && !/%/.test(t)) idx.precioMayoreo50 = c;
            else if (/%.*mayoreo.*50|mayoreo.*50.*%/.test(t)) idx.pctMayoreo50 = c;
            else if (/coleccion|colecci\u00f3n/.test(t)) idx.coleccion = c;
            else if (/oferta\s*semanal/.test(t)) idx.ofertaSemanal = c;
            else if (/auditoria|comentario\s*auditoria|revisi[oó]n\s*stock/.test(t)) idx.auditoria = c;
            else if (/^apartado$/.test(t) && c === COL_AB_APARTADO) {
                idx.apartado = c;
                idx.ubicacion = c;
            } else if (/^apartado$/.test(t) && c === COL_AA_APARTADO) {
                idx.apartadoLabel = c;
            } else if (/ubicacion|ubicaci\u00f3n/.test(t)) idx.ubicacion = c;
        }
        if (idx.apartado == null) idx.apartado = COL_AB_APARTADO;
        if (idx.apartadoLabel == null) idx.apartadoLabel = COL_AA_APARTADO;
        return idx;
    }

    function celda(fila, idx, key) {
        if (!fila || !idx || idx[key] == null) return '';
        var i = idx[key];
        return i < fila.length ? fila[i] : '';
    }

    global.ObebeInventarioColumnas = {
        TITULOS_DEFAULT: TITULOS_DEFAULT,
        COL_FALTANTE: COL_FALTANTE,
        COL_AUDITORIA: COL_AUDITORIA,
        COL_AA_APARTADO: COL_AA_APARTADO,
        COL_AB_APARTADO: COL_AB_APARTADO,
        COL_VISTA_MAX: COL_VISTA_MAX,
        titulosDefault: titulosDefault,
        combinarEncabezados: combinarEncabezados,
        columnasVistaInventario: columnasVistaInventario,
        resolver: resolver,
        celda: celda
    };
})(typeof window !== 'undefined' ? window : global);
