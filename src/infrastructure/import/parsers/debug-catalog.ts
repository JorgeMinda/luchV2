import { readFileSync } from 'node:fs'
import { SpreadsheetFileReader } from '../file-reader/spreadsheet-file-reader'
import { parseCatalogSheet } from './catalog-parser'
import type { ParserContext } from './parser-common'

const REAL_FILE_PATH =
  'C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx'

async function debug() {
  const buffer = readFileSync(REAL_FILE_PATH)
  const file = new File([buffer], 'real-workbook.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  
  const reader = new SpreadsheetFileReader()
  const workbook = await reader.readWorkbook(file)
  const catalog = workbook.sheets[0]
  
  const ctx: ParserContext = {
    fileName: 'real-workbook.xlsx',
    sheetName: catalog.originalName,
    sheetIndex: catalog.index,
    sourceType: 'CATALOG',
  }
  
  const res = parseCatalogSheet(catalog.rows, ctx)
  
  console.log(`Parsed items: ${res.stats.parsedItems}`)
  console.log(`Items with cost: ${res.stats.itemsWithCost}`)
  console.log(`Incidents: ${res.incidents.length}`)
  
  // Check for duplicates or extra items
  console.log('\n--- All items ---')
  for (const item of res.items) {
    console.log(`  ${item.rowNumber}: code="${item.code}" bodega="${item.bodega}" product="${item.product}" presentation="${item.presentation}" cost: ${item.cost?.amount ?? 'none'} status=${item.status}`)
  }
  
  // Check raw rows
  console.log('\n--- Raw rows with data in col A (first 20) ---')
  for (let i = 0; i < Math.min(20, catalog.rows.length); i++) {
    const row = catalog.rows[i]
    const colA = row[0]?.value
    const colB = row[1]?.value
    const colC = row[2]?.value
    if (colA) {
      console.log(`  Row ${i+1}: A="${colA}" B="${colB}" C="${colC}"`)
    }
  }
}

debug().catch(console.error)