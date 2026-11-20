import { readFileSync } from 'node:fs'
import { SpreadsheetFileReader } from '../file-reader/spreadsheet-file-reader'
import { parseRecipeCostingSheet } from './recipe-costing-parser'
import type { ParserContext } from './parser-common'

const REAL_FILE_PATH =
  'C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx'

async function debug() {
  const buffer = readFileSync(REAL_FILE_PATH)
  const file = new File([buffer], 'real-workbook.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  
  const reader = new SpreadsheetFileReader()
  const workbook = await reader.readWorkbook(file)
  const almuerzos = workbook.sheets[1]
  
  const ctxA: ParserContext = {
    fileName: 'real-workbook.xlsx',
    sheetName: almuerzos.originalName,
    sheetIndex: almuerzos.index,
    sourceType: 'RECIPE_COSTING',
  }
  
  const resA = parseRecipeCostingSheet(almuerzos.rows, ctxA)
  
  console.log(`Total blocks: ${resA.stats.blocks}`)
  console.log(`Ingredient rows: ${resA.stats.ingredientRows}`)
  console.log(`Loose ingredients: ${resA.stats.looseIngredients}`)
  
  console.log('\n--- Valid blocks ---')
  for (const block of resA.blocks) {
    console.log(`  ${block.titleRow}: "${block.title}" | headerRow: ${block.headerRow} | ingredients: ${block.ingredients.length} | closings: ${block.closingRows.length}`)
  }
  
  console.log('\n--- Incomplete block incidents ---')
  for (const inc of resA.incidents.filter(i => i.code === 'RECIPE_INCOMPLETE_BLOCK')) {
    console.log(`  Row ${inc.rowNumber}: ${inc.description}`)
  }
  
  // Check first few rows for header detection
  console.log('\n--- Header detection check (rows 1-50) ---')
  for (let i = 0; i < Math.min(50, almuerzos.rows.length); i++) {
    const row = almuerzos.rows[i]
    const colA = row[0]?.value
    const colB = row[1]?.value
    if (colA || colB) {
      console.log(`  Row ${i+1}: A="${colA}" B="${colB}"`)
    }
  }
}

debug().catch(console.error)