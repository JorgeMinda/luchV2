/**
 * Normalizador de unidades de medida para importación.
 *
 * Reglas del contrato (Fase 3):
 * - `kg` → gramos (×1000); `g` permanece en gramos.
 * - `lb` equivale a 454 g, salvo que el documento indique explícitamente
 *   otro factor de compra.
 * - `l` → mililitros (×1000) cuando corresponda; `ml` permanece en ml.
 * - Nunca se convierte `ml` → `g` sin una densidad conocida.
 * - No hay conversiones dimensionalmente incorrectas.
 * - Unidades inválidas (ej. `KK`) se rechazan retornando `null`.
 * - Cada conversión conserva unidad original, unidad normalizada y factor.
 * - **1 oz = 28.35 g** (conciliación con Excel, F.10).
 */

import type { UnitOfMeasure, UnitConversion } from '../../../domain/value-objects/unit-of-measure'

const LB_TO_GRAMS = 454
/** Factor oficial para conciliación con Excel: 1 oz = 28.35 g (F.10). */
const OZ_TO_GRAMS = 28.35

export const OZ_STANDARD_FACTOR = OZ_TO_GRAMS

/** Factor de conversión a gramos; `null` para unidades no masivas o volumen sin densidad. */
const MASS_FACTORS: Partial<Record<UnitOfMeasure, number>> = {
  g: 1,
  kg: 1000,
  lb: LB_TO_GRAMS,
  oz: OZ_TO_GRAMS,
}

/** Unidades de volumen: solo convertibles a masa con densidad explícita. */
const VOLUME_UNITS: readonly UnitOfMeasure[] = ['ml', 'l']

export function isVolumeUnit(unit: UnitOfMeasure): boolean {
  return VOLUME_UNITS.includes(unit)
}

/**
 * Normaliza una cadena de unidad a un `UnitOfMeasure` válido.
 * Soporta alias comunes en español: `GR`, `gr`, `gramos`, `ONZ`, `onzas`, etc.
 * Retorna `null` para unidades inválidas o desconocidas (ej. `KK`).
 */
export function normalizeUnit(rawUnit: string): UnitOfMeasure | null {
  const normalized = rawUnit.trim().toLowerCase().replace(/\./g, '')

  const unitMap: Record<string, UnitOfMeasure> = {
    g: 'g',
    gr: 'g',
    grs: 'g',
    gramo: 'g',
    gramos: 'g',
    kg: 'kg',
    kilo: 'kg',
    kilos: 'kg',
    kilogramo: 'kg',
    kilogramos: 'kg',
    ml: 'ml',
    mililitro: 'ml',
    mililitros: 'ml',
    l: 'l',
    lt: 'l',
    litro: 'l',
    litros: 'l',
    un: 'un',
    unidad: 'un',
    unidades: 'un',
    ud: 'un',
    u: 'un',
    lb: 'lb',
    lbs: 'lb',
    libra: 'lb',
    libras: 'lb',
    oz: 'oz',
    onz: 'oz',
    ozs: 'oz',
    onza: 'oz',
    onzas: 'oz',
  }

  return unitMap[normalized] ?? null
}

export interface GramConversionResult {
  /** Gramos resultantes, o `null` si la conversión no puede realizarse. */
  readonly grams: number | null
  readonly requiresDensity: boolean
  /** Factor aplicado (unidad → gramos); `null` cuando no se aplicó. */
  readonly factor: number | null
  readonly densityUsed?: number
}

/**
 * Convierte una cantidad a gramos.
 * - Unidades de masa: conversión directa con factor documentado.
 * - Unidades de volumen (`ml`, `l`): requieren densidad (g/ml). Sin densidad
 *   explícita no se convierte (`grams: null`, `requiresDensity: true`); no se
 *   asume la densidad del agua.
 * - Unidades discretas (`un`): no son convertibles a masa (`grams: null`).
 */
export function toGrams(
  amount: number,
  fromUnit: UnitOfMeasure,
  density?: number,
): GramConversionResult {
  if (fromUnit === 'un') {
    return { grams: null, requiresDensity: false, factor: null }
  }

  if (isVolumeUnit(fromUnit)) {
    if (density === undefined || !Number.isFinite(density) || density <= 0) {
      return { grams: null, requiresDensity: true, factor: null }
    }
    const litersFactor = fromUnit === 'l' ? 1000 : 1
    return {
      grams: amount * litersFactor * density,
      requiresDensity: true,
      factor: litersFactor * density,
      densityUsed: density,
    }
  }

  const factor = MASS_FACTORS[fromUnit]
  if (factor === undefined) {
    return { grams: null, requiresDensity: false, factor: null }
  }
  return { grams: amount * factor, requiresDensity: false, factor }
}

export interface UnitConversionResult {
  readonly result: number | null
  readonly originalUnit: UnitOfMeasure
  readonly normalizedUnit: UnitOfMeasure
  /** Factor aplicado de original a destino; `null` cuando no se pudo convertir. */
  readonly factor: number | null
  readonly requiresDensity: boolean
  readonly densityUsed?: number
}

/**
 * Convierte entre unidades compatibles de la misma dimensión:
 * masa↔masa, volumen↔volumen. La conversión masa↔volumen solo con densidad.
 * Retorna `result: null` (con la unidad original y destino conservadas) cuando
 * la conversión no está permitida o no puede resolverse de forma segura.
 */
export function convertUnits(
  amount: number,
  fromUnit: UnitOfMeasure,
  toUnit: UnitOfMeasure,
  options?: { density?: number; explicitFactor?: number },
): UnitConversionResult {
  const requiresDensity = isVolumeUnit(fromUnit) !== isVolumeUnit(toUnit)

  if (fromUnit === toUnit) {
    return {
      result: amount,
      originalUnit: fromUnit,
      normalizedUnit: toUnit,
      factor: 1,
      requiresDensity: false,
    }
  }

  if (isVolumeUnit(fromUnit) && isVolumeUnit(toUnit)) {
    const factor = fromUnit === 'l' && toUnit === 'ml' ? 1000 : 0.001
    return {
      result: amount * factor,
      originalUnit: fromUnit,
      normalizedUnit: toUnit,
      factor,
      requiresDensity: false,
    }
  }

  const toGramsResult = toGrams(amount, fromUnit, options?.density)
  if (toGramsResult.grams === null) {
    return {
      result: null,
      originalUnit: fromUnit,
      normalizedUnit: toUnit,
      factor: null,
      requiresDensity: toGramsResult.requiresDensity || requiresDensity,
      densityUsed: toGramsResult.densityUsed,
    }
  }

  const targetFactor = options?.explicitFactor ?? MASS_FACTORS[toUnit]
  if (targetFactor === undefined || targetFactor <= 0) {
    return {
      result: null,
      originalUnit: fromUnit,
      normalizedUnit: toUnit,
      factor: null,
      requiresDensity,
    }
  }

  if (toGramsResult.factor === null) {
    return {
      result: null,
      originalUnit: fromUnit,
      normalizedUnit: toUnit,
      factor: null,
      requiresDensity,
    }
  }

  return {
    result: toGramsResult.grams / targetFactor,
    originalUnit: fromUnit,
    normalizedUnit: toUnit,
    factor: toGramsResult.factor / targetFactor,
    requiresDensity,
    densityUsed: toGramsResult.densityUsed,
  }
}

/** Unidades soportadas. */
export const SUPPORTED_UNITS: readonly UnitOfMeasure[] = ['g', 'kg', 'ml', 'l', 'un', 'lb', 'oz']

export { type UnitConversion }