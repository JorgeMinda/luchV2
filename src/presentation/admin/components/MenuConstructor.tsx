import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Loader2,
  Plus,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import type {
  Dish,
  DishCategory,
  MenuPlanCell,
  WeekDay,
} from '../../../domain/entities'
import { MENU_SLOT_ROWS } from '../../../domain/entities'
import { findDuplicateDishIds } from '../../../domain/value-objects/menuPlan'
import type { WeekStartDate } from '../../../domain/value-objects/week'
import { getCompactRangeLabel } from '../../../domain/value-objects/week'
import {
  getTodayLocalISO,
  toLocalISODate,
  toMondayISO,
} from '../../../domain/value-objects/localDate'
import {
  autoFillWeekUseCase,
  cloneMenuWeekUseCase,
  createMenuWeekUseCase,
  dishRepository,
  duplicateMenuWeekUseCase,
  menuPlanRepository,
  setMenuCellUseCase,
} from '../../../infrastructure/container'
import { getMenuWeek, getMenuWeeks } from '../data/menuWeeks'
import { MenuWeekGrid } from './MenuWeekGrid'
import {
  MenuPlannerHeader,
  NewMenuWeekDialog,
  WeekTab,
} from './menu'

interface MenuConstructorProps {
  onOpenCatalog: () => void
}

const TOTAL_WEEK_CELLS = MENU_SLOT_ROWS.length * 5

const MONTH_LONG_FORMATTER = new Intl.DateTimeFormat('es-EC', {
  month: 'long',
  year: 'numeric',
})

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('es-EC', {
  day: 'numeric',
  month: 'short',
})

/** "2026-11" → "Noviembre 2026". */
function formatMonthLabel(monthKey: string): string {
  const [year = 1970, month = 1] = monthKey.split('-').map(Number)
  const label = MONTH_LONG_FORMATTER.format(
    new Date(year, month - 1, 1),
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** "2026-11" → mes anterior/siguiente en formato "YYYY-MM". */
function shiftMonth(monthKey: string, delta: number): string {
  const [year = 1970, month = 1] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Lunes de una fecha local YYYY-MM-DD. */
function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7)
}

/** Todos los lunes de un mes en formato YYYY-MM-DD (fecha local). */
function listMondaysOfMonth(monthKey: string): string[] {
  const [year = 1970, month = 1] = monthKey.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const mondays: string[] = []

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day)
    if (date.getDay() === 1) {
      mondays.push(toLocalISODate(date))
    }
  }

  return mondays
}

/** "2026-11-23" → "23 Nov" (fecha local). */
function formatShortDate(isoDate: string): string {
  const [year = 1970, month = 1, day = 1] = isoDate
    .split('-')
    .map(Number)
  return SHORT_DATE_FORMATTER.format(
    new Date(year, month - 1, day),
  ).replace(/\./g, '')
}

export function MenuConstructor({ onOpenCatalog }: MenuConstructorProps) {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [selections, setSelections] = useState<MenuPlanCell[]>([])
  /** Semanas creadas que todavía no tienen celdas. */
  const [extraWeekIds, setExtraWeekIds] = useState<string[]>([])
  const [activeMonth, setActiveMonth] = useState(() =>
    monthOf(getTodayLocalISO()),
  )
  const weeks = useMemo(() => {
    const ids = new Set(getMenuWeeks(selections).map((week) => week.id))
    for (const id of extraWeekIds) ids.add(id)
    return [...ids].sort().map((id) => getMenuWeek(id))
  }, [selections, extraWeekIds])
  const [activeWeekId, setActiveWeekId] = useState<string>('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isAutoFilling, setIsAutoFilling] = useState(false)
  const [autoFillNotice, setAutoFillNotice] = useState<{
    tone: 'success' | 'warning'
    message: string
  } | null>(null)
  const [isNewWeekDialogOpen, setIsNewWeekDialogOpen] = useState(false)
  const [newWeekReference, setNewWeekReference] =
    useState<WeekStartDate | null>(null)

  // Cargar datos iniciales al montar
  useEffect(() => {
    let cancelled = false
    async function loadInitialData() {
      try {
        const [dishesData, selectionsData] = await Promise.all([
          dishRepository.list(),
          menuPlanRepository.list(),
        ])
        if (!cancelled) {
          setDishes(dishesData)
          setSelections(selectionsData)
          // Si el mes actual no tiene celdas pero hay datos cargados,
          // posicionar en la última semana con registros
          const currentMonth = monthOf(getTodayLocalISO())
          const candidates = getMenuWeeks(selectionsData).filter((week) =>
            week.id.startsWith(currentMonth),
          )
          if (candidates.length === 0 && selectionsData.length > 0) {
            const allWeeks = getMenuWeeks(selectionsData)
            const lastWeek = [...allWeeks].reverse().find((week) =>
              selectionsData.some(
                (selection) => selection.weekStartDate === week.id,
              ),
            )
            if (lastWeek) {
              setActiveWeekId(lastWeek.id)
              setActiveMonth(monthOf(lastWeek.id))
            }
          } else if (candidates.length > 0) {
            const weekWithData = [...candidates]
              .reverse()
              .find((week) =>
                selectionsData.some(
                  (selection) => selection.weekStartDate === week.id,
                ),
              )
            const initialWeekId =
              weekWithData?.id ??
              candidates[0]?.id ??
              getMenuWeeks(selectionsData)[0].id
            setActiveWeekId(initialWeekId)
          }
        }
      } catch {
        // Error silencioso: las listas quedarán vacías y el usuario verá
        // los estados vacíos correspondientes
      }
    }
    void loadInitialData()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!saveError) return

    const timeout = window.setTimeout(() => setSaveError(null), 4500)
    return () => window.clearTimeout(timeout)
  }, [saveError])

  useEffect(() => {
    if (!autoFillNotice) return

    const timeout = window.setTimeout(() => setAutoFillNotice(null), 7000)
    return () => window.clearTimeout(timeout)
  }, [autoFillNotice])

  const activeWeek =
    weeks.find((week) => week.id === activeWeekId) ??
    weeks[0]

  const weekStats = useMemo(
    () =>
      new Map(
        weeks.map((week) => {
          const weekSelections = selections.filter(
            (selection) => selection.weekStartDate === week.id,
          )
          const duplicates = findDuplicateDishIds(weekSelections)
          const duplicateCells = weekSelections.filter((selection) =>
            duplicates.has(selection.dishId),
          ).length

          return [
            week.id,
            {
              filled: weekSelections.length,
              duplicateCells,
            },
          ]
        }),
      ),
    [selections, weeks],
  )

  const activeSelections = useMemo(
    () =>
      selections.filter(
        (selection) => selection.weekStartDate === activeWeek?.id,
      ),
    [selections, activeWeek?.id],
  )

  const activeStats = weekStats.get(activeWeek?.id) ?? {
    filled: 0,
    duplicateCells: 0,
  }
  const emptyCells = Math.max(0, TOTAL_WEEK_CELLS - activeStats.filled)

  async function refreshSelections() {
    setSelections(await menuPlanRepository.list())
  }

  async function handleAutoFill() {
    if (isAutoFilling) return

    setIsAutoFilling(true)
    setSaveError(null)
    setAutoFillNotice(null)

    try {
      const result = await autoFillWeekUseCase.execute(activeWeek.id)
      await refreshSelections()

      if (result.unfilled === 0) {
        setAutoFillNotice({
          tone: 'success',
          message:
            result.filled === 1
              ? 'Se rellenó 1 espacio sin repetir platillos.'
              : `Se rellenaron ${result.filled} espacios sin repetir platillos.`,
        })
        return
      }

      const shortages = result.shortages
        .map(({ category, missing }) => `${category}: ${missing}`)
        .join(' · ')
      const filledLabel =
        result.filled === 1
          ? 'Se rellenó 1 espacio'
          : `Se rellenaron ${result.filled} espacios`

      setAutoFillNotice({
        tone: 'warning',
        message: `${result.filled > 0 ? filledLabel : 'No se pudo rellenar ningún espacio'}. Faltan platillos únicos para ${result.unfilled} ${
          result.unfilled === 1 ? 'espacio' : 'espacios'
        } (${shortages}).`,
      })
    } catch {
      setSaveError(
        'No se pudo autocompletar la semana. Inténtalo de nuevo.',
      )
    } finally {
      setIsAutoFilling(false)
    }
  }

  function handleSelect(
    day: WeekDay,
    category: DishCategory,
    slot: number,
    dishId: string,
  ) {
    const weekStartDate = activeWeek.id

    setSelections((current) => {
      const next = current.filter(
        (selection) =>
          !(
            selection.weekStartDate === weekStartDate &&
            selection.day === day &&
            selection.category === category &&
            selection.slot === slot
          ),
      )

      return dishId
        ? [
            ...next,
            {
              weekStartDate,
              day,
              category,
              slot,
              dishId,
              serviceType: 'lunch' as const,
              isActive: true,
            },
          ]
        : next
    })
    setSaveError(null)

    void setMenuCellUseCase
      .execute({
        weekStartDate,
        day,
        category,
        slot,
        dishId: dishId || null,
      })
      .catch(() => {
        setSaveError(
          'No se pudo guardar la selección. Inténtalo de nuevo.',
        )
      })
  }

  function rememberWeek(weekStartDate: string) {
    setExtraWeekIds((current) =>
      current.includes(weekStartDate)
        ? current
        : [...current, weekStartDate],
    )
  }

  function activateWeek(weekStartDate: string) {
    setActiveWeekId(weekStartDate)
    setActiveMonth(monthOf(weekStartDate))
  }

  function handleToday() {
    const todayLocal = getTodayLocalISO()
    const currentMonth = monthOf(todayLocal)
    const monday = toMondayISO(todayLocal)

    setActiveMonth(currentMonth)
    if (weeks.some((week) => week.id === monday)) {
      setActiveWeekId(monday)
    }
  }

  async function handleDuplicate() {
    try {
      const result = await duplicateMenuWeekUseCase.execute({
        activeWeekStartDate: activeWeek.id,
      })
      await refreshSelections()
      rememberWeek(result.targetWeekStartDate)
      activateWeek(result.targetWeekStartDate)
      setSaveError(null)
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'No se pudo duplicar la semana. Inténtalo de nuevo.',
      )
    }
  }

  function openNewWeekDialog(reference: WeekStartDate | null) {
    setNewWeekReference(reference)
    setIsNewWeekDialogOpen(true)
  }

  async function handleCreateEmpty(weekStartDate: WeekStartDate) {
    try {
      const result = await createMenuWeekUseCase.execute({
        referenceDate: weekStartDate,
      })
      await refreshSelections()
      rememberWeek(result.weekStartDate)
      activateWeek(result.weekStartDate)
      setSaveError(null)
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'No se pudo crear la semana. Inténtalo de nuevo.',
      )
    }
  }

  async function handleCloneExisting(
    sourceWeekStartDate: WeekStartDate,
    targetWeekStartDate: WeekStartDate,
  ) {
    try {
      const result = await cloneMenuWeekUseCase.execute({
        sourceWeekStartDate,
        targetWeekStartDate,
      })
      await refreshSelections()
      rememberWeek(result.targetWeekStartDate)
      activateWeek(result.targetWeekStartDate)
      setSaveError(null)
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'No se pudo clonar la semana. Inténtalo de nuevo.',
      )
    }
  }

  /** Solo las semanas del mes activo, ordenadas por weekStartDate ASC. */
  const monthWeeks = useMemo(
    () =>
      weeks
        .filter((week) => week.id.startsWith(activeMonth))
        .sort((a, b) => a.id.localeCompare(b.id)),
    [weeks, activeMonth],
  )

  /** Semanas que existen realmente (con celdas o creadas vacías). */
  const existingWeeks = useMemo(() => {
    const ids = new Set(extraWeekIds)
    for (const selection of selections) {
      ids.add(selection.weekStartDate)
    }
    return [...ids].sort()
  }, [selections, extraWeekIds])

  /** Siguiente lunes disponible del mes activo (sin tarjeta aún). */
  const nextMondayOfMonth = useMemo(() => {
    const mondays = listMondaysOfMonth(activeMonth)
    const todayLocal = getTodayLocalISO()
    const floorISO =
      activeMonth === monthOf(todayLocal)
        ? toMondayISO(todayLocal)
        : ''
    const occupied = new Set(weeks.map((week) => week.id))

    return (
      mondays.find(
        (monday) => monday >= floorISO && !occupied.has(monday),
      ) ??
      mondays.find((monday) => !occupied.has(monday)) ??
      null
    )
  }, [activeMonth, weeks])

  const currentMonthLabel = formatMonthLabel(activeMonth)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
            <CalendarDays className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Constructor de menús
            </h2>
            <p className="text-xs text-slate-500">
              Planifica los menús por semana, categoría y día.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
            <ChefHat className="size-3.5" aria-hidden="true" />
            {dishes.length} platillos disponibles
          </span>
        </div>
      </header>

      <MenuPlannerHeader
        currentWeekStartDate={activeWeek.id}
        currentMonthLabel={currentMonthLabel}
        onPreviousMonth={() =>
          setActiveMonth((current) => shiftMonth(current, -1))
        }
        onNextMonth={() =>
          setActiveMonth((current) => shiftMonth(current, 1))
        }
        onToday={handleToday}
        onDuplicate={() => {
          void handleDuplicate()
        }}
        onNewWeek={() => openNewWeekDialog(null)}
      />

      {dishes.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-800 ring-1 ring-inset ring-sky-200">
          <p className="flex items-start gap-2">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            Aún no hay platillos en el catálogo. Agrega o importa platillos
            para poder llenar los menús.
          </p>
          <button
            type="button"
            onClick={onOpenCatalog}
            className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            Ir al catálogo
          </button>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Semanas del menú"
        className="grid grid-cols-2 gap-2 sm:grid-cols-5"
      >
        {monthWeeks.map((week) => {
          const stats = weekStats.get(week.id) ?? {
            filled: 0,
            duplicateCells: 0,
          }

          return (
            <WeekTab
              key={week.id}
              week={{
                id: week.id,
                rangeLabel: getCompactRangeLabel(week.id),
              }}
              isActive={week.id === activeWeek.id}
              filled={stats.filled}
              totalCells={TOTAL_WEEK_CELLS}
              onClick={() => setActiveWeekId(week.id)}
            />
          )
        })}

        <button
          type="button"
          onClick={() => openNewWeekDialog(nextMondayOfMonth)}
          disabled={!nextMondayOfMonth}
          className="rounded-2xl border border-dashed border-slate-300 bg-white px-3 py-2.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Plus className="size-3.5 shrink-0" aria-hidden="true" />
            Agregar semana
          </span>
          <span className="mt-1 block text-[11px] text-slate-400">
            {nextMondayOfMonth
              ? `Lun ${formatShortDate(nextMondayOfMonth)}`
              : 'Sin lunes disponible'}
          </span>
        </button>
      </div>

      {saveError && (
        <p
          role="alert"
          className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200"
        >
          {saveError}
        </p>
      )}

      {activeStats.duplicateCells > 0 && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 ring-1 ring-inset ring-amber-200"
        >
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          Hay {activeStats.duplicateCells}{' '}
          {activeStats.duplicateCells === 1 ? 'celda' : 'celdas'} con el mismo
          platillo repetido en esta semana. Revisa las celdas resaltadas en
          amarillo.
        </div>
      )}

      {monthWeeks.length === 0 && (
        <p
          role="status"
          className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500"
        >
          No hay semanas en {currentMonthLabel}. Usa «Agregar semana» para
          crear la primera.
        </p>
      )}

      {monthWeeks.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {activeWeek.label} · {activeWeek.rangeLabel}
              </h3>
              <p className="text-xs text-slate-500">
                Haz clic en una celda para elegir el platillo de esa
                categoría.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                {activeStats.filled} de {TOTAL_WEEK_CELLS} espacios
                asignados
              </span>
              <button
                type="button"
                onClick={() => {
                  void handleAutoFill()
                }}
                disabled={
                  isAutoFilling || dishes.length === 0 || emptyCells === 0
                }
                title="Rellena los espacios vacíos sin repetir platillos en la semana"
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAutoFilling ? (
                  <Loader2
                    className="size-3.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Sparkles className="size-3.5" aria-hidden="true" />
                )}
                {isAutoFilling ? 'Rellenando…' : 'Auto rellenar'}
              </button>
            </div>
          </header>

          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${
                activeStats.duplicateCells > 0
                  ? 'bg-amber-500'
                  : 'bg-brand-600'
              }`}
              style={{
                width: `${(activeStats.filled / TOTAL_WEEK_CELLS) * 100}%`,
              }}
            />
          </div>

          {autoFillNotice && (
            <p
              role="status"
              className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-medium ring-1 ring-inset ${
                autoFillNotice.tone === 'success'
                  ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                  : 'bg-amber-50 text-amber-800 ring-amber-200'
              }`}
            >
              {autoFillNotice.tone === 'success' ? (
                <CheckCircle2
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <TriangleAlert
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
              )}
              {autoFillNotice.message}
            </p>
          )}

          <div className="mt-4">
            <MenuWeekGrid
              week={activeWeek}
              dishes={dishes}
              selections={activeSelections}
              onSelect={handleSelect}
            />
          </div>

          <footer className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-amber-100 ring-1 ring-inset ring-amber-300" />
              Platillo repetido en la misma semana
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm border border-dashed border-slate-300 bg-slate-50" />
              Celda sin asignar
            </span>
          </footer>
        </section>
      )}

      <NewMenuWeekDialog
        open={isNewWeekDialogOpen}
        onClose={() => {
          setIsNewWeekDialogOpen(false)
          setNewWeekReference(null)
        }}
        onCreateEmpty={(weekStartDate) => {
          void handleCreateEmpty(weekStartDate)
        }}
        onCloneExisting={(source, target) => {
          void handleCloneExisting(source, target)
        }}
        existingWeeks={existingWeeks}
        activeWeekStartDate={activeWeek.id}
        initialReferenceDate={newWeekReference ?? undefined}
      />
    </div>
  )
}