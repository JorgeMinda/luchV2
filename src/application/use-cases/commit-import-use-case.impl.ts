import type { CommitImportInput, CommitImportOutput } from '../dtos/import-dtos'
import type { CommitImportUseCase } from './commit-import-use-case'
import type { ImportBatchRepository } from '../ports/import-batch-repository'
import type { ImportAuditRepository } from '../ports/import-audit-repository'
import type { ImportBatch } from '../../domain/entities/import-batch'
import { InMemoryImportRowStore } from '../../infrastructure/import/batch/in-memory-row-store'

export class CommitImportUseCaseImpl implements CommitImportUseCase {
  private batchRepository: ImportBatchRepository
  private auditRepository: ImportAuditRepository
  private rowStore: InMemoryImportRowStore

  constructor(
    batchRepository: ImportBatchRepository,
    auditRepository: ImportAuditRepository,
    rowStore: InMemoryImportRowStore,
  ) {
    this.batchRepository = batchRepository
    this.auditRepository = auditRepository
    this.rowStore = rowStore
  }

  async execute(input: CommitImportInput): Promise<CommitImportOutput> {
    const batch = await this.batchRepository.findById(input.batchId)
    if (!batch) throw new Error(`Lote ${input.batchId} no encontrado.`)
    if (batch.status === 'COMPLETED') {
      return { batchId: batch.id, persistedRows: batch.approvedRows, skippedRows: 0, persistenceResult: 'success' }
    }
    if (batch.status !== 'ANALYZED' && batch.status !== 'APPROVED') {
      throw new Error(`El lote ${batch.id} tiene estado ${batch.status} y no puede confirmarse.`)
    }

    const rows = this.rowStore.getRows(batch.id)
    const approved = rows.filter((r) => input.approvedRowNumbers.includes(r.rowNumber))
    const rejected = rows.filter((r) => !input.approvedRowNumbers.includes(r.rowNumber))
    const invalid = approved.filter((r) => r.severity === 'ERROR')

    if (invalid.length > 0) {
      throw new Error(`No se pueden persistir ${invalid.length} filas con estado ERROR.`)
    }

    const completedBatch: ImportBatch = {
      ...batch,
      status: 'COMPLETED',
      processedAt: new Date().toISOString(),
      approvedRows: approved.length,
      rejectedRows: rejected.length,
    }
    await this.batchRepository.save(completedBatch)

    const previousLogs = await this.auditRepository.findByBatchId(batch.id)
    const previous = previousLogs[previousLogs.length - 1]
    if (previous) {
      await this.auditRepository.save({
        ...previous,
        approvals: approved.map((r) => String(r.rowNumber)),
        rejections: rejected.map((r) => String(r.rowNumber)),
        persistenceResult: 'success',
      })
    }

    return {
      batchId: batch.id,
      persistedRows: approved.length,
      skippedRows: rejected.length,
      persistenceResult: 'success',
    }
  }
}
