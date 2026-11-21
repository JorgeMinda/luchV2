import { createClient } from '@supabase/supabase-js'

const url = 'https://selnoqwywcipdbcgzieg.supabase.co'
const key = 'sb_publishable_mz0ewdol5oLhEKJ-OxNwsg_STSLF9-a'

const supabase = createClient(url, key)

async function verify() {
  console.log('=== Verificando esquema Supabase ===')
  
  // Check tables
  const tables = ['users', 'ingredients', 'dishes', 'dish_recipes', 'recipe_ingredients', 
    'meal_composition_templates', 'meal_composition_components', 'menu_plan_cells',
    'students', 'transactions', 'consumptions', 'import_batches', 'imported_rows', 'import_audit_logs']
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    console.log(`${table}:`, error ? `❌ ${error.code} - ${error.message}` : `✅ ${data?.length ?? 0} filas`)
    if (data && data.length > 0) {
      console.log('  Columnas:', Object.keys(data[0]).sort().join(', '))
    }
  }
  
  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.log('\n⚠️ No hay usuario autenticado')
    console.log('Error:', authError?.message)
  } else {
    console.log('\n=== Usuario autenticado ===')
    console.log('ID:', user.id)
    console.log('Email:', user.email)
    
    const { data: profile } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('id', user.id)
      .single()
    console.log('Role:', profile?.role)
    console.log('Active:', profile?.is_active)
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