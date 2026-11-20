import { fromCents, type Money } from '../value-objects/money'
import type { UnitOfMeasure } from '../value-objects/unit-of-measure'
import type { ServiceType } from '../value-objects/service-type'
import type { ImportProvenance } from '../value-objects/import-provenance'

export type MealCompositionComponentType =
  | 'PROTEINA'
  | 'GUARNICION'
  | 'ARROZ'
  | 'ENSALADA'
  | 'FRUTA'
  | 'SOPA'
  | 'POSTRE'
  | 'SALSAS'
  | 'JUGO'

export interface MealCompositionComponent {
  readonly id: string
  readonly componentType: MealCompositionComponentType
  readonly name: string
  readonly standardQuantity?: number
  readonly unit?: UnitOfMeasure
  readonly netQuantityPerPortion?: number
  readonly referenceUnitCost?: Money
  readonly targetPortionCost?: Money
  readonly calculatedCost?: Money
  readonly yieldPercentage?: number
  readonly mermaPercentage?: number
  readonly aliases?: readonly string[]
  readonly provenance?: ImportProvenance
  /** Costo unitario de precisión sub-centavo (ej. 0.0072 USD/g). Se persiste como NUMERIC(12,6). */
  readonly referenceUnitCostRaw?: number
  /** Fórmula Excel original que generó el costo unitario (ej. "=C3*D3"). */
  readonly sourceFormula?: string
  /** Celda Excel origen (ej. "E3"). */
  readonly sourceCell?: string
  /** Borrado lógico: indica si el registro está activo. */
  readonly isActive: boolean
  /** Timestamp de borrado lógico. */
  readonly deletedAt?: string
  /** Usuario que realizó el borrado lógico. */
  readonly deletedBy?: string
}

export interface MealCompositionTemplate {
  readonly id: string
  readonly name: string
  readonly serviceType: ServiceType
  readonly components: readonly MealCompositionComponent[]
  readonly targetTotalCost?: Money
  readonly calculatedTotalCost?: Money
  readonly tolerance?: number
  readonly aliases?: readonly string[]
  readonly provenance?: ImportProvenance
  /** Borrado lógico: indica si el registro está activo. */
  readonly isActive: boolean
  /** Timestamp de borrado lógico. */
  readonly deletedAt?: string
  /** Usuario que realizó el borrado lógico. */
  readonly deletedBy?: string
}

export interface NewMealCompositionComponent extends Omit<MealCompositionComponent, 'id' | 'isActive' | 'deletedAt' | 'deletedBy'> {
  id?: string
}

export interface NewMealCompositionTemplate extends Omit<MealCompositionTemplate, 'id' | 'components' | 'isActive' | 'deletedAt' | 'deletedBy'> {
  id?: string
  components: NewMealCompositionComponent[]
}

/**
 * Costos objetivo verificados contra el documento original
 * `17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (4).xlsx`,
 * hoja `COMPOSICION DE CADA PLATO`. Expresados en centavos USD.
 */
export const VERIFIED_TEMPLATE_TARGETS: readonly {
  readonly name: string
  readonly aliases: readonly string[]
  readonly serviceType: ServiceType
  readonly targetTotalCost: Money
}[] = [
  {
    name: 'Almuerzo Saludable Estudiantil',
    aliases: [],
    serviceType: 'lunch',
    targetTotalCost: fromCents(124),
  },
  {
    name: 'Almuerzo Estudiantil Completo Especial',
    aliases: [],
    serviceType: 'lunch',
    targetTotalCost: fromCents(138),
  },
  {
    name: 'Refrigerio prescolar/Primaria',
    aliases: ['Refrigerio preescolar/Primaria'],
    serviceType: 'snack',
    targetTotalCost: fromCents(84),
  },
  {
    name: 'Almuerzo Completo Administrativos',
    aliases: [],
    serviceType: 'lunch',
    targetTotalCost: fromCents(144),
  },
]

/**
 * Tolerancia de comparación de composición, en centavos:
 * diferencia ≤ 1 centavo → WARNING (redondeo); > 1 centavo → ERROR.
 */
export const MEAL_COMPOSITION_TOLERANCE_CENTS = 1