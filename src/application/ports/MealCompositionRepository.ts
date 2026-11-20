import type { MealCompositionTemplate, NewMealCompositionTemplate, NewMealCompositionComponent } from '../../domain/entities/meal-composition-template'

export type { NewMealCompositionTemplate, NewMealCompositionComponent }

export interface MealCompositionRepository {
  list(): Promise<MealCompositionTemplate[]>
  listSnapshot(): MealCompositionTemplate[]
  getById(id: string): Promise<MealCompositionTemplate | null>
  saveMany(templates: NewMealCompositionTemplate[]): Promise<MealCompositionTemplate[]>
  removeById(id: string): Promise<void>
}