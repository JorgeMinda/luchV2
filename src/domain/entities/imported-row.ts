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

export type ImportedRowStatus = 'valid' | 'warning' | 'error'
export type ImportedRowSeverity = 'VALID' | 'WARNING' | 'ERROR'

export interface ImportedRow {
  id: string
  batchId: string
  rowIndex: number
  rowNumber: number // Alias for backward compatibility
  sheetName?: string
  sourceType: SourceType
  rawData: Record<string, unknown>
  originalData: Record<string, unknown> // Alias for backward compatibility
  normalizedData?: Record<string, unknown>
  status: ImportedRowStatus
  severity: ImportedRowSeverity // Alias for backward compatibility
  errorMessage?: string
  warningMessages?: string[]
  incidents?: ImportIncident[] // For backward compatibility
  entityType?: ImportedRowEntityType // For backward compatibility
  provenance?: ImportProvenance
  analysisVersion?: string
  createdAt: string
}

export interface NewImportedRow extends Omit<ImportedRow, 'id' | 'createdAt' | 'rowNumber' | 'severity' | 'originalData' | 'incidents' | 'entityType'> {
  id?: string
}