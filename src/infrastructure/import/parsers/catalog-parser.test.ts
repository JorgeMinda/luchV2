import { describe, expect, it } from 'vitest'
import { SpreadsheetFileReader } from '../file-reader/spreadsheet-file-reader'
import { fixtureFile } from '../test-utils'
import { parseCatalogSheet } from './catalog-parser'
import type { ParserContext } from './parser-common'
import type { RawSheetData } from '../../../application/ports/import-file-reader-port'

const reader = new SpreadsheetFileReader()

async function loadCatalogSheet(): Promise<RawSheetData> {
  const workbook = await reader.readWorkbook(fixtureFile('menu-fixtures.xlsx'))
  return workbook.sheets[0]
}

const context: ParserContext = {
  fileName: 'menu-fixtures.xlsx',
  sheetName: 'CATALOGO COSTEO 17-08-2',
  sheetIndex: 0,
  sourceType: 'CATALOG',
}

describe('parseCatalogSheet', () => {
  it('parsea todos los ítems del fixture', async () => {
    const sheet = await loadCatalogSheet()
    const result = parseCatalogSheet(sheet.rows, context)

    expect(result.stats.dataRows).toBe(8)
    expect(result.stats.parsedItems).toBe(8)
    expect(result.items).toHaveLength(8)
  })

  it('convierte el costo a Money con centavos enteros', async () => {
    const sheet = await loadCatalogSheet()
    const result = parseCatalogSheet(sheet.rows, context)

    const aceite = result.items[0]
    expect(aceite.product).toBe('ACEITE DE PRUEBA 20 LT')
    expect(aceite.cost?.cents).toBe(3560)

    const arroz = result.items[5]
    expect(arroz.cost?.cents).toBe(125)
  })

  it('no convierte una celda de costo vacía en cero (incidencia WARNING)', async () => {
    const sheet = await loadCatalogSheet()
    const result = parseCatalogSheet(sheet.rows, context)

    const item = result.items[3]
    expect(item.product).toBe('AGUACATE/UNIDAD')
    expect(item.cost).toBeUndefined()
    const missing = result.incidents.filter((i) => i.code === 'CATALOG_COST_MISSING')
    expect(missing).toHaveLength(1)
    expect(missing[0].severity).toBe('WARNING')
    expect(missing[0].provenance?.rowNumber).toBe(5)
  })

  it('preserva #REF! como ERROR sin convertirlo en cero', async () => {
    const sheet = await loadCatalogSheet()
    const result = parseCatalogSheet(sheet.rows, context)

    const item = result.items[4]
    expect(item.cost).toBeUndefined()
    expect(item.costRaw).toBe('#REF!')
    const errors = result.incidents.filter((i) => i.code === 'CATALOG_COST_FORMULA_ERROR')
    expect(errors).toHaveLength(1)
    expect(errors[0].severity).toBe('ERROR')
    expect(errors[0].originalValue).toBe('#REF!')
  })

  it('normaliza estados y advierte estados desconocidos', async () => {
    const sheet = await loadCatalogSheet()
    const result = parseCatalogSheet(sheet.rows, context)

    expect(result.items[0].status).toBe('ACTIVO')
    expect(result.items[5].status).toBe('INACTIVO')
    expect(result.items[6].status).toBe('UNKNOWN')
    expect(result.items[6].originalStatus).toBe('PENDIENTE')
    const unknown = result.incidents.filter((i) => i.code === 'CATALOG_STATUS_UNKNOWN')
    expect(unknown).toHaveLength(1)
    expect(unknown[0].severity).toBe('WARNING')
  })

  it('asigna severidad ERROR cuando hay errores de costo', async () => {
    const sheet = await loadCatalogSheet()
    const result = parseCatalogSheet(sheet.rows, context)
    expect(result.severity).toBe('ERROR')
  })

  it('conserva procedencia (archivo, hoja, fila) en las incidencias', async () => {
    const sheet = await loadCatalogSheet()
    const result = parseCatalogSheet(sheet.rows, context)

    const incident = result.incidents[0]
    expect(incident.provenance?.fileName).toBe('menu-fixtures.xlsx')
    expect(incident.provenance?.sheetName).toBe('CATALOGO COSTEO 17-08-2')
    expect(incident.provenance?.sourceType).toBe('CATALOG')
    expect(incident.provenance?.analysisVersion).toBe('phase3-v1')
  })

  it('detecta columnas faltantes con ERROR', () => {
    const result = parseCatalogSheet(
      [[{ value: 'CÓDIGO', type: 'string' }, { value: 'BODEGA', type: 'string' }]],
      context,
    )
    expect(result.items).toHaveLength(0)
    expect(result.incidents[0].code).toBe('CATALOG_MISSING_COLUMNS')
    expect(result.incidents[0].severity).toBe('ERROR')
  })
})
