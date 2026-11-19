import { describe, expect, it } from 'vitest'
import {
  getIngredientRecipeCost,
  getIngredientUnitCost,
  getRecipeIngredientsTotalCost,
  getDishRecipeTotalCost,
  LUNCH_PRICE,
} from './recipe'
import { fromDollars, toDollars } from '../value-objects/money'

describe('recipe costing domain', () => {
  const baseIngredient = {
    id: 'ing-1',
    name: 'Arroz',
    purchasePresentation: 'Funda 1 kg',
    purchasePrice: fromDollars(1.5), // 150 centavos por 1000g
    purchaseQuantity: 1000,
    recipeQuantity: 250,
  }

  describe('getIngredientUnitCost', () => {
    it('retorna cero cuando la división no alcanza un centavo entero', () => {
      // 150 centavos / 1000g = 0.15 centavos/g -> redondea a 0
      const unitCost = getIngredientUnitCost(baseIngredient)
      expect(unitCost.cents).toBe(0)
    })

    it('retorna precio unitario cuando la división es exacta', () => {
      const exact = {
        ...baseIngredient,
        purchasePrice: fromDollars(10.0), // 1000 centavos por 1000g = 1 centavo/g
      }
      expect(getIngredientUnitCost(exact).cents).toBe(1)
    })

    it('retorna cero si la cantidad de compra es invalida', () => {
      const bad = { ...baseIngredient, purchaseQuantity: 0 }
      expect(getIngredientUnitCost(bad).cents).toBe(0)
    })
  })

  describe('getIngredientRecipeCost', () => {
    it('calcula costo multiplicando antes de dividir para preservar precision', () => {
      const cost = getIngredientRecipeCost(baseIngredient)
      // 150 centavos * 250g / 1000g = 37.5 centavos -> 38 centavos
      expect(cost.cents).toBe(38)
    })

    it('aplica merma (yield) cuando existe', () => {
      const withYield = { ...baseIngredient, yieldPercentage: 0.8 }
      const cost = getIngredientRecipeCost(withYield)
      // 38 centavos (redondeado de 37.5) / 0.8 = 47.5 -> 48 centavos
      expect(cost.cents).toBe(48)
    })
  })

  describe('getRecipeIngredientsTotalCost', () => {
    it('suma los costos de todos los ingredientes', () => {
      const ingredients = [
        baseIngredient,
        {
          ...baseIngredient,
          id: 'ing-2',
          name: 'Pollo',
          purchasePrice: fromDollars(3.0),
          recipeQuantity: 150,
        },
      ]
      const total = getRecipeIngredientsTotalCost(ingredients)
      expect(total.cents).toBeGreaterThan(0)
    })
  })

  describe('getDishRecipeTotalCost', () => {
    it('divide el costo total entre las porciones', () => {
      const recipe = {
        dishId: 'dish-1',
        serviceType: 'lunch' as const,
        source: 'manual',
        ingredients: [baseIngredient],
        updatedAt: '2026-01-01',
        portions: 2,
      }
      const costPerPortion = getDishRecipeTotalCost(recipe)
      // costo ingrediente = 38 centavos, / 2 = 19 centavos
      expect(costPerPortion.cents).toBe(19)
    })
  })

  describe('LUNCH_PRICE', () => {
    it('tiene un valor fijo de 2.50', () => {
      expect(toDollars(LUNCH_PRICE)).toBe(2.5)
    })
  })
})
