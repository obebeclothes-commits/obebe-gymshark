/**
 * dataSource: 'supabase' — inventario, ventas retail y sync con obebe.store.
 *
 * La llave supabaseAnonKey / publishable es pública por diseño (RLS + Auth).
 * NUNCA pongas service_role, ADMIN_SECRET ni contraseñas en este archivo.
 */
window.OBEBE_ADMIN_CONFIG = {
    dataSource: 'supabase',

    supabaseUrl: 'https://yueajorzawaanubgekpm.supabase.co',
    supabaseAnonKey: 'sb_publishable_eML6LBPIdOyq0XRX2r6uEw_HCAsGAbp',
    adminApiUrl: 'https://yueajorzawaanubgekpm.supabase.co/functions/v1/admin-api',

    appsScriptUrl: '',
    permitirEscrituraLocal: true
};
