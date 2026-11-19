/**
 * Parser de MENU_PLAN (hojas `MENÚ AGSTO-JULIO2026-2027` y `MENU REFRIGERIOS`).
 *
 * Estructura real:
 *   - Filas de título (ej. `MENÚ DE AGOSTO 2026`).
 *   - Bloques semanales: fila `SEMANA N` (o `OPCION PLATO` en refrigerios),
 *     fila de fechas, filas de categorías.
 *   - Categorías: SOPA, PROTEINA, GUARNICION, ENSALADA, BEBIDA FRIA, POSTRE,
 *     FRUTA, ENTRADA, BEBIDA.
 *
 * Reglas:
 *   - Las celdas `#REF!` (≈884 en el menú anual desde la fila 173) generan
 *     registros ERROR con ubicación y valor original, y NO bloquean el
 *     procesamiento de filas válidas ni de otras secciones.
 *   - Fechas seriales de Excel y fechas texto (M/D/YYYY y D/M/YYYY) con
 *     resolución por contexto; las ambiguas sin contexto se bloquean con ERROR.
 *   - No se inventan menús, fechas ni categorías para completar datos faltantes.
 *   - weekStartDate siempre corresponde al lunes (fecha local YYYY-MM-DD).
 */

import type { ImportIncident } from '../../../domain/value-objects/incident'
import type { RawCell } from '../../../application/ports/import-file-reader-port'
import {
  aggregateSeverity,
  canonicalText,
  cellText,
  incidentOf,
  isFormulaErrorCell,
  rawCell,
  type ParserContext,
} from './parser-common'
import { deduceDateFormat, parseDateWithContext, parseExcelSerialDate } from '../normalization/date-normalizer'

export const MENU_CATEGORIES = [
  'SOPA',
  'PROTEINA',
  'GUARNICION',
  'ENSALADA',
  'BEBIDA FRIA',
  'POSTRE',
  'FRUTA',
  'ENTRADA',
  'BEBIDA',
] as const

export type MenuCategory = (typeof MENU_CATEGORIES)[number]

export interface MenuDateCell {
  readonly column: number
  readonly columnLetter: string
  readonly original: unknown
  readonly cellType: 'date' | 'number' | 'string' | 'empty' | 'error' | 'boolean'
  /** ISO 8601 (YYYY-MM-DD) cuando la fecha pudo normalizarse de forma segura. */
  readonly normalized?: string
  readonly format?: string
}

export interface MenuEntry {
  readonly rowNumber: number
  readonly category: MenuCategory
  readonly column: number
  readonly columnLetter: string
  readonly dish?: string
  readonly originalValue: unknown
  readonly hasError: boolean
}

export interface MenuWeekBlock {
  readonly weekLabel: string
  readonly labelRow: number
  readonly weekStartDate: string // YYYY-MM-DD (lunes local)
  readonly dates: readonly MenuDateCell[]
  readonly entries: readonly MenuEntry[]
}

export interface MenuPlanParseResult {
  readonly weeks: readonly MenuWeekBlock[]
  readonly incidents: readonly ImportIncident[]
  readonly severity: 'VALID' | 'WARNING' | 'ERROR'
  readonly stats: {
    readonly totalRows: number
    readonly weekBlocks: number
    readonly dateCells: number
    readonly normalizedDates: number
    readonly entries: number
    readonly formulaErrorCells: number
  }
}

function columnLetter(index: number): string {
  let letter = ''
  let n = index
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter
    n = Math.floor(n / 26) - 1
  }
  return letter
}

function isDateLikeCell(cell: RawCell | undefined): boolean {
  if (!cell) return false
  if (cell.type === 'date') return true
  if (cell.type === 'number') return true // serial de Excel, verificado al parsear
  if (cell.type === 'string') {
    return /^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}$/.test(String(cell.value ?? '').trim())
  }
  return false
}

function dateLikeCount(row: readonly RawCell[]): number {
  return row.slice(1).filter(isDateLikeCell).length
}

function isDateHeaderRow(row: readonly RawCell[]): boolean {
  const label = canonicalText(cellText(row, 0))
  if (label === 'opcion plato') return true
  return dateLikeCount(row) >= 2
}

function isCategoryRow(row: readonly RawCell[]): boolean {
  const label = canonicalText(cellText(row, 0)).replace(/\s+/g, ' ')
  return (MENU_CATEGORIES as readonly string[]).includes(label)
}

function extractWeekNumber(text: string): number | null {
  const match = text.match(/semana\s+(\d+)/i)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Normaliza una fecha a YYYY-MM-DD en zona horaria local (Ecuador UTC-5).
 * Evita desfases por UTC al usar getFullYear/getMonth/getDate en lugar de UTC.
 */
function normalizeToLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseDateCell(
  cell: RawCell,
  context: ParserContext,
  rowNumber: number,
  dateFormat: 'M/D/YYYY' | 'D/M/YYYY' | 'DD-MM-YYYY' | null,
): { normalized?: string; format?: string; incident?: ImportIncident } {
  if (cell.type === 'date' && cell.value instanceof Date) {
    return {
      normalized: normalizeToLocalDate(cell.value),
      format: 'Excel date',
    }
  }

  if (cell.type === 'number') {
    try {
      const parsed = parseExcelSerialDate(cell.value as number)
      // parseExcelSerialDate devuelve fecha en zona local
      return { normalized: parsed.normalized, format: parsed.format }
    } catch (error) {
      return {
        incident: incidentOf(context, {
          code: 'MENU_DATE_SERIAL_INVALID',
          field: 'Fecha',
          originalValue: cell.value,
          severity: 'ERROR',
          description: `La fecha serial ${String(cell.value)} (fila ${rowNumber}) no puede interpretarse de forma segura.`,
          recommendedAction: 'Revise la fecha en el archivo original.',
          rowNumber,
          column: 'Fecha',
          context: 'Parseo de fechas seriales de Excel',
        }),
      }
    }
  }

  const text = String(cell.value ?? '').trim()
  if (text === '') return {}

  try {
    const parsed = parseDateWithContext(
      text,
      dateFormat ? { format: dateFormat } : undefined,
    )
    return { normalized: parsed.normalized, format: parsed.format }
  } catch (error) {
    const ambiguous = String(error).includes('ambigua')
    return {
      incident: incidentOf(context, {
        code: ambiguous ? 'MENU_DATE_AMBIGUOUS' : 'MENU_DATE_UNPARSABLE',
        field: 'Fecha',
        originalValue: text,
        severity: 'ERROR',
        description: `La fecha '${text}' (fila ${rowNumber}) no puede normalizarse de forma segura${ambiguous ? ' (ambigua sin contexto suficiente)' : ''}.`,
        recommendedAction: 'Corrija la fecha en el archivo original o use formato YYYY-MM-DD.',
        rowNumber,
        column: 'Fecha',
        context: 'Parseo de fechas del menú',
      }),
    }
  }
}

/**
 * Detecta si una fila es una etiqueta de semana válida (SEMANA N u OPCION PLATO)
 * que inicia un nuevo bloque semanal.
 */
function isWeekLabelRow(row: readonly RawCell[]): boolean {
  const label = canonicalText(cellText(row, 0))
  return label.startsWith('semana') || label === 'opcion plato'
}

export function parseMenuPlanSheet(
  rows: readonly (readonly RawCell[])[],
  context: ParserContext,
): MenuPlanParseResult {
  const incidents: ImportIncident[] = []

  // Recolecta todas las fechas texto de la hoja para deducir el formato por
  // contexto (fechas no ambiguas fijan el criterio del archivo).
  const textualDates: string[] = []
  for (const row of rows) {
    for (const cell of row) {
      if (cell.type === 'string' && isDateLikeCell(cell)) {
        textualDates.push(String(cell.value ?? '').trim())
      }
    }
  }
  const dateFormat = deduceDateFormat(textualDates)

  const weeks: MenuWeekBlock[] = []
  const stats = {
    totalRows: rows.length,
    weekBlocks: 0,
    dateCells: 0,
    normalizedDates: 0,
    entries: 0,
    formulaErrorCells: 0,
  }

  let currentWeek: {
    weekLabel: string
    labelRow: number
    weekStartDate: string
    dates: MenuDateCell[]
    entries: MenuEntry[]
  } | null = null

  const closeWeek = () => {
    if (!currentWeek) return
    weeks.push({
      weekLabel: currentWeek.weekLabel,
      labelRow: currentWeek.labelRow,
      weekStartDate: currentWeek.weekStartDate,
      dates: currentWeek.dates,
      entries: currentWeek.entries,
    })
    currentWeek = null
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    const rowNumber = rowIndex + 1

    // Errores de fórmula en cualquier celda de la hoja: ERROR con ubicación.
    for (let col = 0; col < row.length; col++) {
      const cell = row[col]
      if (isFormulaErrorCell(cell)) {
        stats.formulaErrorCells += 1
        incidents.push(
          incidentOf(context, {
            code: 'MENU_FORMULA_ERROR',
            field: columnLetter(col),
            originalValue: cell.value,
            severity: 'ERROR',
            description: `La celda (fila ${rowNumber}, columna ${columnLetter(col)}) contiene '${String(cell.value)}' (referencia externa rota). No se convirtió en vacío ni en cero.`,
            recommendedAction: 'Restaure la referencia en el archivo original o complete el valor manualmente.',
            rowNumber,
            column: columnLetter(col),
            context: 'Parseo del plan de menú',
          }),
        )
      }
    }

    const label = cellText(row, 0)
    const isWeekLike = isWeekLabelRow(row)
    const hasDates = dateLikeCount(row) >= 2

    if (isWeekLike && !hasDates) {
      // Fila de etiqueta de semana sin fechas (ej. "SEMANA 1" sola)
      if (currentWeek === null) {
        currentWeek = {
          weekLabel: label,
          labelRow: rowNumber,
          weekStartDate: '',
          dates: [],
          entries: [],
        }
      } else if (currentWeek.dates.length === 0 && currentWeek.entries.length === 0) {
        // Refinamiento de la etiqueta del mismo bloque semanal.
        currentWeek.weekLabel = label
      } else {
        closeWeek()
        currentWeek = {
          weekLabel: label,
          labelRow: rowNumber,
          weekStartDate: '',
          dates: [],
          entries: [],
        }
      }
      continue
    }

    if (currentWeek === null) {
      // Si es una etiqueta de semana con fechas y no hay semana abierta,
      // abrimos una nueva (caso: primera fila OPCION PLATO con fechas).
      if (isWeekLike && hasDates) {
        currentWeek = {
          weekLabel: label,
          labelRow: rowNumber,
          weekStartDate: '',
          dates: [],
          entries: [],
        }
      } else {
        continue // filas de título u otras sin bloque semanal abierto
      }
    }

    if (isWeekLike || isDateHeaderRow(row)) {
      // Si es una etiqueta de semana (semana N) con fechas y el número de semana
      // cambia, cerramos la semana actual y abrimos una nueva.
      if (isWeekLike) {
        const newWeekNum = extractWeekNumber(label)
        const currentWeekNum = extractWeekNumber(currentWeek.weekLabel)
        if (newWeekNum !== null && currentWeekNum !== null && newWeekNum !== currentWeekNum) {
          closeWeek()
          currentWeek = {
            weekLabel: label,
            labelRow: rowNumber,
            weekStartDate: '',
            dates: [],
            entries: [],
          }
        }
      }

      // Parsear fila de fechas
      const dateCells: MenuDateCell[] = []
      for (let col = 1; col < row.length; col++) {
        const cell = row[col]
        if (!cell || cell.type === 'empty') continue
        if (isFormulaErrorCell(cell)) continue // ya registrada arriba
        stats.dateCells += 1
        const parsed = parseDateCell(cell, context, rowNumber, dateFormat?.format ?? null)
        if (parsed.normalized) stats.normalizedDates += 1
        if (parsed.incident) incidents.push(parsed.incident)
        dateCells.push({
          column: col,
          columnLetter: columnLetter(col),
          original: cell.value,
          cellType: cell.type,
          normalized: parsed.normalized,
          format: parsed.format,
        })
      }

      // Determinar weekStartDate: el lunes de las fechas parseadas (columna B típicamente)
      if (dateCells.length > 0) {
        const mondayCell = dateCells.find(d => d.column === 1) || dateCells[0]
        if (mondayCell.normalized) {
          currentWeek.weekStartDate = mondayCell.normalized
        }
      }

      currentWeek.dates.push(...dateCells)
      continue
    }

    if (isCategoryRow(row)) {
      const category = canonicalText(cellText(row, 0)).replace(/\s+/g, ' ') as MenuCategory
      for (let col = 1; col < row.length; col++) {
        const cell = rawCell(row, col)
        if (!cell || cell.type === 'empty') continue
        if (isFormulaErrorCell(cell)) continue // ya registrada arriba
        const dish = cellText(row, col)
        if (dish === '') continue
        stats.entries += 1
        currentWeek.entries.push({
          rowNumber,
          category,
          column: col,
          columnLetter: columnLetter(col),
          dish,
          originalValue: cell.value,
          hasError: false,
        })
      }
      continue
    }
  }

  closeWeek()

  stats.weekBlocks = weeks.length

  return {
    weeks,
    incidents,
    severity: aggregateSeverity(incidents),
    stats,
  }
}