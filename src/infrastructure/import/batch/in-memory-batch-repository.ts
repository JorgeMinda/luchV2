/**
 * Repositorio en memoria para lotes de importación.
 * Implementa ImportBatchRepository.
 */

import type { ImportBatch } from '../../../domain/entities/import-batch';
import type { ImportStatus } from '../../../domain/value-objects/import-status';
import type { ImportBatchRepository } from '../../../application/ports/import-batch-repository';

export class InMemoryImportBatchRepository implements ImportBatchRepository {
  private batches: Map<string, ImportBatch> = new Map();

  async save(batch: ImportBatch): Promise<void> {
    this.batches.set(batch.id, batch);
  }

  async findById(id: string): Promise<ImportBatch | null> {
    return this.batches.get(id) ?? null;
  }

  async findByHash(hash: string): Promise<ImportBatch | null> {
    for (const batch of this.batches.values()) {
      if (batch.fileHash === hash) {
        return batch;
      }
    }
    return null;
  }

  async list(): Promise<ImportBatch[]> {
    return [...this.batches.values()].sort(
      (a, b) => (b.createdAt > a.createdAt ? 1 : -1)
    );
  }

  async updateStatus(id: string, status: ImportStatus): Promise<void> {
    const batch = this.batches.get(id);
    if (!batch) {
      throw new Error(`Batch ${id} no encontrado`);
    }
    this.batches.set(id, { ...batch, status });
  }
}
