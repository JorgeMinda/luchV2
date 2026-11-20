import type { Ingredient } from '../../../domain/entities'
import type { NewIngredient, IngredientRepository } from '../../../application/ports/IngredientRepository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import { fromCents } from '../../../domain/value-objects/money'
import type { IngredientsRow, IngredientsInsert, IngredientsUpdate } from '../database.types'

/**
 * Mapea una fila de BD a entidad de dominio Ingredient.
 */
function mapRowToIngredient(row: IngredientsRow): Ingredient {
  return {
    id: row.id,
    code: row.code,
    category: row.category,
    product: row.product,
    presentation: row.presentation,
    cost: fromCents(row.cost_cents),
    purchaseUnitCostRaw: row.purchase_unit_cost_raw ?? undefined,
    sourceFormula: row.source_formula ?? undefined,
    status: row.status,
    isActive: row.is_active,
    deletedAt: row.deleted_at ?? undefined,
    deletedBy: undefined, // Would need to join with users table
  }
}

/**
 * Repositorio Supabase para Ingredients.
 * Single-tenant (F.1): sin school_id, RLS por auth.uid() + role.
 * Maneja Money en centavos (F.2, F.7) y borrado lógico.
 */
export class SupabaseIngredientRepository extends SupabaseRepositoryBase
  implements IngredientRepository {
  constructor(client?: TypedSupabaseClient) {
    super(client)
  }

  listSnapshot(): Ingredient[] {
    // Supabase es asíncrono; retorna array vacío para render inicial.
    // Los datos se cargan vía list() en useEffect.
    return []
  }

  async list(): Promise<Ingredient[]> {
    const { data, error } = await this.client
      .from('ingredients')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('product', { ascending: true })

    if (error) this.handleError(error, 'listar ingredientes')
    return (data ?? []).map(mapRowToIngredient)
  }

  async getById(id: string): Promise<Ingredient | null> {
    const { data, error } = await this.client
      .from('ingredients')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // No encontrado
      this.handleError(error, 'obtener ingrediente por ID')
    }
    return data ? mapRowToIngredient(data) : null
  }

  async importMany(ingredients: NewIngredient[]): Promise<Ingredient[]> {
    if (ingredients.length === 0) return []

    const rows: IngredientsInsert[] = ingredients.map((ing) => ({
      code: ing.code,
      category: ing.category,
      product: ing.product,
      presentation: ing.presentation,
      cost_cents: ing.cost.cents,
      purchase_unit_cost_raw: ing.purchaseUnitCostRaw ?? null,
      source_formula: ing.sourceFormula ?? null,
      status: ing.status,
      is_active: true,
    }))

    const data = await this.upsertMany<IngredientsRow, IngredientsInsert>(
      'ingredients',
      rows,
      { onConflict: 'code', ignoreDuplicates: false }
    )
    return data.map(mapRowToIngredient)
  }

  async save(ingredient: NewIngredient): Promise<Ingredient> {
    const row: IngredientsInsert = {
      code: ingredient.code,
      category: ingredient.category,
      product: ingredient.product,
      presentation: ingredient.presentation,
      cost_cents: ingredient.cost.cents,
      purchase_unit_cost_raw: ingredient.purchaseUnitCostRaw ?? null,
      source_formula: ingredient.sourceFormula ?? null,
      status: ingredient.status,
      is_active: true,
    }

    const data = await this.upsertOne<IngredientsRow, IngredientsInsert>(
      'ingredients',
      row,
      { onConflict: 'code', ignoreDuplicates: false }
    )
    return mapRowToIngredient(data)
  }

  async delete(id: string, deletedBy: string): Promise<void> {
    const update: IngredientsUpdate = {
      is_active: false,
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy,
    }

    await this.updateRows<IngredientsUpdate>('ingredients', update, { id })
  }

  async getByCode(code: string): Promise<Ingredient | null> {
    const { data, error } = await this.client
      .from('ingredients')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      this.handleError(error, 'obtener ingrediente por código')
    }
    return data ? mapRowToIngredient(data) : null
  }
}