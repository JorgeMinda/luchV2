import type { RecipeIngredient } from '../../domain/entities'

export function sanitizeRecipeIngredient(
  ingredient: RecipeIngredient,
): RecipeIngredient | null {
  const name = ingredient.name.trim()
  const purchasePresentation = ingredient.purchasePresentation.trim()

  if (
    !name ||
    !Number.isFinite(ingredient.purchasePrice.cents) ||
    ingredient.purchasePrice.cents < 0 ||
    !Number.isFinite(ingredient.purchaseQuantity) ||
    ingredient.purchaseQuantity <= 0 ||
    !Number.isFinite(ingredient.recipeQuantity) ||
    ingredient.recipeQuantity < 0
  ) {
    return null
  }

  return {
    id: ingredient.id || `recipe-line-${crypto.randomUUID()}`,
    name,
    purchasePresentation,
    purchasePrice: ingredient.purchasePrice,
    purchaseQuantity: ingredient.purchaseQuantity,
    recipeQuantity: ingredient.recipeQuantity,
    yieldPercentage: ingredient.yieldPercentage,
  }
}
