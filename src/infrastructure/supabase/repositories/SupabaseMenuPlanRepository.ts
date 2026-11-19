import type { DishCategory, MenuPlanCell, WeekDay } from '../../../domain/entities'
import type { MenuCellTarget, MenuCellSelection, MenuPlanRepository } from '../../../application/ports/MenuPlanRepository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'

/**
 * Mapea fila de BD a MenuPlanCell de dominio.
 */
function mapRowToMenuPlanCell(row: {
  week_start_date: string
  day: WeekDay
  category: DishCategory
  slot: number
  dish_id: string
  service_type: 'lunch' | 'breakfast' | 'snack'
}): MenuPlanCell {
  return {
    weekStartDate: row.week_start_date,
    day: row.day,
    category: row.category,
    slot: row.slot,
    dishId: row.dish_id,
  }
}

/**
 * Repositorio Supabase para MenuPlanCells.
 * Respeta RLS por school_id (F.1), incluye ServiceType (F.6).
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
      .order('week_start_date', { ascending: true })
      .order('day', { ascending: true })
      .order('category', { ascending: true })
      .order('slot', { ascending: true })

    if (error) this.handleError(error, 'listar celdas de menú')
    return (data ?? []).map(mapRowToMenuPlanCell)
  }

  async setCell(selection: MenuCellSelection): Promise<void> {
    const { error } = await this.client.from('menu_plan_cells').upsert(
      {
        week_start_date: selection.weekStartDate,
        day: selection.day,
        category: selection.category,
        slot: selection.slot,
        dish_id: selection.dishId,
        service_type: 'lunch', // Default; en futuro se pasaría como parámetro
      } as any,
      { onConflict: 'school_id,week_start_date,day,category,slot', ignoreDuplicates: false },
    )

    if (error) this.handleError(error, 'establecer celda de menú')
  }

  async clearCell(target: MenuCellTarget): Promise<void> {
    const { error } = await this.client
      .from('menu_plan_cells')
      .delete()
      .eq('week_start_date', target.weekStartDate)
      .eq('day', target.day)
      .eq('category', target.category)
      .eq('slot', target.slot)

    if (error) this.handleError(error, 'limpiar celda de menú')
  }

  async removeByDishId(dishId: string): Promise<void> {
    const { error } = await this.client
      .from('menu_plan_cells')
      .delete()
      .eq('dish_id', dishId)

    if (error) this.handleError(error, 'eliminar celdas de menú por plato')
  }
}