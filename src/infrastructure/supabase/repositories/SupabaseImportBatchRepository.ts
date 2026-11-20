import type { ImportBatch } from '../../../domain/entities/import-batch'
import type { ImportStatus } from '../../../domain/value-objects/import-status'
import type { ImportBatchRepository } from '../../../application/ports/import-batch-repository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import type { ImportBatchesRow, ImportBatchesInsert, ImportBatchesUpdate } from '../database.types'

// Database uses lowercase status: 'pending' | 'analyzing' | 'preview' | 'committed' | 'failed'
// Domain uses uppercase: 'ANALYZED' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIALLY_COMPLETED'

type DbImportStatus = NonNullable<ImportBatchesInsert['status']>

function toDbStatus(status: ImportStatus): DbImportStatus {
  const map: Record<ImportStatus, DbImportStatus> = {
    ANALYZED: 'committed',
    APPROVED: 'committed',
    PROCESSING: 'analyzing',
    COMPLETED: 'committed',
    FAILED: 'failed',
    PARTIALLY_COMPLETED: 'committed',
  }
  return map[status]
}

function fromDbStatus(status: DbImportStatus | null | undefined): ImportStatus {
  if (!status) return 'ANALYZED'
  const map: Record<DbImportStatus, ImportStatus> = {
    pending: 'ANALYZED',
    analyzing: 'PROCESSING',
    preview: 'ANALYZED',
    committed: 'COMPLETED',
    failed: 'FAILED',
  }
  return map[status] ?? 'ANALYZED'
}

/**
 * Mapea fila de BD a ImportBatch de dominio.
 */
function mapRowToImportBatch(row: ImportBatchesRow): ImportBatch {
  return {
    id: row.id,
    fileName: row.file_name,
    fileHash: row.file_hash,
    status: fromDbStatus(row.status),
    createdAt: row.created_at,
    processedAt: row.processed_at ?? undefined,
    totalRows: row.total_rows,
    validRows: row.valid_rows,
    warningRows: row.warning_rows,
    errorRows: row.error_rows,
    approvedRows: row.approved_rows,
    rejectedRows: row.rejected_rows,
    sourceFormat: row.source_format,
    encoding: row.encoding ?? undefined,
    sourceType: row.source_type as ImportBatch['sourceType'],
    analysisVersion: row.analysis_version ?? undefined,
    provenance: row.provenance ?? undefined,
  }
}

/**
 * Repositorio Supabase para ImportBatches.
 * Single-tenant (F.1): sin school_id, RLS por auth.uid() + role.
 */
export class SupabaseImportBatchRepository
  extends SupabaseRepositoryBase
  implements ImportBatchRepository {
  constructor(client?: TypedSupabaseClient) {
    super(client)
  }

  async save(batch: ImportBatch): Promise<void> {
    const insert: ImportBatchesInsert = {
      file_name: batch.fileName,
      file_hash: batch.fileHash,
      status: toDbStatus(batch.status),
      total_rows: batch.totalRows,
      valid_rows: batch.validRows,
      warning_rows: batch.warningRows,
      error_rows: batch.errorRows,
      approved_rows: batch.approvedRows,
      rejected_rows: batch.rejectedRows,
      source_format: batch.sourceFormat,
      encoding: batch.encoding ?? null,
      source_type: batch.sourceType ?? null,
      analysis_version: batch.analysisVersion ?? null,
      provenance: batch.provenance ?? null,
    }

    await this.upsertOne<ImportBatchesRow, ImportBatchesInsert>('import_batches', insert, { onConflict: 'file_hash', ignoreDuplicates: false })
  }

  async findById(id: string): Promise<ImportBatch | null> {
    const { data, error } = await this.client
      .from('import_batches')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) this.handleError(error, 'buscar lote por ID')
    return data ? mapRowToImportBatch(data) : null
  }

  async findByHash(hash: string): Promise<ImportBatch | null> {
    const { data, error } = await this.client
      .from('import_batches')
      .select('*')
      .eq('file_hash', hash)
      .maybeSingle()

    if (error) this.handleError(error, 'buscar lote por hash')
    return data ? mapRowToImportBatch(data) : null
  }

  async list(): Promise<ImportBatch[]> {
    const { data, error } = await this.client
      .from('import_batches')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) this.handleError(error, 'listar lotes de importación')
    return (data ?? []).map(mapRowToImportBatch)
  }

  async updateStatus(id: string, status: ImportStatus): Promise<void> {
    const update: ImportBatchesUpdate = {
      status: toDbStatus(status),
      processed_at: status === 'COMPLETED' || status === 'FAILED' ? new Date().toISOString() : null,
    }

    await this.updateRows<ImportBatchesUpdate>('import_batches', update, { id })
  }
}