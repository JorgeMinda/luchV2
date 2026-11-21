import { SpreadsheetFileReader } from './src/infrastructure/import/file-reader/spreadsheet-file-reader.js'
import { parseRecipeCostingSheet } from './src/infrastructure/import/parsers/recipe-costing-parser.js'
import { readFileSync } from 'fs'

const filePath = 'C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx'
const buffer = readFileSync(filePath)
const file = new File([buffer], 'real-workbook.xlsx')

const reader = new SpreadsheetFileReader()
const workbook = await reader.readWorkbook(file)

const lunchRecipeSheet = workbook.sheets.find(s => s.originalName.includes('COSTEO RECETA ALMUERZOS'))
console.log('Sheet:', lunchRecipeSheet!.originalName, 'Rows:', lunchRecipeSheet!.rows.length)

const context = { fileName: file.name, sheetName: lunchRecipeSheet!.originalName, sheetIndex: lunchRecipeSheet!.index, sourceType: 'RECIPE_COSTING' as const }
const result = parseRecipeCostingSheet(lunchRecipeSheet!.rows, context)
console.log('\n=== RECIPE PARSE RESULT ===')
console.log('Keys:', Object.keys(result))
console.log('Blocks:', result.blocks?.length)
console.log('Incidents:', result.incidents?.length)
if (result.blocks && result.blocks.length > 0) {
  console.log('First block:', JSON.stringify(result.blocks[0], null, 2))
}