import type { ImportStatus } from '../value-objects/import-status'
import type { SourceType } from '../value-objects/source-type'
export interface ImportBatch {
  readonly id: string
  readonly fileName: string
  readonly fileHash: string
  readonly status: ImportStatus
  readonly createdAt: string
  readonly processedAt?: string
  readonly totalRows: number
  readonly validRows: number
  readonly warningRows: number
  readonly errorRows: number
  readonly approvedRows: number
  readonly rejectedRows: number
  readonly sourceFormat: 'csv' | 'xlsx' | 'xls'
  readonly encoding?: string
  readonly sourceType?: SourceType
  readonly analysisVersion?: string
  readonly provenance?: string
}
