import type { Money } from '../../domain/value-objects/money'
import { fromCents } from '../../domain/value-objects/money'
export interface MoneyDTO {
  readonly cents: number
  readonly currency: 'USD'
}

export function isMoneyDTO(value: unknown): value is MoneyDTO {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { currency?: unknown }).currency === 'USD' &&
    typeof (value as { cents?: unknown }).cents === 'number' &&
    Number.isFinite((value as { cents: number }).cents) &&
    Number.isInteger((value as { cents: number }).cents)
  )
}

export function toMoneyDTO(money: Money): MoneyDTO {
  return {
    cents: money.cents,
    currency: 'USD',
  }
}

export function fromMoneyDTO(dto: MoneyDTO): Money {
  if (!isMoneyDTO(dto)) {
    throw new Error('DTO monetario inválido: se requiere cents entero finito y currency USD.')
  }

  return fromCents(dto.cents)}
