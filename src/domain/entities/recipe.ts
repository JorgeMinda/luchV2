import type { Money } from '../value-objects/money'
import { divideMoney, fromCents, fromDollars } from '../value-objects/money'
import type { ServiceType } from '../value-objects/service-type'

/** Precio fijo de un almuerzo. */
export const LUNCH_PRICE: Money = fromDollars(2.5)

/** Alias para compatibilidad; usar ServiceType en nuevo código. */
export type RecipeServiceType = ServiceType

export interface RecipeIngredient {
  id: string
  name: string
  purchasePresentation: string
  /** PVP de compra de la presentación completa. */
  purchasePrice: Money
  purchaseQuantity: number
  recipeQuantity: number
  /**
   * Costo unitario de precisión sub-centavo (ej. 0.0072 USD/g).
   * Se persiste como NUMERIC(12,6). No se usa para cálculos monetarios finales.
   */
  purchaseUnitCostRaw?: number
  /** Fórmula Excel original que generó el costo unitario (ej. "=C5/D5"). */
  sourceFormula?: string
  /** Celda Excel origen (ej. "E5"). */
  sourceCell?: string
  /**
   * Merma del ingrediente: fracción realmente aprovechable
   * (0.8 = 80%). Opcional.
   */
  yieldPercentage?: number
}

export interface DishRecipe {
  dishId: string
  source: string
  ingredients: RecipeIngredient[]
  updatedAt: string
  /** Tipo de servicio al que aplica la receta. */
  serviceType?: ServiceType
  /** Número de porciones que rinde la receta. Opcional. */
  portions?: number
}

function isValidQuantity(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

/**
 * Costo por unidad de compra (centavos por gramo/unidad),
 * redondeado al centavo más cercano.
 * Nota: para precisión sub-centavo usar purchaseUnitCostRaw directamente.
 */
export function getIngredientUnitCost(
  ingredient: RecipeIngredient,
): Money {
  if (
    !Number.isFinite(ingredient.purchasePrice.cents) ||
    !Number.isFinite(ingredient.purchaseQuantity) ||
    ingredient.purchaseQuantity <= 0
  ) {
    return fromCents(0)
  }

  return fromCents(
    Math.round(
      ingredient.purchasePrice.cents / ingredient.purchaseQuantity,
    ),
  )
}

/**
 * Costo del ingrediente usado en la receta.
 * Multiplica antes de dividir para preservar precisión y,
 * si existe merma (yield), divide el resultado por el porcentaje.
 */
export function getIngredientRecipeCost(
  ingredient: RecipeIngredient,
): Money {
  if (
    !Number.isFinite(ingredient.purchasePrice.cents) ||
    !Number.isFinite(ingredient.purchaseQuantity) ||
    ingredient.purchaseQuantity <= 0 ||
    !isValidQuantity(ingredient.recipeQuantity)
  ) {
    return fromCents(0)
  }

  const baseCents = Math.round(
    (ingredient.purchasePrice.cents * ingredient.recipeQuantity) /
      ingredient.purchaseQuantity,
  )

  const yieldPercentage = ingredient.yieldPercentage
  const hasYield =
    yieldPercentage !== undefined &&
    Number.isFinite(yieldPercentage) &&
    yieldPercentage > 0 &&
    yieldPercentage < 1

  return fromCents(
    hasYield ? Math.round(baseCents / yieldPercentage) : baseCents,
  )
}

/** Suma de los costos de todos los ingredientes de una receta. */
export function getRecipeIngredientsTotalCost(
  ingredients: RecipeIngredient[],
): Money {
  return ingredients.reduce<Money>(
    (total, ingredient) =>
      fromCents(total.cents + getIngredientRecipeCost(ingredient).cents),
    fromCents(0),
  )
}

/**
 * Costo total de la receta. Si la receta define porciones,
 * divide el costo total entre ellas.
 */
export function getDishRecipeTotalCost(recipe: DishRecipe): Money {
  const total = getRecipeIngredientsTotalCost(recipe.ingredients)
  const portions = recipe.portions

  if (
    portions === undefined ||
    !Number.isFinite(portions) ||
    portions <= 0
  ) {
    return total
  }

  return divideMoney(total, portions)
}