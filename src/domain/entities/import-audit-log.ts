import type { SourceType } from '../value-objects/source-type'

export interface ImportAuditLog {
  readonly batchId: string
  readonly operatorId: string
  readonly operatorRole: string
  readonly timestamp: string
  readonly fileName: string
  readonly fileHash: string
  readonly format: string
  readonly sheetName?: string
  readonly sourceType?: SourceType
  readonly analysisVersion?: string
  readonly totalRows: number
  readonly validRows: number
  readonly warningRows: number
  readonly errorRows: number
  readonly transformations: string[]
  readonly corrections: string[]
  readonly approvals: string[]
  readonly rejections: string[]
  readonly persistenceResult: 'pending' | 'success' | 'partial' | 'failed'
}
