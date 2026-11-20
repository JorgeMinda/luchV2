import type { ImportedRow } from '../../../domain/entities/imported-row'
import type { ImportedRowRepository } from '../../../application/ports/imported-row-repository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import type { ImportedRowsRow, ImportedRowsInsert, ImportedRowsUpdate } from '../database.types'
import type { Json } from '../json'

/**
 * Mapea fila de BD a ImportedRow de dominio.
 */
function mapRowToImportedRow(row: ImportedRowsRow): ImportedRow {
  const status = row.status
  const severityMap: Record<typeof status, ImportedRow['severity']> = {
    valid: 'VALID',
    warning: 'WARNING',
    error: 'ERROR',
  }

  return {
    id: row.id,
    batchId: row.batch_id,
    rowIndex: row.row_index,
    rowNumber: row.row_index, // Alias
    sheetName: row.sheet_name ?? undefined,
    sourceType: row.source_type as ImportedRow['sourceType'],
    rawData: row.raw_data as Record<string, unknown>,
    originalData: row.raw_data as Record<string, unknown>, // Alias
    normalizedData: row.normalized_data as Record<string, unknown> | undefined,
    status: row.status,
    severity: severityMap[status], // Alias
    errorMessage: row.error_message ?? undefined,
    warningMessages: row.warning_messages ?? [],
    incidents: undefined,
    entityType: undefined,
    provenance: undefined,
    analysisVersion: undefined,
    createdAt: row.created_at,
  }
}

/**
 * Repositorio Supabase para ImportedRows (F.3: batchId obligatorio).
 * Single-tenant (F.1): sin school_id, RLS por auth.uid() + role.
 */
export class SupabaseImportedRowRepository
  extends SupabaseRepositoryBase
  implements ImportedRowRepository {
  constructor(client?: TypedSupabaseClient) {
    super(client)
  }

  async saveMany(rows: ImportedRow[]): Promise<void> {
    if (rows.length === 0) return

    const dbRows: ImportedRowsInsert[] = rows.map((row) => ({
      id: row.id,
      batch_id: row.batchId,
      row_index: row.rowIndex,
      sheet_name: row.sheetName ?? null,
      source_type: row.sourceType,
      raw_data: row.rawData as Json,
      normalized_data: row.normalizedData as Json | null,
      status: row.status,
      error_message: row.errorMessage ?? null,
      warning_messages: row.warningMessages ?? null,
      created_at: row.createdAt,
    }))

    await this.upsertMany<ImportedRowsRow, ImportedRowsInsert>(
      'imported_rows',
      dbRows,
      { onConflict: 'batch_id,row_index', ignoreDuplicates: false }
    )
  }

  async findByBatchId(batchId: string): Promise<ImportedRow[]> {
    const { data, error } = await this.client
      .from('imported_rows')
      .select('*')
      .eq('batch_id', batchId)
      .order('row_index', { ascending: true })

    if (error) this.handleError(error, 'buscar filas importadas por lote')
    return (data ?? []).map(mapRowToImportedRow)
  }

  async findByBatchIdAndStatus(batchId: string, status: 'valid' | 'warning' | 'error'): Promise<ImportedRow[]> {
    const { data, error } = await this.client
      .from('imported_rows')
      .select('*')
      .eq('batch_id', batchId)
      .eq('status', status)
      .order('row_index', { ascending: true })

    if (error) this.handleError(error, 'buscar filas importadas por lote y estado')
    return (data ?? []).map(mapRowToImportedRow)
  }

  async updateStatus(id: string, status: 'valid' | 'warning' | 'error', errorMessage?: string, warningMessages?: string[]): Promise<void> {
    const update: ImportedRowsUpdate = {
      status,
      error_message: errorMessage ?? null,
      warning_messages: warningMessages ?? null,
    }

    await this.updateRows<ImportedRowsUpdate>('imported_rows', update, { id })
  }
}