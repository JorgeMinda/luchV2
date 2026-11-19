import type {
  RevalidateImportRowInput,
  RevalidateImportRowOutput,
} from '../dtos/import-dtos'
import type { RevalidateImportRowUseCase } from './revalidate-import-row-use-case'
import type { ImportBatchRepository } from '../ports/import-batch-repository'
import { InMemoryImportRowStore } from '../../infrastructure/import/batch/in-memory-row-store'
import { normalizeRows, type RawRow } from '../../infrastructure/import/normalization/row-normalizer'

export class RevalidateImportRowUseCaseImpl implements RevalidateImportRowUseCase {
  private batchRepository: ImportBatchRepository
  private rowStore: InMemoryImportRowStore

  constructor(batchRepository: ImportBatchRepository, rowStore: InMemoryImportRowStore) {
    this.batchRepository = batchRepository
    this.rowStore = rowStore
  }

  async execute(input: RevalidateImportRowInput): Promise<RevalidateImportRowOutput> {
    const batch = await this.batchRepository.findById(input.batchId)
    if (!batch) throw new Error(`Lote ${input.batchId} no encontrado.`)

    const existing = this.rowStore.getRows(input.batchId).find((r) => r.rowNumber === input.rowNumber)
    if (!existing) throw new Error(`Fila ${input.rowNumber} no encontrada en el lote ${input.batchId}.`)

    const headers = Object.keys(existing.originalData)
    const rawRow: RawRow = {
      rowNumber: input.rowNumber,
      cells: headers.map((header) => String(input.correctedData[header] ?? '')),
      headers,
      source: 'corrección manual',
    }

    const [revalidated] = normalizeRows([rawRow], input.batchId)
    this.rowStore.updateRow(input.batchId, input.rowNumber, revalidated)

    return {
      row: revalidated,
      isValid: revalidated.severity !== 'ERROR',
    }
  }
}
