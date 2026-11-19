import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { SpreadsheetFileReader } from '../file-reader/spreadsheet-file-reader'
import { parseCatalogSheet } from '../parsers/catalog-parser'
import { parseRecipeCostingSheet } from '../parsers/recipe-costing-parser'
import { parseMenuPlanSheet } from '../parsers/menu-plan-parser'
import { parseMealCompositionSheet } from '../parsers/meal-composition-parser'
import { detectSheetSourceType } from '../file-reader/sheet-type-detector'
import type { ParserContext } from '../parsers/parser-common'

/**
 * Integración real contra el documento original (solo ejecución local).
 * Requiere que el archivo esté en:
 * `C:\Users\minda\Downloads\17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (4).xlsx`
 * Si no existe, la prueba se salta (no bloquea CI).
 */
const REAL_FILE_PATH =
  'C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (4).xlsx'

function fileExists(path: string): boolean {
  try {
    readFileSync(path)
    return true
  } catch {
    return false
  }
}

const reader = new SpreadsheetFileReader()
const REAL_FILE_PRESENT = fileExists(REAL_FILE_PATH)

describe.skipIf(!REAL_FILE_PRESENT)('Real workbook integration — 17-09-2026 YUMISI', () => {
  const workbookPromise = reader.readWorkbook(
    new File([readFileSync(REAL_FILE_PATH)], 'real-workbook.xlsx'),
  )

  it('reconoce las 6 hojas con sus nombres exactos', async () => {
    const workbook = await workbookPromise
    expect(workbook.sheets.map((s) => s.originalName)).toEqual([
      'CATALOGO COSTEO 17-08-2',
      'COSTEO RECETA ALMUERZOS',
      'MENÚ AGSTO-JULIO2026-2027',
      'COSTEO REFRIGERIOS ',
      'MENU REFRIGERIOS',
      'COMPOSICION DE CADA PLATO',
    ])
  })

  it('detecta SourceType correcto por hoja (incluyendo espacio final)', async () => {
    const workbook = await workbookPromise
    const detections = workbook.sheets.map((s) =>
      detectSheetSourceType(s.originalName, s.index),
    )
    expect(detections.map((d) => d.sourceType)).toEqual([
      'CATALOG',
      'RECIPE_COSTING',
      'MENU_PLAN',
      'RECIPE_COSTING',
      'MENU_PLAN',
      'MEAL_COMPOSITION',
    ])
  })

  it('CATALOG: 461 ítems con costos a Money', async () => {
    const workbook = await workbookPromise
    const sheet = workbook.sheets[0]
    const context: ParserContext = {
      fileName: 'real-workbook.xlsx',
      sheetName: sheet.originalName,
      sheetIndex: sheet.index,
      sourceType: 'CATALOG',
    }
    const result = parseCatalogSheet(sheet.rows, context)
    expect(result.stats.parsedItems).toBe(461)
    expect(result.stats.itemsWithCost).toBeGreaterThan(0)
  })

  it('RECIPE_COSTING: 249 bloques almuerzos + 10 refrigerios', async () => {
    const workbook = await workbookPromise
    const almuerzos = workbook.sheets[1]
    const refrigerios = workbook.sheets[3]
    const ctxA: ParserContext = {
      fileName: 'real-workbook.xlsx',
      sheetName: almuerzos.originalName,
      sheetIndex: almuerzos.index,
      sourceType: 'RECIPE_COSTING',
    }
    const ctxR: ParserContext = { ...ctxA, sheetName: refrigerios.originalName, sheetIndex: refrigerios.index }
    const resA = parseRecipeCostingSheet(almuerzos.rows, ctxA)
    const resR = parseRecipeCostingSheet(refrigerios.rows, ctxR)
    expect(resA.stats.blocks).toBe(249)
    expect(resR.stats.blocks).toBe(10)
  })

  it('MENU_PLAN: estructura del menú anual (14 semanas detectadas)', async () => {
    const workbook = await workbookPromise
    const anual = workbook.sheets[2]
    const ctxA: ParserContext = {
      fileName: 'real-workbook.xlsx',
      sheetName: anual.originalName,
      sheetIndex: anual.index,
      sourceType: 'MENU_PLAN',
    }
    const resA = parseMenuPlanSheet(anual.rows, ctxA)
    // El parser ahora detecta correctamente 14 bloques semanales ("SEMANA 1" a "SEMANA 14")
    // y las 884 celdas #REF! se detectan correctamente.
    expect(resA.stats.formulaErrorCells).toBe(884)
    expect(resA.stats.weekBlocks).toBe(14)
    // Verifica que al menos algunas semanas tengan weekStartDate válido (lunes)
    // (algunas semanas en el documento real pueden no tener fila de fechas parseable)
    const weeksWithStartDate = resA.weeks.filter(w => w.weekStartDate.match(/^\d{4}-\d{2}-\d{2}$/))
    expect(weeksWithStartDate.length).toBeGreaterThan(0)
  })

  it('MEAL_COMPOSITION: 4 plantillas con gramajes y costos reales', async () => {
    const workbook = await workbookPromise
    const sheet = workbook.sheets[5]
    const context: ParserContext = {
      fileName: 'real-workbook.xlsx',
      sheetName: sheet.originalName,
      sheetIndex: sheet.index,
      sourceType: 'MEAL_COMPOSITION',
    }
    const result = parseMealCompositionSheet(sheet.rows, context)
    expect(result.stats.templates).toBe(4)
    expect(result.stats.components).toBeGreaterThan(20)
    // Cada plantilla tiene objetivo y componentes
    for (const template of result.templates) {
      expect(template.sheetTargetTotal).toBeDefined()
      expect(template.components.length).toBeGreaterThan(0)
    }
  })
})

// Si el archivo no está presente, la suite se salta y se informa en el reporte.
describe.skipIf(REAL_FILE_PRESENT)('Real workbook integration — archivo no disponible', () => {
  it('archivo real no encontrado en la ruta esperada; prueba omitida', () => {
    expect(true).toBe(true)
  })
})