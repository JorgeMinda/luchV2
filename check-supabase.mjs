// Script independiente para verificar Supabase
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Cargar .env.local
const envContent = readFileSync('.env.local', 'utf-8')
envContent.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) {
    process.env[key.trim()] = rest.join('=').trim()
  }
})

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  console.error('Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

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
      const { data, error, count } = await supabase.from(table).select('id', { count: 'exact', head: true })
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
  
  // Verificar admin - intento 1: SELECT *
  console.log('\n=== VERIFICACIÓN DE ADMINISTRADOR ===')
  try {
    const { data, error } = await supabase.from('users').select('id, role, is_active').limit(10)
    if (error) {
      console.log('  Consulta SELECT * con filtros falló:', error.message)
    } else {
      console.log('  Usuarios totales (primeros 10):', data.length)
      data.forEach(u => console.log('    - id:', u.id.substring(0,8)+'...', 'role:', u.role, 'active:', u.is_active))
      const admins = data.filter(u => u.role === 'admin' && u.is_active === true)
      if (admins.length > 0) {
        console.log('  Administrador encontrado:', admins.length, 'usuario(s) con role=admin e is_active=true')
      } else {
        console.log('  No se encontró administrador visible (role=admin, is_active=true)')
      }
    }
  } catch (e) {
    console.log('  Error en SELECT *:', e)
  }
  
  // Verificar admin - intento 2: RPC si existe
  console.log('\n  Probando consulta alternativa...')
  try {
    const { data, error } = await supabase.from('users').select('id, role, is_active').eq('is_active', true).limit(10)
    if (error) {
      console.log('  Consulta con eq(is_active, true) falló:', error.message)
    } else {
      console.log('  Usuarios activos:', data.length)
      const admins = data.filter(u => u.role === 'admin')
      if (admins.length > 0) {
        console.log('  Admin entre activos:', admins.length)
      } else {
        console.log('  No hay admins entre usuarios activos')
      }
    }
  } catch (e) {
    console.log('  Error en filtro is_active:', e)
  }
}

checkTables().catch(console.error)