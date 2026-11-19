import type { ImportIncident } from '../../domain/value-objects/incident'
import type { ReaderIncident, SheetTypeDetection } from '../ports/import-file-reader-port'
import type { CatalogParseResult } from '../../infrastructure/import/parsers/catalog-parser'
import type { RecipeCostingParseResult } from '../../infrastructure/import/parsers/recipe-costing-parser'
import type { MenuPlanParseResult } from '../../infrastructure/import/parsers/menu-plan-parser'
import type { MealCompositionParseResult } from '../../infrastructure/import/parsers/meal-composition-parser'

export interface ParsedSheetSummary {
  readonly sheetName: string
  readonly sheetIndex: number
  readonly detection: SheetTypeDetection
  readonly sourceType: SheetTypeDetection['sourceType']
  readonly catalog?: CatalogParseResult
  readonly recipeCosting?: RecipeCostingParseResult
  readonly menuPlan?: MenuPlanParseResult
  readonly mealComposition?: MealCompositionParseResult
  readonly incidents: readonly ImportIncident[]
}

export interface ParseImportWorkbookOutput {
  readonly fileName: string
  readonly fileSize: number
  readonly format: 'csv' | 'xlsx' | 'xls'
  readonly encoding: string
  readonly readerIncidents: readonly ReaderIncident[]
  readonly sheets: readonly ParsedSheetSummary[]
  readonly stats: {
    readonly totalSheets: number
    readonly detectedSheets: number
    readonly undetectedSheets: number
  }
}

export interface ParseImportWorkbookUseCase {
  execute(file: File): Promise<ParseImportWorkbookOutput>
}
