import type {
  LoadHistoricalSeedInput,
  LoadHistoricalSeedOutput,
} from '../dtos/import-dtos'
import type { LoadHistoricalSeedUseCase } from './load-historical-seed-use-case'
import type { ImportBatchRepository } from '../ports/import-batch-repository'
import type { ImportBatch } from '../../domain/entities/import-batch'

export class LoadHistoricalSeedUseCaseImpl implements LoadHistoricalSeedUseCase {
  private batchRepository: ImportBatchRepository

  constructor(batchRepository: ImportBatchRepository) {
    this.batchRepository = batchRepository
  }

  async execute(input: LoadHistoricalSeedInput): Promise<LoadHistoricalSeedOutput> {
    const datasetId = `seed:${input.datasetId}:${input.version}`
    const existing = await this.batchRepository.findById(datasetId)

    if (existing) {
      return { datasetId: input.datasetId, version: input.version, rowsLoaded: existing.totalRows, idempotent: true }
    }

    const batch: ImportBatch = {
      id: datasetId,
      fileName: `${input.datasetId}@${input.version}`,
      fileHash: datasetId,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      totalRows: 0,
      validRows: 0,
      warningRows: 0,
      errorRows: 0,
      approvedRows: 0,
      rejectedRows: 0,
      sourceFormat: 'csv',
      encoding: 'UTF-8',
    }
    await this.batchRepository.save(batch)

    return { datasetId: input.datasetId, version: input.version, rowsLoaded: 0, idempotent: false }
  }
}
