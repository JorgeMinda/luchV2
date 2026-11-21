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
  // Check dishes created
  const { data: dishes } = await supabase.from('dishes').select('name, category').limit(20)
  console.log('Sample dishes:', dishes?.slice(0, 20))
  
  // Check dish names from menu - look for "Sopa de chifles"
  const { data: sopa } = await supabase.from('dishes').select('*').ilike('name', '%chifles%')
  console.log('Sopa de chifles:', sopa)
  
  // Check what dishes we have for key menu items
  const { data: menuDishes } = await supabase.from('dishes').select('*').ilike('name', '%sopa%')
  console.log('Sopa dishes:', menuDishes)
  
  // Check recipe_ingredients traceability
  const { data: ri } = await supabase.from('recipe_ingredients').select('name, source_formula, source_cell, purchase_unit_cost_raw').not('source_formula', 'is', null).limit(5)
  console.log('Recipe ingredients with source_formula:', ri)
  
  const { data: ri2 } = await supabase.from('recipe_ingredients').select('name, source_formula, source_cell, purchase_unit_cost_raw').limit(5)
  console.log('Recipe ingredients sample:', ri2)
  
  // Check meal comp components traceability
  const { data: mc } = await supabase.from('meal_composition_components').select('name, source_formula, source_cell, reference_unit_cost_raw').not('source_formula', 'is', null).limit(5)
  console.log('Meal comp with source_formula:', mc)
  
  const { data: mc2 } = await supabase.from('meal_composition_components').select('name, source_formula, source_cell, reference_unit_cost_raw').limit(5)
  console.log('Meal comp sample:', mc2)
  
  // Check imported_rows for #REF!
  const { data: refs } = await supabase.from('imported_rows').select('row_index, error_message, source_type').like('error_message', '%REF%').limit(10)
  console.log('REF errors in imported_rows:', refs)
  
  const { data: refs2 } = await supabase.from('imported_rows').select('row_index, error_message, source_type').eq('source_type', 'MENU_PLAN').eq('status', 'error').limit(10)
  console.log('MENU_PLAN errors:', refs2)
  
  // Check menu_plan_cells
  const { data: cells } = await supabase.from('menu_plan_cells').select('*').limit(10)
  console.log('Menu plan cells:', cells)
  
  // Check what dishes are referenced by recipes
  const { data: recipes } = await supabase.from('dish_recipes').select('dish_id, service_type').limit(10)
  console.log('Dish recipes:', recipes)
  
  // Check if dishes match between menu and recipes
  const { data: dishRecipes } = await supabase
    .from('dish_recipes')
    .select('dish_id, dishes(name)')
    .limit(10)
  console.log('Dish recipes with names:', dishRecipes)
}

debug()