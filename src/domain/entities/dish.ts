export const DISH_CATEGORIES = [
  'Sopa',
  'Proteína',
  'Guarnición',
  'Ensalada',
  'Bebida Fría',
  'Postre',
  'Fruta',
] as const

export type DishCategory = (typeof DISH_CATEGORIES)[number]

export interface Dish {
  id: string
  name: string
  category: DishCategory
  description: string
  /** Borrado lógico: indica si el registro está activo. */
  isActive: boolean
  /** Timestamp de borrado lógico. */
  deletedAt?: string
  /** Usuario que realizó el borrado lógico. */
  deletedBy?: string
}

export interface NewDish extends Omit<Dish, 'id' | 'isActive' | 'deletedAt' | 'deletedBy'> {
  id?: string
}

export interface DishInput extends Omit<Dish, 'id' | 'isActive' | 'deletedAt' | 'deletedBy'> {
  id?: string
}