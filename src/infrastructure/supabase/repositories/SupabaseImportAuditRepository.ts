import type { ImportAuditLog } from '../../../domain/entities/import-audit-log'
import type { ImportAuditRepository } from '../../../application/ports/import-audit-repository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import type { ImportAuditLogsRow, ImportAuditLogsInsert } from '../database.types'

/**
 * Mapea fila de BD a ImportAuditLog de dominio.
 */
function mapRowToImportAuditLog(row: ImportAuditLogsRow): ImportAuditLog {
  return {
    batchId: row.batch_id,
    operatorId: row.operator_id,
    operatorRole: row.operator_role,
    timestamp: row.timestamp,
    fileName: row.file_name,
    fileHash: row.file_hash,
    format: row.format,
    sheetName: row.sheet_name ?? undefined,
    sourceType: row.source_type as ImportAuditLog['sourceType'],
    analysisVersion: row.analysis_version ?? undefined,
    totalRows: row.total_rows,
    validRows: row.valid_rows,
    warningRows: row.warning_rows,
    errorRows: row.error_rows,
    transformations: row.transformations ?? [],
    corrections: row.corrections ?? [],
    approvals: row.approvals ?? [],
    rejections: row.rejections ?? [],
    persistenceResult: row.persistence_result,
  }
}

/**
 * Repositorio Supabase para ImportAuditLogs.
 * Single-tenant (F.1): sin school_id, RLS por auth.uid() + role.
 */
export class SupabaseImportAuditRepository
  extends SupabaseRepositoryBase
  implements ImportAuditRepository {
  constructor(client?: TypedSupabaseClient) {
    super(client)
  }

  async save(log: ImportAuditLog): Promise<void> {
    const insert: ImportAuditLogsInsert = {
      batch_id: log.batchId,
      operator_id: log.operatorId,
      operator_role: log.operatorRole,
      file_name: log.fileName,
      file_hash: log.fileHash,
      format: log.format,
      sheet_name: log.sheetName ?? null,
      source_type: log.sourceType ?? null,
      analysis_version: log.analysisVersion ?? null,
      total_rows: log.totalRows,
      valid_rows: log.validRows,
      warning_rows: log.warningRows,
      error_rows: log.errorRows,
      transformations: log.transformations,
      corrections: log.corrections,
      approvals: log.approvals,
      rejections: log.rejections,
      persistence_result: log.persistenceResult,
    }

    await this.insertOne<ImportAuditLogsRow, ImportAuditLogsInsert>('import_audit_logs', insert)
  }

  async findByBatchId(batchId: string): Promise<ImportAuditLog[]> {
    const { data, error } = await this.client
      .from('import_audit_logs')
      .select('*')
      .eq('batch_id', batchId)
      .order('timestamp', { ascending: true })

    if (error) this.handleError(error, 'buscar logs de auditoría por lote')
    return (data ?? []).map(mapRowToImportAuditLog)
  }
}