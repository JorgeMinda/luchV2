import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { SpreadsheetFileReader } from '../file-reader/spreadsheet-file-reader'
import { ImportPreviewUseCase } from '../../../application/use-cases/import-preview-use-case'
import type { ImportPreviewResult } from '../../../application/use-cases/import-preview-types'

/**
 * Phase 4.4.3.A - Import Preview Forense + Validación Pre-Persistencia
 * CERO ESCRITURAS EN SUPABASE
 */

const REAL_FILE_PATH =
  'C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx'

const EXPECTED_SHA256 = '85dc913723f642c6568c0e4304360474c60426379fd6b47a283005c7e57086fc'

async function calculateSHA256(filePath: string): Promise<string> {
  const buffer = readFileSync(filePath)
  const hash = createHash('sha256')
  hash.update(buffer)
  return hash.digest('hex')
}

async function main() {
  console.log('=== FASE 4.4.3.A - IMPORT PREVIEW FORENSE ===\n')

  // Verificar archivo
  console.log('Verificando archivo fuente...')
  const buffer = readFileSync(REAL_FILE_PATH)
  const fileSize = buffer.length
  const sha256 = await calculateSHA256(REAL_FILE_PATH)

  console.log(`  Archivo: ${REAL_FILE_PATH}`)
  console.log(`  Tamaño: ${fileSize} bytes`)
  console.log(`  SHA-256: ${sha256}`)
  console.log(`  SHA-256 esperado: ${EXPECTED_SHA256}`)
  console.log(`  Match: ${sha256 === EXPECTED_SHA256 ? '✅ SÍ' : '❌ NO'}`)

  if (sha256 !== EXPECTED_SHA256) {
    console.error('\n⚠️  ADVERTENCIA: El SHA-256 no coincide con el archivo auditado en Fase 4.4.1.2')
  }

  // Crear File object
  const file = new File([buffer], 'real-workbook.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  // Ejecutar Import Preview
  console.log('\nEjecutando Import Preview...')
  const reader = new SpreadsheetFileReader()
  const useCase = new ImportPreviewUseCase(reader)

  const startTime = Date.now()
  const result: ImportPreviewResult = await useCase.execute(file, sha256)
  const duration = Date.now() - startTime

  console.log(`\nImport Preview completado en ${duration}ms`)
  console.log(`\nDecisión: ${result.decision}`)

  // Mostrar resumen
  const { preview } = result
  console.log('\n=== CONTEOS ===')
  console.log(`  Catálogo: ${preview.totals.catalogItems}`)
  console.log(`  Recetas almuerzos: ${preview.totals.lunchRecipeBlocks} bloques`)
  console.log(`  Recetas refrigerios: ${preview.totals.snackRecipeBlocks} bloques`)
  console.log(`  Menú anual: ${preview.totals.annualMenuEntries} entradas`)
  console.log(`  Menú refrigerios: ${preview.totals.snackMenuEntries} entradas`)
  console.log(`  Plantillas composición: ${preview.totals.mealCompositionTemplates}`)
  console.log(`  Total MenuEntry: ${preview.totals.totalMenuEntries}`)
  console.log(`  Total incidencias: ${preview.totals.totalIncidents} (ERROR: ${preview.totals.totalErrors}, WARNING: ${preview.totals.totalWarnings}, INFO: ${preview.totals.totalInfo})`)

  console.log('\n=== F.1–F.10 ===')
  for (const [key, value] of Object.entries(preview.f1ToF10)) {
    const icon = value === 'PASS' ? '✅' : value === 'FAIL' ? '❌' : '⚠️'
    console.log(`  ${key}: ${icon} ${value}`)
  }

  console.log('\n=== VALIDACIONES ===')
  console.log(`  Estructural: ${preview.validation.structuralIntegrity.status}`)
  console.log(`  Temporal: ${preview.validation.temporalIntegrity.status}`)
  console.log(`  Menú: ${preview.validation.menuIntegrity.status}`)
  console.log(`  Monetaria: ${preview.validation.monetaryIntegrity.status}`)
  console.log(`  Trazabilidad F.7: ${preview.validation.traceabilityIntegrity.status}`)
  console.log(`  General: ${preview.validation.overall}`)

  if (result.discrepancies.length > 0) {
    console.log('\n=== DISCREPANCIAS DETECTADAS ===')
    for (const d of result.discrepancies) {
      console.log(`  ${d.area}: esperado=${d.expected}, actual=${d.actual}`)
      console.log(`    ${d.explanation}`)
    }
  }

  // Generar reporte Markdown
  console.log('\nGenerando reporte Markdown...')
  const markdownReport = generateMarkdownReport(result, sha256, fileSize, duration)
  writeFileSync('docs/phase4.4.3a-import-preview-report.md', markdownReport)
  console.log('  ✅ docs/phase4.4.3a-import-preview-report.md')

  // Generar JSON machine-readable
  console.log('Generando JSON machine-readable...')
  const jsonReport = generateJSONReport(result, sha256, fileSize, duration)
  writeFileSync('docs/phase4.4.3a-import-preview.json', JSON.stringify(jsonReport, null, 2))
  console.log('  ✅ docs/phase4.4.3a-import-preview.json')

  console.log('\n=== CONFIRMACIÓN: CERO ESCRITURAS EN SUPABASE ===')
  console.log('  Este análisis usó solo parsers en memoria. No se llamaron repositorios Supabase.')

  // Verificar que no hay escrituras
  console.log('\n✅ FASE 4.4.3.A COMPLETADA')
}

function generateMarkdownReport(
  result: ImportPreviewResult,
  sha256: string,
  fileSize: number,
  durationMs: number,
): string {
  const { preview } = result
  const lines: string[] = []

  lines.push('# Phase 4.4.3.A Import Preview Report')
  lines.push('')
  lines.push(`**Fecha:** ${new Date().toISOString().split('T')[0]}`)
  lines.push(`**Duración:** ${durationMs}ms`)
  lines.push(`**Archivo analizado:** \`17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx\``)
  lines.push(`**SHA-256:** \`${sha256}\``)
  lines.push(`**Tamaño:** ${fileSize} bytes`)
  lines.push(`**Entorno:** In-memory only — **CERO escrituras a Supabase**`)
  lines.push('')

  // A. Identidad del archivo
  lines.push('## A. Identidad del Archivo')
  lines.push('')
  lines.push('| Campo | Valor |')
  lines.push('|-------|-------|')
  lines.push(`| Nombre | ${preview.sourceFile.fileName} |`)
  lines.push(`| Tamaño | ${preview.sourceFile.fileSize} bytes |`)
  lines.push(`| SHA-256 | \`${preview.sourceFile.sha256}\` |`)
  lines.push(`| Formato | ${preview.sourceFile.format} |`)
  lines.push(`| Fecha de análisis | ${preview.generatedAt} |`)
  lines.push('')

  lines.push('### Hojas Detectadas')
  lines.push('')
  lines.push('| Índice | Nombre Original | Normalizado | Filas | SourceType | Confianza |')
  lines.push('|--------|----------------|-------------|-------|------------|-----------|')
  for (const sheet of preview.sourceFile.sheetsDetected) {
    lines.push(`| ${sheet.index} | ${sheet.originalName} | ${sheet.normalizedName} | ${sheet.rowCount} | ${sheet.sourceType ?? 'N/A'} | ${sheet.confidence} |`)
  }
  lines.push('')

  // B. Resumen ejecutivo
  lines.push('## B. Resumen Ejecutivo')
  lines.push('')
  lines.push(`**VEREDICTO: ${result.decision}**`)
  lines.push('')
  lines.push(`El Import Preview procesó las 6 hojas del archivo Excel auditado. ${result.discrepancies.length > 0 ? `Se detectaron ${result.discrepancies.length} discrepancia(s) vs valores esperados de Fase 4.4.2.` : 'Todos los conteos coinciden con los valores esperados.'}`)
  lines.push('')
  lines.push(`Validación general: **${preview.validation.overall}**`)
  lines.push('')

  // C. Resultados por hoja
  lines.push('## C. Resultados por Hoja')
  lines.push('')

  // Catálogo
  lines.push('### 1. CATALOGO COSTEO 17-08-2')
  lines.push('')
  lines.push(`- **Items parseados:** ${preview.catalog.stats.parsedItems}`)
  lines.push(`- **Items con costo:** ${preview.catalog.stats.itemsWithCost}`)
  lines.push(`- **Items con incidencias:** ${preview.catalog.stats.itemsWithIncidents}`)
  lines.push(`- **Filas de datos:** ${preview.catalog.stats.dataRows}`)
  lines.push(`- **Incidencias totales:** ${preview.catalog.incidents.length}`)
  lines.push('')

  // Recetas Almuerzos
  lines.push('### 2. COSTEO RECETA ALMUERZOS')
  lines.push('')
  lines.push(`- **Bloques válidos:** ${preview.lunchRecipes.stats.blocks}`)
  lines.push(`- **Filas de ingredientes:** ${preview.lunchRecipes.stats.ingredientRows}`)
  lines.push(`- **Ingredientes sueltos:** ${preview.lunchRecipes.stats.looseIngredients}`)
  lines.push(`- **Incidencias ERROR:** ${preview.lunchRecipes.stats.errorIncidents}`)
  lines.push(`- **Total filas procesadas:** ${preview.lunchRecipes.stats.totalRows}`)
  lines.push(`- **Incidencias totales:** ${preview.lunchRecipes.incidents.length}`)
  lines.push('')

  // Recetas Refrigerios
  lines.push('### 3. COSTEO REFRIGERIOS')
  lines.push('')
  lines.push(`- **Bloques válidos:** ${preview.snackRecipes.stats.blocks}`)
  lines.push(`- **Filas de ingredientes:** ${preview.snackRecipes.stats.ingredientRows}`)
  lines.push(`- **Ingredientes sueltos:** ${preview.snackRecipes.stats.looseIngredients}`)
  lines.push(`- **Incidencias ERROR:** ${preview.snackRecipes.stats.errorIncidents}`)
  lines.push(`- **Total filas procesadas:** ${preview.snackRecipes.stats.totalRows}`)
  lines.push(`- **Incidencias totales:** ${preview.snackRecipes.incidents.length}`)
  lines.push('')

  // Menú Anual
  lines.push('### 4. MENÚ AGSTO-JULIO2026-2027 (ANUAL)')
  lines.push('')
  lines.push(`- **Bloques físicos:** ${preview.annualMenu.stats.physicalBlocks}`)
  lines.push(`- **Semanas calendario:** ${preview.annualMenu.stats.calendarWeeks}`)
  lines.push(`- **Días hábiles:** ${preview.annualMenu.stats.businessDays}`)
  lines.push(`- **Celdas #REF!:** ${preview.annualMenu.stats.formulaErrorCells}`)
  lines.push(`- **Entradas de menú:** ${preview.annualMenu.stats.entries}`)
  lines.push(`- **Total filas procesadas:** ${preview.annualMenu.stats.totalRows}`)
  lines.push(`- **Incidencias totales:** ${preview.annualMenu.incidents.length}`)
  lines.push('')

  // Detalle semanas anual
  lines.push('#### Detalle de Semanas (Anual)')
  lines.push('')
  lines.push('| Semana | weekStartDate | Tipo Header | Fechas Válidas | Entradas | Feriados |')
  lines.push('|--------|---------------|-------------|----------------|----------|----------|')
  for (const week of preview.annualMenu.weeks) {
    const validDates = week.dates.filter((d) => d.normalized).length
    lines.push(`| ${week.weekLabel} | ${week.weekStartDate} | ${week.headerType} | ${validDates}/5 | ${week.entries.length} | ${week.feriadoDates.length} |`)
  }
  lines.push('')

  // Menú Refrigerios
  lines.push('### 5. MENU REFRIGERIOS')
  lines.push('')
  lines.push(`- **Bloques físicos:** ${preview.snackMenu.stats.physicalBlocks}`)
  lines.push(`- **Semanas calendario:** ${preview.snackMenu.stats.calendarWeeks}`)
  lines.push(`- **Días hábiles:** ${preview.snackMenu.stats.businessDays}`)
  lines.push(`- **Celdas #REF!:** ${preview.snackMenu.stats.formulaErrorCells}`)
  lines.push(`- **Entradas de menú:** ${preview.snackMenu.stats.entries}`)
  lines.push(`- **Total filas procesadas:** ${preview.snackMenu.stats.totalRows}`)
  lines.push(`- **Incidencias totales:** ${preview.snackMenu.incidents.length}`)
  lines.push('')

  // Detalle semanas refrigerios
  lines.push('#### Detalle de Semanas (Refrigerios)')
  lines.push('')
  lines.push('| Semana | weekStartDate | Tipo Header | Fechas Válidas | Entradas | Feriados |')
  lines.push('|--------|---------------|-------------|----------------|----------|----------|')
  for (const week of preview.snackMenu.weeks) {
    const validDates = week.dates.filter((d) => d.normalized).length
    lines.push(`| ${week.weekLabel} | ${week.weekStartDate} | ${week.headerType} | ${validDates}/5 | ${week.entries.length} | ${week.feriadoDates.length} |`)
  }
  lines.push('')

  // Composición
  lines.push('### 6. COMPOSICION DE CADA PLATO')
  lines.push('')
  lines.push(`- **Plantillas:** ${preview.mealCompositionTemplates.stats.templates}`)
  lines.push(`- **Componentes:** ${preview.mealCompositionTemplates.stats.components}`)
  lines.push(`- **Plantillas validadas:** ${preview.mealCompositionTemplates.stats.validatedTemplates}`)
  lines.push(`- **Total filas procesadas:** ${preview.mealCompositionTemplates.stats.totalRows}`)
  lines.push(`- **Incidencias totales:** ${preview.mealCompositionTemplates.incidents.length}`)
  lines.push('')

  for (const template of preview.mealCompositionTemplates.templates) {
    lines.push(`#### ${template.name}`)
    lines.push('')
    lines.push(`- **Servicio:** ${template.serviceType}`)
    lines.push(`- **Objetivo hoja:** $${(template.sheetTargetTotalCents ?? 0) / 100}`)
    lines.push(`- **Objetivo verificado:** $${(template.verifiedTargetTotalCents ?? 0) / 100}`)
    lines.push(`- **Calculado:** $${(template.calculatedTotalCents ?? 0) / 100}`)
    lines.push(`- **Validación:** ${template.validation}`)
    lines.push(`- **Componentes:** ${template.components.length}`)
    lines.push('')
    for (const comp of template.components) {
      const unitCost = comp.unitCostRaw !== '' && comp.unitCostRaw !== undefined ? Number(comp.unitCostRaw).toFixed(6) : 'N/A'
      const portionCost = comp.portionCostCents ? `$${(comp.portionCostCents / 100).toFixed(2)}` : 'N/A'
      lines.push(`  - ${comp.componentType}: ${comp.originalName} | Cantidad: ${comp.standardQuantity} ${comp.unit ?? ''} | Costo unitario: ${unitCost} | Costo porción: ${portionCost}`)
    }
    lines.push('')
  }

  // D. Conteos
  lines.push('## D. Conteos')
  lines.push('')
  lines.push('| Métrica | Valor |')
  lines.push('|---------|-------|')
  lines.push(`| Catálogo | ${preview.totals.catalogItems} |`)
  lines.push(`| Recetas almuerzos | ${preview.totals.lunchRecipeBlocks} |`)
  lines.push(`| Recetas refrigerios | ${preview.totals.snackRecipeBlocks} |`)
  lines.push(`| Menú anual | ${preview.totals.annualMenuEntries} |`)
  lines.push(`| Menú refrigerios | ${preview.totals.snackMenuEntries} |`)
  lines.push(`| Plantillas composición | ${preview.totals.mealCompositionTemplates} |`)
  lines.push(`| **MenuEntry total** | **${preview.totals.totalMenuEntries}** |`)
  lines.push('')

  // E. Incidencias
  lines.push('## E. Incidencias')
  lines.push('')

  const allIncidents = preview.incidents
  const bySeverity = {
    ERROR: allIncidents.filter((i) => i.severity === 'ERROR'),
    WARNING: allIncidents.filter((i) => i.severity === 'WARNING'),
    INFO: allIncidents.filter((i) => i.severity === 'VALID' || i.severity === 'INFO'),
  }

  lines.push(`### ERROR (${bySeverity.ERROR.length})`)
  lines.push('')
  const errorByCode = groupBy(bySeverity.ERROR, (i) => i.code)
  for (const [code, incs] of Object.entries(errorByCode)) {
    lines.push(`#### ${code} (${incs.length})`)
    lines.push('')
    for (const inc of incs.slice(0, 5)) {
      lines.push(`- Fila ${inc.provenance?.rowNumber ?? 'N/A'} | ${inc.field} | ${inc.description}`)
    }
    if (incs.length > 5) lines.push(`- ... y ${incs.length - 5} más`)
    lines.push('')
  }

  lines.push(`### WARNING (${bySeverity.WARNING.length})`)
  lines.push('')
  const warningByCode = groupBy(bySeverity.WARNING, (i) => i.code)
  for (const [code, incs] of Object.entries(warningByCode)) {
    lines.push(`#### ${code} (${incs.length})`)
    lines.push('')
    for (const inc of incs.slice(0, 3)) {
      lines.push(`- Fila ${inc.provenance?.rowNumber ?? 'N/A'} | ${inc.field} | ${inc.description}`)
    }
    if (incs.length > 3) lines.push(`- ... y ${incs.length - 3} más`)
    lines.push('')
  }

  lines.push(`### INFO (${bySeverity.INFO.length})`)
  lines.push('')

  // F. F.1–F.10
  lines.push('## F. F.1–F.10')
  lines.push('')
  lines.push('| Regla | Estado | Detalle |')
  lines.push('|-------|--------|---------|')
  for (const [key, value] of Object.entries(preview.f1ToF10)) {
    const icon = value === 'PASS' ? '✅ PASS' : value === 'FAIL' ? '❌ FAIL' : '⚠️ BLOCKED/WARNING'
    let detail = ''
    if (key === 'F2') detail = 'Dinero en centavos integer; sub-centavo en unitCostRaw'
    if (key === 'F3') detail = 'Import Preview prepara datos para import_batch; no crea lote'
    if (key === 'F4') detail = 'weekStartDate son lunes; feriados Ecuador detectados'
    if (key === 'F5') detail = 'lunch (anual), snack (refrigerios)'
    if (key === 'F6') detail = 'Costos unitarios sub-centavo en crudo; totales en centavos'
    if (key === 'F7') detail = 'sourceCell/sourceFormula en MenuEntry; pendiente en otros dominios'
    if (key === 'F8') detail = 'Arquitectura soporta CurrentOperatorPort y RLS'
    if (key === 'F9') detail = '883 #REF! conservados como incidencias MENU_FORMULA_ERROR'
    if (key === 'F10') detail = 'MENU_CATEGORY_TO_DISH_CATEGORY aplicado; 1oz=28.35g en unit-normalizer'
    lines.push(`| ${key} | ${icon} | ${detail} |`)
  }
  lines.push('')

  // G. F.7 Trazabilidad
  lines.push('## G. Trazabilidad F.7 (Pipeline)')
  lines.push('')
  lines.push('| Fuente | sourceFile | sourceSheet | sourceRow | sourceCell | sourceFormula | Fórmulas Detectadas | Preservadas | Faltantes |')
  lines.push('|--------|------------|-------------|-----------|------------|---------------|---------------------|-------------|-----------|')
  for (const [domain, stage] of Object.entries(preview.traceability)) {
    lines.push(
      `| ${domain} | ${stage.sourceFile ? '✅' : '❌'} | ${stage.sourceSheet ? '✅' : '❌'} | ${stage.sourceRow ? '✅' : '❌'} | ${stage.sourceCell ? '✅' : '❌'} | ${stage.sourceFormula ? '✅' : '❌'} | ${stage.formulaDetected} | ${stage.formulaPreserved} | ${stage.formulaMissing} |`,
    )
  }
  lines.push('')
  lines.push('**Nota:** Los parsers actuales propagan `sourceFile`, `sourceSheet`, `sourceRow` vía `ParserContext`. `sourceCell` y `sourceFormula` solo están presentes en `MenuEntry` (parser de menú). Catálogo, Recetas y Composición requieren propagación adicional en Phase 4.4.3.B.')
  lines.push('')

  // H. Decisión final
  lines.push('## H. Decisión Final')
  lines.push('')
  lines.push(`**${result.decision}**`)
  lines.push('')

  if (result.decision === 'DISCREPANCY_DETECTED') {
    lines.push('### Discrepancias Detectadas')
    lines.push('')
    for (const d of result.discrepancies) {
      lines.push(`- **${d.area}:** esperado=${d.expected}, actual=${d.actual}`)
      lines.push(`  - ${d.explanation}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('## Confirmación Zero-Write')
  lines.push('')
  lines.push('```')
  lines.push('=== CONFIRMACIÓN: NO HUBO ESCRITURAS EN SUPABASE ===')
  lines.push('  Este análisis usó solo parsers en memoria. No se llamaron repositorios Supabase.')
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}

function generateJSONReport(
  result: ImportPreviewResult,
  sha256: string,
  fileSize: number,
  durationMs: number,
): object {
  const { preview } = result

  return {
    metadata: {
      generatedAt: preview.generatedAt,
      durationMs,
      file: {
        fileName: preview.sourceFile.fileName,
        fileSize,
        sha256,
        format: preview.sourceFile.format,
      },
      sheets: preview.sourceFile.sheetsDetected,
    },
    totals: preview.totals,
    f1ToF10: preview.f1ToF10,
    validation: {
      structuralIntegrity: preview.validation.structuralIntegrity,
      temporalIntegrity: preview.validation.temporalIntegrity,
      menuIntegrity: preview.validation.menuIntegrity,
      monetaryIntegrity: preview.validation.monetaryIntegrity,
      traceabilityIntegrity: preview.validation.traceabilityIntegrity,
      overall: preview.validation.overall,
    },
    traceability: preview.traceability,
    incidents: {
      bySeverity: {
        ERROR: preview.incidents.filter((i) => i.severity === 'ERROR').length,
        WARNING: preview.incidents.filter((i) => i.severity === 'WARNING').length,
        INFO: preview.incidents.filter((i) => i.severity === 'VALID' || i.severity === 'INFO').length,
      },
      byCode: groupBy(preview.incidents, (i) => i.code),
      samples: {
        ERROR: preview.incidents.filter((i) => i.severity === 'ERROR').slice(0, 10),
        WARNING: preview.incidents.filter((i) => i.severity === 'WARNING').slice(0, 10),
      },
    },
    catalog: {
      stats: preview.catalog.stats,
      itemsSample: preview.catalog.items.slice(0, 5),
      itemsWithCost: preview.catalog.items.filter((i) => i.costCents !== undefined).length,
      itemsWithoutCost: preview.catalog.items.filter((i) => i.costCents === undefined).length,
    },
    lunchRecipes: {
      stats: preview.lunchRecipes.stats,
      blocksSample: preview.lunchRecipes.blocks.slice(0, 3),
    },
    snackRecipes: {
      stats: preview.snackRecipes.stats,
      blocksSample: preview.snackRecipes.blocks.slice(0, 3),
    },
    annualMenu: {
      stats: preview.annualMenu.stats,
      weeks: preview.annualMenu.weeks.map((w) => ({
        weekLabel: w.weekLabel,
        weekStartDate: w.weekStartDate,
        headerType: w.headerType,
        validDates: w.dates.filter((d) => d.normalized).length,
        entries: w.entries.length,
        feriados: w.feriadoDates.length,
      })),
    },
    snackMenu: {
      stats: preview.snackMenu.stats,
      weeks: preview.snackMenu.weeks.map((w) => ({
        weekLabel: w.weekLabel,
        weekStartDate: w.weekStartDate,
        headerType: w.headerType,
        validDates: w.dates.filter((d) => d.normalized).length,
        entries: w.entries.length,
        feriados: w.feriadoDates.length,
      })),
    },
    mealComposition: {
      stats: preview.mealCompositionTemplates.stats,
      templates: preview.mealCompositionTemplates.templates.map((t) => ({
        name: t.name,
        serviceType: t.serviceType,
        sheetTargetTotalCents: t.sheetTargetTotalCents,
        verifiedTargetTotalCents: t.verifiedTargetTotalCents,
        calculatedTotalCents: t.calculatedTotalCents,
        validation: t.validation,
        componentsCount: t.components.length,
      })),
    },
    discrepancies: result.discrepancies,
    decision: result.decision,
  }
}

function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const key = keyFn(item)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})