/**
 * Value Object para la identidad canónica de una semana de menú.
 *
 * La identidad única de una semana es su fecha de inicio (lunes).
 * Formato: YYYY-MM-DD (fecha calendario, sin componente de hora ni timezone).
 */

export type WeekStartDate = string

export interface WeekRange {
  readonly start: WeekStartDate
  readonly end: string // YYYY-MM-DD (viernes)
}

/**
 * Normaliza una fecha ISO (YYYY-MM-DD) al lunes de su semana.
 * La entrada puede ser cualquier día de la semana.
 * Retorna la fecha del lunes en formato YYYY-MM-DD.
 */
export function getWeekStartIsoDate(isoDate: string): string {
  const timestamp = Date.parse(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(timestamp)) {
    throw new Error(`Fecha inválida: ${isoDate}`)
  }

  const date = new Date(timestamp)
  const weekDayIndex = date.getUTCDay() // 0=Domingo, 1=Lunes, ..., 6=Sábado
  const daysSinceMonday = weekDayIndex === 0 ? 6 : weekDayIndex - 1

  const monday = new Date(timestamp - daysSinceMonday * 24 * 60 * 60 * 1000)
  return monday.toISOString().slice(0, 10)
}

/**
 * Normaliza una fecha ISO (YYYY-MM-DD) al lunes de su semana.
 * La entrada puede ser cualquier día de la semana.
 * Retorna la fecha del lunes en formato YYYY-MM-DD.
 */
export function normalizeToMonday(isoDate: string): string {
  return getWeekStartIsoDate(isoDate)
}

/**
 * Calcula la fecha de fin de semana (viernes) a partir del lunes.
 */
export function getWeekEndDate(weekStartDate: WeekStartDate): string {
  const timestamp = Date.parse(`${weekStartDate}T00:00:00Z`)
  const friday = new Date(timestamp + 4 * 24 * 60 * 60 * 1000)
  return friday.toISOString().slice(0, 10)
}

/**
 * Genera la etiqueta de rango compacta: "23 – 27 Nov"
 * No incluye el año (se asume visible en el encabezado mensual).
 */
export function getCompactRangeLabel(
  weekStartDate: WeekStartDate,
  locale = 'es-EC',
): string {
  const start = new Date(`${weekStartDate}T00:00:00Z`)
  const end = new Date(start.getTime() + 4 * 24 * 60 * 60 * 1000)

  const dayFmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    timeZone: 'UTC',
  })
  const monthShortFmt = new Intl.DateTimeFormat(locale, {
    month: 'short',
    timeZone: 'UTC',
  })

  const startDay = dayFmt.format(start)
  const endDay = dayFmt.format(end)
  const month = monthShortFmt.format(end).replace(/\./g, '')

  return `${startDay} – ${endDay} ${month}`
}

/**
 * Genera la etiqueta completa con año: "23 – 27 Nov 2026"
 */
export function getFullRangeLabel(
  weekStartDate: WeekStartDate,
  locale = 'es-EC',
): string {
  const start = new Date(`${weekStartDate}T00:00:00Z`)
  const end = new Date(start.getTime() + 4 * 24 * 60 * 60 * 1000)

  const dayFmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    timeZone: 'UTC',
  })
  const monthShortFmt = new Intl.DateTimeFormat(locale, {
    month: 'short',
    timeZone: 'UTC',
  })
  const yearFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    timeZone: 'UTC',
  })

  const startDay = dayFmt.format(start)
  const endDay = dayFmt.format(end)
  const month = monthShortFmt.format(end).replace(/\./g, '')
  const year = yearFmt.format(end)

  return `${startDay} – ${endDay} ${month} ${year}`
}

/**
 * Obtiene la etiqueta del mes/año para el encabezado: "Noviembre 2026"
 */
export function getMonthYearLabel(
  weekStartDate: WeekStartDate,
  locale = 'es-EC',
): string {
  const date = new Date(`${weekStartDate}T00:00:00Z`)
  const fmt = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return fmt.format(date).charAt(0).toUpperCase() + fmt.format(date).slice(1)
}

/**
 * Verifica si una cadena es un WeekStartDate válido (formato YYYY-MM-DD y es lunes).
 */
export function isValidWeekStartDate(value: string): value is WeekStartDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const timestamp = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(timestamp)) return false

  const date = new Date(timestamp)
  return date.getUTCDay() === 1 // 1 = Lunes
}

/**
 * Suma semanas a una fecha de inicio de semana.
 */
export function addWeeks(weekStartDate: WeekStartDate, weeks: number): WeekStartDate {
  const timestamp = Date.parse(`${weekStartDate}T00:00:00Z`)
  const result = new Date(timestamp + weeks * 7 * 24 * 60 * 60 * 1000)
  return result.toISOString().slice(0, 10) as WeekStartDate
}

/**
 * Calcula el número de semana del mes (1-5) basado en la fecha del lunes.
 * Semana 1 = días 1-7 del mes, Semana 2 = días 8-14, etc.
 */
export function getWeekOfMonth(weekStartDate: WeekStartDate): number {
  const date = new Date(`${weekStartDate}T00:00:00Z`)
  const dayOfMonth = date.getUTCDate()
  return Math.floor((dayOfMonth - 1) / 7) + 1
}

/**
 * Compara dos WeekStartDate para ordenamiento cronológico.
 */
export function compareWeekStartDate(a: WeekStartDate, b: WeekStartDate): number {
  return a.localeCompare(b)
}

/**
 * Genera la etiqueta de semana: "Semana 4"
 */
export function getWeekLabel(weekStartDate: WeekStartDate): string {
  return `Semana ${getWeekOfMonth(weekStartDate)}`
}

/**
 * Genera la etiqueta de progreso: "45/45 · Sem 4"
 */
export function getProgressLabel(
  weekStartDate: WeekStartDate,
  filled: number,
  total: number,
): string {
  return `${filled}/${total} · Sem ${getWeekOfMonth(weekStartDate)}`
}