// Cargar variables de entorno ANTES de importar supabase-config
import { readFileSync } from 'fs'
const envContent = readFileSync('.env.local', 'utf-8')
envContent.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) {
    process.env[key.trim()] = rest.join('=').trim()
  }
})

// Ahora importar dinámicamente
const { createClient } = await import('@supabase/supabase-js')

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  console.error('Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY')
  process.exit(1)
}

const client = createClient(url, key)

async function checkTables() {
  const tables = [
    'users', 'students', 'dishes', 'ingredients', 'dish_recipes',
    'recipe_ingredients', 'meal_composition_templates', 'meal_composition_components',
    'menu_plan_cells', 'import_batches', 'imported_rows', 'import_audit_logs',
    'transactions', 'consumptions'
  ]
  
  console.log('=== VERIFICACIÓN DE 14 TABLAS REMOTAS ===\n')
  
  for (const table of tables) {
    try {
      const { error, count } = await client.from(table).select('id', { count: 'exact', head: true })
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
          console.log(`  ${table}: NO_EXISTE (${error.message})`)
        } else if (error.code === '42501' || error.message.includes('policy') || error.message.includes('RLS') || error.message.includes('permission')) {
          console.log(`  ${table}: EXISTE_SIN_PERMISO (${error.message})`)
        } else {
          console.log(`  ${table}: ERROR_CONEXION (${error.code}: ${error.message})`)
        }
      } else {
        console.log(`  ${table}: EXISTE_CON_ACCESO (count: ${count ?? 0})`)
      }
    } catch (e) {
      console.log(`  ${table}: NO_CONCLUYENTE (${e})`)
    }
  }
  
  // Verificar admin
  console.log('\n=== VERIFICACIÓN DE ADMINISTRADOR ===')
  try {
    const { data, error } = await client.from('users').select('id, role, is_active').eq('role', 'admin').eq('is_active', true).limit(5)
    if (error) {
      if (error.code === '42501' || error.message.includes('policy') || error.message.includes('RLS')) {
        console.log('  public.users: EXISTE_SIN_PERMISO (RLS bloquea consulta de admins)')
      } else {
        console.log('  public.users: ERROR_CONEXION (' + error.message + ')')
      }
    } else if (data && data.length > 0) {
      console.log('  Administrador encontrado:', data.length, 'usuario(s) con role=admin e is_active=true')
      data.forEach(u => console.log('    - id:', u.id.substring(0,8)+'...', 'role:', u.role, 'active:', u.is_active))
    } else {
      console.log('  No se encontró administrador visible (role=admin, is_active=true)')
    }
  } catch (e) {
    console.log('  No se pudo comprobar administrador:', e)
  }
}

checkTables().catch(console.error)