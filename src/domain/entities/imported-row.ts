import type { ImportIncident } from '../value-objects/incident'
import type { SourceType } from '../value-objects/source-type'
import type { ImportProvenance } from '../value-objects/import-provenance'

export type ImportedRowEntityType =
  | 'ingredient'
  | 'recipe'
  | 'menu'
  | 'student'
  | 'payment'
  | 'consumption'

export interface ImportedRow {
  readonly batchId: string
  readonly rowNumber: number
  readonly originalData: Record<string, unknown>
  readonly normalizedData: Record<string, unknown>
  readonly incidents: ImportIncident[]
  readonly severity: 'VALID' | 'WARNING' | 'ERROR'
  readonly entityType: ImportedRowEntityType
  readonly sourceType?: SourceType
  readonly provenance?: ImportProvenance
  readonly analysisVersion?: string
}