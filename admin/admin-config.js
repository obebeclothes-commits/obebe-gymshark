/**
 * dataSource: 'supabase' = inventario + ventas retail en PostgreSQL (sin Google Sheets).
 * dataSource: 'sheets' = lectura CSV + escritura Apps Script o modo local.
 *
 * Supabase:
 * 1. Ejecuta scripts/supabase/schema.sql en el SQL Editor
 * 2. Despliega scripts/supabase/functions/admin-api
 * 3. Rellena supabaseUrl, supabaseAnonKey, adminApiUrl
 * 4. Configuración → Importar desde Google (una vez)
 * 5. Copia las mismas claves a obebe-data-config.js en la raíz (tienda web)
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
