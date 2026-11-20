/**
 * Fixtures de casos de cálculo verificables (10 casos).
 * Basados en el auditoría Excel Fase 4.2 - Hoja 1 (CATALOGO), Hoja 2 (COSTEO RECETAS),
 * Hoja 3 (COMPOSICION DE CADA PLATO), Hoja 4 (MENU SEMANAL).
 * Cada caso tiene trazabilidad: fuente, fórmula esperada, resultado esperado en centavos.
 */

import { fromCents } from '../../../domain/value-objects/money'
import type { RecipeIngredient } from '../../../domain/entities/recipe'

// ============================================================
// CASO 1: Costo unitario de ingrediente (CATALOGO)
// Fórmula Excel: =C5/D5  (Precio presentación / Cantidad presentación)
// Ejemplo: Arroz 1kg = $2.50 / 1000g = $0.0025/g = 0.25 centavos/g
// Precisión sub-centavo: 0.002500 USD/g = 250000 sub-centavos
// ============================================================
export const CALCULATION_CASE_1 = {
  id: 'CALC-001',
  description: 'Costo unitario ingrediente - Arroz 1kg',
  source: 'CATALOGO',
  sourceCell: 'E5',
  sourceFormula: '=C5/D5',
  inputs: {
    purchasePriceCents: 250, // $2.50
    purchaseQuantity: 1000, // 1000g
  },
  expected: {
    unitCostCents: 0.25, // $0.0025/g en centavos (sub-centavo)
    unitCostRaw: 0.0025, // USD/g precisión sub-centavo
  },
  verify: (result: { unitCostCents: number; unitCostRaw: number }) => {
    const tolerance = 0.000001
    return (
      Math.abs(result.unitCostCents - 0.25) < tolerance &&
      Math.abs(result.unitCostRaw - 0.0025) < tolerance
    )
  },
}

// ============================================================
// CASO 2: Costo de ingrediente en receta con merma
// Fórmula Excel: =(C5/D5)*E5/F5  (Costo unitario * Cantidad receta / Merma)
// Ejemplo: Pollo 1kg = $5.00, uso 200g, merma 20% (yield 80%)
// Costo = (500/1000) * 200 / 0.8 = 125 centavos = $1.25
// ============================================================
export const CALCULATION_CASE_2 = {
  id: 'CALC-002',
  description: 'Costo ingrediente en receta con merma - Pollo',
  source: 'COSTEO RECETAS',
  sourceCell: 'F10',
  sourceFormula: '=(C10/D10)*E10/F10',
  inputs: {
    purchasePriceCents: 500, // $5.00
    purchaseQuantity: 1000, // 1000g
    recipeQuantity: 200, // 200g
    yieldPercentage: 0.8, // 80% aprovechable
  },
  expected: {
    recipeCostCents: 125, // $1.25
  },
  verify: (result: { recipeCostCents: number }) => {
    return result.recipeCostCents === 125
  },
}

// ============================================================
// CASO 3: Costo total receta sin porciones definidas
// Suma de costos de ingredientes
// ============================================================
export const CALCULATION_CASE_3 = {
  id: 'CALC-003',
  description: 'Costo total receta - Sopa de verduras',
  source: 'COSTEO RECETAS',
  sourceCell: 'G15',
  sourceFormula: '=SUMA(F10:F14)',
  inputs: {
    ingredients: [
      { 
        id: 'ing-1',
        name: 'Cebolla',
        purchasePresentation: '1kg',
        purchasePrice: fromCents(100),
        purchaseQuantity: 500,
        recipeQuantity: 50,
        isActive: true,
        deletedAt: undefined,
        deletedBy: undefined,
      },
      { 
        id: 'ing-2',
        name: 'Zanahoria',
        purchasePresentation: '1kg',
        purchasePrice: fromCents(200),
        purchaseQuantity: 1000,
        recipeQuantity: 100,
        yieldPercentage: 0.9,
        isActive: true,
        deletedAt: undefined,
        deletedBy: undefined,
      },
      { 
        id: 'ing-3',
        name: 'Apio',
        purchasePresentation: '1kg',
        purchasePrice: fromCents(150),
        purchaseQuantity: 500,
        recipeQuantity: 30,
        isActive: true,
        deletedAt: undefined,
        deletedBy: undefined,
      },
    ] as RecipeIngredient[],
  },
  expected: {
    totalCostCents: 41, // 10 + 22 + 9 = 41
  },
  verify: (result: { totalCostCents: number }) => {
    return result.totalCostCents === 41
  },
}

// ============================================================
// CASO 4: Costo por porción de receta
// Fórmula Excel: =G15/H15  (Costo total / Porciones)
// ============================================================
export const CALCULATION_CASE_4 = {
  id: 'CALC-004',
  description: 'Costo por porción - Arroz con pollo (4 porciones)',
  source: 'COSTEO RECETAS',
  sourceCell: 'I15',
  sourceFormula: '=G15/H15',
  inputs: {
    totalCostCents: 400, // $4.00 total
    portions: 4,
  },
  expected: {
    costPerPortionCents: 100, // $1.00 por porción
  },
  verify: (result: { costPerPortionCents: number }) => {
    return result.costPerPortionCents === 100
  },
}

// ============================================================
// CASO 5: Composición de plato - Costo objetivo por componente
// Hoja COMPOSICION DE CADA PLATO
// Fórmula: =Costo_Unitario_Referencia * Cantidad_Neta_Por_Porcion
// ============================================================
export const CALCULATION_CASE_5 = {
  id: 'CALC-005',
  description: 'Costo objetivo componente - Proteína (Pollo) 80g',
  source: 'COMPOSICION DE CADA PLATO',
  sourceCell: 'E8',
  sourceFormula: '=C8*D8',
  inputs: {
    referenceUnitCostCents: 25, // $0.25/g (sub-centavo: 0.0025)
    netQuantityPerPortion: 80, // 80g
  },
  expected: {
    targetPortionCostCents: 20, // 0.25 * 80 = 20 centavos = $0.20
  },
  verify: (result: { targetPortionCostCents: number }) => {
    return result.targetPortionCostCents === 20
  },
}

// ============================================================
// CASO 6: Conversión de unidades - Onzas a gramos (F.10)
// 1 oz = 28.35 g (centralizado)
// ============================================================
export const CALCULATION_CASE_6 = {
  id: 'CALC-006',
  description: 'Conversión onzas a gramos - 4 oz de jugo',
  source: 'COSTEO RECETAS',
  sourceCell: 'D12',
  sourceFormula: '=C12*28.35',
  inputs: {
    ounces: 4,
  },
  expected: {
    grams: 113.4, // 4 * 28.35
  },
  verify: (result: { grams: number }) => {
    return Math.abs(result.grams - 113.4) < 0.01
  },
}

// ============================================================
// CASO 7: Costo total de menú semanal (suma de slots)
// Hoja MENU SEMANAL - 5 días, múltiples categorías
// ============================================================
export const CALCULATION_CASE_7 = {
  id: 'CALC-007',
  description: 'Costo total menú semanal - 5 días almuerzo',
  source: 'MENU SEMANAL',
  sourceCell: 'Resumen!B2',
  sourceFormula: '=SUMA(Lunes!B2:Viernes!B2)',
  inputs: {
    dailyCostsCents: [124, 124, 138, 124, 124], // Lunes a Viernes
  },
  expected: {
    weeklyCostCents: 634, // 124+124+138+124+124
  },
  verify: (result: { weeklyCostCents: number }) => {
    return result.weeklyCostCents === 634
  },
}

// ============================================================
// CASO 8: Validación de tolerancia composición (F.7)
// Diferencia ≤ 1 centavo = WARNING, > 1 centavo = ERROR
// ============================================================
export const CALCULATION_CASE_8 = {
  id: 'CALC-008',
  description: 'Validación tolerancia composición - dentro de tolerancia',
  source: 'COMPOSICION DE CADA PLATO',
  sourceCell: 'Validación!C5',
  sourceFormula: '=SI(ABS(C5-D5)<=1,"OK","REVISAR")',
  inputs: {
    targetCostCents: 124,
    calculatedCostCents: 125, // Diferencia = 1 centavo
  },
  expected: {
    status: 'WARNING', // Dentro de tolerancia (≤1)
    difference: 1,
  },
  verify: (result: { status: string; difference: number }) => {
    return result.status === 'WARNING' && result.difference === 1
  },
}

// ============================================================
// CASO 9: Validación de tolerancia composición - fuera de tolerancia
// ============================================================
export const CALCULATION_CASE_9 = {
  id: 'CALC-009',
  description: 'Validación tolerancia composición - fuera de tolerancia',
  source: 'COMPOSICION DE CADA PLATO',
  sourceCell: 'Validación!C6',
  sourceFormula: '=SI(ABS(C6-D6)<=1,"OK","REVISAR")',
  inputs: {
    targetCostCents: 124,
    calculatedCostCents: 127, // Diferencia = 3 centavos
  },
  expected: {
    status: 'ERROR', // Fuera de tolerancia (>1)
    difference: 3,
  },
  verify: (result: { status: string; difference: number }) => {
    return result.status === 'ERROR' && result.difference === 3
  },
}

// ============================================================
// CASO 10: Refrigerio - Costo composición snack
// ServiceType = 'snack' (F.6)
// ============================================================
export const CALCULATION_CASE_10 = {
  id: 'CALC-010',
  description: 'Costo composición refrigerio preescolar',
  source: 'COMPOSICION DE CADA PLATO',
  sourceCell: 'Refrigerio!E10',
  sourceFormula: '=SUMA(E5:E9)',
  inputs: {
    components: [
      { targetPortionCostCents: 25 }, // Leche
      { targetPortionCostCents: 20 }, // Galleta
      { targetPortionCostCents: 15 }, // Fruta
      { targetPortionCostCents: 12 }, // Jugo
      { targetPortionCostCents: 12 }, // Cereal
    ],
  },
  expected: {
    totalSnackCostCents: 84, // 25+20+15+12+12 = 84 (coincide con VERIFIED_TEMPLATE_TARGETS)
  },
  verify: (result: { totalSnackCostCents: number }) => {
    return result.totalSnackCostCents === 84
  },
}

// ============================================================
// TODOS LOS CASOS AGRUPADOS
// ============================================================
interface CalculationCase<TInput = any, TExpected = any> {
  id: string
  description: string
  source: string
  sourceCell: string
  sourceFormula: string
  inputs: TInput
  expected: TExpected
  verify: (result: any) => boolean
}

export const ALL_CALCULATION_CASES: CalculationCase[] = [
  CALCULATION_CASE_1,
  CALCULATION_CASE_2,
  CALCULATION_CASE_3,
  CALCULATION_CASE_4,
  CALCULATION_CASE_5,
  CALCULATION_CASE_6,
  CALCULATION_CASE_7,
  CALCULATION_CASE_8,
  CALCULATION_CASE_9,
  CALCULATION_CASE_10,
]

// ============================================================
// HELPERS DE VERIFICACIÓN
// ============================================================

export function runCalculationCase<TInput, TExpected>(
  caseDef: { id: string; inputs: TInput; expected: TExpected; verify: (result: any) => boolean },
  calculator: (inputs: TInput) => any,
): { caseId: string; passed: boolean; result: any; expected: TExpected } {
  const result = calculator(caseDef.inputs)
  const passed = caseDef.verify(result)
  return {
    caseId: caseDef.id,
    passed,
    result,
    expected: caseDef.expected,
  }
}

export function runAllCalculationCases(
  calculators: Map<string, (inputs: any) => any>,
): Array<{ caseId: string; passed: boolean; result: any; expected: any }> {
  return ALL_CALCULATION_CASES.map((caseDef) => {
    const calculator = calculators.get(caseDef.id)
    if (!calculator) {
      return { caseId: caseDef.id, passed: false, result: null, expected: caseDef.expected }
    }
    return runCalculationCase(caseDef, calculator)
  })
}