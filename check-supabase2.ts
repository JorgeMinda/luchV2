import { createClient } from '@supabase/supabase-js'

const url = 'https://selnoqwywcipdbcgzieg.supabase.co'
const key = 'sb_publishable_mz0ewdol5oLhEKJ-OxNwsg_STSLF9-a'

const supabase = createClient(url, key)

async function checkSchema() {
  console.log('=== Verificando esquema vía SQL directo ===')
  
  // Try to query information_schema
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `
  })
  
  if (error) {
    console.log('RPC exec_sql no disponible, probando REST directo...')
    console.log('Error:', error.message)
  } else {
    console.log('Tablas en public:')
    console.log(data)
  }
  
  // Try to reload schema
  console.log('\n=== Notificando recarga de esquema ===')
  const { error: notifyError } = await supabase.rpc('notify_pgrst_reload')
  if (notifyError) {
    console.log('notify_pgrst_reload no disponible:', notifyError.message)
  } else {
    console.log('Notificación enviada')
  }
  
  // Try a simple select on a known table
  const tables = ['users', 'ingredients', 'dishes', 'import_batches', 'imported_rows', 'import_audit_logs']
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    console.log(`\n${table}:`, error ? `❌ ${error.code} - ${error.message}` : `✅ ${data?.length ?? 0} filas`)
    if (data && data.length > 0) {
      console.log('  Columnas:', Object.keys(data[0]).sort().join(', '))
    }
  }
}

checkSchema()