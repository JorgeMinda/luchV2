import type { Dish } from '../../domain/entities'
import { DISH_CATEGORIES } from '../../domain/entities'
import type {
  DishInput,
  DishRepository,
  NewDish,
} from '../../application/ports/DishRepository'
import {
  readStoredCollection,
  writeStoredCollection,
} from '../storage/localStorage'

const STORAGE_KEY = 'lunch.dishes.v1'

function isDish(value: unknown): value is Dish {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.description === 'string' &&
    DISH_CATEGORIES.some((category) => category === candidate.category) &&
    typeof candidate.isActive === 'boolean'
  )
}

export class LocalStorageDishRepository implements DishRepository {
  private dishes: Dish[] = readStoredCollection(STORAGE_KEY, isDish) ?? []

  listSnapshot(): Dish[] {
    return [...this.dishes]
  }

  async list(): Promise<Dish[]> {
    return this.listSnapshot()
  }

  async save(input: DishInput): Promise<Dish> {
    const existingIndex = input.id
      ? this.dishes.findIndex((dish) => dish.id === input.id)
      : -1

    if (existingIndex >= 0) {
      const updated: Dish = {
        id: this.dishes[existingIndex].id,
        name: input.name,
        category: input.category,
        description: input.description,
        isActive: true,
        deletedAt: undefined,
        deletedBy: undefined,
      }

      this.dishes = this.dishes.map((dish, index) =>
        index === existingIndex ? updated : dish,
      )
      this.persist()

      return updated
    }

    const created: Dish = {
      id: input.id ?? `dish-${crypto.randomUUID()}`,
      name: input.name,
      category: input.category,
      description: input.description,
      isActive: true,
      deletedAt: undefined,
      deletedBy: undefined,
    }

    this.dishes = [...this.dishes, created]
    this.persist()

    return created
  }

  async remove(id: string): Promise<void> {
    this.dishes = this.dishes.filter((dish) => dish.id !== id)
    this.persist()
  }

  async importMany(dishes: NewDish[]): Promise<Dish[]> {
    const created = dishes.map((dish) => ({
      ...dish,
      id: `dish-${crypto.randomUUID()}`,
      isActive: true,
      deletedAt: undefined,
      deletedBy: undefined,
    }))

    this.dishes = [...this.dishes, ...created]
    this.persist()

    return created
  }

  private persist() {
    writeStoredCollection(STORAGE_KEY, this.dishes)
  }
}