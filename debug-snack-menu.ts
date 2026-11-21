import { SpreadsheetFileReader } from './src/infrastructure/import/file-reader/spreadsheet-file-reader.js'
import { parseMenuPlanSheet } from './src/infrastructure/import/parsers/menu-plan-parser.js'
import { readFileSync } from 'fs'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

const filePath = 'C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx'
const buffer = readFileSync(filePath)
const file = new File([buffer], 'real-workbook.xlsx')

const reader = new SpreadsheetFileReader()
const workbook = await reader.readWorkbook(file)

const snackMenuSheet = workbook.sheets.find(s => s.originalName.includes('MENU REFRIGERIOS'))
console.log('Snack Menu Sheet:', snackMenuSheet!.originalName, 'Rows:', snackMenuSheet!.rows.length)

const context = { fileName: file.name, sheetName: snackMenuSheet!.originalName, sheetIndex: snackMenuSheet!.index, sourceType: 'MENU_PLAN' as const }
const snackMenuResult = parseMenuPlanSheet(snackMenuSheet!.rows, context)
console.log('\nSnack Menu weeks:', snackMenuResult.weeks.length)
console.log('Snack Menu incidents:', snackMenuResult.incidents.length)

for (let i = 0; i < snackMenuResult.weeks.length; i++) {
  const week = snackMenuResult.weeks[i]
  console.log(`\nWeek ${i}: ${week.weekStartDate} (${week.entries.length} entries)`)
  for (const entry of week.entries) {
    if (entry.dish) {
      console.log(`  ${DAYS[entry.dayIndex]} ${entry.originalCategory}: "${entry.dish}" (hasError: ${entry.hasError})`)
    }
  }
}