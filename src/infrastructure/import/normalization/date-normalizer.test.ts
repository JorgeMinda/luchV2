import { describe, expect, it } from 'vitest'
import {
  deduceDateFormat,
  normalizeDate,
  parseDateWithContext,
  parseExcelSerialDate,
} from './date-normalizer'

describe('date-normalizer', () => {
  describe('normalizeDate / parseDateWithContext — formatos ISO y estadounidenses', () => {
    it('parsea ISO 8601 sin ambigüedad', () => {
      const result = normalizeDate('2026-08-24')
      expect(result.normalized).toBe('2026-08-24')
      expect(result.ambiguous).toBe(false)
      expect(result.confidence).toBe('high')
    })

    it('parsea M/D/YYYY (8/24/2026) sin ambigüedad', () => {
      const result = normalizeDate('8/24/2026')
      expect(result.normalized).toBe('2026-08-24')
      expect(result.ambiguous).toBe(false)
    })

    it('parsea D/M/YYYY (31/8/2026) con día > 12 sin ambigüedad', () => {
      const result = normalizeDate('31/8/2026')
      expect(result.normalized).toBe('2026-08-31')
      expect(result.ambiguous).toBe(false)
    })

    it('parsea DD-MM-YYYY (14-09-2026) con día > 12 sin ambigüedad', () => {
      const result = normalizeDate('14-09-2026')
      expect(result.normalized).toBe('2026-09-14')
      expect(result.ambiguous).toBe(false)
    })
  })

  describe('ambigüedad bloqueada sin contexto', () => {
    it('bloquea 07-09-2026 (ambigua D/M vs M/D) sin contexto', () => {
      expect(() => normalizeDate('07-09-2026')).toThrow('ambigua')
    })

    it('bloquea 9/1/2026 (ambigua M/D vs D/M) sin contexto', () => {
      expect(() => normalizeDate('9/1/2026')).toThrow('ambigua')
    })

    it('bloquea 1/9/2026 (ambigua D/M vs M/D) sin contexto', () => {
      expect(() => normalizeDate('1/9/2026')).toThrow('ambigua')
    })
  })

  describe('resolución por contexto con incidencia trazable', () => {
    it('resuelve 1/9/2026 con contexto D/M/YYYY marcado como ambiguo', () => {
      const result = parseDateWithContext('1/9/2026', { format: 'D/M/YYYY' })
      expect(result.normalized).toBe('2026-09-01')
      expect(result.ambiguous).toBe(true)
      expect(result.confidence).toBe('low')
    })

    it('resuelve 9/1/2026 con contexto M/D/YYYY marcado como ambiguo', () => {
      const result = parseDateWithContext('9/1/2026', { format: 'M/D/YYYY' })
      expect(result.normalized).toBe('2026-09-01')
      expect(result.ambiguous).toBe(true)
    })

    it('rechaza fecha incompatible con el contexto (mes inválido)', () => {
      expect(() => parseDateWithContext('31/13/2026', { format: 'D/M/YYYY' })).toThrow()
    })
  })

  describe('fechas seriales de Excel', () => {
    it('serial 46258 (1900) → 2026-08-24', () => {
      const result = parseExcelSerialDate(46258)
      expect(result.normalized).toBe('2026-08-24')
    })

    it('serial 46259 → 2026-08-25', () => {
      const result = parseExcelSerialDate(46259)
      expect(result.normalized).toBe('2026-08-25')
    })

    it('serial ficticio 60 lanza error', () => {
      expect(() => parseExcelSerialDate(60)).toThrow('ficticio')
    })

    it('serial 61 (1900) → 2026-03-01 con corrección del bug bisiesto', () => {
      const result = parseExcelSerialDate(61)
      expect(result.normalized).toBe('1900-03-01')
    })

    it('sistema 1904: serial 0 → 1904-01-01', () => {
      const result = parseExcelSerialDate(0, true)
      expect(result.normalized).toBe('1904-01-01')
    })
  })

  describe('deduceDateFormat — detección por contexto del archivo', () => {
    it('detecta D/M/YYYY cuando hay 31/8/2026 en el archivo', () => {
      const ctx = deduceDateFormat(['31/8/2026', '1/9/2026', '2/9/2026'])
      expect(ctx?.format).toBe('D/M/YYYY')
    })

    it('detecta M/D/YYYY cuando hay 8/24/2026 en el archivo', () => {
      const ctx = deduceDateFormat(['8/24/2026', '8/25/2026', '8/26/2026'])
      expect(ctx?.format).toBe('M/D/YYYY')
    })

    it('detecta DD-MM-YYYY cuando hay 14-09-2026 en el archivo', () => {
      const ctx = deduceDateFormat(['14-09-2026', '15-09-2026'])
      expect(ctx?.format).toBe('DD-MM-YYYY')
    })

    it('retorna null cuando las pruebas son contradictorias', () => {
      const ctx = deduceDateFormat(['31/8/2026', '8/24/2026'])
      expect(ctx).toBeNull()
    })

    it('retorna null cuando no hay fechas no ambiguas', () => {
      const ctx = deduceDateFormat(['1/9/2026', '2/9/2026'])
      expect(ctx).toBeNull()
    })
  })
})