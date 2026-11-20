import type { CommitImportInput, CommitImportOutput } from '../dtos/import-dtos'
import type { CommitImportUseCase } from './commit-import-use-case'
import type { ImportBatchRepository } from '../ports/import-batch-repository'
import type { ImportAuditRepository } from '../ports/import-audit-repository'
import { InMemoryImportRowStore } from '../../infrastructure/import/batch/in-memory-row-store'
import { PersistImportUseCase } from './persist-import-use-case'
import type { IngredientRepository } from '../ports/IngredientRepository'
import type { DishRepository } from '../ports/DishRepository'
import type { DishRecipeRepository } from '../ports/DishRecipeRepository'
import type { MenuPlanRepository } from '../ports/MenuPlanRepository'
import type { MealCompositionRepository } from '../ports/MealCompositionRepository'
import type { CurrentOperatorPort } from '../ports/current-operator-port'

export class CommitImportUseCaseImpl implements CommitImportUseCase {
  private batchRepository: ImportBatchRepository
  private auditRepository: ImportAuditRepository
  private rowStore: InMemoryImportRowStore
  private persistImportUseCase: PersistImportUseCase

  constructor(
    batchRepository: ImportBatchRepository,
    auditRepository: ImportAuditRepository,
    rowStore: InMemoryImportRowStore,
    ingredientRepository: IngredientRepository,
    dishRepository: DishRepository,
    dishRecipeRepository: DishRecipeRepository,
    menuPlanRepository: MenuPlanRepository,
    mealCompositionRepository: MealCompositionRepository,
    operatorProvider: CurrentOperatorPort,
  ) {
    this.batchRepository = batchRepository
    this.auditRepository = auditRepository
    this.rowStore = rowStore
    this.persistImportUseCase = new PersistImportUseCase(
      ingredientRepository,
      dishRepository,
      dishRecipeRepository,
      menuPlanRepository,
      mealCompositionRepository,
      batchRepository,
      auditRepository,
      operatorProvider,
    )
    // auditRepository is used by persistImportUseCase
    void this.auditRepository
  }

  async execute(input: CommitImportInput): Promise<CommitImportOutput> {
    const batch = await this.batchRepository.findById(input.batchId)
    if (!batch) throw new Error(`Lote ${input.batchId} no encontrado.`)
    if (batch.status === 'COMPLETED') {
      return { batchId: batch.id, persistedRows: batch.approvedRows, skippedRows: 0, persistenceResult: 'success' }
    }
    if (batch.status !== 'ANALYZED' && batch.status !== 'APPROVED') {
      throw new Error(`El lote ${batch.id} tiene estado ${batch.status} y no puede confirmarse.`)
    }

    const rows = this.rowStore.getRows(batch.id)
    const approved = rows.filter((r) => input.approvedRowNumbers.includes(r.rowNumber))
    const rejected = rows.filter((r) => !input.approvedRowNumbers.includes(r.rowNumber))
    const invalid = approved.filter((r) => r.severity === 'ERROR')

    if (invalid.length > 0) {
      throw new Error(`No se pueden persistir ${invalid.length} filas con estado ERROR.`)
    }

    // Persist to domain tables
    const persistResult = await this.persistImportUseCase.execute({
      batchId: batch.id,
      approvedRowNumbers: input.approvedRowNumbers,
    })

    const totalPersisted = Object.values(persistResult.persistedCounts).reduce((a, b) => a + b, 0)

    return {
      batchId: batch.id,
      persistedRows: totalPersisted,
      skippedRows: rejected.length,
      persistenceResult: persistResult.errors.length > 0 ? 'partial' : 'success',
    }
  }
}