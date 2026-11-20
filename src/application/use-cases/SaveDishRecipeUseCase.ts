import type { DishRecipe, RecipeIngredient } from '../../domain/entities'
import type { DishRepository } from '../ports/DishRepository'
import type { DishRecipeRepository } from '../ports/DishRecipeRepository'
import { sanitizeRecipeIngredient } from './dishRecipeInput'

export interface SaveDishRecipeInput {
  dishId: string
  source: string
  ingredients: RecipeIngredient[]
}

export class SaveDishRecipeUseCase {
  private readonly dishRepository: DishRepository
  private readonly recipeRepository: DishRecipeRepository

  constructor(
    dishRepository: DishRepository,
    recipeRepository: DishRecipeRepository,
  ) {
    this.dishRepository = dishRepository
    this.recipeRepository = recipeRepository
  }

  async execute(input: SaveDishRecipeInput): Promise<DishRecipe> {
    const dishes = await this.dishRepository.list()

    if (!dishes.some((dish) => dish.id === input.dishId)) {
      throw new Error('El platillo ya no existe en el catálogo.')
    }

    const ingredients = input.ingredients
      .map(sanitizeRecipeIngredient)
      .filter((ingredient): ingredient is RecipeIngredient =>
        Boolean(ingredient),
      )

    if (ingredients.length === 0) {
      throw new Error(
        'Agrega al menos un ingrediente con nombre, precio y cantidades válidas.',
      )
    }

    const [saved] = await this.recipeRepository.saveMany([
      {
        dishId: input.dishId,
        source: input.source.trim() || 'Edición manual',
        ingredients,
        serviceType: 'lunch',
      },
    ])

    if (!saved) {
      throw new Error('No se pudo guardar la receta.')
    }

    return saved
  }
}
