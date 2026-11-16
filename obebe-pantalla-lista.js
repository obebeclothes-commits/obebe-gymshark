(function (w, d) {
    'use strict';

    var mostrado = false;

    function mostrar() {
        if (mostrado) return;
        mostrado = true;
        d.documentElement.classList.remove('obebe-pending');
        d.documentElement.classList.add('obebe-ready');
    }

    function cssPrincipalListo() {
        var l = d.getElementById('cssPrincipal');
        if (!l) return true;
        return l.media === 'all';
    }

    function activarCss() {
        var l = d.getElementById('cssPrincipal');
        if (l && l.media !== 'all') l.media = 'all';
        if (!cssPrincipalListo()) return;
        if (w.requestAnimationFrame) {
            w.requestAnimationFrame(function () {
                w.requestAnimationFrame(mostrar);
            });
        } else {
            mostrar();
        }
    }

    w.__obebeActivarCss = activarCss;

    if (!d.documentElement.classList.contains('obebe-pending')) {
        d.documentElement.classList.add('obebe-pending');
    }

    var sinHojaExterna = !d.getElementById('cssPrincipal');

    d.addEventListener('DOMContentLoaded', function () {
        activarCss();
        if (sinHojaExterna) {
            if (w.requestAnimationFrame) {
                w.requestAnimationFrame(function () {
                    w.requestAnimationFrame(mostrar);
                });
            } else {
                mostrar();
            }
        }
    });
    w.addEventListener('load', activarCss);
    setTimeout(activarCss, 3000);
    setTimeout(mostrar, 5000);
})(window, document);