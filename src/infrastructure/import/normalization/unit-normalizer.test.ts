import { describe, expect, it } from 'vitest'
import {
  convertUnits,
  normalizeUnit,
  toGrams,
} from './unit-normalizer'

describe('unit-normalizer', () => {
  describe('normalizeUnit', () => {
    it('normaliza alias comunes en español', () => {
      expect(normalizeUnit('GR')).toBe('g')
      expect(normalizeUnit(' g ')).toBe('g')
      expect(normalizeUnit('gramos')).toBe('g')
      expect(normalizeUnit('KG')).toBe('kg')
      expect(normalizeUnit('ML')).toBe('ml')
      expect(normalizeUnit('LT')).toBe('l')
      expect(normalizeUnit('UNIDAD')).toBe('un')
      expect(normalizeUnit('LIBRA')).toBe('lb')
      expect(normalizeUnit('ONZ')).toBe('oz')
    })

    it('rechaza unidades inválidas como KK', () => {
      expect(normalizeUnit('KK')).toBeNull()
      expect(normalizeUnit('xyz')).toBeNull()
      expect(normalizeUnit('')).toBeNull()
    })
  })

  it('kg se convierte a gramos con factor 1000', () => {
    const result = toGrams(2, 'kg')
    expect(result.grams).toBe(2000)
    expect(result.factor).toBe(1000)
    expect(result.requiresDensity).toBe(false)
  })

  it('g permanece en gramos (factor 1)', () => {
    const result = toGrams(500, 'g')
    expect(result.grams).toBe(500)
    expect(result.factor).toBe(1)
  })

  it('lb equivale a 454 g', () => {
    const result = toGrams(1, 'lb')
    expect(result.grams).toBe(454)
    expect(result.factor).toBe(454)
  })

  it('l se convierte a mililitros con factor 1000', () => {
    const result = convertUnits(2, 'l', 'ml')
    expect(result.result).toBe(2000)
    expect(result.factor).toBe(1000)
    expect(result.originalUnit).toBe('l')
    expect(result.normalizedUnit).toBe('ml')
  })

  it('no convierte ml → g sin densidad (nunca asume la densidad del agua)', () => {
    const result = toGrams(100, 'ml')
    expect(result.grams).toBeNull()
    expect(result.requiresDensity).toBe(true)
    expect(result.factor).toBeNull()
  })

  it('convierte ml → g solo con densidad explícita', () => {
    const result = toGrams(100, 'ml', 1.03)
    expect(result.grams).toBeCloseTo(103, 6)
    expect(result.requiresDensity).toBe(true)
    expect(result.densityUsed).toBe(1.03)
  })

  it('convertUnits ml → g sin densidad retorna null conservando unidades', () => {
    const result = convertUnits(100, 'ml', 'g')
    expect(result.result).toBeNull()
    expect(result.originalUnit).toBe('ml')
    expect(result.normalizedUnit).toBe('g')
    expect(result.factor).toBeNull()
    expect(result.requiresDensity).toBe(true)
  })

  it('no realiza conversiones dimensionalmente incorrectas (un → g)', () => {
    const result = convertUnits(5, 'un', 'g')
    expect(result.result).toBeNull()
    expect(result.factor).toBeNull()
  })

  it('cada conversión conserva unidad original, normalizada y factor', () => {
    const result = convertUnits(1, 'kg', 'g')
    expect(result.originalUnit).toBe('kg')
    expect(result.normalizedUnit).toBe('g')
    expect(result.factor).toBe(1000)
    expect(result.result).toBe(1000)
  })
})
