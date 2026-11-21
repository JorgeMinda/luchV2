import type { DishRecipe, RecipeIngredient } from '../../../domain/entities'
import type { DishRecipeRepository, DishRecipeInput } from '../../../application/ports/DishRecipeRepository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import { fromCents } from '../../../domain/value-objects/money'
import type { DishRecipesRow, DishRecipesInsert, DishRecipesUpdate, RecipeIngredientsRow, RecipeIngredientsInsert, RecipeIngredientsUpdate } from '../database.types'

/**
 * Mapea fila de recipe_ingredients a RecipeIngredient de dominio.
 */
function mapRowToRecipeIngredient(row: RecipeIngredientsRow): RecipeIngredient {
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
    isActive: row.is_active,
    deletedAt: row.deleted_at ?? undefined,
    deletedBy: undefined,
  }
}

/**
 * Mapea fila de dish_recipes + ingredients a DishRecipe de dominio.
 */
async function mapRowToDishRecipe(
  client: TypedSupabaseClient,
  row: DishRecipesRow,
): Promise<DishRecipe> {
  const { data: ingredients, error } = await client
    .from('recipe_ingredients')
    .select('*')
    .eq('recipe_id', row.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw error

  return {
    dishId: row.dish_id,
    source: row.source,
    ingredients: (ingredients ?? []).map(mapRowToRecipeIngredient),
    updatedAt: row.updated_at,
    serviceType: row.service_type,
    portions: row.portions ?? undefined,
    isActive: row.is_active,
    deletedAt: row.deleted_at ?? undefined,
    deletedBy: undefined,
  }
}

/**
 * Repositorio Supabase para DishRecipes.
 * Single-tenant (F.1): sin school_id, RLS por auth.uid() + role.
 * Incluye ServiceType (F.6) y precisión sub-centavo (F.7).
 * Borrado lógico (is_active, deleted_at, deleted_by).
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
      .eq('is_active', true)
      .order('updated_at', { ascending: false })

    if (error) this.handleError(error, 'listar recetas')

    const results: DishRecipe[] = []
    for (const recipe of data ?? []) {
      results.push(await mapRowToDishRecipe(this.client, recipe))
    }
    return results
  }

  async listAll(): Promise<DishRecipe[]> {
    const { data, error } = await this.client
      .from('dish_recipes')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) this.handleError(error, 'listar todas las recetas')

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
      .eq('is_active', true)
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
      const recipeInsert: DishRecipesInsert = {
        dish_id: recipe.dishId,
        source: recipe.source,
        service_type: recipe.serviceType ?? 'lunch',
        portions: recipe.portions ?? null,
        is_active: true,
      }

      const recipeRow = await this.upsertOne<DishRecipesRow, DishRecipesInsert>(
        'dish_recipes',
        recipeInsert,
        { onConflict: 'dish_id', ignoreDuplicates: false }
      )

      // 2. Soft delete existing recipe_ingredients for this recipe
      const currentUser = await this.getCurrentUser()
      if (!currentUser) throw new Error('Usuario no autenticado')

      const deleteUpdate: RecipeIngredientsUpdate = {
        is_active: false,
        deleted_at: new Date().toISOString(),
        deleted_by: currentUser.id,
      }

      await this.updateRows<RecipeIngredientsUpdate>('recipe_ingredients', deleteUpdate, { recipe_id: recipeRow.id })

      // 3. Insert new recipe_ingredients
      if (recipe.ingredients.length > 0) {
        const ingredientRows: RecipeIngredientsInsert[] = recipe.ingredients.map((ing: RecipeIngredient) => ({
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
          is_active: true,
        }))

        await this.insertRows<RecipeIngredientsRow, RecipeIngredientsInsert>('recipe_ingredients', ingredientRows)
      }

      results.push(await mapRowToDishRecipe(this.client, recipeRow))
    }

    return results
  }

  async removeByDishId(dishId: string): Promise<void> {
    const currentUser = await this.getCurrentUser()
    if (!currentUser) throw new Error('Usuario no autenticado')

    const { data: recipe, error: findError } = await this.client
      .from('dish_recipes')
      .select('id')
      .eq('dish_id', dishId)
      .eq('is_active', true)
      .maybeSingle() as { data: { id: string } | null; error: Error | null }

    if (findError) this.handleError(findError, 'buscar receta para eliminar')

    if (recipe) {
      const update: DishRecipesUpdate = {
        is_active: false,
        deleted_at: new Date().toISOString(),
        deleted_by: currentUser.id,
      }

      await this.updateRows<DishRecipesUpdate>('dish_recipes', update, { id: recipe.id })
    }
  }
}