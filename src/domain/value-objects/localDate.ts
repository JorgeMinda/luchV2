/**
 * Utilidades de fecha LOCAL en formato YYYY-MM-DD.
 *
 * Nunca se usa `new Date('YYYY-MM-DD')`: esa forma se interpreta como
 * medianoche UTC y, en husos con desplazamiento negativo (Ecuador, UTC-5),
 * retrocede un día al leer el día con métodos locales.
 *
 * Todo el cálculo calendario se hace con constructores locales
 * (`new Date(year, monthIndex, day)`) para que el resultado sea el día
 * calendario correcto en la zona horaria del dispositivo.
 */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Convierte una Date a YYYY-MM-DD usando la zona horaria local. */
export function toLocalISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Fecha actual (hoy) en zona horaria local: YYYY-MM-DD. */
export function getTodayLocalISO(now: Date = new Date()): string {
  return toLocalISODate(now)
}

/** Parsea un YYYY-MM-DD a una Date a medianoche local. */
function parseLocalISODate(isoDate: string): Date {
  const match = ISO_DATE_PATTERN.exec(isoDate)
  if (!match) {
    throw new Error(`Fecha inválida: ${isoDate}`)
  }

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, monthIndex, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    throw new Error(`Fecha inválida: ${isoDate}`)
  }

  return date
}

/**
 * Devuelve el lunes (YYYY-MM-DD) de la semana que contiene a `isoDate`.
 * El cálculo es calendario puro en zona horaria local.
 */
export function toMondayISO(isoDate: string): string {
  const date = parseLocalISODate(isoDate)
  const weekDayIndex = date.getDay() // 0=Domingo, 1=Lunes, ..., 6=Sábado
  const daysSinceMonday = weekDayIndex === 0 ? 6 : weekDayIndex - 1

  date.setDate(date.getDate() - daysSinceMonday)
  return toLocalISODate(date)
}

/** Suma días calendario a un YYYY-MM-DD local. */
export function addDaysISO(isoDate: string, days: number): string {
  const date = parseLocalISODate(isoDate)
  date.setDate(date.getDate() + days)
  return toLocalISODate(date)
}
