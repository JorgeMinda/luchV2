/**
 * Repositorio en memoria para auditoría de importaciones.
 * Implementa ImportAuditRepository.
 */

import type { ImportAuditLog } from '../../../domain/entities/import-audit-log';
import type { ImportAuditRepository } from '../../../application/ports/import-audit-repository';

export class InMemoryImportAuditRepository implements ImportAuditRepository {
  private logs: ImportAuditLog[] = [];

  async save(log: ImportAuditLog): Promise<void> {
    this.logs.push(log);
  }

  async findByBatchId(batchId: string): Promise<ImportAuditLog[]> {
    return this.logs.filter((log) => log.batchId === batchId);
  }
}
