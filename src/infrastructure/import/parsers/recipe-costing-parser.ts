/**
 * Parser de RECIPE_COSTING (hojas `COSTEO RECETA ALMUERZOS` y
 * `COSTEO REFRIGERIOS `).
 *
 * Estructura real por bloque:
 *   - Fila de título del plato en la columna A.
 *   - Fila en blanco.
 *   - Encabezado: `Ingrediente | Presentación de compra | PVP compra |
 *     Cantidad de compra-presentación | Costo por gr-o unidad |
 *     Cantidad en receta | Costo en receta`.
 *   - Filas de ingredientes.
 *   - Filas de cierre (columna G): subtotal, +5%, +3%, total, marcador, total.
 *
 * Reglas:
 * - Las columnas auxiliares 8–25 (índices 7–24) se ignoran para el cálculo de
 *   ingredientes; sus errores (#VALUE!) no se interpretan como ingredientes
 *   ni como costos válidos.
 * - `#DIV/0!` marca la fila como ERROR (típicamente con cantidad de compra
 *   cero o vacía); no se reemplaza por cero.
 * - Las filas de cierre se representan como recargos/componentes de costo,
 *   nunca como ingredientes.
 * - Cada bloque y cada fila conservan trazabilidad (fila de origen).
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
  parseAmount,
  rawCell,
  type ParserContext,
} from './parser-common'

const INGREDIENT_COLS = {
  name: 0,
  purchasePresentation: 1,
  purchasePrice: 2,
  purchaseQuantity: 3,
  unitCost: 4,
  recipeQuantity: 5,
  recipeCost: 6,
} as const

/** Cols 0–6 son de ingredientes; los índices 7–24 son auxiliares (ignorados). */

export interface ParsedRecipeIngredientRow {
  readonly rowNumber: number
  readonly name: string
  readonly purchasePresentation: string
  readonly purchasePriceRaw: unknown
  readonly purchasePrice?: Money
  readonly purchaseQuantity?: number
  readonly unitCostRaw: unknown
  readonly recipeQuantity?: number
  readonly recipeCostRaw: unknown
  readonly recipeCost?: Money
}

export type ClosingRowType =
  | 'SUBTOTAL'
  | 'RECHARGE_5'
  | 'RECHARGE_3'
  | 'TOTAL'
  | 'UNCLASSIFIED'

export interface ParsedClosingRow {
  readonly rowNumber: number
  readonly type: ClosingRowType
  readonly rawValue: unknown
  /** Valor numérico en dólares cuando la celda es numérica. */
  readonly rawNumber?: number
  readonly value?: Money
}

export interface ParsedRecipeBlock {
  readonly titleRow: number
  readonly title: string
  readonly headerRow: number
  readonly ingredients: readonly ParsedRecipeIngredientRow[]
  readonly closingRows: readonly ParsedClosingRow[]
  readonly subtotal?: Money
  readonly recharge5?: Money
  readonly recharge3?: Money
}

export interface RecipeCostingParseResult {
  readonly blocks: readonly ParsedRecipeBlock[]
  readonly incidents: readonly ImportIncident[]
  readonly severity: 'VALID' | 'WARNING' | 'ERROR'
  readonly stats: {
    readonly totalRows: number
    readonly blocks: number
    readonly ingredientRows: number
    readonly errorIncidents: number
    readonly looseIngredients: number
  }
}

function isIngredientHeaderRow(row: readonly RawCell[]): boolean {
  const first = canonicalText(cellText(row, 0))
  const second = canonicalText(cellText(row, 1))
  return first === 'ingrediente' && second.startsWith('presentacion')
}

/** Fila de cierre: columnas A–F vacías y columna G con contenido. */
function isClosingCandidateRow(row: readonly RawCell[]): boolean {
  const aToFEmpty = [0, 1, 2, 3, 4, 5].every((col) => cellText(row, col) === '')
  const gCell = rawCell(row, INGREDIENT_COLS.recipeCost)
  return aToFEmpty && gCell !== undefined && gCell.type !== 'empty'
}

function isRowEmpty(row: readonly RawCell[]): boolean {
  return row.every((cell) => !cell || cell.type === 'empty')
}

/** Detecta filas de separador de semana (ej. "SEMANA 2 / DEL 11 AL 15 DE AGOSTO") */
function isWeekSeparatorRow(row: readonly RawCell[]): boolean {
  const colA = canonicalText(cellText(row, 0))
  return colA.startsWith('semana') && colA.includes('del')
}

interface OpenBlock {
  titleRow: number
  title: string
  headerRow: number
  ingredients: ParsedRecipeIngredientRow[]
  closingRaw: ParsedClosingRow[]
  /** Indica si el bloque tiene estructura válida (título + header + al menos 1 ingrediente) */
  isValidStructure: boolean
  /** Indica si se detectó el header canónico de ingredientes */
  hasCanonicalHeader: boolean
}

interface ClosingClassification {
  readonly rows: readonly ParsedClosingRow[]
  readonly incidents: readonly ImportIncident[]
}

/**
 * Clasifica las filas de cierre por estructura y verificación de recargos,
 * usando los valores numéricos en crudo (no Money redondeado):
 * la primera fila es SUBTOTAL; las siguientes se reconocen como +5% (≈0.05×),
 * +3% (≈0.03×) o TOTAL (≈1.08× o ≈1× del subtotal). Las filas no numéricas
 * (ej. el marcador `$ -`) se dejan UNCLASSIFIED con incidencia informativa.
 */
function classifyClosingRows(
  closing: readonly ParsedClosingRow[],
  context: ParserContext,
  blockTitle: string,
): ClosingClassification {
  const incidents: ImportIncident[] = []
  const rows: ParsedClosingRow[] = closing.map((row) => ({ ...row }))

  const subtotalRow = rows[0]
  if (subtotalRow) {
    rows[0] = { ...subtotalRow, type: 'SUBTOTAL' }
  }

  const subtotalRaw = subtotalRow?.rawNumber

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    let classified = false

    if (row.rawNumber !== undefined && subtotalRaw !== undefined && subtotalRaw > 0) {
      const ratio = row.rawNumber / subtotalRaw
      if (Math.abs(ratio - 0.05) < 0.002) {
        rows[i] = { ...row, type: 'RECHARGE_5' }
        classified = true
      } else if (Math.abs(ratio - 0.03) < 0.002) {
        rows[i] = { ...row, type: 'RECHARGE_3' }
        classified = true
      } else if (Math.abs(ratio - 1.08) < 0.005 || Math.abs(ratio - 1) < 0.002) {
        rows[i] = { ...row, type: 'TOTAL' }
        classified = true
      }
    }

    if (!classified) {
      const severity = row.rawNumber === undefined ? 'WARNING' : 'WARNING'
      incidents.push(
        incidentOf(context, {
          code: 'RECIPE_CLOSING_ROW_UNCLASSIFIED',
          field: 'Costo en receta',
          originalValue: row.rawValue,
          severity,
          description:
            row.rawNumber === undefined
              ? `La fila de cierre (fila ${row.rowNumber}) del bloque '${blockTitle}' contiene un valor no numérico ('${String(row.rawValue)}'); no se convirtió en cero.`
              : `La fila de cierre (fila ${row.rowNumber}) del bloque '${blockTitle}' no se pudo clasificar (subtotal, +5%, +3% o total).`,
          recommendedAction: 'Revise la fila de cierre en el archivo original.',
          rowNumber: row.rowNumber,
          column: 'G',
          context: 'Clasificación de filas de cierre',
        }),
      )
    }
  }

  return { rows, incidents }
}

/** Registra ingredientes sueltos (sin bloque de receta) para trazabilidad */
interface LooseIngredient {
  rowNumber: number
  name: string
  purchasePriceRaw: unknown
  recipeCostRaw: unknown
}

export function parseRecipeCostingSheet(
  rows: readonly (readonly RawCell[])[],
  context: ParserContext,
): RecipeCostingParseResult {
  const incidents: ImportIncident[] = []
  const blocks: ParsedRecipeBlock[] = []
  const looseIngredients: LooseIngredient[] = []

  let current: OpenBlock | null = null

  const closeBlock = () => {
    const block = current
    if (!block) return
    // Solo cerrar como bloque válido si tiene estructura completa:
    // título + header canónico + al menos 1 ingrediente + filas de cierre
    if (block.isValidStructure && block.hasCanonicalHeader && block.ingredients.length > 0 && block.closingRaw.length > 0) {
      const classification = classifyClosingRows(block.closingRaw, context, block.title)
      incidents.push(...classification.incidents)
      blocks.push({
        titleRow: block.titleRow,
        title: block.title,
        headerRow: block.headerRow,
        ingredients: block.ingredients,
        closingRows: classification.rows,
        subtotal: classification.rows.find((r) => r.type === 'SUBTOTAL')?.value,
        recharge5: classification.rows.find((r) => r.type === 'RECHARGE_5')?.value,
        recharge3: classification.rows.find((r) => r.type === 'RECHARGE_3')?.value,
      })
    } else if (block.ingredients.length > 0 || block.closingRaw.length > 0) {
      // Bloque incompleto: registrar como incidencia pero no como bloque válido
      incidents.push(
        incidentOf(context, {
          code: 'RECIPE_INCOMPLETE_BLOCK',
          field: 'Estructura',
          originalValue: block.title || '(sin título)',
          severity: 'WARNING',
          description: `Bloque incompleto detectado desde fila ${block.titleRow} ('${block.title || 'sin título'}'): ${block.headerRow > 0 ? 'con header' : 'sin header'}, ${block.ingredients.length} ingredientes, ${block.closingRaw.length} filas de cierre. No se cuenta como receta válida.`,
          recommendedAction: 'Revise la estructura del bloque en el archivo original.',
          rowNumber: block.titleRow,
          context: 'Parseo de bloques de receta',
        }),
      )
      // Los ingredientes de bloques incompletos se pasan a sueltos para no perderlos
      for (const ing of block.ingredients) {
        looseIngredients.push({
          rowNumber: ing.rowNumber,
          name: ing.name,
          purchasePriceRaw: ing.purchasePriceRaw,
          recipeCostRaw: ing.recipeCostRaw,
        })
      }
    }
    current = null
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    const rowNumber = rowIndex + 1
    const colA = cellText(row, INGREDIENT_COLS.name)

    // Saltar separadores de semana
    if (isWeekSeparatorRow(row)) {
      continue
    }

    if (isIngredientHeaderRow(row)) {
      if (current === null) {
        // Header sin título previo: iniciar bloque esperando título anterior
        current = {
          titleRow: rowNumber,
          title: '',
          headerRow: rowNumber,
          ingredients: [],
          closingRaw: [],
          isValidStructure: false,
          hasCanonicalHeader: true,
        }
      } else if (current.headerRow === 0) {
        // Primer header del bloque actual
        current.headerRow = rowNumber
        current.hasCanonicalHeader = true
        current.isValidStructure = current.title !== ''
      } else {
        // Header duplicado: cerrar bloque anterior e iniciar nuevo
        closeBlock()
        current = {
          titleRow: rowNumber,
          title: '',
          headerRow: rowNumber,
          ingredients: [],
          closingRaw: [],
          isValidStructure: false,
          hasCanonicalHeader: true,
        }
      }
      continue
    }

    if (current === null) {
      // Sin bloque abierto: si hay contenido en A, podría ser título de futuro bloque
      // PERO solo si NO es un ingrediente suelto (que no tiene header posterior)
      // Los ingredientes sueltos al inicio de la hoja no tienen header siguiente
      // Los guardamos como sueltos y esperamos un header para iniciar bloque real
      if (colA !== '') {
        // Verificar si las próximas filas tienen un header
        let hasHeaderAhead = false
        for (let lookahead = rowIndex + 1; lookahead < Math.min(rowIndex + 10, rows.length); lookahead++) {
          if (isIngredientHeaderRow(rows[lookahead])) {
            hasHeaderAhead = true
            break
          }
          if (cellText(rows[lookahead], INGREDIENT_COLS.name) !== '' && !isWeekSeparatorRow(rows[lookahead])) {
            // Otro contenido antes del header: probablemente ingrediente suelto
            break
          }
        }
        if (hasHeaderAhead) {
          current = {
            titleRow: rowNumber,
            title: colA,
            headerRow: 0,
            ingredients: [],
            closingRaw: [],
            isValidStructure: false, // Se marca true solo cuando se encuentra header canónico
            hasCanonicalHeader: false,
          }
        } else {
          // Ingrediente suelto sin header posterior
          const purchasePriceCell = rawCell(row, INGREDIENT_COLS.purchasePrice)
          const recipeCostCell = rawCell(row, INGREDIENT_COLS.recipeCost)
          looseIngredients.push({
            rowNumber,
            name: colA,
            purchasePriceRaw: purchasePriceCell && purchasePriceCell.type !== 'empty' ? purchasePriceCell.value : '',
            recipeCostRaw: recipeCostCell && recipeCostCell.type !== 'empty' ? recipeCostCell.value : '',
          })
        }
      }
      continue
    }

    // Bloque abierto sin encabezado todavía: refinamiento del título.
    if (current.headerRow === 0) {
      if (colA !== '') {
        current.title = colA
        current.titleRow = rowNumber
        // isValidStructure se marca true solo cuando se encuentra header canónico
      }
      continue
    }

    if (isClosingCandidateRow(row)) {
      const gCell = rawCell(row, INGREDIENT_COLS.recipeCost)!
      const amount = parseAmount(gCell)
      current.closingRaw.push({
        rowNumber,
        type: 'UNCLASSIFIED',
        rawValue: gCell.value,
        rawNumber: amount.kind === 'number' ? amount.number : undefined,
        value: amount.kind === 'number' ? dollarsToMoney(amount.number!) : undefined,
      })
      continue
    }

    if (colA === '') {
      if (!isRowEmpty(row)) {
        incidents.push(
          incidentOf(context, {
            code: 'RECIPE_UNRECOGNIZED_ROW',
            field: 'A',
            originalValue: row.slice(0, 7).map((c) => (c ? c.value : '')).join('|'),
            severity: 'WARNING',
            description: `Fila ${rowNumber} con contenido no reconocido dentro del bloque '${current.title}'.`,
            recommendedAction: 'Revise la fila en el archivo original.',
            rowNumber,
            context: 'Parseo de bloques de receta',
          }),
        )
      }
      continue
    }

    // Tras las filas de cierre, una fila con contenido en A inicia el
    // siguiente bloque (título del nuevo plato).
    if (current.closingRaw.length > 0) {
      closeBlock()
      // Verificar si la nueva fila tiene header posterior
      let hasHeaderAhead = false
      for (let lookahead = rowIndex + 1; lookahead < Math.min(rowIndex + 10, rows.length); lookahead++) {
        if (isIngredientHeaderRow(rows[lookahead])) {
          hasHeaderAhead = true
          break
        }
        if (cellText(rows[lookahead], INGREDIENT_COLS.name) !== '' && !isWeekSeparatorRow(rows[lookahead])) {
          break
        }
      }
      if (hasHeaderAhead) {
        current = {
          titleRow: rowNumber,
          title: colA,
          headerRow: 0,
          ingredients: [],
          closingRaw: [],
          isValidStructure: false,
          hasCanonicalHeader: false,
        }
      } else {
        // Ingrediente suelto
        const purchasePriceCell = rawCell(row, INGREDIENT_COLS.purchasePrice)
        const recipeCostCell = rawCell(row, INGREDIENT_COLS.recipeCost)
        looseIngredients.push({
          rowNumber,
          name: colA,
          purchasePriceRaw: purchasePriceCell && purchasePriceCell.type !== 'empty' ? purchasePriceCell.value : '',
          recipeCostRaw: recipeCostCell && recipeCostCell.type !== 'empty' ? recipeCostCell.value : '',
        })
        current = null
      }
      continue
    }

    const rowIncidents: ImportIncident[] = []
    const purchasePriceCell = rawCell(row, INGREDIENT_COLS.purchasePrice)
    const purchasePriceAmount = parseAmount(purchasePriceCell)
    const purchaseQuantityCell = rawCell(row, INGREDIENT_COLS.purchaseQuantity)
    const purchaseQuantityAmount = parseAmount(purchaseQuantityCell)
    const recipeQuantityCell = rawCell(row, INGREDIENT_COLS.recipeQuantity)
    const recipeQuantityAmount = parseAmount(recipeQuantityCell)
    const recipeCostCell = rawCell(row, INGREDIENT_COLS.recipeCost)
    const recipeCostAmount = parseAmount(recipeCostCell)
    const unitCostCell = rawCell(row, INGREDIENT_COLS.unitCost)

    // #DIV/0! en cualquier columna del ingrediente marca la fila como ERROR.
    const ingredientCells = [purchasePriceCell, purchaseQuantityCell, unitCostCell, recipeQuantityCell, recipeCostCell]
    const hasDivZero = ingredientCells.some(
      (cell) => cell?.type === 'error' && canonicalText(String(cell.value)) === '#div/0!',
    )
    const hasAnyFormulaError = ingredientCells.some((cell) => cell?.type === 'error')

    if (hasDivZero) {
      rowIncidents.push(
        incidentOf(context, {
          code: 'RECIPE_DIV_ZERO',
          field: 'Ingrediente',
          originalValue: colA,
          severity: 'ERROR',
          description: `La fila del ingrediente '${colA}' (fila ${rowNumber}) contiene #DIV/0!, típicamente por 'Cantidad de compra-presentación' en cero o vacía. No se reemplazó por cero.`,
          recommendedAction: 'Corrija la cantidad de compra en el archivo original y vuelva a cargarlo.',
          rowNumber,
          context: 'Parseo de bloques de receta',
        }),
      )
    } else if (hasAnyFormulaError) {
      const errorTexts = ingredientCells
        .filter((cell) => cell?.type === 'error')
        .map((cell) => String(cell?.value))
      rowIncidents.push(
        incidentOf(context, {
          code: 'RECIPE_FORMULA_ERROR',
          field: 'Ingrediente',
          originalValue: errorTexts.join(', '),
          severity: 'ERROR',
          description: `La fila del ingrediente '${colA}' (fila ${rowNumber}) contiene errores de fórmula (${errorTexts.join(', ')}). No se convirtieron en cero.`,
          recommendedAction: 'Corrija las fórmulas en el archivo original y vuelva a cargarlo.',
          rowNumber,
          context: 'Parseo de bloques de receta',
        }),
      )
    }

    if (purchasePriceAmount.kind === 'missing') {
      rowIncidents.push(
        incidentOf(context, {
          code: 'RECIPE_PURCHASE_PRICE_MISSING',
          field: 'PVP compra',
          originalValue: '',
          severity: 'WARNING',
          description: `El ingrediente '${colA}' (fila ${rowNumber}) no tiene PVP de compra. Una celda vacía no representa cero.`,
          recommendedAction: 'Complete el PVP de compra en el archivo original.',
          rowNumber,
          context: 'Parseo de bloques de receta',
        }),
      )
    } else if (purchasePriceAmount.kind === 'unparseable-text') {
      rowIncidents.push(
        incidentOf(context, {
          code: 'RECIPE_PURCHASE_PRICE_INVALID',
          field: 'PVP compra',
          originalValue: purchasePriceAmount.errorText,
          severity: 'ERROR',
          description: `El PVP de compra del ingrediente '${colA}' (fila ${rowNumber}) no es numérico ('${purchasePriceAmount.errorText}').`,
          recommendedAction: 'Corrija el valor en el archivo original.',
          rowNumber,
          context: 'Parseo de bloques de receta',
        }),
      )
    }

    const purchaseQuantity =
      purchaseQuantityAmount.kind === 'number' && purchaseQuantityAmount.number! > 0
        ? purchaseQuantityAmount.number
        : undefined
    if (purchaseQuantityAmount.kind === 'number' && purchaseQuantityAmount.number! <= 0) {
      rowIncidents.push(
        incidentOf(context, {
          code: 'RECIPE_PURCHASE_QUANTITY_ZERO',
          field: 'Cantidad de compra-presentación',
          originalValue: purchaseQuantityAmount.number,
          severity: 'ERROR',
          description: `La cantidad de compra del ingrediente '${colA}' (fila ${rowNumber}) es cero; el costo unitario no puede calcularse.`,
          recommendedAction: 'Corrija la cantidad de compra en el archivo original.',
          rowNumber,
          context: 'Parseo de bloques de receta',
        }),
      )
    } else if (purchaseQuantityAmount.kind === 'missing') {
      rowIncidents.push(
        incidentOf(context, {
          code: 'RECIPE_PURCHASE_QUANTITY_MISSING',
          field: 'Cantidad de compra-presentación',
          originalValue: '',
          severity: 'WARNING',
          description: `La cantidad de compra del ingrediente '${colA}' (fila ${rowNumber}) está vacía.`,
          recommendedAction: 'Complete la cantidad de compra en el archivo original.',
          rowNumber,
          context: 'Parseo de bloques de receta',
        }),
      )
    }

    current.ingredients.push({
      rowNumber,
      name: colA,
      purchasePresentation: cellText(row, INGREDIENT_COLS.purchasePresentation),
      purchasePriceRaw:
        purchasePriceCell && purchasePriceCell.type !== 'empty' ? purchasePriceCell.value : '',
      purchasePrice:
        purchasePriceAmount.kind === 'number' ? dollarsToMoney(purchasePriceAmount.number!) : undefined,
      purchaseQuantity,
      unitCostRaw: unitCostCell && unitCostCell.type !== 'empty' ? unitCostCell.value : '',
      recipeQuantity: recipeQuantityAmount.kind === 'number' ? recipeQuantityAmount.number : undefined,
      recipeCostRaw: recipeCostCell && recipeCostCell.type !== 'empty' ? recipeCostCell.value : '',
      recipeCost: recipeCostAmount.kind === 'number' ? dollarsToMoney(recipeCostAmount.number!) : undefined,
    })
    incidents.push(...rowIncidents)
  }

  closeBlock()

  // Registrar ingredientes sueltos como incidencias de trazabilidad
  if (looseIngredients.length > 0) {
    incidents.push(
      incidentOf(context, {
        code: 'RECIPE_LOOSE_INGREDIENTS',
        field: 'Ingredientes sin bloque',
        originalValue: `${looseIngredients.length} ingredientes`,
        severity: 'WARNING',
        description: `Se detectaron ${looseIngredients.length} ingredientes sueltos (sin estructura de receta completa: título + header + ingredientes + cierre). Se conservan para trazabilidad pero no forman recetas válidas.`,
        recommendedAction: 'Revise si estos ingredientes pertenecen a recetas no detectadas o son referencias de catálogo.',
        context: 'Parseo de bloques de receta',
      }),
    )
  }

  return {
    blocks,
    incidents,
    severity: aggregateSeverity(incidents),
    stats: {
      totalRows: rows.length,
      blocks: blocks.length,
      ingredientRows: blocks.reduce((n, block) => n + block.ingredients.length, 0),
      errorIncidents: incidents.filter((i) => i.severity === 'ERROR').length,
      looseIngredients: looseIngredients.length,
    },
  }
}
