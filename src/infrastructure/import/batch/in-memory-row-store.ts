import type { ImportedRow } from '../../../domain/entities/imported-row'

export class InMemoryImportRowStore {
  private rowsByBatch: Map<string, ImportedRow[]> = new Map()

  saveRows(batchId: string, rows: ImportedRow[]): void {
    this.rowsByBatch.set(batchId, rows)
  }

  getRows(batchId: string): ImportedRow[] {
    return this.rowsByBatch.get(batchId) ?? []
  }

  updateRow(batchId: string, rowNumber: number, row: ImportedRow): void {
    const rows = this.getRows(batchId)
    const index = rows.findIndex((r) => r.rowNumber === rowNumber)
    if (index >= 0) {
      rows[index] = row
    }
  }

  clear(batchId: string): void {
    this.rowsByBatch.delete(batchId)
  }
}
