/**
 * Utilidades comunes para los parsers de importación (Fase 3).
 *
 * Reglas transversales:
 * - Nunca se convierte un valor ausente, un error de fórmula o un texto
 *   inválido en cero. Cada caso se distingue con un tipo explícito.
 * - Cada incidencia conserva procedencia (archivo, hoja, fila, columna),
 *   valor original, severidad, descripción y contexto de parsing.
 * - Los importes financieros usan `Money` con centavos enteros.
 */

import { fromDollars, type Money } from '../../../domain/value-objects/money'
import type { SourceType } from '../../../domain/value-objects/source-type'
import type { ImportIncident, IncidentSeverity } from '../../../domain/value-objects/incident'
import type { ImportProvenance } from '../../../domain/value-objects/import-provenance'
import type { RawCell } from '../../../application/ports/import-file-reader-port'

export const ANALYSIS_VERSION = 'phase3-v1'

export interface ParserContext {
  readonly fileName: string
  readonly sheetName: string
  readonly sheetIndex: number
  readonly sourceType: SourceType
}

export function provenanceAt(
  context: ParserContext,
  rowNumber?: number,
  column?: string,
): ImportProvenance {
  return {
    sourceType: context.sourceType,
    fileName: context.fileName,
    sheetName: context.sheetName,
    sheetIndex: context.sheetIndex,
    rowNumber,
    column,
    analysisVersion: ANALYSIS_VERSION,
  }
}

export interface IncidentInput {
  readonly code: string
  readonly field: string
  readonly originalValue: unknown
  readonly normalizedValue?: unknown
  readonly severity: IncidentSeverity
  readonly description: string
  readonly recommendedAction: string
  readonly rowNumber?: number
  readonly column?: string
  readonly context?: string
}

export function incidentOf(
  context: ParserContext,
  input: IncidentInput,
): ImportIncident {
  return {
    sourceType: context.sourceType,
    code: input.code,
    field: input.field,
    originalValue: input.originalValue,
    normalizedValue: input.normalizedValue,
    description: input.description,
    severity: input.severity,
    recommendedAction: input.recommendedAction,
    provenance: provenanceAt(context, input.rowNumber, input.column),
    context: input.context,
  }
}

/** Texto canónico de una celda para comparaciones (trim, sin acentos, minúsculas). */
export function canonicalText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function cellText(row: readonly RawCell[], colIndex: number): string {
  const cell = row[colIndex]
  if (!cell || cell.type === 'empty') return ''
  return String(cell.value ?? '').trim()
}

export function rawCell(row: readonly RawCell[], colIndex: number): RawCell | undefined {
  return row[colIndex]
}

export const FORMULA_ERRORS = ['#REF!', '#VALUE!', '#N/A', '#DIV/0!', '#NAME?', '#NULL!', '#NUM!']

export function isFormulaErrorText(text: string): boolean {
  return FORMULA_ERRORS.includes(text.trim().toUpperCase())
}

export function isFormulaErrorCell(cell: RawCell | undefined): boolean {
  return cell?.type === 'error'
}

export type AmountKind =
  | 'number'
  | 'missing'
  | 'formula-error'
  | 'unparseable-text'

export interface ParsedAmount {
  readonly kind: AmountKind
  /** Valor numérico solo cuando `kind === 'number'`. */
  readonly number?: number
  /** Texto del error de fórmula o del texto no parseable. */
  readonly errorText?: string
}

/**
 * Interpreta una celda como cantidad numérica.
 * - Ausente → `missing` (nunca cero).
 * - Error de fórmula (#REF!, #VALUE!, #DIV/0!) → `formula-error` con su texto.
 * - Texto no numérico (ej. `$ -`) → `unparseable-text` con el original.
 * - Texto numérico con símbolo monetario (`$0.04`) → número.
 */
export function parseAmount(cell: RawCell | undefined): ParsedAmount {
  if (!cell || cell.type === 'empty') {
    return { kind: 'missing' }
  }

  if (cell.type === 'error') {
    return { kind: 'formula-error', errorText: String(cell.value) }
  }

  if (typeof cell.value === 'number') {
    return Number.isFinite(cell.value) ? { kind: 'number', number: cell.value } : { kind: 'unparseable-text', errorText: String(cell.value) }
  }

  if (typeof cell.value === 'boolean') {
    return { kind: 'unparseable-text', errorText: String(cell.value) }
  }

  const text = String(cell.value ?? '').trim()
  if (text === '') return { kind: 'missing' }

  const cleaned = text.replace(/^[\$\s]+/, '').replace(/\s+/g, '')
  if (cleaned === '' || cleaned === '-') {
    return { kind: 'unparseable-text', errorText: text }
  }

  const normalized = cleaned.replace(/,/g, '')
  if (/^-?\d+(\.\d+)?$/.test(normalized)) {
    const value = Number(normalized)
    return Number.isFinite(value) ? { kind: 'number', number: value } : { kind: 'unparseable-text', errorText: text }
  }

  return { kind: 'unparseable-text', errorText: text }
}

/**
 * Convierte un importe en dólares a `Money` (centavos enteros, redondeo al
 * centavo más cercano). Solo para valores ya validados como numéricos.
 */
export function dollarsToMoney(amount: number): Money {
  return fromDollars(amount)
}

/** Severidad agregada de una lista de incidencias. */
export function aggregateSeverity(incidents: readonly ImportIncident[]): IncidentSeverity {
  if (incidents.some((i) => i.severity === 'ERROR')) return 'ERROR'
  if (incidents.some((i) => i.severity === 'WARNING')) return 'WARNING'
  return 'VALID'
}

/** Mapeo de categorías de menú (Excel) a categorías de plato (dominio). */
export const MENU_CATEGORY_TO_DISH_CATEGORY: Record<string, string> = {
  SOPA: 'Sopa',
  PROTEINA: 'Proteína',
  GUARNICION: 'Guarnición',
  ENSALADA: 'Ensalada',
  'BEBIDA FRIA': 'Bebida Fría',
  POSTRE: 'Postre',
  FRUTA: 'Fruta',
  ENTRADA: 'Sopa', // ENTRADA mapea a Sopa como entrante
  BEBIDA: 'Bebida Fría', // BEBIDA genérica mapea a Bebida Fría
}

/**
 * Convierte una categoría de menú (del Excel) a categoría de plato (dominio).
 * Retorna undefined si la categoría no es reconocida.
 */
export function mapMenuCategoryToDishCategory(menuCategory: string): string | undefined {
  return MENU_CATEGORY_TO_DISH_CATEGORY[menuCategory]
}
