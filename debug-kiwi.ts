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

async function debug() {
  // Check KIWI
  const { data: kiwi } = await supabase.from('ingredients').select('*').eq('code', '139')
  console.log('KIWI code 139:', kiwi)
  
  const { data: kiwi2 } = await supabase.from('ingredients').select('*').ilike('code', '139%')
  console.log('KIWI ilike 139%:', kiwi2)
  
  // Check all ingredients
  const { data: all } = await supabase.from('ingredients').select('code, product').limit(10)
  console.log('First 10 ingredients:', all)
  
  // Check dishes
  const { data: dishes } = await supabase.from('dishes').select('*').limit(10)
  console.log('Dishes:', dishes)
}

debug()