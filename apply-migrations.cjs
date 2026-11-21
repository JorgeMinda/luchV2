const pg = require('pg');
const fs = require('fs');
const path = require('path');

const { Client } = pg;

const connectionString = 'postgresql://postgres:Leonardosulca23*@db.selnoqwywcipdbcgzieg.supabase.co:5432/postgres';

async function applyMigrations() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');
    
    // Apply migration 001
    console.log('\n=== Aplicando migración 001: Esquema inicial ===');
    const mig1 = fs.readFileSync(path.resolve('supabase/migrations/001_initial_lunch_schema.sql'), 'utf-8');
    await client.query(mig1);
    console.log('✅ Migración 001 aplicada');
    
    // Apply migration 002
    console.log('\n=== Aplicando migración 002: Políticas RLS ===');
    const mig2 = fs.readFileSync(path.resolve('supabase/migrations/002_rls_policies.sql'), 'utf-8');
    await client.query(mig2);
    console.log('✅ Migración 002 aplicada');
    
    // Verify tables exist
    console.log('\n=== Verificando tablas creadas ===');
    const tables = ['users', 'ingredients', 'dishes', 'dish_recipes', 'recipe_ingredients', 
      'meal_composition_templates', 'meal_composition_components', 'menu_plan_cells',
      'students', 'transactions', 'consumptions', 'import_batches', 'imported_rows', 'import_audit_logs'];
    
    for (const table of tables) {
      const { rows } = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`${table}: ${rows[0].count} filas`);
    }
    
    // Check columns for traceability
    console.log('\n=== Verificando columnas de trazabilidad F.7 ===');
    const traceTables = ['ingredients', 'recipe_ingredients', 'meal_composition_components'];
    for (const table of traceTables) {
      const { rows } = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name IN ('source_formula', 'source_cell', 'source_sheet', 'source_file', 'source_row')
        ORDER BY column_name
      `, [table]);
      console.log(`${table}:`, rows.map(r => `${r.column_name} (${r.data_type})`).join(', ') || 'NINGUNA');
    }
    
    // Reload PostgREST schema cache
    console.log('\n=== Recargando caché PostgREST ===');
    try {
      await client.query("NOTIFY pgrst, 'reload schema';");
      console.log('✅ Notificación enviada');
    } catch (e) {
      console.log('⚠️ No se pudo notificar (puede requerir permisos de superusuario):', e.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

applyMigrations();