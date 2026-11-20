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
 *   - Tres variantes de header en refrigerios:
 *     1. "OPCION PLATO" en col A + fechas en B:F + categorías FRUTA, BEBIDA, ENTRADA
 *     2. Col A vacía + fechas en B:F + categorías PROTEÍNA, ENSALADA, FRUTA, JUGO
 *     3. "DÍAS" en col A + fechas en B:F + categorías PROTEÍNA, ENSALADA, FRUTA, JUGO + FERIADO
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
  'sopa',
  'proteina',
  'guarnicion',
  'ensalada',
  'bebida fria',
  'postre',
  'fruta',
  'entrada',
  'bebida',
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
  readonly originalCategory: string
  readonly column: number
  readonly columnLetter: string
  readonly dayIndex: number // 0=Lunes, 1=Martes, ..., 4=Viernes
  readonly serviceDate: string // YYYY-MM-DD
  readonly dish?: string
  readonly originalValue: unknown
  readonly hasError: boolean
  /** Trazabilidad F.7 */
  readonly sourceCell?: string
  readonly sourceSheet?: string
  readonly sourceFile?: string
  readonly sourceFormula?: string
}

export interface MenuWeekBlock {
  readonly weekLabel: string
  readonly labelRow: number
  readonly weekStartDate: string // YYYY-MM-DD (lunes local)
  readonly dates: readonly MenuDateCell[]
  readonly entries: readonly MenuEntry[]
  readonly headerType: 'semana' | 'opcion_plato' | 'date_only' | 'dias'
  readonly feriadoDates: readonly string[] // Fechas marcadas como feriado
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
    readonly physicalBlocks: number
    readonly calendarWeeks: number
    readonly businessDays: number
    readonly feriadoDays: number
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

/** Detecta fila "DÍAS" (tramo 3 refrigerios) */
function isDiasRow(row: readonly RawCell[]): boolean {
  const label = canonicalText(cellText(row, 0))
  return label === 'dias' || label === 'días'
}

/** Detecta fila de aviso FERIADO */
function isFeriadoRow(row: readonly RawCell[]): boolean {
  const label = canonicalText(cellText(row, 0))
  return label === 'feriado'
}

/** Detecta fila de fechas: B:F tienen fechas válidas (independiente de columna A) */
function detectDateHeaderRow(row: readonly RawCell[]): { hasDates: boolean; dates: MenuDateCell[] } {
  const dateCells: MenuDateCell[] = []
  for (let col = 1; col <= 5; col++) { // Columnas B-F (índices 1-5)
    const cell = row[col]
    if (cell && cell.type !== 'empty' && isDateLikeCell(cell)) {
      dateCells.push({
        column: col,
        columnLetter: columnLetter(col),
        original: cell.value,
        cellType: cell.type,
        normalized: undefined,
        format: undefined,
      })
    }
  }
  return { hasDates: dateCells.length >= 2, dates: dateCells }
}

function detectCategoryRow(row: readonly RawCell[]): { isCategory: boolean; category: string } {
  const label = canonicalText(cellText(row, 0)).replace(/\s+/g, ' ')
  const matched = (MENU_CATEGORIES as readonly string[]).find(c => c === label)
  return { isCategory: !!matched, category: matched || label }
}

/**
 * Obtiene el lunes de la semana para una fecha dada (YYYY-MM-DD)
 */
function getMondayOf(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const dayOfWeek = date.getDay() // 0=Dom, 1=Lun, ..., 6=Sáb
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Lunes = 1
  date.setDate(date.getDate() + diff)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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
      return { normalized: parsed.normalized, format: parsed.format }
    } catch (error) {
      return {
        incident: incidentOf(context, {
          code: 'MENU_DATE_SERIAL_INVALID',
          field: 'Fecha',
          originalValue: cell.value,
          severity: 'ERROR',
          description: `La fecha serial ${String(cell.value)} (fila ${rowNumber}) no puede interpretarse de forma segura (${error instanceof Error ? error.message : 'serial inválido'}).`,
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

export function parseMenuPlanSheet(
  rows: readonly (readonly RawCell[])[],
  context: ParserContext,
): MenuPlanParseResult {
  const incidents: ImportIncident[] = []

  // Recolecta todas las fechas texto de la hoja para deducir el formato por contexto
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
    physicalBlocks: 0,
    calendarWeeks: 0,
    businessDays: 0,
    feriadoDays: 0,
  }

  // Estado de parsing
  let currentBlock: {
    labelRow: number
    weekLabel: string
    headerType: 'semana' | 'opcion_plato' | 'date_only' | 'dias'
    dates: MenuDateCell[]
    weekStartDate: string
    entries: MenuEntry[]
    feriadoDates: string[]
    currentCategory: string | null
  } | null = null

  const closeBlock = () => {
    if (!currentBlock) return
    if (currentBlock.dates.length === 0 && currentBlock.entries.length === 0) return
    
    weeks.push({
      weekLabel: currentBlock.weekLabel,
      labelRow: currentBlock.labelRow,
      weekStartDate: currentBlock.weekStartDate,
      dates: currentBlock.dates,
      entries: currentBlock.entries,
      headerType: currentBlock.headerType,
      feriadoDates: currentBlock.feriadoDates,
    })
    stats.physicalBlocks += 1
    currentBlock = null
  }

  // Para tracking de semanas calendario únicas
  const calendarWeeksSet = new Set<string>()
  const businessDaysSet = new Set<string>()
  const feriadoDaysSet = new Set<string>()

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    const rowNumber = rowIndex + 1

    // Registrar errores de fórmula en cualquier celda
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

    const colAText = cellText(row, 0)
    const colACanonical = canonicalText(colAText)
    const isWeekLike = colACanonical.startsWith('semana') || colACanonical === 'opcion plato'
    const isDias = isDiasRow(row)
    const isFeriado = isFeriadoRow(row)
    const dateHeaderInfo = detectDateHeaderRow(row)
    const hasDates = dateHeaderInfo.hasDates
    const categoryInfo = detectCategoryRow(row)

    // 1. Fila FERIADO: registrar y continuar
    if (isFeriado) {
      // Las fechas del feriado están en la siguiente fila de fechas
      // Se manejará cuando se procese la fila de fechas
      continue
    }

    // 2. Nueva fila de fechas detectada (inicia bloque físico)
    if (hasDates) {
      // Parsear las celdas de fecha
      const dateCells: MenuDateCell[] = []
      const normalizedDates: string[] = []
      
      for (const dateCell of dateHeaderInfo.dates) {
        const cell = row[dateCell.column]
        if (!cell || cell.type === 'empty') continue
        if (isFormulaErrorCell(cell)) continue
        stats.dateCells += 1
        const parsed = parseDateCell(cell, context, rowNumber, dateFormat?.format ?? null)
        if (parsed.normalized) {
          stats.normalizedDates += 1
          normalizedDates.push(parsed.normalized)
        }
        if (parsed.incident) incidents.push(parsed.incident)
        dateCells.push({
          ...dateCell,
          normalized: parsed.normalized,
          format: parsed.format,
        })
      }

      // Determinar weekStartDate: lunes de la primera fecha válida (columna B preferiblemente)
      let weekStartDate = ''
      const mondayCell = dateCells.find(d => d.column === 1) || dateCells[0]
      if (mondayCell.normalized) {
        weekStartDate = getMondayOf(mondayCell.normalized)
      }

      // Determinar tipo de header
      let headerType: 'semana' | 'opcion_plato' | 'date_only' | 'dias' = 'date_only'
      if (isWeekLike) {
        headerType = colACanonical === 'opcion plato' ? 'opcion_plato' : 'semana'
      } else if (isDias) {
        headerType = 'dias'
      }

      // Si hay bloque anterior, cerrarlo
      if (currentBlock) {
        closeBlock()
      }

      // Iniciar nuevo bloque
      currentBlock = {
        labelRow: rowNumber,
        weekLabel: colAText || `Bloque fila ${rowNumber}`,
        headerType,
        dates: dateCells,
        weekStartDate,
        entries: [],
        feriadoDates: [],
        currentCategory: null,
      }

      // Registrar semana calendario
      if (weekStartDate) {
        calendarWeeksSet.add(weekStartDate)
      }

      // Registrar días hábiles
      for (const dc of dateCells) {
        if (dc.normalized) {
          businessDaysSet.add(dc.normalized)
        }
      }
      continue
    }

    // 3. Fila de categoría (también contiene platos en columnas B-F)
    if (categoryInfo.isCategory) {
      if (!currentBlock) {
        // Categoría sin bloque de fechas abierto: incidencia
        incidents.push(
          incidentOf(context, {
            code: 'MENU_CATEGORY_WITHOUT_DATES',
            field: 'Categoría',
            originalValue: colAText,
            severity: 'WARNING',
            description: `Categoría '${colAText}' (fila ${rowNumber}) sin fila de fechas previa.`,
            recommendedAction: 'Revise la estructura del menú.',
            rowNumber,
            context: 'Parseo del plan de menú',
          }),
        )
        continue
      }
      currentBlock.currentCategory = categoryInfo.category
      
      // Procesar platos EN LA MISMA FILA (columnas B-F)
      for (let col = 1; col <= 5; col++) { // Columnas B-F
        const cell = rawCell(row, col)
        if (!cell || cell.type === 'empty') continue
        if (isFormulaErrorCell(cell)) continue
        const dish = cellText(row, col)
        if (dish === '') continue
        
        stats.entries += 1
        
        const serviceDate = currentBlock.dates.find(d => d.column === col)?.normalized || ''
        const dayIndex = col - 1 // 0=Lunes, ..., 4=Viernes
        
        if (serviceDate) {
          businessDaysSet.add(serviceDate)
        }

        const sourceCell = cell.sourceCell
        const sourceSheet = cell.sourceSheet
        const sourceFile = cell.sourceFile
        const sourceFormula = cell.formula

        currentBlock.entries.push({
          rowNumber,
          category: currentBlock.currentCategory as MenuCategory,
          originalCategory: colAText,
          column: col,
          columnLetter: columnLetter(col),
          dayIndex,
          serviceDate,
          dish,
          originalValue: cell.value,
          hasError: false,
          sourceCell,
          sourceSheet,
          sourceFile,
          sourceFormula,
        })
      }
      continue
    }

    // 4. Fila con platos (tiene contenido en columnas B-F y categoría actual) - para filas sin categoría en A
    if (currentBlock && currentBlock.currentCategory) {
      let hasDishInRow = false
      for (let col = 1; col <= 5; col++) { // Columnas B-F
        const cell = rawCell(row, col)
        if (!cell || cell.type === 'empty') continue
        if (isFormulaErrorCell(cell)) continue
        const dish = cellText(row, col)
        if (dish === '') continue
        
        hasDishInRow = true
        stats.entries += 1
        
        const serviceDate = currentBlock.dates.find(d => d.column === col)?.normalized || ''
        const dayIndex = col - 1 // 0=Lunes, ..., 4=Viernes
        
        if (serviceDate) {
          businessDaysSet.add(serviceDate)
        }

        const sourceCell = cell.sourceCell
        const sourceSheet = cell.sourceSheet
        const sourceFile = cell.sourceFile
        const sourceFormula = cell.formula

        currentBlock.entries.push({
          rowNumber,
          category: currentBlock.currentCategory as MenuCategory,
          originalCategory: colAText,
          column: col,
          columnLetter: columnLetter(col),
          dayIndex,
          serviceDate,
          dish,
          originalValue: cell.value,
          hasError: false,
          sourceCell,
          sourceSheet,
          sourceFile,
          sourceFormula,
        })
      }
      if (!hasDishInRow && colAText !== '') {
        // Fila con texto en A pero sin platos en B-F: podría ser etiqueta o nota
        // No hacer nada, solo continuar
      }
      continue
    }

    // 5. Etiqueta de semana sin fechas (ej. "SEMANA 1" sola) - solo para menú anual
    if (isWeekLike && !hasDates) {
      if (currentBlock === null) {
        currentBlock = {
          labelRow: rowNumber,
          weekLabel: colAText,
          headerType: colACanonical === 'opcion plato' ? 'opcion_plato' : 'semana',
          dates: [],
          weekStartDate: '',
          entries: [],
          feriadoDates: [],
          currentCategory: null,
        }
      } else if (currentBlock.dates.length === 0 && currentBlock.entries.length === 0) {
        currentBlock.weekLabel = colAText
        currentBlock.headerType = colACanonical === 'opcion plato' ? 'opcion_plato' : 'semana'
      } else {
        closeBlock()
        currentBlock = {
          labelRow: rowNumber,
          weekLabel: colAText,
          headerType: colACanonical === 'opcion plato' ? 'opcion_plato' : 'semana',
          dates: [],
          weekStartDate: '',
          entries: [],
          feriadoDates: [],
          currentCategory: null,
        }
      }
      continue
    }
  }

  closeBlock()

  stats.weekBlocks = weeks.length
  stats.calendarWeeks = calendarWeeksSet.size
  stats.businessDays = businessDaysSet.size
  stats.feriadoDays = feriadoDaysSet.size

  return {
    weeks,
    incidents,
    severity: aggregateSeverity(incidents),
    stats,
  }
}