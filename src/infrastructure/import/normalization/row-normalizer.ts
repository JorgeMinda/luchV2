/**
 * Normalización pura de filas importadas.
 * Produce ImportedRow con incidencias tipadas; nunca convierte vacíos ni
 * errores de fórmula en cero, y conserva el valor original.
 */

import type { ImportedRow } from '../../../domain/entities/imported-row'
import type { ImportIncident } from '../../../domain/value-objects/incident'
import { normalizeEntityName } from './entity-normalizer'
import { normalizeDate } from './date-normalizer'

const FORMULA_ERRORS = ['#REF!', '#VALUE!', '#N/A', '#DIV/0!', '#NAME?', '#NULL!', '#NUM!']
const DATE_PREFIX = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/

function hasDiacritics(text: string): boolean {
  return /[\u00c0-\u00ff]/.test(text)
}

function looksLikeMojibake(text: string): boolean {
  return /[ÃÂ][\u0080-\u00bf]/.test(text)
}

function repairMojibake(text: string): string {
  try {
    const bytes = Uint8Array.from([...text].map((ch) => ch.charCodeAt(0) & 0xff))
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return text
  }
}

export interface RawRow {
  rowNumber: number
  cells: string[]
  headers: string[]
  source: string
}

export function normalizeRows(rawRows: RawRow[], batchId: string): ImportedRow[] {
  return rawRows.map((raw, index) => {
    const originalData: Record<string, unknown> = {}
    const normalizedData: Record<string, unknown> = {}
    const incidents: ImportIncident[] = []

    raw.headers.forEach((header, cellIndex) => {
      const value = String(raw.cells[cellIndex] ?? '').trim()
      originalData[header] = value

      if (value === '') {
        incidents.push({
          code: 'MISSING_REQUIRED_FIELD',
          field: header,
          originalValue: value,
          normalizedValue: null,
          description: `El campo '${header}' está vacío.`,
          severity: 'WARNING',
          recommendedAction: 'Ingrese un valor o marque el campo como opcional.',
        })
        normalizedData[header] = null
        return
      }

      if (FORMULA_ERRORS.includes(value)) {
        incidents.push({
          code: 'PRICE_FORMULA_ERROR',
          field: header,
          originalValue: value,
          normalizedValue: null,
          description: `El campo '${header}' contiene un error de fórmula (${value}). No se convirtió en cero.`,
          severity: 'ERROR',
          recommendedAction: 'Corrija la fórmula en el archivo original y vuelva a cargarlo.',
        })
        normalizedData[header] = null
        return
      }

      let normalizedValue: string | number = value

      if (looksLikeMojibake(value)) {
        const repaired = repairMojibake(value)
        incidents.push({
          code: 'ENC_MOJIBAKE',
          field: header,
          originalValue: value,
          normalizedValue: repaired,
          description: `Texto con codificación incorrecta reparado en '${header}'.`,
          severity: 'WARNING',
          recommendedAction: 'Confirme que el texto reparado sea correcto.',
        })
        normalizedValue = repaired
      }

      if (DATE_PREFIX.test(String(normalizedValue))) {
        try {
          const parsed = normalizeDate(String(normalizedValue))
          if (parsed.ambiguous) {
            incidents.push({
              code: 'DATE_AMBIGUOUS',
              field: header,
              originalValue: value,
              normalizedValue: parsed.normalized,
              description: `Fecha ambigua (${value}); se aplicó interpretación por defecto.`,
              severity: 'WARNING',
              recommendedAction: 'Confirme la fecha antes de aprobar la fila.',
            })
          } else {
            incidents.push({
              code: 'DATE_NORMALIZED',
              field: header,
              originalValue: value,
              normalizedValue: parsed.normalized,
              description: `Fecha normalizada a ISO 8601.`,
              severity: 'VALID',
              recommendedAction: 'Fecha válida.',
            })
          }
          normalizedValue = parsed.normalized
        } catch {
          incidents.push({
            code: 'DATE_AMBIGUOUS',
            field: header,
            originalValue: value,
            normalizedValue: null,
            description: `No se pudo interpretar la fecha '${value}'.`,
            severity: 'ERROR',
            recommendedAction: 'Ingrese la fecha en formato YYYY-MM-DD.',
          })
        }
      }

      if (hasDiacritics(String(normalizedValue))) {
        normalizedData[`${header}__key`] = normalizeEntityName(String(normalizedValue))
      }

      normalizedData[header] = normalizedValue
    })

    const status = incidents.some((i) => i.severity === 'ERROR')
      ? 'error'
      : incidents.some((i) => i.severity === 'WARNING')
        ? 'warning'
        : 'valid'

    const severityMap: Record<typeof status, ImportedRow['severity']> = {
      valid: 'VALID',
      warning: 'WARNING',
      error: 'ERROR',
    }

    return {
      id: `row-${batchId}-${index}`,
      batchId,
      rowIndex: index,
      rowNumber: raw.rowNumber,
      sheetName: raw.source,
      sourceType: 'CATALOG',
      rawData: originalData,
      originalData,
      normalizedData,
      status,
      severity: severityMap[status],
      errorMessage: undefined,
      warningMessages: undefined,
      incidents,
      entityType: 'ingredient',
      provenance: undefined,
      analysisVersion: undefined,
      createdAt: new Date().toISOString(),
    }
  })
}
