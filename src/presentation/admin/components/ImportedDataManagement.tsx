import { useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  ChefHat,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  SearchX,
  Sparkles,
  Table,
  X,
} from 'lucide-react'
import type { Ingredient } from '../../../domain/entities/ingredient'
import type { Dish } from '../../../domain/entities/dish'
import type { DishRecipe } from '../../../domain/entities/recipe'
import type { MenuPlanCell } from '../../../domain/entities/menuPlan'
import type { MealCompositionTemplate } from '../../../domain/entities/meal-composition-template'
import type { ImportBatch, ImportStatus } from '../../../domain/entities/import-batch'
import type { ImportedRow } from '../../../domain/entities/imported-row'
import type { ImportAuditLog } from '../../../domain/entities/import-audit-log'
import {
  ingredientRepository,
  dishRepository,
  dishRecipeRepository,
  menuPlanRepository,
  mealCompositionRepository,
  importBatchRepository,
  importedRowRepository,
  importAuditRepository,
} from '../../../infrastructure/container'
import { formatCurrency } from '../../shared/utils/formatCurrency'
import { getCategoryBadgeClass } from '../utils/categoryStyles'
import { getDishCategoryBadgeClass } from '../utils/dishCategories'
import { normalizeText } from '../utils/spreadsheet'

type ImportedDataTab =
  | 'ingredients'
  | 'dishes'
  | 'recipes'
  | 'menus'
  | 'compositions'
  | 'imports'

const TABS = [
  { id: 'ingredients', label: 'Ingredientes', icon: Boxes },
  { id: 'dishes', label: 'Platos', icon: ChefHat },
  { id: 'recipes', label: 'Recetas', icon: Table },
  { id: 'menus', label: 'Menús', icon: ClipboardList },
  { id: 'compositions', label: 'Composiciones', icon: Sparkles },
  { id: 'imports', label: 'Importaciones', icon: FileText },
] as const

interface KpiCard {
  label: string
  value: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
}

interface Toast {
  tone: 'success' | 'danger' | 'info'
  message: string
}

const PAGE_SIZE = 25

function Pagination<T>({
  items,
  page,
  onPageChange,
  label,
}: {
  items: T[]
  page: number
  onPageChange: (page: number) => void
  label: string
}) {
  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  if (totalPages <= 1) return null

  return (
    <footer className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
      <span>
        Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, items.length)}–{Math.min(page * PAGE_SIZE, items.length)} de {items.length} {label}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Página anterior"
        >
          <SearchX className="size-4 rotate-180" aria-hidden="true" />
        </button>
        <span className="px-2 font-medium">{page} / {totalPages}</span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Página siguiente"
        >
          <SearchX className="size-4" aria-hidden="true" />
        </button>
      </div>
    </footer>
  )
}

function getMenuCellKey(cell: MenuPlanCell): string {
  return `${cell.weekStartDate}-${cell.day}-${cell.category}-${cell.slot}`
}

export function ImportedDataManagement() {
  const [activeTab, setActiveTab] = useState<ImportedDataTab>('ingredients')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  // Data states
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [dishes, setDishes] = useState<Dish[]>([])
  const [recipes, setRecipes] = useState<DishRecipe[]>([])
  const [menuCells, setMenuCells] = useState<MenuPlanCell[]>([])
  const [compositions, setCompositions] = useState<MealCompositionTemplate[]>([])
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([])
  const [importedRows, setImportedRows] = useState<ImportedRow[]>([])
  const [auditLogs, setAuditLogs] = useState<ImportAuditLog[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)

  // Filter states
  const [ingredientQuery, setIngredientQuery] = useState('')
  const [ingredientCategoryFilter, setIngredientCategoryFilter] = useState('all')
  const [dishQuery, setDishQuery] = useState('')
  const [dishCategoryFilter, setDishCategoryFilter] = useState<'all' | Dish['category']>('all')
  const [recipeQuery, setRecipeQuery] = useState('')
  const [recipeDishFilter, setRecipeDishFilter] = useState('all')
  const [menuQuery, setMenuQuery] = useState('')
  const [menuWeekFilter, setMenuWeekFilter] = useState('all')
  const [menuDayFilter, setMenuDayFilter] = useState<'all' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'>('all')
  const [menuServiceFilter, setMenuServiceFilter] = useState<'all' | 'lunch' | 'breakfast' | 'snack'>('all')
  const [compositionQuery, setCompositionQuery] = useState('')
  const [importQuery, setImportQuery] = useState('')
  const [importStatusFilter, setImportStatusFilter] = useState<'all' | ImportStatus>('all')

  // Pagination states
  const [ingredientPage, setIngredientPage] = useState(1)
  const [dishPage, setDishPage] = useState(1)
  const [recipePage, setRecipePage] = useState(1)
  const [menuPage, setMenuPage] = useState(1)
  const [compositionPage, setCompositionPage] = useState(1)
  const [importPage, setImportPage] = useState(1)
  const [rowPage, setRowPage] = useState(1)

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  async function loadAllData() {
    setIsLoading(true)
    setError(null)
    try {
      const [
        ingredientsData,
        dishesData,
        recipesData,
        menuCellsData,
        compositionsData,
        importBatchesData,
      ] = await Promise.all([
        ingredientRepository.listAll(),
        dishRepository.listAll(),
        dishRecipeRepository.listAll(),
        menuPlanRepository.listAll(),
        mealCompositionRepository.listAll(),
        importBatchRepository.list(),
      ])

      setIngredients(ingredientsData)
      setDishes(dishesData)
      setRecipes(recipesData)
      setMenuCells(menuCellsData)
      setCompositions(compositionsData)
      setImportBatches(importBatchesData)

      if (importBatchesData.length > 0) {
        const firstBatch = importBatchesData[0]
        setSelectedBatchId(firstBatch.id)
        await loadBatchDetails(firstBatch.id)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido al cargar datos'
      setError(message)
      setToast({ tone: 'danger', message })
    } finally {
      setIsLoading(false)
    }
  }

  async function loadBatchDetails(batchId: string) {
    try {
      const [rows, logs] = await Promise.all([
        importedRowRepository.findByBatchId(batchId),
        importAuditRepository.findByBatchId(batchId),
      ])
      setImportedRows(rows)
      setAuditLogs(logs)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar detalles del lote'
      setToast({ tone: 'danger', message })
    }
  }

  async function handleRefresh() {
    setIngredientPage(1)
    setDishPage(1)
    setRecipePage(1)
    setMenuPage(1)
    setCompositionPage(1)
    setImportPage(1)
    setRowPage(1)
    await loadAllData()
    setToast({ tone: 'success', message: 'Datos actualizados desde Supabase' })
  }

  // Load initial data
  useEffect(() => {
    loadAllData()
  }, [])

  // Load batch details when selectedBatchId changes
  useEffect(() => {
    if (selectedBatchId) {
      loadBatchDetails(selectedBatchId)
      setRowPage(1)
    }
  }, [selectedBatchId])

  // KPI Cards
  const kpis = useMemo((): KpiCard[] => [
    {
      label: 'Ingredientes activos',
      value: String(ingredients.filter(i => i.isActive && i.status === 'ACTIVO').length),
      hint: 'Productos en catálogo de costeo',
      icon: Boxes,
      iconClass: 'bg-emerald-100 text-emerald-700',
    },
    {
      label: 'Total de platos',
      value: String(dishes.filter(d => d.isActive).length),
      hint: 'Platillos en catálogo',
      icon: ChefHat,
      iconClass: 'bg-brand-100 text-brand-700',
    },
    {
      label: 'Recetas registradas',
      value: String(recipes.filter(r => r.isActive).length),
      hint: 'Platos con receta vinculada',
      icon: Table,
      iconClass: 'bg-blue-100 text-blue-700',
    },
    {
      label: 'Ingredientes pendientes',
      value: String(
        recipes
          .filter(r => r.isActive)
          .reduce((sum, r) => sum + r.ingredients.filter(i => i.isActive && !i.id.startsWith('ing-')).length, 0)
      ),
      hint: 'Ingredientes de receta sin ingredient_id',
      icon: Sparkles,
      iconClass: 'bg-amber-100 text-amber-700',
    },
    {
      label: 'Celdas de menú',
      value: String(menuCells.filter(c => c.isActive).length),
      hint: 'Asignaciones en planificación',
      icon: ClipboardList,
      iconClass: 'bg-purple-100 text-purple-700',
    },
    {
      label: 'Plantillas de composición',
      value: String(compositions.filter(c => c.isActive).length),
      hint: 'Estructuras de menú estándar',
      icon: Sparkles,
      iconClass: 'bg-indigo-100 text-indigo-700',
    },
    {
      label: 'Lotes de importación',
      value: String(importBatches.length),
      hint: 'Archivos procesados',
      icon: FileText,
      iconClass: 'bg-slate-100 text-slate-700',
    },
  ], [ingredients, dishes, recipes, menuCells, compositions, importBatches])

  // Filter helpers
  const ingredientCategories = useMemo(() =>
    Array.from(new Set(ingredients.map(i => i.category))).sort(),
    [ingredients]
  )

  const dishCategories = useMemo(() =>
    Array.from(new Set(dishes.map(d => d.category))).sort(),
    [dishes]
  )

  const recipeDishNames = useMemo(() =>
    Array.from(new Set(recipes.map(r => r.dishId))).sort(),
    [recipes]
  )

  const menuWeeks = useMemo(() =>
    Array.from(new Set(menuCells.map(c => c.weekStartDate))).sort(),
    [menuCells]
  )

  // Filter functions
  const filteredIngredients = useMemo(() =>
    ingredients.filter(ingredient => {
      const matchesCategory = ingredientCategoryFilter === 'all' || ingredient.category === ingredientCategoryFilter
      const matchesQuery = !ingredientQuery.trim() ||
        [ingredient.code, ingredient.product, ingredient.presentation, ingredient.category]
          .join(' ')
          .toLowerCase()
          .includes(ingredientQuery.trim().toLowerCase())
      return matchesCategory && matchesQuery
    }),
    [ingredients, ingredientQuery, ingredientCategoryFilter]
  )

  const filteredDishes = useMemo(() =>
    dishes.filter(dish => {
      const matchesCategory = dishCategoryFilter === 'all' || dish.category === dishCategoryFilter
      const matchesQuery = !dishQuery.trim() ||
        normalizeText(`${dish.name} ${dish.category} ${dish.description}`).includes(normalizeText(dishQuery.trim()))
      return matchesCategory && matchesQuery
    }),
    [dishes, dishQuery, dishCategoryFilter]
  )

  const filteredRecipes = useMemo(() =>
    recipes.filter(recipe => {
      const matchesDish = recipeDishFilter === 'all' || recipe.dishId === recipeDishFilter
      const matchesQuery = !recipeQuery.trim() ||
        recipe.dishId.toLowerCase().includes(recipeQuery.trim().toLowerCase())
      return matchesDish && matchesQuery
    }),
    [recipes, recipeQuery, recipeDishFilter]
  )

  const filteredMenuCells = useMemo(() =>
    menuCells.filter(cell => {
      const matchesWeek = menuWeekFilter === 'all' || cell.weekStartDate === menuWeekFilter
      const matchesDay = menuDayFilter === 'all' || cell.day === menuDayFilter
      const matchesService = menuServiceFilter === 'all' || cell.serviceType === menuServiceFilter
      const matchesQuery = !menuQuery.trim() ||
        dishes.find(d => d.id === cell.dishId)?.name.toLowerCase().includes(menuQuery.trim().toLowerCase())
      return matchesWeek && matchesDay && matchesService && matchesQuery
    }),
    [menuCells, dishes, menuQuery, menuWeekFilter, menuDayFilter, menuServiceFilter]
  )

  const filteredCompositions = useMemo(() =>
    compositions.filter(comp => {
      const matchesQuery = !compositionQuery.trim() ||
        comp.name.toLowerCase().includes(compositionQuery.trim().toLowerCase()) ||
        comp.components.some(c => c.name.toLowerCase().includes(compositionQuery.trim().toLowerCase()))
      return matchesQuery
    }),
    [compositions, compositionQuery]
  )

  const filteredImportBatches = useMemo(() =>
    importBatches.filter(batch => {
      const matchesStatus = importStatusFilter === 'all' || batch.status === importStatusFilter
      const matchesQuery = !importQuery.trim() ||
        batch.fileName.toLowerCase().includes(importQuery.trim().toLowerCase()) ||
        batch.id.toLowerCase().includes(importQuery.trim().toLowerCase())
      return matchesStatus && matchesQuery
    }),
    [importBatches, importQuery, importStatusFilter]
  )

  const filteredImportedRows = useMemo(() =>
    importedRows, // All rows for selected batch
    [importedRows]
  )

  // Render functions for each tab
  function renderIngredientsTab() {
    const pageItems = filteredIngredients.slice((ingredientPage - 1) * PAGE_SIZE, ingredientPage * PAGE_SIZE)

    if (isLoading) {
      return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <Loader2 className="size-8 animate-spin text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-900">Cargando ingredientes…</p>
          <p className="mt-1 max-w-xs text-xs text-slate-500">Consultando productos en Supabase.</p>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-red-100 text-red-500">⚠</span>
          <p className="mt-3 text-sm font-semibold text-slate-900">Error al cargar ingredientes</p>
          <p className="mt-1 max-w-xs text-xs text-red-600">{error}</p>
          <button type="button" onClick={handleRefresh} className="mt-4 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white">Reintentar</button>
        </div>
      )
    }

    if (filteredIngredients.length === 0) {
      return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Boxes className="size-6" aria-hidden="true" /></span>
          <p className="mt-3 text-sm font-semibold text-slate-900">Sin ingredientes</p>
          <p className="mt-1 max-w-xs text-xs text-slate-500">No se encontraron ingredientes con los filtros actuales.</p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Catálogo de ingredientes</h3>
            <p className="text-xs text-slate-500">{ingredients.length} productos en Supabase • {filteredIngredients.length} con filtros actuales</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative flex-1 sm:flex-none">
              <span className="sr-only">Buscar ingrediente</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input type="search" value={ingredientQuery} onChange={e => { setIngredientQuery(e.target.value); setIngredientPage(1) }} placeholder="Buscar código, producto, presentación…" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-shadow placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-64" />
            </label>
            <label className="relative">
              <span className="sr-only">Filtrar por categoría</span>
              <select value={ingredientCategoryFilter} onChange={e => { setIngredientCategoryFilter(e.target.value); setIngredientPage(1) }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-48">
                <option value="all">Todas las categorías</option>
                {ingredientCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[800px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-5 py-2.5 font-semibold">Código</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Producto</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Presentación</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Bodega</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Costo</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Costo unit. raw</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map(ingredient => (
                <tr key={ingredient.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-600">{ingredient.code}</td>
                  <td className="px-3 py-3 font-medium text-slate-800">{ingredient.product}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{ingredient.presentation}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${getCategoryBadgeClass(ingredient.category)}`}>
                      {ingredient.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{formatCurrency(ingredient.cost)}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-slate-600">{ingredient.purchaseUnitCostRaw !== undefined ? ingredient.purchaseUnitCostRaw.toFixed(6) : '—'}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${ingredient.isActive && ingredient.status === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                      {ingredient.isActive && ingredient.status === 'ACTIVO' ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination items={filteredIngredients} page={ingredientPage} onPageChange={setIngredientPage} label="productos" />
      </div>
    )
  }

  function renderDishesTab() {
    const pageItems = filteredDishes.slice((dishPage - 1) * PAGE_SIZE, dishPage * PAGE_SIZE)
    const costedDishIds = new Set(recipes.filter(r => r.isActive).map(r => r.dishId))

    if (isLoading) {
      return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <Loader2 className="size-8 animate-spin text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-900">Cargando platos…</p>
        </div>
      )
    }

    if (filteredDishes.length === 0) {
      return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><ChefHat className="size-6" aria-hidden="true" /></span>
          <p className="mt-3 text-sm font-semibold text-slate-900">Sin platos</p>
          <p className="mt-1 max-w-xs text-xs text-slate-500">No se encontraron platos con los filtros actuales.</p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Catálogo de platos</h3>
            <p className="text-xs text-slate-500">{dishes.length} platos en Supabase • {filteredDishes.length} con filtros actuales</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative flex-1 sm:flex-none">
              <span className="sr-only">Buscar plato</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input type="search" value={dishQuery} onChange={e => { setDishQuery(e.target.value); setDishPage(1) }} placeholder="Buscar plato…" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-shadow placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-64" />
            </label>
            <label className="relative">
              <span className="sr-only">Filtrar por categoría</span>
              <select value={dishCategoryFilter} onChange={e => { const v = e.target.value; setDishCategoryFilter(v === 'all' ? 'all' : v); setDishPage(1) }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-44">
                <option value="all">Todas las categorías</option>
                {dishCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-5 py-2.5 font-semibold">Plato</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Categoría</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Descripción</th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">Estado / Receta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map(dish => (
                <tr key={dish.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3 font-medium text-slate-800">
                    <span className="flex items-center gap-2">
                      {dish.name}
                      {costedDishIds.has(dish.id) && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          Con receta
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${getDishCategoryBadgeClass(dish.category)}`}>
                      {dish.category}
                    </span>
                  </td>
                  <td className="max-w-72 px-3 py-3 text-xs text-slate-500"><span className="line-clamp-1">{dish.description || '—'}</span></td>
                  <td className="px-5 py-3 text-right">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${dish.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                      {dish.isActive ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination items={filteredDishes} page={dishPage} onPageChange={setDishPage} label="platos" />
      </div>
    )
  }

  function renderRecipesTab() {
    const pageItems = filteredRecipes.slice((recipePage - 1) * PAGE_SIZE, recipePage * PAGE_SIZE)

    if (isLoading) {
      return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <Loader2 className="size-8 animate-spin text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-900">Cargando recetas…</p>
        </div>
      )
    }

    if (filteredRecipes.length === 0) {
      return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Table className="size-6" aria-hidden="true" /></span>
          <p className="mt-3 text-sm font-semibold text-slate-900">Sin recetas</p>
          <p className="mt-1 max-w-xs text-xs text-slate-500">No se encontraron recetas con los filtros actuales.</p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Recetas y ingredientes</h3>
            <p className="text-xs text-slate-500">{recipes.length} recetas en Supabase • {filteredRecipes.length} con filtros actuales</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative flex-1 sm:flex-none">
              <span className="sr-only">Buscar receta</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input type="search" value={recipeQuery} onChange={e => { setRecipeQuery(e.target.value); setRecipePage(1) }} placeholder="Buscar por plato…" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-shadow placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-64" />
            </label>
            <label className="relative">
              <span className="sr-only">Filtrar por plato</span>
              <select value={recipeDishFilter} onChange={e => { setRecipeDishFilter(e.target.value); setRecipePage(1) }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-48">
                <option value="all">Todos los platos</option>
                {recipeDishNames.map(dishId => {
                  const dish = dishes.find(d => d.id === dishId)
                  return <option key={dishId} value={dishId}>{dish?.name || dishId}</option>
                })}
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-5 py-2.5 font-semibold">Plato</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Ingrediente</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Cant. receta</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Presentación</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Precio compra</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Vinculado</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.flatMap(recipe => {
                const dish = dishes.find(d => d.id === recipe.dishId)
                return recipe.ingredients.filter(i => i.isActive).map(ing => (
                  <tr key={`${recipe.dishId}-${ing.id}`} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-medium text-slate-800">{dish?.name || recipe.dishId}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{ing.name}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">{ing.recipeQuantity} {ing.purchasePresentation.split(' ').pop() || 'u'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{ing.purchasePresentation}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{formatCurrency(ing.purchasePrice)}</td>
                    <td className="px-3 py-3">
                      {ing.id.startsWith('ing-') ? (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-amber-50 text-amber-700 ring-amber-200">Pendiente</span>
                      ) : (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-200">Vinculado</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${ing.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                        {ing.isActive ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </div>
        <Pagination items={filteredRecipes} page={recipePage} onPageChange={setRecipePage} label="recetas" />
      </div>
    )
  }

  function renderMenusTab() {
    const pageItems = filteredMenuCells.slice((menuPage - 1) * PAGE_SIZE, menuPage * PAGE_SIZE)

    if (isLoading) {
      return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <Loader2 className="size-8 animate-spin text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-900">Cargando menús…</p>
        </div>
      )
    }

    if (filteredMenuCells.length === 0) {
      return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><ClipboardList className="size-6" aria-hidden="true" /></span>
          <p className="mt-3 text-sm font-semibold text-slate-900">Sin celdas de menú</p>
          <p className="mt-1 max-w-xs text-xs text-slate-500">No se encontraron asignaciones con los filtros actuales.</p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Planificación de menús</h3>
            <p className="text-xs text-slate-500">{menuCells.length} celdas en Supabase • {filteredMenuCells.length} con filtros actuales</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative flex-1 sm:flex-none">
              <span className="sr-only">Buscar plato en menú</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input type="search" value={menuQuery} onChange={e => { setMenuQuery(e.target.value); setMenuPage(1) }} placeholder="Buscar plato…" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-shadow placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-64" />
            </label>
            <label className="relative">
              <span className="sr-only">Filtrar por semana</span>
              <select value={menuWeekFilter} onChange={e => { setMenuWeekFilter(e.target.value); setMenuPage(1) }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-44">
                <option value="all">Todas las semanas</option>
                {menuWeeks.map(week => <option key={week} value={week}>{week}</option>)}
              </select>
            </label>
            <label className="relative">
              <span className="sr-only">Filtrar por día</span>
              <select value={menuDayFilter} onChange={e => { setMenuDayFilter(e.target.value); setMenuPage(1) }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-40">
                <option value="all">Todos los días</option>
                <option value="monday">Lunes</option>
                <option value="tuesday">Martes</option>
                <option value="wednesday">Miércoles</option>
                <option value="thursday">Jueves</option>
                <option value="friday">Viernes</option>
              </select>
            </label>
            <label className="relative">
              <span className="sr-only">Filtrar por servicio</span>
              <select value={menuServiceFilter} onChange={e => { setMenuServiceFilter(e.target.value as 'all' | 'lunch' | 'breakfast' | 'snack'); setMenuPage(1) }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-36">
                <option value="all">Todos</option>
                <option value="lunch">Almuerzo</option>
                <option value="breakfast">Desayuno</option>
                <option value="snack">Refrigerio</option>
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-5 py-2.5 font-semibold">Fecha semana</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Día</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Servicio</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Categoría</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Slot</th>
                <th scope="col" className="px-5 py-2.5 font-semibold">Plato</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map(cell => {
                const dish = dishes.find(d => d.id === cell.dishId)
                return (
                  <tr key={getMenuCellKey(cell)} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{cell.weekStartDate}</td>
                    <td className="px-3 py-3 capitalize">{cell.day}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset bg-blue-50 text-blue-700 ring-blue-200">{cell.serviceType}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${getDishCategoryBadgeClass(cell.category)}`}>{cell.category}</span>
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-xs">{cell.slot}</td>
                    <td className="px-5 py-3">{dish ? (
                      <span className="font-medium text-slate-800">{dish.name}</span>
                    ) : (
                      <span className="text-red-600 font-mono text-xs">Plato no encontrado: {cell.dishId}</span>
                    )}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cell.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                        {cell.isActive ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination items={filteredMenuCells} page={menuPage} onPageChange={setMenuPage} label="celdas" />
      </div>
    )
  }

  function renderCompositionsTab() {
    const pageItems = filteredCompositions.slice((compositionPage - 1) * PAGE_SIZE, compositionPage * PAGE_SIZE)

    if (isLoading) {
      return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <Loader2 className="size-8 animate-spin text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-900">Cargando composiciones…</p>
        </div>
      )
    }

    if (filteredCompositions.length === 0) {
      return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Sparkles className="size-6" aria-hidden="true" /></span>
          <p className="mt-3 text-sm font-semibold text-slate-900">Sin plantillas de composición</p>
          <p className="mt-1 max-w-xs text-xs text-slate-500">No se encontraron plantillas con los filtros actuales.</p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Plantillas de composición de menú</h3>
            <p className="text-xs text-slate-500">{compositions.length} plantillas en Supabase • {filteredCompositions.length} con filtros actuales</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative flex-1 sm:flex-none">
              <span className="sr-only">Buscar plantilla o componente</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input type="search" value={compositionQuery} onChange={e => { setCompositionQuery(e.target.value); setCompositionPage(1) }} placeholder="Buscar plantilla o componente…" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-shadow placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-64" />
            </label>
          </div>
        </div>

        <div className="space-y-4">
          {pageItems.map(template => (
            <section key={template.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div>
                  <h4 className="font-semibold text-slate-900">{template.name}</h4>
                  <p className="text-xs text-slate-500">Servicio: {template.serviceType} • {template.components.length} componentes</p>
                </div>
                <div className="flex items-center gap-2">
                  {template.targetTotalCost && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      Objetivo: {formatCurrency(template.targetTotalCost)}
                    </span>
                  )}
                  {template.calculatedTotalCost && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                      Calculado: {formatCurrency(template.calculatedTotalCost)}
                    </span>
                  )}
                </div>
              </header>
              <div className="overflow-x-auto px-4 py-3">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                      <th scope="col" className="px-3 py-2 font-semibold">Tipo</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Componente</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Cant. estándar</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Unidad</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Costo ref.</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Provenencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {template.components.map(comp => (
                      <tr key={comp.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2">
                          <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset bg-slate-100 text-slate-700 ring-slate-200">{comp.componentType}</span>
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">{comp.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{comp.standardQuantity?.toLocaleString() ?? '—'}</td>
                        <td className="px-3 py-2">{comp.unit ?? '—'}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-800">{comp.referenceUnitCost ? formatCurrency(comp.referenceUnitCost) : '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{comp.provenance ? JSON.stringify(comp.provenance) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
        <Pagination items={filteredCompositions} page={compositionPage} onPageChange={setCompositionPage} label="plantillas" />
      </div>
    )
  }

  function renderImportsTab() {
    const pageItems = filteredImportBatches.slice((importPage - 1) * PAGE_SIZE, importPage * PAGE_SIZE)
    const rowPageItems = filteredImportedRows.slice((rowPage - 1) * PAGE_SIZE, rowPage * PAGE_SIZE)

    if (isLoading) {
      return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <Loader2 className="size-8 animate-spin text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-900">Cargando importaciones…</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Batch List */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Lotes de importación</h3>
              <p className="text-xs text-slate-500">{importBatches.length} lotes en Supabase</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="relative flex-1 sm:flex-none">
                <span className="sr-only">Buscar lote</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input type="search" value={importQuery} onChange={e => { setImportQuery(e.target.value); setImportPage(1) }} placeholder="Buscar archivo, ID, hash…" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-shadow placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-64" />
              </label>
              <label className="relative">
                <span className="sr-only">Filtrar por estado</span>
                <select value={importStatusFilter} onChange={e => { const v = e.target.value; setImportStatusFilter(v === 'all' ? 'all' : v); setImportPage(1) }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-44">
                  <option value="all">Todos los estados</option>
                  <option value="ANALYZED">Analizado</option>
                  <option value="APPROVED">Aprobado</option>
                  <option value="PROCESSING">Procesando</option>
                  <option value="COMPLETED">Completado</option>
                  <option value="FAILED">Fallido</option>
                  <option value="PARTIALLY_COMPLETED">Parcial</option>
                </select>
              </label>
            </div>
          </header>

          {filteredImportBatches.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><FileText className="size-6" aria-hidden="true" /></span>
              <p className="mt-3 text-sm font-semibold text-slate-900">Sin lotes de importación</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Archivo</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Fecha</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Estado</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Formato</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Tipo</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Total</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Válidos</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Advert.</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Errores</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Aprob.</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Rechaz.</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Persistencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageItems.map(batch => (
                    <tr key={batch.id} className={`hover:bg-slate-50/70 cursor-pointer ${selectedBatchId === batch.id ? 'bg-brand-50/50' : ''}`} onClick={() => setSelectedBatchId(batch.id)}>
                      <td className="px-5 py-3 font-medium text-slate-800 max-w-[200px] truncate" title={batch.fileName}>{batch.fileName}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-600">{batch.createdAt.split('T')[0]}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                          batch.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                          batch.status === 'FAILED' ? 'bg-rose-50 text-rose-700 ring-rose-200' :
                          batch.status === 'PROCESSING' ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                          batch.status === 'PARTIALLY_COMPLETED' ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                          'bg-blue-50 text-blue-700 ring-blue-200'
                        }`}>{batch.status}</span>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{batch.sourceFormat}</td>
                      <td className="px-3 py-3 font-mono text-xs">{batch.sourceType ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-sm">{batch.totalRows}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-sm text-emerald-700">{batch.validRows}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-sm text-amber-700">{batch.warningRows}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-sm text-rose-700">{batch.errorRows}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-sm text-emerald-700">{batch.approvedRows}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-sm text-rose-700">{batch.rejectedRows}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                          batch.provenance === 'success' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                          batch.provenance === 'partial' ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                          batch.provenance === 'failed' ? 'bg-rose-50 text-rose-700 ring-rose-200' :
                          'bg-slate-100 text-slate-500 ring-slate-200'
                        }`}>{batch.provenance ?? 'pending'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination items={filteredImportBatches} page={importPage} onPageChange={setImportPage} label="lotes" />
        </section>

        {/* Batch Details - Imported Rows */}
        {selectedBatchId && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Filas importadas</h3>
                <p className="text-xs text-slate-500">Lote: {importBatches.find(b => b.id === selectedBatchId)?.fileName ?? selectedBatchId}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                  {importedRows.filter(r => r.status === 'valid').length} válidas
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                  {importedRows.filter(r => r.status === 'warning').length} advertencias
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                  {importedRows.filter(r => r.status === 'error').length} errores
                </span>
              </div>
            </header>

            {importedRows.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center text-slate-500">
                <p>No hay filas importadas en este lote.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                      <th scope="col" className="px-3 py-2.5 font-semibold">#</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Hoja</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Tipo</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Estado</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Error</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Advertencias</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Datos clave</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rowPageItems.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.rowNumber + 1}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{row.sheetName ?? '—'}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset bg-slate-100 text-slate-700 ring-slate-200">{row.sourceType}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                            row.status === 'valid' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                            row.status === 'warning' ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                            'bg-rose-50 text-rose-700 ring-rose-200'
                          }`}>{row.status}</span>
                        </td>
                        <td className="px-5 py-2 text-xs text-rose-600 max-w-[200px] truncate" title={row.errorMessage ?? ''}>{row.errorMessage ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-amber-700 max-w-[150px] truncate" title={row.warningMessages?.join(', ') ?? ''}>{row.warningMessages?.join(', ') ?? '—'}</td>
                        <td className="px-5 py-2 text-xs text-slate-500 max-w-[300px] truncate" title={JSON.stringify(row.rawData)}>
                          {Object.entries(row.rawData).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join('; ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination items={filteredImportedRows} page={rowPage} onPageChange={setRowPage} label="filas" />
          </section>
        )}

        {/* Audit Logs */}
        {selectedBatchId && auditLogs.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Log de auditoría</h3>
                <p className="text-xs text-slate-500">{auditLogs.length} entradas</p>
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Timestamp</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Operador</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Rol</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Archivo</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Total</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Válidos</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Advert.</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Errores</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map(log => (
                    <tr key={log.batchId + log.timestamp} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-mono text-xs text-slate-600">{log.timestamp}</td>
                      <td className="px-3 py-3 font-mono text-xs">{log.operatorId.slice(0, 8)}…</td>
                      <td className="px-3 py-3 capitalize">{log.operatorRole}</td>
                      <td className="px-5 py-3 text-xs text-slate-600 max-w-[200px] truncate" title={log.fileName}>{log.fileName}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-mono text-sm">{log.totalRows}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-mono text-sm text-emerald-700">{log.validRows}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-mono text-sm text-amber-700">{log.warningRows}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-mono text-sm text-rose-700">{log.errorRows}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                          log.persistenceResult === 'success' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                          log.persistenceResult === 'partial' ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                          log.persistenceResult === 'failed' ? 'bg-rose-50 text-rose-700 ring-rose-200' :
                          'bg-slate-100 text-slate-500 ring-slate-200'
                        }`}>{log.persistenceResult}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200">
            <Database className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Datos importados</h2>
            <p className="text-xs text-slate-500">Visualización de solo lectura de los registros persistidos en Supabase.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Actualizar
          </button>
        </div>
      </header>

      {toast && (
        <div role="status" className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ring-1 ring-inset ${toast.tone === 'success' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : toast.tone === 'danger' ? 'bg-rose-50 text-rose-800 ring-rose-200' : 'bg-blue-50 text-blue-800 ring-blue-200'}`}>
          {toast.tone === 'success' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : toast.tone === 'danger' ? <X className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
          <p className="flex-1">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} aria-label="Cerrar aviso" className="rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"><X className="size-4" aria-hidden="true" /></button>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-inset ring-red-200">
          <span className="mt-0.5 size-4 shrink-0" aria-hidden="true">⚠</span>
          <p className="flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar error" className="rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"><X className="size-4" aria-hidden="true" /></button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {kpis.map(kpi => {
          const Icon = kpi.icon
          return (
            <article key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{kpi.value}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{kpi.hint}</p>
                </div>
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${kpi.iconClass}`}><Icon className="size-5" aria-hidden="true" /></span>
              </div>
            </article>
          )
        })}
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Secciones de datos importados" className="mt-5 grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = tab.id === activeTab
          return (
            <button key={tab.id} type="button" role="tab" aria-selected={isActive} onClick={() => setActiveTab(tab.id)} className={`flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${isActive ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Panels */}
      <div role="tabpanel" className="mt-5">
        {activeTab === 'ingredients' && renderIngredientsTab()}
        {activeTab === 'dishes' && renderDishesTab()}
        {activeTab === 'recipes' && renderRecipesTab()}
        {activeTab === 'menus' && renderMenusTab()}
        {activeTab === 'compositions' && renderCompositionsTab()}
        {activeTab === 'imports' && renderImportsTab()}
      </div>
    </div>
  )
}