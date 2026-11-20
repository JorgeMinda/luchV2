import { AutoFillWeekUseCase } from '../application/use-cases/AutoFillWeekUseCase'
import { CheckSupabaseConnectionUseCase } from '../application/use-cases/CheckSupabaseConnectionUseCase'
import { CloneMenuWeekUseCase } from '../application/use-cases/CloneMenuWeekUseCase'
import { CommitImportUseCaseImpl } from '../application/use-cases/commit-import-use-case.impl'
import { CreateMenuWeekUseCase } from '../application/use-cases/CreateMenuWeekUseCase'
import { DeleteDishUseCase } from '../application/use-cases/DeleteDishUseCase'
import { DuplicateMenuWeekUseCase } from '../application/use-cases/DuplicateMenuWeekUseCase'
import { ImportDishCostsUseCase } from '../application/use-cases/ImportDishCostsUseCase'
import { ImportDishesUseCase } from '../application/use-cases/ImportDishesUseCase'
import { ImportIngredientsUseCase } from '../application/use-cases/ImportIngredientsUseCase'
import { ImportMenuMatrixUseCase } from '../application/use-cases/ImportMenuMatrixUseCase'
import { PersistImportUseCase } from '../application/use-cases/persist-import-use-case'
import { SaveDishRecipeUseCase } from '../application/use-cases/SaveDishRecipeUseCase'
import { SaveDishUseCase } from '../application/use-cases/SaveDishUseCase'
import { SetMenuCellUseCase } from '../application/use-cases/SetMenuCellUseCase'
import { SupabaseConnectionService } from './supabase/SupabaseConnectionService'
import { SupabaseCurrentOperator } from './supabase/SupabaseCurrentOperator'
import type { CurrentOperatorPort } from '../application/ports/current-operator-port'
import {
  SupabaseIngredientRepository,
  SupabaseDishRepository,
  SupabaseDishRecipeRepository,
  SupabaseMenuPlanRepository,
  SupabaseStudentRepository,
  SupabasePaymentRepository,
  SupabaseConsumptionRepository,
  SupabaseImportBatchRepository,
  SupabaseImportedRowRepository,
  SupabaseImportAuditRepository,
  SupabaseMealCompositionRepository,
} from './supabase/repositories'
import {
  LocalStorageDishRecipeRepository,
  LocalStorageDishRepository,
  LocalStorageIngredientRepository,
  LocalStorageMenuPlanRepository,
  LocalStorageStudentRepository,
  LocalStoragePaymentRepository,
  LocalStorageConsumptionRepository,
} from './repositories/index'
import { InMemoryImportRowStore } from './import/batch/in-memory-row-store'

/**
 * Configuración del contenedor de dependencias.
 * Permite elegir entre Supabase (producción) y LocalStorage (tests/fallback).
 */
export type RepositoryBackend = 'supabase' | 'localStorage'

let currentBackend: RepositoryBackend = 'supabase'

/**
 * Cambia el backend de repositorios.
 * Útil para tests: `setRepositoryBackend('localStorage')`.
 */
export function setRepositoryBackend(backend: RepositoryBackend): void {
  currentBackend = backend
}

/**
 * Obtiene el backend actual.
 */
export function getRepositoryBackend(): RepositoryBackend {
  return currentBackend
}

/**
 * Crea las instancias de repositorio según el backend configurado.
 */
function createRepositories() {
  if (currentBackend === 'supabase') {
    return {
      ingredientRepository: new SupabaseIngredientRepository(),
      dishRepository: new SupabaseDishRepository(),
      dishRecipeRepository: new SupabaseDishRecipeRepository(),
      menuPlanRepository: new SupabaseMenuPlanRepository(),
      studentRepository: new SupabaseStudentRepository(),
      paymentRepository: new SupabasePaymentRepository(),
      consumptionRepository: new SupabaseConsumptionRepository(),
      importBatchRepository: new SupabaseImportBatchRepository(),
      importedRowRepository: new SupabaseImportedRowRepository(),
      importAuditRepository: new SupabaseImportAuditRepository(),
      mealCompositionRepository: new SupabaseMealCompositionRepository(),
    }
  }

  // Fallback LocalStorage (para tests sin Supabase)
  return {
    ingredientRepository: new LocalStorageIngredientRepository(),
    dishRepository: new LocalStorageDishRepository(),
    dishRecipeRepository: new LocalStorageDishRecipeRepository(),
    menuPlanRepository: new LocalStorageMenuPlanRepository(),
    studentRepository: new LocalStorageStudentRepository(),
    paymentRepository: new LocalStoragePaymentRepository(),
    consumptionRepository: new LocalStorageConsumptionRepository(),
    importBatchRepository: null as any, // No implementado en LocalStorage
    importedRowRepository: null as any, // No implementado en LocalStorage
    importAuditRepository: null as any, // No implementado en LocalStorage
    mealCompositionRepository: null as any, // No implementado en LocalStorage
  }
}

// Instancias de repositorio (se crean perezosamente)
let repositories: ReturnType<typeof createRepositories> | null = null

function getRepositories() {
  if (!repositories) {
    repositories = createRepositories()
  }
  return repositories
}

// CurrentOperatorPort implementation (singleton)
let currentOperatorPortInstance: CurrentOperatorPort | null = null

function getCurrentOperatorPort(): CurrentOperatorPort {
  if (!currentOperatorPortInstance) {
    currentOperatorPortInstance = new SupabaseCurrentOperator()
  }
  return currentOperatorPortInstance
}

// Comprobación de conexión Supabase (solo lectura).
// La validación de variables de entorno es perezosa: solo ocurre al ejecutar el use case.
export const supabaseConnectionService = new SupabaseConnectionService()
export const checkSupabaseConnectionUseCase = new CheckSupabaseConnectionUseCase(
  supabaseConnectionService,
)

// Repositorios
export const ingredientRepository = getRepositories().ingredientRepository
export const dishRepository = getRepositories().dishRepository
export const dishRecipeRepository = getRepositories().dishRecipeRepository
export const menuPlanRepository = getRepositories().menuPlanRepository
export const studentRepository = getRepositories().studentRepository
export const paymentRepository = getRepositories().paymentRepository
export const consumptionRepository = getRepositories().consumptionRepository
export const importBatchRepository = getRepositories().importBatchRepository
export const importedRowRepository = getRepositories().importedRowRepository
export const importAuditRepository = getRepositories().importAuditRepository
export const mealCompositionRepository = getRepositories().mealCompositionRepository

// CurrentOperatorPort
export const currentOperatorPort = getCurrentOperatorPort()

// Use Cases - Ingredientes
export const importIngredientsUseCase = new ImportIngredientsUseCase(
  ingredientRepository,
)

// Use Cases - Platos
export const saveDishUseCase = new SaveDishUseCase(dishRepository)
export const importDishesUseCase = new ImportDishesUseCase(dishRepository)
export const importDishCostsUseCase = new ImportDishCostsUseCase(
  dishRepository,
  dishRecipeRepository,
)
export const saveDishRecipeUseCase = new SaveDishRecipeUseCase(
  dishRepository,
  dishRecipeRepository,
)
export const deleteDishUseCase = new DeleteDishUseCase(
  dishRepository,
  menuPlanRepository,
  dishRecipeRepository,
)

// Use Cases - Importación
export const persistImportUseCase = new PersistImportUseCase(
  ingredientRepository,
  dishRepository,
  dishRecipeRepository,
  menuPlanRepository,
  mealCompositionRepository,
  importBatchRepository,
  importAuditRepository,
  currentOperatorPort,
)

const rowStore = new InMemoryImportRowStore()

export const commitImportUseCase = new CommitImportUseCaseImpl(
  importBatchRepository,
  importAuditRepository,
  rowStore,
  ingredientRepository,
  dishRepository,
  dishRecipeRepository,
  menuPlanRepository,
  mealCompositionRepository,
  currentOperatorPort,
)

// Use Cases - Menú
export const createMenuWeekUseCase = new CreateMenuWeekUseCase(menuPlanRepository)
export const cloneMenuWeekUseCase = new CloneMenuWeekUseCase(menuPlanRepository)
export const duplicateMenuWeekUseCase = new DuplicateMenuWeekUseCase(menuPlanRepository)
export const setMenuCellUseCase = new SetMenuCellUseCase(menuPlanRepository)
export const autoFillWeekUseCase = new AutoFillWeekUseCase(
  dishRepository,
  menuPlanRepository,
)
export const importMenuMatrixUseCase = new ImportMenuMatrixUseCase(
  dishRepository,
  menuPlanRepository,
)