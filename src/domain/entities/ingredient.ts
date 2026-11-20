import type { Money } from '../value-objects/money'

export type IngredientStatus = 'ACTIVO' | 'INACTIVO'

export interface Ingredient {
  id: string
  code: string
  category: string
  product: string
  presentation: string
  cost: Money
  /** Costo unitario de precisión sub-centavo (ej. 0.0072 USD/g). Se persiste como NUMERIC(12,6). */
  purchaseUnitCostRaw?: number
  /** Fórmula Excel original que generó el costo unitario (ej. "=C5/D5"). */
  sourceFormula?: string
  status: IngredientStatus
  /** Borrado lógico: indica si el registro está activo. */
  isActive: boolean
  /** Timestamp de borrado lógico. */
  deletedAt?: string
  /** Usuario que realizó el borrado lógico. */
  deletedBy?: string
}

export interface NewIngredient extends Omit<Ingredient, 'id' | 'isActive' | 'deletedAt' | 'deletedBy'> {
  id?: string
}