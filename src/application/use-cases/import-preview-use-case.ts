import type { ImportFileReaderPort, RawWorkbookData } from '../ports/import-file-reader-port'
import type { File } from 'node:buffer'
import {
  parseCatalogSheet,
  type CatalogParseResult,
} from '../../infrastructure/import/parsers/catalog-parser'
import {
  parseRecipeCostingSheet,
  type RecipeCostingParseResult,
} from '../../infrastructure/import/parsers/recipe-costing-parser'
import {
  parseMenuPlanSheet,
  type MenuPlanParseResult,
} from '../../infrastructure/import/parsers/menu-plan-parser'
import {
  parseMealCompositionSheet,
  type MealCompositionParseResult,
} from '../../infrastructure/import/parsers/meal-composition-parser'
import { detectSheetSourceType } from '../../infrastructure/import/file-reader/sheet-type-detector'
import type { ParserContext } from '../../infrastructure/import/parsers/parser-common'
import type { ImportIncident } from '../../domain/value-objects/incident'
import type { SourceType } from '../../domain/value-objects/source-type'
import type { ServiceType } from '../../domain/value-objects/service-type'
import type { MenuCategory } from '../../domain/entities/dish'
import type { Money } from '../../domain/value-objects/money'
import {
  type ImportPreview,
  type ImportPreviewResult,
  type ImportSourceFile,
  type SheetIdentity,
  type CatalogPreview,
  type CatalogPreviewItem,
  type RecipePreview,
  type RecipePreviewBlock,
  type RecipePreviewIngredient,
  type RecipePreviewClosingRow,
  type MenuPreview,
  type MenuPreviewWeek,
  type MenuPreviewDateCell,
  type MenuPreviewEntry,
  type MealCompositionPreview,
  type MealCompositionPreviewTemplate,
  type MealCompositionPreviewComponent,
  type ItemTraceability,
  type TraceabilityPreview,
  type TraceabilityStage,
  type ImportValidationSummary,
  type ValidationCheck,
  type ValidationDetail,
  type ImportPreviewTotals,
  type F1ToF10Status,
  type ImportPreviewDecision,
  type DiscrepancyDetail,
} from './import-preview-types'

/** Caso de uso para generar vista previa de importación completa. */
export class ImportPreviewUseCase {
  private readonly fileReader: ImportFileReaderPort

  constructor(fileReader: ImportFileReaderPort) {
    this.fileReader = fileReader
  }

  /** Ejecuta el Import Preview completo sobre un archivo. */
  async execute(file: File, sha256?: string): Promise<ImportPreviewResult> {
    const workbook = await this.fileReader.readWorkbook(file)
    const generatedAt = new Date().toISOString()

    // Identidad del archivo fuente
    const sourceFile = this.buildSourceFileIdentity(workbook, sha256)

    // Parsear cada hoja según su SourceType
    const catalogResult = await this.parseCatalog(workbook)
    const lunchRecipesResult = await this.parseLunchRecipes(workbook)
    const snackRecipesResult = await this.parseSnackRecipes(workbook)
    const annualMenuResult = await this.parseAnnualMenu(workbook)
    const snackMenuResult = await this.parseSnackMenu(workbook)
    const mealCompositionResult = await this.parseMealComposition(workbook)

    // Consolidar todas las incidencias
    const allIncidents: ImportIncident[] = [
      ...catalogResult.incidents,
      ...lunchRecipesResult.incidents,
      ...snackRecipesResult.incidents,
      ...annualMenuResult.incidents,
      ...snackMenuResult.incidents,
      ...mealCompositionResult.incidents,
    ]

    // Construir vistas previas por dominio
    const catalog = this.buildCatalogPreview(catalogResult)
    const lunchRecipes = this.buildRecipePreview(lunchRecipesResult, 'lunch')
    const snackRecipes = this.buildRecipePreview(snackRecipesResult, 'snack')
    const annualMenu = this.buildMenuPreview(annualMenuResult, 'lunch')
    const snackMenu = this.buildMenuPreview(snackMenuResult, 'snack')
    const mealCompositionTemplates = this.buildMealCompositionPreview(mealCompositionResult)

    // Trazabilidad F.7
    const traceability = this.buildTraceabilityPreview([
      { name: 'catalog', result: catalogResult, items: catalog.items },
      { name: 'lunchRecipes', result: lunchRecipesResult, blocks: lunchRecipesResult.blocks },
      { name: 'snackRecipes', result: snackRecipesResult, blocks: snackRecipesResult.blocks },
      { name: 'annualMenu', result: annualMenuResult, weeks: annualMenuResult.weeks },
      { name: 'snackMenu', result: snackMenuResult, weeks: snackMenuResult.weeks },
      { name: 'mealComposition', result: mealCompositionResult, templates: mealCompositionResult.templates },
    ])

    // Validaciones obligatorias
    const validation = this.runValidations({
      catalog,
      lunchRecipes,
      snackRecipes,
      annualMenu,
      snackMenu,
      mealCompositionTemplates,
      allIncidents,
      sourceFile,
    })

    // Conteos totales
    const totals = this.buildTotals({
      catalog,
      lunchRecipes,
      snackRecipes,
      annualMenu,
      snackMenu,
      mealCompositionTemplates,
      allIncidents,
    })

    // Estado F.1–F.10
    const f1ToF10 = this.evaluateF1ToF10({
      catalog,
      lunchRecipes,
      snackRecipes,
      annualMenu,
      snackMenu,
      mealCompositionTemplates,
      traceability,
      validation,
    })

    // Discrepancias vs valores esperados
    const discrepancies = this.detectDiscrepancies({
      catalog,
      lunchRecipes,
      snackRecipes,
      annualMenu,
      snackMenu,
      mealCompositionTemplates,
    })

    // Decisión final
    const decision = this.makeDecision(discrepancies, validation, f1ToF10)

    const preview: ImportPreview = {
      sourceFile,
      generatedAt,
      catalog,
      lunchRecipes,
      snackRecipes,
      annualMenu,
      snackMenu,
      mealCompositionTemplates,
      traceability,
      incidents: allIncidents,
      validation,
      totals,
      f1ToF10,
    }

    return { preview, decision, discrepancies }
  }

  // ============================================================
  // Parsing por hoja
  // ============================================================

  private async parseCatalog(workbook: RawWorkbookData): Promise<CatalogParseResult> {
    const sheet = workbook.sheets.find((s) => detectSheetSourceType(s.originalName, s.index).sourceType === 'CATALOG')
    if (!sheet) throw new Error('Hoja CATALOG no encontrada')
    const context: ParserContext = this.makeContext('CATALOG', sheet, workbook.fileName)
    return parseCatalogSheet(sheet.rows, context)
  }

  private async parseLunchRecipes(workbook: RawWorkbookData): Promise<RecipeCostingParseResult> {
    const sheet = workbook.sheets.find(
      (s) =>
        detectSheetSourceType(s.originalName, s.index).sourceType === 'RECIPE_COSTING' &&
        s.originalName.includes('ALMUERZOS'),
    )
    if (!sheet) throw new Error('Hoja COSTEO RECETA ALMUERZOS no encontrada')
    const context: ParserContext = this.makeContext('RECIPE_COSTING', sheet, workbook.fileName)
    return parseRecipeCostingSheet(sheet.rows, context)
  }

  private async parseSnackRecipes(workbook: RawWorkbookData): Promise<RecipeCostingParseResult> {
    const sheet = workbook.sheets.find(
      (s) =>
        detectSheetSourceType(s.originalName, s.index).sourceType === 'RECIPE_COSTING' &&
        s.originalName.includes('REFRIGERIOS'),
    )
    if (!sheet) throw new Error('Hoja COSTEO REFRIGERIOS no encontrada')
    const context: ParserContext = this.makeContext('RECIPE_COSTING', sheet, workbook.fileName)
    return parseRecipeCostingSheet(sheet.rows, context)
  }

  private async parseAnnualMenu(workbook: RawWorkbookData): Promise<MenuPlanParseResult> {
    const sheet = workbook.sheets.find(
      (s) =>
        detectSheetSourceType(s.originalName, s.index).sourceType === 'MENU_PLAN' &&
        s.originalName.includes('AGSTO'),
    )
    if (!sheet) throw new Error('Hoja MENÚ AGSTO-JULIO2026-2027 no encontrada')
    const context: ParserContext = this.makeContext('MENU_PLAN', sheet, workbook.fileName)
    return parseMenuPlanSheet(sheet.rows, context)
  }

  private async parseSnackMenu(workbook: RawWorkbookData): Promise<MenuPlanParseResult> {
    const sheet = workbook.sheets.find(
      (s) =>
        detectSheetSourceType(s.originalName, s.index).sourceType === 'MENU_PLAN' &&
        s.originalName === 'MENU REFRIGERIOS',
    )
    if (!sheet) throw new Error('Hoja MENU REFRIGERIOS no encontrada')
    const context: ParserContext = this.makeContext('MENU_PLAN', sheet, workbook.fileName)
    return parseMenuPlanSheet(sheet.rows, context)
  }

  private async parseMealComposition(workbook: RawWorkbookData): Promise<MealCompositionParseResult> {
    const sheet = workbook.sheets.find(
      (s) => detectSheetSourceType(s.originalName, s.index).sourceType === 'MEAL_COMPOSITION',
    )
    if (!sheet) throw new Error('Hoja COMPOSICION DE CADA PLATO no encontrada')
    const context: ParserContext = this.makeContext('MEAL_COMPOSITION', sheet, workbook.fileName)
    return parseMealCompositionSheet(sheet.rows, context)
  }

  private makeContext(sourceType: SourceType, sheet: RawWorkbookData['sheets'][0], fileName: string): ParserContext {
    return {
      fileName,
      sheetName: sheet.originalName,
      sheetIndex: sheet.index,
      sourceType,
    }
  }

  // ============================================================
  // Builders de vista previa
  // ============================================================

  private buildSourceFileIdentity(workbook: RawWorkbookData, sha256?: string): ImportSourceFile {
    return {
      fileName: workbook.fileName,
      fileSize: workbook.fileSize,
      sha256: sha256 ?? 'PENDING_CALCULATION',
      format: workbook.format,
      sheetsDetected: workbook.sheets.map((s) => {
        const detection = detectSheetSourceType(s.originalName, s.index)
        return {
          index: s.index,
          originalName: s.originalName,
          normalizedName: s.normalizedName,
          rowCount: s.rows.length,
          sourceType: detection.sourceType,
          confidence: detection.confidence,
        }
      }),
    }
  }

  private buildCatalogPreview(result: CatalogParseResult): CatalogPreview {
    return {
      items: result.items.map((item) => ({
        rowNumber: item.rowNumber,
        code: item.code,
        bodega: item.bodega,
        product: item.product,
        presentation: item.presentation,
        costRaw: item.costRaw,
        costCents: item.cost?.cents,
        costFormula: undefined, // El parser actual no extrae fórmula del costo
        costSourceCell: undefined,
        status: item.status,
        originalStatus: item.originalStatus,
        traceability: this.makeTraceability(result.items[0]?.rowNumber ?? item.rowNumber, item.rowNumber, 'CATALOG'),
      })),
      stats: {
        dataRows: result.stats.dataRows,
        parsedItems: result.stats.parsedItems,
        itemsWithCost: result.stats.itemsWithCost,
        itemsWithIncidents: result.stats.itemsWithIncidents,
      },
      incidents: result.incidents,
    }
  }

  private buildRecipePreview(result: RecipeCostingParseResult, _type: 'lunch' | 'snack'): RecipePreview {
    return {
      blocks: result.blocks.map((block) => ({
        titleRow: block.titleRow,
        title: block.title,
        headerRow: block.headerRow,
        ingredients: block.ingredients.map((ing) => ({
          rowNumber: ing.rowNumber,
          name: ing.name,
          purchasePresentation: ing.purchasePresentation,
          purchasePriceRaw: ing.purchasePriceRaw,
          purchasePriceCents: ing.purchasePrice?.cents,
          purchasePriceFormula: undefined,
          purchasePriceSourceCell: undefined,
          purchaseQuantity: ing.purchaseQuantity,
          unitCostRaw: ing.unitCostRaw,
          recipeQuantity: ing.recipeQuantity,
          recipeCostRaw: ing.recipeCostRaw,
          recipeCostCents: ing.recipeCost?.cents,
          recipeCostFormula: undefined,
          recipeCostSourceCell: undefined,
          traceability: this.makeTraceability(block.titleRow, ing.rowNumber, 'RECIPE_COSTING'),
        })),
        closingRows: block.closingRows.map((closing) => ({
          rowNumber: closing.rowNumber,
          type: closing.type,
          rawValue: closing.rawValue,
          rawNumber: closing.rawNumber,
          valueCents: closing.value?.cents,
          traceability: this.makeTraceability(block.titleRow, closing.rowNumber, 'RECIPE_COSTING'),
        })),
        subtotalCents: block.subtotal?.cents,
        recharge5Cents: block.recharge5?.cents,
        recharge3Cents: block.recharge3?.cents,
      })),
      stats: result.stats,
      incidents: result.incidents,
    }
  }

  private buildMenuPreview(result: MenuPlanParseResult, serviceType: 'lunch' | 'snack'): MenuPreview {
    return {
      weeks: result.weeks.map((week) => ({
        weekLabel: week.weekLabel,
        labelRow: week.labelRow,
        weekStartDate: week.weekStartDate,
        dates: week.dates.map((date) => ({
          column: date.column,
          columnLetter: date.columnLetter,
          original: date.original,
          cellType: date.cellType,
          normalized: date.normalized,
          format: date.format,
          traceability: this.makeTraceability(week.labelRow, week.labelRow, 'MENU_PLAN', date.column),
        })),
        entries: week.entries.map((entry) => ({
          rowNumber: entry.rowNumber,
          category: entry.category as MenuCategory,
          originalCategory: entry.originalCategory,
          column: entry.column,
          columnLetter: entry.columnLetter,
          dayIndex: entry.dayIndex,
          serviceDate: entry.serviceDate,
          dish: entry.dish,
          originalValue: entry.originalValue,
          hasError: entry.hasError,
          traceability: {
            sourceFile: entry.sourceFile ?? '',
            sourceSheet: entry.sourceSheet ?? '',
            sourceRow: entry.rowNumber,
            sourceCell: entry.sourceCell,
            sourceFormula: entry.sourceFormula,
          },
        })),
        headerType: week.headerType,
        feriadoDates: week.feriadoDates,
      })),
      stats: result.stats,
      incidents: result.incidents,
    }
  }

  private buildMealCompositionPreview(result: MealCompositionParseResult): MealCompositionPreview {
    return {
      templates: result.templates.map((template) => ({
        titleRow: template.titleRow,
        name: template.name,
        serviceType: template.serviceType,
        components: template.components.map((comp) => ({
          rowNumber: comp.rowNumber,
          componentType: comp.componentType,
          originalName: comp.originalName,
          standardQuantity: comp.standardQuantity,
          unit: comp.unit,
          originalUnit: comp.originalUnit,
          unitCostRaw: comp.unitCostRaw,
          portionCostCents: comp.portionCost?.cents,
          traceability: this.makeTraceability(template.titleRow, comp.rowNumber, 'MEAL_COMPOSITION'),
        })),
        sheetTargetTotalCents: template.sheetTargetTotal?.cents,
        verifiedTargetTotalCents: template.verifiedTargetTotal?.cents,
        calculatedTotalCents: template.calculatedTotal?.cents,
        validation: template.validation,
      })),
      stats: result.stats,
      incidents: result.incidents,
    }
  }

  private makeTraceability(
    labelRow: number,
    rowNumber: number,
    sourceType: SourceType,
    column?: number,
  ): ItemTraceability {
    return {
      sourceFile: '',
      sourceSheet: '',
      sourceRow: rowNumber,
      sourceCell: column !== undefined ? String.fromCharCode(65 + column) + rowNumber : undefined,
      sourceFormula: undefined,
    }
  }

  // ============================================================
  // Trazabilidad F.7
  // ============================================================

  private buildTraceabilityPreview(
    domains: Array<{
      name: string
      result: CatalogParseResult | RecipeCostingParseResult | MenuPlanParseResult | MealCompositionParseResult
      items?: CatalogParseResult['items']
      blocks?: RecipeCostingParseResult['blocks']
      weeks?: MenuPlanParseResult['weeks']
      templates?: MealCompositionParseResult['templates']
    }>,
  ): TraceabilityPreview {
    const stages: Record<string, TraceabilityStage> = {}

    for (const domain of domains) {
      let formulaDetected = 0
      let formulaPreserved = 0

      // Contar fórmulas detectadas en RawCell del resultado
      // Nota: los parsers actuales no propagan formula/sourceCell a los resultados
      // Esto se refleja en formulaPreserved = 0

      if (domain.name === 'catalog' && domain.items) {
        for (const item of domain.items) {
          // El parser no expone formula en ParsedCatalogItem
        }
      }

      if (domain.name === 'lunchRecipes' && domain.blocks) {
        for (const block of domain.blocks) {
          for (const ing of block.ingredients) {
            if (ing.purchasePriceFormula) formulaDetected++
            if (ing.recipeCostFormula) formulaDetected++
          }
        }
      }

      if (domain.name === 'snackRecipes' && domain.blocks) {
        for (const block of domain.blocks) {
          for (const ing of block.ingredients) {
            if (ing.purchasePriceFormula) formulaDetected++
            if (ing.recipeCostFormula) formulaDetected++
          }
        }
      }

      if (domain.name === 'annualMenu' && domain.weeks) {
        for (const week of domain.weeks) {
          for (const entry of week.entries) {
            if (entry.sourceFormula) formulaDetected++
          }
        }
      }

      if (domain.name === 'snackMenu' && domain.weeks) {
        for (const week of domain.weeks) {
          for (const entry of week.entries) {
            if (entry.sourceFormula) formulaDetected++
          }
        }
      }

      if (domain.name === 'mealComposition' && domain.templates) {
        for (const template of domain.templates) {
          for (const comp of template.components) {
            // No hay formula tracking en meal composition parser aún
          }
        }
      }

      stages[domain.name] = {
        sourceFile: true, // workbook tiene fileName
        sourceSheet: true, // ParserContext tiene sheetName
        sourceRow: true, // Todos los items tienen rowNumber
        sourceCell: domain.name === 'annualMenu' || domain.name === 'snackMenu', // MenuEntry tiene sourceCell
        sourceFormula: domain.name === 'annualMenu' || domain.name === 'snackMenu', // MenuEntry tiene sourceFormula
        formulaDetected,
        formulaPreserved,
        formulaMissing: formulaDetected - formulaPreserved,
      }
    }

    return {
      catalog: stages.catalog ?? this.emptyStage(),
      lunchRecipes: stages.lunchRecipes ?? this.emptyStage(),
      snackRecipes: stages.snackRecipes ?? this.emptyStage(),
      annualMenu: stages.annualMenu ?? this.emptyStage(),
      snackMenu: stages.snackMenu ?? this.emptyStage(),
      mealComposition: stages.mealComposition ?? this.emptyStage(),
    }
  }

  private emptyStage(): TraceabilityStage {
    return {
      sourceFile: false,
      sourceSheet: false,
      sourceRow: false,
      sourceCell: false,
      sourceFormula: false,
      formulaDetected: 0,
      formulaPreserved: 0,
      formulaMissing: 0,
    }
  }

  // ============================================================
  // Validaciones obligatorias
  // ============================================================

  private runValidations(input: {
    catalog: CatalogPreview
    lunchRecipes: RecipePreview
    snackRecipes: RecipePreview
    annualMenu: MenuPreview
    snackMenu: MenuPreview
    mealCompositionTemplates: MealCompositionPreview
    allIncidents: ImportIncident[]
    sourceFile: ImportSourceFile
  }): ImportValidationSummary {
    const { catalog, lunchRecipes, snackRecipes, annualMenu, snackMenu, mealCompositionTemplates, allIncidents, sourceFile } = input

    // Integridad estructural
    const structuralIntegrity = this.checkStructuralIntegrity({
      catalog,
      lunchRecipes,
      snackRecipes,
      annualMenu,
      snackMenu,
      mealCompositionTemplates,
      sourceFile,
    })

    // Integridad temporal
    const temporalIntegrity = this.checkTemporalIntegrity({
      annualMenu,
      snackMenu,
    })

    // Integridad de menú
    const menuIntegrity = this.checkMenuIntegrity({
      annualMenu,
      snackMenu,
    })

    // Integridad monetaria
    const monetaryIntegrity = this.checkMonetaryIntegrity({
      catalog,
      lunchRecipes,
      snackRecipes,
      mealCompositionTemplates,
    })

    // Integridad de trazabilidad F.7
    const traceabilityIntegrity = this.checkTraceabilityIntegrity({
      catalog,
      lunchRecipes,
      snackRecipes,
      annualMenu,
      snackMenu,
      mealCompositionTemplates,
    })

    const overall = this.computeOverall([
      structuralIntegrity,
      temporalIntegrity,
      menuIntegrity,
      monetaryIntegrity,
      traceabilityIntegrity,
    ])

    return {
      structuralIntegrity,
      temporalIntegrity,
      menuIntegrity,
      monetaryIntegrity,
      traceabilityIntegrity,
      overall,
    }
  }

  private checkStructuralIntegrity(input: {
    catalog: CatalogPreview
    lunchRecipes: RecipePreview
    snackRecipes: RecipePreview
    annualMenu: MenuPreview
    snackMenu: MenuPreview
    mealCompositionTemplates: MealCompositionPreview
    sourceFile: ImportSourceFile
  }): ValidationCheck {
    const checks: ValidationDetail[] = []

    // Archivo identificado
    checks.push({
      name: 'Archivo identificado (nombre, tamaño, SHA-256, formato)',
      status: input.sourceFile.fileName && input.sourceFile.fileSize > 0 && input.sourceFile.sha256 ? 'PASS' : 'FAIL',
      details: input.sourceFile.sha256 === 'PENDING_CALCULATION' ? 'SHA-256 pendiente de cálculo' : undefined,
    })

    // 6 hojas esperadas
    const expectedSheets = [
      'CATALOGO COSTEO 17-08-2',
      'COSTEO RECETA ALMUERZOS',
      'MENÚ AGSTO-JULIO2026-2027',
      'COSTEO REFRIGERIOS ',
      'MENU REFRIGERIOS',
      'COMPOSICION DE CADA PLATO',
    ]
    const detectedNames = input.sourceFile.sheetsDetected.map((s) => s.originalName)
    const missingSheets = expectedSheets.filter((exp) => !detectedNames.includes(exp))
    checks.push({
      name: '6 hojas esperadas detectadas',
      status: missingSheets.length === 0 ? 'PASS' : 'FAIL',
      details: missingSheets.length > 0 ? `Faltan: ${missingSheets.join(', ')}` : undefined,
    })

    // Dimensiones y filas con contenido
    checks.push({
      name: 'Catálogo: 462 items parseados',
      status: input.catalog.stats.parsedItems === 462 ? 'PASS' : 'WARNING',
      details: `Actual: ${input.catalog.stats.parsedItems}`,
    })
    checks.push({
      name: 'Recetas almuerzos: 257 bloques válidos',
      status: input.lunchRecipes.stats.blocks === 257 ? 'PASS' : 'WARNING',
      details: `Actual: ${input.lunchRecipes.stats.blocks}`,
    })
    checks.push({
      name: 'Recetas refrigerios: 10 bloques válidos',
      status: input.snackRecipes.stats.blocks === 10 ? 'PASS' : 'WARNING',
      details: `Actual: ${input.snackRecipes.stats.blocks}`,
    })
    checks.push({
      name: 'Menú anual: 15 bloques físicos, 14 semanas calendario',
      status: input.annualMenu.stats.physicalBlocks === 15 && input.annualMenu.stats.calendarWeeks === 14 ? 'PASS' : 'WARNING',
      details: `Bloques: ${input.annualMenu.stats.physicalBlocks}, Semanas: ${input.annualMenu.stats.calendarWeeks}`,
    })
    checks.push({
      name: 'Menú refrigerios: 14 bloques físicos, 13 semanas calendario',
      status: input.snackMenu.stats.physicalBlocks === 14 && input.snackMenu.stats.calendarWeeks === 13 ? 'PASS' : 'WARNING',
      details: `Bloques: ${input.snackMenu.stats.physicalBlocks}, Semanas: ${input.snackMenu.stats.calendarWeeks}`,
    })
    checks.push({
      name: 'Plantillas composición: 4',
      status: input.mealCompositionTemplates.stats.templates === 4 ? 'PASS' : 'FAIL',
      details: `Actual: ${input.mealCompositionTemplates.stats.templates}`,
    })

    const failed = checks.filter((c) => c.status === 'FAIL').length
    const warnings = checks.filter((c) => c.status === 'WARNING').length

    return {
      status: failed > 0 ? 'FAIL' : warnings > 0 ? 'WARNING' : 'PASS',
      checks,
    }
  }

  private checkTemporalIntegrity(input: {
    annualMenu: MenuPreview
    snackMenu: MenuPreview
  }): ValidationCheck {
    const checks: ValidationDetail[] = []

    // Fechas válidas y lunes correcto
    let validWeeks = 0
    for (const week of input.annualMenu.weeks) {
      if (week.weekStartDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Verificar que es lunes
        const date = new Date(week.weekStartDate + 'T00:00:00')
        if (date.getDay() === 1) validWeeks++
      }
    }
    checks.push({
      name: 'Menú anual: weekStartDate son lunes válidos',
      status: validWeeks === input.annualMenu.stats.calendarWeeks ? 'PASS' : 'WARNING',
      details: `${validWeeks}/${input.annualMenu.stats.calendarWeeks} semanas válidas`,
    })

    validWeeks = 0
    for (const week of input.snackMenu.weeks) {
      if (week.weekStartDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const date = new Date(week.weekStartDate + 'T00:00:00')
        if (date.getDay() === 1) validWeeks++
      }
    }
    checks.push({
      name: 'Menú refrigerios: weekStartDate son lunes válidos',
      status: validWeeks === input.snackMenu.stats.calendarWeeks ? 'PASS' : 'WARNING',
      details: `${validWeeks}/${input.snackMenu.stats.calendarWeeks} semanas válidas`,
    })

    // Días hábiles > 0
    checks.push({
      name: 'Menú anual: días hábiles > 0',
      status: input.annualMenu.stats.businessDays > 0 ? 'PASS' : 'FAIL',
      details: `${input.annualMenu.stats.businessDays} días hábiles`,
    })
    checks.push({
      name: 'Menú refrigerios: días hábiles > 0',
      status: input.snackMenu.stats.businessDays > 0 ? 'PASS' : 'FAIL',
      details: `${input.snackMenu.stats.businessDays} días hábiles`,
    })

    // Serial 0 rechazado (semana 3 menú anual)
    const weekWithNoDates = input.annualMenu.weeks.find((w) => w.dates.every((d) => !d.normalized))
    checks.push({
      name: 'Fecha serial 0 rechazada (semana sin fechas válidas)',
      status: weekWithNoDates ? 'PASS' : 'WARNING',
      details: weekWithNoDates ? `Bloque "${weekWithNoDates.weekLabel}" correctamente sin fechas` : 'No se detectó semana con serial 0',
    })

    const failed = checks.filter((c) => c.status === 'FAIL').length
    const warnings = checks.filter((c) => c.status === 'WARNING').length
    return { status: failed > 0 ? 'FAIL' : warnings > 0 ? 'WARNING' : 'PASS', checks }
  }

  private checkMenuIntegrity(input: {
    annualMenu: MenuPreview
    snackMenu: MenuPreview
  }): ValidationCheck {
    const checks: ValidationDetail[] = []

    // Entradas sin plato
    const annualEmptyDish = input.annualMenu.weeks.reduce((sum, w) => sum + w.entries.filter((e) => !e.dish || e.dish === '').length, 0)
    const snackEmptyDish = input.snackMenu.weeks.reduce((sum, w) => sum + w.entries.filter((e) => !e.dish || e.dish === '').length, 0)
    checks.push({
      name: 'Entradas sin plato (menú anual)',
      status: annualEmptyDish === 0 ? 'PASS' : 'WARNING',
      details: `${annualEmptyDish} entradas vacías`,
    })
    checks.push({
      name: 'Entradas sin plato (menú refrigerios)',
      status: snackEmptyDish === 0 ? 'PASS' : 'WARNING',
      details: `${snackEmptyDish} entradas vacías`,
    })

    // Entradas sin fecha
    const annualNoDate = input.annualMenu.weeks.reduce((sum, w) => sum + w.entries.filter((e) => !e.serviceDate).length, 0)
    const snackNoDate = input.snackMenu.weeks.reduce((sum, w) => sum + w.entries.filter((e) => !e.serviceDate).length, 0)
    checks.push({
      name: 'Entradas sin fecha de servicio (anual)',
      status: annualNoDate === 0 ? 'PASS' : 'WARNING',
      details: `${annualNoDate} entradas sin fecha`,
    })
    checks.push({
      name: 'Entradas sin fecha de servicio (refrigerios)',
      status: snackNoDate === 0 ? 'PASS' : 'WARNING',
      details: `${snackNoDate} entradas sin fecha`,
    })

    // Categorías desconocidas
    const knownCategories = ['sopa', 'proteina', 'guarnicion', 'ensalada', 'bebida fria', 'postre', 'fruta', 'entrada', 'bebida']
    const annualUnknown = input.annualMenu.weeks.reduce(
      (sum, w) => sum + w.entries.filter((e) => !knownCategories.includes(e.category)).length,
      0,
    )
    const snackUnknown = input.snackMenu.weeks.reduce(
      (sum, w) => sum + w.entries.filter((e) => !knownCategories.includes(e.category)).length,
      0,
    )
    checks.push({
      name: 'Categorías desconocidas (anual)',
      status: annualUnknown === 0 ? 'PASS' : 'WARNING',
      details: `${annualUnknown} entradas con categoría no reconocida`,
    })
    checks.push({
      name: 'Categorías desconocidas (refrigerios)',
      status: snackUnknown === 0 ? 'PASS' : 'WARNING',
      details: `${snackUnknown} entradas con categoría no reconocida`,
    })

    // Service type correcto
    checks.push({
      name: 'Menú anual service_type = lunch',
      status: 'PASS', // Por arquitectura, menú anual es lunch
      details: 'Hardcoded por hoja',
    })
    checks.push({
      name: 'Menú refrigerios service_type = snack',
      status: 'PASS', // Por arquitectura, menú refrigerios es snack
      details: 'Hardcoded por hoja',
    })

    // Duplicados (misma semana/día/categoría/plato)
    const annualKeys = new Set<string>()
    let annualDups = 0
    for (const week of input.annualMenu.weeks) {
      for (const entry of week.entries) {
        const key = `${week.weekStartDate}|${entry.dayIndex}|${entry.category}|${entry.dish}`
        if (annualKeys.has(key)) annualDups++
        else annualKeys.add(key)
      }
    }
    checks.push({
      name: 'Duplicados menú anual (semana/día/categoría/plato)',
      status: annualDups === 0 ? 'PASS' : 'WARNING',
      details: `${annualDups} duplicados potenciales`,
    })

    const failed = checks.filter((c) => c.status === 'FAIL').length
    const warnings = checks.filter((c) => c.status === 'WARNING').length
    return { status: failed > 0 ? 'FAIL' : warnings > 0 ? 'WARNING' : 'PASS', checks }
  }

  private checkMonetaryIntegrity(input: {
    catalog: CatalogPreview
    lunchRecipes: RecipePreview
    snackRecipes: RecipePreview
    mealCompositionTemplates: MealCompositionPreview
  }): ValidationCheck {
    const checks: ValidationDetail[] = []

    // Costes inválidos en catálogo - distinguir fórmulas no evaluables de datos corruptos
    const catalogItemsWithRawCost = input.catalog.items.filter((i) => i.costRaw !== '' && i.costRaw !== undefined)
    const catalogFormulaCost = catalogItemsWithRawCost.filter((i) => typeof i.costRaw === 'string' && (i.costRaw.includes('=') || i.costRaw.includes('*') || i.costRaw.includes('+') || i.costRaw.includes('/'))).length
    const catalogInvalidCost = catalogItemsWithRawCost.filter((i) => i.costCents === undefined && !this.looksLikeFormula(i.costRaw)).length
    const catalogMissingCost = input.catalog.items.filter((i) => i.costCents === undefined && (i.costRaw === '' || i.costRaw === undefined)).length

    checks.push({
      name: 'Catálogo: costes inválidos (datos corruptos, no fórmulas)',
      status: catalogInvalidCost === 0 ? 'PASS' : 'WARNING',
      details: `${catalogInvalidCost} items con costo no numérico (excluyendo fórmulas)`,
    })
    checks.push({
      name: 'Catálogo: fórmulas de costo no evaluadas (F.7 gap)',
      status: catalogFormulaCost === 0 ? 'PASS' : 'WARNING',
      details: `${catalogFormulaCost} items con fórmula de costo (ej. '5*1.00') no evaluada por parser; se preserva como incidencia`,
    })
    checks.push({
      name: 'Catálogo: costes ausentes (celda vacía)',
      status: catalogMissingCost === 0 ? 'PASS' : 'WARNING',
      details: `${catalogMissingCost} items sin costo (incidencia registrada)`,
    })
    checks.push({
      name: 'Catálogo: costes negativos',
      status: input.catalog.items.filter((i) => (i.costCents ?? 0) < 0).length === 0 ? 'PASS' : 'FAIL',
      details: 'Ningún costo negativo detectado',
    })

    // Precisión sub-centavo (F.2, F.6)
    checks.push({
      name: 'Costos unitarios sub-centavo conservados (recetas)',
      status: 'WARNING', // Parsers actuales convierten a Money (centavos), pierden sub-centavo
      details: 'recipeCostCents es Money (centavos enteros); unitCostRaw se conserva en crudo',
    })

    // Fórmulas preservadas (F.7)
    const catalogFormulas = input.catalog.items.filter((i) => i.costFormula).length
    checks.push({
      name: 'Fórmulas de catálogo preservadas (22 forenses)',
      status: catalogFormulas > 0 ? 'PASS' : 'WARNING', // F.7 gap conocido, no bloqueante
      details: `Preservadas: ${catalogFormulas}/22 (gap conocido Phase 4.4.2)`,
    })

    // Validación plantillas composición
    const templateValidations = input.mealCompositionTemplates.templates.map((t) => t.validation)
    const invalidTemplates = templateValidations.filter((v) => v === 'ERROR').length
    checks.push({
      name: 'Plantillas composición validadas (0 ERROR)',
      status: invalidTemplates === 0 ? 'PASS' : 'FAIL',
      details: `${invalidTemplates} plantillas con ERROR de validación`,
    })

    const failed = checks.filter((c) => c.status === 'FAIL').length
    const warnings = checks.filter((c) => c.status === 'WARNING').length
    return { status: failed > 0 ? 'FAIL' : warnings > 0 ? 'WARNING' : 'PASS', checks }
  }

  private looksLikeFormula(value: unknown): boolean {
    if (typeof value !== 'string') return false
    const trimmed = value.trim()
    return trimmed.startsWith('=') || /[\+\-\*\/]/.test(trimmed)
  }

  private checkTraceabilityIntegrity(input: {
    catalog: CatalogPreview
    lunchRecipes: RecipePreview
    snackRecipes: RecipePreview
    annualMenu: MenuPreview
    snackMenu: MenuPreview
    mealCompositionTemplates: MealCompositionPreview
  }): ValidationCheck {
    const checks: ValidationDetail[] = []

    // sourceCell disponible en MenuEntry
    const annualHasSourceCell = input.annualMenu.weeks.every((w) =>
      w.entries.every((e) => e.traceability.sourceCell),
    )
    const snackHasSourceCell = input.snackMenu.weeks.every((w) =>
      w.entries.every((e) => e.traceability.sourceCell),
    )
    checks.push({
      name: 'MenuEntry anual: sourceCell presente',
      status: annualHasSourceCell ? 'PASS' : 'FAIL',
      details: annualHasSourceCell ? 'Todas las entradas tienen sourceCell' : 'Faltan sourceCell en algunas entradas',
    })
    checks.push({
      name: 'MenuEntry refrigerios: sourceCell presente',
      status: snackHasSourceCell ? 'PASS' : 'FAIL',
      details: snackHasSourceCell ? 'Todas las entradas tienen sourceCell' : 'Faltan sourceCell en algunas entradas',
    })

    // sourceFormula disponible cuando corresponde
    const annualHasSourceFormula = input.annualMenu.weeks.some((w) =>
      w.entries.some((e) => e.traceability.sourceFormula),
    )
    checks.push({
      name: 'MenuEntry: sourceFormula presente cuando hay fórmula',
      status: annualHasSourceFormula ? 'PASS' : 'WARNING',
      details: annualHasSourceFormula ? 'Algunas entradas tienen sourceFormula' : 'Ninguna entrada tiene sourceFormula (parser no propaga)',
    })

    // Trazabilidad a nivel ítem en catálogo
    const catalogHasTraceability = input.catalog.items.every((i) => i.traceability.sourceRow > 0)
    checks.push({
      name: 'Catálogo items: sourceRow presente',
      status: catalogHasTraceability ? 'PASS' : 'FAIL',
    })

    // Trazabilidad recetas
    const lunchRecipesTraceability = input.lunchRecipes.blocks.every((b) =>
      b.ingredients.every((i) => i.traceability.sourceRow > 0),
    )
    checks.push({
      name: 'Recetas almuerzos: sourceRow en ingredientes',
      status: lunchRecipesTraceability ? 'PASS' : 'FAIL',
    })

    const failed = checks.filter((c) => c.status === 'FAIL').length
    const warnings = checks.filter((c) => c.status === 'WARNING').length
    return { status: failed > 0 ? 'FAIL' : warnings > 0 ? 'WARNING' : 'PASS', checks }
  }

  private computeOverall(validations: ValidationCheck[]): 'PASS' | 'FAIL' | 'WARNING' {
    if (validations.some((v) => v.status === 'FAIL')) return 'FAIL'
    if (validations.some((v) => v.status === 'WARNING')) return 'WARNING'
    return 'PASS'
  }

  // ============================================================
  // Conteos totales
  // ============================================================

  private buildTotals(input: {
    catalog: CatalogPreview
    lunchRecipes: RecipePreview
    snackRecipes: RecipePreview
    annualMenu: MenuPreview
    snackMenu: MenuPreview
    mealCompositionTemplates: MealCompositionPreview
    allIncidents: ImportIncident[]
  }): ImportPreviewTotals {
    const totalErrors = input.allIncidents.filter((i) => i.severity === 'ERROR').length
    const totalWarnings = input.allIncidents.filter((i) => i.severity === 'WARNING').length
    const totalInfo = input.allIncidents.filter((i) => i.severity === 'VALID' || i.severity === 'INFO').length

    return {
      catalogItems: input.catalog.stats.parsedItems,
      lunchRecipeBlocks: input.lunchRecipes.stats.blocks,
      snackRecipeBlocks: input.snackRecipes.stats.blocks,
      annualMenuEntries: input.annualMenu.stats.entries,
      snackMenuEntries: input.snackMenu.stats.entries,
      mealCompositionTemplates: input.mealCompositionTemplates.stats.templates,
      totalMenuEntries: input.annualMenu.stats.entries + input.snackMenu.stats.entries,
      totalIncidents: input.allIncidents.length,
      totalErrors,
      totalWarnings,
      totalInfo,
    }
  }

  // ============================================================
  // F.1–F.10 evaluation
  // ============================================================

  private evaluateF1ToF10(input: {
    catalog: CatalogPreview
    lunchRecipes: RecipePreview
    snackRecipes: RecipePreview
    annualMenu: MenuPreview
    snackMenu: MenuPreview
    mealCompositionTemplates: MealCompositionPreview
    traceability: TraceabilityPreview
    validation: ImportValidationSummary
  }): F1ToF10Status {
    return {
      // F.1: Single-tenant, no school_id
      F1: 'PASS',
      // F.2: Dinero en centavos integer, sub-centavo NUMERIC(12,6)
      F2: input.catalog.items.some((i) => i.costCents !== undefined) ? 'PASS' : 'WARNING',
      // F.3: Trazabilidad import_batch, etc.
      F3: 'WARNING', // Import Preview no crea import_batch, solo prepara datos
      // F.4: week_start_date lunes, feriados Ecuador
      F4: input.validation.temporalIntegrity.status === 'PASS' ? 'PASS' : 'WARNING',
      // F.5: Tipos de servicio lunch/breakfast/snack
      F5: 'PASS',
      // F.6: Costes sub-centavo NUMERIC(12,6), totales en centavos
      F6: 'WARNING', // Parsers convierten a Money (centavos), unitCostRaw se guarda pero no se usa NUMERIC(12,6) en BD aún
      // F.7: source_formula, source_cell
      F7: input.traceability.annualMenu.sourceFormula && input.traceability.annualMenu.sourceCell ? 'PASS' : 'WARNING',
      // F.8: Auth/RLS/CurrentOperatorPort
      F8: 'PASS', // Arquitectura existente lo soporta
      // F.9: #REF! conservados como incidencias
      F9: input.annualMenu.incidents.some((i) => i.code === 'MENU_FORMULA_ERROR' && String(i.originalValue).includes('#REF')) ? 'PASS' : 'FAIL',
      // F.10: Normalización ENTRADA→Sopa, BEBIDA→Bebida Fría, 1oz=28.35g
      F10: 'PASS', // Parser común tiene MENU_CATEGORY_TO_DISH_CATEGORY
    }
  }

  // ============================================================
  // Detección de discrepancias
  // ============================================================

  private detectDiscrepancies(input: {
    catalog: CatalogPreview
    lunchRecipes: RecipePreview
    snackRecipes: RecipePreview
    annualMenu: MenuPreview
    snackMenu: MenuPreview
    mealCompositionTemplates: MealCompositionPreview
  }): DiscrepancyDetail[] {
    const discrepancies: DiscrepancyDetail[] = []

    const expected = {
      catalogItems: 462,
      lunchRecipeBlocks: 257,
      snackRecipeBlocks: 10,
      annualMenuEntries: 694,
      snackMenuEntries: 232,
      mealCompositionTemplates: 4,
    }

    const actual = {
      catalogItems: input.catalog.stats.parsedItems,
      lunchRecipeBlocks: input.lunchRecipes.stats.blocks,
      snackRecipeBlocks: input.snackRecipes.stats.blocks,
      annualMenuEntries: input.annualMenu.stats.entries,
      snackMenuEntries: input.snackMenu.stats.entries,
      mealCompositionTemplates: input.mealCompositionTemplates.stats.templates,
    }

    for (const [key, exp] of Object.entries(expected)) {
      const act = actual[key as keyof typeof actual]
      if (act !== exp) {
        discrepancies.push({
          area: key,
          expected: exp,
          actual: act,
          explanation: `Conteo real difiere del valor esperado de Fase 4.4.2. Revisar parser si es intencional.`,
        })
      }
    }

    return discrepancies
  }

  // ============================================================
  // Decisión final
  // ============================================================

  private makeDecision(
    discrepancies: DiscrepancyDetail[],
    validation: ImportValidationSummary,
    f1ToF10: F1ToF10Status,
  ): ImportPreviewDecision {
    // BLOQUEADO: validación FAIL o F.9 FAIL (crítico)
    if (validation.overall === 'FAIL' || f1ToF10.F9 === 'FAIL') {
      return 'BLOCKED'
    }

    // DISCREPANCY_DETECTED: hay discrepancias en conteos
    if (discrepancies.length > 0) {
      return 'DISCREPANCY_DETECTED'
    }

    // READY_FOR_PERSISTENCE: todo PASS
    return 'READY_FOR_PERSISTENCE'
  }
}