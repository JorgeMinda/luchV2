import type { MenuPlanCell } from '../../../domain/entities'
import type { MenuCellTarget, MenuCellSelection, MenuPlanRepository } from '../../../application/ports/MenuPlanRepository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import type { MenuPlanCellsRow, MenuPlanCellsInsert, MenuPlanCellsUpdate } from '../database.types'

/**
 * Mapea fila de BD a MenuPlanCell de dominio.
 */
function mapRowToMenuPlanCell(row: MenuPlanCellsRow): MenuPlanCell {
  return {
    weekStartDate: row.week_start_date,
    day: row.day,
    category: row.category,
    slot: row.slot,
    dishId: row.dish_id,
    serviceType: row.service_type,
    isActive: row.is_active,
    deletedAt: row.deleted_at ?? undefined,
    deletedBy: undefined,
  }
}

/**
 * Repositorio Supabase para MenuPlanCells.
 * Single-tenant (F.1): sin school_id, RLS por auth.uid() + role.
 * Incluye ServiceType (F.6).
 * Borrado lógico (is_active, deleted_at, deleted_by).
 */
export class SupabaseMenuPlanRepository
  extends SupabaseRepositoryBase
  implements MenuPlanRepository {
  constructor(client?: TypedSupabaseClient) {
    super(client)
  }

  listSnapshot(): MenuPlanCell[] {
    return []
  }

  async list(): Promise<MenuPlanCell[]> {
    const { data, error } = await this.client
      .from('menu_plan_cells')
      .select('*')
      .eq('is_active', true)
      .order('week_start_date', { ascending: true })
      .order('day', { ascending: true })
      .order('category', { ascending: true })
      .order('slot', { ascending: true })

    if (error) this.handleError(error, 'listar celdas de menú')
    return (data ?? []).map(mapRowToMenuPlanCell)
  }

  async getByWeek(weekStartDate: string): Promise<MenuPlanCell[]> {
    const { data, error } = await this.client
      .from('menu_plan_cells')
      .select('*')
      .eq('is_active', true)
      .eq('week_start_date', weekStartDate)
      .order('day', { ascending: true })
      .order('category', { ascending: true })
      .order('slot', { ascending: true })

    if (error) this.handleError(error, 'obtener celdas de menú por semana')
    return (data ?? []).map(mapRowToMenuPlanCell)
  }

  async setCell(selection: MenuCellSelection): Promise<void> {
    const row: MenuPlanCellsInsert = {
      week_start_date: selection.weekStartDate,
      day: selection.day,
      category: selection.category,
      slot: selection.slot,
      dish_id: selection.dishId,
      service_type: 'lunch', // Default; en futuro se pasaría como parámetro
      is_active: true,
    }

    await this.upsertOne<MenuPlanCellsRow, MenuPlanCellsInsert>(
      'menu_plan_cells',
      row,
      { onConflict: 'week_start_date,day,category,slot', ignoreDuplicates: false }
    )
  }

  async clearCell(target: MenuCellTarget): Promise<void> {
    const currentUser = await this.getCurrentUser()
    if (!currentUser) throw new Error('Usuario no autenticado')

    const update: MenuPlanCellsUpdate = {
      is_active: false,
      deleted_at: new Date().toISOString(),
      deleted_by: currentUser.id,
    }

    await this.updateRows<MenuPlanCellsUpdate>('menu_plan_cells', update, {
      week_start_date: target.weekStartDate,
      day: target.day,
      category: target.category,
      slot: target.slot,
    })
  }

  async removeByDishId(dishId: string): Promise<void> {
    const currentUser = await this.getCurrentUser()
    if (!currentUser) throw new Error('Usuario no autenticado')

    const update: MenuPlanCellsUpdate = {
      is_active: false,
      deleted_at: new Date().toISOString(),
      deleted_by: currentUser.id,
    }

    await this.updateRows<MenuPlanCellsUpdate>('menu_plan_cells', update, { dish_id: dishId, is_active: true })
  }
}