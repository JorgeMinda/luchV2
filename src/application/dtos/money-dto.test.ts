import { describe, expect, it } from 'vitest'
import { fromCents } from '../../domain/value-objects/money'
import { fromMoneyDTO, toMoneyDTO } from './money-dto'

describe('MoneyDTO contracts', () => {
  it('round-trips cents through DTO conversion', () => {
    const money = fromCents(-123)
    const dto = toMoneyDTO(money)

    expect(dto).toEqual({ cents: -123, currency: 'USD' })
    expect(fromMoneyDTO(dto).cents).toBe(-123)
  })

  it('rejects invalid DTOs', () => {
    expect(() => fromMoneyDTO({ cents: 1.5, currency: 'USD' } as never)).toThrow()
    expect(() => fromMoneyDTO({ cents: 10, currency: 'EUR' } as never)).toThrow()
    expect(() => fromMoneyDTO({ cents: Number.NaN, currency: 'USD' } as never)).toThrow()
  })
})
