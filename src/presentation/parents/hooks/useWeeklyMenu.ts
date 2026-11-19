import { useEffect, useState } from 'react'
import type {
  DishCategory,
  MenuPlanCell,
  WeekDay,
} from '../../../domain/entities'
import { WEEK_DAYS } from '../../../domain/entities'
import {
  addDaysISO,
  getTodayLocalISO,
  toMondayISO,
} from '../../../domain/value-objects/localDate'
import {
  dishRepository,
  menuPlanRepository,
} from '../../../infrastructure/container'
import type { MenuDayView } from '../data/parentPortalData'

const DAY_LABELS: Record<WeekDay, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
}

const MONTH_LONG_FORMATTER = new Intl.DateTimeFormat('es-EC', {
  month: 'long',
})

const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat('es-EC', {
  day: 'numeric',
  month: 'long',
})

/** Convierte un YYYY-MM-DD local a Date (medianoche local). */
function toLocalDate(isoDate: string): Date {
  const [year = '1970', month = '1', day = '1'] = isoDate.split('-')
  return new Date(Number(year), Number(month) - 1, Number(day))
}

/** Etiqueta de día: "16 de noviembre". */
function formatDayMonth(isoDate: string): string {
  return DAY_MONTH_FORMATTER.format(toLocalDate(isoDate))
}

/**
 * Título del bloque: "Almuerzos del 16 al 20 de noviembre"
 * (o "del 30 de noviembre al 4 de diciembre" si cruza de mes).
 */
function formatHeading(weekStartDate: string): string {
  const end = addDaysISO(weekStartDate, 4)
  const start = toLocalDate(weekStartDate)
  const finish = toLocalDate(end)
  const sameMonth =
    start.getFullYear() === finish.getFullYear() &&
    start.getMonth() === finish.getMonth()

  if (sameMonth) {
    const day = start.getDate()
    const endDay = finish.getDate()
    const month = MONTH_LONG_FORMATTER.format(start)
    return `Almuerzos del ${day} al ${endDay} de ${month}`
  }

  const startLabel = formatDayMonth(weekStartDate)
  const endLabel = formatDayMonth(end)
  return `Almuerzos del ${startLabel} al ${endLabel}`
}

/** Rango corto del badge: "16 – 20 Nov". */
function formatShortRange(weekStartDate: string): string {
  const start = toLocalDate(weekStartDate)
  const end = toLocalDate(addDaysISO(weekStartDate, 4))
  const day = start.getDate()
  const endDay = end.getDate()
  const month = new Intl.DateTimeFormat('es-EC', {
    month: 'short',
  })
    .format(end)
    .replace(/\./g, '')

  return `${day} – ${endDay} ${month}`
}

function findDishName(
  cells: MenuPlanCell[],
  dishNames: Map<string, string>,
  category: DishCategory,
  slot: number,
): string {
  const cell = cells.find(
    (entry) => entry.category === category && entry.slot === slot,
  )
  if (!cell) return 'Por definir'
  return dishNames.get(cell.dishId) ?? 'Por definir'
}

function getWeekCells(
  weekStartDate: string,
  allCells: MenuPlanCell[],
): MenuPlanCell[] {
  return allCells.filter((cell) => cell.weekStartDate === weekStartDate)
}

export type WeeklyMenuState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'empty'
      weekStartDate: string
      heading: string
      shortRange: string
      todayISO: string
    }
  | {
      status: 'ready'
      weekStartDate: string
      heading: string
      shortRange: string
      todayISO: string
      days: MenuDayView[]
    }

export type WeeklyMenuSnapshot = Extract<
  WeeklyMenuState,
  { heading: string }
>

/**
 * Carga el menú de la semana actual (lunes de hoy, en fecha local)
 * desde MenuPlanRepository. Nunca muestra una semana pasada: la semana
 * se deriva siempre de `toMondayISO(hoy)`.
 */
export function useWeeklyMenu(): WeeklyMenuState {
  const [state, setState] = useState<WeeklyMenuState>({
    status: 'loading',
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const todayLocal = getTodayLocalISO()
        const weekStartDate = toMondayISO(todayLocal)

        const [cells, dishes] = await Promise.all([
          menuPlanRepository.list(),
          dishRepository.list(),
        ])

        if (cancelled) return

        const weekCells = getWeekCells(weekStartDate, cells)
        const heading = formatHeading(weekStartDate)
        const shortRange = formatShortRange(weekStartDate)

        if (weekCells.length === 0) {
          setState({
            status: 'empty',
            weekStartDate,
            heading,
            shortRange,
            todayISO: todayLocal,
          })
          return
        }

        const dishNames = new Map(
          dishes.map((dish) => [dish.id, dish.name]),
        )

        const days: MenuDayView[] = WEEK_DAYS.map((day, index) => {
          const isoDate = addDaysISO(weekStartDate, index)
          const dayCells = weekCells.filter(
            (cell) => cell.day === day,
          )

          return {
            day,
            dayLabel: DAY_LABELS[day],
            dateLabel: formatDayMonth(isoDate),
            mainDish: findDishName(
              dayCells,
              dishNames,
              'Proteína',
              1,
            ),
            sideDish: findDishName(dayCells, dishNames, 'Sopa', 1),
            drink: findDishName(dayCells, dishNames, 'Bebida Fría', 1),
            isToday: isoDate === todayLocal,
          }
        })

        setState({
          status: 'ready',
          weekStartDate,
          heading,
          shortRange,
          todayISO: todayLocal,
          days,
        })
      } catch {
        if (!cancelled) {
          setState({ status: 'error' })
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
