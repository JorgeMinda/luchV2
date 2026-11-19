/**
 * Parser de MEAL_COMPOSITION (hoja `COMPOSICION DE CADA PLATO`).
 *
 * Estructura real (4 plantillas verificadas):
 *   - Fila de título de plantilla (ej. `Almuerzo Saludable Estudiantil`).
 *   - Encabezado: `Componente | Cantidad | Unidad | Costo Unitario |
 *     Costo por Porción`.
 *   - Filas de componentes (PROTEINA, GUARNICION, ARROZ, ENSALADA, FRUTA,
 *     SOPA, POSTRE, SALSAS, JUGO).
 *   - Fila de cierre con el costo objetivo total en la columna E (ej. `$1.24`).
 *
 * Reglas:
 * - Los gramajes, cantidades, costos unitarios y porciones provienen de la
 *   hoja; nunca se inventan ni completan datos faltantes.
 * - El costo unitario puede tener precisión sub-centavo (ej. 0.0072); se
 *   conserva su valor crudo y NO se redondea a `Money`.
 * - El costo por porción y el objetivo total se convierten a `Money` (centavos
 *   enteros) y se validan sin aritmética monetaria de punto flotante.
 * - Validación frente al costo objetivo:
 *   diferencia 0 → válida; ≤ 1 centavo → WARNING (redondeo); > 1 → ERROR.
 */

import type { Money } from '../../../domain/value-objects/money'
import { fromCents } from '../../../domain/value-objects/money'
import type { ImportIncident } from '../../../domain/value-objects/incident'
import type { MealCompositionComponentType } from '../../../domain/entities/meal-composition-template'
import type { ServiceType } from '../../../domain/value-objects/service-type'
import {
  MEAL_COMPOSITION_TOLERANCE_CENTS,
  VERIFIED_TEMPLATE_TARGETS,
} from '../../../domain/entities/meal-composition-template'
import type { UnitOfMeasure } from '../../../domain/value-objects/unit-of-measure'
import type { RawCell } from '../../../application/ports/import-file-reader-port'
import {
  aggregateSeverity,
  canonicalText,
  cellText,
  dollarsToMoney,
  incidentOf,
  parseAmount,
  rawCell,
  type ParserContext,
} from './parser-common'
import { normalizeUnit } from '../normalization/unit-normalizer'

const COLS = {
  component: 0,
  quantity: 1,
  unit: 2,
  unitCost: 3,
  portionCost: 4,
} as const

export interface ParsedCompositionComponent {
  readonly rowNumber: number
  readonly componentType: MealCompositionComponentType
  /** Nombre original del componente en la hoja (trazabilidad). */
  readonly originalName: string
  /** Gramaje estándar (Cantidad) tal como está en la hoja. */
  readonly standardQuantity?: number
  /** Unidad normalizada (g, oz, ...); ausente si no es reconocible. */
  readonly unit?: UnitOfMeasure
  readonly originalUnit: string
  /** Costo unitario en crudo; puede tener precisión sub-centavo (no se redondea). */
  readonly unitCostRaw: unknown
  /** Costo por porción convertido a Money (centavos enteros). */
  readonly portionCost?: Money
}

export interface ParsedCompositionTemplate {
  readonly titleRow: number
  readonly name: string
  readonly serviceType: ServiceType
  readonly components: readonly ParsedCompositionComponent[]
  /** Costo objetivo declarado en la hoja (fila de cierre). */
  readonly sheetTargetTotal?: Money
  /** Costo objetivo verificado contra el documento original. */
  readonly verifiedTargetTotal?: Money
  /** Suma de costos por porción (Money, centavos enteros). */
  readonly calculatedTotal?: Money
  /** 'VALID' | 'WARNING' | 'ERROR' según la validación de tolerancia. */
  readonly validation: 'VALID' | 'WARNING' | 'ERROR' | 'UNVALIDATED'
}

export interface MealCompositionParseResult {
  readonly templates: readonly ParsedCompositionTemplate[]
  readonly incidents: readonly ImportIncident[]
  readonly severity: 'VALID' | 'WARNING' | 'ERROR'
  readonly stats: {
    readonly totalRows: number
    readonly templates: number
    readonly components: number
    readonly validatedTemplates: number
  }
}

function matchComponentType(originalName: string): MealCompositionComponentType | null {
  const canonical = canonicalText(originalName)
  if (canonical.startsWith('proteina')) return 'PROTEINA'
  if (canonical.startsWith('guarnicion')) return 'GUARNICION'
  if (canonical.startsWith('arroz')) return 'ARROZ'
  if (canonical.startsWith('ensalada')) return 'ENSALADA'
  if (canonical.startsWith('fruta')) return 'FRUTA'
  if (canonical.startsWith('sopa')) return 'SOPA'
  if (canonical.startsWith('postre')) return 'POSTRE'
  if (canonical.startsWith('salsa')) return 'SALSAS'
  if (canonical.startsWith('jugo')) return 'JUGO'
  return null
}

function matchVerifiedTarget(name: string): (typeof VERIFIED_TEMPLATE_TARGETS)[number] | null {
  const canonical = canonicalText(name)
  for (const target of VERIFIED_TEMPLATE_TARGETS) {
    if (canonicalText(target.name) === canonical) return target
    if ((target.aliases ?? []).some((alias) => canonicalText(alias) === canonical)) return target
  }
  return null
}

function countNonEmptyFrom(row: readonly RawCell[], from: number): number {
  let count = 0
  for (let i = from; i < row.length; i++) {
    const cell = row[i]
    if (cell && cell.type !== 'empty' && cellText(row, i) !== '') count += 1
  }
  return count
}

function isTemplateTitleRow(row: readonly RawCell[]): boolean {
  const component = cellText(row, COLS.component)
  return (
    component !== '' &&
    canonicalText(component) !== 'componente' &&
    countNonEmptyFrom(row, 1) === 0
  )
}

function isCompositionHeaderRow(row: readonly RawCell[]): boolean {
  return canonicalText(cellText(row, COLS.component)) === 'componente'
}

/** Fila de cierre: columnas A–D vacías y columna E con el total objetivo. */
function isTargetTotalRow(row: readonly RawCell[]): boolean {
  const leftEmpty = [0, 1, 2, 3].every((col) => cellText(row, col) === '')
  const targetCell = rawCell(row, COLS.portionCost)
  return leftEmpty && targetCell !== undefined && targetCell.type !== 'empty'
}

export function parseMealCompositionSheet(
  rows: readonly (readonly RawCell[])[],
  context: ParserContext,
): MealCompositionParseResult {
  const incidents: ImportIncident[] = []
  const templates: ParsedCompositionTemplate[] = []

  interface OpenTemplate {
    titleRow: number
    name: string
    components: ParsedCompositionComponent[]
    sheetTarget?: Money
    localIncidents: ImportIncident[]
  }
  let current: OpenTemplate | null = null

  const closeTemplate = () => {
    const template = current
    if (!template) return
    current = null

    const verified = matchVerifiedTarget(template.name)
    const verifiedTarget = verified?.targetTotalCost
    const serviceType = verified?.serviceType ?? 'lunch'

    let calculatedTotal: Money | undefined
    const withPortionCost = template.components.filter((c) => c.portionCost !== undefined)
    if (withPortionCost.length > 0) {
      const totalCents = withPortionCost.reduce((sum, c) => sum + c.portionCost!.cents, 0)
      calculatedTotal = fromCents(totalCents)
    }

    let validation: ParsedCompositionTemplate['validation'] = 'UNVALIDATED'
    const validationIncidents: ImportIncident[] = []

    if (template.sheetTarget === undefined) {
      validationIncidents.push(
        incidentOf(context, {
          code: 'COMPOSITION_TARGET_MISSING',
          field: 'Costo por Porción',
          originalValue: '',
          severity: 'ERROR',
          description: `La plantilla '${template.name}' no tiene fila de costo objetivo total; no se puede validar la suma de componentes.`,
          recommendedAction: 'Complete el costo objetivo en el archivo original.',
          rowNumber: template.titleRow,
          context: 'Validación de composición',
        }),
      )
      validation = 'ERROR'
    } else if (calculatedTotal === undefined) {
      validationIncidents.push(
        incidentOf(context, {
          code: 'COMPOSITION_NO_COMPONENT_COSTS',
          field: 'Costo por Porción',
          originalValue: '',
          severity: 'ERROR',
          description: `La plantilla '${template.name}' no tiene costos por porción válidos para comparar contra el objetivo.`,
          recommendedAction: 'Complete los costos por porción en el archivo original.',
          rowNumber: template.titleRow,
          context: 'Validación de composición',
        }),
      )
      validation = 'ERROR'
    } else {
      const difference = Math.abs(calculatedTotal.cents - template.sheetTarget.cents)
      if (difference === 0) {
        validation = 'VALID'
      } else if (difference <= MEAL_COMPOSITION_TOLERANCE_CENTS) {
        validation = 'WARNING'
        validationIncidents.push(
          incidentOf(context, {
            code: 'COMPOSITION_ROUNDING_TOLERANCE',
            field: 'Costo por Porción',
            originalValue: template.sheetTarget.cents,
            normalizedValue: calculatedTotal.cents,
            severity: 'WARNING',
            description: `La suma de componentes (${calculatedTotal.cents} centavos) difiere del objetivo (${template.sheetTarget.cents} centavos) en ${difference} centavo(s), dentro de la tolerancia de ±${MEAL_COMPOSITION_TOLERANCE_CENTS} centavo por redondeo.`,
            recommendedAction: 'Confirme la plantilla; la diferencia corresponde a redondeo.',
            rowNumber: template.titleRow,
            context: 'Validación de composición',
          }),
        )
      } else {
        validation = 'ERROR'
        validationIncidents.push(
          incidentOf(context, {
            code: 'COMPOSITION_COST_MISMATCH',
            field: 'Costo por Porción',
            originalValue: template.sheetTarget.cents,
            normalizedValue: calculatedTotal.cents,
            severity: 'ERROR',
            description: `La suma de componentes (${calculatedTotal.cents} centavos) difiere del objetivo (${template.sheetTarget.cents} centavos) en ${difference} centavos, fuera de la tolerancia de ±${MEAL_COMPOSITION_TOLERANCE_CENTS} centavo.`,
            recommendedAction: 'Corrija los gramajes o costos en el archivo original.',
            rowNumber: template.titleRow,
            context: 'Validación de composición',
          }),
        )
      }
    }

    if (verified && template.sheetTarget && template.sheetTarget.cents !== verified.targetTotalCost.cents) {
      validationIncidents.push(
        incidentOf(context, {
          code: 'COMPOSITION_VERIFIED_TARGET_MISMATCH',
          field: 'Costo objetivo verificado',
          originalValue: template.sheetTarget.cents,
          normalizedValue: verified.targetTotalCost.cents,
          severity: 'WARNING',
          description: `El costo objetivo de la hoja (${template.sheetTarget.cents} centavos) difiere del valor verificado (${verified.targetTotalCost.cents} centavos) para '${verified.name}'.`,
          recommendedAction: 'Verifique cuál valor es el correcto antes de aprobar la plantilla.',
          rowNumber: template.titleRow,
          context: 'Validación de composición',
        }),
      )
      if (validation === 'VALID') validation = 'WARNING'
    }

    templates.push({
      titleRow: template.titleRow,
      name: template.name,
      serviceType,
      components: template.components,
      sheetTargetTotal: template.sheetTarget,
      verifiedTargetTotal: verifiedTarget,
      calculatedTotal,
      validation,
    })
    incidents.push(...template.localIncidents, ...validationIncidents)
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    const rowNumber = rowIndex + 1

    if (isCompositionHeaderRow(row)) {
      continue
    }

    if (isTargetTotalRow(row)) {
      if (current === null) {
        incidents.push(
          incidentOf(context, {
            code: 'COMPOSITION_TARGET_WITHOUT_TEMPLATE',
            field: 'Costo por Porción',
            originalValue: rawCell(row, COLS.portionCost)?.value ?? '',
            severity: 'WARNING',
            description: `La fila ${rowNumber} contiene un costo objetivo sin plantilla abierta.`,
            recommendedAction: 'Revise la estructura de la hoja.',
            rowNumber,
            context: 'Parseo de composición',
          }),
        )
        continue
      }
      const targetCell = rawCell(row, COLS.portionCost)!
      const amount = parseAmount(targetCell)
      if (amount.kind === 'number') {
        current.sheetTarget = dollarsToMoney(amount.number!)
      } else if (amount.kind === 'formula-error') {
        current.localIncidents.push(
          incidentOf(context, {
            code: 'COMPOSITION_TARGET_FORMULA_ERROR',
            field: 'Costo por Porción',
            originalValue: amount.errorText,
            severity: 'ERROR',
            description: `El costo objetivo de la plantilla '${current.name}' contiene un error de fórmula (${amount.errorText}). No se convirtió en cero.`,
            recommendedAction: 'Corrija la fórmula en el archivo original.',
            rowNumber,
            context: 'Parseo de composición',
          }),
        )
      } else if (amount.kind === 'missing') {
        current.localIncidents.push(
          incidentOf(context, {
            code: 'COMPOSITION_TARGET_MISSING',
            field: 'Costo por Porción',
            originalValue: '',
            severity: 'WARNING',
            description: `La fila ${rowNumber} parece un costo objetivo pero la celda está vacía.`,
            recommendedAction: 'Revise la fila en el archivo original.',
            rowNumber,
            context: 'Parseo de composición',
          }),
        )
      } else {
        current.localIncidents.push(
          incidentOf(context, {
            code: 'COMPOSITION_TARGET_INVALID',
            field: 'Costo por Porción',
            originalValue: amount.errorText,
            severity: 'ERROR',
            description: `El costo objetivo de la plantilla '${current.name}' no es numérico ('${amount.errorText}').`,
            recommendedAction: 'Corrija el valor en el archivo original.',
            rowNumber,
            context: 'Parseo de composición',
          }),
        )
      }
      continue
    }

    const componentCellText = cellText(row, COLS.component)

    if (componentCellText === '') {
      continue
    }

    if (isTemplateTitleRow(row)) {
      closeTemplate()
      current = {
        titleRow: rowNumber,
        name: componentCellText,
        components: [],
        localIncidents: [],
      }
      continue
    }

    // Fila de componente
    if (current === null) {
      incidents.push(
        incidentOf(context, {
          code: 'COMPOSITION_COMPONENT_WITHOUT_TEMPLATE',
          field: 'Componente',
          originalValue: componentCellText,
          severity: 'WARNING',
          description: `La fila ${rowNumber} contiene el componente '${componentCellText}' sin plantilla abierta.`,
          recommendedAction: 'Revise la estructura de la hoja.',
          rowNumber,
          context: 'Parseo de composición',
        }),
      )
      continue
    }

    const componentType = matchComponentType(componentCellText)
    if (componentType === null) {
      current.localIncidents.push(
        incidentOf(context, {
          code: 'COMPOSITION_UNKNOWN_COMPONENT',
          field: 'Componente',
          originalValue: componentCellText,
          severity: 'WARNING',
          description: `El componente '${componentCellText}' (fila ${rowNumber}) no corresponde a un tipo reconocido (PROTEINA, GUARNICION, ARROZ, ENSALADA, FRUTA, SOPA, POSTRE, SALSAS, JUGO).`,
          recommendedAction: 'Revise el nombre del componente antes de aprobar.',
          rowNumber,
          column: 'Componente',
          context: 'Parseo de composición',
        }),
      )
      continue
    }

    const quantityCell = rawCell(row, COLS.quantity)
    const quantityAmount = parseAmount(quantityCell)
    const unitRaw = cellText(row, COLS.unit)
    const unit = unitRaw === '' ? undefined : normalizeUnit(unitRaw) ?? undefined
    if (unitRaw !== '' && unit === undefined) {
      current.localIncidents.push(
        incidentOf(context, {
          code: 'COMPOSITION_UNIT_INVALID',
          field: 'Unidad',
          originalValue: unitRaw,
          severity: 'ERROR',
          description: `La unidad '${unitRaw}' del componente '${componentCellText}' (fila ${rowNumber}) no es válida.`,
          recommendedAction: 'Corrija la unidad en el archivo original (g, kg, ml, l, un, lb, oz).',
          rowNumber,
          column: 'Unidad',
          context: 'Parseo de composición',
        }),
      )
    }

    const unitCostCell = rawCell(row, COLS.unitCost)
    const unitCostAmount = parseAmount(unitCostCell)
    if (unitCostAmount.kind === 'formula-error') {
      current.localIncidents.push(
        incidentOf(context, {
          code: 'COMPOSITION_UNIT_COST_FORMULA_ERROR',
          field: 'Costo Unitario',
          originalValue: unitCostAmount.errorText,
          severity: 'ERROR',
          description: `El costo unitario del componente '${componentCellText}' (fila ${rowNumber}) contiene un error de fórmula (${unitCostAmount.errorText}). No se convirtió en cero.`,
          recommendedAction: 'Corrija la fórmula en el archivo original.',
          rowNumber,
          column: 'Costo Unitario',
          context: 'Parseo de composición',
        }),
      )
    } else if (unitCostAmount.kind === 'missing') {
      current.localIncidents.push(
        incidentOf(context, {
          code: 'COMPOSITION_UNIT_COST_MISSING',
          field: 'Costo Unitario',
          originalValue: '',
          severity: 'WARNING',
          description: `El componente '${componentCellText}' (fila ${rowNumber}) no tiene costo unitario. Una celda vacía no representa cero.`,
          recommendedAction: 'Complete el costo unitario en el archivo original.',
          rowNumber,
          column: 'Costo Unitario',
          context: 'Parseo de composición',
        }),
      )
    } else if (unitCostAmount.kind === 'unparseable-text') {
      current.localIncidents.push(
        incidentOf(context, {
          code: 'COMPOSITION_UNIT_COST_INVALID',
          field: 'Costo Unitario',
          originalValue: unitCostAmount.errorText,
          severity: 'ERROR',
          description: `El costo unitario del componente '${componentCellText}' (fila ${rowNumber}) no es numérico ('${unitCostAmount.errorText}').`,
          recommendedAction: 'Corrija el valor en el archivo original.',
          rowNumber,
          column: 'Costo Unitario',
          context: 'Parseo de composición',
        }),
      )
    }

    const portionCostCell = rawCell(row, COLS.portionCost)
    const portionCostAmount = parseAmount(portionCostCell)
    if (portionCostAmount.kind === 'formula-error') {
      current.localIncidents.push(
        incidentOf(context, {
          code: 'COMPOSITION_PORTION_COST_FORMULA_ERROR',
          field: 'Costo por Porción',
          originalValue: portionCostAmount.errorText,
          severity: 'ERROR',
          description: `El costo por porción del componente '${componentCellText}' (fila ${rowNumber}) contiene un error de fórmula (${portionCostAmount.errorText}). No se convirtió en cero.`,
          recommendedAction: 'Corrija la fórmula en el archivo original.',
          rowNumber,
          column: 'Costo por Porción',
          context: 'Parseo de composición',
        }),
      )
    } else if (portionCostAmount.kind === 'missing') {
      current.localIncidents.push(
        incidentOf(context, {
          code: 'COMPOSITION_PORTION_COST_MISSING',
          field: 'Costo por Porción',
          originalValue: '',
          severity: 'WARNING',
          description: `El componente '${componentCellText}' (fila ${rowNumber}) no tiene costo por porción. Una celda vacía no representa cero.`,
          recommendedAction: 'Complete el costo por porción en el archivo original.',
          rowNumber,
          column: 'Costo por Porción',
          context: 'Parseo de composición',
        }),
      )
    } else if (portionCostAmount.kind === 'unparseable-text') {
      current.localIncidents.push(
        incidentOf(context, {
          code: 'COMPOSITION_PORTION_COST_INVALID',
          field: 'Costo por Porción',
          originalValue: portionCostAmount.errorText,
          severity: 'ERROR',
          description: `El costo por porción del componente '${componentCellText}' (fila ${rowNumber}) no es numérico ('${portionCostAmount.errorText}').`,
          recommendedAction: 'Corrija el valor en el archivo original.',
          rowNumber,
          column: 'Costo por Porción',
          context: 'Parseo de composición',
        }),
      )
    }

    current.components.push({
      rowNumber,
      componentType,
      originalName: componentCellText,
      standardQuantity: quantityAmount.kind === 'number' ? quantityAmount.number : undefined,
      unit,
      originalUnit: unitRaw,
      unitCostRaw:
        unitCostCell && unitCostCell.type !== 'empty' ? unitCostCell.value : '',
      portionCost:
        portionCostAmount.kind === 'number' ? dollarsToMoney(portionCostAmount.number!) : undefined,
    })
  }

  closeTemplate()

  return {
    templates,
    incidents,
    severity: aggregateSeverity(incidents),
    stats: {
      totalRows: rows.length,
      templates: templates.length,
      components: templates.reduce((n, template) => n + template.components.length, 0),
      validatedTemplates: templates.filter((t) => t.validation !== 'UNVALIDATED').length,
    },
  }
}
