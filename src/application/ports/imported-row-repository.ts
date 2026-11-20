import type { ImportedRow } from '../../domain/entities/imported-row'

/**
 * Puerto para repositorio de filas importadas (F.3: batchId obligatorio).
 * Define el contrato para persistir y consultar filas individuales de importación.
 */
export interface ImportedRowRepository {
  /**
   * Guarda múltiples filas importadas en lote.
   */
  saveMany(rows: ImportedRow[]): Promise<void>

  /**
   * Busca todas las filas de un lote de importación.
   */
  findByBatchId(batchId: string): Promise<ImportedRow[]>

  /**
   * Busca filas de un lote filtradas por estado.
   */
  findByBatchIdAndStatus(
    batchId: string,
    status: 'valid' | 'warning' | 'error'
  ): Promise<ImportedRow[]>

  /**
   * Actualiza el estado de una fila importada.
   */
  updateStatus(
    id: string,
    status: 'valid' | 'warning' | 'error',
    errorMessage?: string,
    warningMessages?: string[]
  ): Promise<void>
}