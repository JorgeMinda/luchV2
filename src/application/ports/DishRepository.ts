import type { Dish, DishCategory } from '../../domain/entities'

export type NewDish = Omit<Dish, 'id' | 'isActive' | 'deletedAt' | 'deletedBy'>

export interface DishInput {
  id?: string
  name: string
  category: DishCategory
  description: string
}

export interface DishRepository {
  listSnapshot(): Dish[]
  list(): Promise<Dish[]>
  listAll(): Promise<Dish[]>
  save(input: DishInput): Promise<Dish>
  remove(id: string): Promise<void>
  importMany(dishes: NewDish[]): Promise<Dish[]>
}
