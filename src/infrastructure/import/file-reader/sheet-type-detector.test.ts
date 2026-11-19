import { describe, expect, it } from 'vitest'
import { canonicalSheetName, detectSheetSourceType } from './sheet-type-detector'

describe('sheet-type-detector', () => {
  it('clasifica la hoja de catálogo', () => {
    const detection = detectSheetSourceType('CATALOGO COSTEO 17-08-2', 0)
    expect(detection.sourceType).toBe('CATALOG')
    expect(detection.ruleId).toBe('SHEET_CATALOG')
    // La hoja 'CATALOGO COSTEO' coincide también con la regla RECIPE_COSTING
    // (palabra clave 'COSTEO'), por lo que la confianza es MEDIUM con alternativas.
    expect(detection.confidence).toBe('MEDIUM')
    expect(detection.alternatives).toContain('RECIPE_COSTING')
  })

  it('clasifica hojas de costeo de recetas (almuerzos y refrigerios)', () => {
    expect(detectSheetSourceType('COSTEO RECETA ALMUERZOS', 1).sourceType).toBe('RECIPE_COSTING')
  })

  it('ignora espacios finales: COSTEO REFRIGERIOS con espacio', () => {
    const detection = detectSheetSourceType('COSTEO REFRIGERIOS ', 3)
    expect(detection.sourceType).toBe('RECIPE_COSTING')
    expect(detection.confidence).toBe('HIGH')
  })

  it('clasifica hojas de menú con acentos', () => {
    const detection = detectSheetSourceType('MENÚ AGSTO-JULIO2026-2027', 2)
    expect(detection.sourceType).toBe('MENU_PLAN')
    expect(detection.confidence).toBe('HIGH')
    expect(detection.matchedKeyword).toBe('MENU AGSTO')
  })

  it('clasifica MENU REFRIGERIOS como plan de menú', () => {
    expect(detectSheetSourceType('MENU REFRIGERIOS', 4).sourceType).toBe('MENU_PLAN')
  })

  it('clasifica la hoja de composición de platos', () => {
    const detection = detectSheetSourceType('COMPOSICION DE CADA PLATO', 5)
    expect(detection.sourceType).toBe('MEAL_COMPOSITION')
    expect(detection.ruleId).toBe('SHEET_MEAL_COMPOSITION')
  })

  it('resuelve la ambigüedad CATALOGO COSTEO de forma explícita y auditable', () => {
    const detection = detectSheetSourceType('CATALOGO COSTEO 17-08-2', 0)
    expect(detection.sourceType).toBe('CATALOG')
    // La regla CATALOGO se evalúa antes que COSTEO, y la coincidencia más
    // temprana decide; el resultado es trazable con la regla ganadora.
    expect(detection.ruleId).toBe('SHEET_CATALOG')
  })

  it('no asigna SourceType a hojas desconocidas (confidence NONE)', () => {
    const detection = detectSheetSourceType('HOJA EXTRA', 6)
    expect(detection.sourceType).toBeUndefined()
    expect(detection.confidence).toBe('NONE')
    expect(detection.ruleId).toBeUndefined()
  })

  it('canonicalSheetName normaliza acentos, espacios y mayúsculas', () => {
    expect(canonicalSheetName('  MENÚ AGSTO  ')).toBe('MENU AGSTO')
    expect(canonicalSheetName('COMPOSICIÓN')).toBe('COMPOSICION')
  })
})
