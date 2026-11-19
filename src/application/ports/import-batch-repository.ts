import type { ImportBatch } from '../../domain/entities/import-batch'
import type { ImportStatus } from '../../domain/value-objects/import-status'

export interface ImportBatchRepository {
  save(batch: ImportBatch): Promise<void>
  findById(id: string): Promise<ImportBatch | null>
  findByHash(hash: string): Promise<ImportBatch | null>
  list(): Promise<ImportBatch[]>
  updateStatus(id: string, status: ImportStatus): Promise<void>
}
