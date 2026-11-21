import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const url = 'https://selnoqwywcipdbcgzieg.supabase.co'
const key = 'sb_publishable_mz0ewdol5oLhEKJ-OxNwsg_STSLF9-a'

const supabase = createClient(url, key)

async function checkConnection() {
  console.log('=== Probando conexión a Supabase ===')
  
  // Test 1: Basic query
  const { data, error } = await supabase.from('users').select('count').limit(1)
  if (error) {
    console.error('Error conectando:', error)
    return
  }
  console.log('✅ Conexión exitosa')
  
  // Test 2: Check ingredients table structure
  const { data: ing, error: ingError } = await supabase
    .from('ingredients')
    .select('*')
    .limit(1)
  if (ingError) {
    console.error('Error ingredients:', ingError)
  } else {
    console.log('\n=== Ingredients columns ===')
    if (ing && ing.length > 0) {
      console.log(Object.keys(ing[0]).sort().join(', '))
    } else {
      console.log('Tabla vacía, verificando con RPC...')
    }
  }
  
  // Test 3: Check recipe_ingredients
  const { data: ri, error: riError } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .limit(1)
  if (riError) {
    console.error('Error recipe_ingredients:', riError)
  } else {
    console.log('\n=== Recipe Ingredients columns ===')
    if (ri && ri.length > 0) {
      console.log(Object.keys(ri[0]).sort().join(', '))
    }
  }
  
  // Test 4: Check meal_composition_components
  const { data: mc, error: mcError } = await supabase
    .from('meal_composition_components')
    .select('*')
    .limit(1)
  if (mcError) {
    console.error('Error meal_composition_components:', mcError)
  } else {
    console.log('\n=== Meal Composition Components columns ===')
    if (mc && mc.length > 0) {
      console.log(Object.keys(mc[0]).sort().join(', '))
    }
  }
  
  // Test 5: Check auth user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.log('\n⚠️ No hay usuario autenticado')
    console.log('Error:', authError?.message)
  } else {
    console.log('\n=== Usuario autenticado ===')
    console.log('ID:', user.id)
    console.log('Email:', user.email)
    
    // Get role from public.users
    const { data: profile } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('id', user.id)
      .single()
    console.log('Role:', profile?.role)
    console.log('Active:', profile?.is_active)
  }
  
  // Test 6: Check import_batches
  const { data: ib, error: ibError } = await supabase
    .from('import_batches')
    .select('*')
    .limit(1)
  if (ibError) {
    console.error('Error import_batches:', ibError)
  } else {
    console.log('\n=== Import Batches columns ===')
    if (ib && ib.length > 0) {
      console.log(Object.keys(ib[0]).sort().join(', '))
    }
  }
}

checkConnection()