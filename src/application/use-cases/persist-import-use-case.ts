import type { ImportedRow } from '../../domain/entities/imported-row'
import type { IngredientRepository } from '../ports/IngredientRepository'
import type { DishRepository } from '../ports/DishRepository'
import type { DishRecipeRepository, DishRecipeInput } from '../ports/DishRecipeRepository'
import type { MenuPlanRepository } from '../ports/MenuPlanRepository'
import type { MealCompositionRepository, NewMealCompositionTemplate } from '../ports/MealCompositionRepository'
import type { ImportBatchRepository } from '../ports/import-batch-repository'
import type { ImportAuditRepository } from '../ports/import-audit-repository'
import type { CurrentOperatorPort } from '../ports/current-operator-port'
import type { NewIngredient } from '../ports/IngredientRepository'
import type { NewDish } from '../ports/DishRepository'
import { fromCents } from '../../domain/value-objects/money'
import { type DishCategory, type WeekDay, type RecipeIngredient } from '../../domain/entities'
import { getDishKey } from '../../domain/value-objects/dish'
import { MENU_CATEGORY_SLOTS } from '../../domain/entities'

export interface PersistImportInput {
  readonly batchId: string
  readonly approvedRowNumbers: number[]
}

export interface PersistImportResult {
  readonly batchId: string
  readonly persistedCounts: {
    ingredients: number
    dishes: number
    dishRecipes: number
    recipeIngredients: number
    menuPlanCells: number
    mealCompositionTemplates: number
    mealCompositionComponents: number
  }
  readonly errors: string[]
}

export class PersistImportUseCase {
  private ingredientRepository: IngredientRepository
  private dishRepository: DishRepository
  private dishRecipeRepository: DishRecipeRepository
  private menuPlanRepository: MenuPlanRepository
  private mealCompositionRepository: MealCompositionRepository
  private batchRepository: ImportBatchRepository
  private auditRepository: ImportAuditRepository
  private operatorProvider: CurrentOperatorPort

  constructor(
    ingredientRepository: IngredientRepository,
    dishRepository: DishRepository,
    dishRecipeRepository: DishRecipeRepository,
    menuPlanRepository: MenuPlanRepository,
    mealCompositionRepository: MealCompositionRepository,
    batchRepository: ImportBatchRepository,
    auditRepository: ImportAuditRepository,
    operatorProvider: CurrentOperatorPort,
  ) {
    this.ingredientRepository = ingredientRepository
    this.dishRepository = dishRepository
    this.dishRecipeRepository = dishRecipeRepository
    this.menuPlanRepository = menuPlanRepository
    this.mealCompositionRepository = mealCompositionRepository
    this.batchRepository = batchRepository
    this.auditRepository = auditRepository
    this.operatorProvider = operatorProvider
  }

  async execute(input: PersistImportInput): Promise<PersistImportResult> {
    const batch = await this.batchRepository.findById(input.batchId)
    if (!batch) throw new Error(`Lote ${input.batchId} no encontrado.`)

    const auditLogs = await this.auditRepository.findByBatchId(batch.id)
    const lastAudit = auditLogs[auditLogs.length - 1]

    const operator = await this.operatorProvider.getCurrentOperator()
    if (!operator) throw new Error('Usuario no autenticado')

    // Get imported rows from Supabase
    const { SupabaseImportedRowRepository } = await import('../../infrastructure/supabase/repositories')
    const importedRowRepo = new SupabaseImportedRowRepository()
    const allRows = await importedRowRepo.findByBatchId(batch.id)
    const approvedRows = allRows.filter((r) => input.approvedRowNumbers.includes(r.rowNumber))

    const errors: string[] = []
    const persistedCounts = {
      ingredients: 0,
      dishes: 0,
      dishRecipes: 0,
      recipeIngredients: 0,
      menuPlanCells: 0,
      mealCompositionTemplates: 0,
      mealCompositionComponents: 0,
    }

    try {
      // Group rows by sourceType
      const rowsByType = this.groupBySourceType(approvedRows)

      // 1. CATALOG → ingredients
      if (rowsByType.CATALOG.length > 0) {
        const count = await this.persistCatalog(rowsByType.CATALOG)
        persistedCounts.ingredients = count
      }

      // 2. RECIPE_COSTING → dishes + dish_recipes + recipe_ingredients
      if (rowsByType.RECIPE_COSTING.length > 0) {
        const result = await this.persistRecipeCosting(rowsByType.RECIPE_COSTING)
        persistedCounts.dishes += result.dishes
        persistedCounts.dishRecipes += result.dishRecipes
        persistedCounts.recipeIngredients += result.recipeIngredients
      }

      // 3. MENU_PLAN → menu_plan_cells (requires dishes to exist)
      if (rowsByType.MENU_PLAN.length > 0) {
        const count = await this.persistMenuPlan(rowsByType.MENU_PLAN)
        persistedCounts.menuPlanCells = count
      }

      // 4. MEAL_COMPOSITION → meal_composition_templates + components
      if (rowsByType.MEAL_COMPOSITION.length > 0) {
        const result = await this.persistMealComposition(rowsByType.MEAL_COMPOSITION)
        persistedCounts.mealCompositionTemplates += result.templates
        persistedCounts.mealCompositionComponents += result.components
      }

      // Update batch status
      const completedBatch = {
        ...batch,
        status: 'COMPLETED' as const,
        processedAt: new Date().toISOString(),
        approvedRows: approvedRows.length,
        rejectedRows: allRows.length - approvedRows.length,
      }
      await this.batchRepository.save(completedBatch)

      // Update audit log
      if (lastAudit) {
        await this.auditRepository.save({
          ...lastAudit,
          approvals: approvedRows.map((r) => String(r.rowNumber)),
          rejections: allRows.filter((r) => !input.approvedRowNumbers.includes(r.rowNumber)).map((r) => String(r.rowNumber)),
          persistenceResult: errors.length > 0 ? 'partial' : 'success',
        })
      }

      return {
        batchId: batch.id,
        persistedCounts,
        errors,
      }
    } catch (error) {
      // On failure, update batch and audit with failed status
      const failedBatch = {
        ...batch,
        status: 'FAILED' as const,
        processedAt: new Date().toISOString(),
      }
      await this.batchRepository.save(failedBatch)

      if (lastAudit) {
        await this.auditRepository.save({
          ...lastAudit,
          persistenceResult: 'failed',
        })
      }

      throw error
    }
  }

  private groupBySourceType(rows: ImportedRow[]): Record<string, ImportedRow[]> {
    const groups: Record<string, ImportedRow[]> = {
      CATALOG: [],
      RECIPE_COSTING: [],
      MENU_PLAN: [],
      MEAL_COMPOSITION: [],
    }
    for (const row of rows) {
      if (groups[row.sourceType]) {
        groups[row.sourceType].push(row)
      }
    }
    return groups
  }

  private async persistCatalog(rows: ImportedRow[]): Promise<number> {
    const ingredients: NewIngredient[] = []

    for (const row of rows) {
      const data = row.normalizedData ?? row.rawData
      const costRaw = data.costo ?? data.cost
      const costCents = this.parseCostToCents(costRaw)

      if (costCents === null) {
        continue
      }

      ingredients.push({
        code: String(data.codigo ?? data.code ?? '').trim().toUpperCase(),
        category: String(data.bodega ?? data.category ?? 'Sin categoría').trim(),
        product: String(data.producto ?? data.product ?? '').trim(),
        presentation: String(data.presentacion ?? data.presentation ?? '—').trim(),
        cost: fromCents(costCents),
        status: (String(data.estado ?? data.status ?? 'ACTIVO').trim().toUpperCase() === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO') as 'ACTIVO' | 'INACTIVO',
      })
    }

    if (ingredients.length === 0) return 0

    const saved = await this.ingredientRepository.importMany(ingredients)
    return saved.length
  }

  private async persistRecipeCosting(rows: ImportedRow[]): Promise<{ dishes: number; dishRecipes: number; recipeIngredients: number }> {
    // Group by dish name (from sheet/block)
    const recipesByDish = new Map<string, {
      source: string
      ingredients: Array<{
        name: string
        purchasePresentation: string
        purchasePriceCents: number
        purchaseQuantity: number
        recipeQuantity: number
        purchaseUnitCostRaw?: number
        sourceFormula?: string
        sourceCell?: string
        yieldPercentage?: number
      }>
      serviceType: 'lunch' | 'breakfast' | 'snack'
      portions?: number
    }>()

    for (const row of rows) {
      const data = row.normalizedData ?? row.rawData
      const dishName = String(data.dishName ?? data.plato ?? '').trim()
      if (!dishName) continue

      const key = dishName.toLowerCase()
      const current = recipesByDish.get(key) ?? {
        source: String(data.source ?? row.sheetName ?? 'COSTEO RECETAS'),
        ingredients: [],
        serviceType: 'lunch' as const,
      }

      // Parse ingredient
      const purchasePriceCents = this.parseCostToCents(data.pvpCompra ?? data.purchasePrice ?? data['PVP compra'])
      const purchaseQuantity = this.parseNumber(data.cantidadCompraPresentacion ?? data.purchaseQuantity ?? data['Cantidad de compra-presentación'])
      const recipeQuantity = this.parseNumber(data.cantidadReceta ?? data.recipeQuantity ?? data['Cantidad en receta'])
      const purchaseUnitCostRaw = this.parseSubCentavo(data.costoPorGrOUnidad ?? data.unitCost ?? data['Costo por gr o uni'])
      const yieldPercentage = this.parseNumber(data.merma ?? data.yieldPercentage ?? data['Merma'])

      if (purchasePriceCents === null || purchaseQuantity === null || recipeQuantity === null) {
        continue
      }

      current.ingredients.push({
        name: String(data.ingrediente ?? data.ingredient ?? '').trim(),
        purchasePresentation: String(data.presentacionCompra ?? data.purchasePresentation ?? data['Presentación de compra'] ?? '').trim(),
        purchasePriceCents,
        purchaseQuantity,
        recipeQuantity,
        purchaseUnitCostRaw: purchaseUnitCostRaw ?? undefined,
        sourceFormula: data.sourceFormula as string | undefined,
        sourceCell: data.sourceCell as string | undefined,
        yieldPercentage: yieldPercentage ?? undefined,
      })

      // Determine service type from sheet name
      const sheetName = row.sheetName?.toUpperCase() ?? ''
      if (sheetName.includes('REFRIGERIO')) {
        current.serviceType = 'snack'
      } else if (sheetName.includes('DESAYUNO') || sheetName.includes('BREAKFAST')) {
        current.serviceType = 'breakfast'
      }

      recipesByDish.set(key, current)
    }

    // Get existing dishes for matching
    const existingDishes = await this.dishRepository.list()
    const dishByKey = new Map(existingDishes.map(d => [getDishKey(d.category, d.name), d]))
    const dishByName = new Map(existingDishes.map(d => [d.name.toLowerCase(), d]))

    let dishesCreated = 0
    let dishRecipesCreated = 0
    let recipeIngredientsCreated = 0

    // Prepare dish recipe inputs
    const recipeInputs: DishRecipeInput[] = []

    for (const [, recipe] of recipesByDish) {
      if (recipe.ingredients.length === 0) continue

      // Find or create dish
      let dish = dishByName.get(recipe.ingredients[0]?.name.toLowerCase() ?? '')
        ?? dishByKey.get(getDishKey('Proteína', recipe.ingredients[0]?.name ?? ''))

      // Try to find by any ingredient name
      if (!dish) {
        for (const ing of recipe.ingredients) {
          dish = dishByName.get(ing.name.toLowerCase())
          if (dish) break
        }
      }

      if (!dish) {
        // Create new dish
        const newDish: NewDish = {
          name: recipe.ingredients[0]?.name ?? 'Plato sin nombre',
          category: 'Proteína',
          description: '',
        }
        dish = await this.dishRepository.save(newDish)
        dishByName.set(dish.name.toLowerCase(), dish)
        dishesCreated++
      }

      // Convert ingredients to RecipeIngredient format
      const recipeIngredients = recipe.ingredients.map((ing) => ({
        id: `ri-${crypto.randomUUID()}`,
        name: ing.name,
        purchasePresentation: ing.purchasePresentation,
        purchasePrice: fromCents(ing.purchasePriceCents),
        purchaseQuantity: ing.purchaseQuantity,
        recipeQuantity: ing.recipeQuantity,
        purchaseUnitCostRaw: ing.purchaseUnitCostRaw,
        sourceFormula: ing.sourceFormula,
        sourceCell: ing.sourceCell,
        yieldPercentage: ing.yieldPercentage,
        isActive: true,
        deletedAt: undefined,
        deletedBy: undefined,
      })) as RecipeIngredient[]

      recipeInputs.push({
        dishId: dish.id,
        source: recipe.source,
        ingredients: recipeIngredients,
        serviceType: recipe.serviceType,
        portions: recipe.portions,
      })
      dishRecipesCreated++
      recipeIngredientsCreated += recipeIngredients.length
    }

    if (recipeInputs.length > 0) {
      await this.dishRecipeRepository.saveMany(recipeInputs)
    }

    return { dishes: dishesCreated, dishRecipes: dishRecipesCreated, recipeIngredients: recipeIngredientsCreated }
  }

  private async persistMenuPlan(rows: ImportedRow[]): Promise<number> {
    const cells: Array<{
      weekStartDate: string
      day: WeekDay
      category: DishCategory
      dishName: string
      serviceType: 'lunch' | 'breakfast' | 'snack'
    }> = []

    for (const row of rows) {
      const data = row.normalizedData ?? row.rawData
      const weekStartDate = data.weekStartDate as string
      const day = data.day as WeekDay
      const category = data.category as DishCategory
      const dishName = String(data.dish ?? data.dishName ?? '').trim()

      if (!weekStartDate || !day || !category || !dishName) continue

      const sheetName = row.sheetName?.toUpperCase() ?? ''
      let serviceType: 'lunch' | 'breakfast' | 'snack' = 'lunch'
      if (sheetName.includes('REFRIGERIO')) serviceType = 'snack'
      else if (sheetName.includes('DESAYUNO')) serviceType = 'breakfast'

      cells.push({ weekStartDate, day, category, dishName, serviceType })
    }

    if (cells.length === 0) return 0

    // Get existing dishes for matching
    const existingDishes = await this.dishRepository.list()
    const dishByKey = new Map(existingDishes.map(d => [getDishKey(d.category, d.name), d]))

    let cellsCreated = 0

    // Group by week/day/category to handle slots
    const groups = new Map<string, Array<{ dishName: string; serviceType: 'lunch' | 'breakfast' | 'snack' }>>()

    for (const cell of cells) {
      const key = `${cell.weekStartDate}|${cell.day}|${cell.category}`
      const group = groups.get(key) ?? []
      group.push({ dishName: cell.dishName, serviceType: cell.serviceType })
      groups.set(key, group)
    }

    for (const [key, items] of groups) {
      const [weekStartDate, day, category] = key.split('|')
      const capacity = MENU_CATEGORY_SLOTS[category as DishCategory]
      if (capacity === 0) continue

      // Clear existing cells for this slot
      for (let slot = 0; slot < capacity; slot++) {
        await this.menuPlanRepository.clearCell({ weekStartDate, day: day as WeekDay, category: category as DishCategory, slot })
      }

      // Fill slots
      for (let slot = 0; slot < Math.min(items.length, capacity); slot++) {
        const item = items[slot]
        const dishKey = getDishKey(category as DishCategory, item.dishName)
        const dish = dishByKey.get(dishKey)

        if (!dish) {
          // Try partial match
          const words = item.dishName.toLowerCase().split(' ').filter(w => w.length > 3)
          for (const [existingKey, existingDish] of dishByKey) {
            if (words.some(w => existingKey.includes(w))) {
              await this.menuPlanRepository.setCell({
                weekStartDate,
                day: day as WeekDay,
                category: category as DishCategory,
                slot,
                dishId: existingDish.id,
              })
              cellsCreated++
              break
            }
          }
        } else {
          await this.menuPlanRepository.setCell({
            weekStartDate,
            day: day as WeekDay,
            category: category as DishCategory,
            slot,
            dishId: dish.id,
          })
          cellsCreated++
        }
      }
    }

    return cellsCreated
  }

  private async persistMealComposition(rows: ImportedRow[]): Promise<{ templates: number; components: number }> {
    // Group by template title
    interface TemplateAccumulator {
      titleRow: number
      name: string
      serviceType: 'lunch' | 'breakfast' | 'snack'
      components: Array<{
        componentType: string
        originalName: string
        standardQuantity?: number
        unit?: string
        unitCostRaw?: number
        portionCostCents?: number
        sourceFormula?: string
        sourceCell?: string
      }>
      sheetTargetCents?: number
    }

    const templatesByName = new Map<string, TemplateAccumulator>()

    for (const row of rows) {
      const data = row.normalizedData ?? row.rawData
      const templateName = (data.templateName ?? data.name ?? '') as string
      if (!templateName) continue

      const current = templatesByName.get(templateName) ?? {
        titleRow: row.rowNumber,
        name: templateName,
        serviceType: 'lunch' as const,
        components: [],
      }

      // Determine service type from verified targets or sheet
      const sheetName = row.sheetName?.toUpperCase() ?? ''
      if (sheetName.includes('REFRIGERIO') || sheetName.includes('SNACK')) {
        current.serviceType = 'snack'
      }

      // Component row
      const componentType = (data.componente ?? data.component ?? data.componentType) as string
      if (componentType) {
        const portionCostCents = this.parseCostToCents(data.costoPorPorcion ?? data.portionCost ?? data['Costo por Porción'])
        const unitCostRaw = this.parseSubCentavo(data.costoUnitario ?? data.unitCost ?? data['Costo Unitario'])
        const standardQuantity = this.parseNumber(data.cantidad ?? data.quantity ?? data['Cantidad'])
        const unit = data.unidad ?? data.unit ?? data['Unidad']

        current.components.push({
          componentType: String(componentType).trim().toUpperCase(),
          originalName: String(componentType).trim(),
          standardQuantity: standardQuantity ?? undefined,
          unit: unit ? String(unit).trim() : undefined,
          unitCostRaw: unitCostRaw ?? undefined,
          portionCostCents: portionCostCents ?? undefined,
          sourceFormula: data.sourceFormula as string | undefined,
          sourceCell: data.sourceCell as string | undefined,
        })
      }

      // Target total row (empty component, has portion cost)
      const portionCostCentsForTarget = this.parseCostToCents(data.costoPorPorcion ?? data.portionCost ?? data['Costo por Porción'])
      if (!componentType && portionCostCentsForTarget !== null) {
        current.sheetTargetCents = portionCostCentsForTarget
      }

      templatesByName.set(templateName, current)
    }

    let templatesCreated = 0
    let componentsCreated = 0

    for (const [, template] of templatesByName) {
      if (template.components.length === 0) continue

      const newTemplate: NewMealCompositionTemplate = {
        name: template.name,
        serviceType: template.serviceType,
        targetTotalCost: template.sheetTargetCents !== undefined ? fromCents(template.sheetTargetCents) : undefined,
        calculatedTotalCost: undefined,
        tolerance: 1,
        aliases: [],
        provenance: undefined,
        components: template.components.map(comp => ({
          componentType: comp.componentType as any,
          name: comp.originalName,
          standardQuantity: comp.standardQuantity,
          unit: comp.unit as any,
          netQuantityPerPortion: comp.standardQuantity,
          referenceUnitCost: comp.unitCostRaw !== undefined ? fromCents(Math.round(comp.unitCostRaw * 10000)) : undefined,
          referenceUnitCostRaw: comp.unitCostRaw,
          sourceFormula: comp.sourceFormula,
          sourceCell: comp.sourceCell,
          targetPortionCost: comp.portionCostCents !== undefined ? fromCents(comp.portionCostCents) : undefined,
          calculatedCost: comp.portionCostCents !== undefined ? fromCents(comp.portionCostCents) : undefined,
          yieldPercentage: undefined,
          mermaPercentage: undefined,
          aliases: [],
          provenance: undefined,
        })),
      }

      const saved = await this.mealCompositionRepository.saveMany([newTemplate])
      templatesCreated += saved.length
      componentsCreated += saved[0]?.components.length ?? 0
    }

    return { templates: templatesCreated, components: componentsCreated }
  }

  private parseCostToCents(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null
    const str = String(value).trim().replace(/[^\d.,-]/g, '')
    if (!str) return null
    const lastComma = str.lastIndexOf(',')
    const lastDot = str.lastIndexOf('.')
    const normalized = lastComma > lastDot
      ? str.replace(/\./g, '').replace(',', '.')
      : str.replace(/,/g, '')
    const dollars = Number(normalized)
    if (!Number.isFinite(dollars) || dollars < 0) return null
    return Math.round(dollars * 100)
  }

  private parseNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null
    const str = String(value).trim().replace(/[^\d.,-]/g, '')
    if (!str) return null
    const lastComma = str.lastIndexOf(',')
    const lastDot = str.lastIndexOf('.')
    const normalized = lastComma > lastDot
      ? str.replace(/\./g, '').replace(',', '.')
      : str.replace(/,/g, '')
    const num = Number(normalized)
    return Number.isFinite(num) ? num : null
  }

  private parseSubCentavo(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null
    const str = String(value).trim().replace(/[^\d.,-]/g, '')
    if (!str) return null
    const lastComma = str.lastIndexOf(',')
    const lastDot = str.lastIndexOf('.')
    const normalized = lastComma > lastDot
      ? str.replace(/\./g, '').replace(',', '.')
      : str.replace(/,/g, '')
    const num = Number(normalized)
    return Number.isFinite(num) ? num : null
  }
}