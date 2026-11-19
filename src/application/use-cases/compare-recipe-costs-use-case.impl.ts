import type {
  RecipeCostComparisonInput,
  RecipeCostComparisonOutput,
} from '../dtos/import-dtos'
import type { CompareRecipeCostsUseCase } from './compare-recipe-costs-use-case'
import type { ImportBatchRepository } from '../ports/import-batch-repository'
import type { ImportedRow } from '../../domain/entities/imported-row'
import { InMemoryImportRowStore } from '../../infrastructure/import/batch/in-memory-row-store'
import { normalizeEntityName } from '../../infrastructure/import/normalization/entity-normalizer'

function cellKey(row: ImportedRow): string {
  const name = String(row.normalizedData.nombre ?? row.normalizedData.ingrediente ?? row.originalData.nombre ?? '')
  const category = String(row.normalizedData.categoria ?? row.originalData.categoria ?? '')
  return `${normalizeEntityName(category)}|${normalizeEntityName(name)}`
}

function numericOf(row: ImportedRow, field: string): number | null {
  const value = row.normalizedData[field] ?? row.originalData[field]
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : parseFloat(String(value).replace('$', '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

export class CompareRecipeCostsUseCaseImpl implements CompareRecipeCostsUseCase {
  private batchRepository: ImportBatchRepository
  private rowStore: InMemoryImportRowStore

  constructor(batchRepository: ImportBatchRepository, rowStore: InMemoryImportRowStore) {
    this.batchRepository = batchRepository
    this.rowStore = rowStore
  }

  async execute(input: RecipeCostComparisonInput): Promise<RecipeCostComparisonOutput> {
    const batch = await this.batchRepository.findById(input.batchId)
    if (!batch) throw new Error(`Lote ${input.batchId} no encontrado.`)

    const rows = this.rowStore.getRows(input.batchId)
    const byKey = new Map<string, ImportedRow[]>()
    for (const row of rows) {
      const key = cellKey(row)
      const group = byKey.get(key) ?? []
      group.push(row)
      byKey.set(key, group)
    }

    const duplicates: RecipeCostComparisonOutput['duplicates'] = []
    for (const [key, group] of byKey) {
      if (group.length > 1) {
        duplicates.push({ rows: group, reason: `Entidad duplicada: ${key}` })
      }
    }

    const matches: RecipeCostComparisonOutput['matches'] = []
    const conflicts: RecipeCostComparisonOutput['conflicts'] = []

    for (const group of byKey.values()) {
      const csvRow = group.find((r) => r.normalizedData.__source === 'csv') ?? group[0]
      const compositionRow = group.find((r) => r.normalizedData.__source === 'composition') ?? null
      const systemRow = group.find((r) => r.normalizedData.__source === 'system') ?? null

      const discrepancies: string[] = []
      const csvCost = numericOf(csvRow, 'costo')
      const compCost = compositionRow ? numericOf(compositionRow, 'costo') : null
      const sysCost = systemRow ? numericOf(systemRow, 'costo') : null

      const costs = [csvCost, compCost, sysCost].filter((c): c is number => c !== null)
      if (costs.length > 1) {
        const max = Math.max(...costs)
        const min = Math.min(...costs)
        if (max > 0 && (max - min) / max > 0.01) {
          discrepancies.push(`Costo discrepante entre fuentes: ${costs.map((c) => `$${c.toFixed(2)}`).join(' / ')}`)
          conflicts.push({ field: 'costo', values: costs, rows: group })
        }
      }

      if (compositionRow || systemRow) {
        matches.push({ csvRow, compositionRow, systemRow, discrepancies })
      }
    }

    return { matches, duplicates, conflicts }
  }
}
