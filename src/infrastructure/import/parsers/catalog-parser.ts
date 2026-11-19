/**
 * Parser de CATALOG (hoja `CATALOGO COSTEO 17-08-2`).
 *
 * Columnas: CÓDIGO | BODEGA | PRODUCTO | Presentación | costo | estado.
 * Referencia real: 461 ítems.
 *
 * Reglas:
 * - El costo se convierte a `Money` con centavos enteros (redondeo al centavo).
 * - Una celda vacía NUNCA representa costo cero: se registra incidencia.
 * - Los errores de fórmula y textos inválidos se preservan como ERROR.
 * - Las filas incompletas/inválidas se registran sin descartar silenciosamente.
 */

import type { Money } from '../../../domain/value-objects/money'
import type { ImportIncident } from '../../../domain/value-objects/incident'
import type { RawCell } from '../../../application/ports/import-file-reader-port'
import {
  aggregateSeverity,
  canonicalText,
  cellText,
  dollarsToMoney,
  incidentOf,
  isFormulaErrorCell,
  parseAmount,
  rawCell,
  type ParserContext,
} from './parser-common'

export interface ParsedCatalogItem {
  readonly rowNumber: number
  readonly code: string
  readonly bodega: string
  readonly product: string
  readonly presentation: string
  /** Costo en crudo tal como aparece en la hoja (para trazabilidad). */
  readonly costRaw: unknown
  /** Costo convertido a `Money`; ausente cuando no pudo convertirse. */
  readonly cost?: Money
  readonly status: 'ACTIVO' | 'INACTIVO' | 'UNKNOWN'
  readonly originalStatus: string
}

export interface CatalogParseResult {
  readonly items: readonly ParsedCatalogItem[]
  readonly incidents: readonly ImportIncident[]
  readonly severity: 'VALID' | 'WARNING' | 'ERROR'
  readonly stats: {
    readonly dataRows: number
    readonly parsedItems: number
    readonly itemsWithCost: number
    readonly itemsWithIncidents: number
  }
}

interface CatalogColumnMap {
  readonly code: number
  readonly bodega: number
  readonly product: number
  readonly presentation: number
  readonly cost: number
  readonly status: number
}

const EXPECTED_HEADERS: Record<keyof CatalogColumnMap, readonly string[]> = {
  code: ['codigo'],
  bodega: ['bodega'],
  product: ['producto'],
  presentation: ['presentacion'],
  cost: ['costo'],
  status: ['estado'],
}

function detectColumns(
  headerRow: readonly RawCell[],
): Partial<CatalogColumnMap> {
  const map: Record<string, number> = {}
  headerRow.forEach((cell, index) => {
    const canonical = canonicalText(cell?.value)
    for (const [field, aliases] of Object.entries(EXPECTED_HEADERS)) {
      if (aliases.includes(canonical) && map[field] === undefined) {
        map[field] = index
      }
    }
  })
  return map as Partial<CatalogColumnMap>
}

function parseStatus(raw: string): ParsedCatalogItem['status'] {
  const canonical = canonicalText(raw)
  if (canonical === 'activo') return 'ACTIVO'
  if (canonical === 'inactivo') return 'INACTIVO'
  return 'UNKNOWN'
}

export function parseCatalogSheet(
  rows: readonly (readonly RawCell[])[],
  context: ParserContext,
): CatalogParseResult {
  const incidents: ImportIncident[] = []
  const items: ParsedCatalogItem[] = []

  const headerRow = rows[0]
  const columns = headerRow ? detectColumns(headerRow) : {}

  const missingColumns = (Object.keys(EXPECTED_HEADERS) as (keyof CatalogColumnMap)[]).filter(
    (field) => columns[field] === undefined,
  )
  if (missingColumns.length > 0) {
    incidents.push(
      incidentOf(context, {
        code: 'CATALOG_MISSING_COLUMNS',
        field: missingColumns.join(', '),
        originalValue: null,
        severity: 'ERROR',
        description: `La hoja no contiene las columnas esperadas: ${missingColumns.join(', ')}.`,
        recommendedAction: 'Verifique que la hoja sea el catálogo de costeo correcto.',
        rowNumber: 1,
        context: 'Detección de encabezados',
      }),
    )
    return {
      items: [],
      incidents,
      severity: aggregateSeverity(incidents),
      stats: { dataRows: Math.max(0, rows.length - 1), parsedItems: 0, itemsWithCost: 0, itemsWithIncidents: 0 },
    }
  }

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    const rowNumber = rowIndex + 1
    const rowIncidents: ImportIncident[] = []

    const code = cellText(row, columns.code!)
    const bodega = cellText(row, columns.bodega!)
    const product = cellText(row, columns.product!)
    const presentation = cellText(row, columns.presentation!)
    const originalStatus = cellText(row, columns.status!)

    if (code === '' && product === '') {
      // Fila completamente vacía en campos clave: se omite con incidencia INFO.
      const hasAnyContent = row.some((cell) => cell && cell.type !== 'empty')
      if (hasAnyContent) {
        incidents.push(
          incidentOf(context, {
            code: 'CATALOG_EMPTY_KEY_FIELDS',
            field: 'CÓDIGO, PRODUCTO',
            originalValue: row.map((c) => (c ? c.value : '')).join('|'),
            severity: 'WARNING',
            description: `Fila ${rowNumber} sin CÓDIGO ni PRODUCTO; no se interpretó como ítem.`,
            recommendedAction: 'Complete o elimine la fila en el archivo original.',
            rowNumber,
            context: 'Parseo de ítems del catálogo',
          }),
        )
      }
      continue
    }

    const costCell = rawCell(row, columns.cost!)
    const costAmount = parseAmount(costCell)
    let cost: Money | undefined

    if (costAmount.kind === 'number') {
      if (isFormulaErrorCell(costCell)) {
        // unreachable, defensa en profundidad
        rowIncidents.push(
          incidentOf(context, {
            code: 'CATALOG_COST_FORMULA_ERROR',
            field: 'costo',
            originalValue: costCell?.value,
            severity: 'ERROR',
            description: `El costo de la fila ${rowNumber} contiene un error de fórmula (${costCell?.value}). No se convirtió en cero.`,
            recommendedAction: 'Corrija la fórmula en el archivo original y vuelva a cargarlo.',
            rowNumber,
            column: 'costo',
            context: 'Parseo de ítems del catálogo',
          }),
        )
      } else {
        cost = dollarsToMoney(costAmount.number!)
      }
    } else if (costAmount.kind === 'formula-error') {
      rowIncidents.push(
        incidentOf(context, {
          code: 'CATALOG_COST_FORMULA_ERROR',
          field: 'costo',
          originalValue: costAmount.errorText,
          severity: 'ERROR',
          description: `El costo de la fila ${rowNumber} contiene un error de fórmula (${costAmount.errorText}). No se convirtió en cero.`,
          recommendedAction: 'Corrija la fórmula en el archivo original y vuelva a cargarlo.',
          rowNumber,
          column: 'costo',
          context: 'Parseo de ítems del catálogo',
        }),
      )
    } else if (costAmount.kind === 'missing') {
      rowIncidents.push(
        incidentOf(context, {
          code: 'CATALOG_COST_MISSING',
          field: 'costo',
          originalValue: '',
          severity: 'WARNING',
          description: `La fila ${rowNumber} no tiene costo. Una celda vacía no representa un costo de cero.`,
          recommendedAction: 'Complete el costo en el archivo original o revise la fila manualmente.',
          rowNumber,
          column: 'costo',
          context: 'Parseo de ítems del catálogo',
        }),
      )
    } else {
      rowIncidents.push(
        incidentOf(context, {
          code: 'CATALOG_COST_INVALID',
          field: 'costo',
          originalValue: costAmount.errorText,
          severity: 'ERROR',
          description: `El costo de la fila ${rowNumber} no es numérico ('${costAmount.errorText}'). No se convirtió en cero.`,
          recommendedAction: 'Corrija el valor del costo en el archivo original.',
          rowNumber,
          column: 'costo',
          context: 'Parseo de ítems del catálogo',
        }),
      )
    }

    const status = parseStatus(originalStatus)
    if (status === 'UNKNOWN' && originalStatus !== '') {
      rowIncidents.push(
        incidentOf(context, {
          code: 'CATALOG_STATUS_UNKNOWN',
          field: 'estado',
          originalValue: originalStatus,
          severity: 'WARNING',
          description: `El estado '${originalStatus}' de la fila ${rowNumber} no es ACTIVO ni INACTIVO.`,
          recommendedAction: 'Revise el estado del ítem antes de aprobarlo.',
          rowNumber,
          column: 'estado',
          context: 'Parseo de ítems del catálogo',
        }),
      )
    }

    items.push({
      rowNumber,
      code,
      bodega,
      product,
      presentation,
      costRaw: costCell && costCell.type !== 'empty' ? costCell.value : '',
      cost,
      status,
      originalStatus,
    })
    incidents.push(...rowIncidents)
  }

  return {
    items,
    incidents,
    severity: aggregateSeverity(incidents),
    stats: {
      dataRows: Math.max(0, rows.length - 1),
      parsedItems: items.length,
      itemsWithCost: items.filter((item) => item.cost !== undefined).length,
      itemsWithIncidents: items.filter(
        (item) => incidents.some((i) => i.provenance?.rowNumber === item.rowNumber),
      ).length,
    },
  }
}
