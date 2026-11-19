import type { ImportBatch } from '../../../domain/entities/import-batch'
import type { ImportStatus } from '../../../domain/value-objects/import-status'
import type { ImportBatchRepository } from '../../../application/ports/import-batch-repository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'

/**
 * Mapea fila de BD a ImportBatch de dominio.
 */
function mapRowToImportBatch(row: {
  id: string
  file_name: string
  file_hash: string
  status: ImportStatus
  created_at: string
  processed_at: string | null
  total_rows: number
  valid_rows: number
  warning_rows: number
  error_rows: number
  approved_rows: number
  rejected_rows: number
  source_format: 'csv' | 'xlsx' | 'xls'
  encoding: string | null
  source_type: string | null
  analysis_version: string | null
  provenance: string | null
}): ImportBatch {
  return {
    id: row.id,
    fileName: row.file_name,
    fileHash: row.file_hash,
    status: row.status,
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
 * Respeta RLS por school_id (F.1).
 */
export class SupabaseImportBatchRepository
  extends SupabaseRepositoryBase
  implements ImportBatchRepository {
  constructor(client?: TypedSupabaseClient) {
    super(client)
  }

  async save(batch: ImportBatch): Promise<void> {
    const { error } = await this.client.from('import_batches').upsert(
      {
        id: batch.id,
        file_name: batch.fileName,
        file_hash: batch.fileHash,
        status: batch.status,
        created_at: batch.createdAt,
        processed_at: batch.processedAt ?? null,
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
      } as any,
      { onConflict: 'id', ignoreDuplicates: false },
    )

    if (error) this.handleError(error, 'guardar lote de importación')
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
    const { error } = await this.client
      .from('import_batches')
      .update({
        status,
        processed_at: status === 'COMPLETED' || status === 'FAILED' ? new Date().toISOString() : null,
      } as never)
      .eq('id', id)

    if (error) this.handleError(error, 'actualizar estado de lote')
  }
}