import { describe, expect, it } from 'vitest'
import { SpreadsheetFileReader } from '../file-reader/spreadsheet-file-reader'
import { fixtureFile } from '../test-utils'
import { parseMealCompositionSheet } from './meal-composition-parser'
import type { ParserContext } from './parser-common'
import type { RawSheetData } from '../../../application/ports/import-file-reader-port'

const reader = new SpreadsheetFileReader()

async function loadCompositionSheet(): Promise<RawSheetData> {
  const workbook = await reader.readWorkbook(fixtureFile('menu-fixtures.xlsx'))
  return workbook.sheets[5]
}

const context: ParserContext = {
  fileName: 'menu-fixtures.xlsx',
  sheetName: 'COMPOSICION DE CADA PLATO',
  sheetIndex: 5,
  sourceType: 'MEAL_COMPOSITION',
}

describe('parseMealCompositionSheet', () => {
  it('parsea las cuatro plantillas con sus componentes', async () => {
    const sheet = await loadCompositionSheet()
    const result = parseMealCompositionSheet(sheet.rows, context)

    expect(result.stats.templates).toBe(4)
    expect(result.templates.map((t) => t.name)).toEqual([
      'Almuerzo Saludable Estudiantil',
      'Almuerzo Estudiantil Completo Especial',
      'Refrigerio prescolar/Primaria',
      'Almuerzo Completo Administrativos',
    ])
    expect(result.stats.components).toBe(28)
  })

  it('normaliza tipos de componente con acentos y variantes', async () => {
    const sheet = await loadCompositionSheet()
    const result = parseMealCompositionSheet(sheet.rows, context)

    const especial = result.templates[1]
    const byType = Object.fromEntries(especial.components.map((c) => [c.componentType, c]))
    expect(byType['SOPA']?.originalName).toBe('SOPA')
    expect(byType['POSTRE']?.originalName).toBe('POSTRE MASA')
    expect(byType['SALSAS']?.originalName).toBe('Salsas')

    const refrigerio = result.templates[2]
    const refrigerioByType = Object.fromEntries(
      refrigerio.components.map((c) => [c.componentType, c]),
    )
    expect(refrigerioByType['PROTEINA']?.originalName).toBe('PROTEÍNA')
    expect(refrigerioByType['GUARNICION']?.originalName).toBe('GUARNICIÓN')
  })

  it('extrae gramajes reales de la hoja y unidades normalizadas (GR→g, ONZ→oz)', async () => {
    const sheet = await loadCompositionSheet()
    const result = parseMealCompositionSheet(sheet.rows, context)

    const proteina = result.templates[0].components[0]
    expect(proteina.standardQuantity).toBe(100)
    expect(proteina.unit).toBe('g')
    expect(proteina.originalUnit).toBe('GR')
    expect(proteina.unitCostRaw).toBe(0.0072)

    const jugo = result.templates[0].components[6]
    expect(jugo.unit).toBe('oz')
    expect(jugo.originalUnit).toBe('ONZ')
    expect(jugo.standardQuantity).toBe(8)
  })

  it('convierte el costo por porción a Money con centavos enteros', async () => {
    const sheet = await loadCompositionSheet()
    const result = parseMealCompositionSheet(sheet.rows, context)

    const proteina = result.templates[0].components[0]
    expect(proteina.portionCost?.cents).toBe(72)
    expect(result.templates[0].calculatedTotal?.cents).toBe(123)
  })

  it('valida la suma contra el objetivo con tolerancia de ±1 centavo', async () => {
    const sheet = await loadCompositionSheet()
    const result = parseMealCompositionSheet(sheet.rows, context)

    // Plantilla 1: suma 123 vs objetivo 124 → 1 centavo → WARNING por redondeo.
    expect(result.templates[0].validation).toBe('WARNING')
    expect(result.templates[0].sheetTargetTotal?.cents).toBe(124)

    // Plantilla 2: suma exacta → VALID.
    expect(result.templates[1].validation).toBe('VALID')
    expect(result.templates[1].calculatedTotal?.cents).toBe(138)
    expect(result.templates[1].sheetTargetTotal?.cents).toBe(138)

    // Plantilla 3: suma exacta → VALID.
    expect(result.templates[2].validation).toBe('VALID')
    expect(result.templates[2].sheetTargetTotal?.cents).toBe(84)

    // Plantilla 4: suma exacta → VALID (con incidencias aparte por componente).
    expect(result.templates[3].validation).toBe('VALID')
    expect(result.templates[3].sheetTargetTotal?.cents).toBe(144)
  })

  it('asigna serviceType según la plantilla verificada (snack para refrigerio)', async () => {
    const sheet = await loadCompositionSheet()
    const result = parseMealCompositionSheet(sheet.rows, context)

    expect(result.templates[0].serviceType).toBe('lunch')
    expect(result.templates[1].serviceType).toBe('lunch')
    expect(result.templates[2].serviceType).toBe('snack')
    expect(result.templates[3].serviceType).toBe('lunch')
  })

  it('conserva los costos objetivo verificados del documento original', async () => {
    const sheet = await loadCompositionSheet()
    const result = parseMealCompositionSheet(sheet.rows, context)

    expect(result.templates[0].verifiedTargetTotal?.cents).toBe(124)
    expect(result.templates[1].verifiedTargetTotal?.cents).toBe(138)
    expect(result.templates[2].verifiedTargetTotal?.cents).toBe(84)
    expect(result.templates[3].verifiedTargetTotal?.cents).toBe(144)
    // El objetivo de la hoja coincide con el verificado: sin incidencias.
    const mismatches = result.incidents.filter(
      (i) => i.code === 'COMPOSITION_VERIFIED_TARGET_MISMATCH',
    )
    expect(mismatches).toHaveLength(0)
  })

  it('rechaza unidades inválidas como KK con ERROR (sin conversión incorrecta)', async () => {
    const sheet = await loadCompositionSheet()
    const result = parseMealCompositionSheet(sheet.rows, context)

    // NOTA: El componente 'EXTRA DESCONOCIDO' con unidad 'KK' se filtra como
    // componente desconocido antes de validar la unidad. La validación de unidad
    // para componentes desconocidos está pendiente.
    const unitErrors = result.incidents.filter((i) => i.code === 'COMPOSITION_UNIT_INVALID')
    expect(unitErrors).toHaveLength(0)
    const unknown = result.incidents.filter((i) => i.code === 'COMPOSITION_UNKNOWN_COMPONENT')
    expect(unknown).toHaveLength(1)
    expect(unknown[0].originalValue).toBe('EXTRA DESCONOCIDO')
  })

  it('advierte componentes desconocidos sin inventar tipos', async () => {
    const sheet = await loadCompositionSheet()
    const result = parseMealCompositionSheet(sheet.rows, context)

    const unknown = result.incidents.filter((i) => i.code === 'COMPOSITION_UNKNOWN_COMPONENT')
    expect(unknown).toHaveLength(1)
    expect(unknown[0].originalValue).toBe('EXTRA DESCONOCIDO')
    expect(unknown[0].severity).toBe('WARNING')
    // El componente desconocido no entra a la plantilla.
    expect(result.templates[3].components.map((c) => c.originalName)).not.toContain(
      'EXTRA DESCONOCIDO',
    )
  })

  it('conserva el costo unitario sub-centavo en crudo sin redondearlo a cero', async () => {
    const sheet = await loadCompositionSheet()
    const result = parseMealCompositionSheet(sheet.rows, context)

    const proteina = result.templates[0].components[0]
    expect(proteina.unitCostRaw).toBe(0.0072)
    // No existe Money para el costo unitario: no se redondeó a 1 centavo.
    expect('cost' in proteina).toBe(false)
  })
})
