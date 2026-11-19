import type { AnalyzeImportInput, AnalyzeImportOutput } from '../dtos/import-dtos'
import type { AnalyzeImportUseCase } from './analyze-import-use-case'
import type { ImportFileReaderPort } from '../ports/import-file-reader-port'
import type { CurrentOperatorPort } from '../ports/current-operator-port'
import type { ImportBatchRepository } from '../ports/import-batch-repository'
import type { ImportAuditRepository } from '../ports/import-audit-repository'
import type { ImportBatch } from '../../domain/entities/import-batch'
import type { ImportAuditLog } from '../../domain/entities/import-audit-log'
import type { ImportedRow } from '../../domain/entities/imported-row'
import { normalizeRows, type RawRow } from '../../infrastructure/import/normalization/row-normalizer'
import { InMemoryImportRowStore } from '../../infrastructure/import/batch/in-memory-row-store'

function countsOf(rows: ImportedRow[]): { valid: number; warnings: number; errors: number } {
  return {
    valid: rows.filter((r) => r.severity === 'VALID').length,
    warnings: rows.filter((r) => r.severity === 'WARNING').length,
    errors: rows.filter((r) => r.severity === 'ERROR').length,
  }
}

export class AnalyzeImportUseCaseImpl implements AnalyzeImportUseCase {
  private fileReader: ImportFileReaderPort
  private batchRepository: ImportBatchRepository
  private auditRepository: ImportAuditRepository
  private operatorProvider: CurrentOperatorPort
  private rowStore: InMemoryImportRowStore

  constructor(
    fileReader: ImportFileReaderPort,
    batchRepository: ImportBatchRepository,
    auditRepository: ImportAuditRepository,
    operatorProvider: CurrentOperatorPort,
    rowStore: InMemoryImportRowStore,
  ) {
    this.fileReader = fileReader
    this.batchRepository = batchRepository
    this.auditRepository = auditRepository
    this.operatorProvider = operatorProvider
    this.rowStore = rowStore
  }

  async execute(input: AnalyzeImportInput): Promise<AnalyzeImportOutput> {
    const { file } = input

    const rawFile = await this.fileReader.readFile(file)
    const batchId = crypto.randomUUID()
    const fileHash = await this.hashFile(file)

    const existing = await this.batchRepository.findByHash(fileHash)
    if (existing) {
      throw new Error(`Este archivo ya fue analizado en el lote ${existing.id} (${existing.status}).`)
    }

    const firstSheetName = Object.keys(rawFile.sheets ?? {})[0] ?? file.name
    const matrix = rawFile.sheets?.[firstSheetName] ?? []
    if (matrix.length < 2) throw new Error('El archivo debe incluir encabezados y al menos una fila de datos.')

    const headers = (matrix[0] ?? []).map((cell) => String(cell ?? '').trim()).filter(Boolean)
    const rawRows: RawRow[] = matrix.slice(1).map((cells, index) => ({
      rowNumber: index + 2,
      cells: cells.map((cell) => String(cell ?? '')),
      headers,
      source: firstSheetName,
    }))

    const rows = normalizeRows(rawRows, batchId)
    this.rowStore.saveRows(batchId, rows)
    const counts = countsOf(rows)

    const batch: ImportBatch = {
      id: batchId,
      fileName: file.name,
      fileHash,
      status: 'ANALYZED',
      createdAt: new Date().toISOString(),
      totalRows: rows.length,
      validRows: counts.valid,
      warningRows: counts.warnings,
      errorRows: counts.errors,
      approvedRows: 0,
      rejectedRows: 0,
      sourceFormat: rawFile.format,
      encoding: rawFile.encoding,
    }
    await this.batchRepository.save(batch)

    const operator = this.operatorProvider.getCurrentOperator()
    const auditLog: ImportAuditLog = {
      batchId,
      operatorId: operator.id,
      operatorRole: operator.role,
      timestamp: new Date().toISOString(),
      fileName: file.name,
      fileHash,
      format: rawFile.format,
      sheetName: firstSheetName,
      totalRows: rows.length,
      validRows: counts.valid,
      warningRows: counts.warnings,
      errorRows: counts.errors,
      transformations: ['DATE_NORMALIZED', 'ENC_MOJIBAKE'],
      corrections: [],
      approvals: [],
      rejections: [],
      persistenceResult: 'pending',
    }
    await this.auditRepository.save(auditLog)

    return {
      batchId,
      rows,
      summary: {
        total: rows.length,
        valid: counts.valid,
        warnings: counts.warnings,
        errors: counts.errors,
      },
    }
  }

  private async hashFile(file: File): Promise<string> {
    const buffer = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buffer)
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }
}
