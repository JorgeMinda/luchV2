import type { DishRecipe, RecipeIngredient, DishRecipeInput } from '../../domain/entities'
import type { Money } from '../../domain/value-objects/money'
import { fromDollars } from '../../domain/value-objects/money'
import type { DishRecipeRepository } from '../../application/ports/DishRecipeRepository'
import {
  readStoredCollection,
  writeStoredCollection,
} from '../storage/localStorage'

const STORAGE_KEY = 'lunch.dish-recipes.v1'

function isMoneyLike(value: unknown): value is Money {
  if (typeof value !== 'object' || value === null) return false
  const cents = (value as Money).cents
  return typeof cents === 'number' && Number.isFinite(cents)
}

function isRecipeIngredient(value: unknown): value is RecipeIngredient {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Record<string, unknown>
  const price = candidate.purchasePrice
  const hasValidPrice =
    (typeof price === 'number' &&
      Number.isFinite(price) &&
      price >= 0) ||
    (isMoneyLike(price) && price.cents >= 0)

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.purchasePresentation === 'string' &&
    hasValidPrice &&
    typeof candidate.purchaseQuantity === 'number' &&
    Number.isFinite(candidate.purchaseQuantity) &&
    candidate.purchaseQuantity > 0 &&
    typeof candidate.recipeQuantity === 'number' &&
    Number.isFinite(candidate.recipeQuantity) &&
    candidate.recipeQuantity >= 0 &&
    typeof candidate.isActive === 'boolean'
  )
}

/** Convierte precios heredados (número en dólares) a Money. */
function normalizeIngredient(
  ingredient: RecipeIngredient,
): RecipeIngredient {
  const price: unknown = ingredient.purchasePrice
  if (typeof price === 'number') {
    return { ...ingredient, purchasePrice: fromDollars(price) }
  }
  return ingredient
}

function normalizeRecipe(recipe: DishRecipe): DishRecipe {
  return { ...recipe, ingredients: recipe.ingredients.map(normalizeIngredient) }
}

function isDishRecipe(value: unknown): value is DishRecipe {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.dishId === 'string' &&
    typeof candidate.source === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    Array.isArray(candidate.ingredients) &&
    candidate.ingredients.every(isRecipeIngredient) &&
    typeof candidate.isActive === 'boolean'
  )
}

export class LocalStorageDishRecipeRepository
  implements DishRecipeRepository
{
  private recipes: DishRecipe[] = (
    readStoredCollection(STORAGE_KEY, isDishRecipe) ?? []
  ).map(normalizeRecipe)

  listSnapshot(): DishRecipe[] {
    return [...this.recipes]
  }

  async list(): Promise<DishRecipe[]> {
    return this.listSnapshot()
  }

  async getByDishId(dishId: string): Promise<DishRecipe | null> {
    return this.recipes.find((recipe) => recipe.dishId === dishId) ?? null
  }

  async saveMany(recipes: DishRecipeInput[]): Promise<DishRecipe[]> {
    const updatedAt = new Date().toISOString()
    const saved = recipes.map((recipe) => ({
      ...recipe,
      updatedAt,
      isActive: true,
      deletedAt: undefined,
      deletedBy: undefined,
      ingredients: recipe.ingredients.map((ing) => ({
        ...ing,
        isActive: true,
        deletedAt: undefined,
        deletedBy: undefined,
      })),
    }))
    const savedDishIds = new Set(saved.map((recipe) => recipe.dishId))

    this.recipes = [
      ...this.recipes.filter(
        (recipe) => !savedDishIds.has(recipe.dishId),
      ),
      ...saved,
    ]
    this.persist()

    return saved
  }

  async removeByDishId(dishId: string): Promise<void> {
    const index = this.recipes.findIndex((r) => r.dishId === dishId)
    if (index !== -1) {
      this.recipes[index] = {
        ...this.recipes[index],
        isActive: false,
        deletedAt: new Date().toISOString(),
        deletedBy: 'local-user',
      }
      this.persist()
    }
  }

  private persist() {
    writeStoredCollection(STORAGE_KEY, this.recipes)
  }
}