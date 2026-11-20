import type {
  DishCategory,
  MenuPlanCell,
  WeekDay,
} from '../../domain/entities'
import { DISH_CATEGORIES, WEEK_DAYS } from '../../domain/entities'
import type {
  MenuCellSelection,
  MenuCellTarget,
  MenuPlanRepository,
} from '../../application/ports/MenuPlanRepository'
import {
  readStoredCollection,
  writeStoredCollection,
} from '../storage/localStorage'

const STORAGE_KEY = 'lunch.menu-plan.v1'

function isWeekDay(value: unknown): value is WeekDay {
  return WEEK_DAYS.some((day) => day === value)
}

function isDishCategory(value: unknown): value is DishCategory {
  return DISH_CATEGORIES.some((category) => category === value)
}

interface StoredMenuPlanCell {
  weekStartDate: string
  day: WeekDay
  category: DishCategory
  slot?: number
  dishId: string
  serviceType: 'lunch' | 'breakfast' | 'snack'
  isActive: boolean
  deletedAt?: string
  deletedBy?: string
}

function isStoredMenuPlanCell(value: unknown): value is StoredMenuPlanCell {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.weekStartDate === 'string' &&
    isWeekDay(candidate.day) &&
    isDishCategory(candidate.category) &&
    typeof candidate.dishId === 'string' &&
    (candidate.slot === undefined ||
      (typeof candidate.slot === 'number' &&
        Number.isInteger(candidate.slot) &&
        candidate.slot >= 0)) &&
    ['lunch', 'breakfast', 'snack'].includes(candidate.serviceType as string) &&
    typeof candidate.isActive === 'boolean'
  )
}

function normalizeCell(cell: StoredMenuPlanCell): MenuPlanCell {
  return {
    weekStartDate: cell.weekStartDate,
    day: cell.day,
    category: cell.category,
    slot: cell.slot ?? 0,
    dishId: cell.dishId,
    serviceType: cell.serviceType,
    isActive: cell.isActive,
    deletedAt: cell.deletedAt,
    deletedBy: cell.deletedBy,
  }
}

function isSameCell(
  cell: MenuPlanCell,
  target: MenuCellTarget,
): boolean {
  return (
    cell.weekStartDate === target.weekStartDate &&
    cell.day === target.day &&
    cell.category === target.category &&
    cell.slot === target.slot
  )
}

export class LocalStorageMenuPlanRepository implements MenuPlanRepository {
  private cells: MenuPlanCell[] = (
    readStoredCollection(STORAGE_KEY, isStoredMenuPlanCell) ?? []
  ).map(normalizeCell)

  listSnapshot(): MenuPlanCell[] {
    return [...this.cells]
  }

  async list(): Promise<MenuPlanCell[]> {
    return this.listSnapshot()
  }

  async setCell(selection: MenuCellSelection): Promise<void> {
    const newCell: MenuPlanCell = {
      ...selection,
      serviceType: 'lunch', // Default
      isActive: true,
      deletedAt: undefined,
      deletedBy: undefined,
    }

    this.cells = [
      ...this.cells.filter((cell) => !isSameCell(cell, selection)),
      newCell,
    ]
    this.persist()
  }

  async clearCell(target: MenuCellTarget): Promise<void> {
    this.cells = this.cells.filter((cell) => !isSameCell(cell, target))
    this.persist()
  }

  async removeByDishId(dishId: string): Promise<void> {
    this.cells = this.cells.filter((cell) => cell.dishId !== dishId)
    this.persist()
  }

  private persist() {
    writeStoredCollection(STORAGE_KEY, this.cells)
  }
}