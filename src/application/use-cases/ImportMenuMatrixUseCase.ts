import type { DishCategory } from '../../domain/entities'
import { MENU_CATEGORY_SLOTS } from '../../domain/entities'
import type { DishRepository, NewDish } from '../ports/DishRepository'
import type { MenuPlanRepository } from '../ports/MenuPlanRepository'
import { getDishKey } from '../../domain/value-objects/dish'
import {
  getWeekDayFromIsoDate,
  getWeekStartIsoDate,
} from '../../domain/value-objects/calendar'

export interface MenuMatrixEntry {
  date: string
  category: DishCategory
  dishName: string
}

export interface ImportMenuMatrixResult {
  createdDishes: number
  existingDishes: number
  cells: number
  skipped: number
  weeks: number
}

interface MenuGroupItem {
  dishKey: string
  dishName: string
}

interface MenuGroup {
  weekStartDate: string
  day: NonNullable<ReturnType<typeof getWeekDayFromIsoDate>>
  category: DishCategory
  items: MenuGroupItem[]
}

export class ImportMenuMatrixUseCase {
  private readonly dishRepository: DishRepository
  private readonly menuPlanRepository: MenuPlanRepository

  constructor(
    dishRepository: DishRepository,
    menuPlanRepository: MenuPlanRepository,
  ) {
    this.dishRepository = dishRepository
    this.menuPlanRepository = menuPlanRepository
  }

  async execute(
    entries: MenuMatrixEntry[],
  ): Promise<ImportMenuMatrixResult> {
    const groups = new Map<string, MenuGroup>()
    let skipped = 0

    for (const entry of entries) {
      const dishName = entry.dishName.trim()
      if (!dishName) continue

      const day = getWeekDayFromIsoDate(entry.date)
      if (!day) continue

      const capacity = MENU_CATEGORY_SLOTS[entry.category]
      const weekStartDate = getWeekStartIsoDate(entry.date)
      const groupKey = `${weekStartDate}|${day}|${entry.category}`
      const dishKey = getDishKey(entry.category, dishName)
      const group = groups.get(groupKey) ?? {
        weekStartDate,
        day,
        category: entry.category,
        items: [],
      }

      if (
        capacity === 0 ||
        group.items.some((item) => item.dishKey === dishKey) ||
        group.items.length >= capacity
      ) {
        skipped += 1
        groups.set(groupKey, group)
        continue
      }

      group.items.push({ dishKey, dishName })
      groups.set(groupKey, group)
    }

    const existingDishes = await this.dishRepository.list()
    const dishByKey = new Map(
      existingDishes.map((dish) => [
        getDishKey(dish.category, dish.name),
        dish,
      ]),
    )
    const usedExistingKeys = new Set<string>()
    const missingDishes = new Map<string, NewDish>()

    for (const group of groups.values()) {
      for (const item of group.items) {
        if (dishByKey.has(item.dishKey)) {
          usedExistingKeys.add(item.dishKey)
          continue
        }

        if (missingDishes.has(item.dishKey)) continue

        missingDishes.set(item.dishKey, {
          name: item.dishName,
          category: group.category,
          description: '',
        })
      }
    }

    const created =
      missingDishes.size > 0
        ? await this.dishRepository.importMany(
            Array.from(missingDishes.values()),
          )
        : []

    for (const dish of created) {
      dishByKey.set(getDishKey(dish.category, dish.name), dish)
    }

    let cells = 0
    const weeks = new Set<string>()

    for (const group of groups.values()) {
      const capacity = MENU_CATEGORY_SLOTS[group.category]
      if (capacity === 0) continue

      for (let slot = 0; slot < capacity; slot += 1) {
        await this.menuPlanRepository.clearCell({
          weekStartDate: group.weekStartDate,
          day: group.day,
          category: group.category,
          slot,
        })
      }

      for (const [slot, item] of group.items.entries()) {
        const dish = dishByKey.get(item.dishKey)
        if (!dish) continue

        await this.menuPlanRepository.setCell({
          weekStartDate: group.weekStartDate,
          day: group.day,
          category: group.category,
          slot,
          dishId: dish.id,
        })

        cells += 1
      }

      if (group.items.length > 0) {
        weeks.add(group.weekStartDate)
      }
    }

    return {
      createdDishes: created.length,
      existingDishes: usedExistingKeys.size,
      cells,
      skipped,
      weeks: weeks.size,
    }
  }
}