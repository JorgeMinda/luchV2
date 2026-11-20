import type { DishRecipe } from '../../domain/entities'

export type DishRecipeInput = Omit<DishRecipe, 'updatedAt' | 'isActive' | 'deletedAt' | 'deletedBy'>

export interface DishRecipeRepository {
  listSnapshot(): DishRecipe[]
  list(): Promise<DishRecipe[]>
  getByDishId(dishId: string): Promise<DishRecipe | null>
  saveMany(recipes: DishRecipeInput[]): Promise<DishRecipe[]>
  removeByDishId(dishId: string): Promise<void>
}
