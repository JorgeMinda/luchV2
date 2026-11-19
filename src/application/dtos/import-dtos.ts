import type { ImportedRow } from '../../domain/entities/imported-row'

export interface AnalyzeImportInput {
  readonly file: File
  readonly encoding?: string
  readonly dateFormat?: string
}

export interface AnalyzeImportOutput {
  readonly batchId: string
  readonly rows: ImportedRow[]
  readonly summary: {
    readonly total: number
    readonly valid: number
    readonly warnings: number
    readonly errors: number
  }
}

export interface ValidateImportInput {
  readonly batchId: string
  readonly rowNumbers: number[]
}

export interface ValidateImportOutput {
  readonly batchId: string
  readonly validatedRows: ImportedRow[]
  readonly summary: {
    readonly total: number
    readonly valid: number
    readonly warnings: number
    readonly errors: number
  }
}

export interface RevalidateImportRowInput {
  readonly batchId: string
  readonly rowNumber: number
  readonly correctedData: Record<string, unknown>
}

export interface RevalidateImportRowOutput {
  readonly row: ImportedRow
  readonly isValid: boolean
}

export interface RecipeCostComparisonInput {
  readonly batchId: string
}

export interface RecipeCostComparisonOutput {
  readonly matches: Array<{
    readonly csvRow: ImportedRow
    readonly compositionRow: ImportedRow | null
    readonly systemRow: ImportedRow | null
    readonly discrepancies: string[]
  }>
  readonly duplicates: Array<{
    readonly rows: ImportedRow[]
    readonly reason: string
  }>
  readonly conflicts: Array<{
    readonly field: string
    readonly values: unknown[]
    readonly rows: ImportedRow[]
  }>
}

export interface CommitImportInput {
  readonly batchId: string
  readonly approvedRowNumbers: number[]
}

export interface CommitImportOutput {
  readonly batchId: string
  readonly persistedRows: number
  readonly skippedRows: number
  readonly persistenceResult: 'success' | 'partial' | 'failed'
}

export interface LoadHistoricalSeedInput {
  readonly datasetId: string
  readonly version: string
}

export interface LoadHistoricalSeedOutput {
  readonly datasetId: string
  readonly version: string
  readonly rowsLoaded: number
  readonly idempotent: boolean
}
