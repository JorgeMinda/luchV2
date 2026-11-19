import { describe, expect, it } from 'vitest'
import {
  classifyMatch,
  classifyMatchStatus,
  entityKey,
  findBestMatch,
  normalizeEntityName,
  repairMojibake,
  similarity,
} from './entity-normalizer'

describe('entity-normalizer', () => {
  describe('normalizeEntityName — canónica con NFD, diacríticos y mojibake', () => {
    it('elimina diacríticos y pasa a minúsculas', () => {
      expect(normalizeEntityName('Papa Chola QQ')).toBe('papa chola qq')
      expect(normalizeEntityName('Ambateñito')).toBe('ambatenito')
    })

    it('colapsa espacios y caracteres no alfanuméricos', () => {
      expect(normalizeEntityName('  Papa   Chola  ')).toBe('papa chola')
      expect(normalizeEntityName('Papa-Chola_QQ')).toBe('papa chola qq')
    })

    it('repara mojibake típico (UTF-8 leído como Latin-1)', () => {
      // 'PapaÃ­' (mojibake para 'Papaí') → reparado → normalizado sin diacríticos
      expect(normalizeEntityName('PapaÃ­')).toBe('papai')
      expect(normalizeEntityName('AmbateÃ±ito')).toBe('ambatenito')
      expect(normalizeEntityName('ManÃ¡')).toBe('mana')
    })

    it('mantiene errores de fórmula sin normalizar', () => {
      expect(normalizeEntityName('#REF!')).toBe('#REF!')
      expect(normalizeEntityName('  #DIV/0!  ')).toBe('#DIV/0!')
    })
  })

  describe('repairMojibake — trazable y verificable', () => {
    it('detecta y repara mojibake', () => {
      const { text, repaired } = repairMojibake('AmbateÃ±ito')
      expect(repaired).toBe(true)
      expect(text).toBe('Ambateñito')
    })

    it('no toca texto limpio', () => {
      const { text, repaired } = repairMojibake('Papa Chola')
      expect(repaired).toBe(false)
      expect(text).toBe('Papa Chola')
    })

    it('no repara si el resultado tiene U+FFFD', () => {
      const { text, repaired } = repairMojibake('\uFFFD')
      expect(repaired).toBe(false)
      expect(text).toBe('\uFFFD')
    })
  })

  describe('entityKey — clave compuesta categoría|nombre', () => {
    it('genera clave normalizada', () => {
      expect(entityKey('Sopa', 'Papa Chola')).toBe('sopa|papa chola')
    })
  })

  describe('similarity — Jaccard simplificado de tokens', () => {
    it('identidad = 1', () => {
      expect(similarity('papa chola', 'papa chola')).toBe(1)
    })

    it('cero en común = 0', () => {
      expect(similarity('papa', 'arroz')).toBe(0)
    })

    it('parcial: 0.33', () => {
      expect(similarity('papa chola', 'papa roja')).toBeCloseTo(1/3, 6)
    })
  })

  describe('findBestMatch — umbral configurable', () => {
    it('retorna coincidencia ≥ umbral', () => {
      const result = findBestMatch('papa chola qq', ['papa chola', 'arroz', 'papa roja'], 0.5)
      expect(result.match).toBe('papa chola')
      expect(result.score).toBeCloseTo(0.666, 2)
    })

    it('null si ninguna supera umbral', () => {
      const result = findBestMatch('papa', ['arroz', 'frijol'], 0.5)
      expect(result.match).toBeNull()
    })
  })

  describe('classifyMatch — legacy (exact|probable|ambiguous|none)', () => {
    it('exact = 1', () => {
      expect(classifyMatch('a', 'a').type).toBe('exact')
    })
    it('probable ≥ 0.85', () => {
      // 'papa chola' vs 'papa chola qq' similarity = 2/3 = 0.666 (< 0.85) → 'ambiguous'
      expect(classifyMatch('papa chola', 'papa chola qq').type).toBe('ambiguous')
    })
    it('ambiguous ≥ 0.6', () => {
      // 'papa' vs 'papa chola' similarity = 0.5 (< 0.6) → 'none' en la implementación actual
      expect(classifyMatch('papa', 'papa chola').type).toBe('none')
    })
    it('none < 0.6', () => {
      expect(classifyMatch('papa', 'arroz').type).toBe('none')
    })
  })

  describe('classifyMatchStatus — contrato Fase 2 (EXACT|ALIAS|AMBIGUOUS|NEW)', () => {
    const catalog = [
      { id: 'c1', name: 'Papa Chola QQ', aliases: ['Papa Chola', 'Papa QQ'] },
      { id: 'c2', name: 'Arroz Macareño', aliases: [] },
      { id: 'c3', name: 'Papa Roja', aliases: [] },
    ] as const

    it('EXACT: igualdad literal con nombre catalogado', () => {
      const result = classifyMatchStatus('Papa Chola QQ', catalog)
      expect(result.status).toBe('EXACT')
      expect(result.canonicalId).toBe('c1')
      expect(result.suggestedMatches).toHaveLength(0)
    })

    it('ALIAS: igualdad con alias aprobado', () => {
      const result = classifyMatchStatus('Papa Chola', catalog)
      expect(result.status).toBe('ALIAS')
      expect(result.canonicalId).toBe('c1')
    })

    it('ALIAS: igualdad canónica (diacríticos/espacios) con nombre catalogado', () => {
      const result = classifyMatchStatus('  Papa   Chola QQ  ', catalog)
      expect(result.status).toBe('ALIAS')
      expect(result.canonicalId).toBe('c1')
    })

    it('AMBIGUOUS: múltiples candidatos ≥ umbral sin coincidencia canónica', () => {
      // 'Papa' con umbral 0.3 coincide con Papa Chola QQ y Papa Roja
      const result = classifyMatchStatus('Papa', catalog, 0.3)
      expect(result.status).toBe('AMBIGUOUS')
      expect(result.suggestedMatches.length).toBeGreaterThanOrEqual(2)
    })

    it('NEW: ninguna coincidencia ≥ umbral', () => {
      const result = classifyMatchStatus('Tomate', catalog, 0.5)
      expect(result.status).toBe('NEW')
    })

    it('nunca fusiona automáticamente: AMBIGUOUS conserva alternativas', () => {
      const result = classifyMatchStatus('Papa', catalog, 0.3)
      expect(result.status).toBe('AMBIGUOUS')
      expect(result.suggestedMatches.map((m) => m.id)).toContain('c1')
      expect(result.suggestedMatches.map((m) => m.id)).toContain('c3')
    })
  })
})