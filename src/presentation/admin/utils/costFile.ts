import type { Dish, RecipeIngredient } from '../../../domain/entities'
import { fromDollars } from '../../../domain/value-objects/money'
import {
  normalizeDishName,
  getDishMatchKey,
} from '../../../domain/value-objects/dish'
import {
  downloadCsv,
  normalizeText,
  readSpreadsheetSheets,
  type SpreadsheetSheet,
} from './spreadsheet'
import {
  parseCostNumber,
  parseQuantityNumber,
} from './costFormat'

export interface ParsedCostRecipe {
  key: string
  dishName: string
  source: string
  rowNumber: number
  ingredients: RecipeIngredient[]
  warnings: string[]
}

export interface ParsedCostFile {
  recipes: ParsedCostRecipe[]
  warnings: string[]
  sheetCount: number
  totalIngredientRows: number
}

interface ColumnMap {
  ingredient: number
  purchasePresentation: number
  purchasePrice: number
  purchaseQuantity: number
  unitCost: number
  recipeQuantity: number
  recipeCost: number
}

const COST_HEADERS = [
  'Ingrediente',
  'Presentación de compra',
  'PVP compra',
  'Cantidad de compra-presentación',
  'Costo por gr o uni',
  'Cantidad en receta',
  'Costo en receta',
]

const COLUMN_ALIASES = {
  ingredient: [
    'ingrediente',
    'ingredientes',
    'insumo',
    'insumos',
    'materia prima',
    'producto',
  ],
  purchasePresentation: [
    'presentacion de compra',
    'presentacion compra',
    'presentacion del producto',
    'presentacion',
    'empaque',
    'unidad de compra',
  ],
  purchasePrice: [
    'pvp compra',
    'precio de compra',
    'precio compra',
    'valor de compra',
    'valor compra',
    'costo de compra',
    'costo compra',
    'pvp',
  ],
  purchaseQuantity: [
    'cantidad de compra presentacion',
    'cantidad compra presentacion',
    'cantidad de compra',
    'cantidad compra',
    'contenido de compra',
    'contenido',
  ],
  unitCost: [
    'costo por gr o uni',
    'costo por gr o unidad',
    'costo por gramo o unidad',
    'costo por gr',
    'costo por gramo',
    'costo por unidad',
    'costo unitario',
  ],
  recipeQuantity: [
    'cantidad en receta',
    'cantidad receta',
    'cantidad usada en receta',
    'cantidad usada',
  ],
  recipeCost: [
    'costo en receta',
    'costo receta',
    'costo total en receta',
    'costo total receta',
  ],
} as const

function findColumn(headers: string[], aliases: readonly string[]): number {
  return headers.findIndex((header) =>
    aliases.some((alias) => header === alias || header.includes(alias)),
  )
}

function detectColumns(row: unknown[]): ColumnMap | null {
  const headers = row.map((cell) => normalizeText(String(cell ?? '')))
  const ingredient = findColumn(headers, COLUMN_ALIASES.ingredient)
  const recipeQuantity = findColumn(
    headers,
    COLUMN_ALIASES.recipeQuantity,
  )

  if (ingredient === -1 || recipeQuantity === -1) return null

  const purchasePrice = findColumn(headers, COLUMN_ALIASES.purchasePrice)
  const purchaseQuantity = findColumn(
    headers,
    COLUMN_ALIASES.purchaseQuantity,
  )
  const unitCost = findColumn(headers, COLUMN_ALIASES.unitCost)
  const hasPurchaseData = purchasePrice >= 0 && purchaseQuantity >= 0

  if (!hasPurchaseData && unitCost === -1) return null

  return {
    ingredient,
    purchasePresentation: findColumn(
      headers,
      COLUMN_ALIASES.purchasePresentation,
    ),
    purchasePrice,
    purchaseQuantity,
    unitCost,
    recipeQuantity,
    recipeCost: findColumn(headers, COLUMN_ALIASES.recipeCost),
  }
}

function cellText(row: unknown[], columnIndex: number): string {
  if (columnIndex < 0) return ''

  return String(row[columnIndex] ?? '').trim()
}

function rowTexts(row: unknown[]): string[] {
  return row
    .map((cell) => String(cell ?? '').trim())
    .filter(Boolean)
}

function isNumericText(value: string): boolean {
  const compact = value
    .replace(/[\s$€]/g, '')
    .toLowerCase()

  return (
    /^[-+]?[\d.,]+$/.test(compact) ||
    /^\([\d.,]+\)$/.test(compact) ||
    /^[-+]?[\d.,]+(usd|dolares|dólares)$/.test(compact)
  )
}

function isBlankRow(row: unknown[]): boolean {
  return rowTexts(row).length === 0
}

function isTotalRow(row: unknown[]): boolean {
  return row.some((cell) => {
    const text = normalizeText(String(cell ?? ''))
    return (
      text === 'total' ||
      text.startsWith('total ') ||
      text === 'subtotal' ||
      text.startsWith('subtotal ') ||
      text.includes('costo total')
    )
  })
}

function cleanRecipeTitle(value: string): string {
  return value
    .replace(
      /^(recetas?|platos?|platillos?)\s*(?:n[o°.]?\s*)?[:#-]\s*/i,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim()
}

function isAuxiliaryTitle(value: string): boolean {
  const normalized = normalizeText(value)

  return (
    /^(semana|quincena|mes)\b/.test(normalized) ||
    /^guarnicion(?:\s+\d+)?$/.test(normalized) ||
    /^plato fuerte(?:\s+opcion)?(?:\s+\d+)?$/.test(normalized) ||
    /^opcion(?:\s+\d+)?$/.test(normalized) ||
    /^(postre|fruta|bebida|sopa)(?:\s+\d+)?$/.test(normalized)
  )
}

function findTitleCandidate(row: unknown[]): string | null {
  for (const cell of row) {
    const text = String(cell ?? '').trim()
    if (!text || isNumericText(text)) continue

    const normalized = normalizeText(text)
    const letters = text.match(/[a-záéíóúüñ]/gi)?.join('') ?? ''

    if (letters.length < 3) continue
    if (
      /^(ingredientes?|presentacion|pvp|cantidad|costo total|costo por|total|subtotal|gramajes?|promedios?)\b/.test(
        normalized,
      )
    ) {
      continue
    }

    return cleanRecipeTitle(text)
  }

  return null
}

function parseIngredientRow(
  row: unknown[],
  columns: ColumnMap,
): { ingredient: RecipeIngredient | null; error: string | null } {
  const name = cellText(row, columns.ingredient)
  const recipeQuantity = parseQuantityNumber(
    row[columns.recipeQuantity],
  )
  let purchasePrice = parseCostNumber(row[columns.purchasePrice])
  let purchaseQuantity = parseQuantityNumber(
    row[columns.purchaseQuantity],
  )
  const unitCost = parseCostNumber(row[columns.unitCost])
  const recipeCost = parseCostNumber(row[columns.recipeCost])

  if (!name) {
    return { ingredient: null, error: 'Ingrediente sin nombre' }
  }

  if (
    recipeQuantity === null ||
    !Number.isFinite(recipeQuantity) ||
    recipeQuantity < 0
  ) {
    return {
      ingredient: null,
      error: 'Cantidad en receta inválida',
    }
  }

  const hasPurchaseData =
    purchasePrice !== null &&
    purchasePrice >= 0 &&
    purchaseQuantity !== null &&
    purchaseQuantity > 0

  if (!hasPurchaseData) {
    if (unitCost !== null && unitCost >= 0) {
      purchasePrice = unitCost
      purchaseQuantity = 1
    } else if (
      recipeCost !== null &&
      recipeCost >= 0 &&
      recipeQuantity > 0
    ) {
      purchasePrice = recipeCost / recipeQuantity
      purchaseQuantity = 1
    } else {
      return {
        ingredient: null,
        error: 'Precio o cantidad de compra inválidos',
      }
    }
  }

  return {
    ingredient: {
      id: `recipe-line-${crypto.randomUUID()}`,
      name,
      purchasePresentation: cellText(
        row,
        columns.purchasePresentation,
      ),
      purchasePrice: fromDollars(purchasePrice ?? 0),
      purchaseQuantity: purchaseQuantity ?? 1,
      recipeQuantity,
    },
    error: null,
  }
}

interface SheetParseOptions {
  useSheetNameAsFallback: boolean
}

function parseSheet(
  sheet: SpreadsheetSheet,
  options: SheetParseOptions,
): {
  recipes: ParsedCostRecipe[]
  warnings: string[]
} {
  const recipes: ParsedCostRecipe[] = []
  const warnings: string[] = []
  let columns: ColumnMap | null = null
  let recipeName: string | null = null
  let recipeRow = 1
  let ingredients: RecipeIngredient[] = []
  let recipeWarnings: string[] = []
  let pendingTitle: string | null = null
  let pendingTitleRow = 1

  function resetRecipe() {
    columns = null
    recipeName = null
    ingredients = []
    recipeWarnings = []
  }

  function offerPendingTitle(title: string | null, rowNumber: number) {
    if (!title) return
    if (
      pendingTitle &&
      !isAuxiliaryTitle(pendingTitle) &&
      isAuxiliaryTitle(title)
    ) {
      return
    }

    pendingTitle = title
    pendingTitleRow = rowNumber
  }

  function finalizeRecipe() {
    if (!columns) return

    if (ingredients.length === 0) {
      if (recipeName) {
        warnings.push(
          `${sheet.name}: "${recipeName}" no tiene ingredientes válidos y no se importó.`,
        )
      }
      resetRecipe()
      return
    }

    if (!recipeName) {
      warnings.push(
        `${sheet.name}: la tabla de la fila ${recipeRow} no tiene título de platillo y no se importó.`,
      )
      resetRecipe()
      return
    }

    recipes.push({
      key: getDishMatchKey(recipeName) || normalizeDishName(recipeName),
      dishName: recipeName,
      source: sheet.name,
      rowNumber: recipeRow,
      ingredients,
      warnings: recipeWarnings,
    })
    resetRecipe()
  }

  sheet.rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 1

    if (isBlankRow(row)) {
      finalizeRecipe()
      return
    }

    const detectedColumns = detectColumns(row)

    if (detectedColumns) {
      finalizeRecipe()

      if (!pendingTitle && options.useSheetNameAsFallback) {
        const sheetName = sheet.name.trim()
        const normalizedSheetName = normalizeText(sheetName)
        const isGenericName =
          /^(hoja|sheet)\s*\d*$/.test(normalizedSheetName) ||
          normalizedSheetName === ''

        if (!isGenericName) pendingTitle = sheetName
      }

      columns = detectedColumns
      recipeName = pendingTitle
        ? cleanRecipeTitle(pendingTitle)
        : null
      recipeRow = pendingTitle ? pendingTitleRow : rowNumber
      ingredients = []
      recipeWarnings = []
      pendingTitle = null
      return
    }

    if (columns) {
      if (isTotalRow(row)) {
        finalizeRecipe()
        pendingTitle = null
        return
      }

      const ingredientName = cellText(row, columns.ingredient)

      if (!ingredientName) {
        const title = findTitleCandidate(row)

        if (title) {
          finalizeRecipe()
          offerPendingTitle(title, rowNumber)
          return
        }

        const hasData = rowTexts(row).some(
          (text) =>
            isNumericText(text) || parseCostNumber(text) !== null,
        )

        if (hasData) {
          finalizeRecipe()
        }

        return
      }

      const hasIngredientValues = [
        columns.purchasePresentation,
        columns.purchasePrice,
        columns.purchaseQuantity,
        columns.recipeQuantity,
      ].some((columnIndex) => Boolean(cellText(row, columnIndex)))

      if (!hasIngredientValues) {
        finalizeRecipe()
        offerPendingTitle(cleanRecipeTitle(ingredientName), rowNumber)
        return
      }

      const parsed = parseIngredientRow(row, columns)

      if (parsed.ingredient) {
        ingredients.push(parsed.ingredient)
      } else {
        recipeWarnings.push(
          `Fila ${rowNumber}: ${parsed.error ?? 'ingrediente inválido'}.`,
        )
      }

      return
    }

    if (isTotalRow(row)) return

    offerPendingTitle(findTitleCandidate(row), rowNumber)
  })

  finalizeRecipe()

  return { recipes, warnings }
}

function mergeRecipes(recipes: ParsedCostRecipe[]): ParsedCostRecipe[] {
  const merged = new Map<string, ParsedCostRecipe>()

  for (const recipe of recipes) {
    merged.set(recipe.key, {
      ...recipe,
      ingredients: [...recipe.ingredients],
      warnings: [...recipe.warnings],
    })
  }

  return [...merged.values()]
}

export function buildCostRecipes(
  sheets: SpreadsheetSheet[],
  options: SheetParseOptions = { useSheetNameAsFallback: true },
): ParsedCostFile {
  const recipes: ParsedCostRecipe[] = []
  const warnings: string[] = []

  for (const sheet of sheets) {
    const parsed = parseSheet(sheet, options)
    recipes.push(...parsed.recipes)
    warnings.push(...parsed.warnings)
  }

  const mergedRecipes = mergeRecipes(recipes)

  return {
    recipes: mergedRecipes,
    warnings,
    sheetCount: sheets.length,
    totalIngredientRows: mergedRecipes.reduce(
      (total, recipe) => total + recipe.ingredients.length,
      0,
    ),
  }
}

export async function parseCostFile(file: File): Promise<ParsedCostFile> {
  const sheets = await readSpreadsheetSheets(file)

  return buildCostRecipes(sheets, {
    useSheetNameAsFallback: !file.name.toLowerCase().endsWith('.csv'),
  })
}

export interface ResolvedCostRecipe {
  recipe: ParsedCostRecipe
  dish: Dish | null
  isManual: boolean
}

export function resolveCostRecipes(
  recipes: ParsedCostRecipe[],
  dishes: Dish[],
  mappings: Record<string, string>,
): ResolvedCostRecipe[] {
  const matcher = createDishMatcher(dishes)
  const dishesById = new Map(dishes.map((dish) => [dish.id, dish]))

  return recipes.map((recipe) => {
    const manualDish = mappings[recipe.key]
      ? dishesById.get(mappings[recipe.key]) ?? null
      : null

    return {
      recipe,
      dish: manualDish ?? matcher(recipe.dishName),
      isManual: Boolean(manualDish),
    }
  })
}

export function createDishMatcher(
  dishes: Dish[],
): (recipeName: string) => Dish | null {
  const dishesByKey = new Map<string, Dish[]>()

  for (const dish of dishes) {
    const key = getDishMatchKey(dish.name)
    const current = dishesByKey.get(key) ?? []
    current.push(dish)
    dishesByKey.set(key, current)
  }

  return (recipeName) => {
    const key = getDishMatchKey(recipeName)
    if (!key) return null

    const exactMatches = dishesByKey.get(key) ?? []
    if (exactMatches.length === 1) return exactMatches[0]
    if (exactMatches.length > 1) return null

    const words = key.split(' ').filter((word) => word.length > 3)
    const partialMatches = dishes.filter((dish) => {
      const dishKey = getDishMatchKey(dish.name)
      if (!dishKey) return false
      if (dishKey.startsWith(`${key} `) || key.startsWith(`${dishKey} `)) {
        return true
      }

      return (
        words.length > 0 &&
        words.every((word) => dishKey.includes(word))
      )
    })

    return partialMatches.length === 1 ? partialMatches[0] : null
  }
}

const TEMPLATE_ROWS = [
  ['SOPA DE CHIFLES/12 ONZAS'],
  COST_HEADERS,
  [
    'Plátano verde',
    'Funda 500 gr',
    '$1,25',
    '500',
    '0,0025',
    '120',
    '$0,30',
  ],
  [
    'Aceite vegetal',
    'Botella 1 litro',
    '$2,50',
    '1000',
    '0,0025',
    '50',
    '$0,13',
  ],
  ['', '', '', '', '', 'TOTAL', '$0,43'],
  [''],
  ['ARROZ BLANCO'],
  COST_HEADERS,
  [
    'Arroz',
    'Funda 1000 gr',
    '$1,10',
    '1000',
    '0,0011',
    '250',
    '$0,28',
  ],
  ['', '', '', '', '', 'TOTAL', '$0,28'],
]

export function downloadCostTemplate() {
  downloadCsv('plantilla-costos-recetas.csv', TEMPLATE_ROWS)
}
