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
    auth: { autoRefreshToken: false, persistSession: false }
  }
)

const MENU_CATEGORY_SLOTS: Record<string, number> = {
  Sopa: 1, Proteína: 2, Guarnición: 2, Ensalada: 1, 'Bebida Fría': 1, Postre: 1, Fruta: 1
}
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

async function debug() {
  // Check what dishes we have for "sopa de chifles"
  const { data: dishes } = await supabase.from('dishes').select('*').ilike('name', '%chifles%')
  console.log('Dishes with chifles:', dishes)
  
  // Check week_start_date format
  const { data: batches } = await supabase.from('import_batches').select('*').order('created_at', { ascending: false }).limit(1)
  console.log('Latest batch:', batches)
  
  // Try to insert a test menu cell
  const { data: testDish } = await supabase.from('dishes').select('id').ilike('name', 'sopa de chifles').limit(1)
  console.log('Test dish:', testDish)
  
  if (testDish && testDish.length > 0) {
    const dish = testDish[0]
    console.log('Trying to insert menu cell for:', dish.name)
    
    const { data, error } = await supabase.from('menu_plan_cells').upsert({
      week_start_date: '2026-08-24',
      day: 'monday',
      category: 'Sopa',
      slot: 0,
      dish_id: dish.id,
      service_type: 'lunch',
      is_active: true
    }, { onConflict: 'week_start_date,day,category,slot' }).select()
    
    console.log('Insert result:', data, error)
  }
  
  // Check what day values are valid
  const { data: enumVals } = await supabase.rpc('get_enum_values', { enum_name: 'week_day' })
  console.log('Week day enum values:', enumVals)
}

debug()