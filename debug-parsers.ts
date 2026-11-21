import { SpreadsheetFileReader } from './src/infrastructure/import/file-reader/spreadsheet-file-reader.js'
import { parseCatalogSheet } from './src/infrastructure/import/parsers/catalog-parser.js'
import { parseRecipeCostingSheet } from './src/infrastructure/import/parsers/recipe-costing-parser.js'
import { parseMenuPlanSheet } from './src/infrastructure/import/parsers/menu-plan-parser.js'
import { parseMealCompositionSheet } from './src/infrastructure/import/parsers/meal-composition-parser.js'
import { readFileSync } from 'fs'

const filePath = 'C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx'
const buffer = readFileSync(filePath)
const file = new File([buffer], 'real-workbook.xlsx')

const reader = new SpreadsheetFileReader()
const workbook = await reader.readWorkbook(file)

const catalogSheet = workbook.sheets.find(s => s.originalName.includes('CATALOGO'))
console.log('=== CATALOG SHEET ===')
console.log('Rows:', catalogSheet!.rows.length)
console.log('First row cells:', catalogSheet!.rows[0]?.cells?.map(c => ({ v: c.value, f: c.formula, addr: c.sourceCell })))
console.log('Row 1 (header):', catalogSheet!.rows[1]?.cells?.map(c => ({ v: c.value, f: c.formula, addr: c.sourceCell })))
console.log('Row 2 (data):', catalogSheet!.rows[2]?.cells?.map(c => ({ v: c.value, f: c.formula, addr: c.sourceCell })))

const context = { fileName: file.name, sheetName: catalogSheet!.originalName, sheetIndex: catalogSheet!.index, sourceType: 'CATALOG' as const }
const result = parseCatalogSheet(catalogSheet!.rows, context)
console.log('\n=== PARSE RESULT ===')
console.log('Items:', result.items.length)
console.log('Valid items:', result.items.filter(i => i.costCents !== undefined).length)
console.log('Incidents:', result.incidents.length)
if (result.items.length > 0) {
  console.log('First item:', result.items[0])
}
console.log('Incidents:', result.incidents.slice(0, 5))