import type { Ingredient } from '../../domain/entities'
import type {
  IngredientRepository,
  NewIngredient,
} from '../../application/ports/IngredientRepository'

const STORAGE_KEY = 'lunch.inventory.v1'

function isIngredient(value: unknown): value is Ingredient {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.code === 'string' &&
    typeof candidate.category === 'string' &&
    typeof candidate.product === 'string' &&
    typeof candidate.presentation === 'string' &&
    typeof candidate.cost === 'object' &&
    (candidate.status === 'ACTIVO' || candidate.status === 'INACTIVO') &&
    typeof candidate.isActive === 'boolean'
  )
}

function readStoredIngredients(): Ingredient[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(isIngredient)
  } catch {
    return []
  }
}

export class LocalStorageIngredientRepository implements IngredientRepository {
  private ingredients: Ingredient[] = readStoredIngredients()

  listSnapshot(): Ingredient[] {
    return [...this.ingredients]
  }

  async list(): Promise<Ingredient[]> {
    return this.listSnapshot()
  }

  async importMany(ingredients: NewIngredient[]): Promise<Ingredient[]> {
    const created = ingredients.map((ingredient) => ({
      ...ingredient,
      id: `ingredient-${crypto.randomUUID()}`,
      isActive: true,
      deletedAt: undefined,
      deletedBy: undefined,
    }))

    this.ingredients = [...this.ingredients, ...created]
    this.persist()

    return created
  }

  async getById(id: string): Promise<Ingredient | null> {
    return this.ingredients.find((ing) => ing.id === id) ?? null
  }

  async getByCode(code: string): Promise<Ingredient | null> {
    return this.ingredients.find((ing) => ing.code === code) ?? null
  }

  async save(ingredient: NewIngredient): Promise<Ingredient> {
    const existingIndex = this.ingredients.findIndex((ing) => ing.code === ingredient.code)

    if (existingIndex >= 0) {
      const updated: Ingredient = {
        ...this.ingredients[existingIndex],
        ...ingredient,
        isActive: true,
        deletedAt: undefined,
        deletedBy: undefined,
      }
      this.ingredients[existingIndex] = updated
      this.persist()
      return updated
    }

    const created: Ingredient = {
      ...ingredient,
      id: `ingredient-${crypto.randomUUID()}`,
      isActive: true,
      deletedAt: undefined,
      deletedBy: undefined,
    }
    this.ingredients = [...this.ingredients, created]
    this.persist()
    return created
  }

  async delete(id: string, deletedBy: string): Promise<void> {
    const index = this.ingredients.findIndex((ing) => ing.id === id)
    if (index !== -1) {
      this.ingredients[index] = {
        ...this.ingredients[index],
        isActive: false,
        deletedAt: new Date().toISOString(),
        deletedBy,
      }
      this.persist()
    }
  }

  private persist() {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(this.ingredients),
      )
    } catch {
      return
    }
  }
}