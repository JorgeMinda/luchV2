import type { SourceType } from '../../domain/value-objects/source-type'
import type { ImportIncident } from '../../domain/value-objects/incident'
import type { ServiceType } from '../../domain/value-objects/service-type'
import type { Money } from '../../domain/value-objects/money'
import type { MenuCategory } from '../../domain/entities/dish'

/** Identidad del archivo fuente. */
export interface ImportSourceFile {
  readonly fileName: string
  readonly fileSize: number
  readonly sha256: string
  readonly format: 'xlsx' | 'xls' | 'csv'
  readonly sheetsDetected: readonly SheetIdentity[]
}

/** Hoja detectada en el archivo. */
export interface SheetIdentity {
  readonly index: number
  readonly originalName: string
  readonly normalizedName: string
  readonly rowCount: number
  readonly sourceType?: SourceType
  readonly confidence: 'HIGH' | 'MEDIUM' | 'NONE'
}

/** Vista previa del catálogo. */
export interface CatalogPreview {
  readonly items: readonly CatalogPreviewItem[]
  readonly stats: CatalogPreviewStats
  readonly incidents: readonly ImportIncident[]
}

/** Ítem individual del catálogo en la vista previa. */
export interface CatalogPreviewItem {
  readonly rowNumber: number
  readonly code: string
  readonly bodega: string
  readonly product: string
  readonly presentation: string
  readonly costRaw: unknown
  readonly costCents?: number
  readonly costFormula?: string
  readonly costSourceCell?: string
  readonly status: 'ACTIVO' | 'INACTIVO' | 'UNKNOWN'
  readonly originalStatus: string
  readonly traceability: ItemTraceability
}

/** Vista previa de recetas (almuerzos o refrigerios). */
export interface RecipePreview {
  readonly blocks: readonly RecipePreviewBlock[]
  readonly stats: RecipePreviewStats
  readonly incidents: readonly ImportIncident[]
}

/** Bloque de receta individual. */
export interface RecipePreviewBlock {
  readonly titleRow: number
  readonly title: string
  readonly headerRow: number
  readonly ingredients: readonly RecipePreviewIngredient[]
  readonly closingRows: readonly RecipePreviewClosingRow[]
  readonly subtotalCents?: number
  readonly recharge5Cents?: number
  readonly recharge3Cents?: number
}

/** Ingrediente individual de receta. */
export interface RecipePreviewIngredient {
  readonly rowNumber: number
  readonly name: string
  readonly purchasePresentation: string
  readonly purchasePriceRaw: unknown
  readonly purchasePriceCents?: number
  readonly purchasePriceFormula?: string
  readonly purchasePriceSourceCell?: string
  readonly purchaseQuantity?: number
  readonly unitCostRaw: unknown
  readonly recipeQuantity?: number
  readonly recipeCostRaw: unknown
  readonly recipeCostCents?: number
  readonly recipeCostFormula?: string
  readonly recipeCostSourceCell?: string
  readonly traceability: ItemTraceability
}

/** Fila de cierre de receta. */
export interface RecipePreviewClosingRow {
  readonly rowNumber: number
  readonly type: 'SUBTOTAL' | 'RECHARGE_5' | 'RECHARGE_3' | 'TOTAL' | 'UNCLASSIFIED'
  readonly rawValue: unknown
  readonly rawNumber?: number
  readonly valueCents?: number
  readonly traceability: ItemTraceability
}

export interface RecipePreviewStats {
  readonly totalRows: number
  readonly blocks: number
  readonly ingredientRows: number
  readonly errorIncidents: number
  readonly looseIngredients: number
}

/** Vista previa del menú (anual o refrigerios). */
export interface MenuPreview {
  readonly weeks: readonly MenuPreviewWeek[]
  readonly stats: MenuPreviewStats
  readonly incidents: readonly ImportIncident[]
}

/** Semana individual del menú. */
export interface MenuPreviewWeek {
  readonly weekLabel: string
  readonly labelRow: number
  readonly weekStartDate: string // YYYY-MM-DD
  readonly dates: readonly MenuPreviewDateCell[]
  readonly entries: readonly MenuPreviewEntry[]
  readonly headerType: 'semana' | 'opcion_plato' | 'date_only' | 'dias'
  readonly feriadoDates: readonly string[]
}

/** Celda de fecha del menú. */
export interface MenuPreviewDateCell {
  readonly column: number
  readonly columnLetter: string
  readonly original: unknown
  readonly cellType: 'date' | 'number' | 'string' | 'empty' | 'error' | 'boolean'
  readonly normalized?: string
  readonly format?: string
  readonly traceability: ItemTraceability
}

/** Entrada individual del menú (plato en un día). */
export interface MenuPreviewEntry {
  readonly rowNumber: number
  readonly category: MenuCategory
  readonly originalCategory: string
  readonly column: number
  readonly columnLetter: string
  readonly dayIndex: number // 0=Lunes, ..., 4=Viernes
  readonly serviceDate: string // YYYY-MM-DD
  readonly dish?: string
  readonly originalValue: unknown
  readonly hasError: boolean
  readonly traceability: ItemTraceability
}

export interface MenuPreviewStats {
  readonly totalRows: number
  readonly weekBlocks: number
  readonly dateCells: number
  readonly normalizedDates: number
  readonly entries: number
  readonly formulaErrorCells: number
  readonly physicalBlocks: number
  readonly calendarWeeks: number
  readonly businessDays: number
  readonly feriadoDays: number
}

/** Vista previa de plantillas de composición. */
export interface MealCompositionPreview {
  readonly templates: readonly MealCompositionPreviewTemplate[]
  readonly stats: MealCompositionPreviewStats
  readonly incidents: readonly ImportIncident[]
}

export interface MealCompositionPreviewTemplate {
  readonly titleRow: number
  readonly name: string
  readonly serviceType: ServiceType
  readonly components: readonly MealCompositionPreviewComponent[]
  readonly sheetTargetTotalCents?: number
  readonly verifiedTargetTotalCents?: number
  readonly calculatedTotalCents?: number
  readonly validation: 'VALID' | 'WARNING' | 'ERROR' | 'UNVALIDATED'
}

export interface MealCompositionPreviewComponent {
  readonly rowNumber: number
  readonly componentType: string
  readonly originalName: string
  readonly standardQuantity?: number
  readonly unit?: string
  readonly originalUnit: string
  readonly unitCostRaw: unknown
  readonly portionCostCents?: number
  readonly traceability: ItemTraceability
}

export interface MealCompositionPreviewStats {
  readonly totalRows: number
  readonly templates: number
  readonly components: number
  readonly validatedTemplates: number
}

/** Trazabilidad a nivel de ítem (F.7). */
export interface ItemTraceability {
  readonly sourceFile: string
  readonly sourceSheet: string
  readonly sourceRow: number
  readonly sourceCell?: string
  readonly sourceFormula?: string
}

/** Resumen de trazabilidad del pipeline completo. */
export interface TraceabilityPreview {
  readonly catalog: TraceabilityStage
  readonly lunchRecipes: TraceabilityStage
  readonly snackRecipes: TraceabilityStage
  readonly annualMenu: TraceabilityStage
  readonly snackMenu: TraceabilityStage
  readonly mealComposition: TraceabilityStage
}

/** Etapa de trazabilidad para un dominio. */
export interface TraceabilityStage {
  readonly sourceFile: boolean
  readonly sourceSheet: boolean
  readonly sourceRow: boolean
  readonly sourceCell: boolean
  readonly sourceFormula: boolean
  readonly formulaDetected: number
  readonly formulaPreserved: number
  readonly formulaMissing: number
}

/** Resumen de validación de la importación. */
export interface ImportValidationSummary {
  readonly structuralIntegrity: ValidationCheck
  readonly temporalIntegrity: ValidationCheck
  readonly menuIntegrity: ValidationCheck
  readonly monetaryIntegrity: ValidationCheck
  readonly traceabilityIntegrity: ValidationCheck
  readonly overall: 'PASS' | 'FAIL' | 'WARNING'
}

/** Check individual de validación. */
export interface ValidationCheck {
  readonly status: 'PASS' | 'FAIL' | 'WARNING'
  readonly checks: readonly ValidationDetail[]
}

export interface ValidationDetail {
  readonly name: string
  readonly status: 'PASS' | 'FAIL' | 'WARNING'
  readonly details?: string
}

/** Conteos totales del preview. */
export interface ImportPreviewTotals {
  readonly catalogItems: number
  readonly lunchRecipeBlocks: number
  readonly snackRecipeBlocks: number
  readonly annualMenuEntries: number
  readonly snackMenuEntries: number
  readonly mealCompositionTemplates: number
  readonly totalMenuEntries: number
  readonly totalIncidents: number
  readonly totalErrors: number
  readonly totalWarnings: number
  readonly totalInfo: number
}

/** Contrato principal del Import Preview. */
export interface ImportPreview {
  readonly sourceFile: ImportSourceFile
  readonly generatedAt: string
  readonly catalog: CatalogPreview
  readonly lunchRecipes: RecipePreview
  readonly snackRecipes: RecipePreview
  readonly annualMenu: MenuPreview
  readonly snackMenu: MenuPreview
  readonly mealCompositionTemplates: MealCompositionPreview
  readonly traceability: TraceabilityPreview
  readonly incidents: readonly ImportIncident[]
  readonly validation: ImportValidationSummary
  readonly totals: ImportPreviewTotals
  readonly f1ToF10: F1ToF10Status
}

/** Estado de cumplimiento F.1–F.10. */
export interface F1ToF10Status {
  readonly F1: 'PASS' | 'FAIL' | 'BLOCKED'
  readonly F2: 'PASS' | 'FAIL' | 'BLOCKED'
  readonly F3: 'PASS' | 'FAIL' | 'BLOCKED'
  readonly F4: 'PASS' | 'FAIL' | 'BLOCKED'
  readonly F5: 'PASS' | 'FAIL' | 'BLOCKED'
  readonly F6: 'PASS' | 'FAIL' | 'BLOCKED'
  readonly F7: 'PASS' | 'FAIL' | 'BLOCKED'
  readonly F8: 'PASS' | 'FAIL' | 'BLOCKED'
  readonly F9: 'PASS' | 'FAIL' | 'BLOCKED'
  readonly F10: 'PASS' | 'FAIL' | 'BLOCKED'
}

/** Decisión final del preview. */
export type ImportPreviewDecision =
  | 'READY_FOR_PERSISTENCE'
  | 'BLOCKED'
  | 'DISCREPANCY_DETECTED'

/** Resultado extendido con decisión. */
export interface ImportPreviewResult {
  readonly preview: ImportPreview
  readonly decision: ImportPreviewDecision
  readonly discrepancies: readonly DiscrepancyDetail[]
}

export interface DiscrepancyDetail {
  readonly area: string
  readonly expected: number | string
  readonly actual: number | string
  readonly coordinates?: readonly string[]
  readonly explanation: string
}