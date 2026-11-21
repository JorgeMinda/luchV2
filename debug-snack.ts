import { SpreadsheetFileReader } from './src/infrastructure/import/file-reader/spreadsheet-file-reader.js'
import { parseRecipeCostingSheet } from './src/infrastructure/import/parsers/recipe-costing-parser.js'
import { parseMenuPlanSheet } from './src/infrastructure/import/parsers/menu-plan-parser.js'
import { parseMealCompositionSheet } from './src/infrastructure/import/parsers/meal-composition-parser.js'
import { readFileSync } from 'fs'

const filePath = 'C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx'
const buffer = readFileSync(filePath)
const file = new File([buffer], 'real-workbook.xlsx')

const reader = new SpreadsheetFileReader()
const workbook = await reader.readWorkbook(file)

// Snack recipes
const snackRecipeSheet = workbook.sheets.find(s => s.originalName.includes('COSTEO REFRIGERIOS'))
console.log('Snack Recipe Sheet:', snackRecipeSheet!.originalName, 'Rows:', snackRecipeSheet!.rows.length)

const context = { fileName: file.name, sheetName: snackRecipeSheet!.originalName, sheetIndex: snackRecipeSheet!.index, sourceType: 'RECIPE_COSTING' as const }
const snackResult = parseRecipeCostingSheet(snackRecipeSheet!.rows, context)
console.log('\nSnack Blocks:', snackResult.blocks?.length)
console.log('Snack Incidents:', snackResult.incidents?.length)
if (snackResult.blocks && snackResult.blocks.length > 0) {
  console.log('First snack block title:', snackResult.blocks[0].title)
  console.log('First snack block ingredients:', snackResult.blocks[0].ingredients.length)
}

// Annual menu
const annualMenuSheet = workbook.sheets.find(s => s.originalName.includes('MENÚ AGSTO'))
console.log('\n\nAnnual Menu Sheet:', annualMenuSheet!.originalName, 'Rows:', annualMenuSheet!.rows.length)
const menuResult = parseMenuPlanSheet(annualMenuSheet!.rows, { ...context, sheetName: annualMenuSheet!.originalName, sheetIndex: annualMenuSheet!.index, sourceType: 'MENU_PLAN' })
console.log('Menu weeks:', menuResult.weeks?.length)
console.log('Menu incidents:', menuResult.incidents?.length)
if (menuResult.weeks && menuResult.weeks.length > 0) {
  console.log('First week entries:', menuResult.weeks[0].entries.length)
  if (menuResult.weeks[0].entries.length > 0) {
    console.log('First entry:', JSON.stringify(menuResult.weeks[0].entries[0], null, 2))
  }
}

// Snack menu
const snackMenuSheet = workbook.sheets.find(s => s.originalName.includes('MENU REFRIGERIOS'))
console.log('\n\nSnack Menu Sheet:', snackMenuSheet!.originalName, 'Rows:', snackMenuSheet!.rows.length)
const snackMenuResult = parseMenuPlanSheet(snackMenuSheet!.rows, { ...context, sheetName: snackMenuSheet!.originalName, sheetIndex: snackMenuSheet!.index, sourceType: 'MENU_PLAN' })
console.log('Snack Menu weeks:', snackMenuResult.weeks?.length)
console.log('Snack Menu incidents:', snackMenuResult.incidents?.length)

// Composition
const compositionSheet = workbook.sheets.find(s => s.originalName.includes('COMPOSICION'))
console.log('\n\nComposition Sheet:', compositionSheet!.originalName, 'Rows:', compositionSheet!.rows.length)
const compResult = parseMealCompositionSheet(compositionSheet!.rows, { ...context, sheetName: compositionSheet!.originalName, sheetIndex: compositionSheet!.index, sourceType: 'MEAL_COMPOSITION' })
console.log('Composition templates:', compResult.templates?.length)
console.log('Composition incidents:', compResult.incidents?.length)
if (compResult.templates && compResult.templates.length > 0) {
  console.log('First template:', JSON.stringify(compResult.templates[0], null, 2))
}