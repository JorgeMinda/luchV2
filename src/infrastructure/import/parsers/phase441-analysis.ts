import { readFileSync } from 'node:fs'
import { SpreadsheetFileReader } from '../file-reader/spreadsheet-file-reader'
import { parseCatalogSheet } from '../parsers/catalog-parser'
import { parseRecipeCostingSheet } from '../parsers/recipe-costing-parser'
import { parseMenuPlanSheet } from '../parsers/menu-plan-parser'
import { parseMealCompositionSheet } from '../parsers/meal-composition-parser'
import { detectSheetSourceType } from '../file-reader/sheet-type-detector'
import type { ParserContext } from '../parsers/parser-common'

/**
 * Phase 4.4.1 - Análisis real del Excel corregido SIN PERSISTENCIA
 * Usa parsers directamente con almacenamiento en memoria.
 */

const REAL_FILE_PATH = 'C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx'

async function main() {
  console.log('=== FASE 4.4.1 - ANÁLISIS REAL DEL EXCEL (SIN ESCRITURAS) ===\n')
  
  const buffer = readFileSync(REAL_FILE_PATH)
  const file = new File([buffer], 'real-workbook.xlsx')
  
  const reader = new SpreadsheetFileReader()
  const workbook = await reader.readWorkbook(file)
  
  console.log('=== HOJAS DETECTADAS ===')
  workbook.sheets.forEach((s, i) => {
    const detection = detectSheetSourceType(s.originalName, s.index)
    console.log(`  Hoja ${i}: "${s.originalName}" (${s.rows.length} filas) -> ${detection.sourceType} (confianza: ${detection.confidence})`)
  })
  
  // Sheet 0: CATALOG
  console.log('\n=== HOJA 0: CATALOGO COSTEO 17-08-2 ===')
  const ctx0: ParserContext = { fileName: 'real-workbook.xlsx', sheetName: workbook.sheets[0].originalName, sheetIndex: 0, sourceType: 'CATALOG' }
  const res0 = parseCatalogSheet(workbook.sheets[0].rows, ctx0)
  console.log(`  Items parseados: ${res0.stats.parsedItems}`)
  console.log(`  Items con costo: ${res0.stats.itemsWithCost}`)
  console.log(`  Items con incidencias: ${res0.stats.itemsWithIncidents}`)
  console.log(`  Filas de datos: ${res0.stats.dataRows}`)
  
  // Contar errores/warnings/fórmulas desde incidents
  const catErrors = res0.incidents.filter(i => i.severity === 'ERROR').length
  const catWarnings = res0.incidents.filter(i => i.severity === 'WARNING').length
  const catFormulaErrors = res0.incidents.filter(i => i.code === 'FORMULA_ERROR').length
  const catEmptyCodes = res0.incidents.filter(i => i.code === 'MISSING_REQUIRED_FIELD' && i.field === 'code').length
  const catFormulaPreserved = res0.incidents.filter(i => i.code === 'FORMULA_PRESERVED').length
  
  // Contar duplicados
  const codes = res0.items.map(i => i.code).filter(c => c)
  const uniqueCodes = new Set(codes)
  const duplicates = codes.length - uniqueCodes.size
  
  console.log(`  Errores: ${catErrors}`)
  console.log(`  Advertencias: ${catWarnings}`)
  console.log(`  Errores de fórmula: ${catFormulaErrors}`)
  console.log(`  Códigos vacíos: ${catEmptyCodes}`)
  console.log(`  Fórmulas preservadas: ${catFormulaPreserved}`)
  console.log(`  Códigos duplicados: ${duplicates}`)
  
  // Últimas 5 filas
  console.log('\n  Últimas 5 filas (códigos 458-462):')
  const lastItems = res0.items.slice(-5)
  lastItems.forEach(item => {
    console.log(`    Fila ${item.rowNumber}: Código="${item.code}" | Bodega="${item.bodega}" | Producto="${item.product}" | Presentación="${item.presentation}" | Costo=${item.cost?.cents}¢ | Estado="${item.status}" | Formula="(no preservada por parser)"`)
  })
  
  // Sheet 1: RECIPE_COSTING ALMUERZOS
  console.log('\n=== HOJA 1: COSTEO RECETA ALMUERZOS ===')
  const ctx1: ParserContext = { fileName: 'real-workbook.xlsx', sheetName: workbook.sheets[1].originalName, sheetIndex: 1, sourceType: 'RECIPE_COSTING' }
  const res1 = parseRecipeCostingSheet(workbook.sheets[1].rows, ctx1)
  console.log(`  Bloques de recetas: ${res1.stats.blocks}`)
  console.log(`  Filas de ingredientes: ${res1.stats.ingredientRows}`)
  console.log(`  Incidencias de error: ${res1.stats.errorIncidents}`)
  console.log(`  Total filas procesadas: ${res1.stats.totalRows}`)
  
  const rec1Errors = res1.incidents.filter(i => i.severity === 'ERROR').length
  const rec1Warnings = res1.incidents.filter(i => i.severity === 'WARNING').length
  const rec1FormulaErrors = res1.incidents.filter(i => i.code === 'FORMULA_ERROR').length
  const rec1ValueErrors = res1.incidents.filter(i => i.code === 'VALUE_ERROR' || i.code === 'FORMULA_ERROR' && String(i.originalValue).includes('#VALUE')).length
  const rec1RefErrors = res1.incidents.filter(i => i.code === 'REF_ERROR' || i.code === 'FORMULA_ERROR' && String(i.originalValue).includes('#REF')).length
  const rec1Div0Errors = res1.incidents.filter(i => i.code === 'DIV_ZERO_ERROR' || i.code === 'FORMULA_ERROR' && String(i.originalValue).includes('#DIV')).length
  const rec1FormulaPreserved = res1.incidents.filter(i => i.code === 'FORMULA_PRESERVED').length
  
  console.log(`  Errores: ${rec1Errors}`)
  console.log(`  Advertencias: ${rec1Warnings}`)
  console.log(`  Errores de fórmula (total): ${rec1FormulaErrors}`)
  console.log(`    #VALUE!: ${rec1ValueErrors}`)
  console.log(`    #REF!: ${rec1RefErrors}`)
  console.log(`    #DIV/0!: ${rec1Div0Errors}`)
  console.log(`  Fórmulas preservadas: ${rec1FormulaPreserved}`)
  
  // Sheet 3: RECIPE_COSTING REFRIGERIOS
  console.log('\n=== HOJA 3: COSTEO REFRIGERIOS ===')
  const ctx3: ParserContext = { fileName: 'real-workbook.xlsx', sheetName: workbook.sheets[3].originalName, sheetIndex: 3, sourceType: 'RECIPE_COSTING' }
  const res3 = parseRecipeCostingSheet(workbook.sheets[3].rows, ctx3)
  console.log(`  Bloques de recetas: ${res3.stats.blocks}`)
  console.log(`  Filas de ingredientes: ${res3.stats.ingredientRows}`)
  console.log(`  Incidencias de error: ${res3.stats.errorIncidents}`)
  console.log(`  Total filas procesadas: ${res3.stats.totalRows}`)
  
  const rec3Errors = res3.incidents.filter(i => i.severity === 'ERROR').length
  const rec3Warnings = res3.incidents.filter(i => i.severity === 'WARNING').length
  const rec3FormulaErrors = res3.incidents.filter(i => i.code === 'FORMULA_ERROR').length
  const rec3ValueErrors = res3.incidents.filter(i => i.code === 'VALUE_ERROR' || i.code === 'FORMULA_ERROR' && String(i.originalValue).includes('#VALUE')).length
  const rec3RefErrors = res3.incidents.filter(i => i.code === 'REF_ERROR' || i.code === 'FORMULA_ERROR' && String(i.originalValue).includes('#REF')).length
  const rec3Div0Errors = res3.incidents.filter(i => i.code === 'DIV_ZERO_ERROR' || i.code === 'FORMULA_ERROR' && String(i.originalValue).includes('#DIV')).length
  const rec3FormulaPreserved = res3.incidents.filter(i => i.code === 'FORMULA_PRESERVED').length
  
  console.log(`  Errores: ${rec3Errors}`)
  console.log(`  Advertencias: ${rec3Warnings}`)
  console.log(`  Errores de fórmula (total): ${rec3FormulaErrors}`)
  console.log(`    #VALUE!: ${rec3ValueErrors}`)
  console.log(`    #REF!: ${rec3RefErrors}`)
  console.log(`    #DIV/0!: ${rec3Div0Errors}`)
  console.log(`  Fórmulas preservadas: ${rec3FormulaPreserved}`)
  
  // Sheet 2: MENU_PLAN ANUAL
  console.log('\n=== HOJA 2: MENÚ AGSTO-JULIO2026-2027 (ANUAL) ===')
  const ctx2: ParserContext = { fileName: 'real-workbook.xlsx', sheetName: workbook.sheets[2].originalName, sheetIndex: 2, sourceType: 'MENU_PLAN' }
  const res2 = parseMenuPlanSheet(workbook.sheets[2].rows, ctx2)
  console.log(`  Bloques semanales: ${res2.stats.weekBlocks}`)
  console.log(`  Celdas #REF!: ${res2.stats.formulaErrorCells}`)
  console.log(`  Celdas de fecha: ${res2.stats.dateCells}`)
  console.log(`  Fechas normalizadas: ${res2.stats.normalizedDates}`)
  console.log(`  Entradas de menú: ${res2.stats.entries}`)
  console.log(`  Total filas procesadas: ${res2.stats.totalRows}`)
  
  const menu2Errors = res2.incidents.filter(i => i.severity === 'ERROR').length
  const menu2Warnings = res2.incidents.filter(i => i.severity === 'WARNING').length
  const menu2FormulaErrors = res2.incidents.filter(i => i.code === 'FORMULA_ERROR').length
  const menu2ValueErrors = res2.incidents.filter(i => i.code === 'VALUE_ERROR' || i.code === 'FORMULA_ERROR' && String(i.originalValue).includes('#VALUE')).length
  const menu2RefErrors = res2.incidents.filter(i => i.code === 'REF_ERROR' || i.code === 'FORMULA_ERROR' && String(i.originalValue).includes('#REF')).length
  const menu2Div0Errors = res2.incidents.filter(i => i.code === 'DIV_ZERO_ERROR' || i.code === 'FORMULA_ERROR' && String(i.originalValue).includes('#DIV')).length
  
  console.log(`  Errores: ${menu2Errors}`)
  console.log(`  Advertencias: ${menu2Warnings}`)
  console.log(`  Errores de fórmula (total): ${menu2FormulaErrors}`)
  console.log(`    #VALUE!: ${menu2ValueErrors}`)
  console.log(`    #REF!: ${menu2RefErrors}`)
  console.log(`    #DIV/0!: ${menu2Div0Errors}`)
  
  const weeksWithDate = res2.weeks.filter(w => w.weekStartDate.match(/^\d{4}-\d{2}-\d{2}$/))
  console.log(`  Semanas con weekStartDate válido: ${weeksWithDate.length}/${res2.stats.weekBlocks}`)
  res2.weeks.forEach(w => {
    console.log(`    ${w.weekLabel}: weekStartDate=${w.weekStartDate} | Días válidos: ${w.dates.filter(d => d.normalized).length}/5 | Celdas #REF!: ${w.entries.filter(e => e.hasError).length}`)
  })
  
  // Sheet 4: MENU REFRIGERIOS
  console.log('\n=== HOJA 4: MENU REFRIGERIOS ===')
  const ctx4: ParserContext = { fileName: 'real-workbook.xlsx', sheetName: workbook.sheets[4].originalName, sheetIndex: 4, sourceType: 'MENU_PLAN' }
  const res4 = parseMenuPlanSheet(workbook.sheets[4].rows, ctx4)
  console.log(`  Bloques semanales: ${res4.stats.weekBlocks}`)
  console.log(`  Celdas #REF!: ${res4.stats.formulaErrorCells}`)
  console.log(`  Celdas de fecha: ${res4.stats.dateCells}`)
  console.log(`  Fechas normalizadas: ${res4.stats.normalizedDates}`)
  console.log(`  Entradas de menú: ${res4.stats.entries}`)
  console.log(`  Total filas procesadas: ${res4.stats.totalRows}`)
  
  const menu4Errors = res4.incidents.filter(i => i.severity === 'ERROR').length
  const menu4Warnings = res4.incidents.filter(i => i.severity === 'WARNING').length
  const menu4FormulaErrors = res4.incidents.filter(i => i.code === 'FORMULA_ERROR').length
  const menu4ValueErrors = res4.incidents.filter(i => i.code === 'VALUE_ERROR' || i.code === 'FORMULA_ERROR' && String(i.originalValue).includes('#VALUE')).length
  const menu4RefErrors = res4.incidents.filter(i => i.code === 'REF_ERROR' || i.code === 'FORMULA_ERROR' && String(i.originalValue).includes('#REF')).length
  const menu4Div0Errors = res4.incidents.filter(i => i.code === 'DIV_ZERO_ERROR' || i.code === 'FORMULA_ERROR' && String(i.originalValue).includes('#DIV')).length
  
  console.log(`  Errores: ${menu4Errors}`)
  console.log(`  Advertencias: ${menu4Warnings}`)
  console.log(`  Errores de fórmula (total): ${menu4FormulaErrors}`)
  console.log(`    #VALUE!: ${menu4ValueErrors}`)
  console.log(`    #REF!: ${menu4RefErrors}`)
  console.log(`    #DIV/0!: ${menu4Div0Errors}`)
  
  const weeksWithDate4 = res4.weeks.filter(w => w.weekStartDate.match(/^\d{4}-\d{2}-\d{2}$/))
  console.log(`  Semanas con weekStartDate válido: ${weeksWithDate4.length}/${res4.stats.weekBlocks}`)
  res4.weeks.forEach(w => {
    console.log(`    ${w.weekLabel}: weekStartDate=${w.weekStartDate} | Días válidos: ${w.dates.filter(d => d.normalized).length}/5`)
  })
  
  // Sheet 5: MEAL_COMPOSITION
  console.log('\n=== HOJA 5: COMPOSICION DE CADA PLATO ===')
  const ctx5: ParserContext = { fileName: 'real-workbook.xlsx', sheetName: workbook.sheets[5].originalName, sheetIndex: 5, sourceType: 'MEAL_COMPOSITION' }
  const res5 = parseMealCompositionSheet(workbook.sheets[5].rows, ctx5)
  console.log(`  Plantillas: ${res5.stats.templates}`)
  console.log(`  Componentes: ${res5.stats.components}`)
  console.log(`  Plantillas validadas: ${res5.stats.validatedTemplates}`)
  console.log(`  Total filas procesadas: ${res5.stats.totalRows}`)
  
  const compErrors = res5.incidents.filter(i => i.severity === 'ERROR').length
  const compWarnings = res5.incidents.filter(i => i.severity === 'WARNING').length
  const compFormulaErrors = res5.incidents.filter(i => i.code === 'FORMULA_ERROR').length
  const compFormulaPreserved = res5.incidents.filter(i => i.code === 'FORMULA_PRESERVED').length
  
  console.log(`  Errores: ${compErrors}`)
  console.log(`  Advertencias: ${compWarnings}`)
  console.log(`  Errores de fórmula: ${compFormulaErrors}`)
  console.log(`  Fórmulas preservadas: ${compFormulaPreserved}`)
  
  const expectedTargets = [124, 138, 84, 144] // en centavos
  res5.templates.forEach((t, i) => {
    const targetCents = t.sheetTargetTotal?.cents ?? 0
    const expected = expectedTargets[i]
    const match = targetCents === expected ? '✅' : '❌'
    console.log(`\n  Plantilla ${i+1}: ${t.name} ${match}`)
    console.log(`    Objetivo hoja: $${(targetCents/100).toFixed(2)} (esperado: $${(expected/100).toFixed(2)})`)
    console.log(`    Validación: ${t.validation}`)
    console.log(`    Componentes: ${t.components.length}`)
    t.components.forEach(c => {
      const unitCostRaw = (c as any).unitCostRaw
      const unitCost = unitCostRaw !== undefined && unitCostRaw !== null ? Number(unitCostRaw).toFixed(6) : 'N/A'
      const portionCost = c.portionCost ? `$${(c.portionCost.cents/100).toFixed(2)}` : 'N/A'
      console.log(`      - ${c.componentType}: ${c.originalName} | Cantidad: ${c.standardQuantity} ${c.unit} | Costo unitario: ${unitCost} | Costo porción: ${portionCost}`)
    })
  })
  
  // Resumen general
  console.log('\n=== RESUMEN GENERAL ===')
  const totalFormulaErrors = catFormulaErrors + rec1FormulaErrors + rec3FormulaErrors + menu2FormulaErrors + menu4FormulaErrors + compFormulaErrors
  const totalValueErrors = rec1ValueErrors + rec3ValueErrors + menu2ValueErrors
  const totalRefErrors = rec1RefErrors + rec3RefErrors + menu2RefErrors
  const totalDiv0Errors = rec1Div0Errors + rec3Div0Errors + menu2Div0Errors
  
  console.log(`  Items catálogo válidos: ${res0.stats.parsedItems}`)
  console.log(`  Recetas almuerzos: ${res1.stats.blocks} bloques, ${res1.stats.ingredientRows} ingredientes`)
  console.log(`  Recetas refrigerios: ${res3.stats.blocks} bloques, ${res3.stats.ingredientRows} ingredientes`)
  console.log(`  Semanas menú anual: ${res2.stats.weekBlocks} (${res2.stats.formulaErrorCells} celdas #REF!)`)
  console.log(`  Semanas menú refrigerios: ${res4.stats.weekBlocks}`)
  console.log(`  Plantillas composición: ${res5.stats.templates}`)
  console.log(`\n  ERRORES TOTALES:`)
  console.log(`    Fórmulas: ${totalFormulaErrors}`)
  console.log(`    #VALUE!: ${totalValueErrors}`)
  console.log(`    #REF!: ${totalRefErrors}`)
  console.log(`    #DIV/0!: ${totalDiv0Errors}`)
  console.log(`  FÓRMULAS PRESERVADAS:`)
  console.log(`    Catálogo: ${catFormulaPreserved}`)
  console.log(`    Recetas almuerzos: ${rec1FormulaPreserved}`)
  console.log(`    Recetas refrigerios: ${rec3FormulaPreserved}`)
  console.log(`    Composición: ${compFormulaPreserved}`)
  
  // Verificación contra valores esperados
  console.log('\n=== VERIFICACIÓN CONTRA VALORES ESPERADOS ===')
  const checks = [
    { name: 'Catálogo - 462 productos válidos', actual: res0.stats.parsedItems, expected: 462 },
    { name: 'Catálogo - 0 códigos vacíos', actual: catEmptyCodes, expected: 0 },
    { name: 'Catálogo - 22 fórmulas preservadas', actual: catFormulaPreserved, expected: 22 },
    { name: 'Catálogo - 0 códigos duplicados', actual: duplicates, expected: 0 },
    { name: 'Recetas almuerzos - 249 bloques', actual: res1.stats.blocks, expected: 249 },
    { name: 'Recetas refrigerios - 10 bloques', actual: res3.stats.blocks, expected: 10 },
    { name: 'Menú anual - 14 semanas', actual: res2.stats.weekBlocks, expected: 14 },
    { name: 'Menú anual - 883/884 celdas #REF!', actual: res2.stats.formulaErrorCells, expected: 883 },
    { name: 'Composición - 4 plantillas', actual: res5.stats.templates, expected: 4 },
    { name: 'Plantilla 1 objetivo $1.24', actual: res5.templates[0]?.sheetTargetTotal?.cents ?? -1, expected: 124 },
    { name: 'Plantilla 2 objetivo $1.38', actual: res5.templates[1]?.sheetTargetTotal?.cents ?? -1, expected: 138 },
    { name: 'Plantilla 3 objetivo $0.84', actual: res5.templates[2]?.sheetTargetTotal?.cents ?? -1, expected: 84 },
    { name: 'Plantilla 4 objetivo $1.44', actual: res5.templates[3]?.sheetTargetTotal?.cents ?? -1, expected: 144 },
  ]
  
  checks.forEach(c => {
    const status = c.actual === c.expected ? '[VERIFICADO]' : '[DISCREPANCIA DETECTADA]'
    console.log(`  ${status} ${c.name}: actual=${c.actual}, esperado=${c.expected}`)
  })
  
  console.log('\n=== CONFIRMACIÓN: NO HUBO ESCRITURAS EN SUPABASE ===')
  console.log('  Este análisis usó solo parsers en memoria. No se llamaron repositorios Supabase.')
}

main().catch(console.error)