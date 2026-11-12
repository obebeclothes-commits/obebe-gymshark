/**
 * Google Analytics 4 — obebe.store
 * ID: G-H32BPMR4ZZ
 */
(function (w, d) {
    'use strict';
    var MEASUREMENT_ID = 'G-H32BPMR4ZZ';
    if (!MEASUREMENT_ID) return;

    w.dataLayer = w.dataLayer || [];
    function gtag() {
        w.dataLayer.push(arguments);
    }
    w.gtag = gtag;
    gtag('js', new Date());
    gtag('config', MEASUREMENT_ID, {
        send_page_view: true
    });

    var s = d.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
    var first = d.getElementsByTagName('script')[0];
    if (first && first.parentNode) {
        first.parentNode.insertBefore(s, first);
    } else {
        (d.head || d.documentElement).appendChild(s);
    }
})(window, document);
