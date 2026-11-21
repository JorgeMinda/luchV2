import { useEffect, useState } from 'react'
import {
  Boxes,
  CheckCircle2,
  Database,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import type { Ingredient } from '../../../domain/entities'
import { ingredientRepository } from '../../../infrastructure/container'
import { InventoryImportPanel } from './InventoryImportPanel'
import { InventoryTable } from './InventoryTable'

type InventorySection = 'import' | 'current'

const SECTIONS = [
  {
    id: 'import',
    label: 'Importar catálogo',
    icon: Upload,
  },
  {
    id: 'current',
    label: 'Inventario actual',
    icon: Boxes,
  },
] as const

export function InventoryManagement() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<InventorySection>('import')
  const [toast, setToast] = useState<string | null>(null)

  // Cargar ingredientes al montar el componente
  useEffect(() => {
    let mounted = true

    async function loadIngredients() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await ingredientRepository.list()
        if (mounted) {
          setIngredients(data)
        }
      } catch (err) {
        if (mounted) {
          const message =
            err instanceof Error
              ? err.message
              : 'Error desconocido al cargar el inventario'
          setError(message)
          setIngredients([])
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadIngredients()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return

    const timeout = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  async function handleImported(count: number) {
    setIsLoading(true)
    setError(null)
    try {
      const data = await ingredientRepository.list()
      setIngredients(data)
      setToast(
        `Se ${count === 1 ? 'importó 1 producto' : `importaron ${count} productos`} correctamente.`,
      )
      setActiveSection('current')
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al actualizar el inventario tras la importación'
      setError(message)
      setToast(`Error: ${message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const activeCount = ingredients.filter(
    (ingredient) => ingredient.status === 'ACTIVO',
  ).length
  const categoryCount = new Set(
    ingredients.map((ingredient) => ingredient.category),
  ).size

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
            <Boxes className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Inventario y catálogo de costeo
            </h2>
            <p className="text-xs text-slate-500">
              Importa tus productos desde CSV o Excel y mantén tus costos al
              día.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
            <Database className="size-3.5" aria-hidden="true" />
            {ingredients.length} productos
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            {activeCount} activos
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
            {categoryCount}{' '}
            {categoryCount === 1 ? 'bodega' : 'bodegas'}
          </span>
        </div>
      </header>

      {toast && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200"
        >
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <p className="flex-1">{toast}</p>
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

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-inset ring-red-200"
        >
          <span className="mt-0.5 size-4 shrink-0" aria-hidden="true">
            ⚠
          </span>
          <p className="flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Cerrar error"
            className="rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Secciones de inventario"
        className="grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"
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
        {activeSection === 'import' ? (
          <InventoryImportPanel
            ingredients={ingredients}
            onImported={handleImported}
          />
        ) : (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <Loader2 className="size-8 animate-spin text-brand-600" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-slate-900">
                  Cargando inventario…
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Consultando productos en Supabase.
                </p>
              </div>
            ) : (
              <InventoryTable ingredients={ingredients} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}