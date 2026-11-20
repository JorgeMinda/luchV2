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
  const refrigerios = workbook.sheets[3]
  
  const ctxR: ParserContext = {
    fileName: 'real-workbook.xlsx',
    sheetName: refrigerios.originalName,
    sheetIndex: refrigerios.index,
    sourceType: 'RECIPE_COSTING',
  }
  
  const resR = parseRecipeCostingSheet(refrigerios.rows, ctxR)
  
  console.log(`Total blocks: ${resR.stats.blocks}`)
  console.log(`Ingredient rows: ${resR.stats.ingredientRows}`)
  console.log(`Loose ingredients: ${resR.stats.looseIngredients}`)
  
  console.log('\n--- Valid blocks ---')
  for (const block of resR.blocks) {
    console.log(`  ${block.titleRow}: "${block.title}" | headerRow: ${block.headerRow} | ingredients: ${block.ingredients.length} | closings: ${block.closingRows.length}`)
    for (const ing of block.ingredients.slice(0, 3)) {
      console.log(`    - ${ing.name}`)
    }
  }
  
  console.log('\n--- Incomplete block incidents ---')
  for (const inc of resR.incidents.filter(i => i.code === 'RECIPE_INCOMPLETE_BLOCK')) {
    console.log(`  Row ${inc.rowNumber}: ${inc.description}`)
  }
  
  // Check header rows
  console.log('\n--- Header detection check (all rows) ---')
  for (let i = 0; i < refrigerios.rows.length; i++) {
    const row = refrigerios.rows[i]
    const colA = row[0]?.value
    const colB = row[1]?.value
    if (colA || colB) {
      console.log(`  Row ${i+1}: A="${colA}" B="${colB}"`)
    }
  }
}

debug().catch(console.error)