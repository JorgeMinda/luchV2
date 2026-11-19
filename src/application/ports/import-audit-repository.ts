import type { ImportAuditLog } from '../../domain/entities/import-audit-log'

export interface ImportAuditRepository {
  save(log: ImportAuditLog): Promise<void>
  findByBatchId(batchId: string): Promise<ImportAuditLog[]>
}
