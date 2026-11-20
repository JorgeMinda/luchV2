import type { DishCategory } from './dish'
import { DISH_CATEGORIES } from './dish'
import type { WeekDay } from './menu'

export const MENU_CATEGORY_SLOTS: Record<DishCategory, number> = {
  Sopa: 1,
  Proteína: 2,
  Guarnición: 2,
  Ensalada: 0,
  'Bebida Fría': 2,
  Postre: 1,
  Fruta: 1,
}

export interface MenuSlotRow {
  category: DishCategory
  slot: number
}

export const MENU_SLOT_ROWS: MenuSlotRow[] = DISH_CATEGORIES.flatMap(
  (category) =>
    Array.from({ length: MENU_CATEGORY_SLOTS[category] }, (_, slot) => ({
      category,
      slot,
    })),
)

export interface MenuPlanCell {
  weekStartDate: string
  day: WeekDay
  category: DishCategory
  slot: number
  dishId: string
  serviceType: 'lunch' | 'breakfast' | 'snack'
  /** Borrado lógico: indica si el registro está activo. */
  isActive: boolean
  /** Timestamp de borrado lógico. */
  deletedAt?: string
  /** Usuario que realizó el borrado lógico. */
  deletedBy?: string
}

export interface NewMenuPlanCell extends Omit<MenuPlanCell, 'isActive' | 'deletedAt' | 'deletedBy'> {}

export interface MenuCellSelection extends Omit<MenuPlanCell, 'isActive' | 'deletedAt' | 'deletedBy'> {}

export interface MenuCellTarget {
  weekStartDate: string
  day: WeekDay
  category: DishCategory
  slot: number
}