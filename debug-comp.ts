import { SpreadsheetFileReader } from './src/infrastructure/import/file-reader/spreadsheet-file-reader.js'
import { parseMealCompositionSheet } from './src/infrastructure/import/parsers/meal-composition-parser.js'
import { readFileSync } from 'fs'

const filePath = 'C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx'
const buffer = readFileSync(filePath)
const file = new File([buffer], 'real-workbook.xlsx')

const reader = new SpreadsheetFileReader()
const workbook = await reader.readWorkbook(file)

const compositionSheet = workbook.sheets.find(s => s.originalName.includes('COMPOSICION'))
console.log('Composition Sheet:', compositionSheet!.originalName, 'Rows:', compositionSheet!.rows.length)

const context = { fileName: file.name, sheetName: compositionSheet!.originalName, sheetIndex: compositionSheet!.index, sourceType: 'MEAL_COMPOSITION' as const }
const compResult = parseMealCompositionSheet(compositionSheet!.rows, context)

console.log('Templates:', compResult.templates.length)
for (const t of compResult.templates) {
  console.log(`\nTemplate: ${t.name} (${t.serviceType})`)
  console.log(`  Target total:`, t.sheetTargetTotal)
  console.log(`  Calculated total:`, t.calculatedTotal)
  for (const c of t.components) {
    console.log(`  Component: ${c.originalName} (${c.componentType})`)
    console.log(`    standardQuantity: ${c.standardQuantity}`)
    console.log(`    unit: ${c.unit}`)
    console.log(`    unitCostRaw: ${c.unitCostRaw}`)
    console.log(`    portionCost:`, c.portionCost)
    console.log(`    sourceFormula: ${c.sourceFormula}`)
    console.log(`    sourceCell: ${c.sourceCell}`)
    console.log(`    rowNumber: ${c.rowNumber}`)
  }
}