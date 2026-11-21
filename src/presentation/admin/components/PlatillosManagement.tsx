import { useEffect, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ChefHat,
  CircleDollarSign,
  ClipboardList,
  Plus,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react'
import type { Dish, DishRecipe } from '../../../domain/entities'
import { DISH_CATEGORIES } from '../../../domain/entities'
import type { DishInput } from '../../../application/ports/DishRepository'
import type { ImportDishCostsResult } from '../../../application/use-cases/ImportDishCostsUseCase'
import type { ImportMenuMatrixResult } from '../../../application/use-cases/ImportMenuMatrixUseCase'
import {
  deleteDishUseCase,
  dishRecipeRepository,
  dishRepository,
  importDishesUseCase,
  saveDishUseCase,
} from '../../../infrastructure/container'
import { sampleDishes } from '../data/sampleDishes'
import { CostImportPanel } from './CostImportPanel'
import { DeleteDishDialog } from './DeleteDishDialog'
import { DishCatalogTable } from './DishCatalogTable'
import { DishCostingModal } from './DishCostingModal'
import { DishEditorModal } from './DishEditorModal'
import { DishImportPanel } from './DishImportPanel'
import { MenuMatrixImportPanel } from './MenuMatrixImportPanel'

type PlatillosSection =
  | 'catalog'
  | 'import'
  | 'menuImport'
  | 'costImport'

interface PlatillosManagementProps {
  onMenuImported: (result: ImportMenuMatrixResult) => void
}

interface PlatillosToast {
  tone: 'success' | 'danger'
  message: string
}

const SECTIONS = [
  {
    id: 'catalog',
    label: 'Catálogo',
    icon: ClipboardList,
  },
  {
    id: 'import',
    label: 'Importar catálogo',
    icon: Upload,
  },
  {
    id: 'menuImport',
    label: 'Importar menú',
    icon: CalendarDays,
  },
  {
    id: 'costImport',
    label: 'Subir archivo de costos',
    icon: CircleDollarSign,
  },
] as const

export function PlatillosManagement({
  onMenuImported,
}: PlatillosManagementProps) {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [costedDishIds, setCostedDishIds] = useState<Set<string>>(new Set())
  const [activeSection, setActiveSection] =
    useState<PlatillosSection>('catalog')
  const [editorDish, setEditorDish] = useState<Dish | 'new' | null>(null)
  const [deletingDish, setDeletingDish] = useState<Dish | null>(null)
  const [costingDish, setCostingDish] = useState<Dish | null>(null)
  const [costingRecipe, setCostingRecipe] =
    useState<DishRecipe | null>(null)
  const [toast, setToast] = useState<PlatillosToast | null>(null)

  useEffect(() => {
    if (!toast) return

    const timeout = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  async function refreshDishes() {
    try {
      const [dishesData, recipesData] = await Promise.all([
        dishRepository.list(),
        dishRecipeRepository.list(),
      ])
      setDishes(dishesData)
      setCostedDishIds(new Set(recipesData.map((r) => r.dishId)))
    } catch {
      setToast({
        tone: 'danger',
        message: 'No se pudo cargar el catálogo de platillos.',
      })
    }
  }

  useEffect(() => {
    void refreshDishes()
  }, [])

  async function handleSaveDish(input: DishInput) {
    await saveDishUseCase.execute(input)
    await refreshDishes()
    setEditorDish(null)
    setToast({
      tone: 'success',
      message: input.id
        ? 'Platillo actualizado correctamente.'
        : 'Platillo agregado al catálogo.',
    })
  }

  async function handleDeleteDish(dish: Dish) {
    await deleteDishUseCase.execute(dish.id)
    await refreshDishes()
    setDeletingDish(null)
    setToast({
      tone: 'success',
      message: `"${dish.name}" se eliminó del catálogo y de los menús asignados.`,
    })
  }

  async function handleImported(count: number) {
    await refreshDishes()
    setActiveSection('catalog')
    setToast({
      tone: 'success',
      message: `Se ${count === 1 ? 'importó 1 platillo' : `importaron ${count} platillos`} correctamente.`,
    })
  }

  async function handleMenuImported(result: ImportMenuMatrixResult) {
    await refreshDishes()
    onMenuImported(result)
  }

  function handleCostsImported(
    result: ImportDishCostsResult,
    skippedUnassigned: number,
  ) {
    const skippedTotal = skippedUnassigned + result.skippedRecipes
    const recipesLabel =
      result.importedRecipes === 1
        ? '1 receta'
        : `${result.importedRecipes} recetas`
    const ingredientsLabel =
      result.importedIngredients === 1
        ? '1 ingrediente'
        : `${result.importedIngredients} ingredientes`

    setToast({
      tone: result.importedRecipes > 0 ? 'success' : 'danger',
      message:
        result.importedRecipes > 0
          ? `Se importaron ${recipesLabel} con ${ingredientsLabel}.${skippedTotal > 0 ? ` ${skippedTotal} ${skippedTotal === 1 ? 'receta quedó' : 'recetas quedaron'} sin asignar.` : ''}`
          : 'No se pudo importar ninguna receta. Revisa el mapeo de platillos.',
    })
  }

  async function handleOpenCosting(dish: Dish) {
    setCostingDish(dish)
    const recipes = await dishRecipeRepository.list()
    setCostingRecipe(
      recipes.find((recipe) => recipe.dishId === dish.id) ?? null,
    )
  }

  async function handleRecipeSaved(recipe: DishRecipe) {
    setCostingRecipe(recipe)
    await refreshDishes()
    setToast({
      tone: 'success',
      message: 'Los costos de la receta se actualizaron correctamente.',
    })
  }

  function closeCosting() {
    setCostingDish(null)
    setCostingRecipe(null)
  }

  async function handleLoadSamples() {
    try {
      await importDishesUseCase.execute(sampleDishes)
      await refreshDishes()
      setToast({
        tone: 'success',
        message: 'Catálogo de ejemplo cargado. Puedes editar o eliminar sus platillos.',
      })
    } catch {
      setToast({
        tone: 'danger',
        message: 'No se pudo cargar el catálogo de ejemplo.',
      })
    }
  }

  const activeCategoryCount = new Set(
    dishes.map((dish) => dish.category),
  ).size

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
            <ChefHat className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Catálogo de platillos
            </h2>
            <p className="text-xs text-slate-500">
              Todos los platos que sabe preparar el colegio, ordenados por
              categoría.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
            {dishes.length} platillos
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
            {activeCategoryCount} de {DISH_CATEGORIES.length} categorías
          </span>
          <button
            type="button"
            onClick={() => setEditorDish('new')}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-700 px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            <Plus className="size-4" aria-hidden="true" />
            Nuevo platillo
          </button>
        </div>
      </header>

      {toast && (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ring-1 ring-inset ${
            toast.tone === 'success'
              ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
              : 'bg-rose-50 text-rose-800 ring-rose-200'
          }`}
        >
          {toast.tone === 'success' ? (
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
          )}
          <p className="flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Cerrar aviso"
            className="rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Secciones del catálogo de platillos"
        className="grid gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
      >
        {SECTIONS.map((section) => {
          const Icon = section.icon
          const isActive = section.id === activeSection

          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {section.label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel">
        {activeSection === 'catalog' && (
          <DishCatalogTable
            dishes={dishes}
            costedDishIds={costedDishIds}
            onCreate={() => setEditorDish('new')}
            onEdit={setEditorDish}
            onDelete={setDeletingDish}
            onCost={handleOpenCosting}
            onImport={() => setActiveSection('import')}
            onLoadSamples={() => {
              void handleLoadSamples()
            }}
          />
        )}

        {activeSection === 'import' && (
          <DishImportPanel dishes={dishes} onImported={handleImported} />
        )}

        {activeSection === 'menuImport' && (
          <MenuMatrixImportPanel
            dishes={dishes}
            onImported={handleMenuImported}
          />
        )}

        {activeSection === 'costImport' && (
          <CostImportPanel
            dishes={dishes}
            onImported={handleCostsImported}
          />
        )}
      </div>

      {editorDish !== null && (
        <DishEditorModal
          dish={editorDish === 'new' ? null : editorDish}
          dishes={dishes}
          onClose={() => setEditorDish(null)}
          onSave={handleSaveDish}
        />
      )}

      {deletingDish && (
        <DeleteDishDialog
          dish={deletingDish}
          onClose={() => setDeletingDish(null)}
          onConfirm={handleDeleteDish}
        />
      )}

      {costingDish && (
        <DishCostingModal
          dish={costingDish}
          recipe={costingRecipe}
          onClose={closeCosting}
          onOpenImport={() => {
            closeCosting()
            setActiveSection('costImport')
          }}
          onRecipeSaved={handleRecipeSaved}
        />
      )}
    </div>
  )
}