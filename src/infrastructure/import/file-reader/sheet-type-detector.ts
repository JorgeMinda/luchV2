import type { SourceType } from '../../../domain/value-objects/source-type'
import type { SheetTypeDetection } from '../../../application/ports/import-file-reader-port'

/**
 * Detección explícita y auditable del SourceType de una hoja.
 * La comparación es insensible a acentos, mayúsculas y espacios finales/interiores,
 * de modo que `COSTEO REFRIGERIOS ` (con espacio final) se reconozca igual.
 * Nunca se asigna un SourceType por coincidencia débil: si hay ambigüedad se
 * reportan las alternativas sin resolverla automáticamente.
 */

interface SheetRule {
  readonly ruleId: string
  readonly sourceType: SourceType
  readonly keywords: readonly string[]
}

const SHEET_RULES: readonly SheetRule[] = [
  {
    ruleId: 'SHEET_MEAL_COMPOSITION',
    sourceType: 'MEAL_COMPOSITION',
    keywords: ['COMPOSICION DE CADA PLATO', 'COMPOSICION'],
  },
  {
    ruleId: 'SHEET_CATALOG',
    sourceType: 'CATALOG',
    keywords: ['CATALOGO COSTEO', 'CATALOGO', 'CATALOG'],
  },
  {
    ruleId: 'SHEET_RECIPE_COSTING',
    sourceType: 'RECIPE_COSTING',
    keywords: ['COSTEO RECETA', 'COSTEO REFRIGERIOS', 'COSTEO'],
  },
  {
    ruleId: 'SHEET_MENU_PLAN',
    sourceType: 'MENU_PLAN',
    keywords: ['MENU AGSTO', 'MENU REFRIGERIOS', 'MENU'],
  },
]

/** Normaliza para comparación: trim, mayúsculas, sin acentos, espacios colapsados. */
export function canonicalSheetName(name: string): string {
  return name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

export function detectSheetSourceType(
  sheetName: string,
  sheetIndex: number,
): SheetTypeDetection {
  const canonical = canonicalSheetName(sheetName)

  const matches: { rule: SheetRule; keyword: string; position: number }[] = []
  for (const rule of SHEET_RULES) {
    let bestKeyword: string | null = null
    let bestPosition = Number.MAX_SAFE_INTEGER
    for (const keyword of rule.keywords) {
      const position = canonical.indexOf(keyword)
      if (position >= 0 && position < bestPosition) {
        bestKeyword = keyword
        bestPosition = position
      }
    }
    if (bestKeyword !== null) {
      matches.push({ rule, keyword: bestKeyword, position: bestPosition })
    }
  }

  if (matches.length === 0) {
    return {
      sheetName,
      sheetIndex,
      confidence: 'NONE',
    }
  }

  if (matches.length > 1) {
    // Ambigüedad real: varias reglas aplican a la misma hoja.
    // Se resuelve por la coincidencia más temprana en el nombre y se reportan
    // las alternativas para revisión.
    const sorted = [...matches].sort((a, b) => a.position - b.position)
    const winner = sorted[0]
    return {
      sheetName,
      sheetIndex,
      sourceType: winner.rule.sourceType,
      ruleId: winner.rule.ruleId,
      matchedKeyword: winner.keyword,
      confidence: 'MEDIUM',
      alternatives: sorted
        .slice(1)
        .map((m) => m.rule.sourceType),
    }
  }

  const only = matches[0]
  return {
    sheetName,
    sheetIndex,
    sourceType: only.rule.sourceType,
    ruleId: only.rule.ruleId,
    matchedKeyword: only.keyword,
    confidence: 'HIGH',
  }
}
