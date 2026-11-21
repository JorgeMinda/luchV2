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
  // Check imported_rows for MENU_PLAN
  const { data: menuRows } = await supabase
    .from('imported_rows')
    .select('row_index, status, error_message, warning_messages, normalized_data')
    .eq('source_type', 'MENU_PLAN')
    .limit(20)
  
  console.log('MENU_PLAN imported_rows:')
  for (const r of menuRows ?? []) {
    console.log(`  Row ${r.row_index}: status=${r.status}, error=${r.error_message}, warnings=${JSON.stringify(r.warning_messages)}`)
    if (r.normalized_data && typeof r.normalized_data === 'object') {
      console.log(`    dish: ${r.normalized_data.dishName}, hasError: ${r.normalized_data.hasError}`)
    }
  }
  
  // Count by status
  const { data: counts } = await supabase
    .from('imported_rows')
    .select('status, source_type')
    .eq('source_type', 'MENU_PLAN')
  
  const statusCounts: Record<string, number> = {}
  for (const r of counts ?? []) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1
  }
  console.log('\nMENU_PLAN status counts:', statusCounts)
  
  // Check for any rows with hasError in normalized_data
  const { data: allMenuRows } = await supabase
    .from('imported_rows')
    .select('normalized_data')
    .eq('source_type', 'MENU_PLAN')
  
  let hasErrorCount = 0
  for (const r of allMenuRows ?? []) {
    if (r.normalized_data && typeof r.normalized_data === 'object' && (r.normalized_data as any).hasError) {
      hasErrorCount++
    }
  }
  console.log(`Rows with hasError=true in normalized_data: ${hasErrorCount}`)
  
  // Check recipe_ingredients for any with source_formula
  const { data: riFormula } = await supabase
    .from('recipe_ingredients')
    .select('name, source_formula, source_cell, purchase_unit_cost_raw')
    .not('source_formula', 'is', null)
  
  console.log(`\nRecipe ingredients with source_formula: ${riFormula?.length ?? 0}`)
  
  // Check all recipe_ingredients for source_cell
  const { data: riCell } = await supabase
    .from('recipe_ingredients')
    .select('name, source_formula, source_cell')
    .not('source_cell', 'is', null)
  
  console.log(`Recipe ingredients with source_cell: ${riCell?.length ?? 0}`)
  
  // Check meal_composition_components
  const { data: mcFormula } = await supabase
    .from('meal_composition_components')
    .select('name, source_formula, source_cell')
    .not('source_formula', 'is', null)
  
  console.log(`Meal comp with source_formula: ${mcFormula?.length ?? 0}`)
  
  const { data: mcCell } = await supabase
    .from('meal_composition_components')
    .select('name, source_formula, source_cell')
    .not('source_cell', 'is', null)
  
  console.log(`Meal comp with source_cell: ${mcCell?.length ?? 0}`)
  
  // Check all recipe_ingredients to see what columns have data
  const { data: riSample } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .limit(2)
  
  console.log('\nRecipe ingredients sample (all columns):')
  console.log(JSON.stringify(riSample, null, 2))
  
  // Check all meal_composition_components
  const { data: mcSample } = await supabase
    .from('meal_composition_components')
    .select('*')
    .limit(2)
  
  console.log('\nMeal comp sample (all columns):')
  console.log(JSON.stringify(mcSample, null, 2))
}

debug()