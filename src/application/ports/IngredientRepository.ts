import type { Ingredient } from '../../domain/entities'

export type NewIngredient = Omit<Ingredient, 'id' | 'isActive' | 'deletedAt' | 'deletedBy'>

export interface IngredientRepository {
  list(): Promise<Ingredient[]>
  importMany(ingredients: NewIngredient[]): Promise<Ingredient[]>
}
