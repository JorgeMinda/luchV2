import type { Ingredient, IngredientStatus } from '../../../domain/entities'
import type { NewIngredient, IngredientRepository } from '../../../application/ports/IngredientRepository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import { fromCents } from '../../../domain/value-objects/money'

/**
 * Mapea una fila de BD a entidad de dominio Ingredient.
 */
function mapRowToIngredient(row: {
  id: string
  code: string
  category: string
  product: string
  presentation: string
  cost_cents: number
  purchase_unit_cost_raw: number | null
  source_formula: string | null
  status: IngredientStatus
}): Ingredient {
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
  }
}

/**
 * Repositorio Supabase para Ingredients.
 * Respeta RLS por school_id (F.1) y maneja Money en centavos (F.2, F.7).
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
      .order('category', { ascending: true })
      .order('product', { ascending: true })

    if (error) this.handleError(error, 'listar ingredientes')
    return (data ?? []).map(mapRowToIngredient)
  }

  async importMany(ingredients: NewIngredient[]): Promise<Ingredient[]> {
    if (ingredients.length === 0) return []

    const rows = ingredients.map((ing) => ({
      code: ing.code,
      category: ing.category,
      product: ing.product,
      presentation: ing.presentation,
      cost_cents: ing.cost.cents,
      purchase_unit_cost_raw: ing.purchaseUnitCostRaw ?? null,
      source_formula: ing.sourceFormula ?? null,
      status: ing.status,
    }))

    const { data, error } = await this.client
      .from('ingredients')
      .upsert(rows as any, { onConflict: 'school_id,code', ignoreDuplicates: false })
      .select()

    if (error) this.handleError(error, 'importar ingredientes')
    return (data ?? []).map(mapRowToIngredient)
  }
}