import type { DishRecipe, RecipeIngredient, RecipeServiceType } from '../../../domain/entities'
import type { DishRecipeRepository, DishRecipeInput } from '../../../application/ports/DishRecipeRepository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import { fromCents } from '../../../domain/value-objects/money'

/**
 * Mapea fila de recipe_ingredients a RecipeIngredient de dominio.
 */
function mapRowToRecipeIngredient(row: {
  id: string
  ingredient_id: string | null
  name: string
  purchase_presentation: string
  purchase_price_cents: number
  purchase_quantity: number
  recipe_quantity: number
  purchase_unit_cost_raw: number | null
  source_formula: string | null
  source_cell: string | null
  yield_percentage: number | null
}): RecipeIngredient {
  return {
    id: row.id,
    name: row.name,
    purchasePresentation: row.purchase_presentation,
    purchasePrice: fromCents(row.purchase_price_cents),
    purchaseQuantity: row.purchase_quantity,
    recipeQuantity: row.recipe_quantity,
    purchaseUnitCostRaw: row.purchase_unit_cost_raw ?? undefined,
    sourceFormula: row.source_formula ?? undefined,
    sourceCell: row.source_cell ?? undefined,
    yieldPercentage: row.yield_percentage ?? undefined,
  }
}

/**
 * Mapea fila de dish_recipes + ingredients a DishRecipe de dominio.
 */
async function mapRowToDishRecipe(
  client: TypedSupabaseClient,
  row: {
    id: string
    dish_id: string
    source: string
    service_type: RecipeServiceType
    portions: number | null
    updated_at: string
  },
): Promise<DishRecipe> {
  const { data: ingredients, error } = await client
    .from('recipe_ingredients')
    .select('*')
    .eq('recipe_id', row.id)
    .order('created_at', { ascending: true })

  if (error) throw error

  return {
    dishId: row.dish_id,
    source: row.source,
    ingredients: (ingredients ?? []).map(mapRowToRecipeIngredient),
    updatedAt: row.updated_at,
    serviceType: row.service_type,
    portions: row.portions ?? undefined,
  }
}

/**
 * Repositorio Supabase para DishRecipes.
 * Respeta RLS por school_id (F.1), incluye ServiceType (F.6) y precisión sub-centavo (F.7).
 */
export class SupabaseDishRecipeRepository
  extends SupabaseRepositoryBase
  implements DishRecipeRepository {
  constructor(client?: TypedSupabaseClient) {
    super(client)
  }

  listSnapshot(): DishRecipe[] {
    return []
  }

  async list(): Promise<DishRecipe[]> {
    const { data, error } = await this.client
      .from('dish_recipes')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) this.handleError(error, 'listar recetas')

    const results: DishRecipe[] = []
    for (const recipe of data ?? []) {
      results.push(await mapRowToDishRecipe(this.client, recipe))
    }
    return results
  }

  async getByDishId(dishId: string): Promise<DishRecipe | null> {
    const { data: recipe, error } = await this.client
      .from('dish_recipes')
      .select('*')
      .eq('dish_id', dishId)
      .maybeSingle()

    if (error) this.handleError(error, 'obtener receta por plato')
    if (!recipe) return null

    return mapRowToDishRecipe(this.client, recipe)
  }

  async saveMany(recipes: DishRecipeInput[]): Promise<DishRecipe[]> {
    if (recipes.length === 0) return []

    const results: DishRecipe[] = []

    for (const recipe of recipes) {
      // 1. Upsert dish_recipes
      const { data: recipeRow, error: recipeError } = await this.client
        .from('dish_recipes')
        .upsert(
          {
            dish_id: recipe.dishId,
            source: recipe.source,
            service_type: recipe.serviceType,
            portions: recipe.portions ?? null,
          } as any,
          { onConflict: 'school_id,dish_id', ignoreDuplicates: false },
        )
        .select()
        .single() as { data: { id: string; dish_id: string; source: string; service_type: 'lunch' | 'breakfast' | 'snack'; portions: number | null; updated_at: string } | null; error: Error | null }

      if (recipeError) this.handleError(recipeError, 'guardar receta')
      if (!recipeRow) throw new Error('No se pudo crear/actualizar la receta')

      // 2. Delete existing recipe_ingredients for this recipe
      const { error: deleteError } = await this.client
        .from('recipe_ingredients')
        .delete()
        .eq('recipe_id', recipeRow.id)

      if (deleteError) this.handleError(deleteError, 'limpiar ingredientes de receta')

      // 3. Insert new recipe_ingredients
      if (recipe.ingredients.length > 0) {
        const ingredientRows = recipe.ingredients.map((ing: RecipeIngredient) => ({
          recipe_id: recipeRow.id,
          ingredient_id: ing.id,
          name: ing.name,
          purchase_presentation: ing.purchasePresentation,
          purchase_price_cents: ing.purchasePrice.cents,
          purchase_quantity: ing.purchaseQuantity,
          recipe_quantity: ing.recipeQuantity,
          purchase_unit_cost_raw: ing.purchaseUnitCostRaw ?? null,
          source_formula: ing.sourceFormula ?? null,
          source_cell: ing.sourceCell ?? null,
          yield_percentage: ing.yieldPercentage ?? null,
        }))

        const { error: insertError } = await this.client
          .from('recipe_ingredients')
          .insert(ingredientRows as any)

        if (insertError) this.handleError(insertError, 'insertar ingredientes de receta')
      }

      results.push(await mapRowToDishRecipe(this.client, recipeRow))
    }

    return results
  }

  async removeByDishId(dishId: string): Promise<void> {
    const { data: recipe, error: findError } = await this.client
      .from('dish_recipes')
      .select('id')
      .eq('dish_id', dishId)
      .maybeSingle() as { data: { id: string } | null; error: Error | null }

    if (findError) this.handleError(findError, 'buscar receta para eliminar')

    if (recipe) {
      const { error } = await this.client
        .from('dish_recipes')
        .delete()
        .eq('id', recipe.id)

      if (error) this.handleError(error, 'eliminar receta')
    }
  }
}