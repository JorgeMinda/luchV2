import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'

if (existsSync('.env.local')) {
  readFileSync('.env.local', 'utf-8').split('\n').forEach(line => {
    const [k, ...rest] = line.split('=')
    if (k && rest.length && !process.env[k.trim()]) {
      process.env[k.trim()] = rest.join('=').trim()
    }
  })
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function verify() {
  console.log('=== Verificando con Service Role Key ===')
  
  // Check tables
  const tables = ['users', 'ingredients', 'dishes', 'dish_recipes', 'recipe_ingredients', 
    'meal_composition_templates', 'meal_composition_components', 'menu_plan_cells',
    'students', 'transactions', 'consumptions', 'import_batches', 'imported_rows', 'import_audit_logs']
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    console.log(`${table}:`, error ? `❌ ${error.code} - ${error.message}` : `✅ ${data?.length ?? 0} filas`)
  }
  
  // Test insert into import_batches (should work with service role bypassing RLS)
  console.log('\n=== Probando inserción en import_batches ===')
  const { data, error } = await supabase
    .from('import_batches')
    .insert({
      file_name: 'test.xlsx',
      file_hash: 'test-hash',
      status: 'pending',
      source_format: 'xlsx',
      total_rows: 0,
      valid_rows: 0,
      warning_rows: 0,
      error_rows: 0,
      approved_rows: 0,
      rejected_rows: 0
    })
    .select()
    .single()
  
  if (error) {
    console.log('❌ Insert failed:', error)
  } else {
    console.log('✅ Insert successful:', data.id)
    // Clean up
    await supabase.from('import_batches').delete().eq('id', data.id)
    console.log('✅ Cleanup done')
  }
  
  // Check RLS functions
  console.log('\n=== Verificando funciones RLS ===')
  const { data: funcs } = await supabase.rpc('current_user_role')
  console.log('current_user_role():', funcs)
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin')
  console.log('is_current_user_admin():', isAdmin)
  const { data: isCanteen } = await supabase.rpc('is_current_user_canteen_admin')
  console.log('is_current_user_canteen_admin():', isCanteen)
}

verify()