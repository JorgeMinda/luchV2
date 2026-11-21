import type { DishCategory, MenuPlanCell, WeekDay } from '../../domain/entities'

export interface MenuCellTarget {
  weekStartDate: string
  day: WeekDay
  category: DishCategory
  slot: number
}

export interface MenuCellSelection extends MenuCellTarget {
  dishId: string
}

export interface MenuPlanRepository {
  listSnapshot(): MenuPlanCell[]
  list(): Promise<MenuPlanCell[]>
  listAll(): Promise<MenuPlanCell[]>
  setCell(selection: MenuCellSelection): Promise<void>
  clearCell(target: MenuCellTarget): Promise<void>
  removeByDishId(dishId: string): Promise<void>
}
