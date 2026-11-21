import type { Dish } from '../../../domain/entities'
import type { DishInput, DishRepository, NewDish } from '../../../application/ports/DishRepository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import type { DishesRow, DishesInsert, DishesUpdate } from '../database.types'

/**
 * Mapea una fila de BD a entidad de dominio Dish.
 */
function mapRowToDish(row: DishesRow): Dish {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    isActive: row.is_active,
    deletedAt: row.deleted_at ?? undefined,
    deletedBy: undefined,
  }
}

/**
 * Repositorio Supabase para Dishes.
 * Single-tenant (F.1): sin school_id, RLS por auth.uid() + role.
 * Borrado lógico (is_active, deleted_at, deleted_by).
 */
export class SupabaseDishRepository extends SupabaseRepositoryBase implements DishRepository {
  constructor(client?: TypedSupabaseClient) {
    super(client)
  }

  listSnapshot(): Dish[] {
    return []
  }

  async list(): Promise<Dish[]> {
    const { data, error } = await this.client
      .from('dishes')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) this.handleError(error, 'listar platos')
    return (data ?? []).map(mapRowToDish)
  }

  async listAll(): Promise<Dish[]> {
    const { data, error } = await this.client
      .from('dishes')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) this.handleError(error, 'listar todos los platos')
    return (data ?? []).map(mapRowToDish)
  }

  async getById(id: string): Promise<Dish | null> {
    const { data, error } = await this.client
      .from('dishes')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      this.handleError(error, 'obtener plato por ID')
    }
    return data ? mapRowToDish(data) : null
  }

  async save(input: DishInput): Promise<Dish> {
    const row: DishesInsert = {
      name: input.name,
      category: input.category,
      description: input.description,
      is_active: true,
    }

    const data = await this.upsertOne<DishesRow, DishesInsert>(
      'dishes',
      row,
      { onConflict: 'name', ignoreDuplicates: false }
    )
    return mapRowToDish(data)
  }

  async remove(id: string): Promise<void> {
    const currentUser = await this.getCurrentUser()
    if (!currentUser) throw new Error('Usuario no autenticado')

    const update: DishesUpdate = {
      is_active: false,
      deleted_at: new Date().toISOString(),
      deleted_by: currentUser.id,
    }

    await this.updateRows<DishesUpdate>('dishes', update, { id })
  }

  async importMany(dishes: NewDish[]): Promise<Dish[]> {
    if (dishes.length === 0) return []

    const rows: DishesInsert[] = dishes.map((dish) => ({
      name: dish.name,
      category: dish.category,
      description: dish.description,
      is_active: true,
    }))

    const data = await this.upsertMany<DishesRow, DishesInsert>(
      'dishes',
      rows,
      { onConflict: 'name', ignoreDuplicates: false }
    )
    return data.map(mapRowToDish)
  }
}