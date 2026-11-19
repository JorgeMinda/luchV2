import type { RecipeIngredient } from '../../domain/entities'
import type { DishRepository } from '../ports/DishRepository'
import type { DishRecipeRepository } from '../ports/DishRecipeRepository'
import { sanitizeRecipeIngredient } from './dishRecipeInput'

export interface ImportDishCostsInput {
  dishId: string
  source: string
  ingredients: RecipeIngredient[]
}

export interface ImportDishCostsResult {
  importedRecipes: number
  importedIngredients: number
  skippedRecipes: number
}

function ingredientSignature(ingredient: RecipeIngredient): string {
  return [
    ingredient.name,
    ingredient.purchasePresentation,
    ingredient.purchasePrice.cents,
    ingredient.purchaseQuantity,
    ingredient.recipeQuantity,
  ].join('|')
}

export class ImportDishCostsUseCase {
  private readonly dishRepository: DishRepository
  private readonly recipeRepository: DishRecipeRepository

  constructor(
    dishRepository: DishRepository,
    recipeRepository: DishRecipeRepository,
  ) {
    this.dishRepository = dishRepository
    this.recipeRepository = recipeRepository
  }

  async execute(
    inputs: ImportDishCostsInput[],
  ): Promise<ImportDishCostsResult> {
    const dishes = await this.dishRepository.list()
    const knownDishIds = new Set(dishes.map((dish) => dish.id))
    const merged = new Map<
      string,
      {
        source: string
        ingredients: RecipeIngredient[]
        signatures: Set<string>
      }
    >()
    let skippedRecipes = 0

    for (const input of inputs) {
      const ingredients = input.ingredients
        .map(sanitizeRecipeIngredient)
        .filter((ingredient): ingredient is RecipeIngredient =>
          Boolean(ingredient),
        )

      if (!knownDishIds.has(input.dishId) || ingredients.length === 0) {
        skippedRecipes += 1
        continue
      }

      const current = merged.get(input.dishId) ?? {
        source: input.source.trim(),
        ingredients: [],
        signatures: new Set<string>(),
      }

      for (const ingredient of ingredients) {
        const signature = ingredientSignature(ingredient)
        if (current.signatures.has(signature)) continue

        current.signatures.add(signature)
        current.ingredients.push(ingredient)
      }

      if (!current.source && input.source.trim()) {
        current.source = input.source.trim()
      }

      merged.set(input.dishId, current)
    }

    const recipes = [...merged.entries()]
      .filter(([, value]) => value.ingredients.length > 0)
      .map(([dishId, value]) => ({
        dishId,
        source: value.source,
        ingredients: value.ingredients,
      }))
    const saved = await this.recipeRepository.saveMany(recipes)

    return {
      importedRecipes: saved.length,
      importedIngredients: saved.reduce(
        (total, recipe) => total + recipe.ingredients.length,
        0,
      ),
      skippedRecipes,
    }
  }
}
