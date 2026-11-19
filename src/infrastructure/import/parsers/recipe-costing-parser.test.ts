import { describe, expect, it } from 'vitest'
import { SpreadsheetFileReader } from '../file-reader/spreadsheet-file-reader'
import { fixtureFile } from '../test-utils'
import { parseRecipeCostingSheet } from './recipe-costing-parser'
import type { ParserContext } from './parser-common'
import type { RawSheetData } from '../../../application/ports/import-file-reader-port'

const reader = new SpreadsheetFileReader()

async function loadSheets(): Promise<{ almuerzos: RawSheetData; refrigerios: RawSheetData }> {
  const workbook = await reader.readWorkbook(fixtureFile('menu-fixtures.xlsx'))
  return { almuerzos: workbook.sheets[1], refrigerios: workbook.sheets[3] }
}

const context: ParserContext = {
  fileName: 'menu-fixtures.xlsx',
  sheetName: 'COSTEO RECETA ALMUERZOS',
  sheetIndex: 1,
  sourceType: 'RECIPE_COSTING',
}

describe('parseRecipeCostingSheet', () => {
  it('detecta los bloques de receta por título y encabezado de ingredientes', async () => {
    const { almuerzos } = await loadSheets()
    const result = parseRecipeCostingSheet(almuerzos.rows, context)

    expect(result.stats.blocks).toBe(2)
    expect(result.blocks.map((b) => b.title)).toEqual([
      'SOPA DE PRUEBA/12 ONZAS',
      'ARROZ/35 GRAMOS',
    ])
  })

  it('parsea ingredientes con Money en centavos enteros', async () => {
    const { almuerzos } = await loadSheets()
    const result = parseRecipeCostingSheet(almuerzos.rows, context)

    const first = result.blocks[0].ingredients[0]
    expect(first.name).toBe('HUESO DE RES 1 KILO')
    expect(first.purchasePresentation).toBe('1kg')
    expect(first.purchasePrice?.cents).toBe(145)
    expect(first.purchaseQuantity).toBe(1000)
    expect(first.recipeQuantity).toBe(25)
    expect(first.recipeCost?.cents).toBe(4)
  })

  it('marca las filas con #DIV/0! como ERROR sin convertir el error en cero', async () => {
    const { almuerzos } = await loadSheets()
    const result = parseRecipeCostingSheet(almuerzos.rows, context)

    const divRows = result.incidents.filter((i) => i.code === 'RECIPE_DIV_ZERO')
    expect(divRows).toHaveLength(1)
    expect(divRows[0].severity).toBe('ERROR')
    expect(divRows[0].originalValue).toBe('INGREDIENTE DIV CERO')
    expect(divRows[0].provenance?.rowNumber).toBe(8)
    expect(result.severity).toBe('ERROR')
  })

  it('clasifica las filas de cierre como subtotal, +5% y +3%, nunca como ingredientes', async () => {
    const { almuerzos } = await loadSheets()
    const result = parseRecipeCostingSheet(almuerzos.rows, context)

    const block = result.blocks[0]
    expect(block.ingredients.map((i) => i.name)).not.toContain('subtotal')

    const subtotal = block.closingRows.find((r) => r.type === 'SUBTOTAL')
    const recharge5 = block.closingRows.find((r) => r.type === 'RECHARGE_5')
    const recharge3 = block.closingRows.find((r) => r.type === 'RECHARGE_3')
    expect(subtotal?.value?.cents).toBe(50)
    expect(recharge5?.value?.cents).toBe(3) // 2.5 redondeado a 3
    expect(recharge3?.value?.cents).toBe(2) // 1.5 redondeado a 2
    expect(block.recharge5?.cents).toBe(3)
    expect(block.recharge3?.cents).toBe(2)
  })

  it('registra incidencia para filas de cierre no numéricas ($ -)', async () => {
    const { almuerzos } = await loadSheets()
    const result = parseRecipeCostingSheet(almuerzos.rows, context)

    const unparsed = result.incidents.filter((i) => i.code === 'RECIPE_CLOSING_ROW_UNCLASSIFIED')
    // Dos bloques, cada uno con una fila '$ -'
    expect(unparsed.length).toBeGreaterThanOrEqual(2)
    expect(unparsed[0].severity).toBe('WARNING')
    expect(unparsed[0].originalValue).toBe('$ -')
  })

  it('ignora las columnas auxiliares 8–25 y sus errores #VALUE!', async () => {
    const { almuerzos } = await loadSheets()
    const result = parseRecipeCostingSheet(almuerzos.rows, context)

    // El #VALUE! auxiliar no genera incidencias de ingredientes ni costos.
    const ingredientIncidents = result.incidents.filter((i) =>
      ['RECIPE_DIV_ZERO', 'RECIPE_FORMULA_ERROR'].includes(i.code),
    )
    expect(ingredientIncidents).toHaveLength(1) // solo la fila #DIV/0!
    // Ningún ingrediente proviene de la columna auxiliar.
    for (const block of result.blocks) {
      for (const ingredient of block.ingredients) {
        expect(ingredient.name).not.toBe('#VALUE!')
        expect(ingredient.name).not.toBe('')
      }
    }
  })

  it('parsea el bloque de la hoja con espacio final (COSTEO REFRIGERIOS )', async () => {
    const { refrigerios } = await loadSheets()
    const result = parseRecipeCostingSheet(refrigerios.rows, {
      ...context,
      sheetName: 'COSTEO REFRIGERIOS ',
    })

    expect(result.stats.blocks).toBe(1)
    expect(result.blocks[0].title).toBe('GRANOLA-YOGURT-ENSALADA DE FRUTAS')
    expect(result.blocks[0].ingredients[0].purchasePrice?.cents).toBe(195)
    expect(result.blocks[0].subtotal?.cents).toBe(36)
  })

  it('conserva trazabilidad de filas en ingredientes y cierres', async () => {
    const { almuerzos } = await loadSheets()
    const result = parseRecipeCostingSheet(almuerzos.rows, context)

    const block = result.blocks[0]
    expect(block.ingredients[0].rowNumber).toBe(5)
    expect(block.closingRows[0].rowNumber).toBe(9)
  })
})
