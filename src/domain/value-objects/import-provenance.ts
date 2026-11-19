import type { SourceType } from './source-type'

export interface ImportProvenance {
  readonly sourceType: SourceType
  readonly fileName: string
  readonly sheetName?: string
  readonly sheetIndex?: number
  readonly rowNumber?: number
  readonly column?: string
  readonly analysisVersion?: string
}
