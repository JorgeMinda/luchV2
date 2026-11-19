import type { Dish, DishCategory } from '../../../domain/entities'
import type { DishInput, DishRepository, NewDish } from '../../../application/ports/DishRepository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'

/**
 * Mapea una fila de BD a entidad de dominio Dish.
 */
function mapRowToDish(row: {
  id: string
  name: string
  category: DishCategory
  description: string
}): Dish {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
  }
}

/**
 * Repositorio Supabase para Dishes.
 * Respeta RLS por school_id (F.1).
 */
export class SupabaseDishRepository extends SupabaseRepositoryBase implements DishRepository {
  constructor(client?: TypedSupabaseClient) {
    super(client)
  }

  listSnapshot(): Dish[] {
    // Para compatibilidad con la interfaz, retorna array vacío.
    // La implementación síncrona no es posible con Supabase.
    // Los casos que necesitan snapshot deben usar list() async.
    return []
  }

  async list(): Promise<Dish[]> {
    const { data, error } = await this.client
      .from('dishes')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) this.handleError(error, 'listar platos')
    return (data ?? []).map(mapRowToDish)
  }

  async save(input: DishInput): Promise<Dish> {
    const { data, error } = await this.client
      .from('dishes')
      .upsert(
        {
          name: input.name,
          category: input.category,
          description: input.description,
        } as any,
        { onConflict: 'school_id,name', ignoreDuplicates: false },
      )
      .select()
      .single()

    if (error) this.handleError(error, 'guardar plato')
    return mapRowToDish(data)
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from('dishes').delete().eq('id', id)
    if (error) this.handleError(error, 'eliminar plato')
  }

  async importMany(dishes: NewDish[]): Promise<Dish[]> {
    if (dishes.length === 0) return []

    const rows = dishes.map((dish) => ({
      name: dish.name,
      category: dish.category,
      description: dish.description,
    }))

    const { data, error } = await this.client
      .from('dishes')
      .upsert(rows as any, { onConflict: 'school_id,name', ignoreDuplicates: false })
      .select()

    if (error) this.handleError(error, 'importar platos')
    return (data ?? []).map(mapRowToDish)
  }
}