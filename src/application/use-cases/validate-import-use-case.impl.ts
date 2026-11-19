import type { ValidateImportInput, ValidateImportOutput } from '../dtos/import-dtos'
import type { ValidateImportUseCase } from './validate-import-use-case'
import type { ImportBatchRepository } from '../ports/import-batch-repository'
import type { ImportedRow } from '../../domain/entities/imported-row'
import { InMemoryImportRowStore } from '../../infrastructure/import/batch/in-memory-row-store'

function countsOf(rows: ImportedRow[]): { valid: number; warnings: number; errors: number } {
  return {
    valid: rows.filter((r) => r.severity === 'VALID').length,
    warnings: rows.filter((r) => r.severity === 'WARNING').length,
    errors: rows.filter((r) => r.severity === 'ERROR').length,
  }
}

export class ValidateImportUseCaseImpl implements ValidateImportUseCase {
  private batchRepository: ImportBatchRepository
  private rowStore: InMemoryImportRowStore

  constructor(batchRepository: ImportBatchRepository, rowStore: InMemoryImportRowStore) {
    this.batchRepository = batchRepository
    this.rowStore = rowStore
  }

  async execute(input: ValidateImportInput): Promise<ValidateImportOutput> {
    const batch = await this.batchRepository.findById(input.batchId)
    if (!batch) throw new Error(`Lote ${input.batchId} no encontrado.`)

    const allRows = this.rowStore.getRows(input.batchId)
    const validatedRows = input.rowNumbers.length === 0
      ? allRows
      : allRows.filter((row) => input.rowNumbers.includes(row.rowNumber))

    const counts = countsOf(validatedRows)
    return {
      batchId: input.batchId,
      validatedRows,
      summary: {
        total: validatedRows.length,
        valid: counts.valid,
        warnings: counts.warnings,
        errors: counts.errors,
      },
    }
  }
}
