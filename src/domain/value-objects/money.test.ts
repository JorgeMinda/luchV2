import { describe, expect, it } from 'vitest'
import {
  addMoney,
  divideMoney,
  fromCents,
  fromDollars,
  equals,
  isGreaterThanOrEqual,
  multiplyMoney,
  subtract,
  toDollars,
  toString,
} from './money'

describe('Money value object', () => {
  describe('fromDollars / fromCents', () => {
    it('convierte dólares a centavos', () => {
      expect(fromDollars(2.5).cents).toBe(250)
      expect(fromDollars(0).cents).toBe(0)
      expect(fromDollars(10.99).cents).toBe(1099)
    })

    it('acepta montos negativos y rechaza no finitos', () => {
      expect(fromDollars(-1).cents).toBe(-100)
      expect(fromCents(-5).cents).toBe(-5)
      expect(() => fromDollars(NaN)).toThrow('Monto inválido')
      expect(() => fromDollars(Infinity)).toThrow('Monto inválido')
      expect(() => fromCents(NaN)).toThrow('Monto inválido')
      expect(() => fromCents(1.5)).toThrow('Monto inválido')
    })
  })

  describe('addMoney', () => {
    it('suma dos montos', () => {
      const a = fromDollars(2.5)
      const b = fromDollars(1.75)
      expect(toDollars(addMoney(a, b))).toBe(4.25)
    })
  })

  describe('subtract', () => {
    it('resta dos montos', () => {
      const a = fromDollars(5.0)
      const b = fromDollars(2.0)
      expect(toDollars(subtract(a, b))).toBe(3.0)
    })

    it('lanza error si el resultado es negativo', () => {
      const a = fromDollars(1.0)
      const b = fromDollars(2.0)
      expect(() => subtract(a, b)).toThrow('Saldo insuficiente')
    })
  })

  describe('multiplyMoney', () => {
    it('multiplica por un factor', () => {
      const a = fromDollars(2.5)
      expect(toDollars(multiplyMoney(a, 3))).toBe(7.5)
    })

    it('acepta factores negativos y rechaza no finitos', () => {
      expect(toDollars(multiplyMoney(fromDollars(1), -1))).toBe(-1)
      expect(() => multiplyMoney(fromDollars(1), NaN)).toThrow('Factor inválido')
      expect(() => multiplyMoney(fromDollars(1), Infinity)).toThrow('Factor inválido')
    })
  })

  describe('divideMoney', () => {
    it('divide entre un divisor', () => {
      const a = fromDollars(10.0)
      expect(toDollars(divideMoney(a, 4))).toBe(2.5)
    })

    it('rechaza divisores cero o negativos', () => {
      expect(() => divideMoney(fromDollars(1), 0)).toThrow('Divisor inválido')
      expect(() => divideMoney(fromDollars(1), -1)).toThrow('Divisor inválido')
    })
  })

  describe('comparisons', () => {
    it('compara igualdad y mayor o igual', () => {
      const a = fromDollars(5.0)
      const b = fromDollars(5.0)
      const c = fromDollars(3.0)

      expect(equals(a, b)).toBe(true)
      expect(equals(a, c)).toBe(false)
      expect(isGreaterThanOrEqual(a, c)).toBe(true)
      expect(isGreaterThanOrEqual(c, a)).toBe(false)
    })
  })

  describe('toString / toDollars', () => {
    it('formatea correctamente', () => {
      expect(toString(fromDollars(2.5))).toBe('2.50')
      expect(toDollars(fromDollars(2.5))).toBe(2.5)
    })
  })
})
