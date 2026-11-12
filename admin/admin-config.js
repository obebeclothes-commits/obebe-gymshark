/**
 * dataSource: 'supabase' — inventario, ventas retail y sync con obebe.store.
 *
 * 1. Schema y Edge Function: scripts/supabase/
 * 2. Rellena supabaseUrl, supabaseAnonKey, adminApiUrl
 * 3. Copia las mismas claves a obebe-data-config.js en la raíz (tienda web)
 */
window.OBEBE_ADMIN_CONFIG = {
    dataSource: 'supabase',

    supabaseUrl: 'https://yueajorzawaanubgekpm.supabase.co',
    supabaseAnonKey: 'sb_publishable_eML6LBPIdOyq0XRX2r6uEw_HCAsGAbp',
    adminApiUrl: 'https://yueajorzawaanubgekpm.supabase.co/functions/v1/admin-api',

    appsScriptUrl: '',
    inventarioSecret: 'OBebeClotes.1',
    permitirEscrituraLocal: true
};
