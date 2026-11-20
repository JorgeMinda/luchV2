import { readFileSync } from 'node:fs'
import { SpreadsheetFileReader } from '../file-reader/spreadsheet-file-reader'
import { parseMenuPlanSheet } from './menu-plan-parser'
import type { ParserContext } from './parser-common'

const REAL_FILE_PATH =
  'C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx'

async function debug() {
  const buffer = readFileSync(REAL_FILE_PATH)
  const file = new File([buffer], 'real-workbook.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  
  const reader = new SpreadsheetFileReader()
  const workbook = await reader.readWorkbook(file)
  
  // Sheet 2: MENÚ AGSTO-JULIO2026-2027 (index 2)
  const anual = workbook.sheets[2]
  const ctxA: ParserContext = {
    fileName: 'real-workbook.xlsx',
    sheetName: anual.originalName,
    sheetIndex: anual.index,
    sourceType: 'MENU_PLAN',
  }
  
  console.log('=== MENÚ ANUAL ===')
  const resA = parseMenuPlanSheet(anual.rows, ctxA)
  console.log(`Physical blocks: ${resA.stats.physicalBlocks}`)
  console.log(`Calendar weeks: ${resA.stats.calendarWeeks}`)
  console.log(`Business days: ${resA.stats.businessDays}`)
  console.log(`Formula errors: ${resA.stats.formulaErrorCells}`)
  console.log(`Total entries: ${resA.weeks.reduce((sum, w) => sum + w.entries.length, 0)}`)
  console.log(`Incidents: ${resA.incidents.length}`)
  
  for (const week of resA.weeks) {
    console.log(`  Week: ${week.weekLabel} (row ${week.labelRow}) | start: ${week.weekStartDate} | type: ${week.headerType} | dates: ${week.dates.length} | entries: ${week.entries.length} | feriados: ${week.feriadoDates.length}`)
    if (week.entries.length > 0) {
      for (const entry of week.entries.slice(0, 3)) {
        console.log(`    ${entry.category} [col ${entry.columnLetter}] day${entry.dayIndex}: "${entry.dish}" @ ${entry.serviceDate}`)
      }
    }
  }
  
  // Sheet 4: MENU REFRIGERIOS (index 4)
  const refrigerios = workbook.sheets[4]
  const ctxR: ParserContext = { ...ctxA, sheetName: refrigerios.originalName, sheetIndex: refrigerios.index }
  
  console.log('\n=== MENU REFRIGERIOS ===')
  const resR = parseMenuPlanSheet(refrigerios.rows, ctxR)
  console.log(`Physical blocks: ${resR.stats.physicalBlocks}`)
  console.log(`Calendar weeks: ${resR.stats.calendarWeeks}`)
  console.log(`Business days: ${resR.stats.businessDays}`)
  console.log(`Total entries: ${resR.weeks.reduce((sum, w) => sum + w.entries.length, 0)}`)
  
  for (const week of resR.weeks) {
    console.log(`  Block: ${week.weekLabel} (row ${week.labelRow}) | start: ${week.weekStartDate} | type: ${week.headerType} | dates: ${week.dates.length} | entries: ${week.entries.length} | feriados: ${week.feriadoDates.length}`)
    if (week.entries.length > 0) {
      for (const entry of week.entries.slice(0, 5)) {
        console.log(`    ${entry.category} [col ${entry.columnLetter}] day${entry.dayIndex}: "${entry.dish}" @ ${entry.serviceDate}`)
      }
    }
  }
}

debug().catch(console.error)