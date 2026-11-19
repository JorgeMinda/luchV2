/**
 * Pipeline de Fase 3: lectura del libro, detección auditable del SourceType
 * por hoja y despacho al parser correspondiente.
 *
 * No integra la interfaz ni persiste resultados: produce un resultado
 * verificable en memoria con todas las incidencias.
 */

import type { ParseImportWorkbookOutput, ParseImportWorkbookUseCase, ParsedSheetSummary } from './parse-import-workbook-use-case'
import type { ImportFileReaderPort, ReaderIncident } from '../ports/import-file-reader-port'
import type { ImportIncident } from '../../domain/value-objects/incident'
import { detectSheetSourceType } from '../../infrastructure/import/file-reader/sheet-type-detector'
import { parseCatalogSheet } from '../../infrastructure/import/parsers/catalog-parser'
import { parseRecipeCostingSheet } from '../../infrastructure/import/parsers/recipe-costing-parser'
import { parseMenuPlanSheet } from '../../infrastructure/import/parsers/menu-plan-parser'
import { parseMealCompositionSheet } from '../../infrastructure/import/parsers/meal-composition-parser'
import { ANALYSIS_VERSION, type ParserContext } from '../../infrastructure/import/parsers/parser-common'

export class ParseImportWorkbookUseCaseImpl implements ParseImportWorkbookUseCase {
  private fileReader: ImportFileReaderPort

  constructor(fileReader: ImportFileReaderPort) {
    this.fileReader = fileReader
  }

  async execute(file: File): Promise<ParseImportWorkbookOutput> {
    const workbook = await this.fileReader.readWorkbook(file)

    const sheets: ParsedSheetSummary[] = []
    let detected = 0

    for (const sheet of workbook.sheets) {
      const detection = detectSheetSourceType(sheet.originalName, sheet.index)
      if (detection.sourceType !== undefined) {
        detected += 1
      }

      const sheetIncidents: ImportIncident[] = []

if (detection.sourceType === undefined) {
        sheetIncidents.push({
          sourceType: undefined,
          code: 'SHEET_TYPE_UNKNOWN',
          field: sheet.originalName,
          originalValue: sheet.originalName,
          description: `La hoja '${sheet.originalName}' no pudo clasificarse en un SourceType conocido (CATALOG, RECIPE_COSTING, MENU_PLAN, MEAL_COMPOSITION).`,
          severity: 'WARNING',
          recommendedAction: 'Revise el nombre de la hoja o clasifíquela manualmente.',
          provenance: {
            sourceType: 'CATALOG',
            fileName: workbook.fileName,
            sheetName: sheet.originalName,
            sheetIndex: sheet.index,
            analysisVersion: ANALYSIS_VERSION,
          },
          context: 'Detección de tipo de hoja',
        })
      } else if (detection.alternatives && detection.alternatives.length > 0) {
        sheetIncidents.push({
          sourceType: detection.sourceType,
          code: 'SHEET_TYPE_AMBIGUOUS',
          field: sheet.originalName,
          originalValue: sheet.originalName,
          normalizedValue: detection.sourceType,
          description: `La hoja '${sheet.originalName}' coincide con varias reglas (${[detection.sourceType, ...detection.alternatives].join(', ')}); se resolvió por la coincidencia más temprana en el nombre.`,
          severity: 'WARNING',
          recommendedAction: 'Confirme la clasificación de la hoja.',
          provenance: {
            sourceType: detection.sourceType,
            fileName: workbook.fileName,
            sheetName: sheet.originalName,
            sheetIndex: sheet.index,
            analysisVersion: ANALYSIS_VERSION,
          },
          context: 'Detección de tipo de hoja',
        })
      }

      let catalog: ParsedSheetSummary['catalog']
      let recipeCosting: ParsedSheetSummary['recipeCosting']
      let menuPlan: ParsedSheetSummary['menuPlan']
      let mealComposition: ParsedSheetSummary['mealComposition']

      if (detection.sourceType !== undefined) {
        const context: ParserContext = {
          fileName: workbook.fileName,
          sheetName: sheet.originalName,
          sheetIndex: sheet.index,
          sourceType: detection.sourceType,
        }

        if (detection.sourceType === 'CATALOG') {
          catalog = parseCatalogSheet(sheet.rows, context)
        } else if (detection.sourceType === 'RECIPE_COSTING') {
          recipeCosting = parseRecipeCostingSheet(sheet.rows, context)
        } else if (detection.sourceType === 'MENU_PLAN') {
          menuPlan = parseMenuPlanSheet(sheet.rows, context)
        } else if (detection.sourceType === 'MEAL_COMPOSITION') {
          mealComposition = parseMealCompositionSheet(sheet.rows, context)
        }
      }

      const summary: ParsedSheetSummary = {
        sheetName: sheet.originalName,
        sheetIndex: sheet.index,
        detection,
        sourceType: detection.sourceType,
        incidents: sheetIncidents,
        catalog,
        recipeCosting,
        menuPlan,
        mealComposition,
      }

      sheets.push(summary)
    }

    return {
      fileName: workbook.fileName,
      fileSize: workbook.fileSize,
      format: workbook.format,
      encoding: workbook.encoding,
      readerIncidents: workbook.incidents as readonly ReaderIncident[],
      sheets,
      stats: {
        totalSheets: workbook.sheets.length,
        detectedSheets: detected,
        undetectedSheets: workbook.sheets.length - detected,
      },
    }
  }
}
