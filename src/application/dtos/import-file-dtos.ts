import type { SourceType } from '../../domain/value-objects/source-type'
import type { ImportProvenance } from '../../domain/value-objects/import-provenance'

export interface ImportSheetContract {
  readonly index: number
  readonly originalName: string
  readonly normalizedName: string
  readonly headers: readonly string[]
  readonly rows: readonly (readonly unknown[])[]
  readonly sourceType?: SourceType
  readonly provenance?: ImportProvenance
}

export interface ImportWorkbookContract {
  readonly fileName: string
  readonly fileSize?: number
  readonly format: 'csv' | 'xlsx' | 'xls'
  readonly encoding?: string
  readonly sheets: readonly ImportSheetContract[]
}
